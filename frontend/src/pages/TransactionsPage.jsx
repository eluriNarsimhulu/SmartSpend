import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import FilterBar from '../components/FilterBar';
import TransactionTable from '../components/TransactionTable';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { RowsSkeleton, Spinner } from '../components/LoadingState';
import useTransactionDialogs from '../hooks/useTransactionDialogs';
import { transactionService } from '../services/transactionService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { makePeriod } from '../utils/dates';

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
];

const emptyFilters = (search = '') => ({ search, type: '', category: '', paymentMethod: '', period: makePeriod('all') });

export default function TransactionsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  const [filters, setFilters] = useState(() => emptyFilters(urlSearch));
  const [sort, setSort] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [state, setState] = useState({ transactions: [], pagination: null, loading: true, error: null });

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { openAdd, openEdit, askDelete, dialogs } = useTransactionDialogs({ onChanged: refresh });

  // The top-bar search box navigates here with ?search=...
  useEffect(() => {
    setFilters((f) => (f.search === urlSearch ? f : { ...f, search: urlSearch }));
    setPage(1);
  }, [urlSearch]);

  // Query params sent to the API (filters are applied by PostgreSQL, not in the browser).
  const queryParams = useMemo(
    () => ({
      search: filters.search,
      type: filters.type,
      category: filters.category,
      paymentMethod: filters.paymentMethod,
      startDate: filters.period.startDate,
      endDate: filters.period.endDate,
    }),
    [filters]
  );

  useEffect(() => {
    let cancelled = false;
    const [sortBy, sortOrder] = sort.split('_');
    setState((s) => ({ ...s, loading: true, error: null }));
    transactionService
      .list({ ...queryParams, sortBy, sortOrder, page, limit })
      .then((res) => {
        if (cancelled) return;
        // e.g. deleted the last row on the last page -> step back one page
        if (res.transactions.length === 0 && res.pagination.page > 1) {
          setPage(res.pagination.totalPages);
          return;
        }
        setState({ transactions: res.transactions, pagination: res.pagination, loading: false, error: null });
      })
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: getErrorMessage(err, 'Could not load transactions.') })));
    return () => { cancelled = true; };
  }, [queryParams, sort, page, limit, refreshKey]);

  const updateFilters = useCallback((partial) => {
    setFilters((f) => ({ ...f, ...partial }));
    setPage(1);
  }, []);

  const resetFilters = () => {
    setFilters(emptyFilters());
    setSort('date_desc');
    setPage(1);
    if (urlSearch) setSearchParams({}, { replace: true });
  };

  const activeCount = [filters.search, filters.type, filters.category, filters.paymentMethod, filters.period.preset !== 'all' && 'period'].filter(Boolean).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      await transactionService.exportCsv(queryParams); // exports whatever the filters currently match
      toast.success('CSV exported successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not export transactions.'));
    } finally {
      setExporting(false);
    }
  };

  const { transactions, pagination, loading, error } = state;
  const noResults = !loading && !error && transactions.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="muted">Search, filter and manage everything you’ve recorded.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={handleExport} disabled={exporting}>
            <Icon name="download" size={18} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={18} /> Add Transaction</button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={updateFilters} onReset={resetFilters} activeCount={activeCount} />

      <section className="card section tx-section">
        <div className="tx-toolbar">
          <span className="muted small">{pagination ? `${pagination.total} transaction${pagination.total === 1 ? '' : 's'}` : ' '}</span>
          <label className="sort-select">
            <span className="muted small">Sort by</span>
            <select className="select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        {error && <EmptyState tone="error" icon="alert" title="Couldn’t load transactions" message={error} actionLabel="Try again" onAction={refresh} />}
        {loading && transactions.length === 0 && !error && <RowsSkeleton rows={6} />}

        {noResults && activeCount === 0 && (
          <EmptyState title="No transactions yet" message="Start tracking your income and expenses by adding your first transaction." actionLabel="Add Transaction" onAction={openAdd} />
        )}
        {noResults && activeCount > 0 && (
          <EmptyState icon="search" title="No matching transactions" message="Try changing or clearing your filters." actionLabel="Reset filters" onAction={resetFilters} />
        )}

        {transactions.length > 0 && !error && (
          <div className={`tx-results ${loading ? 'is-refreshing' : ''}`}>
            {loading && <span className="refresh-spinner"><Spinner /></span>}
            <TransactionTable transactions={transactions} onEdit={openEdit} onDelete={askDelete} />
          </div>
        )}

        {pagination && !error && (
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        )}
      </section>
      {dialogs}
    </>
  );
}
