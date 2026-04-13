"""Two-level cluster-aware portfolio optimization."""

import numpy as np
from .markowitz import markowitz_optimize


def cluster_aware_optimize(
    mu: np.ndarray,
    Sigma: np.ndarray,
    cluster_map: dict[str, int],
    tickers: list[str],
    max_weight: float = None,
) -> np.ndarray:
    """Hierarchical optimization: intra-cluster then inter-cluster.
    
    Step 1: Optimize within each cluster
    Step 2: Treat clusters as synthetic assets
    Step 3: Optimize across clusters
    Step 4: Combine weights
    """
    # Group tickers by cluster
    clusters = {}
    for ticker, cid in cluster_map.items():
        clusters.setdefault(cid, []).append(ticker)

    intra_weights = {}
    cluster_mu = []
    cluster_var = []

    for cid, members in sorted(clusters.items()):
        idx = [tickers.index(t) for t in members]
        mu_c = mu[idx]
        Sigma_c = Sigma[np.ix_(idx, idx)]

        if len(members) == 1:
            # Single-member cluster: assign weight directly
            intra_weights[cid] = (members, np.array([1.0]))
            cluster_mu.append(float(mu_c[0]))
            cluster_var.append(float(Sigma_c[0, 0]))
        else:
            try:
                res = markowitz_optimize(mu_c, Sigma_c)
                intra_weights[cid] = (members, res["weights"])
                cluster_mu.append(res["expected_return"])
                cluster_var.append(res["variance"])
            except Exception:
                ew = np.ones(len(members)) / len(members)
                intra_weights[cid] = (members, ew)
                cluster_mu.append(float(mu_c.mean()))
                cluster_var.append(float(ew @ Sigma_c @ ew))

    # Inter-cluster optimization
    mu_inter = np.array(cluster_mu)
    Sigma_inter = np.diag(cluster_var)

    try:
        res_inter = markowitz_optimize(mu_inter, Sigma_inter)
        inter_weights = res_inter["weights"]
    except Exception:
        inter_weights = np.ones(len(clusters)) / len(clusters)

    # Combine
    final_weights = np.zeros(len(tickers))
    for cluster_idx, (cid, (members, w_intra)) in enumerate(sorted(intra_weights.items())):
        inter_w = inter_weights[cluster_idx]
        for ticker, w_i in zip(members, w_intra):
            final_weights[tickers.index(ticker)] = inter_w * w_i

    # Normalize and apply max weight cap
    final_weights = np.clip(final_weights, 0, None)
    final_weights /= final_weights.sum()

    if max_weight is not None:
        for _ in range(10):
            capped = np.minimum(final_weights, max_weight)
            excess = final_weights.sum() - capped.sum()
            if excess < 1e-8:
                break
            uncapped_mask = capped < max_weight
            if uncapped_mask.sum() == 0:
                break
            capped[uncapped_mask] += excess * (capped[uncapped_mask] / capped[uncapped_mask].sum())
            final_weights = capped
        final_weights /= final_weights.sum()

    return final_weights
