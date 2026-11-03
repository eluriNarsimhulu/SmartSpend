import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useChartColors from '../hooks/useChartColors';
import { formatCompact, formatCurrency } from '../utils/format';

export default function IncomeExpenseChart({ income, expense, balance }) {
  const colors = useChartColors();
  const data = [
    { name: 'Income', value: income, color: colors.income },
    { name: 'Expenses', value: expense, color: colors.expense },
    { name: 'Remaining', value: balance, color: colors.balance },
  ];

  return (
    <div>
      <div className="chart-box" role="img" aria-label="Income versus expenses chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: colors.axis, fontSize: 12 }} />
            <YAxis tickFormatter={formatCompact} width={48} axisLine={false} tickLine={false} tick={{ fill: colors.axis, fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: colors.grid, opacity: 0.35 }}
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 10, color: colors.text }}
              labelStyle={{ color: colors.text, fontWeight: 600 }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="ie-legend">
        {data.map((d) => (
          <div key={d.name}>
            <dt><span className="legend-dot" style={{ background: d.color }} />{d.name}</dt>
            <dd>{formatCurrency(d.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
