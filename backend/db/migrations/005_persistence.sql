ALTER TABLE master_skus
  ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE master_data_audit
  ADD COLUMN IF NOT EXISTS entity_ref TEXT,
  ADD COLUMN IF NOT EXISTS before JSONB,
  ADD COLUMN IF NOT EXISTS after JSONB;

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  values JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings_versions (
  id UUID PRIMARY KEY,
  before JSONB NOT NULL,
  after JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sequences (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT INTO app_sequences(name, value)
VALUES ('ticket', 0)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS transaction_revisions (
  id UUID PRIMARY KEY,
  original_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  order_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  replaced_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transaction_imports (
  id UUID PRIMARY KEY,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  inserted INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version)
VALUES ('005_persistence')
ON CONFLICT (version) DO NOTHING;
