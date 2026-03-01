-- Index watchlist: URLs to monitor for index signals (per property, per owner)
CREATE TABLE IF NOT EXISTS index_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  property_id text NOT NULL,
  url text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (owner_user_id, property_id, url)
);

ALTER TABLE index_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY index_watchlist_owner_all ON index_watchlist
  FOR ALL
  USING (owner_user_id = current_setting('app.owner_user_id', true))
  WITH CHECK (owner_user_id = current_setting('app.owner_user_id', true));
