"""Integration test: full pipeline on synthetic data."""

import numpy as np
import pandas as pd
from src.preprocessing.cleaner import compute_log_returns, validate_returns
from src.estimation.returns import estimate_mean_returns
from src.estimation.covariance import estimate_covariance, ensure_psd
from src.correlation.distance import compute_correlation, correlation_to_distance
from src.graph.builder import build_graph
from src.graph.filters import apply_mst_filter
from src.graph.laplacian import compute_laplacian
from src.clustering.spectral import spectral_cluster, estimate_k
from src.clustering.louvain import louvain_cluster
from src.optimization.cluster_weights import cluster_aware_optimize
from src.results.metrics import compute_portfolio_metrics


def test_full_pipeline_synthetic():
    """Run full pipeline on 10 synthetic assets, 252 days."""
    np.random.seed(42)

    # Simulate prices
    N, T = 10, 253
    prices_data = np.cumsum(np.random.randn(T, N) * 0.01 + 0.0003, axis=0) + 5
    prices = pd.DataFrame(np.exp(prices_data), columns=[f"A{i}" for i in range(N)])

    # Pipeline
    log_ret = compute_log_returns(prices)
    log_ret = validate_returns(log_ret)
    tickers = list(log_ret.columns)
    R = log_ret.values

    mu = estimate_mean_returns(R)
    Sigma = estimate_covariance(R)
    Sigma = ensure_psd(Sigma)

    C = compute_correlation(R)
    D = correlation_to_distance(C)

    G = build_graph(D, tickers)
    G_mst = apply_mst_filter(G)

    L, nodelist = compute_laplacian(G_mst, normalized=True)
    eigenvalues, _ = np.linalg.eigh(L)
    k = estimate_k(eigenvalues)
    cluster_map = spectral_cluster(L, k, nodelist)

    if cluster_map is None:
        cluster_map = louvain_cluster(G_mst)

    weights = cluster_aware_optimize(mu, Sigma, cluster_map, tickers)

    # Assertions
    assert 0.99 < weights.sum() < 1.01
    assert np.all(weights >= -1e-6)
    assert len(weights) == N

    metrics = compute_portfolio_metrics(weights, mu, Sigma, R)
    assert "sharpe_ratio" in metrics
    assert "annual_return" in metrics
    assert metrics["annual_volatility"] > 0
