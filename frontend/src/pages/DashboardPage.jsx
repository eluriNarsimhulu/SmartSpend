import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import PeriodSelector from '../components/PeriodSelector';
import SummaryCard from '../components/SummaryCard';
import SpendingTrendChart from '../components/SpendingTrendChart';
import CategoryChart from '../components/CategoryChart';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import MonthComparison from '../components/MonthComparison';
import TopExpenses from '../components/TopExpenses';
import TransactionTable from '../components/TransactionTable';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, RowsSkeleton, SummarySkeleton } from '../components/LoadingState';
import useDashboardData from '../hooks/useDashboardData';
import useTransactionDialogs from '../hooks/useTransactionDialogs';
import { transactionService } from '../services/transactionService';
import { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { makePeriod } from '../utils/dates';
import { formatCurrency, formatDate } from '../utils/format';

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(() => makePeriod('this_month'));
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const { data, loading, error } = useDashboardData(period, refreshKey);
  const { openAdd, openEdit, askDelete, dialogs } = useTransactionDialogs({ onChanged: refresh });

  // Recent transactions (the 5 newest in the selected period)
  const [recent, setRecent] = useState({ items: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    setRecent((r) => ({ ...r, loading: true }));
    transactionService
      .list({ page: 1, limit: 5, startDate: period.startDate, endDate: period.endDate })
      .then((res) => !cancelled && setRecent({ items: res.transactions, loading: false }))
      .catch(() => !cancelled && setRecent({ items: [], loading: false }));
    return () => { cancelled = true; };
  }, [period.startDate, period.endDate, refreshKey]);

  const summary = data?.summary;
  const hasData = summary && summary.transactionCount > 0;
  const rangeText = summary ? `${formatDate(summary.startDate)} – ${formatDate(summary.endDate)}` : '';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Hello, {user?.name?.split(' ')[0]}</h1>
          <p className="muted">{rangeText || 'Your money at a glance'}</p>
        </div>
        <div className="page-actions">
          <PeriodSelector period={period} onChange={setPeriod} />
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={18} /> Add Transaction</button>
        </div>
      </div>

      {error && <EmptyState tone="error" icon="alert" title="Couldn’t load your dashboard" message={error} actionLabel="Try again" onAction={refresh} />}

      {!error && (
        <>
          <section className="grid grid-4" aria-label="Summary">
            {loading || !summary ? (
              Array.from({ length: 4 }, (_, i) => <SummarySkeleton key={i} />)
            ) : (
              <>
                <SummaryCard label="Total Income" value={formatCurrency(summary.totalIncome)} icon="arrowDown" tone="income" />
                <SummaryCard label="Total Expense" value={formatCurrency(summary.totalExpense)} icon="arrowUp" tone="expense" />
                <SummaryCard label="Remaining Balance" value={formatCurrency(summary.balance)} icon="wallet" tone={summary.balance < 0 ? 'negative' : 'balance'} />
                <SummaryCard label="Avg Daily Expense" value={formatCurrency(summary.avgDailyExpense)} icon="calendar" tone="neutral" hint={`over ${summary.days} day${summary.days === 1 ? '' : 's'}`} />
              </>
            )}
          </section>

          {!loading && !hasData ? (
            <div className="card section">
              <EmptyState
                title="No transactions yet"
                message="Start tracking your income and expenses by adding your first transaction."
                actionLabel="Add Transaction"
                onAction={openAdd}
              />
            </div>
          ) : (
            <>
              <section className="card section">
                <h2 className="card-title">Spending trend</h2>
                {loading ? <CardSkeleton height={240} /> : <SpendingTrendChart points={data.trend.points} />}
              </section>

              <section className="grid grid-2 section">
                <div className="card">
                  <h2 className="card-title">Spending by category</h2>
                  {loading ? <RowsSkeleton rows={4} /> : data.breakdown.categories.length === 0 ? <p className="muted">No expenses in this period.</p> : <CategoryChart categories={data.breakdown.categories} />}
                </div>
                <div className="card">
                  <h2 className="card-title">Income vs expense</h2>
                  {loading ? <RowsSkeleton rows={4} /> : <IncomeExpenseChart income={summary.totalIncome} expense={summary.totalExpense} balance={summary.balance} />}
                </div>
              </section>

              <section className="grid grid-2 section">
                <div className="card">
                  <h2 className="card-title">Compared with {data?.comparison?.comparisonLabel || 'last month'}</h2>
                  {loading ? <RowsSkeleton rows={4} /> : <MonthComparison data={data.comparison} />}
                </div>
                <div className="card">
                  <h2 className="card-title">Largest expenses</h2>
                  {loading ? <RowsSkeleton rows={4} /> : <TopExpenses expenses={data.topExpenses} />}
                </div>
              </section>

              <section className="card section">
                <div className="card-title-row">
                  <h2 className="card-title">Recent transactions</h2>
                  <Link to="/transactions" className="link">View all</Link>
                </div>
                {recent.loading ? <RowsSkeleton rows={3} /> : recent.items.length === 0 ? (
                  <p className="muted">No transactions in this period.</p>
                ) : (
                  <TransactionTable transactions={recent.items} onEdit={openEdit} onDelete={askDelete} selectable={false} />
                )}
              </section>
            </>
          )}
        </>
      )}
      {dialogs}
    </>
  );
}
