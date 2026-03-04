-- Recluster gsc_query_daily monthly when it exceeds a row threshold
-- Usage: run as a scheduled job during off-peak hours.
DO $$
DECLARE
  row_estimate bigint;
BEGIN
  SELECT reltuples::bigint INTO row_estimate
  FROM pg_class
  WHERE oid = 'gsc_query_daily'::regclass;

  IF row_estimate > 5000000 THEN
    RAISE NOTICE 'Reclustering gsc_query_daily (rows ~%)', row_estimate;
    CLUSTER gsc_query_daily USING idx_gsc_query_daily_property_date;
  ELSE
    RAISE NOTICE 'Skip recluster; rows (%) below threshold', row_estimate;
  END IF;
END $$;
