import { formatCurrency, formatDate } from '../utils/format';

export default function TopExpenses({ expenses }) {
  if (expenses.length === 0) return <p className="muted">No expenses in this period.</p>;
  return (
    <ol className="top-list">
      {expenses.map((e, i) => (
        <li key={e.id}>
          <span className="rank">{i + 1}</span>
          <div className="top-main">
            <span className="truncate top-title">{e.note || e.categoryName}</span>
            <span className="muted small truncate">{e.categoryName} · {formatDate(e.date)}</span>
          </div>
          <strong className="text-expense">{formatCurrency(e.amount)}</strong>
        </li>
      ))}
    </ol>
  );
}
