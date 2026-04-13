"""Compute covariance matrix with shrinkage and PSD guarantee."""

import numpy as np
import warnings


def estimate_covariance(R: np.ndarray, method: str = "ledoit_wolf") -> np.ndarray:
    """Estimate covariance matrix.
    
    Args:
        R: Return matrix, shape (T, N)
        method: "sample" | "ledoit_wolf" | "oas"
    
    Returns:
        Covariance matrix, shape (N, N)
    """
    assert np.isfinite(R).all(), "R contains NaN/Inf values"
    T, N = R.shape
    
    if method == "sample" and T >= N:
        Sigma = np.cov(R, rowvar=False)
    elif method == "ledoit_wolf" or (method == "sample" and T < N):
        if method == "sample" and T < N:
            warnings.warn("T < N: forcing Ledoit-Wolf shrinkage instead of sample covariance.")
        from sklearn.covariance import LedoitWolf
        Sigma = LedoitWolf().fit(R).covariance_
    elif method == "oas":
        from sklearn.covariance import OAS
        Sigma = OAS().fit(R).covariance_
    else:
        raise ValueError(f"Unknown covariance method: {method}")
    
    return ensure_psd(Sigma)


def ensure_psd(Sigma: np.ndarray, epsilon: float = 1e-8) -> np.ndarray:
    """Ensure matrix is positive semi-definite by clipping negative eigenvalues."""
    eigvals, eigvecs = np.linalg.eigh(Sigma)
    eigvals = np.maximum(eigvals, epsilon)
    return eigvecs @ np.diag(eigvals) @ eigvecs.T
