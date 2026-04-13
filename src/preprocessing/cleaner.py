"""Clean price data and compute log returns."""

import pandas as pd
import numpy as np
import warnings


class InsufficientDataError(Exception):
    pass


def compute_log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Compute log-return matrix, drops first row (NaN)."""
    log_ret = np.log(prices / prices.shift(1))
    return log_ret.iloc[1:]  # drop first NaN row


def validate_returns(returns: pd.DataFrame, max_missing_pct: float = 0.05, min_tickers: int = 5) -> pd.DataFrame:
    """Drop columns exceeding missing threshold, fill remaining gaps.
    
    Raises InsufficientDataError if fewer than min_tickers survive.
    """
    # Drop all-NaN columns first
    returns = returns.dropna(axis=1, how="all")
    
    # Drop columns with too many missing values
    missing_pct = returns.isna().mean()
    good_cols = missing_pct[missing_pct <= max_missing_pct].index.tolist()
    dropped = [c for c in returns.columns if c not in good_cols]
    if dropped:
        warnings.warn(f"Dropped tickers with >{max_missing_pct*100}% missing: {dropped}")
    returns = returns[good_cols]
    
    # Forward-fill then backward-fill (max 3 consecutive)
    returns = returns.ffill(limit=3).bfill(limit=3)
    
    # Drop any remaining NaN rows
    returns = returns.dropna()
    
    # Drop zero-variance columns
    zero_var = returns.columns[returns.std() < 1e-10].tolist()
    if zero_var:
        warnings.warn(f"Dropped zero-variance tickers: {zero_var}")
        returns = returns.drop(columns=zero_var)
    
    if len(returns.columns) < min_tickers:
        raise InsufficientDataError(
            f"Only {len(returns.columns)} tickers survived cleaning (need >= {min_tickers})"
        )
    
    return returns
