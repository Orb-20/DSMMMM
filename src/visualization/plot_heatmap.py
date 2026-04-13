"""Correlation and covariance heatmap plots."""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import os


def plot_correlation_heatmap(C: np.ndarray, tickers: list[str], save_dir: str = "outputs/plots"):
    """Plot Pearson correlation matrix heatmap."""
    os.makedirs(save_dir, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(C, xticklabels=tickers, yticklabels=tickers,
                cmap="RdBu_r", center=0, vmin=-1, vmax=1,
                annot=True, fmt=".2f", ax=ax, square=True,
                annot_kws={"size": 7})
    ax.set_title("Pearson Correlation Matrix")
    plt.tight_layout()
    path = os.path.join(save_dir, "correlation_heatmap.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Saved {path}")
