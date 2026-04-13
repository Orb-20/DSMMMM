"""Plot efficient frontier with selected portfolio."""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os


def plot_efficient_frontier(
    frontier_df: pd.DataFrame,
    weights: np.ndarray,
    mu: np.ndarray,
    Sigma: np.ndarray,
    save_dir: str = "outputs/plots",
    periods_per_year: int = 252,
):
    """Plot efficient frontier curve and mark selected portfolio."""
    os.makedirs(save_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 7))

    if not frontier_df.empty:
        # Annualize
        fr = frontier_df.copy()
        fr["ann_return"] = fr["portfolio_return"] * periods_per_year
        fr["ann_std"] = fr["portfolio_std"] * np.sqrt(periods_per_year)
        ax.plot(fr["ann_std"], fr["ann_return"], "b-", linewidth=2, label="Efficient Frontier")

    # Selected portfolio
    port_ret = float(mu @ weights) * periods_per_year
    port_std = np.sqrt(float(weights @ Sigma @ weights)) * np.sqrt(periods_per_year)
    ax.scatter(port_std, port_ret, color="red", s=150, zorder=5,
               marker="*", label=f"Selected Portfolio")
    ax.annotate(f"  Ret={port_ret:.2%}\n  Vol={port_std:.2%}",
                (port_std, port_ret), fontsize=9)

    ax.set_xlabel("Annualized Volatility")
    ax.set_ylabel("Annualized Return")
    ax.set_title("Efficient Frontier")
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    path = os.path.join(save_dir, "efficient_frontier.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Saved {path}")


def plot_weight_allocation(weights: np.ndarray, tickers: list[str], save_dir: str = "outputs/plots"):
    """Bar chart of final portfolio weights."""
    os.makedirs(save_dir, exist_ok=True)

    # Sort by weight
    order = np.argsort(weights)[::-1]
    sorted_tickers = [tickers[i] for i in order]
    sorted_weights = weights[order]

    fig, ax = plt.subplots(figsize=(10, 6))
    colors = plt.cm.viridis(np.linspace(0.2, 0.8, len(sorted_tickers)))
    ax.bar(sorted_tickers, sorted_weights, color=colors)
    ax.set_xlabel("Asset")
    ax.set_ylabel("Weight")
    ax.set_title("Portfolio Weight Allocation")
    ax.set_ylim(0, max(sorted_weights) * 1.15)
    for i, (t, w) in enumerate(zip(sorted_tickers, sorted_weights)):
        if w > 0.005:
            ax.text(i, w + 0.003, f"{w:.1%}", ha="center", fontsize=8)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    path = os.path.join(save_dir, "weight_allocation.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Saved {path}")


def plot_cluster_composition(cluster_map: dict[str, int], save_dir: str = "outputs/plots"):
    """Bar chart showing cluster membership."""
    os.makedirs(save_dir, exist_ok=True)

    clusters = {}
    for ticker, cid in cluster_map.items():
        clusters.setdefault(cid, []).append(ticker)

    fig, ax = plt.subplots(figsize=(10, 5))
    cluster_ids = sorted(clusters.keys())
    for i, cid in enumerate(cluster_ids):
        members = clusters[cid]
        ax.barh(i, len(members), color=plt.cm.Set2(i / max(len(cluster_ids), 1)))
        ax.text(len(members) + 0.1, i, ", ".join(members), va="center", fontsize=8)

    ax.set_yticks(range(len(cluster_ids)))
    ax.set_yticklabels([f"Cluster {c}" for c in cluster_ids])
    ax.set_xlabel("Number of Assets")
    ax.set_title("Cluster Composition")
    plt.tight_layout()
    path = os.path.join(save_dir, "cluster_composition.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Saved {path}")
