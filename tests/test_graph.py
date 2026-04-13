"""Tests for graph construction and processing."""

import numpy as np
from src.correlation.distance import compute_correlation, correlation_to_distance
from src.graph.builder import build_graph
from src.graph.filters import apply_mst_filter


def test_distance_matrix_symmetry():
    C = np.corrcoef(np.random.randn(50, 8).T)
    D = correlation_to_distance(C)
    assert np.allclose(D, D.T)
    assert np.all(D >= 0)


def test_distance_diagonal_zero():
    C = np.corrcoef(np.random.randn(50, 5).T)
    D = correlation_to_distance(C)
    assert np.allclose(np.diag(D), 0)


def test_correlation_bounds():
    R = np.random.randn(100, 5)
    C = compute_correlation(R)
    assert np.all(C >= -1.0)
    assert np.all(C <= 1.0)


def test_build_graph_nodes():
    D = np.random.rand(5, 5)
    D = (D + D.T) / 2
    np.fill_diagonal(D, 0)
    tickers = ["A", "B", "C", "D", "E"]
    G = build_graph(D, tickers)
    assert set(G.nodes()) == set(tickers)


def test_mst_has_n_minus_1_edges():
    D = np.random.rand(10, 10)
    D = (D + D.T) / 2
    np.fill_diagonal(D, 0)
    tickers = [str(i) for i in range(10)]
    G = build_graph(D, tickers)
    mst = apply_mst_filter(G)
    assert len(mst.edges) == 9
