/**
 * Deliberately minimal, local prop types (not the full Signal/SourceDocument
 * from @/lib/data/schema) -- this component is shared between public routes
 * (which pass the seed-locked public types) and the reviewer detail route
 * (which passes @/lib/review/queue's ReviewSignal/ReviewSourceDocument,
 * whose `is_demo` is `boolean` rather than the public types' literal
 * `true`). SourceList never reads `is_demo`, so it only declares the fields
 * it actually uses -- both real prop shapes satisfy this structurally,
 * with no cast needed on either call site.
 */
interface SourceListEvidence {
  source_document_id: string;
  support_type: string;
  claim_type: string;
}

interface SourceListSignal {
  evidence: SourceListEvidence[];
}

interface SourceListSourceDocument {
  id: string;
  canonical_url: string;
  source_title: string;
  publisher: string;
  source_tier: string;
  published_at: string | null;
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "an unknown date";
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export interface SourceListProps {
  signal: SourceListSignal;
  sources: SourceListSourceDocument[];
}

/**
 * Renders every evidence entry on a signal alongside its source document.
 * evidence.length is iterated dynamically (currently always 1 per signal
 * in the seed data, but the schema only guarantees "at least 1").
 */
export function SourceList({ signal, sources }: SourceListProps) {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));

  return (
    <ul className="flex flex-col gap-3">
      {signal.evidence.map((evidence, index) => {
        const source = sourcesById.get(evidence.source_document_id);
        if (!source) return null;

        return (
          <li key={`${evidence.source_document_id}-${index}`} className="border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
            <a
              href={source.canonical_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-deep-teal underline underline-offset-2"
            >
              {source.source_title}
            </a>
            <p className="mt-1 text-xs text-slate-gray">
              {source.publisher} &middot; {formatEnumLabel(source.source_tier)} source &middot; published{" "}
              {formatDate(source.published_at)}
            </p>
            <p className="mt-1 text-xs text-slate-gray">
              {formatEnumLabel(evidence.claim_type)} &middot; {formatEnumLabel(evidence.support_type)} this signal
            </p>
          </li>
        );
      })}
    </ul>
  );
}
