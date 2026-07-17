import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CORRECTIONS_EMAIL } from "@/lib/content/site";

const TITLE = "About — Signal Commons";
const DESCRIPTION =
  "What Signal Commons is, what a signal means, and how to report an issue -- in plain language.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-indigo-navy">About</h1>
          <p className="mt-2 text-sm text-slate-gray">
            Frequently asked questions about Signal Commons, in plain language.
          </p>
        </div>

        <Card as="section" aria-labelledby="what-is-signal-commons-heading">
          <h2 id="what-is-signal-commons-heading" className="text-lg font-semibold text-indigo-navy">
            What is Signal Commons?
          </h2>
          <p className="mt-2 text-sm text-ink">
            Signal Commons is a public-interest project that tracks emerging AI adoption
            across seven sectors — politics and civic technology, government operations,
            agriculture, healthcare, education, nonprofits, and climate and energy — using
            sourced evidence and a human-reviewed publication process. Current public
            content is fictional demo data; this is not live monitoring.
          </p>
        </Card>

        <Card as="section" aria-labelledby="what-is-a-signal-heading">
          <h2 id="what-is-a-signal-heading" className="text-lg font-semibold text-indigo-navy">
            What is a signal?
          </h2>
          <p className="mt-2 text-sm text-ink">
            A signal is a single, sourced event — a product launch, a pilot program, or a
            partnership — that points to a company adopting or deploying AI in a specific,
            documented way. Every signal is tied to at least one source, is labeled with an
            evidence-strength and a verification-status rating, and only appears here once a
            human reviewer has approved it for publication.
          </p>
        </Card>

        <Card as="section" aria-labelledby="what-is-evidence-strength-heading">
          <h2 id="what-is-evidence-strength-heading" className="text-lg font-semibold text-indigo-navy">
            What does evidence strength mean?
          </h2>
          <p className="mt-2 text-sm text-ink">
            Evidence strength is a reviewer judgment about how well-supported a signal is —
            High, Medium, or Low — based on how authoritative and independent its sources
            are. It is not a probability. See the{" "}
            <Link
              href="/methodology#evidence-strength-heading"
              className="font-semibold text-deep-teal underline underline-offset-2"
            >
              full evidence-strength definitions
            </Link>{" "}
            on the methodology page for detail.
          </p>
        </Card>

        <Card as="section" aria-labelledby="what-is-verification-status-heading">
          <h2 id="what-is-verification-status-heading" className="text-lg font-semibold text-indigo-navy">
            What does verification status mean?
          </h2>
          <p className="mt-2 text-sm text-ink">
            Verification status is a separate concept from evidence strength — it records
            whether a human reviewer has checked the displayed claim, and what that check
            found: Verified, Partially verified, Unverified, Disputed, or Rejected. See the{" "}
            <Link
              href="/methodology#verification-status-heading"
              className="font-semibold text-deep-teal underline underline-offset-2"
            >
              full verification-status definitions
            </Link>{" "}
            on the methodology page for detail.
          </p>
        </Card>

        <Card as="section" aria-labelledby="why-demo-data-heading">
          <h2 id="why-demo-data-heading" className="text-lg font-semibold text-indigo-navy">
            Why demo data?
          </h2>
          <p className="mt-2 text-sm text-ink">
            Every company, signal, and source referenced on this site today is fictional and
            deterministic — built to test the review workflow before any real record is
            published. This is not live monitoring, and no claim on this site describes a
            real company or a real event.
          </p>
        </Card>

        <Card as="section" aria-labelledby="what-is-ai-assisted-review-heading">
          <h2 id="what-is-ai-assisted-review-heading" className="text-lg font-semibold text-indigo-navy">
            What is AI-assisted review?
          </h2>
          <p className="mt-2 text-sm text-ink">
            The reviewer workflow includes advisory-only AI aids that help a human reviewer
            summarize evidence and triage the review queue. AI never decides, approves,
            rejects, publishes, or verifies any public content on its own — human review
            remains the decision point, always. Live AI is not enabled in this deployed
            environment. See the{" "}
            <Link
              href="/methodology#ai-assisted-review-heading"
              className="font-semibold text-deep-teal underline underline-offset-2"
            >
              full AI-assisted review disclosure
            </Link>{" "}
            on the methodology page for detail.
          </p>
        </Card>

        <Card as="section" aria-labelledby="how-to-report-an-issue-heading">
          <h2 id="how-to-report-an-issue-heading" className="text-lg font-semibold text-indigo-navy">
            How can someone report an issue?
          </h2>
          <p className="mt-2 text-sm text-ink">
            If something on this site is incorrect, outdated, or unclear, report it by
            emailing{" "}
            <a
              href={`mailto:${CORRECTIONS_EMAIL}`}
              className="font-semibold text-deep-teal underline underline-offset-2"
            >
              {CORRECTIONS_EMAIL}
            </a>
            . Corrections are reviewed manually before the public wording changes.
          </p>
        </Card>
      </div>
    </section>
  );
}
