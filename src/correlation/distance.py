"""Compute Pearson correlation and Mantegna distance matrices."""

import numpy as np


def compute_correlation(R: np.ndarray) -> np.ndarray:
    """Compute Pearson correlation matrix, shape (N, N)."""
    C = np.corrcoef(R.T)
    np.fill_diagonal(C, 1.0)
    C = np.clip(C, -1.0, 1.0)
    return C


def correlation_to_distance(C: np.ndarray) -> np.ndarray:
    """Convert correlation to Mantegna distance: D = sqrt(2*(1-C))."""
    D = np.sqrt(np.clip(2 * (1 - C), 0, None))
    np.fill_diagonal(D, 0.0)
    return D
