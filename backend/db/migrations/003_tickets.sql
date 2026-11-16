CREATE TABLE IF NOT EXISTS complaint_tickets (
  id UUID PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('Rendah', 'Sedang', 'Tinggi')),
  status TEXT NOT NULL CHECK (status IN ('Baru', 'Diproses', 'Selesai')),
  assignee TEXT,
  original_message TEXT NOT NULL,
  normalized_message TEXT NOT NULL,
  reason TEXT NOT NULL,
  sku_id UUID,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_ticket_history (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES complaint_tickets(id),
  action TEXT NOT NULL,
  previous_value TEXT,
  next_value TEXT,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version)
VALUES ('003_tickets')
ON CONFLICT (version) DO NOTHING;
