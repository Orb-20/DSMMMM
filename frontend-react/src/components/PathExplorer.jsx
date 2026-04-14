import { useEffect, useMemo, useState } from 'react';
import anime from 'animejs';
import { usePortfolio } from '../hooks/usePortfolio';
import {
  computeShockPropagation,
  computeDiversifiedBasket,
  computeMaxReturnPath,
} from '../utils/graphAlgorithms';
import { clusterColor } from '../utils/colors';
import { pct, num } from '../utils/format';
import './PathExplorer.css';

const ALGOS = [
  {
    id: 'dijkstra',
    label: 'Shock Propagation',
    sub: 'Dijkstra',
    tagline: 'Pick one stock · see which others it impacts most',
    insight:
      'Traces how a price shock in the source stock propagates through the network. Top-10 most-affected stocks are surfaced — these are the tightest co-movers and will react first.',
    tone: 'safe',
  },
  {
    id: 'mst',
    label: 'Diversified Basket',
    sub: 'MST',
    tagline: 'Auto-pick low-risk, low-correlation stocks across clusters',
    insight:
      'Builds the minimum spanning tree and selects one representative per branch — prioritizing high isolation and low volatility. No inputs needed; you get a ready-to-invest basket.',
    tone: 'balanced',
  },
  {
    id: 'maxflow',
    label: 'Max-Return Flow',
    sub: 'Max-Flow',
    tagline: 'Auto-find the path with the best cumulative return',
    insight:
      'Scans all candidate paths through the network, ranks by cumulative expected return, then filters by your chosen risk tier. Returns the single best-return route.',
    tone: 'aggressive',
  },
];

// Build edge list for uploaded CSV (same helper as before)
function csvEdgesFromPrices(priceHistory, tickers) {
  if (!priceHistory?.length || !tickers?.length) return [];
  const returns = tickers.map(() => []);
  for (let i = 1; i < priceHistory.length; i++) {
    tickers.forEach((t, idx) => {
      const p0 = priceHistory[i - 1][t], p1 = priceHistory[i][t];
      if (p0 > 0 && p1 > 0) returns[idx].push(Math.log(p1 / p0));
    });
  }
  const means = returns.map(r => r.reduce((a, b) => a + b, 0) / Math.max(r.length, 1));
  const vars_ = returns.map((r, i) =>
    r.reduce((a, b) => a + (b - means[i]) ** 2, 0) / Math.max(r.length - 1, 1),
  );
  const stds = vars_.map(v => Math.sqrt(v) || 1e-9);
  const out = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      let cov = 0;
      const len = Math.min(returns[i].length, returns[j].length);
      for (let k = 0; k < len; k++) {
        cov += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      cov /= Math.max(len - 1, 1);
      const rho = cov / (stds[i] * stds[j]);
      const clamped = Math.max(-1, Math.min(1, rho));
      const d = Math.sqrt(2 * (1 - clamped));
      out.push({ source: tickers[i], target: tickers[j], weight: d });
    }
  }
  return out;
}

export default function PathExplorer() {
  const { data, uploadedData, setPath } = usePortfolio();

  const nodes = useMemo(() => {
    if (uploadedData?.kind === 'prices') {
      return uploadedData.tickers.map((t, i) => ({
        id: t,
        cluster: i % 4,
        weight: uploadedData.weights?.[i]?.weight || 0,
        annual_return: uploadedData.weights?.[i]?.annual_return || 0,
        annual_vol: uploadedData.weights?.[i]?.annual_vol || 0,
      }));
    }
    // Enrich backend graph_nodes with return/vol from weights table (safety net
    // in case the backend is an older build that didn't attach them to nodes).
    const rawNodes = data?.graph_nodes || [];
    const byTicker = new Map(
      (data?.weights || []).map(w => [w.ticker, w]),
    );
    return rawNodes.map(n => {
      const w = byTicker.get(n.id);
      return {
        ...n,
        annual_return: n.annual_return ?? w?.annual_return ?? 0,
        annual_vol: n.annual_vol ?? w?.annual_vol ?? 0,
      };
    });
  }, [data, uploadedData]);

  const edges = useMemo(() => {
    if (uploadedData?.kind === 'prices') {
      return csvEdgesFromPrices(uploadedData.priceHistory, uploadedData.tickers);
    }
    return data?.graph_edges || [];
  }, [data, uploadedData]);

  const [algo, setAlgo] = useState('dijkstra');
  const [source, setSource] = useState('');
  const [basketSize, setBasketSize] = useState(8);
  const [riskTier, setRiskTier] = useState('moderate');
  const [result, setResult] = useState(null);

  const tickerOptions = useMemo(
    () => [...nodes].map(n => n.id).sort((a, b) => a.localeCompare(b)),
    [nodes],
  );

  // Default source = highest-weight node
  useEffect(() => {
    if (!nodes.length) return;
    if (!source || !nodes.find(n => n.id === source)) {
      const top = [...nodes].sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
      if (top) setSource(top.id);
    }
  }, [nodes, source]);

  // Auto-run on any param change
  useEffect(() => {
    if (!nodes.length || !edges.length) return;
    let r = null;
    if (algo === 'dijkstra' && source) {
      r = computeShockPropagation({ nodes, edges, source });
    } else if (algo === 'mst') {
      r = computeDiversifiedBasket({ nodes, edges, basketSize });
    } else if (algo === 'maxflow') {
      r = computeMaxReturnPath({ nodes, edges, riskTier });
    }
    setResult(r);
    if (r) {
      // Pass node+edge set to 3D graph for highlighting
      setPath({
        mode: r.mode,
        nodes: (r.nodes || []).map(n => ({ id: n.id, ticker: n.id, ...n })),
        edges: r.edges || [],
      });
      requestAnimationFrame(() => {
        anime({
          targets: '.px-result',
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 500,
          easing: 'easeOutQuart',
        });
      });
    } else {
      setPath(null);
    }
  }, [algo, source, basketSize, riskTier, nodes, edges, setPath]);

  const activeAlgo = ALGOS.find(a => a.id === algo);

  return (
    <div className="path-explorer">
      <div className="path-head">
        <div>
          <div className="path-title">Graph-Theoretic Analysis</div>
          <div className="path-sub">
            Three lenses into the correlation network · each answers a different question
            {uploadedData?.kind === 'prices' && <span className="csv-tag"> · CSV mode</span>}
          </div>
        </div>
      </div>

      <div className="algo-chips">
        {ALGOS.map(a => (
          <button
            key={a.id}
            className={`algo-chip algo-${a.tone} ${algo === a.id ? 'active' : ''}`}
            onClick={() => setAlgo(a.id)}
            title={a.tagline}
          >
            <div className="algo-chip-head">
              <span className="algo-chip-label">{a.label}</span>
              <span className="algo-chip-sub">{a.sub}</span>
            </div>
            <div className="algo-chip-tag">{a.tagline}</div>
          </button>
        ))}
      </div>

      <div className="algo-insight">
        <div className="insight-icon" aria-hidden>◈</div>
        <div className="insight-body">
          <div className="insight-title">What this reveals</div>
          <div className="insight-text">{activeAlgo.insight}</div>
        </div>
      </div>

      {/* ─── MODE-SPECIFIC CONTROLS ─────────────────────────────────── */}
      {algo === 'dijkstra' && (
        <div className="mode-controls">
          <label className="path-field">
            <span>Shock source (single stock)</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {tickerOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div className="mode-hint">
            → What happens to the rest of the market if {source || '—'} crashes?
          </div>
        </div>
      )}

      {algo === 'mst' && (
        <div className="mode-controls">
          <label className="path-field">
            <span>Basket size: {basketSize} stocks</span>
            <input
              type="range"
              min="3"
              max={Math.min(16, nodes.length)}
              value={basketSize}
              onChange={(e) => setBasketSize(Number(e.target.value))}
              className="mst-slider"
            />
          </label>
          <div className="mode-hint">
            → Low-risk, low-correlation picks spread across clusters
          </div>
        </div>
      )}

      {algo === 'maxflow' && (
        <div className="mode-controls">
          <div className="risk-tier-group">
            <span className="risk-tier-label">Risk Tier</span>
            <div className="risk-tier-chips">
              {[
                { id: 'low',       label: 'Low Risk',       tone: 'tier-low' },
                { id: 'moderate',  label: 'Moderate',       tone: 'tier-mod' },
                { id: 'high',      label: 'High Risk',      tone: 'tier-high' },
              ].map(t => (
                <button
                  key={t.id}
                  className={`risk-tier-chip ${t.tone} ${riskTier === t.id ? 'active' : ''}`}
                  onClick={() => setRiskTier(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mode-hint">
            → Best-return path through the network, filtered by volatility tier
          </div>
        </div>
      )}

      {/* ─── MODE-SPECIFIC RESULTS ──────────────────────────────────── */}
      {result?.mode === 'shock' && (
        <ShockResult result={result} />
      )}
      {result?.mode === 'mst' && (
        <BasketResult result={result} />
      )}
      {result?.mode === 'maxflow' && (
        <MaxFlowResult result={result} />
      )}
    </div>
  );
}

/* ─── Result components ─────────────────────────────────────────────────── */

function ShockResult({ result }) {
  const maxImpact = result.top10[0]?.impact || 1;
  const srcNode = result.nodes[0];
  return (
    <div className="px-result shock-result">
      <div className="result-head">
        <div className="result-title">
          Shock transmission from <span className="mono src-chip">{result.source}</span>
        </div>
        <div className="result-sub">
          Top-10 stocks most affected by a price move in {result.source}. Higher bar = tighter link.
        </div>
      </div>

      <div className="shock-grid">
        {result.top10.map((n, i) => {
          const pctBar = (n.impact / maxImpact) * 100;
          return (
            <div key={n.id} className="shock-row">
              <div className="shock-rank">#{i + 1}</div>
              <div className="shock-ticker" style={{ color: clusterColor(n.cluster) }}>
                {n.id}
              </div>
              <div className="shock-bar-wrap">
                <div
                  className="shock-bar"
                  style={{
                    width: `${pctBar}%`,
                    background: `linear-gradient(90deg, ${clusterColor(n.cluster)}, var(--gold))`,
                  }}
                />
              </div>
              <div className="shock-impact mono">
                {(n.impact * 100).toFixed(1)}%
              </div>
              <div className="shock-dist mono">d={num(n.distance, 2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BasketResult({ result }) {
  const { picks, stats } = result;
  return (
    <div className="px-result basket-result">
      <div className="result-head">
        <div className="result-title">Diversified basket · {picks.length} stocks</div>
        <div className="result-sub">
          One representative per branch of the MST · prioritized by isolation &amp; low volatility.
        </div>
      </div>

      <div className="basket-stats">
        <div className="bs-item">
          <span className="bs-label">Clusters covered</span>
          <span className="bs-value mono">{stats.clustersCovered}</span>
        </div>
        <div className="bs-item">
          <span className="bs-label">Avg volatility</span>
          <span className="bs-value mono">{pct(stats.avgVol)}</span>
        </div>
        <div className="bs-item">
          <span className="bs-label">Avg return (μ)</span>
          <span className="bs-value mono positive">{pct(stats.avgReturn)}</span>
        </div>
      </div>

      <div className="basket-grid">
        {picks.map((n, i) => (
          <div
            key={n.id}
            className="basket-card"
            style={{
              borderTop: `3px solid ${clusterColor(n.cluster)}`,
              boxShadow: `0 4px 12px ${clusterColor(n.cluster)}15`,
            }}
          >
            <div className="basket-rank">#{i + 1}</div>
            <div className="basket-ticker">{n.id}</div>
            <div className="basket-meta">
              <div><span>Return</span><span className="mono positive">{pct(n.annual_return)}</span></div>
              <div><span>Vol</span><span className="mono">{pct(n.annual_vol)}</span></div>
              <div><span>Isolation</span><span className="mono">{num(n.isolation, 2)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaxFlowResult({ result }) {
  const tierLabel = { low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk' }[result.riskTier];
  const tierColor = { low: 'var(--green-sage)', moderate: 'var(--gold)', high: 'var(--red-muted)' }[result.riskTier];
  return (
    <div className="px-result maxflow-result">
      <div className="result-head">
        <div className="result-title">
          Best-return path · <span style={{ color: tierColor }}>{tierLabel}</span>
        </div>
        <div className="result-sub">
          Scanned {result.totalCandidates} candidate paths · picked the one maximizing cumulative μ within the chosen tier.
        </div>
      </div>

      <div className="maxflow-stats">
        <div className="mf-item">
          <span className="mf-label">Hops</span>
          <span className="mf-value mono">{result.hops}</span>
        </div>
        <div className="mf-item">
          <span className="mf-label">Cumulative return (μ)</span>
          <span className="mf-value mono positive">{pct(result.cumReturn)}</span>
        </div>
        <div className="mf-item">
          <span className="mf-label">Avg volatility (risk)</span>
          <span className="mf-value mono" style={{ color: tierColor }}>{pct(result.avgVol)}</span>
        </div>
        <div className="mf-item">
          <span className="mf-label">Sharpe (μ/σ)</span>
          <span className="mf-value mono">{num(result.sharpe, 2)}</span>
        </div>
        <div className="mf-item">
          <span className="mf-label">Route</span>
          <span className="mf-value mono">{result.source} → {result.target}</span>
        </div>
      </div>

      <div className="path-chain">
        {result.nodes.map((n, i) => (
          <div key={n.id} className="path-step">
            <div
              className="path-node"
              style={{
                borderColor: clusterColor(n.cluster),
                boxShadow: `0 0 0 3px ${clusterColor(n.cluster)}22`,
              }}
            >
              <div className="path-node-ticker">{n.id}</div>
              <div className="path-node-meta mono">
                μ {pct(n.annual_return, 1)} · σ {pct(n.annual_vol, 1)}
              </div>
            </div>
            {i < result.nodes.length - 1 && (
              <div className="path-arrow" aria-hidden>
                <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
                  <path d="M0 6 H30 M26 2 L32 6 L26 10"
                        stroke="currentColor" strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
