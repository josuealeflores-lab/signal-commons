import Link from "next/link";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { EvidenceStrength } from "@/lib/data/schema";

const STRENGTH_CONFIG: Record<EvidenceStrength, { label: string; tone: StatusTone }> = {
  high: { label: "High", tone: "success" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
};

export interface EvidenceStrengthBadgeProps {
  strength: EvidenceStrength;
  /**
   * Wraps the badge in a link to its methodology definition
   * (docs/DECISIONS.md D-099). Only pass this where the badge is not
   * already nested inside another link (e.g. a list item's card link) --
   * nesting an <a> inside another <a> is invalid HTML. Safe on standalone
   * detail pages (signal/company); left false (default) everywhere a badge
   * renders inside a card-level Link, e.g. SignalListItem/CompanyListItem.
   */
  linked?: boolean;
}

/**
 * Evidence strength = how well-supported the signal is (docs/RESEARCH_METHODOLOGY.md).
 * Only ever High / Medium / Low. "Disputed" is a verification-status value
 * and must never appear here — see VerificationStatusBadge instead
 * (docs/DECISIONS.md D-019).
 */
export function EvidenceStrengthBadge({ strength, linked = false }: EvidenceStrengthBadgeProps) {
  const config = STRENGTH_CONFIG[strength];
  const badge = <StatusPill label={config.label} tone={config.tone} srPrefix="Evidence strength" />;

  if (!linked) return badge;

  return (
    <Link
      href="/methodology#evidence-strength-heading"
      className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
      aria-label={`Evidence strength: ${config.label}. Learn how this is defined.`}
    >
      {badge}
    </Link>
  );
}
