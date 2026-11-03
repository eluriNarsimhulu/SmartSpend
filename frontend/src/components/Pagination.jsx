import Icon from './Icon';

// Returns [1, '…', 4, 5, 6, '…', 20]
function pageWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

export default function Pagination({ page, limit, total, totalPages, onPageChange, onLimitChange }) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <p className="pagination-info">Showing {from}–{to} of {total} transactions</p>

      <nav className="pagination-pages" aria-label="Pagination">
        <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <Icon name="chevronLeft" size={16} /> <span className="page-btn-text">Previous</span>
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="page-gap">…</span>
          ) : (
            <button key={p} className={`page-btn page-num ${p === page ? 'active' : ''}`} onClick={() => onPageChange(p)} aria-current={p === page ? 'page' : undefined}>
              {p}
            </button>
          )
        )}
        <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          <span className="page-btn-text">Next</span> <Icon name="chevronRight" size={16} />
        </button>
      </nav>

      <label className="page-size">
        <span>Per page</span>
        <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}
