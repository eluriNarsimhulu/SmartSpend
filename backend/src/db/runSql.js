// Usage: node src/db/runSql.js sql/schema.sql
// Runs a .sql file against DATABASE_URL (handy on Windows where psql may not be on PATH).
const fs = require('fs');
const path = require('path');
const db = require('./pool');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node src/db/runSql.js <path-to-sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  await db.query(sql);
  console.log(`Executed ${file} successfully.`);
  await db.pool.end();
}

main().catch(async (err) => {
  console.error('Failed to run SQL file:', err.message);
  await db.pool.end();
  process.exit(1);
});
