import { SAMPLE_REQUEST } from "../finance-sample";
import { formatMoney } from "../formatters";

export function FinancePageHeader({
  loading,
  hasResult,
  onEvaluate,
}: {
  loading: boolean;
  hasResult: boolean;
  onEvaluate: () => void;
}) {
  return (
    <header className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-900/10">
      <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:p-11">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
            Financial access · sample scenario
          </p>
          <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Find a route the family can actually use.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Compare fees, practical access and the amount left after each route. Scores explain access conditions; they never decide who receives help.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sample contribution</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(SAMPLE_REQUEST.currency, SAMPLE_REQUEST.amount)}</p>
            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
              Illustrative example
            </span>
          </div>
          <button
            type="button"
            onClick={onEvaluate}
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/40 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" aria-hidden="true" />
                Assessing routes…
              </>
            ) : hasResult ? "Refresh assessment" : "Evaluate sample routes"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 px-6 py-3 text-xs text-slate-400 sm:px-9 lg:px-11">
        <span>Bank access unavailable</span>
        <span>Wallet accepted</span>
        <span>Connectivity limited</span>
      </div>
    </header>
  );
}
