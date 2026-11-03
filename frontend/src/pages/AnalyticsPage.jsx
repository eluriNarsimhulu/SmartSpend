import { useCallback, useState } from 'react';
import PeriodSelector from '../components/PeriodSelector';
import SummaryCard from '../components/SummaryCard';
import SpendingTrendChart from '../components/SpendingTrendChart';
import CategoryChart from '../components/CategoryChart';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import MonthComparison from '../components/MonthComparison';
import TopExpenses from '../components/TopExpenses';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, RowsSkeleton, SummarySkeleton } from '../components/LoadingState';
import useDashboardData from '../hooks/useDashboardData';
import { makePeriod } from '../utils/dates';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/format';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(() => makePeriod('this_month'));
  const [refreshKey, setRefreshKey] = useState(0);
  const retry = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { data, loading, error } = useDashboardData(period, refreshKey);

  const summary = data?.summary;
  const hasData = summary && summary.transactionCount > 0;
  const biggest = data?.breakdown.categories[0];

  let subtitle = '';
  if (summary) {
    const isMonth = period.preset === 'this_month' || period.preset === 'last_month';
    subtitle = isMonth ? formatMonthYear(summary.startDate) : `${formatDate(summary.startDate)} – ${formatDate(summary.endDate)}`;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="muted">{subtitle || 'Understand your spending patterns'}</p>
        </div>
        <div className="page-actions">
          <PeriodSelector period={period} onChange={setPeriod} />
        </div>
      </div>

      {error && <EmptyState tone="error" icon="alert" title="Couldn’t load analytics" message={error} actionLabel="Try again" onAction={retry} />}

      {!error && !loading && !hasData && (
        <div className="card section">
          <EmptyState icon="analytics" title="No data for this period" message="Pick a different date range, or add transactions to see your analytics." />
        </div>
      )}

      {!error && (loading || hasData) && (
        <>
          <section className="grid grid-3" aria-label="Summary">
            {loading ? (
              Array.from({ length: 3 }, (_, i) => <SummarySkeleton key={i} />)
            ) : (
              <>
                <SummaryCard label="Total Spent" value={formatCurrency(summary.totalExpense)} icon="arrowUp" tone="expense" />
                <SummaryCard label="Average Daily Spending" value={formatCurrency(summary.avgDailyExpense)} icon="calendar" tone="neutral" hint={`over ${summary.days} day${summary.days === 1 ? '' : 's'}`} />
                <SummaryCard label="Biggest Category" value={biggest ? biggest.name : '—'} icon="tag" tone="balance" hint={biggest ? `${formatCurrency(biggest.total)} · ${biggest.percentage}% of spending` : 'No expenses yet'} />
              </>
            )}
          </section>

          <section className="card section">
            <h2 className="card-title">Spending trend</h2>
            {loading ? <CardSkeleton height={240} /> : <SpendingTrendChart points={data.trend.points} variant="bars" />}
          </section>

          <section className="grid grid-2 section">
            <div className="card">
              <h2 className="card-title">Spending by category</h2>
              {loading ? <RowsSkeleton rows={4} /> : data.breakdown.categories.length === 0 ? <p className="muted">No expenses in this period.</p> : <CategoryChart categories={data.breakdown.categories} />}
            </div>
            <div className="card">
              <h2 className="card-title">Income vs expenses</h2>
              {loading ? <RowsSkeleton rows={4} /> : <IncomeExpenseChart income={summary.totalIncome} expense={summary.totalExpense} balance={summary.balance} />}
            </div>
          </section>

          <section className="grid grid-2 section">
            <div className="card">
              <h2 className="card-title">Month-over-month comparison</h2>
              {loading ? <RowsSkeleton rows={4} /> : <MonthComparison data={data.comparison} />}
            </div>
            <div className="card">
              <h2 className="card-title">Top expenses</h2>
              {loading ? <RowsSkeleton rows={4} /> : <TopExpenses expenses={data.topExpenses} />}
            </div>
          </section>
        </>
      )}
    </>
  );
}
