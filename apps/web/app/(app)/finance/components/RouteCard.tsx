import type { FinancialRoute, RouteAssessment } from "@lifeline/contracts";
import { AccessibilityScoreView } from "./AccessibilityScore";
import { RiskFlagItem } from "./RiskFlagItem";
import { VerdictBadge } from "./VerdictBadge";
import { formatAmountLabel, formatMoney, formatName } from "../formatters";

export function RouteCard({
  route,
  assessment,
  recommended,
  currency,
}: {
  route: FinancialRoute | undefined;
  assessment: RouteAssessment;
  recommended: boolean;
  currency: string;
}) {
  const name = route?.name ?? assessment.route_id;
  const amountLabel = formatAmountLabel(assessment.fee_label);

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
        recommended ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
      }`}
    >
      {recommended && <div className="bg-emerald-700 px-5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white">Recommended route</div>}
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {route ? formatName(route.type) : "Payment route"}
            </p>
            <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-950">{name}</h3>
          </div>
          <VerdictBadge verdict={assessment.verdict} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">Route fee</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatMoney(currency, assessment.estimated_fee)}</p>
            <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              {amountLabel}
            </span>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-800">Left to use</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">{formatMoney(currency, assessment.usable_value)}</p>
            <span className="mt-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              {amountLabel}
            </span>
          </div>
        </div>

        <AccessibilityScoreView
          score={assessment.accessibility}
          routeName={name}
          recommended={recommended}
        />

        {assessment.flags.length > 0 && (
          <ul className="space-y-2" aria-label={`${name} review flags`}>
            {assessment.flags.map((flag, index) => <RiskFlagItem key={`${flag.code}-${index}`} flag={flag} />)}
          </ul>
        )}

        {route?.estimated_minutes !== undefined && (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Illustrative transfer time: {route.estimated_minutes >= 60 ? `${Math.round(route.estimated_minutes / 60)} hours` : `${route.estimated_minutes} minutes`}
          </p>
        )}
      </div>
    </article>
  );
}
