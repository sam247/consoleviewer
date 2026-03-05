-- Search appearance (SERP features) per query per date from GSC
CREATE TABLE IF NOT EXISTS gsc_search_appearance (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_id bigint NOT NULL REFERENCES query_dictionary(id),
  appearance text NOT NULL,
  clicks int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, date, query_id, appearance)
);

CREATE INDEX IF NOT EXISTS idx_gsc_search_appearance_property_date
  ON gsc_search_appearance (property_id, date);
