-- Create recent monthly partitions for gsc_raw
CREATE TABLE IF NOT EXISTS gsc_raw_2026_01 PARTITION OF gsc_raw
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS gsc_raw_2026_02 PARTITION OF gsc_raw
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS gsc_raw_2026_03 PARTITION OF gsc_raw
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Add more partitions as needed (or auto-create in ETL job)
