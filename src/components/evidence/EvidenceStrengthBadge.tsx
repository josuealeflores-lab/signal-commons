import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { EvidenceStrength } from "@/lib/data/schema";

const STRENGTH_CONFIG: Record<EvidenceStrength, { label: string; tone: StatusTone }> = {
  high: { label: "High", tone: "success" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
};

export interface EvidenceStrengthBadgeProps {
  strength: EvidenceStrength;
}

/**
 * Evidence strength = how well-supported the signal is (docs/RESEARCH_METHODOLOGY.md).
 * Only ever High / Medium / Low. "Disputed" is a verification-status value
 * and must never appear here — see VerificationStatusBadge instead
 * (docs/DECISIONS.md D-019).
 */
export function EvidenceStrengthBadge({ strength }: EvidenceStrengthBadgeProps) {
  const config = STRENGTH_CONFIG[strength];
  return <StatusPill label={config.label} tone={config.tone} srPrefix="Evidence strength" />;
}
