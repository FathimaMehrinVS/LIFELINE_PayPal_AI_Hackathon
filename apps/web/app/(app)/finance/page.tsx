"use client";

import type { Availability, CaseResult } from "@lifeline/contracts";
import Link from "next/link";
import { AiPanel, Badge, type BadgeTone, Card, button } from "@/components/ui";
import { caseRef, formatMoney, recommendedRoute, routeName } from "../dashboard/case-row";
import { CasePicker, useSelectedCase } from "../dashboard/use-cases";
import { plainReason } from "../situation/case-outcome";

// Owner: Member 2 (rules), Member 1 (this view). Styled from "LIFELINE Screen Designs" page 12. Shows a real case's saved assessment.

const VERDICT: Record<string, { label: string; tone: BadgeTone }> = {
  pass: { label: "Pass", tone: "success" },
  review: { label: "Needs Review", tone: "warning" },
  block: { label: "Blocked", tone: "critical" },
};

const ACCESS_LABEL: Record<string, string> = { bank_availability: "bank", atm_access: "ATM", wallet_acceptance: "mobile wallet", cash_availability: "cash", merchant_acceptance: "local shops", connectivity: "internet or phone" };

function accessSummary(item: CaseResult, wanted: Availability) {
  return Object.entries(item.situation.access).filter(([, value]) => value === wanted).map(([key]) => ACCESS_LABEL[key] ?? key);
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const hasAssessment = (item: CaseResult) => item.finance !== null;

export default function FinancialAssessmentPage() {
  const { cases, selected, setSelectedId, error } = useSelectedCase(hasAssessment);

  if (error) return <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>;
  if (!cases) return <p className="text-slate-600">Loading…</p>;
  if (!selected?.finance) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-[28px] font-bold text-navy">Financial Accessibility &amp; Trust Assessment</h1>
        <p className="mt-2 text-slate-600">No case has been assessed yet. Record a case to compare its payment routes.</p>
        <Link href="/situation" className={`${button.primary} mt-5`}>New case</Link>
      </Card>
    );
  }

  const { finance, situation } = selected;
  const route = recommendedRoute(selected);
  const budget = situation.budget ?? 0;
  const unavailable = accessSummary(selected, "unavailable");
  const available = accessSummary(selected, "available");
  const concerns = finance.routes.filter((item) => item.verdict !== "pass");

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy">Financial Accessibility &amp; Trust Assessment</h1>
          <p className="text-slate-600">Case <span className="font-mono">{caseRef(selected.case_id)}</span>{situation.location ? ` · ${situation.location}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CasePicker cases={cases} value={selected.case_id} onChange={setSelectedId} />
          <Link href={`/commerce?case=${encodeURIComponent(selected.case_id)}`} className={button.primary}>View product basket</Link>
        </div>
      </header>

      <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-navy"><strong>Scores are calculated by deterministic rules</strong> (fees, availability, verification, recipient access). AI does not set or change the score. It only explains the result.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-slate-600">Assistance budget</p><p className="tabular text-3xl font-bold text-navy">{formatMoney(budget, finance.currency)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-600">Currency</p><p className="text-3xl font-bold text-navy">{finance.currency}</p></Card>
        <Card className="p-5">
          <p className="text-sm text-slate-600">Recipient access</p>
          <p className="mt-1 text-sm font-semibold text-navy">{unavailable.length ? `No ${unavailable.join(", no ")}` : "No access reported as unavailable"}</p>
          {available.length > 0 && <p className="text-[13px] text-slate-600">Can use: {available.join(", ")}</p>}
        </Card>
        <section className={`rounded-2xl bg-white p-5 ${route ? "border-2 border-teal" : "border border-slate-200"}`}>
          <p className="text-sm font-semibold text-teal-text">Accessibility score{route ? " · recommended" : ""}</p>
          <p className="text-3xl font-bold text-navy">{route ? route.accessibility.score : "—"}<span className="text-lg font-medium text-slate-500"> / 100</span></p>
          <p className="text-[13px] text-slate-600">{route ? routeName(route.route_id) : "No route passed yet"}</p>
        </section>
      </div>

      <Card className="mt-5 overflow-x-auto">
        <h2 className="px-6 pt-5 text-lg font-bold text-navy">Payment route comparison</h2>
        <table className="mt-3 w-full min-w-[720px] text-sm">
          <thead className="text-left text-slate-600">
            <tr className="border-b border-slate-200">
              <th scope="col" className="px-6 py-2.5 font-semibold">Route</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Fee %</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Fee</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Net usable</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Score</th>
              <th scope="col" className="px-6 py-2.5 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {finance.routes.map((item) => {
              const recommended = item.route_id === finance.recommended_route_id;
              const verdict = VERDICT[item.verdict] ?? { label: item.verdict, tone: "neutral" as const };
              return (
                <tr key={item.route_id} className={`border-b border-slate-100 last:border-0 ${recommended ? "bg-teal-tint/50 shadow-[inset_3px_0_0_#159B91]" : ""}`}>
                  <td className="px-6 py-3.5">
                    <span className="font-bold text-navy">{routeName(item.route_id)}</span>
                    <span className="block text-[13px] text-slate-600">{recommended ? `Recommended · ${item.fee_label} fee` : capitalise(plainReason(item, finance.currency))}</span>
                  </td>
                  <td className="tabular px-3 py-3.5">{budget > 0 ? `${Math.round((item.estimated_fee / budget) * 1000) / 10}%` : "—"}</td>
                  <td className="tabular px-3 py-3.5">{formatMoney(item.estimated_fee, finance.currency)}</td>
                  <td className="tabular px-3 py-3.5 font-bold text-navy">{formatMoney(item.usable_value, finance.currency)}</td>
                  <td className="px-3 py-3.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 rounded-full bg-slate-200"><span className={`block h-1.5 rounded-full ${item.verdict === "pass" ? "bg-teal" : "bg-accent"}`} style={{ width: `${item.accessibility.score}%` }} /></span>
                      <span className="tabular font-semibold text-navy">{item.accessibility.score}</span>
                    </span>
                  </td>
                  <td className="px-6 py-3.5"><Badge tone={verdict.tone}>{verdict.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <AiPanel title="Why this route was recommended" label="AI explanation">
          <p className="text-sm">{finance.explanation}</p>
          <p className="mt-2 text-[13px] font-semibold text-teal-text">This text explains the rule output. It cannot change scores or approve a route.</p>
        </AiPanel>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Risk warnings</h2>
          {concerns.length === 0 && <p className="mt-2 text-sm text-slate-600">No warnings for this case.</p>}
          <ul className="mt-3 space-y-2.5">
            {concerns.map((item) => <li key={item.route_id} className={`rounded-lg p-3 text-sm ${item.verdict === "block" ? "bg-critical-tint text-critical" : "bg-warning-tint text-warning"}`}><strong>{routeName(item.route_id)}</strong> {plainReason(item, finance.currency)}.</li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
