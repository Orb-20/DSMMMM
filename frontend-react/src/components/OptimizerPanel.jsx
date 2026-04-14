import { useCallback, useEffect, useRef, useState } from 'react';
import anime from 'animejs';
import AnimatedNumber from './AnimatedNumber';
import { api } from '../api/client';
import { usePortfolio } from '../hooks/usePortfolio';
import { pct, num } from '../utils/format';
import './OptimizerPanel.css';

// Debounce hook — avoids spamming /api/optimize while the user is dragging.
function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// Risk aversion λ range: [0.1, 10]. λ≈0.1 = aggressive (return-chasing),
// λ≈10 = minimum-variance. Exposed on a log scale for feel.
const LAMBDA_MIN = 0.1;
const LAMBDA_MAX = 10.0;

function sliderToLambda(s) {
  // s ∈ [0, 100]  →  λ ∈ [LAMBDA_MIN, LAMBDA_MAX] log-mapped.
  const t = s / 100;
  const logMin = Math.log(LAMBDA_MIN);
  const logMax = Math.log(LAMBDA_MAX);
  return Math.exp(logMin + t * (logMax - logMin));
}
function lambdaToSlider(lam) {
  const logMin = Math.log(LAMBDA_MIN);
  const logMax = Math.log(LAMBDA_MAX);
  return ((Math.log(lam) - logMin) / (logMax - logMin)) * 100;
}

export default function OptimizerPanel() {
  const { setOptimized, optimized, data } = usePortfolio();

  const [sliderVal, setSliderVal]       = useState(lambdaToSlider(1.0));
  const [maxWeightPct, setMaxWeightPct] = useState(25);
  const [allowShort, setAllowShort]     = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [error, setError]               = useState(null);

  const lam = sliderToLambda(sliderVal);
  const debouncedLam       = useDebounced(lam, 300);
  const debouncedMaxWeight = useDebounced(maxWeightPct, 300);
  const debouncedShort     = useDebounced(allowShort, 0);

  const resultRef = useRef(null);

  const runOptimize = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.optimize({
        riskAversion: debouncedLam,
        maxWeight: debouncedMaxWeight / 100,
        allowShort: debouncedShort,
      });
      setOptimized(res);
      if (resultRef.current) {
        anime({
          targets: resultRef.current,
          opacity: [0.5, 1],
          translateY: [6, 0],
          duration: 400,
          easing: 'easeOutCubic',
        });
      }
    } catch (err) {
      setError(err.message || 'Optimization failed. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }, [debouncedLam, debouncedMaxWeight, debouncedShort, setOptimized]);

  // Auto-run when any debounced param changes AND we have backend data.
  useEffect(() => {
    if (!data) return;
    runOptimize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLam, debouncedMaxWeight, debouncedShort, data]);

  const metrics = optimized?.metrics;

  // Label mapping for λ — gives users a human-readable stance.
  const stance = lam < 0.5 ? 'Aggressive (return-seeking)'
              : lam < 2   ? 'Balanced'
              : lam < 5   ? 'Conservative'
              :             'Minimum-variance';

  return (
    <div className="opt-panel">
      <div className="opt-head">
        <div>
          <div className="opt-title">Adjust risk &amp; constraints</div>
          <div className="opt-sub">
            Re-solves the Markowitz QP live · <span className="mono">min ½λw'Σw − μ'w</span>
          </div>
        </div>
        {busy && <div className="opt-badge">Solving…</div>}
      </div>

      <div className="opt-controls">
        <div className="opt-control">
          <div className="opt-label-row">
            <label>Risk aversion (λ)</label>
            <span className="opt-value mono">{num(lam, 2)}</span>
          </div>
          <input
            type="range"
            min={0} max={100} step={0.5}
            value={sliderVal}
            onChange={(e) => setSliderVal(Number(e.target.value))}
            className="opt-slider"
          />
          <div className="opt-scale">
            <span>Aggressive</span>
            <span className="opt-stance">{stance}</span>
            <span>Min-variance</span>
          </div>
        </div>

        <div className="opt-control">
          <div className="opt-label-row">
            <label>Max single-asset weight</label>
            <span className="opt-value mono">{maxWeightPct}%</span>
          </div>
          <input
            type="range"
            min={5} max={100} step={1}
            value={maxWeightPct}
            onChange={(e) => setMaxWeightPct(Number(e.target.value))}
            className="opt-slider"
          />
        </div>

        <div className="opt-toggle">
          <label>
            <input
              type="checkbox"
              checked={allowShort}
              onChange={(e) => setAllowShort(e.target.checked)}
            />
            Allow short selling (<span className="mono">w &lt; 0</span>)
          </label>
        </div>
      </div>

      <div ref={resultRef} className="opt-result">
        <div className="opt-stat">
          <div className="opt-stat-label">Annual return</div>
          <div className="opt-stat-value positive">
            {metrics ? <AnimatedNumber value={metrics.annual_return} format="pct" /> : '—'}
          </div>
        </div>
        <div className="opt-stat">
          <div className="opt-stat-label">Volatility</div>
          <div className="opt-stat-value">
            {metrics ? <AnimatedNumber value={metrics.annual_volatility} format="pct" /> : '—'}
          </div>
        </div>
        <div className="opt-stat">
          <div className="opt-stat-label">Sharpe</div>
          <div className="opt-stat-value">
            {metrics ? <AnimatedNumber value={metrics.sharpe_ratio} format="num" /> : '—'}
          </div>
        </div>
      </div>

      {error && <div className="opt-error">{error}</div>}
    </div>
  );
}
