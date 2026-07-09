import { Card } from "@/components/ui/Card";
import { getActivitySeries } from "@/lib/data/dashboard";

function formatMonth(bucket: string): string {
  const [year, month] = bucket.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;
const BAR_GAP = 8;

export function ActivityChart() {
  const series = getActivitySeries();
  const maxCount = Math.max(1, ...series.map((bucket) => bucket.count));
  const barWidth = series.length > 0 ? (CHART_WIDTH - BAR_GAP * (series.length - 1)) / series.length : 0;

  const summary =
    series.length === 0
      ? "No published signal activity is available in this demo dataset."
      : `Published signal activity by month, from ${formatMonth(series[0].month)} to ${formatMonth(series[series.length - 1].month)}.`;

  return (
    <Card as="section" aria-labelledby="activity-chart-heading">
      <h2 id="activity-chart-heading" className="text-lg font-semibold text-indigo-navy">
        Activity over time
      </h2>
      <p className="mt-1 text-xs text-slate-gray">
        Published signal counts by month in this fixed demo dataset.
      </p>

      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`}
        className="mt-4 w-full"
      >
        {series.map((bucket, index) => {
          const barHeight = (bucket.count / maxCount) * CHART_HEIGHT;
          const x = index * (barWidth + BAR_GAP);
          const y = CHART_HEIGHT - barHeight;
          return (
            <g key={bucket.month}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="var(--color-deep-teal)"
                rx={3}
              />
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT + 16}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-slate-gray)"
              >
                {formatMonth(bucket.month)}
              </text>
            </g>
          );
        })}
      </svg>

      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">
          Published signal counts by month, the same data shown in the chart above.
        </caption>
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-slate-gray">
            <th scope="col" className="py-1 pr-4 font-medium">
              Month
            </th>
            <th scope="col" className="py-1 font-medium">
              Published signals
            </th>
          </tr>
        </thead>
        <tbody>
          {series.map((bucket) => (
            <tr key={bucket.month} className="border-b border-border-subtle last:border-0">
              <th scope="row" className="py-1 pr-4 font-normal text-ink">
                {formatMonth(bucket.month)}
              </th>
              <td className="py-1 tabular-nums text-ink">{bucket.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
