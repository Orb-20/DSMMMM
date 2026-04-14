import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cssVar } from '../../utils/colors';
import { compactDate, dollar } from '../../utils/format';

export default function PortfolioValueChart({ data = [], height = 320 }) {
  const sage = cssVar('--green-sage');
  const forest = cssVar('--green-forest');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={sage} stopOpacity={0.4} />
            <stop offset="100%" stopColor={sage} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={cssVar('--beige-light')} strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={compactDate}
          stroke={cssVar('--beige-dark')}
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
          minTickGap={40}
        />
        <YAxis
          stroke={cssVar('--beige-dark')}
          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
          tickFormatter={v => '$' + (v / 1000).toFixed(1) + 'k'}
        />
        <Tooltip
          contentStyle={{
            background: cssVar('--cream-white'),
            border: `1px solid ${cssVar('--beige')}`,
            borderRadius: 12,
            fontFamily: 'DM Sans',
          }}
          formatter={(v) => [dollar(v, 2), 'Value']}
          labelFormatter={compactDate}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={forest}
          strokeWidth={2}
          fill="url(#pvFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
