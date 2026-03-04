-- Keyword tracking
CREATE TABLE IF NOT EXISTS rank_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  keyword_text text NOT NULL,
  keyword_hash bytea NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, keyword_hash)
);

CREATE TABLE IF NOT EXISTS rank_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES rank_keywords(id) ON DELETE CASCADE,
  date date NOT NULL,
  position numeric(8,3),
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rank_positions_property_date_idx ON rank_positions (property_id, date);
CREATE INDEX IF NOT EXISTS rank_positions_keyword_date_idx ON rank_positions (keyword_id, date);
