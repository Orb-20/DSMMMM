import { useMemo } from 'react';
import WeightBarChart from '../components/charts/WeightBarChart';
import PortfolioValueChart from '../components/charts/PortfolioValueChart';
import { usePortfolio } from '../hooks/usePortfolio';
import { clusterColor } from '../utils/colors';
import { pct, num } from '../utils/format';
import './Portfolio.css';

export default function PortfolioPage() {
  const { data, uploadedData } = usePortfolio();
  const weights = useMemo(
    () => (uploadedData?.weights?.length ? uploadedData.weights : data?.weights || []),
    [uploadedData, data],
  );
  const history = data?.portfolio_history || [];

  return (
    <div className="page">
      <div className="section-header">
        <h2>Portfolio Allocation</h2>
        <p>Weights derived from cluster-aware Markowitz optimization (long-only, fully invested).</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Weight distribution</div>
        <WeightBarChart weights={weights} height={400} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Holdings table</div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Weight</th>
                <th>Cluster</th>
                <th>Ann. Return</th>
                <th>Ann. Vol</th>
              </tr>
            </thead>
            <tbody>
              {weights.map(w => (
                <tr key={w.ticker}>
                  <td style={{ fontWeight: 500 }}>{w.ticker}</td>
                  <td>{pct(w.weight)}</td>
                  <td>
                    <span
                      className="cluster-badge"
                      style={{
                        background: clusterColor(w.cluster) + '22',
                        color: clusterColor(w.cluster),
                      }}
                    >
                      Cluster {w.cluster}
                    </span>
                  </td>
                  <td>{pct(w.annual_return, 2)}</td>
                  <td>{pct(w.annual_vol, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="card-title">Cumulative portfolio value</div>
          <PortfolioValueChart data={history} height={320} />
        </div>
      )}
    </div>
  );
}
