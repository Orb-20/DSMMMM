"""Tests for statistical estimation module."""

import numpy as np
from src.estimation.returns import estimate_mean_returns
from src.estimation.covariance import estimate_covariance, ensure_psd


def test_mean_returns_shape():
    R = np.random.randn(100, 5)
    mu = estimate_mean_returns(R)
    assert mu.shape == (5,)


def test_covariance_shape():
    R = np.random.randn(100, 5)
    Sigma = estimate_covariance(R)
    assert Sigma.shape == (5, 5)


def test_covariance_is_psd():
    R = np.random.randn(50, 20)
    Sigma = estimate_covariance(R)
    eigenvalues = np.linalg.eigvalsh(Sigma)
    assert np.all(eigenvalues >= -1e-9)


def test_covariance_symmetric():
    R = np.random.randn(100, 10)
    Sigma = estimate_covariance(R)
    assert np.allclose(Sigma, Sigma.T)


def test_ensure_psd_fixes_negative_eigenvalue():
    S = np.array([[1, 2], [2, 1]])  # not PSD (det < 0)
    S_fixed = ensure_psd(S)
    eigenvalues = np.linalg.eigvalsh(S_fixed)
    assert np.all(eigenvalues >= 0)


def test_ledoit_wolf_underdetermined():
    R = np.random.randn(10, 20)  # T < N
    Sigma = estimate_covariance(R, method="ledoit_wolf")
    assert Sigma.shape == (20, 20)
    assert np.all(np.linalg.eigvalsh(Sigma) >= -1e-9)
