import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getSupabaseClient, getSupabaseConfig } from "./supabase";

describe("Supabase RLS", () => {
  it("keeps company rows hidden from the anonymous publishable key", async () => {
    const config = getSupabaseConfig();
    const anonKey = process.env.SUPABASE_ANON_KEY;
    expect(config?.url).toContain("aixcwdnpnharnersfpmw");
    expect(anonKey).toBeTruthy();
    const anon = createClient(config!.url, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.from("companies").select("id").limit(5);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("allows only the server client to read the migrated rows", async () => {
    const admin = getSupabaseClient();
    expect(admin).not.toBeNull();
    const { data, error } = await admin!.from("companies").select("id").limit(5);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});
