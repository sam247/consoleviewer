# Phase 2 Optimization Pack (Neon Postgres)

This document describes apply order, verification queries, performance validation, and rollback guidance for the Phase 2 optimization pack.

## Migration Order

1. `015_phase2_index_cleanup.sql`
2. `016_phase2_fk_indexes.sql`
3. `017_phase2_hash_join_fix.sql`
4. `018_phase2_query_indexes.sql`

## Zero-Downtime Notes

- Use `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.
- Use `DROP INDEX CONCURRENTLY IF EXISTS` for rollbacks.
- Do not wrap concurrent index statements in a transaction block.
- Keep migrations idempotent.

## Verification Queries

### 1) Targeted table index check

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename IN (
  'gsc_query_daily',
  'gsc_page_daily',
  'gsc_property_daily',
  'opportunity_queries',
  'property_snapshots'
);
```

### 2) Quick rollup visual check

```sql
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE tablename LIKE 'gsc_%'
ORDER BY tablename;
```

### 3) Confirm key indexes from migration 018 exist

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname IN (
  'gsc_query_daily_property_query_date_idx',
  'gsc_query_daily_property_date_clicks_idx',
  'gsc_page_daily_property_date_idx',
  'gsc_page_daily_property_page_date_idx',
  'gsc_property_daily_property_date_idx',
  'opportunity_queries_property_score_idx',
  'property_snapshots_property_date_idx'
)
ORDER BY tablename, indexname;
```

Note: `gsc_query_daily_property_date_idx` is intentionally not created because the equivalent
`idx_gsc_query_daily_property_date` already exists on `(property_id, date DESC)`.

## Performance Validation

Run `EXPLAIN (ANALYZE, BUFFERS)` on representative dashboard queries.

### Query rollup: top queries

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM gsc_query_daily
WHERE property_id = $1
  AND date >= $2
  AND date <= $3
ORDER BY clicks DESC
LIMIT 100;
```

### Page rollup: trend lookup

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM gsc_page_daily
WHERE property_id = $1
  AND page_id = $2
  AND date >= $3
  AND date <= $4
ORDER BY date DESC;
```

### Property chart scan

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM gsc_property_daily
WHERE property_id = $1
  AND date >= $2
  AND date <= $3
ORDER BY date DESC;
```

### Opportunity ranking

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM opportunity_queries
WHERE property_id = $1
ORDER BY score DESC
LIMIT 100;
```

### Latest property snapshot

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM property_snapshots
WHERE property_id = $1
ORDER BY date DESC
LIMIT 1;
```

Expected behavior:
- index scan or bitmap index scan for selective predicates
- no full table scan for these dashboard patterns at scale
- no large explicit sort where index order satisfies `ORDER BY`

## Rollback Guidance (Migration 018)

If needed, revert index additions with:

```sql
DROP INDEX CONCURRENTLY IF EXISTS gsc_query_daily_property_query_date_idx;
DROP INDEX CONCURRENTLY IF EXISTS gsc_query_daily_property_date_clicks_idx;
DROP INDEX CONCURRENTLY IF EXISTS gsc_page_daily_property_date_idx;
DROP INDEX CONCURRENTLY IF EXISTS gsc_page_daily_property_page_date_idx;
DROP INDEX CONCURRENTLY IF EXISTS gsc_property_daily_property_date_idx;
DROP INDEX CONCURRENTLY IF EXISTS opportunity_queries_property_score_idx;
DROP INDEX CONCURRENTLY IF EXISTS property_snapshots_property_date_idx;
```
