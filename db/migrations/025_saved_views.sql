-- Saved views for full dataset data tables (queries/pages).

CREATE TABLE IF NOT EXISTS saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  name text NOT NULL,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, property_id, dimension, name)
);

CREATE INDEX IF NOT EXISTS saved_views_owner_property_dimension_idx
  ON saved_views (owner_user_id, property_id, dimension);

