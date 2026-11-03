const db = require('../db/pool');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { parseId, validateTransactionInput } = require('../utils/validation');
const { buildTransactionFilters } = require('../services/transactionFilters');

const TRANSACTION_COLUMNS = `
  t.id, t.type, t.amount, t.transaction_date, t.payment_method, t.note,
  t.category_id, c.name AS category_name`;

const toDto = (row) => ({
  id: row.id,
  type: row.type,
  amount: row.amount,
  date: row.transaction_date,
  paymentMethod: row.payment_method,
  note: row.note,
  categoryId: row.category_id,
  categoryName: row.category_name,
});

// Whitelisted sort options (column names are never taken directly from user input).
const SORT_COLUMNS = { date: 't.transaction_date', amount: 't.amount' };

async function findTransaction(id, userId) {
  const { rows } = await db.query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );
  return rows[0] ? toDto(rows[0]) : null;
}

// The category must belong to the same user AND match the transaction type.
async function assertCategoryAllowed(categoryId, type, userId) {
  const { rows } = await db.query(
    'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND type = $3',
    [categoryId, userId, type]
  );
  if (!rows[0]) {
    throw new HttpError(400, 'Validation failed.', { categoryId: `Choose one of your ${type} categories.` });
  }
}

const list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const sortColumn = SORT_COLUMNS[req.query.sortBy] || SORT_COLUMNS.date;
  const sortOrder = String(req.query.sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { where, params } = buildTransactionFilters(req.user.id, req.query);

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  const dataResult = await db.query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE ${where}
     ORDER BY ${sortColumn} ${sortOrder}, t.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  res.json({
    transactions: dataResult.rows.map(toDto),
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
});

const getOne = asyncHandler(async (req, res) => {
  const transaction = await findTransaction(parseId(req.params.id), req.user.id);
  if (!transaction) throw new HttpError(404, 'Transaction not found.');
  res.json({ transaction });
});

const create = asyncHandler(async (req, res) => {
  const input = validateTransactionInput(req.body);
  await assertCategoryAllowed(input.categoryId, input.type, req.user.id);

  const { rows } = await db.query(
    `INSERT INTO transactions (user_id, category_id, type, amount, transaction_date, payment_method, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [req.user.id, input.categoryId, input.type, input.amount, input.date, input.paymentMethod, input.note]
  );
  res.status(201).json({ transaction: await findTransaction(rows[0].id, req.user.id) });
});

const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const input = validateTransactionInput(req.body);
  await assertCategoryAllowed(input.categoryId, input.type, req.user.id);

  const { rows } = await db.query(
    `UPDATE transactions
     SET category_id = $1, type = $2, amount = $3, transaction_date = $4,
         payment_method = $5, note = $6, updated_at = NOW()
     WHERE id = $7 AND user_id = $8
     RETURNING id`,
    [input.categoryId, input.type, input.amount, input.date, input.paymentMethod, input.note, id, req.user.id]
  );
  if (!rows[0]) throw new HttpError(404, 'Transaction not found.');
  res.json({ transaction: await findTransaction(id, req.user.id) });
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { rowCount } = await db.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) throw new HttpError(404, 'Transaction not found.');
  res.json({ message: 'Transaction deleted.' });
});

// ---- CSV export -------------------------------------------------------------

// Quote fields containing commas/quotes/newlines, and neutralise spreadsheet formula injection.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const exportCsv = asyncHandler(async (req, res) => {
  const { where, params } = buildTransactionFilters(req.user.id, req.query);
  const { rows } = await db.query(
    `SELECT t.transaction_date, t.type, c.name AS category_name, t.payment_method, t.amount, t.note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE ${where}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT 100000`,
    params
  );

  const header = ['Date', 'Type', 'Category', 'Payment Method', 'Amount', 'Note'];
  const lines = rows.map((r) =>
    [r.transaction_date, r.type, r.category_name, r.payment_method, r.amount.toFixed(2), r.note].map(csvCell).join(',')
  );
  const csv = `\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`;

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="smartspend-transactions-${today}.csv"`);
  res.send(csv);
});

module.exports = { list, getOne, create, update, remove, exportCsv, toDto, TRANSACTION_COLUMNS };
