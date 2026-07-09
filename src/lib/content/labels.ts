import type { EvidenceStrength, VerificationStatus } from "@/lib/data/schema";

/**
 * Shared display copy reused across the dashboard, browse/filter UIs, and
 * the methodology page, so wording can't drift out of sync between pages.
 *
 * Signal-type and company-type labels only cover the values actually
 * present in seed/demo-data.json today (confirmed by direct inspection),
 * not the full documented taxonomies in docs/PRODUCT_REQUIREMENTS.md —
 * inventing label entries (and snake_case key spellings) for values that
 * don't exist in any data yet isn't grounded in anything verifiable. Filter
 * option lists themselves are derived at runtime from the loaded dataset
 * (see src/lib/data/browse.ts getAvailableSignalTypes/getAvailableCompanyTypes),
 * not from this map (docs/DECISIONS.md D-026) — getSignalTypeLabel/
 * getCompanyTypeLabel fall back to the raw value for anything unmapped, so
 * new values that appear in future data still render (just unprettified)
 * without needing this file updated first.
 */
export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  product_launch: "Product launch",
  pilot_program: "Pilot program",
  partnership: "Partnership",
};

export function getSignalTypeLabel(signalType: string): string {
  return SIGNAL_TYPE_LABELS[signalType] ?? signalType;
}

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  agent_enabled: "Agent-enabled",
  ai_application: "AI application",
  agent_product: "Agent product",
  agent_native: "Agent-native",
};

export function getCompanyTypeLabel(companyType: string): string {
  return COMPANY_TYPE_LABELS[companyType] ?? companyType;
}

export interface EvidenceStrengthDefinition {
  strength: EvidenceStrength;
  description: string;
}

/** Verbatim (lightly trimmed) from docs/RESEARCH_METHODOLOGY.md. */
export const EVIDENCE_STRENGTH_DEFINITIONS: EvidenceStrengthDefinition[] = [
  {
    strength: "high",
    description:
      "The event is directly documented by an authoritative source, or multiple independent credible sources strongly corroborate it.",
  },
  {
    strength: "medium",
    description:
      "One credible source supports the event, or several indirect sources align, but important details remain unavailable.",
  },
  {
    strength: "low",
    description:
      "The event is early, company-reported, ambiguous, based on a weak source, or lacking independent confirmation.",
  },
];

export interface VerificationStatusDefinition {
  status: VerificationStatus;
  description: string;
}

/** Verbatim (lightly trimmed) from docs/RESEARCH_METHODOLOGY.md. */
export const VERIFICATION_STATUS_DEFINITIONS: VerificationStatusDefinition[] = [
  { status: "verified", description: "A human reviewer confirmed the displayed wording is supported." },
  { status: "partially_verified", description: "The core event is supported, but some details remain uncertain." },
  { status: "unverified", description: "Extracted or submitted, but not yet reviewed." },
  { status: "disputed", description: "Credible evidence conflicts with this claim." },
  { status: "rejected", description: "Unsupported, duplicate, irrelevant, or materially misleading." },
];

export const VERIFIED_DISCLAIMER =
  "“Verified” means the displayed claim is supported by available evidence. It does not certify the company, product, future performance, or social impact.";
