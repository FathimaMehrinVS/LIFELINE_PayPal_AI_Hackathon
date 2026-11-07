import type { AccessibilityScore } from "@lifeline/contracts";
import { formatName } from "../formatters";

export function AccessibilityScoreView({
  score,
  routeName,
  recommended,
}: {
  score: AccessibilityScore;
  routeName: string;
  recommended: boolean;
}) {
  return (
    <section aria-label={`${routeName} accessibility score`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Access score</p>
          <p className="text-xs text-slate-500">Version {score.version}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-950">
          {score.score}<span className="text-sm font-semibold text-slate-400"> / 100</span>
        </p>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${routeName} accessibility score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score.score}
      >
        <div
          className={`h-full rounded-full ${recommended ? "bg-emerald-600" : "bg-slate-500"}`}
          style={{ width: `${score.score}%` }}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Score factors">
        {score.factors.map((factor) => (
          <li key={factor.factor} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600">
            <span className="font-semibold capitalize">{formatName(factor.factor)}</span>
            <span className="text-slate-400"> · {factor.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
