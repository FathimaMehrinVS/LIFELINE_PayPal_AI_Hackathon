"use client";

import type { CaseResult } from "@lifeline/contracts";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, api } from "../../services/api";
import { SituationResultView } from "../situation/situation-result";
import { type Approval, type CaseRow, type Disbursement, STATUS_LABELS, formatMoney, sourceLabel, recommendedRoute, routeName } from "./case-row";
import { CasesGrid, type StatusFilter } from "./cases-grid";

// Owner: Member 1 (feature/situation-agent). NGO dashboard: triage cases and approve aid.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
/** Demo campaign created by `npm run db:seed`. */
const CAMPAIGN_ID = "camp_demo";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "complete", label: STATUS_LABELS.complete },
  { value: "needs_information", label: STATUS_LABELS.needs_information },
  { value: "no_usable_route", label: STATUS_LABELS.no_usable_route },
];

async function loadCases(sample: boolean): Promise<CaseResult[]> {
  if (!sample) return api.listCases();
  const res = await fetch(`${API_URL}/api/cases/samples`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function approvalError(err: unknown) {
  if (err instanceof ApiRequestError && err.status === 501) return "Not merged";
  if (err instanceof ApiRequestError) return err.message;
  return "Can't reach the API";
}

const STAT_TONES = {
  ink: { icon: "bg-slate-100 text-slate-700", bar: "bg-slate-700" },
  green: { icon: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  amber: { icon: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  red: { icon: "bg-red-100 text-red-600", bar: "bg-red-500" },
} as const;

/** A stat tile; the bar under the number shows its share of all cases. */
function Stat({ label, value, total, tone, symbol }: { label: string; value: number; total: number; tone: keyof typeof STAT_TONES; symbol: string }) {
  const t = STAT_TONES[tone];
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${t.icon}`} aria-hidden="true">
          {symbol}
        </span>
        <div>
          <div className="tabular text-3xl font-bold leading-none text-slate-900">{value}</div>
          <div className="mt-1 text-sm text-slate-600">{label}</div>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-1.5 rounded-full ${t.bar}`} style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

function CaseDetail({ row, onClose, onDisburse }: { row: CaseRow; onClose: () => void; onDisburse: (row: CaseRow) => void }) {
  const { finance, commerce } = row.case;
  const route = recommendedRoute(row.case);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white">
        <h2 className="font-semibold">Case details <span className="ml-2 text-sm font-normal text-slate-300">{row.case.case_id}</span></h2>
        <button type="button" onClick={onClose} aria-label="Close case details" className="rounded-full px-2 text-lg leading-none text-slate-300 hover:bg-white/10 hover:text-white">
          ×
        </button>
      </div>
      <div className="space-y-4 p-5">
      <SituationResultView result={row.case.situation} />
      {finance && (
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">Payment route</h3>
          <p className="text-sm">
            {route
              ? `${routeName(route.route_id)}: ${formatMoney(route.usable_value, finance.currency)} arrives after ${formatMoney(route.estimated_fee, finance.currency)} fees (${route.fee_label}).`
              : "No route can be recommended yet."}
          </p>
          <p className="mt-1 text-sm text-slate-600">{finance.explanation}</p>
        </div>
      )}
      {commerce && (
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">Basket</h3>
          <ul className="text-sm">
            {commerce.items.map((item) => (
              <li key={item.product_id}>
                {item.quantity} × {item.name} · {item.merchant_name} · {formatMoney(item.subtotal, commerce.currency)} · {sourceLabel(item.source)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-slate-600">
            Total {formatMoney(commerce.total, commerce.currency)}, reserve {formatMoney(commerce.reserve, commerce.currency)}.
          </p>
        </div>
      )}
      {row.approval?.state === "approved" && (
        <div className="space-y-3">
          {row.approval.result.status === "approved" && (
            <Link
              href={`/donate?allocation_id=${encodeURIComponent(row.approval.result.allocation_id)}&amount=${encodeURIComponent(String(row.approval.result.amount))}&currency=${encodeURIComponent(row.approval.result.currency)}&case_id=${encodeURIComponent(row.approval.result.case_id)}`}
              className="inline-flex rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Start donation for this approved case
            </Link>
          )}

          {row.approval.result.status === "approved" ? (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">Demo fallback: simulated disbursement</h3>
              <p className="mt-1 text-sm text-amber-900">This records an internal demo state only. It does not send money through PayPal or transfer funds to the recipient.</p>
              {row.disbursement?.state === "complete" ? (
                <p role="status" className="mt-3 text-sm font-semibold text-amber-950">{row.disbursement.result.notice ?? "Simulated disbursement recorded. No money was transferred to the recipient."}</p>
              ) : row.disbursement?.state === "error" ? (
                <p role="alert" className="mt-3 text-sm text-red-800">{row.disbursement.message}</p>
              ) : (
                <button
                  type="button"
                  disabled={row.disbursement?.state === "pending"}
                  onClick={() => onDisburse(row)}
                  className="mt-3 rounded-full bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-60"
                >
                  {row.disbursement?.state === "pending" ? "Recording demo state…" : "Record simulated disbursement"}
                </button>
              )}
            </section>
          ) : (
            <section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              {row.disbursement?.state === "complete"
                ? row.disbursement.result.notice
                : "Demo fallback: simulated disbursement recorded. No PayPal payout was sent and no money was transferred to the recipient."}
            </section>
          )}
        </div>
      )}
      </div>
    </section>
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">NGO dashboard</h1>
          <p className="text-slate-600">Triage cases, check the route and basket, and approve aid. Nothing is paid without approval.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {sample && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <strong>Sample data:</strong> built from the shared contract samples to preview the dashboard. These are not
          real cases. <a href="/dashboard" className="underline">Show real cases</a>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total cases" value={cases.length} total={cases.length} tone="ink" symbol="≡" />
        <Stat label="Ready for approval" value={count("complete")} total={cases.length} tone="green" symbol="✓" />
        <Stat label="Needs information" value={count("needs_information")} total={cases.length} tone="amber" symbol="?" />
        <Stat label="Critical" value={cases.filter((c) => c.situation.urgency === "critical").length} total={cases.length} tone="red" symbol="!" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={quickFilter}
          onChange={(e) => setQuickFilter(e.target.value)}
          placeholder="Search cases, places, needs…"
          className="w-72 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${statusFilter === f.value ? "bg-indigo-700 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}

      <CasesGrid
        rows={rows}
        quickFilter={quickFilter}
        statusFilter={statusFilter}
        onApprove={onApprove}
        onSelect={(row) => setSelectedId(row.case.case_id)}
      />
      <p className="text-xs text-slate-500">Click a row to review its allocation. The optional disbursement action is simulated and does not transfer money.</p>

      {selected && <CaseDetail row={selected} onClose={() => setSelectedId(null)} onDisburse={onDisburse} />}
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
