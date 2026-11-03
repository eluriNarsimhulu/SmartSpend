import { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboardService';
import { getErrorMessage } from '../services/api';

// Loads all analytics for a date range in parallel. Re-runs when the range or refreshKey changes.
export default function useDashboardData({ startDate, endDate }, refreshKey = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const range = { startDate, endDate };

    Promise.all([
      dashboardService.summary(range),
      dashboardService.categoryBreakdown(range),
      dashboardService.trend(range),
      dashboardService.monthComparison(range),
      dashboardService.topExpenses(range),
    ])
      .then(([summary, breakdown, trend, comparison, top]) => {
        if (cancelled) return;
        setState({ data: { summary, breakdown, trend, comparison, topExpenses: top.expenses }, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: getErrorMessage(err, 'Could not load your data.') });
      });

    return () => {
      cancelled = true; // ignore results from outdated requests
    };
  }, [startDate, endDate, refreshKey]);

  return state;
}
