const DEFAULT_CATEGORIES = [
  ...['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'].map((name) => ({ name, type: 'expense' })),
  ...['Salary', 'Freelancing', 'Business', 'Investment', 'Other'].map((name) => ({ name, type: 'income' })),
];

// Inserts the default categories for a brand-new user using the given client
// (so it can run inside the registration transaction).
async function createDefaultCategories(client, userId) {
  const names = DEFAULT_CATEGORIES.map((c) => c.name);
  const types = DEFAULT_CATEGORIES.map((c) => c.type);
  await client.query(
    `INSERT INTO categories (user_id, name, type)
     SELECT $1, d.name, d.type
     FROM unnest($2::text[], $3::text[]) AS d(name, type)`,
    [userId, names, types]
  );
}

module.exports = { createDefaultCategories };
