import { useMemo } from 'react';
import { cssVar } from '../../utils/colors';
import { num } from '../../utils/format';

// Custom heatmap (Recharts doesn't ship one out of the box). Uses CSS grid
// with cells colored on a green→beige→red ramp based on correlation value.
export default function CorrelationHeatmap({ tickers = [], values = [] }) {
  const n = tickers.length;

  const color = (v) => {
    // v in [-1, 1] → ramp
    if (Number.isNaN(+v)) return cssVar('--cream');
    const clamp = Math.max(-1, Math.min(1, v));
    if (clamp >= 0) {
      // green intensity
      const t = clamp;
      const r = Math.round(200 - 100 * t);
      const g = Math.round(219 - 76 * t);
      const b = Math.round(176 - 130 * t);
      return `rgb(${r},${g},${b})`;
    }
    // negative → warm red muted
    const t = -clamp;
    const r = Math.round(232 - 64 * t);
    const g = Math.round(220 - 130 * t);
    const b = Math.round(200 - 126 * t);
    return `rgb(${r},${g},${b})`;
  };

  const cellSize = useMemo(() => {
    if (n <= 0) return 28;
    if (n <= 10) return 36;
    if (n <= 20) return 26;
    if (n <= 30) return 18;
    return 12;
  }, [n]);

  if (!n) return null;

  return (
    <div style={{ overflow: 'auto' }}>
      <div style={{ display: 'inline-block', position: 'relative' }}>
        {/* Top ticker labels */}
        <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${n}, ${cellSize}px)`, gap: 1 }}>
          <div />
          {tickers.map(t => (
            <div
              key={`top-${t}`}
              style={{
                fontSize: 10,
                fontFamily: 'JetBrains Mono',
                transform: 'rotate(-55deg)',
                transformOrigin: 'left bottom',
                height: 50,
                color: cssVar('--beige-dark'),
              }}
            >
              {t}
            </div>
          ))}
        </div>
        {tickers.map((rowT, i) => (
          <div
            key={rowT}
            style={{ display: 'grid', gridTemplateColumns: `60px repeat(${n}, ${cellSize}px)`, gap: 1, marginTop: 1 }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono',
                color: cssVar('--brown-dark'),
                paddingRight: 6,
                textAlign: 'right',
                lineHeight: `${cellSize}px`,
              }}
            >
              {rowT}
            </div>
            {values[i]?.map((v, j) => (
              <div
                key={j}
                title={`${rowT} × ${tickers[j]}: ${num(v, 3)}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: color(v),
                  borderRadius: 3,
                  transition: 'transform 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.35)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
