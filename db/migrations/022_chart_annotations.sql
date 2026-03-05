-- User-added annotations on the trend chart (e.g. algorithm updates, deployments)
CREATE TABLE IF NOT EXISTS chart_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_annotations_property_date
  ON chart_annotations (property_id, date);
