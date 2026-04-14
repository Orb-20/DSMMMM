# ORBE Frontend (React + Vite)

Modern React rewrite of the single-file HTML dashboard. Uses the exact same
color palette and typography, but split into proper components with:

- **React 18** + **React Router** for navigation
- **Three.js** for the hero globe and the 3D correlation network
- **Recharts** for the portfolio value, weight bars, and efficient frontier
- **anime.js** for hero/stat/page-transition animations
- **Papaparse** for client-side CSV parsing (upload button on Dashboard)

## Setup

```bash
cd frontend-react
npm install
npm run dev        # → http://localhost:5173 (proxies /api → :5000)
npm run build      # → dist/
```

The Vite dev server proxies `/api/*` to the Flask backend on port 5000
(see `vite.config.js`). Start the backend in a separate terminal:

```bash
python backend/app.py
```

If the backend isn't running, the UI still loads — you can upload a CSV on
the **Dashboard** to visualize your own stock data.

## CSV upload

The Dashboard's upload zone accepts two layouts:

1. **Price history** — header `date,TICKER1,TICKER2,…` with daily prices.
   The client derives inverse-volatility weights for preview.
2. **Holdings table** — header `ticker,weight[,cluster,annual_return,annual_vol]`.

Files are parsed in the browser with Papaparse; nothing leaves the machine.

## Structure

```
src/
├── api/client.js           # fetch wrappers for /api/*
├── components/
│   ├── Navbar.jsx
│   ├── HeroGlobe.jsx        # Three.js wireframe globe
│   ├── NetworkGraph3D.jsx   # Three.js correlation network
│   ├── CsvUpload.jsx        # drag/drop + button
│   ├── AnimatedNumber.jsx   # anime.js number easing
│   └── charts/
│       ├── PortfolioValueChart.jsx
│       ├── WeightBarChart.jsx
│       ├── EfficientFrontierChart.jsx
│       └── CorrelationHeatmap.jsx
├── hooks/usePortfolio.js    # context + fetch
├── pages/
│   ├── Home.jsx
│   ├── Dashboard.jsx
│   ├── Portfolio.jsx
│   ├── Analysis.jsx
│   └── Network.jsx
├── styles/
│   ├── theme.css            # CSS custom properties
│   └── global.css
├── utils/
│   ├── colors.js            # palette helpers (CSS var ↔ JS)
│   ├── format.js
│   └── csvToPortfolio.js    # Papaparse adapter
├── App.jsx
└── main.jsx
```

Everything reads color values from `theme.css` via `cssVar()` so the palette
lives in exactly one place — nothing is hardcoded across components.
