-- Neon-backed watchlist storage for Index Signals.
-- Idempotent and safe for existing deployments.

CREATE TABLE IF NOT EXISTS index_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, property_id, url)
);

CREATE INDEX IF NOT EXISTS index_watchlist_owner_property_created_idx
  ON index_watchlist (owner_user_id, property_id, created_at DESC);
