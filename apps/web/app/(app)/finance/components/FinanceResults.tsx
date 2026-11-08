import type { FinanceResult } from "@lifeline/contracts";
import { SAMPLE_REQUEST } from "../finance-sample";
import { AssessmentSummary } from "./AssessmentSummary";
import { RouteCard } from "./RouteCard";

export function FinanceResults({ result }: { result: FinanceResult }) {
  return (
    <>
      <AssessmentSummary result={result} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Route comparison</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Three ways to deliver support</h2>
        </div>
        <p className="text-xs text-slate-500">Amounts are estimates or illustrative examples unless marked confirmed.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {result.routes.map((assessment) => (
          <RouteCard
            key={assessment.route_id}
            assessment={assessment}
            route={SAMPLE_REQUEST.routes.find((route) => route.id === assessment.route_id)}
            recommended={assessment.route_id === result.recommended_route_id}
            currency={result.currency}
          />
        ))}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Illustrative fee ranges are review signals, not proof of wrongdoing. Unknown access is not treated as available, and the score does not determine aid priority.
      </p>
    </>
  );
}
