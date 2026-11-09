import type { FinanceResult } from "@lifeline/contracts";
import { formatAmountLabel, formatMoney } from "../formatters";
import { SAMPLE_REQUEST } from "../finance-sample";

export function AssessmentSummary({ result }: { result: FinanceResult }) {
  const recommendedRoute = result.routes.find((route) => route.route_id === result.recommended_route_id);
  const routeName = SAMPLE_REQUEST.routes.find((route) => route.id === result.recommended_route_id)?.name
    ?? result.recommended_route_id;

  return (
    <>
      {recommendedRoute ? (
        <section className="grid gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-[auto_1fr] sm:items-start sm:p-6" aria-label="Recommended route summary">
          <div className="grid size-11 place-items-center rounded-2xl bg-emerald-700 text-xl text-white" aria-hidden="true">✓</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Recommended route</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-emerald-950">{routeName}</h2>
            <p className="mt-1 text-sm text-emerald-900">
              {formatMoney(result.currency, recommendedRoute.usable_value)} remains usable after the route fee.
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-800">
              Amount label: {formatAmountLabel(recommendedRoute.fee_label)}
            </p>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950" aria-label="No route passed">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Human review needed</p>
          <h2 className="mt-1 text-xl font-bold">No route passed the checks.</h2>
          <p className="mt-1 text-sm">Review the route flags before deciding how to proceed.</p>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="explanation-heading">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span className="grid size-6 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">i</span>
          Explainable assessment
        </div>
        <h2 id="explanation-heading" className="sr-only">Assessment explanation</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base">{result.explanation}</p>
      </section>
    </>
  );
}
