import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!url || !key || !projectRef) return null;
  return { url, key, projectRef };
}

let client: SupabaseClient | null = null;
export function getSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  if (!client) client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
