const db = require('../db/pool');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { TRANSACTION_TYPES } = require('../utils/validation');
const { resolveRange, getPreviousPeriod, daysBetween, todayString } = require('../utils/dates');
const { toDto, TRANSACTION_COLUMNS } = require('./transactionController');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const percentChange = (current, previous) => (previous > 0 ? round2(((current - previous) / previous) * 100) : null);

// GET /api/dashboard/summary?startDate=&endDate=
const summary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = resolveRange(req.query);

  const { rows } = await db.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)  AS total_income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS total_expense,
       COUNT(*)::int AS transaction_count
     FROM transactions
     WHERE user_id = $1
       AND transaction_date BETWEEN $2 AND $3`,
    [req.user.id, startDate, endDate]
  );

  const totalIncome = round2(rows[0].total_income);
  const totalExpense = round2(rows[0].total_expense);

  // Average daily expense: if the range runs into the future (e.g. current month), only count elapsed days.
  const today = todayString();
  const effectiveEnd = endDate > today ? (today < startDate ? startDate : today) : endDate;
  const days = daysBetween(startDate, effectiveEnd);

  res.json({
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    balance: round2(totalIncome - totalExpense),
    avgDailyExpense: round2(totalExpense / days),
    days,
    transactionCount: rows[0].transaction_count,
  });
});

// GET /api/dashboard/category-breakdown?startDate=&endDate=&type=expense
const categoryBreakdown = asyncHandler(async (req, res) => {
  const { startDate, endDate } = resolveRange(req.query);
  const type = req.query.type || 'expense';
  if (!TRANSACTION_TYPES.includes(type)) throw new HttpError(400, 'Invalid type.');

  const { rows } = await db.query(
    `SELECT c.id, c.name, SUM(t.amount) AS total, COUNT(*)::int AS transaction_count
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1
       AND t.type = $2
       AND t.transaction_date BETWEEN $3 AND $4
     GROUP BY c.id, c.name
     ORDER BY total DESC`,
    [req.user.id, type, startDate, endDate]
  );

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  res.json({
    type,
    total: round2(grandTotal),
    categories: rows.map((r) => ({
      id: r.id,
      name: r.name,
      total: round2(r.total),
      transactionCount: r.transaction_count,
      percentage: grandTotal > 0 ? round2((r.total / grandTotal) * 100) : 0,
    })),
  });
});

// GET /api/dashboard/trend?startDate=&endDate=
// generate_series creates one row per day so days without transactions appear as 0 on the chart.
const trend = asyncHandler(async (req, res) => {
  const { startDate, endDate } = resolveRange(req.query);

  const { rows } = await db.query(
    `SELECT
       to_char(d.day, 'YYYY-MM-DD') AS date,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0)  AS income,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expense
     FROM generate_series($2::date, $3::date, INTERVAL '1 day') AS d(day)
     LEFT JOIN transactions t
       ON t.transaction_date = d.day::date
      AND t.user_id = $1
     GROUP BY d.day
     ORDER BY d.day`,
    [req.user.id, startDate, endDate]
  );

  res.json({
    startDate,
    endDate,
    points: rows.map((r) => ({ date: r.date, income: round2(r.income), expense: round2(r.expense) })),
  });
});

// GET /api/dashboard/month-comparison?startDate=&endDate=
// Compares expenses of the selected period with the period just before it.
const monthComparison = asyncHandler(async (req, res) => {
  const { startDate, endDate } = resolveRange(req.query);
  const previous = getPreviousPeriod(startDate, endDate);

  const totals = await db.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE transaction_date BETWEEN $2::date AND $3::date), 0) AS current_total,
       COALESCE(SUM(amount) FILTER (WHERE transaction_date BETWEEN $4::date AND $5::date), 0) AS previous_total
     FROM transactions
     WHERE user_id = $1
       AND type = 'expense'
       AND transaction_date BETWEEN $4::date AND $3::date`,
    [req.user.id, startDate, endDate, previous.startDate, previous.endDate]
  );

  const categories = await db.query(
    `SELECT c.name,
       COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_date BETWEEN $2::date AND $3::date), 0) AS current_total,
       COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_date BETWEEN $4::date AND $5::date), 0) AS previous_total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date BETWEEN $4::date AND $3::date
     GROUP BY c.id, c.name
     ORDER BY current_total DESC, previous_total DESC`,
    [req.user.id, startDate, endDate, previous.startDate, previous.endDate]
  );

  const currentTotal = round2(totals.rows[0].current_total);
  const previousTotal = round2(totals.rows[0].previous_total);

  res.json({
    comparisonLabel: previous.label,
    current: { startDate, endDate, total: currentTotal },
    previous: { startDate: previous.startDate, endDate: previous.endDate, total: previousTotal },
    changePercent: percentChange(currentTotal, previousTotal),
    categories: categories.rows.map((r) => ({
      name: r.name,
      current: round2(r.current_total),
      previous: round2(r.previous_total),
      changePercent: percentChange(r.current_total, r.previous_total),
    })),
  });
});

// GET /api/dashboard/top-expenses?startDate=&endDate=&limit=5
const topExpenses = asyncHandler(async (req, res) => {
  const { startDate, endDate } = resolveRange(req.query);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);

  const { rows } = await db.query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.transaction_date BETWEEN $2 AND $3
     ORDER BY t.amount DESC, t.transaction_date DESC
     LIMIT $4`,
    [req.user.id, startDate, endDate, limit]
  );
  res.json({ expenses: rows.map(toDto) });
});

module.exports = { summary, categoryBreakdown, trend, monthComparison, topExpenses };
