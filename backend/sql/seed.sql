-- OPTIONAL development data. The app works without it.
-- Creates a demo account:  demo@smartspend.app  /  Demo@1234
-- with default categories and sample transactions for the current and previous month.
-- Requires the pgcrypto extension (bundled with PostgreSQL) to create a bcrypt hash.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  demo_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email = 'demo@smartspend.app') THEN
    RAISE NOTICE 'Demo user already exists - skipping seed.';
    RETURN;
  END IF;

  INSERT INTO users (name, email, password_hash)
  VALUES ('Demo User', 'demo@smartspend.app', crypt('Demo@1234', gen_salt('bf', 12)))
  RETURNING id INTO demo_id;

  INSERT INTO categories (user_id, name, type)
  SELECT demo_id, v.name, v.type
  FROM (VALUES
    ('Food','expense'), ('Transport','expense'), ('Shopping','expense'), ('Bills','expense'),
    ('Entertainment','expense'), ('Health','expense'), ('Education','expense'), ('Other','expense'),
    ('Gym','expense'),
    ('Salary','income'), ('Freelancing','income'), ('Business','income'), ('Investment','income'), ('Other','income')
  ) AS v(name, type);

  -- month_offset: 0 = this month, -1 = last month. Dates are capped at today.
  INSERT INTO transactions (user_id, category_id, type, amount, transaction_date, payment_method, note)
  SELECT demo_id, c.id, s.type, s.amount,
         LEAST(
           (date_trunc('month', CURRENT_DATE) + make_interval(months => s.month_offset, days => s.day - 1))::date,
           CURRENT_DATE
         ),
         s.method, s.note
  FROM (VALUES
    ('income',  'Salary',        50000, 0, 1,  'Bank Transfer', 'Monthly salary'),
    ('income',  'Freelancing',    8000, 0, 12, 'UPI',           'Logo design project'),
    ('expense', 'Bills',         12000, 0, 2,  'Bank Transfer', 'House rent'),
    ('expense', 'Bills',          1800, 0, 5,  'UPI',           'Electricity bill'),
    ('expense', 'Food',            450, 0, 3,  'UPI',           'Lunch with friends'),
    ('expense', 'Food',            620, 0, 8,  'Credit Card',   'Dinner at restaurant'),
    ('expense', 'Food',           2000, 0, 14, 'Credit Card',   'Weekend restaurant'),
    ('expense', 'Food',            380, 0, 18, 'Cash',          'Street food'),
    ('expense', 'Shopping',       4500, 0, 9,  'Debit Card',    'Running shoes'),
    ('expense', 'Transport',      1500, 0, 6,  'UPI',           'Flight booking'),
    ('expense', 'Transport',       320, 0, 15, 'UPI',           'Cab to office'),
    ('expense', 'Entertainment',   500, 0, 10, 'UPI',           'Movie tickets'),
    ('expense', 'Health',          900, 0, 16, 'Cash',          'Pharmacy'),
    ('expense', 'Gym',            1200, 0, 4,  'UPI',           'Gym membership'),
    ('income',  'Salary',        50000, -1, 1, 'Bank Transfer', 'Monthly salary'),
    ('income',  'Investment',     2500, -1, 20,'Bank Transfer', 'Dividend payout'),
    ('expense', 'Bills',         12000, -1, 2, 'Bank Transfer', 'House rent'),
    ('expense', 'Bills',          1650, -1, 6, 'UPI',           'Electricity bill'),
    ('expense', 'Food',           3100, -1, 7, 'UPI',           'Groceries'),
    ('expense', 'Food',            540, -1, 17,'Cash',          'Lunch'),
    ('expense', 'Shopping',       6800, -1, 11,'Credit Card',   'Winter jacket'),
    ('expense', 'Transport',       900, -1, 13,'UPI',           'Fuel'),
    ('expense', 'Entertainment',   900, -1, 21,'Credit Card',   'Streaming + concert'),
    ('expense', 'Education',      1500, -1, 9, 'Debit Card',    'Online course'),
    ('expense', 'Gym',            1200, -1, 4, 'UPI',           'Gym membership')
  ) AS s(type, category, amount, month_offset, day, method, note)
  JOIN categories c ON c.user_id = demo_id AND c.name = s.category AND c.type = s.type;
END $$;
