# ORBE — Graph-Theoretic Portfolio Optimizer

A full-stack application that uses graph theory and network analysis to construct diversified investment portfolios. Built with Python/Flask backend and React frontend.

## Quick Start

```bash
pip install -r requirements.txt
python run.py
```

Then open **http://localhost:5000** in your browser.

## Architecture

```
┌──────────────────────────┐     ┌──────────────────────────┐
│     React Frontend       │────▶│     Flask API Backend     │
│  (Single-page app)       │◀────│  (Portfolio engine)       │
│                          │     │                           │
│  • Home (3D globe)       │     │  GET /api/overview        │
│  • Dashboard (metrics)   │     │  GET /api/weights         │
│  • Portfolio (weights)   │     │  GET /api/correlation     │
│  • Analysis (frontier)   │     │  GET /api/frontier        │
│  • Network (graph)       │     │  GET /api/graph           │
│                          │     │  GET /api/portfolio-history│
└──────────────────────────┘     └──────────────────────────┘
```

## Pages

| Page | Description |
|------|-------------|
| **Home** | Animated 3D globe, key stats, pipeline overview |
| **Dashboard** | Metrics cards, cluster breakdown |
| **Portfolio** | Weight bars, holdings table, portfolio value chart |
| **Analysis** | Efficient frontier, correlation heatmap |
| **Network** | MST graph visualization, edge list |

## Pipeline (7 Stages)

1. **Data Preprocessing** — Load OHLCV data, compute log returns, clean missing values
2. **Statistical Estimation** — Mean returns (μ) and covariance (Σ) with Ledoit-Wolf shrinkage
3. **Correlation & Distance** — Pearson correlation → Mantegna distance matrix
4. **Graph Construction** — Weighted undirected graph from distance matrix
5. **Graph Processing** — MST filtering, spectral/Louvain clustering
6. **Portfolio Optimization** — Two-level cluster-aware Markowitz optimization (CVXPY)
7. **Result Generation** — Weights, metrics, and visualizations

## Configuration

Edit `src/config.py` to change tickers, dates, clustering method, etc.

## Tests

```bash
pytest tests/ -v
```

## Tech Stack

**Backend:** Python, Flask, NumPy, Pandas, NetworkX, CVXPY, scikit-learn
**Frontend:** React, Three.js, Canvas API, CSS animations
