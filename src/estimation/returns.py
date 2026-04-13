"""Compute mean return vector."""

import numpy as np


def estimate_mean_returns(R: np.ndarray) -> np.ndarray:
    """Return mean return vector, shape (N,)."""
    assert np.isfinite(R).all(), "R contains NaN/Inf values"
    return R.mean(axis=0)
