import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client (service role). Use for share_links and index_watchlist.
 * Returns null when env is not set so APIs can return 503 or stub behaviour.
 */
export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serverClient;
}

export type ShareLinkRow = {
  id: string;
  token_hash: string;
  owner_user_id: string;
  scope: "dashboard" | "project";
  scope_id: string | null;
  params: Record<string, unknown> | null;
  expires_at: string;
  created_at: string;
  last_accessed_at: string | null;
};

export type IndexWatchlistRow = {
  id: string;
  owner_user_id: string;
  property_id: string;
  url: string;
  label: string | null;
  created_at: string;
};
