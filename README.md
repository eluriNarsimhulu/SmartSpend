# SmartSpend

A personal finance web app for tracking income and expenses and understanding spending patterns through a dashboard and analytics. Built as a focused V1 with a plain **React → Express → PostgreSQL (raw SQL)** stack — no ORM — so every query is easy to read and explain.

## Features

- Sign up, log in, log out (JWT, bcrypt-hashed passwords); protected routes
- Add, edit, delete income and expense transactions (modal with Expense / Income tabs)
- Default categories per user + custom categories (rename, delete)
- Payment method per transaction (Cash, UPI, Credit Card, Debit Card, Bank Transfer, Other)
- Server-side search, filters (type, category, payment method, date range), sorting and pagination (10 / 20 / 50)
- Dashboard: income, expense, balance, average daily expense, spending trend, spending by category, income vs expense, month-over-month comparison, per-category change, largest expenses, recent transactions
- Analytics page with period selector (Today, This week, This month, Last month, Custom range)
- CSV export (respects the current filters, only your own data)
- Light / dark mode (saved in `localStorage`)
- Responsive layout: sidebar on desktop, bottom tab bar on mobile, table → cards, filter panel, full-screen modal on phones
- Loading skeletons, empty states, error states, toast notifications
- Indian Rupee formatting (`₹12,34,567`)

Deliberately **not** in V1: budgets, wallets, recurring transactions, goals, OCR, UPI auto-detection, notifications, AI features, bank integrations. See `FUTURE_FEATURES.md`.

## Technology stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, JavaScript, React Router, Axios, Recharts, plain CSS |
| Backend  | Node.js, Express, JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, `express-rate-limit` |
| Database | PostgreSQL via the `pg` driver (parameterized SQL, no ORM) |

## Architecture

```
React (Vite)  ──Axios + JWT──▶  Express REST API  ──pg + SQL──▶  PostgreSQL
 pages/components               routes → controllers            users, categories,
 services/ (API clients)        middleware (auth, errors)       transactions
```

## Prerequisites

- **Node.js 18+** and npm — https://nodejs.org
- **PostgreSQL 14+** — https://www.postgresql.org/download/
  - macOS: `brew install postgresql@16 && brew services start postgresql@16`
  - Ubuntu/Debian: `sudo apt install postgresql && sudo service postgresql start`
  - Windows: use the installer from postgresql.org (remember the `postgres` password you set)

## Installation & database setup

```bash
# 1. Create the database (macOS/Linux; on Windows use "SQL Shell (psql)" or pgAdmin)
psql -U postgres -c "CREATE DATABASE smartspend;"

# 2. Backend
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: set DATABASE_URL and a long random JWT_SECRET

# 3. Create the tables  (either way works)
psql -U postgres -d smartspend -f sql/schema.sql
#   or, without psql on your PATH:
npm run db:schema

# 4. OPTIONAL demo data (user demo@smartspend.app / Demo@1234)
psql -U postgres -d smartspend -f sql/seed.sql
#   or:
npm run db:seed

# 5. Start the API (http://localhost:5000)
npm run dev                   # or: npm start

# 6. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                   # http://localhost:5173
```

Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

The seed script uses PostgreSQL's `pgcrypto` extension to create the demo user's bcrypt hash. The app itself works without any seed data: registering creates your default categories automatically.

### Environment variables

`backend/.env`

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default 5000) |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/smartspend` |
| `JWT_SECRET` | Secret used to sign tokens — required, never commit it |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLIENT_URL` | Allowed CORS origin(s), comma separated |
| `DATABASE_SSL` | `true` if your hosted database requires SSL |

`frontend/.env`

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base URL, e.g. `http://localhost:5000/api`. If unset, the app calls `/api` and the Vite dev server proxies it to `localhost:5000`. |

## Production build

```bash
cd frontend && npm run build     # static files in frontend/dist (serve with any static host)
cd backend  && NODE_ENV=production npm start
```
Set `VITE_API_URL` to your deployed API before building, and `CLIENT_URL` on the API to your site's origin.

## Folder structure

```
smartspend/
├── backend/
│   ├── sql/                schema.sql, seed.sql
│   └── src/
│       ├── config/         environment loading/validation
│       ├── db/             pg pool, SQL file runner
│       ├── middleware/     JWT auth, central error handler
│       ├── routes/         URL → controller mapping
│       ├── controllers/    request handling + SQL queries
│       ├── services/       default categories, transaction filter builder
│       ├── utils/          validation, date helpers, HttpError
│       └── server.js
└── frontend/
    └── src/
        ├── pages/          Login, Register, Dashboard, Transactions, Analytics, Categories, Settings
        ├── components/     Sidebar, Topbar, charts, TransactionTable, TransactionModal, FilterBar, ...
        ├── layouts/        AppLayout, AuthLayout
        ├── services/       api.js (Axios + token), auth/transaction/category/dashboard services
        ├── context/        Auth, Theme, Toast providers
        ├── hooks/          useDashboardData, useCategories, useTransactionDialogs, useDebounce
        ├── utils/          currency/date formatting, period helpers
        └── styles/         theme tokens, base, layout, components, pages
```

## Authentication flow

1. `POST /api/auth/register` or `/login` validates input, hashes/compares the password with bcrypt and returns `{ token, user }`.
2. The token is a JWT whose `sub` is the user id, signed with `JWT_SECRET`. The frontend stores it in `localStorage` and the Axios request interceptor adds `Authorization: Bearer <token>` to every call.
3. `middleware/auth.js` verifies the token and sets `req.user.id`. **The user id always comes from the verified token, never from the request body or query.**
4. If the API answers 401 for an expired/invalid token, the frontend clears the token and returns to `/login`. Logout simply removes the token.

## Database schema

```
users 1 ──< categories 1 ──< transactions >── 1 users
```

- **users**: `id, name, email (unique), password_hash, created_at, updated_at`
- **categories**: `id, user_id → users, name, type ('expense'|'income'), created_at`; unique `(user_id, name, type)`
- **transactions**: `id, user_id → users, category_id → categories, type, amount NUMERIC(12,2) CHECK (amount > 0), transaction_date DATE, payment_method, note, created_at, updated_at`

Money uses `NUMERIC`, never floating point. Deleting a user cascades to their data; a category that still has transactions cannot be deleted (`ON DELETE RESTRICT`, surfaced as a 409). Indexes: `(user_id, transaction_date DESC)`, `(user_id, type, transaction_date)`, `category_id`, `categories(user_id)`.

### Data isolation

Every query includes the owner from the JWT:

```sql
SELECT ... FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.user_id = $1 ...
UPDATE transactions SET ... WHERE id = $7 AND user_id = $8
DELETE FROM transactions WHERE id = $1 AND user_id = $2
```

A request for another user's id simply matches no row and returns 404. When creating/updating a transaction the API also checks that the chosen category belongs to the same user and matches the transaction type.

## Analytics (how the numbers are calculated)

All totals are computed in PostgreSQL (see `backend/src/controllers/dashboardController.js`); the frontend just renders them.

- **Summary** – one query with conditional aggregation:
  `SUM(amount) FILTER (WHERE type = 'income')`, `... 'expense'`, restricted by `transaction_date BETWEEN $2 AND $3`. Balance = income − expense. Average daily expense = total expense ÷ days elapsed in the range (future days of the current month aren't counted).
- **Category breakdown** – `JOIN categories ... GROUP BY c.id, c.name ORDER BY total DESC`.
- **Trend** – `generate_series(start, end, '1 day')` `LEFT JOIN transactions` `GROUP BY day`, so days without transactions show as 0.
- **Month comparison** – one query using `SUM(...) FILTER (WHERE transaction_date BETWEEN current)` and `FILTER (... previous)`. For a full calendar month the comparison period is the previous calendar month; for other ranges it is the equally long period immediately before. A second query does the same `GROUP BY category` for the per-category ↑/↓ percentages. Percent change = (current − previous) ÷ previous × 100 (shown as "New" if previous was 0).
- **Top expenses** – `WHERE type = 'expense' ORDER BY amount DESC LIMIT 5`.

Dates travel as `YYYY-MM-DD` strings end to end (the `pg` DATE parser is overridden to return strings), which avoids timezone off-by-one-day bugs.

## API documentation

All endpoints except register/login require `Authorization: Bearer <token>`. Errors look like `{ "message": "...", "errors": { "field": "..." } }`.
Status codes used: 200, 201, 400 (validation), 401 (not authenticated), 404 (not found / not yours), 409 (duplicate or in use), 500.

### Auth

**POST `/api/auth/register`** — creates the account and its default categories.
```json
// request
{ "name": "John", "email": "john@example.com", "password": "password123", "confirmPassword": "password123" }
// 201
{ "token": "eyJ...", "user": { "id": 1, "name": "John", "email": "john@example.com", "createdAt": "..." } }
```
400 on validation errors (name required, valid email, password ≥ 8 chars, passwords match); 409 if the email exists.

**POST `/api/auth/login`** — `{ "email", "password" }` → `{ token, user }`. 401 `Invalid email or password.`

**GET `/api/auth/me`** — current user → `{ user }`.

### Transactions

**GET `/api/transactions`** — paginated list. Query params (all optional):

| Param | Example | Notes |
|-------|---------|-------|
| `page`, `limit` | `1`, `10` | limit max 100 |
| `search` | `lunch` | matches note, category name, payment method |
| `type` | `expense` | `expense` or `income` |
| `category` | `Food` | category name (case-insensitive) |
| `categoryId` | `3` | |
| `paymentMethod` | `UPI` | |
| `startDate`, `endDate` | `2026-10-01`, `2026-10-31` | inclusive |
| `minAmount`, `maxAmount` | `100`, `5000` | |
| `sortBy`, `sortOrder` | `date`/`amount`, `asc`/`desc` | default date desc |

```json
// 200
{
  "transactions": [
    { "id": 12, "type": "expense", "amount": 450, "date": "2026-10-28", "paymentMethod": "UPI",
      "note": "Lunch with friends", "categoryId": 1, "categoryName": "Food" }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 43, "totalPages": 5 }
}
```

**GET `/api/transactions/:id`** — one transaction → `{ transaction }` (404 if not yours).

**POST `/api/transactions`**
```json
// request
{ "type": "expense", "amount": "450", "categoryId": 1, "paymentMethod": "UPI", "note": "Lunch with friends", "date": "2026-10-28" }
// 201
{ "transaction": { "id": 12, "type": "expense", "amount": 450, "date": "2026-10-28", ... } }
```
Validation: amount > 0 (max 2 decimals), valid date, valid payment method, type, and a category you own that matches the type.

**PUT `/api/transactions/:id`** — same body as POST → `{ transaction }`.

**DELETE `/api/transactions/:id`** → `{ "message": "Transaction deleted." }`

**GET `/api/transactions/export`** — CSV download (`Date, Type, Category, Payment Method, Amount, Note`). Accepts the same filter params as the list (not pagination). Spreadsheet-formula characters in notes are neutralised.

### Categories

**GET `/api/categories`** (`?type=expense|income`) → `{ categories: [{ id, name, type, transactionCount }] }`
**POST `/api/categories`** `{ "name": "Gym", "type": "expense" }` → 201 `{ category }` (409 if it exists)
**PUT `/api/categories/:id`** `{ "name": "Fitness" }` → `{ category }` (type can't be changed)
**DELETE `/api/categories/:id`** → 200, or 409 if transactions still use it

### Dashboard

All accept `startDate` and `endDate` (`YYYY-MM-DD`); default is the current month.

| Endpoint | Returns |
|----------|---------|
| GET `/api/dashboard/summary` | `totalIncome, totalExpense, balance, avgDailyExpense, days, transactionCount` |
| GET `/api/dashboard/category-breakdown` (`?type=expense`) | `categories: [{ name, total, percentage, transactionCount }]` |
| GET `/api/dashboard/trend` | `points: [{ date, income, expense }]`, one per day |
| GET `/api/dashboard/month-comparison` | `current, previous, changePercent, comparisonLabel, categories: [{ name, current, previous, changePercent }]` |
| GET `/api/dashboard/top-expenses` (`?limit=5`) | `expenses: [transaction]` (largest first) |

## Security

bcrypt (12 rounds) password hashing · JWT auth · parameterized SQL everywhere (user text never concatenated into SQL; `ORDER BY` columns come from a whitelist) · server-side validation of every input · `helmet` · CORS restricted to `CLIENT_URL` · rate limiting on login/register · generic 500 messages (details only in server logs) · secrets only via environment variables.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing required environment variables` | Create `backend/.env` from `.env.example` and set `DATABASE_URL` and `JWT_SECRET`. |
| `password authentication failed` / `ECONNREFUSED` | PostgreSQL isn't running or the credentials in `DATABASE_URL` are wrong. |
| `database "smartspend" does not exist` | Run `CREATE DATABASE smartspend;` first. |
| `relation "users" does not exist` | Run `schema.sql` (step 3). |
| `permission denied to create extension "pgcrypto"` when seeding | Run the seed as a superuser (`psql -U postgres ...`), or skip the seed and register a normal account. |
| Browser shows "Cannot reach the server" | Backend not running, wrong `VITE_API_URL`, or `CLIENT_URL` doesn't match the frontend origin (check the port). |
| `psql` not found on Windows | Use `npm run db:schema` / `npm run db:seed` from `backend/`, or SQL Shell / pgAdmin. |
| Port already in use | Change `PORT` in `backend/.env` (and `VITE_API_URL` / the Vite proxy accordingly). |
