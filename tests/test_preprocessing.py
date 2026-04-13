"""Tests for preprocessing module."""

import numpy as np
import pandas as pd
import pytest
from src.preprocessing.cleaner import compute_log_returns, validate_returns, InsufficientDataError


def test_log_returns_shape():
    prices = pd.DataFrame(np.random.rand(100, 5) + 1)
    returns = compute_log_returns(prices)
    assert returns.shape == (99, 5)


def test_log_returns_values():
    prices = pd.DataFrame({"A": [100.0, 110.0, 105.0]})
    returns = compute_log_returns(prices)
    expected = np.log(110 / 100)
    assert abs(returns.iloc[0, 0] - expected) < 1e-10


def test_missing_data_drop():
    prices = pd.DataFrame(np.random.rand(100, 6) + 1)
    prices.columns = [f"T{i}" for i in range(6)]
    prices["T2"] = np.nan  # fully NaN column
    returns = compute_log_returns(prices)
    result = validate_returns(returns)
    assert "T2" not in result.columns


def test_zero_variance_drop():
    prices = pd.DataFrame(np.random.rand(100, 6) + 1)
    prices.columns = [f"T{i}" for i in range(6)]
    prices["T3"] = 1.0  # constant → zero variance returns
    returns = compute_log_returns(prices)
    result = validate_returns(returns)
    assert "T3" not in result.columns


def test_insufficient_tickers_raises():
    prices = pd.DataFrame(np.random.rand(100, 3) + 1)
    prices.iloc[:, 0] = np.nan
    prices.iloc[:, 1] = np.nan
    prices.iloc[:, 2] = np.nan
    returns = compute_log_returns(prices)
    with pytest.raises(InsufficientDataError):
        validate_returns(returns, min_tickers=5)
