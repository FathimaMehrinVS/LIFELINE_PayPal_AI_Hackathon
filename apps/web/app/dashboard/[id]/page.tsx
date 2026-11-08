"use client";

import type { AccessFactorKey, Availability, CaseResult } from "@lifeline/contracts";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AiPanel, Badge, type BadgeTone, Card, Overline } from "../../../components/ui";
import { MISSING_QUESTIONS } from "../../situation/situation-result";
import { STATUS_LABELS, caseRef, formatMoney, loadCases, recommendedRoute, routeName, sourceLabel } from "../case-row";

// Owner: Member 1. One case, styled from "LIFELINE Screen Designs" page 11. Only recorded facts are shown.

const ACCESS: Record<AccessFactorKey, string> = {
  bank_availability: "Bank",
  atm_access: "ATM",
  wallet_acceptance: "Mobile wallet",
  cash_availability: "Cash",
  merchant_acceptance: "Local shops",
  connectivity: "Internet or phone",
};
const AVAILABILITY: Record<Availability, { tone: BadgeTone; label: string }> = {
  available: { tone: "success", label: "Available" },
  limited: { tone: "warning", label: "Limited" },
  unavailable: { tone: "critical", label: "Unavailable" },
  unknown: { tone: "neutral", label: "Missing" },
};
const URGENCY_TONE = { critical: "critical", high: "warning", medium: "info", low: "neutral" } as const;
const STATUS_TONE = { complete: "success", needs_information: "warning", no_usable_route: "critical" } as const;

function Tile({ label, value, known = true }: { label: string; value: string; known?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[13px] text-slate-600">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-navy">{value}</p>
      <div className="mt-1.5"><Badge tone={known ? "ai" : "neutral"}>{known ? "AI-extracted" : "Missing"}</Badge></div>
    </div>
  );
}

function CaseView({ item }: { item: CaseResult }) {
  const { situation, finance, commerce, status, missing_information } = item;
  const route = recommendedRoute(item);
  const pipeline: { label: string; value: string; tone: BadgeTone }[] = [
    { label: "Financial assessment", value: route ? routeName(route.route_id) : finance ? "No route yet" : "Not started", tone: route ? "success" : finance ? "warning" : "neutral" },
    { label: "Product basket", value: commerce ? `${commerce.items.length} items` : "Not started", tone: commerce ? "success" : "neutral" },
    { label: "NGO approval", value: status === "complete" ? "Awaiting review" : "Not ready", tone: status === "complete" ? "warning" : "neutral" },
    { label: "Supplier assignment", value: "Not started", tone: "neutral" },
    { label: "Funding", value: "Not started", tone: "neutral" },
    { label: "Delivery", value: "Not started", tone: "neutral" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold text-navy">Case <span className="font-mono">{caseRef(item.case_id)}</span></h1>
        <Badge tone={URGENCY_TONE[situation.urgency]} className="capitalize">{situation.urgency}</Badge>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">Legend: <Badge tone="ai">AI-extracted</Badge> <Badge tone="neutral">Missing</Badge></p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-navy">Situation</h2>
            <p className="mt-2 text-navy">{situation.summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Tile label="People affected" value={situation.household_size ? String(situation.household_size) : "Not stated"} known={situation.household_size != null} />
              <Tile label="Urgency" value={situation.urgency.charAt(0).toUpperCase() + situation.urgency.slice(1)} />
              <Tile label="Location" value={situation.location ?? "Not stated"} known={situation.location !== null} />
              <Tile label="Assistance amount" value={situation.budget !== null ? formatMoney(situation.budget, situation.currency) : "Not stated"} known={situation.budget !== null} />
            </div>
            <p className="mt-4 text-[13px] text-slate-600">Identified needs</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {situation.needs.map((need) => <span key={need} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium capitalize text-navy">{need.replace("_", " ")}</span>)}
              {situation.special_needs?.map((note) => <span key={note} className="rounded-md bg-warning-tint px-2.5 py-1 text-sm font-medium text-warning">{note}</span>)}
            </div>
            {missing_information.length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-sm text-navy">
                <strong>Missing: </strong>{missing_information.map((key) => MISSING_QUESTIONS[key] ?? key).join(" ")}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-navy">Financial access</h2>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {(Object.keys(ACCESS) as AccessFactorKey[]).map((key) => (
                <li key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-navy">
                  {ACCESS[key]} <Badge tone={AVAILABILITY[situation.access[key]].tone}>{AVAILABILITY[situation.access[key]].label}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          {commerce && (
            <Card className="p-6">
              <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold text-navy">Product basket</h2><Badge tone="neutral">Draft</Badge></div>
              <ul className="mt-3 divide-y divide-slate-100">
                {commerce.items.map((basketItem) => (
                  <li key={basketItem.product_id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span><strong className="text-navy">{basketItem.quantity} × {basketItem.name}</strong><span className="block text-xs text-slate-500">{basketItem.merchant_name} · {sourceLabel(basketItem.source)}</span></span>
                    <span className="tabular font-semibold text-navy">{formatMoney(basketItem.subtotal, commerce.currency)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-1 border-t border-slate-200 pt-3 text-sm">
                <div className="flex justify-between font-bold text-navy"><dt>Basket total</dt><dd className="tabular">{formatMoney(commerce.total, commerce.currency)}</dd></div>
                <div className="flex justify-between text-slate-600"><dt>Kept as reserve</dt><dd className="tabular">{formatMoney(commerce.reserve, commerce.currency)}</dd></div>
                {commerce.unmet_needs.length > 0 && <div className="flex justify-between text-warning"><dt>Not covered</dt><dd className="capitalize">{commerce.unmet_needs.join(", ")}</dd></div>}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {finance && (
            <AiPanel title="Route explanation" label="AI explanation">
              <p className="text-sm">{finance.explanation}</p>
              <p className="mt-2 text-[13px] font-semibold text-teal-text">Suggestion only. A reviewer decides.</p>
            </AiPanel>
          )}
          <Card className="p-6">
            <Overline className="text-slate-500">Assistance pipeline</Overline>
            <ul className="mt-2 divide-y divide-slate-100">
              {pipeline.map((stage) => (
                <li key={stage.label} className="flex items-center justify-between py-3 text-sm text-navy">{stage.label} <Badge tone={stage.tone}>{stage.value}</Badge></li>
              ))}
            </ul>
          </Card>
          {route && finance && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-navy">Recommended route</h2>
              <p className="mt-1 font-semibold text-navy">{routeName(route.route_id)}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600"><dt>Fees ({route.fee_label})</dt><dd className="tabular">{formatMoney(route.estimated_fee, finance.currency)}</dd></div>
                <div className="flex justify-between font-bold text-navy"><dt>Arrives</dt><dd className="tabular">{formatMoney(route.usable_value, finance.currency)}</dd></div>
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CasePage() {
  const { id } = useParams<{ id: string }>();
  const sample = useSearchParams().get("sample") === "1";
  const [state, setState] = useState<{ item?: CaseResult; message?: string }>({});

  useEffect(() => {
    const caseId = decodeURIComponent(id);
    loadCases(sample)
      .then((cases) => {
        const item = cases.find((c) => c.case_id === caseId);
        setState(item ? { item } : { message: "This case was not found." });
      })
      .catch(() => setState({ message: "Can't load this case. Is the API running?" }));
  }, [id, sample]);

  return (
    <div>
      <Link href={`/dashboard${sample ? "?sample=1" : ""}`} className="text-sm font-semibold text-teal-text hover:underline">← All cases</Link>
      <div className="mt-2">
        {state.item ? <CaseView item={state.item} /> : <p className="text-slate-600">{state.message ?? "Loading…"}</p>}
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  return (
    <Suspense>
      <CasePage />
    </Suspense>
  );
}
