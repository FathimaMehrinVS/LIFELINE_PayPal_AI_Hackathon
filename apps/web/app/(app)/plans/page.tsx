"use client";

import type { Contribution, DonorPlan, NeedCategory } from "@lifeline/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Badge, Card, button, fieldClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { formatMoney } from "../dashboard/case-row";
import { formatDate, FundingBar, needLabel, PRIVACY_NOTE, URGENCY_ORDER, UrgencyBadge } from "./plan-parts";

// Owner: Member 1. Approved plans, styled from "LIFELINE Screen Designs" page 22. Only recorded plans and payments appear.

type Sort = "urgent" | "newest" | "closest";

const SORTERS: Record<Sort, (a: DonorPlan, b: DonorPlan) => number> = {
  urgent: (a, b) => URGENCY_ORDER[b.urgency] - URGENCY_ORDER[a.urgency],
  newest: (a, b) => (b.approved_at ?? "").localeCompare(a.approved_at ?? ""),
  closest: (a, b) => b.funding.percent - a.funding.percent,
};

function PlanCard({ plan }: { plan: DonorPlan }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <Badge tone="neutral">{needLabel(plan.needs[0] ?? "other")}</Badge>
        <UrgencyBadge urgency={plan.urgency} />
      </div>
      <h2 className="mt-3 text-lg font-bold leading-snug text-navy">{plan.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{plan.description}</p>
      <div className="mt-4"><Badge tone="human">NGO approved</Badge></div>
      <div className="mt-3"><FundingBar percent={plan.funding.percent} /></div>
      <div className="mt-1.5 flex justify-between text-[13px] text-slate-600">
        <span><strong className="tabular text-navy">{formatMoney(plan.funding.captured, plan.currency)}</strong> of {formatMoney(plan.funding.goal, plan.currency)}</span>
        <span className="tabular">{plan.funding.percent}% funded</span>
      </div>
      <Link href={`/plans/${encodeURIComponent(plan.plan_id)}`} className={`${button.primary} mt-4 w-full`}>View Plan</Link>
    </Card>
  );
}

export default function ApprovedPlansPage() {
  const [plans, setPlans] = useState<DonorPlan[] | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [need, setNeed] = useState<NeedCategory | "all">("all");
  const [sort, setSort] = useState<Sort>("urgent");

  useEffect(() => {
    api.listPlans().then(setPlans).catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load approved plans."));
    api.listContributions().then(setContributions).catch(() => setContributions([]));
  }, []);

  const open = useMemo(() => (plans ?? []).filter((plan) => !plan.delivery_confirmed_at), [plans]);
  const completed = useMemo(() => (plans ?? []).filter((plan) => plan.delivery_confirmed_at), [plans]);
  const needs = useMemo(() => [...new Set(open.flatMap((plan) => plan.needs))].sort(), [open]);
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return open
      .filter((plan) => need === "all" || plan.needs.includes(need))
      .filter((plan) => !text || `${plan.title} ${plan.reference}`.toLowerCase().includes(text))
      .sort(SORTERS[sort]);
  }, [open, need, query, sort]);

  const captured = contributions.filter((item) => item.status === "captured");
  const currencies = [...new Set(captured.map((item) => item.currency))];
  const given = currencies.length === 1 ? formatMoney(captured.reduce((sum, item) => sum + item.amount, 0), currencies[0]!) : currencies.length === 0 ? "0" : "Multiple currencies";
  const stats = [
    { value: given, label: "You've given" },
    { value: String(new Set(captured.map((item) => item.plan.plan_id)).size), label: "Plans supported" },
    { value: String(new Set(captured.filter((item) => item.plan.delivery_confirmed_at).map((item) => item.plan.plan_id)).size), label: "Deliveries confirmed" },
  ];

  return (
    <div>
      <section className="grid items-end gap-6 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="max-w-xl text-[40px] font-extrabold leading-[1.1] text-navy">Fund assistance that has a clear destination.</h1>
          <p className="mt-3 max-w-lg text-slate-600">Every plan below was reviewed and approved by an NGO. You can follow what has been recorded after you give.</p>
        </div>
        <dl className="flex gap-8 rounded-2xl border border-slate-200 bg-slate-100 px-6 py-4">
          {stats.map(({ value, label }) => <div key={label}><dd className="tabular text-xl font-extrabold text-navy">{value}</dd><dt className="text-xs text-slate-600">{label}</dt></div>)}
        </dl>
      </section>

      {error && <p role="alert" className="mt-6 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {plans === null && !error && <p className="mt-6 text-slate-600">Loading approved plans…</p>}

      {plans !== null && (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label><span className="sr-only">Search approved plans</span><input className={fieldClass} type="search" placeholder="Search approved plans" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label><span className="sr-only">Need</span>
              <select className={fieldClass} value={need} onChange={(event) => setNeed(event.target.value as NeedCategory | "all")}>
                <option value="all">All needs</option>
                {needs.map((item) => <option key={item} value={item}>{needLabel(item)}</option>)}
              </select>
            </label>
            <label><span className="sr-only">Sort</span>
              <select className={fieldClass} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="urgent">Most urgent first</option>
                <option value="newest">Newest first</option>
                <option value="closest">Closest to funded</option>
              </select>
            </label>
          </div>

          {shown.length === 0
            ? <Card className="mt-5 p-8 text-center"><h2 className="font-bold text-navy">{open.length === 0 ? "No approved plans yet" : "No plans match your search"}</h2><p className="mt-1 text-sm text-slate-600">{open.length === 0 ? "Plans appear here after an NGO approves them." : "Try a different need or search term."}</p></Card>
            : <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map((plan) => <PlanCard key={plan.plan_id} plan={plan} />)}</div>}

          {completed.length > 0 && (
            <section className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-bold text-navy">Recently completed</h2><p className="text-[13px] text-slate-600">Closed only after recipient confirmation</p></div>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                {completed.slice(0, 3).map((plan) => (
                  <Link key={plan.plan_id} href={`/plans/${encodeURIComponent(plan.plan_id)}`}>
                    <Card className="flex items-center gap-3 p-4 hover:bg-slate-50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-tint text-success"><CheckIcon className="h-4 w-4" /></span>
                      <span><span className="block text-sm font-bold text-navy">{plan.title}</span><span className="text-[13px] text-slate-600">Confirmed {formatDate(plan.delivery_confirmed_at!)}</span></span>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <p className="mt-8 text-center text-[13px] text-slate-600">{PRIVACY_NOTE}</p>
        </>
      )}
    </div>
  );
}
