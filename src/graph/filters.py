"""Graph filtering: MST and threshold-based."""

import networkx as nx
import warnings


def apply_mst_filter(G: nx.Graph) -> nx.Graph:
    """Return minimum spanning tree of graph G."""
    if not nx.is_connected(G):
        # Apply MST per component and union
        mst = nx.Graph()
        mst.add_nodes_from(G.nodes)
        for component in nx.connected_components(G):
            subgraph = G.subgraph(component)
            if len(component) > 1:
                sub_mst = nx.minimum_spanning_tree(subgraph, weight="weight")
                mst.add_edges_from(sub_mst.edges(data=True))
        return mst
    return nx.minimum_spanning_tree(G, weight="weight")


def apply_threshold_filter(G: nx.Graph, threshold: float, max_retries: int = 5) -> nx.Graph:
    """Keep edges where distance < threshold. Retry with higher threshold if empty."""
    for attempt in range(max_retries):
        G_filtered = nx.Graph()
        G_filtered.add_nodes_from(G.nodes)
        for u, v, d in G.edges(data=True):
            if d["weight"] < threshold:
                G_filtered.add_edge(u, v, **d)
        
        if G_filtered.number_of_edges() > 0:
            if G_filtered.number_of_edges() == G.number_of_edges():
                warnings.warn("Threshold too high, graph fully connected. Using MST instead.")
                return apply_mst_filter(G)
            return G_filtered
        
        threshold *= 1.1
        warnings.warn(f"Empty graph, increasing threshold to {threshold:.3f}")
    
    warnings.warn("Threshold filter failed after retries. Falling back to MST.")
    return apply_mst_filter(G)
