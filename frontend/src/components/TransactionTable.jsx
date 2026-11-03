import { useEffect, useState } from 'react';
import Icon from './Icon';
import CategoryBadge from './CategoryBadge';
import { formatCurrency, formatDate } from '../utils/format';

function Amount({ transaction }) {
  const isIncome = transaction.type === 'income';
  return (
    <span className={`amount ${isIncome ? 'text-income' : 'text-expense'}`}>
      <Icon name={isIncome ? 'arrowDown' : 'arrowUp'} size={14} />
      {isIncome ? '+' : '−'}{formatCurrency(transaction.amount)}
    </span>
  );
}

function RowActions({ transaction, onEdit, onDelete }) {
  return (
    <div className="row-actions">
      <button className="icon-btn" onClick={() => onEdit(transaction)} aria-label={`Edit ${transaction.note || transaction.categoryName}`}>
        <Icon name="edit" size={18} />
      </button>
      <button className="icon-btn danger" onClick={() => onDelete(transaction)} aria-label={`Delete ${transaction.note || transaction.categoryName}`}>
        <Icon name="trash" size={18} />
      </button>
    </div>
  );
}

// Desktop: table. Mobile (<= 768px): the same data as cards (CSS switches between them).
export default function TransactionTable({ transactions, onEdit, onDelete, selectable = true }) {
  const [selected, setSelected] = useState(new Set());

  // Forget selections that are no longer on this page.
  useEffect(() => setSelected(new Set()), [transactions]);

  const allSelected = transactions.length > 0 && selected.size === transactions.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(transactions.map((t) => t.id)));
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <>
      <div className="table-wrap">
        <table className="tx-table">
          <thead>
            <tr>
              {selectable && (
                <th className="col-check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all transactions" />
                </th>
              )}
              <th>Category</th>
              <th>Note</th>
              <th>Payment method</th>
              <th className="col-amount">Amount</th>
              <th>Date</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={selected.has(t.id) ? 'is-selected' : ''}>
                {selectable && (
                  <td className="col-check">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} aria-label={`Select ${t.note || t.categoryName}`} />
                  </td>
                )}
                <td><CategoryBadge name={t.categoryName} type={t.type} /></td>
                <td className="cell-note" title={t.note}>{t.note || <span className="muted">—</span>}</td>
                <td><span className="chip">{t.paymentMethod}</span></td>
                <td className="col-amount"><Amount transaction={t} /></td>
                <td className="nowrap">{formatDate(t.date)}</td>
                <td className="col-actions"><RowActions transaction={t} onEdit={onEdit} onDelete={onDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="tx-cards">
        {transactions.map((t) => (
          <li key={t.id} className="tx-card">
            <div className="tx-card-top">
              <CategoryBadge name={t.categoryName} type={t.type} />
              <Amount transaction={t} />
            </div>
            {t.note && <p className="tx-card-note">{t.note}</p>}
            <div className="tx-card-bottom">
              <span className="muted">{formatDate(t.date)} · {t.paymentMethod}</span>
              <RowActions transaction={t} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
      {selectable && selected.size > 0 && <p className="selection-info">{selected.size} selected</p>}
    </>
  );
}
