import { describe, expect, it } from "vitest";
import {
  DIGEST_TOOL_NAMES,
  DIGEST_TOOL_DEFINITIONS,
  LIST_QUEUE_ITEMS_TOOL,
  GET_ITEM_CONTEXT_TOOL,
  listQueueItems,
  getItemContext,
} from "@/lib/digest/tools";
import type { CopilotPromptContext } from "@/lib/copilot/context";

/**
 * Hermetic -- every test here injects its own fake session client / fake
 * context reader. No DB call, no live API call (docs/DECISIONS.md D-096).
 */

interface FakeTableRow {
  [key: string]: unknown;
}

function fakeSessionClient(tables: Record<string, FakeTableRow[]>) {
  return {
    from(table: string) {
      const data = tables[table] ?? [];
      // Minimal thenable query-builder stand-in: supports both
      // `await supabase.from(t).select(...).in(...)` (no .order()) and
      // `await supabase.from(t).select(...).in(...).order(...)` chains,
      // matching tools.ts's actual usage of each table.
      const builder = {
        select: () => builder,
        in: () => builder,
        order: () => Promise.resolve({ data, error: null }),
        then: (resolve: (value: { data: FakeTableRow[]; error: null }) => void) => resolve({ data, error: null }),
      };
      return builder;
    },
  };
}

describe("read-only tool registry", () => {
  it("contains exactly list_queue_items and get_item_context, nothing else", () => {
    expect(DIGEST_TOOL_NAMES).toEqual([LIST_QUEUE_ITEMS_TOOL, GET_ITEM_CONTEXT_TOOL]);
    expect(DIGEST_TOOL_DEFINITIONS.map((t) => t.name)).toEqual([LIST_QUEUE_ITEMS_TOOL, GET_ITEM_CONTEXT_TOOL]);
  });

  it("contains no write/action tool of any kind", () => {
    const forbidden = ["submit_review_action", "record_copilot_analysis", "write", "insert", "update", "delete", "publish", "approve", "reject"];
    for (const name of DIGEST_TOOL_NAMES) {
      for (const bad of forbidden) {
        expect(name.toLowerCase()).not.toContain(bad);
      }
    }
  });

  it("every tool definition has a name, description, and input_schema", () => {
    for (const tool of DIGEST_TOOL_DEFINITIONS) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.input_schema).toBe("object");
    }
  });
});

describe("listQueueItems", () => {
  it("returns only pending/needs-more-evidence items, minimized, with joined signal/company/analysis fields", async () => {
    const getClient = async () =>
      fakeSessionClient({
        research_items: [
          {
            id: "ri-1",
            item_type: "new_signal",
            payload: { target_table: "signals", target_id: "sig-1" },
            status: "pending",
            priority: "high",
            is_demo: true,
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "ri-2",
            item_type: "new_company",
            payload: { target_table: "companies", target_id: "co-2" },
            status: "needs_more_evidence",
            priority: "low",
            is_demo: true,
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        signals: [
          {
            id: "sig-1",
            headline: "Headline",
            verification_status: "unverified",
            publication_status: "draft",
            company_id: "co-1",
          },
        ],
        companies: [{ id: "co-1", name: "Acme Co", publication_status: "draft", is_demo: true }],
        copilot_analyses: [
          {
            research_item_id: "ri-1",
            created_at: "2026-01-03T00:00:00Z",
            suggested_next_step: "leans_approve",
            confidence: "high",
            summary: "A prior analysis summary.",
          },
        ],
      }) as never;

    const items = await listQueueItems({ getClient });

    expect(items).toHaveLength(2);

    const ri1 = items.find((i) => i.researchItemId === "ri-1")!;
    expect(ri1.itemType).toBe("new_signal");
    expect(ri1.signal).toEqual({ headline: "Headline", verificationStatus: "unverified", publicationStatus: "draft" });
    expect(ri1.company).toEqual({ name: "Acme Co", publicationStatus: "draft", isDemo: true });
    expect(ri1.latestAnalysis).toMatchObject({ suggestedNextStep: "leans_approve", confidence: "high" });
    expect(ri1.latestAnalysis!.summarySnippet).toBe("A prior analysis summary.");

    // new_company item is unsupported for signal/company projection -- included minimally, no signal/company/analysis fields.
    const ri2 = items.find((i) => i.researchItemId === "ri-2")!;
    expect(ri2.signal).toBeUndefined();
    expect(ri2.company).toBeUndefined();
    expect(ri2.latestAnalysis).toBeUndefined();
  });

  it("never includes a full payload, review_actions history, reviewer_note, or before/after state", async () => {
    const getClient = async () =>
      fakeSessionClient({
        research_items: [
          {
            id: "ri-1",
            item_type: "new_signal",
            payload: { target_table: "signals", target_id: "sig-1" },
            status: "pending",
            priority: "high",
            is_demo: false,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        signals: [],
        companies: [],
        copilot_analyses: [],
      }) as never;

    const items = await listQueueItems({ getClient });
    const serialized = JSON.stringify(items);
    for (const forbidden of ["review_actions", "reviewer_note", "before_state", "after_state", "payload"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("truncates an overly long prior-analysis summary into a snippet", async () => {
    const longSummary = "x".repeat(500);
    const getClient = async () =>
      fakeSessionClient({
        research_items: [
          {
            id: "ri-1",
            item_type: "new_signal",
            payload: { target_table: "signals", target_id: "sig-1" },
            status: "pending",
            priority: "high",
            is_demo: false,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        signals: [{ id: "sig-1", headline: "H", verification_status: "unverified", publication_status: "draft", company_id: "co-1" }],
        companies: [{ id: "co-1", name: "Co", publication_status: "draft", is_demo: false }],
        copilot_analyses: [
          { research_item_id: "ri-1", created_at: "2026-01-02T00:00:00Z", suggested_next_step: "unclear", confidence: "low", summary: longSummary },
        ],
      }) as never;

    const items = await listQueueItems({ getClient });
    expect(items[0].latestAnalysis!.summarySnippet.length).toBeLessThan(longSummary.length);
  });

  it("returns an empty list when there are no matching items", async () => {
    const getClient = async () => fakeSessionClient({ research_items: [], signals: [], companies: [], copilot_analyses: [] }) as never;
    expect(await listQueueItems({ getClient })).toEqual([]);
  });
});

describe("getItemContext", () => {
  const CONTEXT: CopilotPromptContext = {
    researchItemId: "ri-1",
    signal: { headline: "H", summary: "S", why_it_matters: "W", evidence_strength: "high", verification_status: "unverified" },
    company: { name: "Co", publication_status: "draft", is_demo: false },
    sources: [],
    evidence: [],
  };

  it("returns { found: true, context } when the underlying read succeeds", async () => {
    const result = await getItemContext("ri-1", { getContextImpl: async () => CONTEXT });
    expect(result).toEqual({ found: true, context: CONTEXT });
  });

  it("returns { found: false } gracefully for a missing/unsupported/not-visible item, without throwing", async () => {
    const result = await getItemContext("ri-missing", { getContextImpl: async () => undefined });
    expect(result).toEqual({ found: false });
  });
});
