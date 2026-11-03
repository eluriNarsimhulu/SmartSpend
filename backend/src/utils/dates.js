// All date math uses UTC on 'YYYY-MM-DD' strings so server timezone never shifts a day.
const HttpError = require('./HttpError');
const { isValidDate } = require('./validation');

const MAX_RANGE_DAYS = 731;

const toDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toStr = (date) => date.toISOString().slice(0, 10);

function addDays(str, days) {
  const date = toDate(str);
  date.setUTCDate(date.getUTCDate() + days);
  return toStr(date);
}

// Inclusive number of days between two dates.
function daysBetween(start, end) {
  return Math.round((toDate(end) - toDate(start)) / 86400000) + 1;
}

function todayString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function lastDayOfMonth(str) {
  const [y, m] = str.split('-').map(Number);
  return toStr(new Date(Date.UTC(y, m, 0)));
}

function isFullMonth(start, end) {
  return start.endsWith('-01') && end === lastDayOfMonth(start);
}

// Reads ?startDate=&endDate= from the query. Defaults to the current month.
function resolveRange(query) {
  const { startDate, endDate } = query;

  if (!startDate && !endDate) {
    const today = todayString();
    const start = `${today.slice(0, 7)}-01`;
    return { startDate: start, endDate: lastDayOfMonth(start) };
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new HttpError(400, 'startDate and endDate must both be valid dates in YYYY-MM-DD format.');
  }
  if (startDate > endDate) throw new HttpError(400, 'startDate must not be after endDate.');
  if (daysBetween(startDate, endDate) > MAX_RANGE_DAYS) {
    throw new HttpError(400, 'Date range is too large (maximum 2 years).');
  }
  return { startDate, endDate };
}

// Previous period: the previous calendar month for a full month, otherwise the
// same number of days immediately before the selected range.
function getPreviousPeriod(start, end) {
  const prevEnd = addDays(start, -1);
  if (isFullMonth(start, end)) {
    return { startDate: `${prevEnd.slice(0, 7)}-01`, endDate: prevEnd, label: 'last month' };
  }
  const length = daysBetween(start, end);
  return { startDate: addDays(prevEnd, -(length - 1)), endDate: prevEnd, label: 'previous period' };
}

module.exports = { resolveRange, getPreviousPeriod, daysBetween, todayString, addDays };
