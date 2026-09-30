import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getOrCreateCompany } from "./db";
import { getSupabaseClient, getSupabaseConfig } from "./supabase";

describe("Manus identity and audit data", () => {
  it("binds the current Manus numeric user id to app_user_id", async () => {
    const company = await getOrCreateCompany(1, "Test User");
    expect(company.appUserId).toBe(1);
  });

  it("keeps audit logs inaccessible to the publishable anonymous client", async () => {
    const config = getSupabaseConfig();
    const anonKey = process.env.SUPABASE_ANON_KEY;
    expect(config?.url).toContain("aixcwdnpnharnersfpmw");
    expect(anonKey).toBeTruthy();
    const anon = createClient(config!.url, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.from("audit_logs").select("id").limit(5);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("allows the server audit reader to scope results to the company user", async () => {
    const client = getSupabaseClient();
    expect(client).not.toBeNull();
    const result = await client!.from("audit_logs").select("company_id, app_user_id").eq("company_id", 1).eq("app_user_id", 1).limit(5);
    expect(result.error).toBeNull();
  });
});
