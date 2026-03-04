-- Derived analytics tables
CREATE TABLE IF NOT EXISTS opportunity_queries (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_id bigint NOT NULL REFERENCES query_dictionary(id),
  score numeric(12,3) NOT NULL,
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  position_sum numeric(16,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ranking_movements (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_id bigint NOT NULL REFERENCES query_dictionary(id),
  page_id bigint REFERENCES page_dictionary(id),
  delta_1d numeric(8,3),
  delta_7d numeric(8,3),
  trend text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_cannibalisation (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_id bigint NOT NULL REFERENCES query_dictionary(id),
  conflict_score numeric(12,3) NOT NULL,
  page_ids bigint[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_classification (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  query_id bigint NOT NULL REFERENCES query_dictionary(id),
  intent text,
  category text,
  labels text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, query_id)
);

CREATE INDEX IF NOT EXISTS opportunity_queries_team_property_date_idx ON opportunity_queries (team_id, property_id, date);
CREATE INDEX IF NOT EXISTS ranking_movements_team_property_date_idx ON ranking_movements (team_id, property_id, date);
CREATE INDEX IF NOT EXISTS query_cannibalisation_team_property_date_idx ON query_cannibalisation (team_id, property_id, date);
