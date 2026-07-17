import Link from "next/link";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { VerificationStatus } from "@/lib/data/schema";

const VERIFICATION_CONFIG: Record<VerificationStatus, { label: string; tone: StatusTone }> = {
  verified: { label: "Verified", tone: "success" },
  partially_verified: { label: "Partially verified", tone: "warning" },
  unverified: { label: "Unverified", tone: "neutral" },
  disputed: { label: "Disputed", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
};

export interface VerificationStatusBadgeProps {
  status: VerificationStatus;
  /**
   * Wraps the badge in a link to its methodology definition
   * (docs/DECISIONS.md D-099). Only pass this where the badge is not
   * already nested inside another link -- nesting an <a> inside another <a>
   * is invalid HTML. See EvidenceStrengthBadge's `linked` for the same
   * rationale.
   */
  linked?: boolean;
}

/**
 * Verification status = whether the displayed claim has been checked,
 * confirmed, or disputed (docs/RESEARCH_METHODOLOGY.md) — a separate axis
 * from evidence strength. "Verified" here does not certify the company,
 * product, future performance, or social impact — only that the displayed
 * wording is supported (docs/DECISIONS.md D-019).
 */
export function VerificationStatusBadge({ status, linked = false }: VerificationStatusBadgeProps) {
  const config = VERIFICATION_CONFIG[status];
  const badge = <StatusPill label={config.label} tone={config.tone} srPrefix="Verification status" />;

  if (!linked) return badge;

  return (
    <Link
      href="/methodology#verification-status-heading"
      className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
      aria-label={`Verification status: ${config.label}. Learn how this is defined.`}
    >
      {badge}
    </Link>
  );
}
