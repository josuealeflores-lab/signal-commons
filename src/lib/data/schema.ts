import { z } from "zod";

/**
 * Schemas match the actual shape of seed/demo-data.json, not the full
 * aspirational field list in docs/DATA_MODEL.md (e.g. sectors here have no
 * `id`/`created_at`). Enums for company_type/stage/signal_type/source_type/
 * source_tier are scoped to values currently observed in the seed file;
 * evidence_strength/verification_status/publication_status/claim_type/
 * support_type/created_by_type use the full documented enum since
 * docs/RESEARCH_METHODOLOGY.md and docs/PRODUCT_REQUIREMENTS.md define them
 * exhaustively even where the demo data doesn't exercise every value.
 */

export const sectorSlugSchema = z.enum([
  "politics-civic-technology",
  "government-operations",
  "agriculture",
  "healthcare",
  "education",
  "nonprofits",
  "climate-energy",
]);

export const evidenceStrengthSchema = z.enum(["low", "medium", "high"]);

export const verificationStatusSchema = z.enum([
  "unverified",
  "partially_verified",
  "verified",
  "disputed",
  "rejected",
]);

export const publicationStatusSchema = z.enum([
  "draft",
  "in_review",
  "published",
  "archived",
]);

export const claimTypeSchema = z.enum([
  "official_record",
  "company_claim",
  "independent_report",
  "analysis",
  "community_report",
]);

export const supportTypeSchema = z.enum([
  "supports",
  "contradicts",
  "context_only",
]);

export const createdByTypeSchema = z.enum(["human", "ai", "import"]);

export const companyTypeSchema = z.enum([
  "agent_enabled",
  "agent_native",
  "agent_product",
  "ai_application",
  "unclear",
]);

export const companyStageSchema = z.enum([
  "discovery",
  "early_deployment",
  "emerging",
]);

export const metaSchema = z.object({
  dataset_name: z.string(),
  is_demo: z.literal(true),
  warning: z.string(),
  generated_for: z.string(),
  as_of: z.string(),
});

export const sectorSchema = z.object({
  slug: sectorSlugSchema,
  name: z.string(),
  icon_key: z.string(),
  display_order: z.number().int().positive(),
});

export const companySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  company_type: companyTypeSchema,
  stage: companyStageSchema,
  primary_sector_slug: sectorSlugSchema,
  is_demo: z.literal(true),
  publication_status: publicationStatusSchema,
});

export const sourceDocumentSchema = z.object({
  id: z.string(),
  canonical_url: z.string().url(),
  source_title: z.string(),
  publisher: z.string(),
  source_type: z.string(),
  source_tier: z.string(),
  published_at: z.string(),
  retrieved_at: z.string(),
  is_demo: z.literal(true),
});

export const signalEvidenceSchema = z.object({
  source_document_id: z.string(),
  support_type: supportTypeSchema,
  claim_type: claimTypeSchema,
  supporting_passage: z.string(),
});

export const signalSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  signal_type: z.string(),
  headline: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  occurred_at: z.string(),
  detected_at: z.string(),
  evidence_strength: evidenceStrengthSchema,
  verification_status: verificationStatusSchema,
  publication_status: publicationStatusSchema,
  is_demo: z.literal(true),
  created_by_type: createdByTypeSchema,
  evidence: z.array(signalEvidenceSchema).min(1),
});

export const demoDataSchema = z.object({
  meta: metaSchema,
  sectors: z.array(sectorSchema).length(7),
  companies: z.array(companySchema),
  source_documents: z.array(sourceDocumentSchema),
  signals: z.array(signalSchema),
});

export type Meta = z.infer<typeof metaSchema>;
export type Sector = z.infer<typeof sectorSchema>;
export type Company = z.infer<typeof companySchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type SignalEvidence = z.infer<typeof signalEvidenceSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type DemoData = z.infer<typeof demoDataSchema>;
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
