"use client";

import type { Contribution, PlanStep } from "@lifeline/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Badge, type BadgeTone, Card, button } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { formatMoney } from "../dashboard/case-row";
import { formatDate, formatDateTime, PRIVACY_NOTE, STEP_STATE } from "../plans/plan-parts";

// Owner: Member 1. A donor's own gifts and what has been recorded since, styled from "LIFELINE Screen Designs" page 26.

const DONATION_STATUS: Record<Contribution["status"], { label: string; tone: BadgeTone }> = {
  created: { label: "Payment not confirmed", tone: "warning" },
  approved: { label: "Payment not confirmed", tone: "warning" },
  captured: { label: "Donation received", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },
};

function stepMark(step: PlanStep, index: number) {
  if (step.state === "complete") return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white"><CheckIcon className="h-3.5 w-3.5" /></span>;
  if (step.state === "not_recorded") return <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-400 bg-white text-xs font-semibold text-slate-500">{index + 1}</span>;
  return <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white text-xs font-bold ${step.state === "issue" ? "border-critical text-critical" : "border-teal text-teal-text"}`}>{index + 1}</span>;
}

export default function ContributionsPage() {
  const [items, setItems] = useState<Contribution[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listContributions().then((rows) => { setItems(rows); setSelectedId(rows[0]?.donation_id ?? null); })
      .catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load your contributions."));
  }, []);

  if (error) return <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>;
  if (!items) return <p className="text-slate-600">Loading your contributions…</p>;
  if (items.length === 0) return <Card className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-bold text-navy">No contributions yet</h1><p className="mt-2 text-sm text-slate-600">Once you fund an approved plan, you can follow every recorded step here.</p><Link href="/plans" className={`${button.primary} mt-5`}>See approved plans</Link></Card>;

  const selected = items.find((item) => item.donation_id === selectedId) ?? items[0]!;
  const { plan } = selected;
  const money = (value: number) => formatMoney(value, plan.currency);
  const recorded = (key: string) => plan.steps.find((step) => step.key === key)?.state === "complete";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside>
        <h2 className="text-sm font-bold text-navy">My contributions</h2>
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => {
            const active = item.donation_id === selected.donation_id;
            return (
              <li key={item.donation_id}>
                <button type="button" onClick={() => setSelectedId(item.donation_id)} aria-pressed={active} className={`w-full rounded-xl bg-white p-3 text-left ${active ? "border-2 border-navy" : "border border-slate-200 hover:bg-slate-50"}`}>
                  <span className="block text-sm font-bold text-navy">{item.plan.title}</span>
                  <span className="tabular mt-0.5 block text-xs text-slate-600">{formatMoney(item.amount, item.currency)} · {formatDate(item.created_at)}</span>
                  <Badge tone={DONATION_STATUS[item.status].tone} className="mt-1.5">{DONATION_STATUS[item.status].label}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="space-y-5">
        <div>
          <h1 className="text-[28px] font-extrabold text-navy">{plan.title}</h1>
          <p className="tabular mt-1 text-sm text-slate-600">Plan {plan.reference} · Your contribution {formatMoney(selected.amount, selected.currency)} ({selected.reference})</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={DONATION_STATUS[selected.status].tone}>{DONATION_STATUS[selected.status].label}</Badge>
            <Badge tone={recorded("supplier_payment") ? "success" : "neutral"}>Supplier payment {recorded("supplier_payment") ? "recorded" : "not yet recorded"}</Badge>
            <Badge tone={recorded("verified") ? "success" : "neutral"}>Delivery {recorded("verified") ? "confirmed" : "not yet confirmed"}</Badge>
          </div>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Full timeline</h2>
          <ol className="mt-4">
            {plan.steps.map((step, index) => {
              const last = index === plan.steps.length - 1;
              const muted = step.state === "not_recorded";
              return (
                <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last && <span aria-hidden="true" className={`absolute left-[13px] top-7 h-[calc(100%-28px)] border-l-2 ${step.state === "complete" ? "border-success" : "border-dashed border-slate-300"}`} />}
                  <span className="relative">{stepMark(step, index)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${muted ? "text-slate-500" : "text-navy"}`}>{step.title}</p>
                    {step.detail && <p className="text-[13px] text-slate-600">{step.detail}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex flex-wrap justify-end gap-1">{step.simulated && <Badge tone="simulated">Simulated</Badge>}<Badge tone={STEP_STATE[step.state].tone}>{STEP_STATE[step.state].label}</Badge></div>
                    {step.at && <p className="mt-1 text-xs text-slate-600">{formatDateTime(step.at)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-navy">Items in this plan</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {plan.items.map((item) => <div key={`${item.name}-${item.supplier}`} className="flex justify-between gap-3"><dt className="text-slate-600">{item.name} × {item.quantity}</dt><dd className="tabular text-navy">{money(item.cost)}</dd></div>)}
            {plan.not_itemised > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-600">Approved by the NGO, not yet itemised</dt><dd className="tabular text-navy">{money(plan.not_itemised)}</dd></div>}
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-bold text-navy"><dt>Approved amount</dt><dd className="tabular">{money(plan.funding.goal)}</dd></div>
          </dl>
        </Card>
        <p className="text-[13px] text-slate-600">{PRIVACY_NOTE}</p>
      </div>
    </div>
  );
}
