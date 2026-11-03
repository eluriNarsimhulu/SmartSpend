const HttpError = require('../utils/HttpError');
const { TRANSACTION_TYPES, PAYMENT_METHODS, isValidDate } = require('../utils/validation');

// Escape % and _ so user text is matched literally inside ILIKE.
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// Builds the WHERE clause for the transaction list and the CSV export.
// Every value goes into the params array and is referenced as $1, $2, ... (parameterized SQL);
// user input is never concatenated into the SQL text.
function buildTransactionFilters(userId, query) {
  const params = [userId];
  const conditions = ['t.user_id = $1']; // data isolation: always scoped to the logged-in user

  const add = (sqlTemplate, value) => {
    params.push(value);
    conditions.push(sqlTemplate.split('?').join(`$${params.length}`));
  };

  if (query.type) {
    if (!TRANSACTION_TYPES.includes(query.type)) throw new HttpError(400, 'Invalid type filter.');
    add('t.type = ?', query.type);
  }
  if (query.category) add('LOWER(c.name) = LOWER(?)', String(query.category));
  if (query.categoryId) {
    const id = Number(query.categoryId);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid categoryId filter.');
    add('t.category_id = ?', id);
  }
  if (query.paymentMethod) {
    if (!PAYMENT_METHODS.includes(query.paymentMethod)) throw new HttpError(400, 'Invalid payment method filter.');
    add('t.payment_method = ?', query.paymentMethod);
  }
  if (query.startDate) {
    if (!isValidDate(query.startDate)) throw new HttpError(400, 'startDate must be YYYY-MM-DD.');
    add('t.transaction_date >= ?', query.startDate);
  }
  if (query.endDate) {
    if (!isValidDate(query.endDate)) throw new HttpError(400, 'endDate must be YYYY-MM-DD.');
    add('t.transaction_date <= ?', query.endDate);
  }
  if (query.minAmount !== undefined && query.minAmount !== '') {
    const min = Number(query.minAmount);
    if (!Number.isFinite(min) || min < 0) throw new HttpError(400, 'Invalid minAmount filter.');
    add('t.amount >= ?', min);
  }
  if (query.maxAmount !== undefined && query.maxAmount !== '') {
    const max = Number(query.maxAmount);
    if (!Number.isFinite(max) || max < 0) throw new HttpError(400, 'Invalid maxAmount filter.');
    add('t.amount <= ?', max);
  }
  if (query.search && String(query.search).trim()) {
    const pattern = `%${escapeLike(String(query.search).trim().slice(0, 100))}%`;
    add('(t.note ILIKE ? OR c.name ILIKE ? OR t.payment_method ILIKE ?)', pattern);
  }

  return { where: conditions.join(' AND '), params };
}

module.exports = { buildTransactionFilters };
