import { useEffect, useMemo, useRef } from 'react';
import anime from 'animejs';
import CsvUpload from '../components/CsvUpload';
import OptimizerPanel from '../components/OptimizerPanel';
import AnimatedNumber from '../components/AnimatedNumber';
import PortfolioValueChart from '../components/charts/PortfolioValueChart';
import WeightBarChart from '../components/charts/WeightBarChart';
import { usePortfolio } from '../hooks/usePortfolio';
import { clusterColor } from '../utils/colors';
import { pct } from '../utils/format';
import './Dashboard.css';

function MetricCard({ label, value, format = 'pct', decimals = 2, tone = 'positive' }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value === null || value === undefined
          ? '—'
          : <AnimatedNumber value={value} format={format} decimals={decimals} />}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, uploadedData, optimized } = usePortfolio();
  const gridRef = useRef(null);

  const metrics = useMemo(() => {
    if (optimized?.metrics) {
      return {
        ...(data?.metrics || {}),
        sharpe_ratio: optimized.metrics.sharpe ?? data?.metrics?.sharpe_ratio,
        annual_return: optimized.metrics.annual_return ?? data?.metrics?.annual_return,
        annual_volatility: optimized.metrics.volatility ?? data?.metrics?.annual_volatility,
      };
    }
    return data?.metrics;
  }, [data, optimized]);

  // Prefer optimizer output > uploaded CSV > backend default.
  const weights = useMemo(() => {
    if (optimized?.weights?.length) return optimized.weights;
    if (uploadedData?.weights?.length) return uploadedData.weights;
    return data?.weights || [];
  }, [optimized, uploadedData, data]);

  const portfolioHistory = useMemo(() => {
    if (optimized?.portfolio_history?.length) return optimized.portfolio_history;
    if (uploadedData?.kind === 'prices' && uploadedData.priceHistory?.length) {
      // Derive equal-weight portfolio value across uploaded prices for visualization.
      const rows = uploadedData.priceHistory;
      const tickers = uploadedData.tickers;
      const base = rows[0];
      return rows.map(r => {
        let sum = 0, count = 0;
        tickers.forEach(t => {
          if (base[t] > 0 && r[t] > 0) { sum += (r[t] / base[t]); count++; }
        });
        return { date: r.date, value: count ? (sum / count) * 10000 : 0 };
      });
    }
    return data?.portfolio_history || [];
  }, [uploadedData, data]);

  useEffect(() => {
    if (!gridRef.current) return;
    anime({
      targets: gridRef.current.querySelectorAll('.metric-card'),
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(70),
      duration: 500,
      easing: 'easeOutQuart',
    });
  }, [metrics]);

  const clusters = data?.clusters || [];

  return (
    <div className="page">
      <div className="section-header">
        <h2>Dashboard</h2>
        <p>Live snapshot of the optimized portfolio · upload your own CSV to compare.</p>
      </div>

      <CsvUpload />

      <OptimizerPanel />

      <div ref={gridRef} className="dashboard-grid">
        <MetricCard label="Sharpe Ratio"   value={metrics?.sharpe_ratio}     format="num" />
        <MetricCard label="Annual Return"  value={metrics?.annual_return}    format="pct" />
        <MetricCard label="Volatility"     value={metrics?.annual_volatility} format="pct" />
        <MetricCard label="Sortino Ratio"  value={metrics?.sortino_ratio}    format="num" />
        <MetricCard label="VaR 95% daily"  value={metrics?.var_95_daily}     format="pct" tone="negative" />
        <MetricCard label="Diversification" value={metrics?.diversification_ratio} format="num" />
        <MetricCard label="Assets"         value={data?.config?.n_assets}    format="int" />
        <MetricCard label="Clusters"       value={metrics?.n_clusters}       format="int" />
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-title">Portfolio value over time</div>
          <PortfolioValueChart data={portfolioHistory} />
        </div>
        <div className="card">
          <div className="card-title">Top allocations</div>
          <WeightBarChart weights={weights.slice(0, 15)} />
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 40 }}>
        <h2>Cluster Breakdown</h2>
        <p>Portfolio diversification across graph-detected sectors.</p>
      </div>
      <div className="cluster-grid">
        {clusters.map(c => (
          <div
            key={c.id}
            className="cluster-card"
            style={{ borderTop: `3px solid ${clusterColor(c.id)}` }}
          >
            <div className="cluster-name">{c.name}</div>
            <div className="cluster-members">
              {c.members.map(m => (
                <span key={m} className="member-tag">{m}</span>
              ))}
            </div>
            <div className="cluster-weight" style={{ color: clusterColor(c.id) }}>
              {pct(c.total_weight)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
