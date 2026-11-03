import api from './api';

const get = (path, params) => api.get(`/dashboard/${path}`, { params }).then((r) => r.data);

export const dashboardService = {
  summary: (range) => get('summary', range),
  categoryBreakdown: (range) => get('category-breakdown', range),
  trend: (range) => get('trend', range),
  monthComparison: (range) => get('month-comparison', range),
  topExpenses: (range) => get('top-expenses', { ...range, limit: 5 }),
};
