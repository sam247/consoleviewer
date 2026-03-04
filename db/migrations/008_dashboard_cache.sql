-- Dashboard cache tables
CREATE TABLE IF NOT EXISTS property_snapshots (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position_sum numeric(16,3) NOT NULL DEFAULT 0,
  query_count int NOT NULL DEFAULT 0,
  top3_count int NOT NULL DEFAULT 0,
  top10_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date)
);

CREATE TABLE IF NOT EXISTS property_chart_cache (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position_sum numeric(16,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date)
);

CREATE TABLE IF NOT EXISTS property_scores (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  visibility_score numeric(8,3) NOT NULL DEFAULT 0,
  momentum_score numeric(8,3) NOT NULL DEFAULT 0,
  opportunity_score numeric(8,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date)
);

CREATE INDEX IF NOT EXISTS property_snapshots_property_date_idx ON property_snapshots (property_id, date);
CREATE INDEX IF NOT EXISTS property_chart_cache_property_date_idx ON property_chart_cache (property_id, date);
CREATE INDEX IF NOT EXISTS property_scores_property_date_idx ON property_scores (property_id, date);
CREATE INDEX IF NOT EXISTS property_scores_team_property_date_idx ON property_scores (team_id, property_id, date);
