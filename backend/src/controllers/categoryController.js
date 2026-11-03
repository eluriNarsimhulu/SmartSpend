const db = require('../db/pool');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { TRANSACTION_TYPES, parseId } = require('../utils/validation');

const toDto = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  transactionCount: row.transaction_count,
  createdAt: row.created_at,
});

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 50) {
    throw new HttpError(400, 'Validation failed.', { name: 'Category name is required (max 50 characters).' });
  }
  return name;
}

const list = asyncHandler(async (req, res) => {
  const params = [req.user.id];
  let typeFilter = '';
  if (req.query.type) {
    if (!TRANSACTION_TYPES.includes(req.query.type)) throw new HttpError(400, 'Invalid type filter.');
    params.push(req.query.type);
    typeFilter = 'AND c.type = $2';
  }
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.type, c.created_at,
            COUNT(t.id)::int AS transaction_count
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = c.user_id
     WHERE c.user_id = $1 ${typeFilter}
     GROUP BY c.id
     ORDER BY c.type, c.name`,
    params
  );
  res.json({ categories: rows.map(toDto) });
});

const create = asyncHandler(async (req, res) => {
  const name = cleanName(req.body?.name);
  const type = req.body?.type;
  if (!TRANSACTION_TYPES.includes(type)) {
    throw new HttpError(400, 'Validation failed.', { type: 'Type must be "expense" or "income".' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO categories (user_id, name, type)
       VALUES ($1, $2, $3)
       RETURNING id, name, type, created_at, 0 AS transaction_count`,
      [req.user.id, name, type]
    );
    res.status(201).json({ category: toDto(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, `You already have an ${type} category named "${name}".`);
    throw err;
  }
});

// Only the name can be changed; changing the type would make existing transactions inconsistent.
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const name = cleanName(req.body?.name);
  try {
    const { rows } = await db.query(
      `UPDATE categories SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, name, type, created_at,
         (SELECT COUNT(*)::int FROM transactions WHERE category_id = categories.id) AS transaction_count`,
      [name, id, req.user.id]
    );
    if (!rows[0]) throw new HttpError(404, 'Category not found.');
    res.json({ category: toDto(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, `You already have a category named "${name}".`);
    throw err;
  }
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows: found } = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!found[0]) throw new HttpError(404, 'Category not found.');

  const { rows: used } = await db.query(
    'SELECT COUNT(*)::int AS count FROM transactions WHERE category_id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  if (used[0].count > 0) {
    throw new HttpError(409, `This category is used by ${used[0].count} transaction(s). Move or delete them first.`);
  }
  await db.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  res.json({ message: 'Category deleted.' });
});

module.exports = { list, create, update, remove };
