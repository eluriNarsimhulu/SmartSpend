import api from './api';

// Removes empty filter values so they are not sent as ?search=&type=
const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const transactionService = {
  list: (params) => api.get('/transactions', { params: clean(params) }).then((r) => r.data),
  create: (payload) => api.post('/transactions', payload).then((r) => r.data.transaction),
  update: (id, payload) => api.put(`/transactions/${id}`, payload).then((r) => r.data.transaction),
  remove: (id) => api.delete(`/transactions/${id}`).then((r) => r.data),

  // Downloads the CSV through Axios (so the Authorization header is sent) and saves it in the browser.
  async exportCsv(params) {
    const response = await api.get('/transactions/export', { params: clean(params), responseType: 'blob' });
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'smartspend-transactions.csv';

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
