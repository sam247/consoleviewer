-- Add property/date index and cluster gsc_query_daily for range scans
CREATE INDEX IF NOT EXISTS idx_gsc_query_daily_property_date
  ON gsc_query_daily (property_id, date DESC);

-- Physically order the table using the index (requires exclusive lock)
CLUSTER gsc_query_daily USING idx_gsc_query_daily_property_date;
