import EfficientFrontierChart from '../components/charts/EfficientFrontierChart';
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap';
import { usePortfolio } from '../hooks/usePortfolio';

export default function Analysis() {
  const { data } = usePortfolio();
  const frontier = data?.frontier || [];
  const selected = data?.selected_portfolio;
  const assets   = data?.individual_assets || [];
  const corr     = data?.correlation || { tickers: [], values: [] };

  return (
    <div className="page">
      <div className="section-header">
        <h2>Analysis</h2>
        <p>Risk-return frontier and the asset correlation structure driving clustering.</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Efficient frontier</div>
        <EfficientFrontierChart
          frontier={frontier}
          selected={selected}
          assets={assets}
          height={480}
        />
      </div>

      <div className="card">
        <div className="card-title">Correlation heatmap</div>
        <CorrelationHeatmap tickers={corr.tickers} values={corr.values} />
      </div>
    </div>
  );
}
