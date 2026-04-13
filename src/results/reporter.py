"""Export weights and metrics to files."""

import json
import pandas as pd
import numpy as np
import os


def export_weights(weights: np.ndarray, tickers: list[str], cluster_map: dict[str, int], path: str):
    """Export weight allocation to CSV."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df = pd.DataFrame({
        "ticker": tickers,
        "weight": weights,
        "cluster": [cluster_map.get(t, -1) for t in tickers],
    })
    df = df.sort_values("weight", ascending=False)
    df.to_csv(path, index=False)
    print(f"Weights saved to {path}")


def export_metrics(metrics: dict, path: str):
    """Export metrics dict to JSON."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics saved to {path}")
