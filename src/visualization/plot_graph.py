"""Draw filtered graph with cluster coloring."""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import os


def plot_graph(G: nx.Graph, cluster_map: dict[str, int], save_dir: str = "outputs/plots"):
    """Draw graph with nodes colored by cluster."""
    os.makedirs(save_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(12, 10))
    pos = nx.spring_layout(G, seed=42, weight="weight", k=2.0)

    # Color nodes by cluster
    nodes = list(G.nodes())
    colors = [cluster_map.get(n, 0) for n in nodes]
    cmap = plt.cm.Set2

    nx.draw_networkx_nodes(G, pos, nodelist=nodes, node_color=colors,
                           cmap=cmap, node_size=600, alpha=0.9, ax=ax)
    nx.draw_networkx_labels(G, pos, font_size=8, font_weight="bold", ax=ax)

    # Draw edges with width proportional to inverse distance
    edges = G.edges(data=True)
    weights = [1.0 / (d["weight"] + 0.1) for _, _, d in edges]
    max_w = max(weights) if weights else 1
    widths = [2.0 * w / max_w for w in weights]

    nx.draw_networkx_edges(G, pos, width=widths, alpha=0.5, edge_color="gray", ax=ax)

    ax.set_title("Filtered Asset Graph (colored by cluster)")
    ax.axis("off")
    plt.tight_layout()
    path = os.path.join(save_dir, "distance_graph.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Saved {path}")
