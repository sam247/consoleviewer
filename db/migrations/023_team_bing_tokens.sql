-- Store Bing Webmaster OAuth refresh token per team.
CREATE TABLE IF NOT EXISTS team_bing_tokens (
  team_id uuid PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
