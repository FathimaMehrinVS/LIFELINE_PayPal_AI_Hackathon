import type { RouteAssessment } from "@lifeline/contracts";

const VERDICT_STYLE = {
  pass: { label: "Pass", classes: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  review: { label: "Review", classes: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  block: { label: "Block", classes: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" },
} as const;

export function VerdictBadge({ verdict }: { verdict: RouteAssessment["verdict"] }) {
  const style = VERDICT_STYLE[verdict];

  return (
    <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${style.classes}`}>
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
