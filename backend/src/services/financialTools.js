// backend/src/services/financialTools.js
// Read-only financial query functions for SmartSpend AI.
// Each function receives (userId, params) – userId is ALWAYS from the verified JWT,
// never from Gemini or the frontend request body.
// All queries use parameterized SQL to prevent injection.
// All NUMERIC database values are converted to safe numbers at the service boundary.

const db = require('../db/pool');

const MAX_ROWS = 100;
const MAX_LIMIT = 50;
const VALID_GROUPINGS = ['daily', 'weekly', 'monthly'];

// ── helpers ─────────────────────────────────────────────────────────────────

function toNum(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function round2(val) {
  return Number(toNum(val).toFixed(2));
}

function validateDate(dateStr, fieldName) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid ${fieldName}: "${dateStr}"`);
  return dateStr;
}

function clampLimit(val, max = MAX_LIMIT) {
  const n = Math.floor(Number(val));
  if (isNaN(n) || n < 1) return 10;
  return Math.min(n, max);
}

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return {
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`,
  };
}

function previousMonthRange() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return {
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`,
  };
}

// ── Tool 1: getFinancialSummary ───────────────────────────────────────────────

async function getFinancialSummary(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;

  const { rows } = await db.query(
    `SELECT
       type,
       SUM(amount) AS total,
       COUNT(*)    AS tx_count
     FROM transactions
     WHERE user_id = $1
       AND transaction_date BETWEEN $2 AND $3
     GROUP BY type`,
    [userId, startDate, endDate]
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  let transactionCount = 0;

  for (const row of rows) {
    const val = toNum(row.total);
    const cnt = toNum(row.tx_count);
    if (row.type === 'income') {
      totalIncome += val;
    } else if (row.type === 'expense') {
      totalExpenses += val;
    }
    transactionCount += cnt;
  }

  totalIncome = round2(totalIncome);
  totalExpenses = round2(totalExpenses);
  const netBalance = round2(totalIncome - totalExpenses);

  return {
    totalIncome,
    totalExpenses,
    netBalance,
    transactionCount,
    startDate,
    endDate,
  };
}

// ── Tool 2: getCategoryBreakdown ─────────────────────────────────────────────

async function getCategoryBreakdown(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;

  const { rows } = await db.query(
    `SELECT
       c.name        AS category_name,
       SUM(t.amount) AS total_amount,
       COUNT(t.id)   AS tx_count
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date BETWEEN $2 AND $3
     GROUP BY c.name
     ORDER BY total_amount DESC
     LIMIT $4`,
    [userId, startDate, endDate, MAX_ROWS]
  );

  const grandTotal = rows.reduce((sum, r) => sum + toNum(r.total_amount), 0);

  return rows.map((r) => {
    const amt = round2(r.total_amount);
    const pct = grandTotal > 0 ? Number(((amt / grandTotal) * 100).toFixed(1)) : 0;
    return {
      categoryName: r.category_name,
      totalAmount: amt,
      percentage: pct,
      transactionCount: toNum(r.tx_count),
    };
  });
}

// ── Tool 3: getMonthlyComparison ─────────────────────────────────────────────

async function getMonthlyComparison(userId) {
  const curr = currentMonthRange();
  const prev = previousMonthRange();

  const query = `
    SELECT type, SUM(amount) AS total
    FROM transactions
    WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
    GROUP BY type`;

  const [currRows, prevRows] = await Promise.all([
    db.query(query, [userId, curr.startDate, curr.endDate]),
    db.query(query, [userId, prev.startDate, prev.endDate]),
  ]);

  const extract = (rows) => {
    let income = 0;
    let expenses = 0;
    for (const r of rows) {
      const val = toNum(r.total);
      if (r.type === 'income') income += val;
      if (r.type === 'expense') expenses += val;
    }
    return { income: round2(income), expenses: round2(expenses) };
  };

  const c = extract(currRows.rows);
  const p = extract(prevRows.rows);

  const pct = (currVal, prevVal) => {
    if (prevVal === 0) return currVal > 0 ? 100 : 0;
    return Number((((currVal - prevVal) / prevVal) * 100).toFixed(1));
  };

  return {
    currentMonthIncome:    c.income,
    currentMonthExpenses:  c.expenses,
    previousMonthIncome:   p.income,
    previousMonthExpenses: p.expenses,
    incomeChange:          round2(c.income - p.income),
    expenseChange:         round2(c.expenses - p.expenses),
    incomeChangePercent:   pct(c.income, p.income),
    expenseChangePercent:  pct(c.expenses, p.expenses),
    currentPeriod:         `${curr.startDate} to ${curr.endDate}`,
    previousPeriod:        `${prev.startDate} to ${prev.endDate}`,
  };
}

// ── Tool 4: getSpendingTrend ─────────────────────────────────────────────────

async function getSpendingTrend(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;
  const grouping  = VALID_GROUPINGS.includes(params.grouping) ? params.grouping : 'daily';

  let truncExpr;
  if (grouping === 'daily')   truncExpr = `transaction_date`;
  else if (grouping === 'weekly')  truncExpr = `DATE_TRUNC('week',  transaction_date)::DATE`;
  else                             truncExpr = `DATE_TRUNC('month', transaction_date)::DATE`;

  const { rows } = await db.query(
    `SELECT
       ${truncExpr} AS period,
       type,
       SUM(amount)  AS total
     FROM transactions
     WHERE user_id = $1
       AND transaction_date BETWEEN $2 AND $3
     GROUP BY period, type
     ORDER BY period ASC
     LIMIT $4`,
    [userId, startDate, endDate, MAX_ROWS]
  );

  const map = new Map();
  for (const r of rows) {
    const key = String(r.period);
    if (!map.has(key)) map.set(key, { period: key, income: 0, expenses: 0 });
    const entry = map.get(key);
    const val = toNum(r.total);
    if (r.type === 'income')  entry.income   = round2(entry.income + val);
    if (r.type === 'expense') entry.expenses = round2(entry.expenses + val);
  }

  return Array.from(map.values());
}

// ── Tool 5: getTopExpenses ───────────────────────────────────────────────────

async function getTopExpenses(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;
  const limit     = clampLimit(params.limit, 20);

  const { rows } = await db.query(
    `SELECT
       t.amount,
       t.transaction_date AS date,
       c.name             AS category,
       t.note             AS description,
       t.payment_method
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date BETWEEN $2 AND $3
     ORDER BY t.amount DESC
     LIMIT $4`,
    [userId, startDate, endDate, limit]
  );

  return rows.map((r) => ({
    amount: round2(r.amount),
    date: r.date,
    category: r.category,
    description: r.description,
    paymentMethod: r.payment_method,
  }));
}

// ── Tool 6: searchTransactions ───────────────────────────────────────────────

async function searchTransactions(userId, params = {}) {
  const range = currentMonthRange();

  const conditions = ['t.user_id = $1'];
  const values = [userId];
  let i = 2;

  const addParam = (cond, val) => {
    conditions.push(cond.replace('?', `$${i++}`));
    values.push(val);
  };

  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;
  addParam(`t.transaction_date >= ?`, startDate);
  addParam(`t.transaction_date <= ?`, endDate);

  if (params.transactionType === 'expense' || params.transactionType === 'income') {
    addParam(`t.type = ?`, params.transactionType);
  }
  if (params.category && typeof params.category === 'string') {
    addParam(`LOWER(c.name) LIKE LOWER(?)`, `%${params.category}%`);
  }
  if (params.minAmount != null && !isNaN(Number(params.minAmount))) {
    addParam(`t.amount >= ?`, Number(params.minAmount));
  }
  if (params.maxAmount != null && !isNaN(Number(params.maxAmount))) {
    addParam(`t.amount <= ?`, Number(params.maxAmount));
  }
  if (params.description && typeof params.description === 'string') {
    addParam(`LOWER(t.note) LIKE LOWER(?)`, `%${params.description}%`);
  }

  const limit = clampLimit(params.limit, MAX_LIMIT);

  const { rows } = await db.query(
    `SELECT
       t.id, t.amount, t.transaction_date AS date,
       t.type, c.name AS category, t.note AS description,
       t.payment_method, t.created_at
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT ${limit}`,
    values
  );

  return rows.map((r) => ({
    id: r.id,
    amount: round2(r.amount),
    date: r.date,
    type: r.type,
    category: r.category,
    description: r.description,
    paymentMethod: r.payment_method,
  }));
}

// ── Tool 7: getPaymentMethodBreakdown ────────────────────────────────────────

async function getPaymentMethodBreakdown(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;

  const { rows } = await db.query(
    `SELECT
       payment_method,
       SUM(amount) AS total_amount
     FROM transactions
     WHERE user_id = $1
       AND type = 'expense'
       AND transaction_date BETWEEN $2 AND $3
     GROUP BY payment_method
     ORDER BY total_amount DESC`,
    [userId, startDate, endDate]
  );

  const grandTotal = rows.reduce((sum, r) => sum + toNum(r.total_amount), 0);
  return rows.map((r) => {
    const amt = round2(r.total_amount);
    const pct = grandTotal > 0 ? Number(((amt / grandTotal) * 100).toFixed(1)) : 0;
    return {
      paymentMethod: r.payment_method,
      totalAmount: amt,
      percentage: pct,
    };
  });
}

// ── Tool 8: getAverageDailyExpense ───────────────────────────────────────────

async function getAverageDailyExpense(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;

  const { rows } = await db.query(
    `SELECT
       SUM(amount)                         AS total_expenses,
       COUNT(DISTINCT transaction_date)    AS days_with_spending,
       (DATE $2::date - DATE $3::date + 1) AS total_days
     FROM transactions
     WHERE user_id = $1
       AND type = 'expense'
       AND transaction_date BETWEEN $3 AND $2`,
    [userId, endDate, startDate]
  );

  const r = rows[0] || {};
  const totalExpenses = round2(r.total_expenses);
  const totalDays = Math.max(toNum(r.total_days, 1), 1);
  const avgDaily = round2(totalExpenses / totalDays);

  return {
    totalExpenses,
    numberOfDays: totalDays,
    averageDailyExpense: avgDaily,
    startDate,
    endDate,
  };
}

// ── Tool 9: getIncomeHistory ─────────────────────────────────────────────────

async function getIncomeHistory(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;
  const limit     = clampLimit(params.limit, MAX_LIMIT);

  const { rows } = await db.query(
    `SELECT
       t.amount, t.transaction_date AS date,
       c.name AS category, t.note AS description,
       t.payment_method
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'income'
       AND t.transaction_date BETWEEN $2 AND $3
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT $4`,
    [userId, startDate, endDate, limit]
  );

  const totalIncome = rows.reduce((sum, r) => sum + toNum(r.amount), 0);
  return {
    startDate,
    endDate,
    totalIncome: round2(totalIncome),
    transactionCount: rows.length,
    transactions: rows.map((r) => ({
      amount: round2(r.amount),
      date: r.date,
      category: r.category,
      description: r.description,
      paymentMethod: r.payment_method,
    })),
  };
}

// ── Tool 10: getExpenseHistory ───────────────────────────────────────────────

async function getExpenseHistory(userId, params = {}) {
  const range = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || range.startDate;
  const endDate   = validateDate(params.endDate,   'endDate')   || range.endDate;
  const limit     = clampLimit(params.limit, MAX_LIMIT);

  const { rows } = await db.query(
    `SELECT
       t.amount, t.transaction_date AS date,
       c.name AS category, t.note AS description,
       t.payment_method
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date BETWEEN $2 AND $3
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT $4`,
    [userId, startDate, endDate, limit]
  );

  const totalExpenses = rows.reduce((sum, r) => sum + toNum(r.amount), 0);
  return {
    startDate,
    endDate,
    totalExpenses: round2(totalExpenses),
    transactionCount: rows.length,
    transactions: rows.map((r) => ({
      amount: round2(r.amount),
      date: r.date,
      category: r.category,
      description: r.description,
      paymentMethod: r.payment_method,
    })),
  };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

const ALLOWED_TOOLS = {
  getFinancialSummary,
  getCategoryBreakdown,
  getMonthlyComparison,
  getSpendingTrend,
  getTopExpenses,
  searchTransactions,
  getPaymentMethodBreakdown,
  getAverageDailyExpense,
  getIncomeHistory,
  getExpenseHistory,
};

async function dispatch(toolName, userId, params) {
  if (!ALLOWED_TOOLS[toolName]) {
    throw new Error(`Unknown financial tool: "${toolName}"`);
  }
  if (!userId || typeof userId !== 'number') {
    throw new Error('Invalid user context.');
  }
  return ALLOWED_TOOLS[toolName](userId, params || {});
}

module.exports = { dispatch };
