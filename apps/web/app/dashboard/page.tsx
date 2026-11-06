"use client";

import type { CaseResult } from "@lifeline/contracts";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, api } from "../../services/api";
import { SituationResultView } from "../situation/situation-result";
import { type Approval, type CaseRow, STATUS_LABELS, formatMoney, recommendedRoute, routeName } from "./case-row";
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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function CaseDetail({ row, onClose }: { row: CaseRow; onClose: () => void }) {
  const { finance, commerce } = row.case;
  const route = recommendedRoute(row.case);
  return (
    <section className="space-y-4 rounded-lg border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Case {row.case.case_id}</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
          Close
        </button>
      </div>
      <SituationResultView result={row.case.situation} />
      {finance && (
        <div className="rounded-lg border border-slate-200 p-4">
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
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">Basket</h3>
          <ul className="text-sm">
            {commerce.items.map((item) => (
              <li key={item.product_id}>
                {item.quantity} × {item.name} · {item.merchant_name} · {formatMoney(item.subtotal, commerce.currency)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-slate-600">
            Total {formatMoney(commerce.total, commerce.currency)}, reserve {formatMoney(commerce.reserve, commerce.currency)}.
          </p>
        </div>
      )}
    </section>
  );
}

function Dashboard() {
  const sample = useSearchParams().get("sample") === "1";
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [approvals, setApprovals] = useState<Record<string, Approval>>({});
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

  const rows = useMemo<CaseRow[]>(() => cases.map((c) => ({ case: c, approval: approvals[c.case_id] })), [cases, approvals]);
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

  const count = (status: CaseResult["status"]) => cases.filter((c) => c.status === status).length;

  return (
    // Wider than the shared layout's column: the grid needs room for its money columns.
    <div className="relative left-1/2 w-[min(calc(100vw-2rem),1400px)] -translate-x-1/2 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">NGO dashboard</h1>
          <p className="text-slate-600">Triage cases, check the route and basket, and approve aid. Nothing is paid without approval.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {sample && (
        <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <strong>Sample data:</strong> built from the shared contract samples to preview the dashboard. These are not
          real cases. <a href="/dashboard" className="underline">Show real cases</a>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cases" value={cases.length} tone="text-slate-900" />
        <Stat label="Ready for approval" value={count("complete")} tone="text-emerald-700" />
        <Stat label="Needs information" value={count("needs_information")} tone="text-amber-700" />
        <Stat label="Critical" value={cases.filter((c) => c.situation.urgency === "critical").length} tone="text-red-700" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={quickFilter}
          onChange={(e) => setQuickFilter(e.target.value)}
          placeholder="Search cases, places, needs…"
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-md px-3 py-1.5 text-sm ${statusFilter === f.value ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white hover:bg-slate-100"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}

      <CasesGrid
        rows={rows}
        quickFilter={quickFilter}
        statusFilter={statusFilter}
        onApprove={onApprove}
        onSelect={(row) => setSelectedId(row.case.case_id)}
      />
      <p className="text-xs text-slate-500">Click a row to see the full case. Approving records an allocation; the payout runs only after that.</p>

      {selected && <CaseDetail row={selected} onClose={() => setSelectedId(null)} />}
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
