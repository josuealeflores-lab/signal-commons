import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { getTestServiceClient } from "./test-service-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * RLS coverage for the two Milestone 6A tables (company_aliases,
 * ingestion_runs). Follows rls.test.ts/reviewer-profiles-rls.test.ts's
 * pattern: a real fixture row is inserted via the service-role client
 * first, because an empty-table "anon sees []" assertion would pass
 * vacuously even if RLS were misconfigured. company_aliases references an
 * existing published seed company (docs/DECISIONS.md D-040 ids) rather than
 * creating a throwaway one, since the FK is the only requirement here.
 */

const PUBLISHED_COMPANY_ID = "demo-company-1-1";
const ALIAS_ID = "test-m6a-alias-1";
const RUN_ID = "test-m6a-run-1";
const NEVER_INSERTED_ALIAS_ID = "test-m6a-alias-should-never-be-inserted";
const NEVER_INSERTED_RUN_ID = "test-m6a-run-should-never-be-inserted";

beforeAll(async () => {
  const supabase = getTestServiceClient();
  await supabase.from("company_aliases").insert({
    id: ALIAS_ID,
    company_id: PUBLISHED_COMPANY_ID,
    alias: "TEST-M6A-ALIAS-VALUE",
    alias_type: "uei",
    normalized_alias: "test-m6a-alias-value-normalized",
  });
  await supabase.from("ingestion_runs").insert({
    id: RUN_ID,
    connector_key: "test_m6a_connector",
    status: "succeeded",
  });
});

afterAll(async () => {
  const supabase = getTestServiceClient();
  await supabase.from("company_aliases").delete().eq("id", ALIAS_ID);
  await supabase.from("company_aliases").delete().eq("id", NEVER_INSERTED_ALIAS_ID);
  await supabase.from("ingestion_runs").delete().eq("id", RUN_ID);
  await supabase.from("ingestion_runs").delete().eq("id", NEVER_INSERTED_RUN_ID);
});

describe("company_aliases RLS", () => {
  it("anon cannot select company_aliases even though a row exists", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("company_aliases").select("id").eq("id", ALIAS_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects an anon INSERT into company_aliases", async () => {
    const supabase = getPublicSupabaseClient();
    const { error } = await supabase.from("company_aliases").insert({
      id: NEVER_INSERTED_ALIAS_ID,
      company_id: PUBLISHED_COMPANY_ID,
      alias: "SHOULD-NEVER-BE-INSERTED",
      alias_type: "uei",
      normalized_alias: "should-never-be-inserted",
    });
    expect(error).not.toBeNull();
  });

  it("rejects an anon UPDATE on company_aliases (no row is changed)", async () => {
    const supabase = getPublicSupabaseClient();
    await supabase.from("company_aliases").update({ alias: "Hijacked" }).eq("id", ALIAS_ID);

    const service = getTestServiceClient();
    const { data } = await service.from("company_aliases").select("alias").eq("id", ALIAS_ID).single();
    expect(data?.alias).not.toBe("Hijacked");
  });

  it("rejects an anon DELETE on company_aliases (the row still exists)", async () => {
    const supabase = getPublicSupabaseClient();
    await supabase.from("company_aliases").delete().eq("id", ALIAS_ID);

    const service = getTestServiceClient();
    const { data } = await service.from("company_aliases").select("id").eq("id", ALIAS_ID);
    expect(data).toHaveLength(1);
  });

  it("an active reviewer can select the company_aliases fixture row", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
    const { data, error } = await primaryClient.from("company_aliases").select("id").eq("id", ALIAS_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("a non-reviewer authenticated user cannot select company_aliases", async () => {
    const nonreviewerClient = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { data, error } = await nonreviewerClient.from("company_aliases").select("id").eq("id", ALIAS_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an inactive reviewer cannot select company_aliases", async () => {
    const inactiveClient = await getSignedInClient(FIXTURE_EMAILS.inactive());
    const { data, error } = await inactiveClient.from("company_aliases").select("id").eq("id", ALIAS_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("ingestion_runs RLS", () => {
  it("anon cannot select ingestion_runs even though a row exists", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("ingestion_runs").select("id").eq("id", RUN_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects an anon INSERT into ingestion_runs", async () => {
    const supabase = getPublicSupabaseClient();
    const { error } = await supabase.from("ingestion_runs").insert({
      id: NEVER_INSERTED_RUN_ID,
      connector_key: "test_m6a_connector",
      status: "running",
    });
    expect(error).not.toBeNull();
  });

  it("rejects an anon UPDATE on ingestion_runs (no row is changed)", async () => {
    const supabase = getPublicSupabaseClient();
    await supabase.from("ingestion_runs").update({ status: "failed" }).eq("id", RUN_ID);

    const service = getTestServiceClient();
    const { data } = await service.from("ingestion_runs").select("status").eq("id", RUN_ID).single();
    expect(data?.status).not.toBe("failed");
  });

  it("rejects an anon DELETE on ingestion_runs (the row still exists)", async () => {
    const supabase = getPublicSupabaseClient();
    await supabase.from("ingestion_runs").delete().eq("id", RUN_ID);

    const service = getTestServiceClient();
    const { data } = await service.from("ingestion_runs").select("id").eq("id", RUN_ID);
    expect(data).toHaveLength(1);
  });

  it("an active reviewer can select the ingestion_runs fixture row", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
    const { data, error } = await primaryClient.from("ingestion_runs").select("id").eq("id", RUN_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("a non-reviewer authenticated user cannot select ingestion_runs", async () => {
    const nonreviewerClient = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { data, error } = await nonreviewerClient.from("ingestion_runs").select("id").eq("id", RUN_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an inactive reviewer cannot select ingestion_runs", async () => {
    const inactiveClient = await getSignedInClient(FIXTURE_EMAILS.inactive());
    const { data, error } = await inactiveClient.from("ingestion_runs").select("id").eq("id", RUN_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
