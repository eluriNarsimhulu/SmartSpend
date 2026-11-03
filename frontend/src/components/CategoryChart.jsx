import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useChartColors, { CATEGORY_PALETTE } from '../hooks/useChartColors';
import { formatCurrency } from '../utils/format';

// Horizontal bar chart of spending per category (top 8).
export default function CategoryChart({ categories }) {
  const colors = useChartColors();
  const data = categories.slice(0, 8);

  return (
    <div className="chart-box" role="img" aria-label="Spending by category chart">
      <ResponsiveContainer width="100%" height={Math.max(data.length * 46 + 16, 160)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 76, left: 0, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={96} axisLine={false} tickLine={false} tick={{ fill: colors.text, fontSize: 13 }} />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.35 }}
            formatter={(value) => [formatCurrency(value), 'Spent']}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 10, color: colors.text }}
            labelStyle={{ color: colors.text, fontWeight: 600 }}
          />
          <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={20}>
            {data.map((entry, i) => <Cell key={entry.id} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />)}
            <LabelList dataKey="total" position="right" formatter={formatCurrency} style={{ fill: colors.text, fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
