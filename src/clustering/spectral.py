"""Spectral clustering on graph Laplacian."""

import numpy as np
from sklearn.cluster import KMeans


def estimate_k(eigenvalues: np.ndarray, max_k: int = 10) -> int:
    """Estimate number of clusters via eigengap heuristic."""
    upper = min(max_k + 2, len(eigenvalues))
    gaps = np.diff(eigenvalues[1:upper])
    k = int(np.argmax(gaps) + 1)
    return max(k, 2)  # at least 2 clusters


def spectral_cluster(L: np.ndarray, k: int, nodelist: list[str]) -> dict[str, int]:
    """Spectral clustering using k smallest non-trivial eigenvectors."""
    eigenvalues, eigenvectors = np.linalg.eigh(L)
    
    # Clamp k to feasible range
    k = min(k, len(nodelist) - 1)
    k = max(k, 2)
    
    k_vecs = eigenvectors[:, 1:k + 1]  # skip trivial eigenvector
    
    # Normalize rows
    norms = np.linalg.norm(k_vecs, axis=1, keepdims=True)
    norms = np.where(norms < 1e-10, 1.0, norms)
    k_vecs_normalized = k_vecs / norms
    
    # Check for NaN (degenerate Laplacian)
    if not np.isfinite(k_vecs_normalized).all():
        return None  # signal caller to fall back to Louvain
    
    labels = KMeans(n_clusters=k, n_init=20, random_state=42).fit_predict(k_vecs_normalized)
    return {node: int(label) for node, label in zip(nodelist, labels)}
