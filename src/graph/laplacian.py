"""Compute graph Laplacian matrix."""

import numpy as np
import networkx as nx


def compute_laplacian(G: nx.Graph, normalized: bool = False):
    """Compute Laplacian matrix of graph G.
    
    Returns:
        L: Laplacian matrix (N, N)
        nodelist: ordered list of node names
    """
    nodelist = sorted(G.nodes())
    if normalized:
        L = nx.normalized_laplacian_matrix(G, nodelist=nodelist).toarray()
    else:
        L = nx.laplacian_matrix(G, nodelist=nodelist).toarray()
    return L.astype(float), nodelist
