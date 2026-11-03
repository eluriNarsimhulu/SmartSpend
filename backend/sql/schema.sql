-- SmartSpend V1 schema (PostgreSQL). Safe to run more than once.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)   -- the API stores emails in lowercase
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(50) NOT NULL,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- a user can have "Other" once as expense and once as income, but not twice as expense
  CONSTRAINT categories_user_name_type_unique UNIQUE (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- RESTRICT: a category that still has transactions cannot be deleted
  category_id      INTEGER       NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type             VARCHAR(10)   NOT NULL CHECK (type IN ('expense', 'income')),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),   -- never FLOAT for money
  transaction_date DATE          NOT NULL,
  payment_method   VARCHAR(20)   NOT NULL
                   CHECK (payment_method IN ('Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other')),
  note             VARCHAR(255)  NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for the most common access patterns
CREATE INDEX IF NOT EXISTS idx_categories_user_id          ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date      ON transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions (user_id, type, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id    ON transactions (category_id);
