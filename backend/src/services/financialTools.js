
// backend/src/services/financialTools.js
// SmartSpend AI financial tools.
// All data comes from PostgreSQL and is scoped to the authenticated user.
// Gemini never supplies a user ID and never executes SQL.

const db = require('../db/pool');
const env = require('../config/env');

const MAX_ROWS = 100;
const MAX_LIMIT = 50;
const VALID_GROUPINGS = ['daily', 'weekly', 'monthly'];

function toNum(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round2(value) {
  return Math.round((toNum(value) + Number.EPSILON) * 100) / 100;
}

function clampLimit(value, max = MAX_LIMIT) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 1) return 10;
  return Math.min(number, max);
}

// Format a date in the application's configured timezone.
function dateInTimezone(date = new Date()) {
  const timezone = env.appTimezone || 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function validateDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;

  if (!isValidDateString(value)) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date.`);
  }

  return value;
}

function currentMonthRange() {
  const today = dateInTimezone();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    startDate: `${today.slice(0, 7)}-01`,
    endDate: `${today.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`,
  };
}

function previousMonthRange() {
  const current = currentMonthRange();
  const [year, month] = current.startDate.split('-').map(Number);
  const previousEnd = new Date(Date.UTC(year, month - 1, 0));
  const y = previousEnd.getUTCFullYear();
  const m = String(previousEnd.getUTCMonth() + 1).padStart(2, '0');
  const d = String(previousEnd.getUTCDate()).padStart(2, '0');

  return {
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${d}`,
  };
}

function resolveRange(params = {}) {
  const defaultRange = currentMonthRange();
  const startDate = validateDate(params.startDate, 'startDate') || defaultRange.startDate;
  const endDate = validateDate(params.endDate, 'endDate') || defaultRange.endDate;

  if (startDate > endDate) {
    throw new Error('startDate cannot be later than endDate.');
  }

  return { startDate, endDate };
}

// ── 1. Financial summary ─────────────────────────────────────────────────────

async function getFinancialSummary(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);

  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int AS transaction_count,
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS total_income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS total_expenses
     FROM transactions
     WHERE user_id = $1
       AND transaction_date >= $2::date
       AND transaction_date <= $3::date`,
    [userId, startDate, endDate]
  );

  const row = rows[0] || {};

  const totalIncome = round2(row.total_income);
  const totalExpenses = round2(row.total_expenses);

  return {
    startDate,
    endDate,
    transactionCount: toNum(row.transaction_count),
    totalIncome,
    totalExpenses,
    netBalance: round2(totalIncome - totalExpenses),
  };
}

// ── 2. Category breakdown ───────────────────────────────────────────────────

async function getCategoryBreakdown(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);

  const { rows } = await db.query(
    `SELECT
       c.name AS category_name,
       COALESCE(SUM(t.amount), 0) AS total_amount,
       COUNT(t.id)::int AS transaction_count
     FROM transactions t
     INNER JOIN categories c
       ON c.id = t.category_id
      AND c.user_id = t.user_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date >= $2::date
       AND t.transaction_date <= $3::date
     GROUP BY c.name
     ORDER BY SUM(t.amount) DESC`,
    [userId, startDate, endDate]
  );

  const grandTotal = rows.reduce(
    (sum, row) => sum + toNum(row.total_amount),
    0
  );

  return rows.map((row) => {
    const totalAmount = round2(row.total_amount);

    return {
      categoryName: row.category_name,
      totalAmount,
      percentage: grandTotal > 0
        ? Number(((totalAmount / grandTotal) * 100).toFixed(1))
        : 0,
      transactionCount: toNum(row.transaction_count),
    };
  });
}

// ── 3. Monthly comparison ───────────────────────────────────────────────────

async function getMonthlyComparison(userId) {
  const current = currentMonthRange();
  const previous = previousMonthRange();

  const sql = `
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expenses
    FROM transactions
    WHERE user_id = $1
      AND transaction_date >= $2::date
      AND transaction_date <= $3::date
  `;

  const [currentResult, previousResult] = await Promise.all([
    db.query(sql, [userId, current.startDate, current.endDate]),
    db.query(sql, [userId, previous.startDate, previous.endDate]),
  ]);

  const c = currentResult.rows[0];
  const p = previousResult.rows[0];

  const currentIncome = round2(c.income);
  const currentExpenses = round2(c.expenses);
  const previousIncome = round2(p.income);
  const previousExpenses = round2(p.expenses);

  const percentageChange = (now, before) => {
    if (before === 0) return now === 0 ? 0 : null;
    return Number((((now - before) / before) * 100).toFixed(1));
  };

  return {
    currentPeriod: current,
    previousPeriod: previous,
    currentMonthIncome: currentIncome,
    currentMonthExpenses: currentExpenses,
    previousMonthIncome: previousIncome,
    previousMonthExpenses: previousExpenses,
    incomeChange: round2(currentIncome - previousIncome),
    expenseChange: round2(currentExpenses - previousExpenses),
    incomeChangePercent: percentageChange(currentIncome, previousIncome),
    expenseChangePercent: percentageChange(currentExpenses, previousExpenses),
  };
}

// ── 4. Spending trend ────────────────────────────────────────────────────────

async function getSpendingTrend(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);
  const grouping = VALID_GROUPINGS.includes(params.grouping)
    ? params.grouping
    : 'daily';

  const periodExpression = {
    daily: 'transaction_date',
    weekly: "DATE_TRUNC('week', transaction_date)::date",
    monthly: "DATE_TRUNC('month', transaction_date)::date",
  }[grouping];

  const { rows } = await db.query(
    `SELECT
       ${periodExpression} AS period,
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expenses
     FROM transactions
     WHERE user_id = $1
       AND transaction_date >= $2::date
       AND transaction_date <= $3::date
     GROUP BY period
     ORDER BY period
     LIMIT $4`,
    [userId, startDate, endDate, MAX_ROWS]
  );

  return rows.map((row) => ({
    period: String(row.period).slice(0, 10),
    income: round2(row.income),
    expenses: round2(row.expenses),
  }));
}

// ── 5. Top expenses ─────────────────────────────────────────────────────────

async function getTopExpenses(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);
  const limit = clampLimit(params.limit, 20);

  const { rows } = await db.query(
    `SELECT
       t.amount,
       t.transaction_date AS date,
       c.name AS category,
       t.note AS description,
       t.payment_method
     FROM transactions t
     INNER JOIN categories c
       ON c.id = t.category_id
      AND c.user_id = t.user_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date >= $2::date
       AND t.transaction_date <= $3::date
     ORDER BY t.amount DESC, t.transaction_date DESC
     LIMIT $4`,
    [userId, startDate, endDate, limit]
  );

  return rows.map((row) => ({
    amount: round2(row.amount),
    date: String(row.date).slice(0, 10),
    category: row.category,
    description: row.description,
    paymentMethod: row.payment_method,
  }));
}

// ── 6. Search transactions ──────────────────────────────────────────────────

async function searchTransactions(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);
  const conditions = [
    't.user_id = $1',
    't.transaction_date >= $2::date',
    't.transaction_date <= $3::date',
  ];
  const values = [userId, startDate, endDate];

  const add = (condition, value) => {
    values.push(value);
    conditions.push(condition.replace('?', `$${values.length}`));
  };

  if (params.transactionType) {
    if (!['income', 'expense'].includes(params.transactionType)) {
      throw new Error('Invalid transactionType.');
    }
    add('t.type = ?', params.transactionType);
  }

  if (params.category) {
    add('LOWER(c.name) = LOWER(?)', String(params.category).slice(0, 50));
  }

  if (params.minAmount !== undefined) {
    const min = Number(params.minAmount);
    if (!Number.isFinite(min) || min < 0) throw new Error('Invalid minAmount.');
    add('t.amount >= ?', min);
  }

  if (params.maxAmount !== undefined) {
    const max = Number(params.maxAmount);
    if (!Number.isFinite(max) || max < 0) throw new Error('Invalid maxAmount.');
    add('t.amount <= ?', max);
  }

  if (params.description) {
    add('t.note ILIKE ?', `%${String(params.description).slice(0, 80)}%`);
  }

  const limit = clampLimit(params.limit);

  const { rows } = await db.query(
    `SELECT
       t.id, t.amount, t.transaction_date AS date,
       t.type, c.name AS category, t.note AS description,
       t.payment_method
     FROM transactions t
     INNER JOIN categories c
       ON c.id = t.category_id
      AND c.user_id = t.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT ${limit}`,
    values
  );

  return rows.map((row) => ({
    id: row.id,
    amount: round2(row.amount),
    date: String(row.date).slice(0, 10),
    type: row.type,
    category: row.category,
    description: row.description,
    paymentMethod: row.payment_method,
  }));
}

// ── 7. Payment method breakdown ─────────────────────────────────────────────

async function getPaymentMethodBreakdown(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);

  const { rows } = await db.query(
    `SELECT
       payment_method,
       COALESCE(SUM(amount), 0) AS total_amount
     FROM transactions
     WHERE user_id = $1
       AND type = 'expense'
       AND transaction_date >= $2::date
       AND transaction_date <= $3::date
     GROUP BY payment_method
     ORDER BY SUM(amount) DESC`,
    [userId, startDate, endDate]
  );

  const grandTotal = rows.reduce(
    (sum, row) => sum + toNum(row.total_amount),
    0
  );

  return rows.map((row) => {
    const totalAmount = round2(row.total_amount);
    return {
      paymentMethod: row.payment_method,
      totalAmount,
      percentage: grandTotal > 0
        ? Number(((totalAmount / grandTotal) * 100).toFixed(1))
        : 0,
    };
  });
}

// ── 8. Average daily expense ─────────────────────────────────────────────────

async function getAverageDailyExpense(userId, params = {}) {
  const { startDate, endDate } = resolveRange(params);

  const { rows } = await db.query(
    `SELECT
       COALESCE(SUM(amount), 0) AS total_expenses,
       COUNT(DISTINCT transaction_date)::int AS days_with_spending
     FROM transactions
     WHERE user_id = $1
       AND type = 'expense'
       AND transaction_date >= $2::date
       AND transaction_date <= $3::date`,
    [userId, startDate, endDate]
  );

  const totalExpenses = round2(rows[0].total_expenses);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const numberOfDays = Math.max(
    Math.round((end - start) / 86400000) + 1,
    1
  );

  return {
    startDate,
    endDate,
    totalExpenses,
    daysWithSpending: toNum(rows[0].days_with_spending),
    numberOfDays,
    averageDailyExpense: round2(totalExpenses / numberOfDays),
  };
}

// ── 9. Income history ────────────────────────────────────────────────────────

async function getIncomeHistory(userId, params = {}) {
  return getTransactionHistory(userId, params, 'income');
}

// ── 10. Expense history ──────────────────────────────────────────────────────

async function getExpenseHistory(userId, params = {}) {
  return getTransactionHistory(userId, params, 'expense');
}

async function getTransactionHistory(userId, params, type) {
  const { startDate, endDate } = resolveRange(params);
  const limit = clampLimit(params.limit);

  const { rows } = await db.query(
    `SELECT
       t.amount, t.transaction_date AS date,
       c.name AS category, t.note AS description,
       t.payment_method
     FROM transactions t
     INNER JOIN categories c
       ON c.id = t.category_id
      AND c.user_id = t.user_id
     WHERE t.user_id = $1
       AND t.type = $2
       AND t.transaction_date >= $3::date
       AND t.transaction_date <= $4::date
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT $5`,
    [userId, type, startDate, endDate, limit]
  );

  const total = rows.reduce((sum, row) => sum + toNum(row.amount), 0);

  return {
    startDate,
    endDate,
    ...(type === 'income'
      ? { totalIncome: round2(total) }
      : { totalExpenses: round2(total) }),
    transactionCount: rows.length,
    transactions: rows.map((row) => ({
      amount: round2(row.amount),
      date: String(row.date).slice(0, 10),
      category: row.category,
      description: row.description,
      paymentMethod: row.payment_method,
    })),
  };
}

// ── Deterministic personal-question detection ────────────────────────────────

function isPersonalFinanceQuestion(message) {
  const text = String(message || '').toLowerCase();

  // Explicit general-education questions should not fetch personal data.
  const generalOnlyPatterns = [
    /^explain\s+(the\s+)?(50\s*\/\s*30\s*\/\s*20|compound interest|emergency fund|inflation|mutual funds|stocks|bonds)\b/,
    /^what\s+is\s+(compound interest|an emergency fund|inflation|a mutual fund)\b/,
    /^define\s+/,
  ];

  if (generalOnlyPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  const personalPatterns = [
    /\b(my|mine|i spent|i spend|i earned|i earn|i received|i have)\b/,
    /\b(this month|last month|today|this week|last week|this year)\b/,
    /\b(spend|spending|expense|expenses|income|transactions|transaction|balance|saving|savings)\b/,
    /\b(category|categories|payment method|top expenses|biggest expense)\b/,
    /\b(analy[sz]e|analysis|compare|breakdown|where.*money|save more|reduce.*expense)\b/,
    /\b(financial activity|financial summary|money going)\b/,
  ];

  return personalPatterns.some((pattern) => pattern.test(text));
}

function isSavingsAdviceQuestion(message) {
  const text = String(message || '').toLowerCase();
  return /\b(save more|saving money|reduce.*(spend|expense)|cut.*(spend|expense)|where.*save|how.*save)\b/.test(text);
}

// ── Backend-generated context for personal questions ─────────────────────────

async function buildPersonalFinancialContext(userId, message) {
  if (!isPersonalFinanceQuestion(message)) {
    return null;
  }

  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error('Invalid authenticated user ID.');
  }

  const range = currentMonthRange();

  const [summary, categories] = await Promise.all([
    getFinancialSummary(Number(userId), range),
    getCategoryBreakdown(Number(userId), range),
  ]);

  const context = {
    period: range,
    transactionCount: summary.transactionCount,
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    netBalance: summary.netBalance,
    expenseCategories: categories,
  };

  if (isSavingsAdviceQuestion(message)) {
    const [topExpenses, comparison] = await Promise.all([
      getTopExpenses(Number(userId), { ...range, limit: 5 }),
      getMonthlyComparison(Number(userId)),
    ]);

    context.topExpenses = topExpenses;
    context.monthlyComparison = comparison;
  }

  return context;
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────

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

async function dispatch(toolName, userId, params = {}) {
  const tool = ALLOWED_TOOLS[toolName];

  if (!tool) {
    throw new Error(`Unknown financial tool: ${toolName}`);
  }

  const numericUserId = Number(userId);

  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new Error('Invalid authenticated user context.');
  }

  return tool(numericUserId, params);
}

module.exports = {
  dispatch,
  currentMonthRange,
  isPersonalFinanceQuestion,
  buildPersonalFinancialContext,
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
