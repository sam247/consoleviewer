-- Raw GSC ingestion (debug-only, partitioned by date)
CREATE TABLE IF NOT EXISTS gsc_raw (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_hash bytea,
  page_hash bytea,
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position numeric(8,3),
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (date);

-- Indexes on parent (applies to partitions in newer Postgres)
CREATE INDEX IF NOT EXISTS gsc_raw_date_brin ON gsc_raw USING brin (date);
CREATE INDEX IF NOT EXISTS gsc_raw_property_date_idx ON gsc_raw (property_id, date);

-- Note: monthly partitions should be created by the ETL scheduler or migration tooling.
