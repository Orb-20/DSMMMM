"""Core Markowitz mean-variance optimization using CVXPY."""

import numpy as np
import cvxpy as cp


class OptimizationFailedError(Exception):
    pass


def markowitz_optimize(
    mu: np.ndarray,
    Sigma: np.ndarray,
    target_return: float = None,
    allow_short: bool = False,
    max_weight: float = None,
) -> dict:
    """Solve min-variance QP with optional target return constraint.
    
    Returns dict with weights, expected_return, variance, status.
    """
    n = len(mu)
    w = cp.Variable(n)

    portfolio_variance = cp.quad_form(w, cp.psd_wrap(Sigma))

    constraints = [cp.sum(w) == 1]
    if not allow_short:
        constraints.append(w >= 0)
    if max_weight is not None:
        constraints.append(w <= max_weight)
    if target_return is not None:
        constraints.append(mu @ w >= target_return)

    objective = cp.Minimize(portfolio_variance)
    problem = cp.Problem(objective, constraints)

    solvers = [cp.OSQP, cp.ECOS, cp.SCS]
    for solver in solvers:
        try:
            problem.solve(solver=solver, warm_start=True)
            if problem.status in ["optimal", "optimal_inaccurate"] and w.value is not None:
                weights = w.value.copy()
                if not allow_short:
                    weights = np.clip(weights, 0, 1)
                weights /= weights.sum()
                return {
                    "weights": weights,
                    "expected_return": float(mu @ weights),
                    "variance": float(weights @ Sigma @ weights),
                    "status": problem.status,
                }
        except (cp.SolverError, Exception):
            continue

    # Equal weight fallback
    weights = np.ones(n) / n
    return {
        "weights": weights,
        "expected_return": float(mu @ weights),
        "variance": float(weights @ Sigma @ weights),
        "status": "equal_weight_fallback",
    }
