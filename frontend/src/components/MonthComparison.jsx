import { formatCurrency, formatMonthYear, formatShortDate } from '../utils/format';

const fmtPercent = (n) => `${Math.abs(n).toFixed(1).replace(/\.0$/, '')}%`;

// Spending is the "bad" direction when it goes up, so up = red, down = green.
function Change({ percent, previous, current }) {
  if (percent === null) {
    return current > 0 ? <span className="change change-new">New</span> : <span className="muted">—</span>;
  }
  if (percent === 0) return <span className="muted">No change</span>;
  const up = percent > 0;
  return <span className={`change ${up ? 'change-up' : 'change-down'}`}>{up ? '↑' : '↓'} {fmtPercent(percent)}</span>;
}

function periodTitle(period, isMonth) {
  return isMonth ? formatMonthYear(period.startDate) : `${formatShortDate(period.startDate)} – ${formatShortDate(period.endDate)}`;
}

export default function MonthComparison({ data }) {
  const { current, previous, changePercent, comparisonLabel, categories } = data;
  const isMonth = comparisonLabel === 'last month';
  const hasAny = current.total > 0 || previous.total > 0;

  if (!hasAny) return <p className="muted">No expenses in this period or the one before it.</p>;

  let headline;
  if (changePercent === null) headline = `No spending ${comparisonLabel === 'last month' ? 'last month' : 'in the previous period'} to compare with.`;
  else if (changePercent === 0) headline = `Same spending as ${comparisonLabel}.`;
  else headline = `${changePercent > 0 ? '↑' : '↓'} ${fmtPercent(changePercent)} ${changePercent > 0 ? 'more' : 'less'} than ${comparisonLabel}`;

  return (
    <div className="comparison">
      <div className="comparison-totals">
        <div>
          <span className="muted small">{isMonth ? 'This month' : 'This period'} · {periodTitle(current, isMonth)}</span>
          <strong>{formatCurrency(current.total)}</strong>
        </div>
        <div>
          <span className="muted small">{isMonth ? 'Last month' : 'Previous period'} · {periodTitle(previous, isMonth)}</span>
          <strong>{formatCurrency(previous.total)}</strong>
        </div>
      </div>
      <p className={`comparison-headline ${changePercent > 0 ? 'text-expense' : changePercent < 0 ? 'text-income' : ''}`}>{headline}</p>

      {categories.length > 0 && (
        <ul className="comparison-list">
          {categories.slice(0, 6).map((c) => (
            <li key={c.name}>
              <span className="truncate">{c.name}</span>
              <span className="comparison-values muted small">{formatCurrency(c.previous)} → {formatCurrency(c.current)}</span>
              <Change percent={c.changePercent} previous={c.previous} current={c.current} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
