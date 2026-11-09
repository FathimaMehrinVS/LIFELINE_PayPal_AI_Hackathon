"use client";

import type { DonorPlanDetail } from "@lifeline/contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Card, button } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { formatMoney } from "../../dashboard/case-row";
import { donateHref, formatDate, FundingBar, needLabel, PRIVACY_NOTE, UrgencyBadge } from "../plan-parts";

// Owner: Member 1. One approved plan, styled from "LIFELINE Screen Designs" page 23.

const STAGES = [
  { key: "approved", label: "Approved" },
  { key: "funding", label: "Funding" },
  { key: "order", label: "Procurement" },
  { key: "supplier_payment", label: "Supplier payment" },
  { key: "handed_over", label: "Handover" },
  { key: "verified", label: "NGO verification" },
  { key: "completed", label: "Completed" },
];

const STAGE_TEXT = { complete: "Done", in_progress: "In progress", not_recorded: "Not yet recorded", issue: "Problem reported" };
const TRACKED = [
  { dot: "bg-success", name: "Donation captured", text: "PayPal confirmed your payment" },
  { dot: "bg-navy", name: "Supplier paid", text: "the NGO paid for the goods" },
  { dot: "bg-accent", name: "Delivery verified", text: "the NGO reviewed the recorded handover" },
];

export default function PlanDetailPage() {
  const id = String(useParams().id);
  const [plan, setPlan] = useState<DonorPlanDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getPlan(id).then(setPlan).catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load this plan."));
  }, [id]);

  if (error) return <div><Link href="/plans" className="text-sm font-semibold text-teal-text hover:underline">← All approved plans</Link><p role="alert" className="mt-4 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p></div>;
  if (!plan) return <p className="text-slate-600">Loading this plan…</p>;

  const money = (value: number) => formatMoney(value, plan.currency);
  return (
    <div>
      <Link href="/plans" className="text-sm font-semibold text-teal-text hover:underline">← All approved plans</Link>
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap gap-2"><Badge tone="human">NGO approved</Badge><UrgencyBadge urgency={plan.urgency} /><Badge tone="neutral"><span className="font-mono">Plan {plan.reference}</span></Badge></div>
            <h1 className="mt-3 text-[28px] font-extrabold leading-tight text-navy">{plan.title}</h1>
            <p className="mt-2 text-slate-600">{plan.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">{plan.needs.map((need) => <span key={need} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[13px] text-navy">{needLabel(need)}</span>)}</div>
          </div>

          <Card className="overflow-hidden">
            <h2 className="p-5 pb-3 font-bold text-navy">What this plan buys</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-y border-slate-200 text-left text-[13px] text-slate-600"><th className="px-5 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Supplier</th><th className="px-3 py-2 text-right font-semibold">Qty</th><th className="px-5 py-2 text-right font-semibold">Cost</th></tr></thead>
                <tbody>
                  {plan.items.map((item) => <tr key={`${item.name}-${item.supplier}`} className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-navy">{item.name}</td><td className="px-3 py-3 text-slate-600">{item.supplier}</td><td className="tabular px-3 py-3 text-right text-navy">{item.quantity}</td><td className="tabular px-5 py-3 text-right text-navy">{money(item.cost)}</td></tr>)}
                  {plan.not_itemised > 0 && <tr className="border-b border-slate-100 text-slate-600"><td className="px-5 py-3" colSpan={3}>Approved by the NGO, not yet itemised</td><td className="tabular px-5 py-3 text-right">{money(plan.not_itemised)}</td></tr>}
                </tbody>
                <tfoot><tr className="font-bold text-navy"><td className="px-5 py-3" colSpan={3}>Approved amount</td><td className="tabular px-5 py-3 text-right text-base">{money(plan.funding.goal)}</td></tr></tfoot>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-navy">NGO approval</h2>
            <p className="mt-2 text-sm text-slate-600">{plan.approved_at ? `Approved on ${formatDate(plan.approved_at)}` : "Approval date not recorded"}</p>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-navy">How this plan will progress</h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {STAGES.map(({ key, label }) => {
                const step = plan.steps.find((item) => item.key === key);
                const state = step?.state ?? "not_recorded";
                const line = state === "complete" ? "border-success" : state === "in_progress" ? "border-teal" : state === "issue" ? "border-critical" : "border-dashed border-slate-300";
                return <li key={key} className={`border-t-[3px] pt-2 ${line}`}><p className="text-[13px] font-bold text-navy">{label}</p><p className="text-[13px] text-slate-600">{STAGE_TEXT[state]}{step?.simulated ? " · simulated" : ""}</p></li>;
              })}
            </ol>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="tabular text-[32px] font-extrabold leading-none text-navy">{money(plan.funding.captured)}</p>
            <p className="mt-1 text-sm text-slate-600">raised of {money(plan.funding.goal)} goal</p>
            <div className="mt-4"><FundingBar percent={plan.funding.percent} /></div>
            <div className="mt-2 flex justify-between text-[13px] text-slate-600"><span>{plan.funding.percent}% funded · {plan.funding.donations} {plan.funding.donations === 1 ? "donation" : "donations"}</span><span className="tabular">{money(plan.funding.remaining)} to go</span></div>
            {plan.can_fund
              ? <Link href={donateHref(plan)} className={`${button.primary} mt-4 w-full py-3 text-base`}>Fund This Assistance Plan</Link>
              : <p className="mt-4 rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-navy">{plan.funding.remaining === 0 ? "This plan is fully funded" : "This plan is not open for donations"}</p>}
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">Payments run in PayPal Sandbox, so no real money moves. The NGO pays suppliers as a separate, recorded step.</p>
          </Card>
          <section className="rounded-2xl border border-teal/30 bg-teal-tint/50 p-5">
            <h2 className="font-bold text-navy">Transparency</h2>
            <p className="mt-2 text-sm text-navy">Funding, supplier payment, and NGO-verified handover are tracked separately:</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">{TRACKED.map(({ dot, name, text }) => <li key={name} className="flex gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} /><span><strong className="text-navy">{name}</strong>: {text}</span></li>)}</ul>
          </section>
          <p className="text-[13px] text-slate-600">{PRIVACY_NOTE}</p>
        </aside>
      </div>
    </div>
  );
}
