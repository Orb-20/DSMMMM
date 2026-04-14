import {
  ScatterChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, ZAxis,
} from 'recharts';
import { clusterColor, cssVar } from '../../utils/colors';
import { pct } from '../../utils/format';

// Plots: individual assets (scatter by cluster), frontier curve, selected portfolio marker.
export default function EfficientFrontierChart({
  frontier = [],
  selected,
  assets = [],
  height = 450,
}) {
  // Group assets per cluster for color legend
  const clusters = [...new Set(assets.map(a => a.cluster))];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart margin={{ top: 20, right: 30, bottom: 30, left: 30 }}>
        <CartesianGrid stroke={cssVar('--beige-light')} strokeDasharray="3 6" />
        <XAxis
          type="number"
          dataKey="risk"
          name="Risk"
          domain={[0, 'dataMax']}
          stroke={cssVar('--beige-dark')}
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
          tickFormatter={v => (v * 100).toFixed(0) + '%'}
          label={{
            value: 'Annualized Volatility',
            position: 'insideBottom',
            offset: -10,
            fontFamily: 'DM Sans',
            fontSize: 12,
            fill: cssVar('--beige-dark'),
          }}
        />
        <YAxis
          type="number"
          dataKey="return"
          name="Return"
          stroke={cssVar('--beige-dark')}
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
          tickFormatter={v => (v * 100).toFixed(0) + '%'}
          label={{
            value: 'Annualized Return',
            angle: -90,
            position: 'insideLeft',
            offset: 10,
            fontFamily: 'DM Sans',
            fontSize: 12,
            fill: cssVar('--beige-dark'),
          }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip
          cursor={{ stroke: cssVar('--green-sage'), strokeDasharray: '3 3' }}
          contentStyle={{
            background: cssVar('--cream-white'),
            border: `1px solid ${cssVar('--beige')}`,
            borderRadius: 12,
            fontFamily: 'DM Sans',
          }}
          formatter={(v, name) => [pct(v, 2), name]}
        />

        {/* Frontier curve */}
        <Line
          data={frontier}
          type="monotone"
          dataKey="return"
          stroke={cssVar('--green-forest')}
          strokeWidth={2.5}
          dot={false}
          activeDot={false}
          isAnimationActive
          animationDuration={1400}
        />

        {/* Individual assets — one scatter per cluster for color-coded legend */}
        {clusters.map(cid => (
          <Scatter
            key={cid}
            name={`Cluster ${cid}`}
            data={assets.filter(a => a.cluster === cid)}
            fill={clusterColor(cid)}
            shape="circle"
          />
        ))}

        {/* Selected portfolio */}
        {selected && (
          <Scatter
            name="Optimal Portfolio"
            data={[selected]}
            fill={cssVar('--gold')}
            shape="star"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
