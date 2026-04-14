import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';
import { clusterColor, cssVar } from '../../utils/colors';
import { pct } from '../../utils/format';

export default function WeightBarChart({ weights = [], height = 380 }) {
  const data = weights.map(w => ({
    ticker: w.ticker,
    weight: w.weight,
    cluster: w.cluster,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
        <CartesianGrid stroke={cssVar('--beige-light')} strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="ticker"
          stroke={cssVar('--beige-dark')}
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          stroke={cssVar('--beige-dark')}
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
          tickFormatter={v => (v * 100).toFixed(0) + '%'}
        />
        <Tooltip
          contentStyle={{
            background: cssVar('--cream-white'),
            border: `1px solid ${cssVar('--beige')}`,
            borderRadius: 12,
            fontFamily: 'DM Sans',
          }}
          formatter={(v) => [pct(v, 2), 'Weight']}
        />
        <Bar dataKey="weight" radius={[6, 6, 0, 0]} animationDuration={900}>
          {data.map((d, i) => (
            <Cell key={i} fill={clusterColor(d.cluster)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
