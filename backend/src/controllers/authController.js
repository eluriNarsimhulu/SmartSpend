const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/pool');
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { isValidEmail } = require('../utils/validation');
const { createDefaultCategories } = require('../services/categoryService');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores anything beyond 72 bytes
// Used to keep login timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const signToken = (userId) => jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email, createdAt: row.created_at });

const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};
  const errors = {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanName || cleanName.length > 100) errors.name = 'Name is required (max 100 characters).';
  if (!isValidEmail(cleanEmail)) errors.email = 'Enter a valid email address.';
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (confirmPassword !== undefined && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (Object.keys(errors).length > 0) throw new HttpError(400, 'Validation failed.', errors);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // User + default categories are created together or not at all.
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [cleanName, cleanEmail, passwordHash]
    );
    await createDefaultCategories(client, rows[0].id);
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(rows[0].id), user: publicUser(rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw new HttpError(409, 'An account with this email already exists.', { email: 'Email is already registered.' });
    }
    throw err;
  } finally {
    client.release();
  }
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }

  const { rows } = await db.query(
    'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1',
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  // Same message for "no such email" and "wrong password" so emails can't be probed.
  if (!user || !passwordOk) throw new HttpError(401, 'Invalid email or password.');

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

const me = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Account no longer exists.');
  res.json({ user: publicUser(rows[0]) });
});

module.exports = { register, login, me };
