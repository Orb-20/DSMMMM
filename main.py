"""Graph-Theoretic Portfolio Optimization — Full Pipeline."""

import sys
import os
import numpy as np
import warnings

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(__file__))

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
from src.results.metrics import compute_portfolio_metrics
from src.results.reporter import export_weights, export_metrics
from src.visualization.plot_heatmap import plot_correlation_heatmap
from src.visualization.plot_graph import plot_graph
from src.visualization.plot_frontier import (
    plot_efficient_frontier, plot_weight_allocation, plot_cluster_composition,
)


def main():
    print("=" * 60)
    print("  Graph-Theoretic Portfolio Optimization")
    print("=" * 60)

    # ── STEP 1: Load & Clean Data ──
    print("\n[1/7] Loading price data...")
    prices = load_prices(TICKERS, START_DATE, END_DATE, data_dir="data")
    print(f"  Loaded {prices.shape[1]} tickers, {prices.shape[0]} trading days")

    log_ret = compute_log_returns(prices)
    log_ret = validate_returns(log_ret)
    tickers = list(log_ret.columns)
    R = log_ret.values
    T, N = R.shape
    print(f"  After cleaning: {N} tickers, {T} returns")

    # ── STEP 2: Statistical Estimation ──
    print("\n[2/7] Estimating μ and Σ...")
    mu = estimate_mean_returns(R)
    Sigma = estimate_covariance(R, method=COVARIANCE_METHOD)
    Sigma = ensure_psd(Sigma)
    print(f"  μ range: [{mu.min():.6f}, {mu.max():.6f}]")
    print(f"  Σ condition number: {np.linalg.cond(Sigma):.1f}")

    # ── STEP 3: Correlation & Distance ──
    print("\n[3/7] Computing correlation and distance matrices...")
    C = compute_correlation(R)
    D = correlation_to_distance(C)
    print(f"  Distance range: [{D[D > 0].min():.4f}, {D.max():.4f}]")

    # ── STEP 4: Build & Filter Graph ──
    print("\n[4/7] Building and filtering graph...")
    G_full = build_graph(D, tickers)
    print(f"  Full graph: {G_full.number_of_nodes()} nodes, {G_full.number_of_edges()} edges")

    if GRAPH_FILTER == "mst":
        G_filtered = apply_mst_filter(G_full)
    else:
        G_filtered = apply_threshold_filter(G_full, THRESHOLD)
    print(f"  Filtered graph: {G_filtered.number_of_edges()} edges")

    # ── STEP 5: Clustering ──
    print("\n[5/7] Clustering assets...")
    L, nodelist = compute_laplacian(G_filtered, normalized=True)
    cluster_map = None

    if CLUSTER_METHOD == "spectral":
        eigenvalues, _ = np.linalg.eigh(L)
        k = estimate_k(eigenvalues)
        cluster_map = spectral_cluster(L, k, nodelist)

    if cluster_map is None:
        # Fallback to Louvain
        print("  Spectral clustering failed, using Louvain...")
        cluster_map = louvain_cluster(G_filtered)

    n_clusters = len(set(cluster_map.values()))
    print(f"  Found {n_clusters} clusters")
    for cid in sorted(set(cluster_map.values())):
        members = [t for t, c in cluster_map.items() if c == cid]
        print(f"    Cluster {cid}: {members}")

    # ── STEP 6: Portfolio Optimization ──
    print("\n[6/7] Optimizing portfolio...")
    final_weights = cluster_aware_optimize(mu, Sigma, cluster_map, tickers, max_weight=MAX_WEIGHT)

    # Sanity checks
    assert abs(final_weights.sum() - 1.0) < 1e-4, "Weights must sum to 1"
    assert np.all(final_weights >= -1e-4), "Negative weights in long-only mode"

    # Efficient frontier
    print("  Computing efficient frontier...")
    frontier_df = compute_efficient_frontier(
        mu, Sigma, n_points=N_FRONTIER_POINTS,
        allow_short=ALLOW_SHORT, max_weight=MAX_WEIGHT,
    )

    # ── STEP 7: Results ──
    print("\n[7/7] Generating results...")
    metrics = compute_portfolio_metrics(
        final_weights, mu, Sigma, R, risk_free_rate=RISK_FREE_RATE,
    )
    metrics["n_assets"] = N
    metrics["n_clusters"] = n_clusters
    metrics["optimization_status"] = "optimal"

    # Export
    export_weights(final_weights, tickers, cluster_map, path="outputs/weights.csv")
    export_metrics(metrics, path="outputs/metrics.json")

    # Visualize
    print("\n  Generating plots...")
    plot_correlation_heatmap(C, tickers)
    plot_graph(G_filtered, cluster_map)
    plot_efficient_frontier(frontier_df, final_weights, mu, Sigma)
    plot_weight_allocation(final_weights, tickers)
    plot_cluster_composition(cluster_map)

    # Summary
    print("\n" + "=" * 60)
    print("  PORTFOLIO SUMMARY")
    print("=" * 60)
    print(f"  Assets:              {N}")
    print(f"  Clusters:            {n_clusters}")
    print(f"  Annual Return:       {metrics['annual_return']:.2%}")
    print(f"  Annual Volatility:   {metrics['annual_volatility']:.2%}")
    print(f"  Sharpe Ratio:        {metrics['sharpe_ratio']:.4f}")
    print(f"  Sortino Ratio:       {metrics['sortino_ratio']:.4f}")
    print(f"  VaR (95%, daily):    {metrics['var_95_daily']:.4%}")
    print(f"  Diversification:     {metrics['diversification_ratio']:.4f}")
    print("\n  Top 5 holdings:")
    order = np.argsort(final_weights)[::-1]
    for i in order[:5]:
        print(f"    {tickers[i]:6s}  {final_weights[i]:.2%}  (cluster {cluster_map[tickers[i]]})")
    print("\nDone! Check outputs/ for results and plots.")


if __name__ == "__main__":
    main()
