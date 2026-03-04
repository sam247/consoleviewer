-- ETL run tracking and watermarks
CREATE TABLE IF NOT EXISTS etl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  rows_processed bigint NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE IF NOT EXISTS etl_watermarks (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source text NOT NULL,
  last_processed_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, source)
);
