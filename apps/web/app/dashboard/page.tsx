"use client";

import type { CaseResult, Urgency } from "@lifeline/contracts";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, api } from "../../services/api";
import { Badge, type BadgeTone, button, fieldClass } from "../../components/ui";
import { type Approval, type CaseRow, type Disbursement, STATUS_LABELS, caseRef, formatMoney, loadCases, recommendedRoute, routeName } from "./case-row";
import { CasesGrid, type StatusFilter } from "./cases-grid";

// Owner: Member 1 (feature/situation-agent). NGO dashboard: triage cases and approve aid.

/** Demo campaign created by `npm run db:seed`. */
const CAMPAIGN_ID = "camp_demo";

const URGENCY_TONE: Record<Urgency, BadgeTone> = { critical: "critical", high: "warning", medium: "info", low: "neutral" };

function approvalError(err: unknown) {
  if (err instanceof ApiRequestError && err.status === 501) return "Not merged";
  if (err instanceof ApiRequestError) return err.message;
  return "Can't reach the API";
}

function CasePanel({ row, sample, onClose, onDisburse }: { row: CaseRow; sample: boolean; onClose: () => void; onDisburse: (row: CaseRow) => void }) {
  const { situation, finance, commerce, case_id, missing_information } = row.case;
  const route = recommendedRoute(row.case);
  const approved = row.approval?.state === "approved" ? row.approval.result : null;
  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-lg font-bold text-navy">{caseRef(case_id)}</h2>
        <span className="flex items-center gap-2">
          <Badge tone={URGENCY_TONE[situation.urgency]} className="capitalize">{situation.urgency}</Badge>
          <button type="button" onClick={onClose} aria-label="Close case summary" className="px-1 text-lg leading-none text-slate-400 hover:text-navy">×</button>
        </span>
      </div>
      <p className="text-navy">{situation.summary}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-600">People</dt><dd className="font-semibold text-navy">{situation.household_size ?? "Not stated"}</dd></div>
        <div><dt className="text-slate-600">Area</dt><dd className="font-semibold text-navy">{situation.location ?? "Not stated"}</dd></div>
        {route && finance && <div><dt className="text-slate-600">Route</dt><dd className="font-semibold text-navy">{routeName(route.route_id)}</dd></div>}
        {route && finance && <div><dt className="text-slate-600">Arrives</dt><dd className="tabular font-semibold text-navy">{formatMoney(route.usable_value, finance.currency)}</dd></div>}
        {commerce && <div><dt className="text-slate-600">Basket</dt><dd className="tabular font-semibold text-navy">{formatMoney(commerce.total, commerce.currency)}</dd></div>}
        {commerce && <div><dt className="text-slate-600">Reserve</dt><dd className="tabular font-semibold text-navy">{formatMoney(commerce.reserve, commerce.currency)}</dd></div>}
      </dl>
      {missing_information.length > 0 && (
        <div className="text-sm">
          <p className="text-slate-600">Missing information</p>
          <p className="text-navy">{missing_information.map((key) => key.replaceAll("_", " ")).join(" · ")}</p>
        </div>
      )}
      <Link href={`/dashboard/${encodeURIComponent(case_id)}${sample ? "?sample=1" : ""}`} className={`${button.primary} w-full`}>Open case details</Link>

      {approved?.status === "approved" && (
        <Link
          href={`/donate?allocation_id=${encodeURIComponent(approved.allocation_id)}&amount=${encodeURIComponent(String(approved.amount))}&currency=${encodeURIComponent(approved.currency)}&case_id=${encodeURIComponent(case_id)}`}
          className={`${button.confirm} w-full`}
        >
          Start donation for this approved case
        </Link>
      )}
      {approved && (
        <section className="rounded-xl border border-dashed border-simulated bg-simulated-tint p-4 text-sm text-simulated">
          <Badge tone="simulated">Simulated</Badge>
          {approved.status === "approved" && row.disbursement?.state !== "complete" ? (
            <>
              <p className="mt-2">Records an internal demo state only. No money is sent through PayPal or to anyone.</p>
              {row.disbursement?.state === "error" && <p role="alert" className="mt-2 text-critical">{row.disbursement.message}</p>}
              <button type="button" disabled={row.disbursement?.state === "pending"} onClick={() => onDisburse(row)} className={`${button.secondary} mt-3 w-full`}>
                {row.disbursement?.state === "pending" ? "Recording demo state…" : "Record simulated disbursement"}
              </button>
            </>
          ) : (
            <p role="status" className="mt-2">{row.disbursement?.state === "complete" ? row.disbursement.result.notice : "Simulated disbursement recorded. No PayPal payout was sent and no money was transferred."}</p>
          )}
        </section>
      )}
    </aside>
  );
}

function Dashboard() {
  const sample = useSearchParams().get("sample") === "1";
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [approvals, setApprovals] = useState<Record<string, Approval>>({});
  const [disbursements, setDisbursements] = useState<Record<string, Disbursement>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await loadCases(sample));
      setError(null);
    } catch {
      setError("Can't load cases. Is the API running (npm run dev:api)?");
    } finally {
      setLoading(false);
    }
  }, [sample]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo<CaseRow[]>(() => cases.map((c) => ({ case: c, approval: approvals[c.case_id], disbursement: disbursements[c.case_id] })), [cases, approvals, disbursements]);
  const selected = rows.find((r) => r.case.case_id === selectedId) ?? null;

  const onApprove = useCallback(async (row: CaseRow) => {
    const { case_id, situation } = row.case;
    if (situation.budget === null || situation.currency === null) return;
    setApprovals((a) => ({ ...a, [case_id]: { state: "pending" } }));
    try {
      const result = await api.approveAllocation({
        case_id,
        campaign_id: CAMPAIGN_ID,
        amount: situation.budget,
        currency: situation.currency,
      });
      setApprovals((a) => ({ ...a, [case_id]: { state: "approved", result } }));
    } catch (err) {
      setApprovals((a) => ({ ...a, [case_id]: { state: "error", message: approvalError(err) } }));
    }
  }, []);

  const onDisburse = useCallback(async (row: CaseRow) => {
    const approval = row.approval;
    if (approval?.state !== "approved" || approval.result.status !== "approved") return;
    const { case_id } = row.case;
    setDisbursements((current) => ({ ...current, [case_id]: { state: "pending" } }));
    try {
      const result = await api.createPayout({
        allocation_id: approval.result.allocation_id,
        amount: approval.result.amount,
        currency: approval.result.currency,
      });
      setDisbursements((current) => ({ ...current, [case_id]: { state: "complete", result } }));
      setApprovals((current) => {
        const existing = current[case_id];
        return existing?.state === "approved"
          ? { ...current, [case_id]: { state: "approved", result: { ...existing.result, status: "disbursed" } } }
          : current;
      });
    } catch (err) {
      setDisbursements((current) => ({ ...current, [case_id]: { state: "error", message: err instanceof Error ? err.message : "Could not record simulated disbursement" } }));
    }
  }, []);

  const count = (status: CaseResult["status"]) => cases.filter((c) => c.status === status).length;
  const urgent = cases.filter((c) => c.situation.urgency === "high" || c.situation.urgency === "critical").length;
  const tabs: { value: StatusFilter; label: string; total: number; danger?: boolean }[] = [
    { value: "all", label: "All Cases", total: cases.length },
    { value: "urgent", label: "Urgent", total: urgent, danger: true },
    { value: "complete", label: STATUS_LABELS.complete, total: count("complete") },
    { value: "needs_information", label: STATUS_LABELS.needs_information, total: count("needs_information") },
    { value: "no_usable_route", label: STATUS_LABELS.no_usable_route, total: count("no_usable_route") },
  ];

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy">Assistance cases</h1>
          <p className="text-slate-600">{cases.length} active · {urgent} urgent · {count("complete")} ready for approval</p>
        </div>
        <button type="button" onClick={() => void refresh()} className={button.secondary}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      {sample && (
        <p className="mt-4 rounded-xl border border-dashed border-simulated bg-simulated-tint p-3 text-sm text-simulated">
          <strong>Sample data:</strong> built from the shared contract samples to preview this screen. These are not real cases. <Link href="/dashboard" className="underline">Show real cases</Link>
        </p>
      )}

      <nav className="mt-5 flex flex-wrap gap-1 border-b border-slate-200" aria-label="Filter cases">
        {tabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)} aria-pressed={active} className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm ${active ? "border-navy font-bold text-navy" : `border-transparent font-medium ${tab.danger ? "text-critical" : "text-slate-600"} hover:text-navy`}`}>
              {tab.label} <span className="font-medium">{tab.total}</span>
            </button>
          );
        })}
      </nav>

      <input type="search" value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)} placeholder="Search by location, need or situation" className={`${fieldClass} mt-4`} />

      {error && <p role="alert" className="mt-4 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}

      <div className={`mt-4 grid items-start gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <CasesGrid rows={rows} quickFilter={quickFilter} statusFilter={statusFilter} onApprove={onApprove} onSelect={(row) => setSelectedId(row.case.case_id)} />
        {selected && <CasePanel row={selected} sample={sample} onClose={() => setSelectedId(null)} onDisburse={onDisburse} />}
      </div>
      <p className="mt-3 text-xs text-slate-500">Select a row to review a case. Disbursement is simulated and does not transfer money.</p>
    </div>
  );
}

export default function DashboardPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
