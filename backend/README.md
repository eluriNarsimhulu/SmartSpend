# SmartSpend API

Express + PostgreSQL (`pg`, plain SQL) REST API. See the [root README](../README.md) for full setup, API reference and architecture.

```bash
npm install
cp .env.example .env     # then edit DATABASE_URL and JWT_SECRET
npm run db:schema        # creates the tables
npm run db:seed          # optional demo data
npm run dev              # http://localhost:5000
```
