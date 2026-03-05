-- Phase 2 rollup index fixes
-- Zero-downtime + idempotent:
-- - CREATE INDEX CONCURRENTLY
-- - IF NOT EXISTS
-- - no transaction wrapper

CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_query_daily_property_date_clicks_idx
ON gsc_query_daily (property_id, date DESC, clicks DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_page_daily_property_date_idx
ON gsc_page_daily (property_id, date DESC);
