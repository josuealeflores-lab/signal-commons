import type { Metadata } from "next";
import { SignalFilterForm } from "@/components/signals/SignalFilterForm";
import { SignalListItem } from "@/components/signals/SignalListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterEqualityNote } from "@/components/ui/FilterEqualityNote";
import { filterSignalViews, getAvailableMonths, getAvailableSignalTypes, getSignalViews } from "@/lib/data/browse";
import { getSectors } from "@/lib/data/repository";
import type { EvidenceStrength, VerificationStatus } from "@/lib/data/schema";

export const metadata: Metadata = {
  title: "Signals — Signal Commons",
  description: "Published signals across all seven sectors, with source-linked evidence.",
};

interface SignalsIndexPageProps {
  searchParams: Promise<{
    sector?: string;
    signalType?: string;
    month?: string;
    evidenceStrength?: string;
    verificationStatus?: string;
  }>;
}

export default async function SignalsIndexPage({ searchParams }: SignalsIndexPageProps) {
  const params = await searchParams;
  const hasActiveFilters = Boolean(
    params.sector || params.signalType || params.month || params.evidenceStrength || params.verificationStatus,
  );

  const [allViews, sectors, signalTypes, months] = await Promise.all([
    getSignalViews(),
    getSectors(),
    getAvailableSignalTypes(),
    getAvailableMonths(),
  ]);
  const filtered = filterSignalViews(allViews, {
    sector: params.sector,
    signalType: params.signalType,
    month: params.month,
    evidenceStrength: params.evidenceStrength as EvidenceStrength | undefined,
    verificationStatus: params.verificationStatus as VerificationStatus | undefined,
  });

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight text-indigo-navy">Signals</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-gray">
          Every published signal in this demo dataset, linked to its company and evidence.
          Draft signals are never shown here.
        </p>

        <div className="mt-6">
          <SignalFilterForm sectors={sectors} signalTypes={signalTypes} months={months} values={params} />
        </div>

        {hasActiveFilters ? (
          <div className="mt-3">
            <FilterEqualityNote />
          </div>
        ) : null}

        <p className="mt-4 text-xs text-slate-gray">
          {filtered.length} of {allViews.length} published signals shown.
        </p>

        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {filtered.length === 0 ? (
            <li className="sm:col-span-2">
              <EmptyState message="No published signals match the selected filters." />
            </li>
          ) : (
            filtered.map((view) => (
              <li key={view.signal.id}>
                <SignalListItem view={view} />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
