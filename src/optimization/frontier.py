"""Compute efficient frontier by sweeping target returns."""

import numpy as np
import pandas as pd
from .markowitz import markowitz_optimize


def compute_efficient_frontier(
    mu: np.ndarray,
    Sigma: np.ndarray,
    n_points: int = 100,
    allow_short: bool = False,
    max_weight: float = None,
) -> pd.DataFrame:
    """Sweep target returns to trace the efficient frontier."""
    r_min = float(mu.min())
    r_max = float(mu.max())
    targets = np.linspace(r_min * 0.99, r_max * 0.99, n_points)

    results = []
    for r in targets:
        try:
            res = markowitz_optimize(
                mu, Sigma,
                target_return=r,
                allow_short=allow_short,
                max_weight=max_weight,
            )
            if res["status"] != "equal_weight_fallback":
                results.append({
                    "target_return": r,
                    "portfolio_return": res["expected_return"],
                    "portfolio_std": np.sqrt(res["variance"]),
                })
        except Exception:
            continue

    return pd.DataFrame(results)
