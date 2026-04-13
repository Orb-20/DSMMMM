"""Louvain community detection."""

import networkx as nx


def louvain_cluster(G: nx.Graph) -> dict[str, int]:
    """Community detection using Louvain method.
    
    Converts distance weights to similarity for modularity maximization.
    """
    import community as community_louvain
    
    G_sim = G.copy()
    for u, v, d in G_sim.edges(data=True):
        G_sim[u][v]["weight"] = 1.0 / (d["weight"] + 1e-9)
    
    partition = community_louvain.best_partition(G_sim, weight="weight", random_state=42)
    return partition
