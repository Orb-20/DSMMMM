"""Flask API backend for Graph Portfolio Optimizer."""

import sys
import os
import json
import numpy as np
import pandas as pd
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from src.config import (
    TICKERS, START_DATE, END_DATE, RISK_FREE_RATE, CLUSTER_METHOD,
    COVARIANCE_METHOD, GRAPH_FILTER, THRESHOLD, ALLOW_SHORT,
    MAX_WEIGHT, N_FRONTIER_POINTS,
)
from src.preprocessing.loader import load_prices
from src.preprocessing.cleaner import compute_log_returns, validate_returns
from src.estimation.returns import estimate_mean_returns
from src.estimation.covariance import estimate_covariance, ensure_psd
from src.correlation.distance import compute_correlation, correlation_to_distance
from src.graph.builder import build_graph
from src.graph.filters import apply_mst_filter, apply_threshold_filter
from src.graph.laplacian import compute_laplacian
from src.clustering.spectral import spectral_cluster, estimate_k
from src.clustering.louvain import louvain_cluster
from src.optimization.cluster_weights import cluster_aware_optimize
from src.optimization.frontier import compute_efficient_frontier
from src.optimization.markowitz import markowitz_optimize
from src.results.metrics import compute_portfolio_metrics

import networkx as nx

app = Flask(__name__, static_folder=os.path.join(PROJECT_ROOT, "frontend"))
CORS(app)

# Cache pipeline results
_cache = {}


def run_pipeline():
    """Run the full pipeline and cache results."""
    if _cache:
        return _cache

    print("Running portfolio optimization pipeline...")

    # Step 1: Load data
    data_dir = os.path.join(PROJECT_ROOT, "data")
    prices = load_prices(TICKERS, START_DATE, END_DATE, data_dir=data_dir)
    log_ret = compute_log_returns(prices)
    log_ret = validate_returns(log_ret)
    tickers = list(log_ret.columns)
    R = log_ret.values
    T, N = R.shape

    # Step 2: Estimation
    mu = estimate_mean_returns(R)
    Sigma = estimate_covariance(R, method=COVARIANCE_METHOD)
    Sigma = ensure_psd(Sigma)

    # Step 3: Correlation & Distance
    C = compute_correlation(R)
    D = correlation_to_distance(C)

    # Step 4: Graph
    G_full = build_graph(D, tickers)
    if GRAPH_FILTER == "mst":
        G_filtered = apply_mst_filter(G_full)
    else:
        G_filtered = apply_threshold_filter(G_full, THRESHOLD)

    # Step 5: Clustering
    L, nodelist = compute_laplacian(G_filtered, normalized=True)
    cluster_map = None
    if CLUSTER_METHOD == "spectral":
        eigenvalues, _ = np.linalg.eigh(L)
        k = estimate_k(eigenvalues)
        cluster_map = spectral_cluster(L, k, nodelist)
    if cluster_map is None:
        cluster_map = louvain_cluster(G_filtered)

    # Step 6: Optimization
    final_weights = cluster_aware_optimize(mu, Sigma, cluster_map, tickers, max_weight=MAX_WEIGHT)

    # Efficient frontier
    frontier_df = compute_efficient_frontier(
        mu, Sigma, n_points=N_FRONTIER_POINTS,
        allow_short=ALLOW_SHORT, max_weight=MAX_WEIGHT,
    )

    # Step 7: Metrics
    metrics = compute_portfolio_metrics(final_weights, mu, Sigma, R, risk_free_rate=RISK_FREE_RATE)
    metrics["n_assets"] = N
    metrics["n_clusters"] = len(set(cluster_map.values()))
    metrics["optimization_status"] = "optimal"

    # Price history for chart
    price_history = []
    prices_clean = prices[tickers]
    for date, row in prices_clean.iterrows():
        entry = {"date": date.strftime("%Y-%m-%d")}
        for t in tickers:
            entry[t] = round(float(row[t]), 2)
        price_history.append(entry)

    # Downsample price history (weekly)
    price_history_weekly = price_history[::5]

    # Portfolio value over time
    port_returns = R @ final_weights
    port_cumulative = np.cumprod(1 + port_returns)
    port_dates = prices_clean.index[1:]  # skip first (no return)
    portfolio_history = []
    for i, date in enumerate(port_dates):
        portfolio_history.append({
            "date": date.strftime("%Y-%m-%d"),
            "value": round(float(port_cumulative[i]) * 10000, 2),  # $10k start
        })
    portfolio_history_weekly = portfolio_history[::5]

    # Graph edges
    graph_edges = []
    for u, v, d in G_filtered.edges(data=True):
        graph_edges.append({
            "source": u,
            "target": v,
            "weight": round(float(d["weight"]), 4),
        })

    # Graph node positions (spring layout)
    pos = nx.spring_layout(G_filtered, seed=42, weight="weight", k=2.0)
    graph_nodes = []
    for node in G_filtered.nodes():
        graph_nodes.append({
            "id": node,
            "x": round(float(pos[node][0]), 4),
            "y": round(float(pos[node][1]), 4),
            "cluster": cluster_map.get(node, 0),
            "weight": round(float(final_weights[tickers.index(node)]), 6),
        })

    # Cluster details
    clusters = {}
    for ticker, cid in cluster_map.items():
        clusters.setdefault(cid, []).append(ticker)
    cluster_details = []
    sector_names = {0: "Mixed A", 1: "Mixed B", 2: "Mixed C", 3: "Mixed D", 4: "Mixed E", 5: "Mixed F"}
    for cid in sorted(clusters.keys()):
        members = clusters[cid]
        total_w = sum(final_weights[tickers.index(t)] for t in members)
        cluster_details.append({
            "id": cid,
            "name": f"Cluster {cid}",
            "members": members,
            "total_weight": round(total_w, 4),
        })

    # Weights
    weights_data = []
    for i, t in enumerate(tickers):
        weights_data.append({
            "ticker": t,
            "weight": round(float(final_weights[i]), 6),
            "cluster": cluster_map.get(t, -1),
            "annual_return": round(float(mu[i]) * 252, 4),
            "annual_vol": round(float(np.sqrt(Sigma[i, i]) * np.sqrt(252)), 4),
        })
    weights_data.sort(key=lambda x: x["weight"], reverse=True)

    # Correlation matrix
    corr_matrix = {
        "tickers": tickers,
        "values": [[round(float(C[i][j]), 4) for j in range(N)] for i in range(N)],
    }

    # Efficient frontier
    frontier_data = []
    if not frontier_df.empty:
        for _, row in frontier_df.iterrows():
            frontier_data.append({
                "return": round(float(row["portfolio_return"]) * 252, 4),
                "risk": round(float(row["portfolio_std"]) * np.sqrt(252), 4),
            })

    # Selected portfolio point
    port_ret_ann = float(mu @ final_weights) * 252
    port_std_ann = np.sqrt(float(final_weights @ Sigma @ final_weights)) * np.sqrt(252)
    selected_portfolio = {
        "return": round(port_ret_ann, 4),
        "risk": round(port_std_ann, 4),
    }

    # Individual assets for scatter
    individual_assets = []
    for i, t in enumerate(tickers):
        individual_assets.append({
            "ticker": t,
            "return": round(float(mu[i]) * 252, 4),
            "risk": round(float(np.sqrt(Sigma[i, i]) * np.sqrt(252)), 4),
            "cluster": cluster_map.get(t, 0),
        })

    _cache.update({
        "metrics": metrics,
        "weights": weights_data,
        "clusters": cluster_details,
        "correlation": corr_matrix,
        "frontier": frontier_data,
        "selected_portfolio": selected_portfolio,
        "individual_assets": individual_assets,
        "graph_nodes": graph_nodes,
        "graph_edges": graph_edges,
        "portfolio_history": portfolio_history_weekly,
        "price_history": price_history_weekly,
        "config": {
            "tickers": tickers,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "risk_free_rate": RISK_FREE_RATE,
            "cluster_method": CLUSTER_METHOD,
            "covariance_method": COVARIANCE_METHOD,
            "graph_filter": GRAPH_FILTER,
            "n_assets": N,
            "n_days": T,
        },
    })

    print("Pipeline complete!")
    return _cache


# ── API Routes ──

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/overview")
def api_overview():
    data = run_pipeline()
    return jsonify({
        "metrics": data["metrics"],
        "config": data["config"],
        "clusters": data["clusters"],
    })


@app.route("/api/weights")
def api_weights():
    data = run_pipeline()
    return jsonify(data["weights"])


@app.route("/api/correlation")
def api_correlation():
    data = run_pipeline()
    return jsonify(data["correlation"])


@app.route("/api/frontier")
def api_frontier():
    data = run_pipeline()
    return jsonify({
        "frontier": data["frontier"],
        "selected": data["selected_portfolio"],
        "assets": data["individual_assets"],
    })


@app.route("/api/graph")
def api_graph():
    data = run_pipeline()
    return jsonify({
        "nodes": data["graph_nodes"],
        "edges": data["graph_edges"],
    })


@app.route("/api/portfolio-history")
def api_portfolio_history():
    data = run_pipeline()
    return jsonify(data["portfolio_history"])


@app.route("/api/all")
def api_all():
    data = run_pipeline()
    return jsonify(data)


if __name__ == "__main__":
    # Pre-run pipeline on startup
    run_pipeline()
    app.run(debug=False, port=5000, host="0.0.0.0")
