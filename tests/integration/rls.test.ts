import { afterAll, describe, expect, it } from "vitest";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { getTestServiceClient } from "./test-service-client";

/**
 * Exercises Row Level Security directly against the tables/RPC, using the
 * anon/publishable client — the same client every public page uses — never
 * the service-role client. Known ids below are deterministic seed ids from
 * seed/demo-data.json (docs/DECISIONS.md D-040), not fetched via a
 * privileged client.
 */

const DRAFT_SIGNAL_ID = "demo-signal-1-3";
const DRAFT_ONLY_SOURCE_ID = "demo-source-1-3";
const PUBLISHED_SIGNAL_ID = "demo-signal-1-1";
const PUBLISHED_COMPANY_ID = "demo-company-1-1";
const NEVER_INSERTED_SIGNAL_ID = "test-integration-should-never-be-inserted";

describe("RLS: anon client reads", () => {
  it("returns zero rows for a draft signal id", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("signals").select("id").eq("id", DRAFT_SIGNAL_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("returns the row for a published signal id", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("signals").select("id").eq("id", PUBLISHED_SIGNAL_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("does not expose a source_document linked only to a draft signal", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("source_documents").select("id").eq("id", DRAFT_ONLY_SOURCE_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not expose signal_evidence linked only to a draft signal", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("signal_evidence").select("id").eq("signal_id", DRAFT_SIGNAL_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("exposes the single app_meta row", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("app_meta").select("id").eq("id", 1).maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("every published company has exactly one primary company_sectors row", async () => {
    const supabase = getPublicSupabaseClient();
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id")
      .eq("publication_status", "published");
    expect(companiesError).toBeNull();

    const { data: primaryRows, error: primaryError } = await supabase
      .from("company_sectors")
      .select("company_id")
      .eq("is_primary", true);
    expect(primaryError).toBeNull();

    const primaryCountByCompany = new Map<string, number>();
    for (const row of (primaryRows ?? []) as { company_id: string }[]) {
      primaryCountByCompany.set(row.company_id, (primaryCountByCompany.get(row.company_id) ?? 0) + 1);
    }
    for (const company of (companies ?? []) as { id: string }[]) {
      expect(primaryCountByCompany.get(company.id)).toBe(1);
    }
  });
});

describe("RLS: anon client mutation attempts fail", () => {
  afterAll(async () => {
    // Safety net only: if RLS were ever misconfigured and the insert below
    // unexpectedly succeeded, this removes the row via the service-role
    // client so a broken policy doesn't leave permanent test pollution.
    const supabase = getTestServiceClient();
    await supabase.from("signals").delete().eq("id", NEVER_INSERTED_SIGNAL_ID);
  });

  it("rejects an anon INSERT into signals", async () => {
    const supabase = getPublicSupabaseClient();
    const { error } = await supabase.from("signals").insert({
      id: NEVER_INSERTED_SIGNAL_ID,
      company_id: PUBLISHED_COMPANY_ID,
      signal_type: "product_launch",
      headline: "Should never be inserted",
      summary: "Should never be inserted",
      why_it_matters: "Should never be inserted",
      detected_at: new Date().toISOString(),
      evidence_strength: "low",
      verification_status: "unverified",
      publication_status: "draft",
      is_demo: true,
      created_by_type: "import",
    });
    expect(error).not.toBeNull();
  });

  it("rejects an anon UPDATE on companies (no row is changed)", async () => {
    const supabase = getPublicSupabaseClient();
    await supabase.from("companies").update({ name: "Hijacked Name" }).eq("id", PUBLISHED_COMPANY_ID);

    const { data } = await supabase.from("companies").select("name").eq("id", PUBLISHED_COMPANY_ID).single();
    expect(data?.name).not.toBe("Hijacked Name");
  });

  it("rejects an anon DELETE on signals (the row still exists)", async () => {
    const supabase = getPublicSupabaseClient();
    await supabase.from("signals").delete().eq("id", PUBLISHED_SIGNAL_ID);

    const { data } = await supabase.from("signals").select("id").eq("id", PUBLISHED_SIGNAL_ID);
    expect(data).toHaveLength(1);
  });

  it("rejects an anon RPC call to reseed_demo_data", async () => {
    const supabase = getPublicSupabaseClient();
    const { error } = await supabase.rpc("reseed_demo_data", { payload: {} });
    expect(error).not.toBeNull();
  });
});
