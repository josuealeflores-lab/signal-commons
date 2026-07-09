import { Card } from "@/components/ui/Card";

export interface KpiCardProps {
  label: string;
  value: number;
  description?: string;
}

export function KpiCard({ label, value, description }: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-gray">{label}</span>
      <span className="text-3xl font-semibold tabular-nums text-ink">
        {value.toLocaleString("en-US")}
      </span>
      {description ? <span className="text-xs text-slate-gray">{description}</span> : null}
    </Card>
  );
}
