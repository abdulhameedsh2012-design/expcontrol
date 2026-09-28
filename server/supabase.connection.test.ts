import { describe, expect, it } from "vitest";
import { getSupabaseClient, getSupabaseConfig } from "./supabase";

describe("Supabase connection", () => {
  it("connects to the configured DLP-EXP project", async () => {
    const config = getSupabaseConfig();
    expect(config?.projectRef).toBe("aixcwdnpnharnersfpmw");
    const client = getSupabaseClient();
    expect(client).not.toBeNull();
    const { error } = await client!.from("companies").select("id").limit(1);
    expect(error).toBeNull();
  }, 15000);
});
