import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import {
  EVIDENCE_STRENGTH_DEFINITIONS,
  VERIFICATION_STATUS_DEFINITIONS,
  VERIFIED_DISCLAIMER,
} from "@/lib/content/labels";

export const metadata: Metadata = {
  title: "Methodology — Signal Commons",
  description: "How Signal Commons evaluates evidence, verifies claims, and reviews content.",
};

const SOURCE_TIERS = [
  {
    tier: "Tier 1 — Primary or authoritative",
    examples:
      "Official government award or procurement records, regulatory filings, official company filings or investor material, official customer announcements, published research or technical documentation, direct public contract or meeting records.",
  },
  {
    tier: "Tier 2 — Credible independent reporting",
    examples:
      "Established news organizations, respected industry publications, reputable research organizations, independently authored customer case studies.",
  },
  {
    tier: "Tier 3 — Company-controlled or interested-party material",
    examples:
      "Company blogs, founder posts, press releases, investor portfolio pages, accelerator profiles. Useful for discovery and company claims, but always labeled accordingly — not treated as independent confirmation.",
  },
  {
    tier: "Tier 4 — Community and weakly verified material",
    examples:
      "Unsourced social posts, discussion forums, scraped directories with unclear provenance, reposts without an original source. Used only as a lead, never as the sole support for a consequential claim.",
  },
];

export default function MethodologyPage() {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-indigo-navy">Methodology</h1>
          <p className="mt-2 text-sm text-slate-gray">
            How Signal Commons evaluates evidence, verifies claims, and keeps a human in the
            loop before anything is published.
          </p>
        </div>

        <Card as="section" aria-labelledby="demo-data-heading">
          <h2 id="demo-data-heading" className="text-lg font-semibold text-indigo-navy">
            This dashboard uses demo data
          </h2>
          <p className="mt-2 text-sm text-ink">
            Every company, signal, and source referenced on this site is fictional and
            deterministic — built for demonstration and workflow testing, not to represent
            real companies or real events. This is not live monitoring.
          </p>
        </Card>

        <Card as="section" aria-labelledby="source-tiers-heading">
          <h2 id="source-tiers-heading" className="text-lg font-semibold text-indigo-navy">
            Source tiers
          </h2>
          <p className="mt-1 text-sm text-slate-gray">
            Every source behind a signal is classified into one of four tiers, based on how
            authoritative and independent it is.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {SOURCE_TIERS.map(({ tier, examples }) => (
              <li key={tier}>
                <p className="text-sm font-semibold text-ink">{tier}</p>
                <p className="mt-1 text-sm text-slate-gray">{examples}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="evidence-strength-heading">
          <h2 id="evidence-strength-heading" className="text-lg font-semibold text-indigo-navy">
            Evidence strength
          </h2>
          <p className="mt-1 text-sm text-slate-gray">
            A reviewer-facing judgment about how well-supported a signal is. It is not a
            probability.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {EVIDENCE_STRENGTH_DEFINITIONS.map(({ strength, description }) => (
              <li key={strength} className="flex items-start gap-2 text-sm">
                <EvidenceStrengthBadge strength={strength} />
                <span className="text-ink">{description}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="verification-status-heading">
          <h2 id="verification-status-heading" className="text-lg font-semibold text-indigo-navy">
            Verification status
          </h2>
          <p className="mt-1 text-sm text-slate-gray">
            A separate concept from evidence strength — whether a human reviewer has checked
            the displayed claim, and what that check found.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {VERIFICATION_STATUS_DEFINITIONS.map(({ status, description }) => (
              <li key={status} className="flex items-start gap-2 text-sm">
                <VerificationStatusBadge status={status} />
                <span className="text-ink">{description}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-gray">{VERIFIED_DISCLAIMER}</p>
        </Card>

        <Card as="section" aria-labelledby="human-review-heading">
          <h2 id="human-review-heading" className="text-lg font-semibold text-indigo-navy">
            Human review
          </h2>
          <p className="mt-2 text-sm text-ink">
            AI-assisted or imported research can create draft records, but a draft can never
            become public on its own. A human reviewer must approve, edit-and-approve,
            reject, mark as disputed, or request more evidence before anything reaches this
            site. Draft and in-review content is never shown on public pages.
          </p>
        </Card>

        <Card as="section" aria-labelledby="limitations-heading">
          <h2 id="limitations-heading" className="text-lg font-semibold text-indigo-navy">
            Limitations
          </h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-ink">
            <li>Signal Commons does not rank companies or produce an overall success score.</li>
            <li>Funding or investment activity is not treated as proof of impact.</li>
            <li>Attention or coverage is not treated as evidence of real-world adoption.</li>
            <li>
              Signal Commons does not offer investment advice or predict future company
              performance.
            </li>
            <li>
              This is an early, demo-data version of the product — coverage is intentionally
              small and deterministic while the review workflow is being built and tested.
            </li>
          </ul>
        </Card>

        <Card as="section" aria-labelledby="corrections-heading">
          <h2 id="corrections-heading" className="text-lg font-semibold text-indigo-navy">
            Corrections
          </h2>
          <p className="mt-2 text-sm text-ink">
            If something on this site is inaccurate, it should be reported so a reviewer can
            examine it. A correction preserves the prior state in the audit trail, identifies
            the specific field or claim being corrected, includes a reviewer note, and updates
            the public wording promptly — disputed history is not silently removed when it
            remains material to understanding a claim.
          </p>
        </Card>
      </div>
    </section>
  );
}
