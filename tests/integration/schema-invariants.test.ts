import { afterEach, describe, expect, it } from "vitest";
import { getTestServiceClient } from "./test-service-client";

/**
 * Exercises the Milestone 6A Option-B safety invariant (docs/DECISIONS.md
 * D-090): a signal cannot be inserted or updated as publication_status =
 * 'published' unless its company already has publication_status =
 * 'published'. Uses the service-role client deliberately — service_role
 * bypasses RLS but not triggers, which is exactly the property this
 * invariant depends on: a future connector script writing as service_role
 * must be caught by this trigger just as reliably as any other caller.
 *
 * Each test uses its own dedicated, never-colliding throwaway company/signal
 * fixture pair (never a seed/demo-data.json id). `afterEach` unconditionally
 * attempts to delete every fixture id used across this file, so a failed
 * assertion mid-test still doesn't leave permanent test pollution.
 */

const FIXTURE_PAIRS: Array<{ companyId: string; signalId: string }> = [
  { companyId: "test-m6a-company-insert-draft", signalId: "test-m6a-signal-insert-draft" },
  { companyId: "test-m6a-company-update-draft", signalId: "test-m6a-signal-update-draft" },
  { companyId: "test-m6a-company-published", signalId: "test-m6a-signal-publishable" },
];

async function insertCompany(id: string, publicationStatus: "draft" | "published"): Promise<void> {
  const supabase = getTestServiceClient();
  const { error } = await supabase.from("companies").insert({
    id,
    slug: id,
    name: `Test M6A Company (${id})`,
    summary: "Throwaway fixture company for the Milestone 6A publish-invariant tests.",
    why_it_matters: "Throwaway fixture company for the Milestone 6A publish-invariant tests.",
    company_type: "startup",
    stage: "seed",
    publication_status: publicationStatus,
  });
  if (error) throw error;
}

async function insertDraftSignal(id: string, companyId: string): Promise<void> {
  const supabase = getTestServiceClient();
  const { error } = await supabase.from("signals").insert({
    id,
    company_id: companyId,
    signal_type: "product_launch",
    headline: "Throwaway M6A fixture signal",
    summary: "Throwaway M6A fixture signal.",
    why_it_matters: "Throwaway M6A fixture signal.",
    detected_at: new Date().toISOString(),
    evidence_strength: "low",
    verification_status: "unverified",
    publication_status: "draft",
    created_by_type: "import",
  });
  if (error) throw error;
}

afterEach(async () => {
  const supabase = getTestServiceClient();
  for (const { companyId, signalId } of FIXTURE_PAIRS) {
    await supabase.from("signals").delete().eq("id", signalId);
    await supabase.from("companies").delete().eq("id", companyId);
  }
});

describe("Option-B safety invariant: signals_require_published_company", () => {
  it("cannot insert a signal directly as published when its company is a draft", async () => {
    const { companyId, signalId } = FIXTURE_PAIRS[0];
    await insertCompany(companyId, "draft");

    const supabase = getTestServiceClient();
    const { error } = await supabase.from("signals").insert({
      id: signalId,
      company_id: companyId,
      signal_type: "product_launch",
      headline: "Throwaway M6A fixture signal",
      summary: "Throwaway M6A fixture signal.",
      why_it_matters: "Throwaway M6A fixture signal.",
      detected_at: new Date().toISOString(),
      evidence_strength: "low",
      verification_status: "unverified",
      publication_status: "published",
      created_by_type: "import",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/cannot publish signal/i);
  });

  it("cannot update a signal to published when its company is a draft", async () => {
    const { companyId, signalId } = FIXTURE_PAIRS[1];
    await insertCompany(companyId, "draft");
    await insertDraftSignal(signalId, companyId);

    const supabase = getTestServiceClient();
    const { error } = await supabase.from("signals").update({ publication_status: "published" }).eq("id", signalId);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/cannot publish signal/i);

    const { data } = await supabase.from("signals").select("publication_status").eq("id", signalId).single();
    expect(data?.publication_status).toBe("draft");
  });

  it("can publish a signal once its company is published", async () => {
    const { companyId, signalId } = FIXTURE_PAIRS[2];
    await insertCompany(companyId, "published");
    await insertDraftSignal(signalId, companyId);

    const supabase = getTestServiceClient();
    const { error } = await supabase.from("signals").update({ publication_status: "published" }).eq("id", signalId);

    expect(error).toBeNull();

    const { data } = await supabase.from("signals").select("publication_status").eq("id", signalId).single();
    expect(data?.publication_status).toBe("published");
  });
});
