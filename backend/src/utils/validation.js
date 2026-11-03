const HttpError = require('./HttpError');

const TRANSACTION_TYPES = ['expense', 'income'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other'];
const MAX_AMOUNT = 9999999999.99; // NUMERIC(12,2)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 255 && EMAIL_REGEX.test(email);
}

// Accepts 'YYYY-MM-DD' and rejects impossible dates such as 2026-02-31.
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw new HttpError(400, 'Invalid id.');
  }
  return id;
}

// Validates a transaction body (create + update). Returns clean values or throws 400.
function validateTransactionInput(body = {}) {
  const errors = {};
  const type = body.type;
  const categoryId = Number(body.categoryId);
  const amountText = String(body.amount ?? '').trim();
  const amount = Number(amountText);
  const note = body.note === undefined || body.note === null ? '' : String(body.note).trim();

  if (!TRANSACTION_TYPES.includes(type)) errors.type = 'Type must be "expense" or "income".';
  if (!Number.isInteger(categoryId) || categoryId <= 0) errors.categoryId = 'Category is required.';

  if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !(amount > 0)) {
    errors.amount = 'Amount must be a number greater than 0 with at most 2 decimal places.';
  } else if (amount > MAX_AMOUNT) {
    errors.amount = 'Amount is too large.';
  }

  if (!isValidDate(body.date)) errors.date = 'Date is required and must be in YYYY-MM-DD format.';
  if (!PAYMENT_METHODS.includes(body.paymentMethod)) {
    errors.paymentMethod = `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`;
  }
  if (note.length > 255) errors.note = 'Note must be 255 characters or fewer.';

  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Validation failed.', errors);
  }

  return { type, categoryId, amount, date: body.date, paymentMethod: body.paymentMethod, note };
}

module.exports = {
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
  isValidEmail,
  isValidDate,
  parseId,
  validateTransactionInput,
};
