import { extractAwardFields, buildCandidatePreview, isSkippedRecord, type TaggedRawAward } from "./field-mapping.ts";
import { applyStage1Filter } from "./stage1-filter.ts";
import { previewEntityDecision, type BatchAliasMap } from "./entity-resolution-preview.ts";
import type { CandidatePreview, EntityAliasRecord, SkippedRecord } from "./types.ts";

/**
 * The Stage-1-filter -> field-mapping -> entity-preview pipeline for a
 * batch of already-fetched, already-deduped raw award records. Pulled out
 * of the CLI entry point (supabase/connector-usaspending.ts) specifically
 * so it's importable and unit-testable on its own -- the CLI file has a
 * side-effecting top-level `main()` call and must never be imported by a
 * test.
 *
 * `existingAliases` defaults to `[]` (M6B dry-run's original no-DB-
 * dependency design -- intra-batch matching only). M6C's --commit mode
 * passes a real, DB-backed, non-demo-filtered `EntityAliasRecord[]` here
 * (see supabase/connector-usaspending.ts's fetchNonDemoUeiAliases) so
 * previewEntityDecision can propose MATCH against already-known real
 * companies, not just against other awards in the same run. This function
 * itself has no DB dependency either way -- the caller is always
 * responsible for fetching `existingAliases`.
 */
export function processTaggedAwards(
  taggedAwards: TaggedRawAward[],
  batchAliasMap: BatchAliasMap,
  existingAliases: EntityAliasRecord[] = [],
): { candidates: CandidatePreview[]; skipped: SkippedRecord[] } {
  const candidates: CandidatePreview[] = [];
  const skipped: SkippedRecord[] = [];

  for (const { raw, requestKind } of taggedAwards) {
    const fields = extractAwardFields(raw, requestKind);
    const stage1 = applyStage1Filter({
      description: fields.description,
      naicsCode: fields.naicsCode,
      pscCode: fields.pscCode,
      cfdaText: fields.cfdaNumber,
      awardingAgency: fields.awardingAgency,
    });

    if (!stage1.queued) {
      skipped.push({
        reason: stage1.skipReason ?? "excluded",
        requestKind,
        generatedInternalId: fields.generatedInternalId,
        detail: stage1.exclusionReason ?? undefined,
      });
      continue;
    }

    const preview = buildCandidatePreview(fields, requestKind, stage1);

    if (isSkippedRecord(preview)) {
      skipped.push(preview);
      continue;
    }

    const entityPreview = previewEntityDecision(
      {
        recipientName: fields.recipientName,
        recipientUei: fields.recipientUei,
        recipientParentName: fields.recipientParentName,
        recipientParentUei: fields.recipientParentUei,
      },
      existingAliases,
      batchAliasMap,
    );
    preview.entityPreview = entityPreview;

    if (fields.recipientUei) {
      const normalizedUei = fields.recipientUei.trim().toUpperCase();
      if (entityPreview.decision === "NEW") {
        batchAliasMap.set(normalizedUei, `batch:${preview.generatedInternalId}`);
      } else if (entityPreview.decision === "MATCH" && entityPreview.matchedCompanyId) {
        batchAliasMap.set(normalizedUei, entityPreview.matchedCompanyId);
      }
    }

    candidates.push(preview);
  }

  return { candidates, skipped };
}
