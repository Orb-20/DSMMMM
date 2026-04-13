"""Tests for portfolio optimization."""

import numpy as np
from src.optimization.markowitz import markowitz_optimize
from src.estimation.covariance import ensure_psd


def test_weights_sum_to_one():
    mu = np.array([0.10, 0.12, 0.08, 0.15])
    Sigma = np.diag([0.04, 0.05, 0.03, 0.06])
    result = markowitz_optimize(mu, Sigma)
    assert abs(result["weights"].sum() - 1.0) < 1e-6


def test_weights_non_negative_long_only():
    mu = np.array([0.10, 0.12, 0.08])
    Sigma = np.eye(3) * 0.04
    result = markowitz_optimize(mu, Sigma, allow_short=False)
    assert np.all(result["weights"] >= -1e-8)


def test_target_return_satisfied():
    mu = np.array([0.10, 0.15, 0.08])
    Sigma = np.diag([0.04, 0.05, 0.03])
    target = 0.12
    result = markowitz_optimize(mu, Sigma, target_return=target)
    assert result["expected_return"] >= target - 1e-5


def test_singular_covariance_handled():
    mu = np.array([0.1, 0.2, 0.15])
    Sigma = np.ones((3, 3))  # rank-1, singular
    Sigma_fixed = ensure_psd(Sigma)
    result = markowitz_optimize(mu, Sigma_fixed)
    assert result["weights"] is not None
    assert abs(result["weights"].sum() - 1.0) < 1e-6
