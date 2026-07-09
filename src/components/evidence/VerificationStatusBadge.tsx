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
}

/**
 * Verification status = whether the displayed claim has been checked,
 * confirmed, or disputed (docs/RESEARCH_METHODOLOGY.md) — a separate axis
 * from evidence strength. "Verified" here does not certify the company,
 * product, future performance, or social impact — only that the displayed
 * wording is supported (docs/DECISIONS.md D-019).
 */
export function VerificationStatusBadge({ status }: VerificationStatusBadgeProps) {
  const config = VERIFICATION_CONFIG[status];
  return <StatusPill label={config.label} tone={config.tone} srPrefix="Verification status" />;
}
