import { describe, expect, it } from "vitest";
import { getTestServiceClient } from "./test-service-client";

/**
 * Uses the service-role client deliberately — RLS makes draft rows
 * structurally invisible to the anon client, so verifying full
 * (draft + published) row counts requires bypassing RLS. This is the one
 * integration test file that intentionally does not use the anon client,
 * per the "unless explicitly testing seed/setup behavior" exception
 * (docs/DECISIONS.md D-046/D-049) — it verifies reseed_demo_data's own
 * post-seed guarantees from outside the database, not app-level behavior.
 */

async function countRows(table: string): Promise<number> {
  const supabase = getTestServiceClient();
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  expect(error).toBeNull();
  return count ?? 0;
}

async function countSignalsByStatus(status: "published" | "draft"): Promise<number> {
  const supabase = getTestServiceClient();
  const { count, error } = await supabase
    .from("signals")
    .select("*", { count: "exact", head: true })
    .eq("publication_status", status);
  expect(error).toBeNull();
  return count ?? 0;
}

describe("seeded row counts (service-role client, bypasses RLS)", () => {
  it("sectors: 7", async () => {
    expect(await countRows("sectors")).toBe(7);
  });

  it("companies: 21", async () => {
    expect(await countRows("companies")).toBe(21);
  });

  it("signals: 21 total", async () => {
    expect(await countRows("signals")).toBe(21);
  });

  it("signals: 14 published", async () => {
    expect(await countSignalsByStatus("published")).toBe(14);
  });

  it("signals: 7 draft", async () => {
    expect(await countSignalsByStatus("draft")).toBe(7);
  });

  it("source_documents: 21", async () => {
    expect(await countRows("source_documents")).toBe(21);
  });

  it("signal_evidence: 21", async () => {
    expect(await countRows("signal_evidence")).toBe(21);
  });

  it("company_sectors: 21", async () => {
    expect(await countRows("company_sectors")).toBe(21);
  });

  it("app_meta: 1", async () => {
    expect(await countRows("app_meta")).toBe(1);
  });

  it("company_aliases: 0", async () => {
    expect(await countRows("company_aliases")).toBe(0);
  });

  it("ingestion_runs: 0", async () => {
    expect(await countRows("ingestion_runs")).toBe(0);
  });
});

describe("research_items.is_demo defaults (service-role client, bypasses RLS)", () => {
  it("every research_items row has is_demo = true", async () => {
    const supabase = getTestServiceClient();

    const { count: totalCount, error: totalError } = await supabase
      .from("research_items")
      .select("*", { count: "exact", head: true });
    expect(totalError).toBeNull();

    const { count: falseCount, error: falseError } = await supabase
      .from("research_items")
      .select("*", { count: "exact", head: true })
      .eq("is_demo", false);
    expect(falseError).toBeNull();
    expect(falseCount).toBe(0);

    const { count: trueCount, error: trueError } = await supabase
      .from("research_items")
      .select("*", { count: "exact", head: true })
      .eq("is_demo", true);
    expect(trueError).toBeNull();
    expect(trueCount).toBe(totalCount);
  });
});
