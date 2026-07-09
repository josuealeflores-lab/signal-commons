import { getSignalTypeLabel } from "@/lib/content/labels";
import type { Sector } from "@/lib/data/schema";

function formatMonthOption(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface SignalFilterFormProps {
  sectors: Sector[];
  signalTypes: string[];
  months: string[];
  values: {
    sector?: string;
    signalType?: string;
    month?: string;
    evidenceStrength?: string;
    verificationStatus?: string;
  };
}

/** Plain GET form — no client JS required (docs/DECISIONS.md D-027). */
export function SignalFilterForm({ sectors, signalTypes, months, values }: SignalFilterFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="sector" className="text-xs font-medium text-slate-gray">
          Sector
        </label>
        <select
          id="sector"
          name="sector"
          defaultValue={values.sector ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All sectors</option>
          {sectors.map((sector) => (
            <option key={sector.slug} value={sector.slug}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signalType" className="text-xs font-medium text-slate-gray">
          Signal type
        </label>
        <select
          id="signalType"
          name="signalType"
          defaultValue={values.signalType ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All types</option>
          {signalTypes.map((type) => (
            <option key={type} value={type}>
              {getSignalTypeLabel(type)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="month" className="text-xs font-medium text-slate-gray">
          Month
        </label>
        <select
          id="month"
          name="month"
          defaultValue={values.month ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All months</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {formatMonthOption(month)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="evidenceStrength" className="text-xs font-medium text-slate-gray">
          Evidence strength
        </label>
        <select
          id="evidenceStrength"
          name="evidenceStrength"
          defaultValue={values.evidenceStrength ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Any</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="verificationStatus" className="text-xs font-medium text-slate-gray">
          Verification status
        </label>
        <select
          id="verificationStatus"
          name="verificationStatus"
          defaultValue={values.verificationStatus ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Any</option>
          <option value="verified">Verified</option>
          <option value="partially_verified">Partially verified</option>
          <option value="unverified">Unverified</option>
          <option value="disputed">Disputed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-deep-teal px-4 py-1.5 text-sm font-semibold text-white"
      >
        Apply filters
      </button>
    </form>
  );
}
