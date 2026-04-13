"""Tests for clustering module."""

import numpy as np
from src.clustering.spectral import spectral_cluster, estimate_k


def test_estimate_k_returns_at_least_2():
    eigenvalues = np.array([0.0, 0.1, 0.2, 0.8, 1.0, 1.1])
    k = estimate_k(eigenvalues)
    assert k >= 2


def test_spectral_cluster_assigns_all_nodes():
    np.random.seed(42)
    N = 10
    # Create a block diagonal Laplacian-like matrix
    L = np.eye(N) * 2
    L[:5, :5] -= 0.3
    L[5:, 5:] -= 0.3
    np.fill_diagonal(L, L.sum(axis=1) - np.diag(L))
    nodelist = [f"A{i}" for i in range(N)]
    cluster_map = spectral_cluster(L, k=2, nodelist=nodelist)
    assert cluster_map is not None
    assert len(cluster_map) == N
    assert set(cluster_map.keys()) == set(nodelist)
