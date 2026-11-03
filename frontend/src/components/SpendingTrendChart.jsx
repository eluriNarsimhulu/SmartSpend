import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import useChartColors from '../hooks/useChartColors';
import { formatCompact, formatCurrency, formatDate, formatShortDate } from '../utils/format';

// variant "area": income vs expense lines (dashboard). variant "bars": daily expenses only (analytics).
export default function SpendingTrendChart({ points, variant = 'area' }) {
  const colors = useChartColors();
  const axisProps = { stroke: colors.axis, tick: { fill: colors.axis, fontSize: 12 }, tickLine: false };
  const tooltipProps = {
    formatter: (value, name) => [formatCurrency(value), name],
    labelFormatter: formatDate,
    contentStyle: { background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 10, color: colors.text },
    labelStyle: { color: colors.text, fontWeight: 600 },
  };

  return (
    <div className="chart-box" role="img" aria-label="Spending trend chart">
      <ResponsiveContainer width="100%" height={280}>
        {variant === 'bars' ? (
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={28} axisLine={false} {...axisProps} />
            <YAxis tickFormatter={formatCompact} width={48} axisLine={false} {...axisProps} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} {...tooltipProps} />
            <Bar dataKey="expense" name="Expense" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        ) : (
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.income} stopOpacity={0.28} />
                <stop offset="100%" stopColor={colors.income} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.expense} stopOpacity={0.28} />
                <stop offset="100%" stopColor={colors.expense} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={28} axisLine={false} {...axisProps} />
            <YAxis tickFormatter={formatCompact} width={48} axisLine={false} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: colors.axis, paddingBottom: 8 }} />
            <Area type="monotone" dataKey="income" name="Income" stroke={colors.income} strokeWidth={2} fill="url(#fillIncome)" />
            <Area type="monotone" dataKey="expense" name="Expense" stroke={colors.expense} strokeWidth={2} fill="url(#fillExpense)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
