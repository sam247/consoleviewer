-- Properties and integrations
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  site_url text NOT NULL,
  gsc_site_url text,
  timezone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS properties_team_site_url_uidx ON properties (team_id, site_url);
CREATE INDEX IF NOT EXISTS properties_team_id_idx ON properties (team_id);

CREATE TABLE IF NOT EXISTS property_integrations (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  connected_at timestamptz,
  last_checked_at timestamptz,
  PRIMARY KEY (property_id, integration_type)
);
