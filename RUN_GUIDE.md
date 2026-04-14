# How to Run ORBE

## Prerequisites

- **Python** 3.8+ installed
- **Node.js** 18+ installed
- **npm** package manager

## Option 1: One-Command Start (Recommended)

```bash
python run.py
```

This automatically:
1. Generates synthetic market data (if needed)
2. Starts the Flask API server on `http://localhost:5000`
3. Serves the React frontend from the same port

Then open **http://localhost:5000** in your browser.

---

## Option 2: Manual Start (for development)

### Terminal 1 — Backend (Flask API)

```bash
# Install dependencies (first time only)
pip install -r requirements.txt

# Start the Flask server
python backend/app.py
```

The API runs on `http://localhost:5000`.

### Terminal 2 — Frontend (React dev server)

```bash
cd frontend-react

# Install dependencies (first time only)
npm install

# Start Vite dev server (with live reload)
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to `:5000` via Vite config.

---

## Key URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:5000` | Home page (3D globe) |
| `http://localhost:5000/dashboard` | Metrics & CSV upload |
| `http://localhost:5000/portfolio` | Weight allocations |
| `http://localhost:5000/analysis` | Efficient frontier |
| `http://localhost:5000/network` | Graph visualization & path explorer |

---

## CSV Upload

1. Go to **Dashboard** (`/dashboard`)
2. Click **Upload CSV** button
3. Select a CSV file with columns: `date`, `ticker1`, `ticker2`, ... (stock prices)
4. The frontend will:
   - Parse prices client-side
   - Compute returns & correlation
   - Build a correlation graph
   - Apply the selected algorithm (Dijkstra/MST/Max-Flow)
   - Show results without needing the backend

---

## Risk Adjustment

1. Go to **Dashboard** (`/dashboard`)
2. Use the **Risk Aversion (λ)** slider:
   - **Aggressive** (λ < 0.5): Favor returns, accept volatility
   - **Balanced** (λ < 2): Mixed risk-return tradeoff
   - **Conservative** (λ < 5): Minimize volatility
   - **Minimum-Variance** (λ ≥ 5): Focus on stability
3. Adjust **Max Weight** per asset and **Allow Shorts** as needed
4. Watch the portfolio metrics update live

---

## Investment Path Explorer

1. Go to **Network** (`/network`)
2. Select an algorithm:
   - **Safe** (Dijkstra): Lowest-distance path, risk-averse
   - **Balanced** (MST): Unique tree path, good diversification
   - **Aggressive** (Max-Flow): High-return stepping stones
3. Choose **From** and **To** tickers (or use defaults: best→worst)
4. Path shows on the 3D graph with:
   - Gold highlighted edges
   - Numbered sequence markers
   - Summary stats (hops, distance, return)

---

## Data & Configuration

- **Market data** stored in `data/raw/` (auto-generated on first run via `generate_data.py`)
- **Edit** tickers/dates in `src/config.py`
- **Synthetic data** is deterministic and uses yfinance as a reference

---

## Troubleshooting

**Port 5000 already in use:**
```bash
# Kill the process using port 5000
lsof -i :5000
kill -9 <PID>

# Or change the port in backend/app.py: app.run(port=5001)
```

**Node modules corrupted:**
```bash
cd frontend-react
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Build issues:**
```bash
npm run build
```

---

## Project Structure

```
graph_portfolio/
├── backend/
│   └── app.py                 # Flask API server
├── frontend-react/
│   ├── src/
│   │   ├── pages/             # Dashboard, Network, Portfolio, etc.
│   │   ├── components/        # OptimizerPanel, PathExplorer, NetworkGraph3D
│   │   ├── utils/             # Graph algorithms, colors, formatting
│   │   └── hooks/             # usePortfolio context
│   ├── package.json
│   └── vite.config.js         # Vite config with API proxy
├── src/                        # Core Python pipeline (7 stages)
├── data/                       # Raw & processed market data
├── requirements.txt           # Python dependencies
└── run.py                     # Main entry point
```

---

## Features

✅ **Graph-Theoretic Optimization** — MST filtering, spectral clustering  
✅ **Interactive 3D Visualization** — Three.js network graph with path highlighting  
✅ **Dynamic Risk Control** — λ slider, max-weight constraints, short selling toggle  
✅ **Investment Paths** — Three selectable algorithms with visual overlay  
✅ **CSV Import** — Client-side pipeline, no backend required  
✅ **Live Metrics** — Sharpe ratio, volatility, Sortino, VaR, diversification  
✅ **Beautiful UI** — React + Anime.js transitions, color-coded clusters  

Enjoy exploring your portfolio!
