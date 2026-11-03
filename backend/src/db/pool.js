const { Pool, types } = require('pg');
const env = require('../config/env');

// By default pg returns DATE as a JS Date (shifted by the server timezone, which
// causes off-by-one-day bugs). Return the plain 'YYYY-MM-DD' string instead.
types.setTypeParser(1082, (value) => value);
// NUMERIC comes back as a string by default; convert to a JS number for the JSON API.
types.setTypeParser(1700, (value) => parseFloat(value));
// COUNT(*) is BIGINT; convert to a JS number.
types.setTypeParser(20, (value) => parseInt(value, 10));

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

// Thin wrapper so controllers can write: db.query('SELECT ... $1', [value])
module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
