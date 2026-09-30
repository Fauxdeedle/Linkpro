CREATE TABLE IF NOT EXISTS payment_records (
  payment_session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  transaction_id TEXT,
  amount NUMERIC(12, 2),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_entitlements (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  source_payment_session_id TEXT NOT NULL
    REFERENCES payment_records(payment_session_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS course_progress (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  completed_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS payment_records_user_id_idx
  ON payment_records (user_id);
