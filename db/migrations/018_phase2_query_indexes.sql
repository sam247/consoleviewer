-- Phase 2: dashboard analytics read-path indexes
-- Zero-downtime rules:
-- 1) CREATE INDEX CONCURRENTLY
-- 2) IF NOT EXISTS for idempotency
-- 3) Do not wrap in a transaction block

-- gsc_query_daily:
-- Keep existing idx_gsc_query_daily_property_date (property_id, date DESC).
-- Do not create gsc_query_daily_property_date_idx (duplicate).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_query_daily_property_query_date_idx
ON gsc_query_daily (property_id, query_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_query_daily_property_date_clicks_idx
ON gsc_query_daily (property_id, date DESC, clicks DESC);

-- gsc_page_daily:
CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_page_daily_property_date_idx
ON gsc_page_daily (property_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_page_daily_property_page_date_idx
ON gsc_page_daily (property_id, page_id, date DESC);

-- gsc_property_daily:
CREATE INDEX CONCURRENTLY IF NOT EXISTS
gsc_property_daily_property_date_idx
ON gsc_property_daily (property_id, date DESC);

-- opportunity_queries:
CREATE INDEX CONCURRENTLY IF NOT EXISTS
opportunity_queries_property_score_idx
ON opportunity_queries (property_id, score DESC);

-- property_snapshots:
-- Use existing date column (no created_at schema change).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
property_snapshots_property_date_idx
ON property_snapshots (property_id, date DESC);
