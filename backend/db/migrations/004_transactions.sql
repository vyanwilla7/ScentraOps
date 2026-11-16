CREATE TABLE IF NOT EXISTS transaction_lines (
  id UUID PRIMARY KEY,
  marketplace TEXT NOT NULL,
  order_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  order_date DATE NOT NULL,
  status TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  source_data JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (marketplace, order_id, line_id)
);

CREATE TABLE IF NOT EXISTS transaction_adjustments (
  id UUID PRIMARY KEY,
  source_reference TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  note TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version)
VALUES ('004_transactions')
ON CONFLICT (version) DO NOTHING;
