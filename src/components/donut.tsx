import { CHART_COLORS } from "@/lib/constants";
import { formatHkd } from "@/lib/format";

export type Slice = { id: string; label: string; value: number };

export function colorFor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function Donut({
  slices,
  center,
}: {
  slices: Slice[];
  center: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 3 : 0;
  const portions = slices.map((slice) => (slice.value / total) * circumference);
  const segments = slices.map((slice, index) => {
    const raw = portions[index] ?? 0;
    const offset = portions.slice(0, index).reduce((sum, value) => sum + value, 0);
    return { ...slice, length: Math.max(0, raw - gap), offset, color: colorFor(index) };
  });
  const summary = slices.map((slice) => `${slice.label} ${formatHkd(slice.value)}`).join("，");

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="size-32 shrink-0" role="img" aria-label={summary}>
        <g transform="rotate(-90 60 60)">
          {segments.map((segment) => (
            <circle
              key={segment.id}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
        <text x="60" y="58" textAnchor="middle" className="fill-foreground" fontSize="11">
          {center}
        </text>
        <text x="60" y="74" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
          合計
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <li key={segment.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatHkd(segment.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
