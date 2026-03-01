-- Share links: token-based read-only sharing (dashboard or project)
CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  owner_user_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('dashboard', 'project')),
  scope_id text,
  params jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS share_links_token_hash_key ON share_links (token_hash);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Owner can manage own rows only; no public read (access via token resolution API)
CREATE POLICY share_links_owner_all ON share_links
  FOR ALL
  USING (owner_user_id = current_setting('app.owner_user_id', true))
  WITH CHECK (owner_user_id = current_setting('app.owner_user_id', true));

-- Service role can resolve by token_hash (used by GET /api/share-links/[token])
-- In Supabase, use service role key for token lookup; RLS is bypassed with service role.
-- If using anon key with RLS, add a policy that allows SELECT where token_hash = ... via a secure function.
-- For simplicity: service role bypasses RLS. Application uses service role in API route for token resolution.
