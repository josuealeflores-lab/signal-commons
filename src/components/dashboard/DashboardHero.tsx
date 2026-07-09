import { getMeta } from "@/lib/data/repository";

function formatAsOf(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DashboardHero() {
  const meta = getMeta();
  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-indigo-navy sm:text-4xl">
            Emerging AI Impact Radar
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-gray">
            Discover lesser-known AI companies shaping essential sectors through
            transparent, source-linked evidence.
          </p>
        </div>
        <p className="text-sm text-slate-gray">
          Demo dataset reference date: <span className="font-medium text-ink">{formatAsOf(meta.as_of)}</span>
        </p>
      </div>
    </section>
  );
}
