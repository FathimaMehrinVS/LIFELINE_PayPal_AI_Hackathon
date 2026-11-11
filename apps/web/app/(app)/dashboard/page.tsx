"use client";

import type { CaseResult, Supplier, Urgency } from "@lifeline/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiRequestError, api } from "@/services/api";
import { Badge, type BadgeTone, button, fieldClass, EmptyState } from "@/components/ui";
import { type Approval, type CaseRow, type Disbursement, STATUS_LABELS, caseRef, formatMoney, fundingState, recommendedRoute, routeName, savedApproval, savedDisbursement } from "./case-row";
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

function CasePanel({ row, onClose, onDisburse }: { row: CaseRow; onClose: () => void; onDisburse: (row: CaseRow, reference: string) => void }) {
  const [reference, setReference] = useState("");
  const { situation, finance, commerce, case_id, missing_information } = row.case;
  const route = recommendedRoute(row.case);
  const funding = fundingState(row.case);
  const approved = row.approval?.state === "approved" ? row.approval.result : null;
  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-lg font-bold text-navy">{caseRef(case_id)}</h2>
        <span className="flex items-center gap-2">
          <Badge tone={URGENCY_TONE[situation.urgency]} className="capitalize">{situation.urgency}</Badge>
          <button type="button" onClick={onClose} aria-label="Close case summary" className="flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-navy">×</button>
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
        {funding && row.case.operations?.allocation && <div className="col-span-2"><dt className="text-slate-600">Funding</dt><dd className="tabular font-semibold text-navy">{formatMoney(funding.captured, row.case.operations.allocation.currency)} captured of {formatMoney(row.case.operations.allocation.amount, row.case.operations.allocation.currency)}</dd></div>}
      </dl>
      {missing_information.length > 0 && (
        <div className="text-sm">
          <p className="text-slate-600">Missing information</p>
          <p className="text-navy">{missing_information.map((key) => key.replaceAll("_", " ")).join(" · ")}</p>
        </div>
      )}
      <Link href={`/dashboard/${encodeURIComponent(case_id)}`} className={`${button.primary} w-full`}>Open case details</Link>

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
          {(approved.status === "approved" || approved.status === "completed") && row.disbursement?.state !== "complete" ? (
            <>
              <p className="mt-2">Records an internal demo state only. No money is sent through PayPal or to anyone.</p>
              {row.disbursement?.state === "error" && <p role="alert" className="mt-2 text-critical">{row.disbursement.message}</p>}
              <label className="mt-3 block text-xs font-medium text-slate-700">
                Payment reference
                <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} placeholder="Invoice or payment reference" className={`${fieldClass} mt-1`} />
              </label>
              <button type="button" disabled={row.disbursement?.state === "pending" || !reference.trim() || !(approved.purchase_order_id ?? row.case.operations?.delivery?.purchase_order_id)} onClick={() => onDisburse(row, reference.trim())} className={`${button.secondary} mt-3 w-full`}>
                {row.disbursement?.state === "pending" ? "Recording demo state…" : "Record simulated supplier payment"}
              </button>
            </>
          ) : (
            <p role="status" className="mt-2">{row.disbursement?.state === "complete"
              ? (row.disbursement.result.notice || `Simulated supplier payment recorded${row.disbursement.result.reference ? ` (reference ${row.disbursement.result.reference})` : ""}. No PayPal payout was sent and no money was transferred.`)
              : "No supplier payment has been recorded for this plan."}</p>
          )}
        </section>
      )}
    </aside>
  );
}

/** Styled from the design's payment summary. Only money that has actually been recorded is counted. */
function FundsSummary({ cases }: { cases: CaseResult[] }) {
  const records = cases.flatMap((item) => (item.operations?.allocation ? [item.operations] : []));
  const currency = records[0]?.allocation?.currency;
  if (!currency) return null;
  const same = records.filter((record) => record.allocation?.currency === currency);
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
  const donated = sum(same.map((record) => record.funding.captured));
  const allocated = sum(same.map((record) => record.allocation!.amount));
  const paid = sum(same.map((record) => record.payout?.amount ?? 0));
  const tiles = [
    { label: "Total donated (captured)", value: donated },
    { label: "Total allocated to plans", value: allocated },
    { label: "Supplier payments (simulated)", value: paid },
  ];
  return (
    <section className="mt-4 grid gap-5 rounded-2xl bg-navy p-5 text-white sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => <div key={tile.label}><p className="text-sm text-slate-300">{tile.label}</p><p className="tabular text-2xl font-extrabold">{formatMoney(tile.value, currency)}</p></div>)}
      <div><p className="text-sm text-slate-300">Remaining balance</p><p className="tabular text-2xl font-extrabold text-accent">{formatMoney(Math.round((donated - paid) * 100) / 100, currency)}</p></div>
    </section>
  );
}

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [approvals, setApprovals] = useState<Record<string, Approval>>({});
  const [disbursements, setDisbursements] = useState<Record<string, Disbursement>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierChoices, setSupplierChoices] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ row: CaseRow; supplierId: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await api.listCases());
      setError(null);
    } catch {
      setError("Can't load cases. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void api.listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo<CaseRow[]>(() => cases.map((c) => ({ case: c, approval: approvals[c.case_id] ?? savedApproval(c), disbursement: disbursements[c.case_id] ?? savedDisbursement(c) })), [cases, approvals, disbursements]);
  const selected = rows.find((r) => r.case.case_id === selectedId) ?? null;

  const failedApproval = rows.find((row) => row.approval?.state === "error");

  const onApprove = useCallback(async (row: CaseRow, merchant_id: string) => {
    const { case_id } = row.case;
    if (!merchant_id) {
      setApprovals((a) => ({ ...a, [case_id]: { state: "error", message: "Choose an approved supplier first." } }));
      return;
    }
    setApprovals((a) => ({ ...a, [case_id]: { state: "pending" } }));
    try {
      const result = await api.approveAllocation({
        case_id,
        campaign_id: CAMPAIGN_ID,
        merchant_id,
      });
      setApprovals((a) => ({ ...a, [case_id]: { state: "approved", result } }));
    } catch (err) {
      setApprovals((a) => ({ ...a, [case_id]: { state: "error", message: approvalError(err) } }));
    }
  }, []);

  const askToApprove = useCallback((row: CaseRow, supplierId: string) => setConfirming({ row, supplierId }), []);

  const onChooseSupplier = useCallback((caseId: string, supplierId: string) => {
    setSupplierChoices((current) => ({ ...current, [caseId]: supplierId }));
  }, []);

  const onDisburse = useCallback(async (row: CaseRow, reference: string) => {
    const approval = row.approval;
    if (approval?.state !== "approved" || (approval.result.status !== "approved" && approval.result.status !== "completed")) return;
    const { case_id } = row.case;
    setDisbursements((current) => ({ ...current, [case_id]: { state: "pending" } }));
    try {
      const purchase_order_id = approval.result.purchase_order_id ?? row.case.operations?.delivery?.purchase_order_id;
      if (!purchase_order_id) throw new Error("This approved plan has no purchase order yet");
      const result = await api.createPayout({ purchase_order_id, reference });
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


      <FundsSummary cases={cases} />

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

      {failedApproval?.approval?.state === "error" && <p role="alert" className="mt-4 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">Couldn&apos;t approve {caseRef(failedApproval.case.case_id)}: {failedApproval.approval.message}</p>}

      {!loading && !error && visible === 0 && (
        <div className="mt-4">
          {cases.length === 0
            ? <EmptyState title="No cases yet" text="New reports appear here for review." action={<Link href="/situation" className={button.primary}>New case</Link>} />
            : <EmptyState title="No cases match" text="Try a different search or status." action={<button type="button" onClick={() => { setQuickFilter(""); setStatusFilter("all"); }} className={button.secondary}>Clear filters</button>} />}
        </div>
      )}

      <div className={`mt-4 grid items-start gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""} ${visible === 0 ? "hidden" : ""}`}>
        <CasesGrid rows={rows} quickFilter={quickFilter} statusFilter={statusFilter} suppliers={suppliers} supplierChoices={supplierChoices} onChooseSupplier={onChooseSupplier} onApprove={askToApprove} onSelect={(row) => setSelectedId(row.case.case_id)} onVisibleCount={setVisible} />
        {selected && <CasePanel row={selected} onClose={() => setSelectedId(null)} onDisburse={onDisburse} />}
      </div>
      <ConfirmDialog
        open={confirming !== null}
        title="Approve this plan?"
        confirmLabel="Approve plan"
        onCancel={() => setConfirming(null)}
        onConfirm={() => { if (confirming) void onApprove(confirming.row, confirming.supplierId); setConfirming(null); }}
      >
        {confirming && <p>You are approving case <strong className="font-mono text-navy">{caseRef(confirming.row.case.case_id)}</strong> with <strong className="text-navy">{suppliers.find((supplier) => supplier.supplier_id === confirming.supplierId)?.name ?? "the chosen supplier"}</strong>. LIFELINE works out the amount from the basket and route. Donors can fund it as soon as it is approved, and this can&apos;t be undone from LIFELINE.</p>}
      </ConfirmDialog>
      <p className="mt-3 text-xs text-slate-500">Select a row to review a case. Disbursement is simulated and does not transfer money.</p>
    </div>
  );
}

