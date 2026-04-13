"""Compute portfolio performance metrics."""

import numpy as np


def compute_portfolio_metrics(
    weights: np.ndarray,
    mu: np.ndarray,
    Sigma: np.ndarray,
    R: np.ndarray,
    risk_free_rate: float = 0.0,
    periods_per_year: int = 252,
) -> dict:
    """Compute Sharpe, Sortino, VaR, diversification ratio, etc."""
    port_return = float(mu @ weights) * periods_per_year
    port_variance = float(weights @ Sigma @ weights)
    port_std = np.sqrt(port_variance) * np.sqrt(periods_per_year)
    sharpe = (port_return - risk_free_rate) / port_std if port_std > 0 else 0.0

    # Sortino
    daily_returns = R @ weights
    downside = daily_returns[daily_returns < 0]
    downside_std = np.std(downside) * np.sqrt(periods_per_year) if len(downside) > 1 else port_std
    sortino = (port_return - risk_free_rate) / downside_std if downside_std > 0 else 0.0

    # Historical VaR (95%)
    var_95 = float(np.percentile(daily_returns, 5))

    # Diversification ratio
    weighted_vols = float(np.sqrt(np.diag(Sigma)) @ weights)
    port_vol = np.sqrt(port_variance)
    div_ratio = weighted_vols / port_vol if port_vol > 0 else 1.0

    return {
        "annual_return": round(float(port_return), 6),
        "annual_volatility": round(float(port_std), 6),
        "sharpe_ratio": round(float(sharpe), 4),
        "sortino_ratio": round(float(sortino), 4),
        "var_95_daily": round(float(var_95), 6),
        "diversification_ratio": round(float(div_ratio), 4),
    }
