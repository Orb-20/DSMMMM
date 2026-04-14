"""Flask API backend for Graph Portfolio Optimizer."""

import sys
import os
import json
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
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
        idx = tickers.index(node)
        graph_nodes.append({
            "id": node,
            "x": round(float(pos[node][0]), 4),
            "y": round(float(pos[node][1]), 4),
            "cluster": cluster_map.get(node, 0),
            "weight": round(float(final_weights[idx]), 6),
            "annual_return": round(float(mu[idx]) * 252, 4),
            "annual_vol": round(float(np.sqrt(Sigma[idx, idx]) * np.sqrt(252)), 4),
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
        # ── Non-serializable raw arrays (kept server-side for /api/optimize, /api/path) ──
        "_mu": mu,
        "_Sigma": Sigma,
        "_R": R,
        "_tickers": tickers,
        "_G_full": G_full,
        "_G_filtered": G_filtered,
        "_cluster_map": cluster_map,
        # ── Serializable ──
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
    # Strip non-serializable private keys (raw arrays / nx graphs).
    return jsonify({k: v for k, v in data.items() if not k.startswith("_")})


# ─────────────────────────────────────────────────────────────────────────────
# Dynamic optimization — re-solves Markowitz with user-controlled parameters.
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/optimize", methods=["POST"])
def api_optimize():
    """Re-run the QP with user-tuned knobs.

    Body: {
        "risk_aversion": float > 0,   # lambda. Higher => more risk-averse.
        "max_weight":    float in (0,1] or null,
        "allow_short":   bool,
        "target_return": float | null  # optional override
    }
    """
    body = request.get_json(silent=True) or {}
    lam         = float(body.get("risk_aversion", 1.0))
    max_weight  = body.get("max_weight")
    allow_short = bool(body.get("allow_short", False))
    target_ret  = body.get("target_return")

    data  = run_pipeline()
    mu    = data["_mu"]
    Sigma = data["_Sigma"]
    R     = data["_R"]
    tickers = data["_tickers"]
    n = len(mu)

    import cvxpy as cp
    w = cp.Variable(n)
    constraints = [cp.sum(w) == 1]
    if not allow_short:
        constraints.append(w >= 0)
    if max_weight is not None and 0 < float(max_weight) <= 1:
        constraints.append(w <= float(max_weight))
    if target_ret is not None:
        constraints.append(mu @ w >= float(target_ret))

    # Mean-variance utility: max  μ'w − (λ/2) w'Σw   ⇔   min  (λ/2) w'Σw − μ'w
    objective = cp.Minimize(0.5 * lam * cp.quad_form(w, cp.psd_wrap(Sigma)) - mu @ w)
    problem = cp.Problem(objective, constraints)

    weights = None
    status = "failed"
    for solver in [cp.OSQP, cp.ECOS, cp.SCS]:
        try:
            problem.solve(solver=solver, warm_start=True)
            if problem.status in ("optimal", "optimal_inaccurate") and w.value is not None:
                weights = np.clip(w.value, 0 if not allow_short else -1, 1)
                weights = weights / weights.sum()
                status = problem.status
                break
        except Exception:
            continue

    if weights is None:
        weights = np.ones(n) / n
        status = "equal_weight_fallback"

    port_ret = float(mu @ weights) * 252
    port_var = float(weights @ Sigma @ weights)
    port_std = float(np.sqrt(port_var) * np.sqrt(252))
    sharpe   = (port_ret - RISK_FREE_RATE) / port_std if port_std > 1e-9 else 0.0

    # Portfolio path-through-time under these new weights
    port_returns = R @ weights
    cum = np.cumprod(1 + port_returns)
    dates = list(data["portfolio_history"])  # already has dates at weekly cadence
    hist = [{"date": dates[i]["date"], "value": round(float(cum[i * 5]) * 10000, 2)}
            for i in range(min(len(dates), len(cum) // 5))]

    return jsonify({
        "status": status,
        "risk_aversion": lam,
        "weights": [
            {"ticker": t, "weight": round(float(weights[i]), 6)}
            for i, t in enumerate(tickers)
        ],
        "metrics": {
            "annual_return":     round(port_ret, 4),
            "annual_volatility": round(port_std, 4),
            "sharpe_ratio":      round(sharpe, 4),
            "variance":          round(port_var, 8),
        },
        "portfolio_history": hist,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Graph-path endpoint. Three algorithms mapped to risk appetites:
#   dijkstra → lowest-correlation safe path (risk-averse)
#   mst      → broad diversification tour (balanced)
#   maxflow  → highest-throughput aggressive path (max return per unit flow)
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/path")
def api_path():
    algo   = request.args.get("algo", "dijkstra").lower()
    source = request.args.get("source")
    target = request.args.get("target")

    data = run_pipeline()
    G = data["_G_full"]
    G_mst = data["_G_filtered"]
    tickers = data["_tickers"]
    mu = data["_mu"]
    Sigma = data["_Sigma"]
    weights = np.array([next(
        (w["weight"] for w in data["weights"] if w["ticker"] == t), 0.0
    ) for t in tickers])

    # Default source/target: highest-return ↔ lowest-return tickers
    if not source or source not in tickers:
        source = tickers[int(np.argmax(mu))]
    if not target or target not in tickers:
        target = tickers[int(np.argmin(mu))]

    path_nodes = []
    path_info = {"algo": algo, "source": source, "target": target}

    try:
        if algo == "dijkstra":
            # Min total distance (low correlation = low cost = diversified path).
            path_nodes = nx.shortest_path(G, source=source, target=target, weight="weight")
            total_cost = nx.shortest_path_length(G, source=source, target=target, weight="weight")
            path_info["total_distance"] = round(float(total_cost), 4)

        elif algo == "mst":
            # Walk the MST from source to target — broad diversification tour.
            path_nodes = nx.shortest_path(G_mst, source=source, target=target)
            total_cost = sum(G_mst[path_nodes[i]][path_nodes[i + 1]]["weight"]
                             for i in range(len(path_nodes) - 1))
            path_info["total_distance"] = round(float(total_cost), 4)

        elif algo == "maxflow":
            # Highest-return aggressive route: reweight edges by 1/(μ_u+μ_v) so the
            # shortest path picks high-return stepping stones, then report cumulative μ.
            G_ret = nx.Graph()
            for u, v, d in G.edges(data=True):
                iu, iv = tickers.index(u), tickers.index(v)
                # Edge cost inversely proportional to (expected) return — more μ ⇒ cheaper.
                avg_mu = max(float(mu[iu] + mu[iv]) / 2, 1e-6)
                G_ret.add_edge(u, v, weight=1.0 / avg_mu)
            path_nodes = nx.shortest_path(G_ret, source=source, target=target, weight="weight")
            path_info["cumulative_return"] = round(
                float(sum(mu[tickers.index(t)] for t in path_nodes)) * 252, 4
            )
        else:
            return jsonify({"error": f"unknown algo '{algo}'"}), 400

    except nx.NetworkXNoPath:
        return jsonify({"error": "no path between source and target"}), 404
    except nx.NodeNotFound as e:
        return jsonify({"error": str(e)}), 404

    # Ordered node details + edges
    path_detail = []
    for t in path_nodes:
        idx = tickers.index(t)
        path_detail.append({
            "ticker": t,
            "weight": round(float(weights[idx]), 6),
            "annual_return": round(float(mu[idx]) * 252, 4),
            "annual_vol":    round(float(np.sqrt(Sigma[idx, idx]) * np.sqrt(252)), 4),
            "cluster": data["_cluster_map"].get(t, 0),
        })
    path_edges = []
    G_src = G if algo == "dijkstra" else (G_mst if algo == "mst" else G)
    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i + 1]
        if G_src.has_edge(u, v):
            path_edges.append({
                "source": u, "target": v,
                "distance": round(float(G_src[u][v]["weight"]), 4),
            })

    path_info["nodes"] = path_detail
    path_info["edges"] = path_edges
    return jsonify(path_info)


if __name__ == "__main__":
    # Pre-run pipeline on startup
    run_pipeline()
    app.run(debug=False, port=5000, host="0.0.0.0")
