"""Build NetworkX graph from distance matrix."""

import numpy as np
import networkx as nx
import warnings


class GraphTooSmallError(Exception):
    pass


def build_graph(D: np.ndarray, tickers: list[str]) -> nx.Graph:
    """Build a weighted undirected graph from distance matrix D."""
    N = len(tickers)
    if N < 2:
        raise GraphTooSmallError(f"Need at least 2 assets, got {N}")
    
    G = nx.Graph()
    G.add_nodes_from(tickers)
    for i in range(N):
        for j in range(i + 1, N):
            if D[i, j] > 0:
                G.add_edge(tickers[i], tickers[j], weight=D[i, j])
            else:
                warnings.warn(f"Zero distance between {tickers[i]} and {tickers[j]} (possible duplicate)")
    return G
