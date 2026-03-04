-- Daily aggregates
CREATE TABLE IF NOT EXISTS gsc_property_daily (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position_sum numeric(16,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date)
);

CREATE TABLE IF NOT EXISTS gsc_query_daily (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_id bigint NOT NULL REFERENCES query_dictionary(id),
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position_sum numeric(16,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date, query_id)
);

CREATE TABLE IF NOT EXISTS gsc_page_daily (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  page_id bigint NOT NULL REFERENCES page_dictionary(id),
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position_sum numeric(16,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date, page_id)
);

-- Indexes for dashboard access
CREATE INDEX IF NOT EXISTS gsc_property_daily_team_property_date_idx ON gsc_property_daily (team_id, property_id, date);
CREATE INDEX IF NOT EXISTS gsc_query_daily_team_property_date_idx ON gsc_query_daily (team_id, property_id, date);
CREATE INDEX IF NOT EXISTS gsc_page_daily_team_property_date_idx ON gsc_page_daily (team_id, property_id, date);
CREATE INDEX IF NOT EXISTS gsc_query_daily_property_query_idx ON gsc_query_daily (property_id, query_id);
CREATE INDEX IF NOT EXISTS gsc_page_daily_property_page_idx ON gsc_page_daily (property_id, page_id);
