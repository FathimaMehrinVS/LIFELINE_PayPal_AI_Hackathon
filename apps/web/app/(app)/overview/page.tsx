"use client";

import type { CaseResult, CaseTimelineEntry, Supplier, Urgency } from "@lifeline/contracts";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, type BadgeTone, Card, button } from "@/components/ui";
import { api } from "@/services/api";
import { caseRef, formatMoney, URGENCY_RANK } from "../dashboard/case-row";
import { lifelineGridTheme } from "../dashboard/cases-grid";

// Owner: Member 1. NGO overview, styled from "LIFELINE Screen Designs" page 9. Every figure comes from recorded data.

const URGENCY_TONE: Record<Urgency, BadgeTone> = { critical: "critical", high: "warning", medium: "info", low: "neutral" };
const STATUS: Record<CaseResult["status"], { label: string; tone: BadgeTone }> = {
  complete: { label: "Ready", tone: "success" },
  needs_information: { label: "Needs info", tone: "warning" },
  no_usable_route: { label: "No route", tone: "critical" },
};
const DOT: Record<CaseTimelineEntry["kind"], string> = { case: "bg-accent", approval: "bg-navy", donation: "bg-success", payment: "bg-simulated", supplier: "bg-teal" };
const needName = (need: string) => { const text = need.replaceAll("_", " "); return text.charAt(0).toUpperCase() + text.slice(1); };
const isUrgent = (item: CaseResult) => item.situation.urgency === "high" || item.situation.urgency === "critical";

function CaseCell({ data }: ICellRendererParams<CaseResult>) {
  return data ? <Link href={`/dashboard/${encodeURIComponent(data.case_id)}`} className="font-mono text-[13px] font-bold text-teal-text hover:underline">{caseRef(data.case_id)}</Link> : null;
}
function UrgencyCell({ data }: ICellRendererParams<CaseResult>) {
  return data ? <Badge tone={URGENCY_TONE[data.situation.urgency]} className="capitalize">{data.situation.urgency}</Badge> : null;
}
function StatusCell({ data }: ICellRendererParams<CaseResult>) {
  return data ? <Badge tone={STATUS[data.status].tone}>{STATUS[data.status].label}</Badge> : null;
}

/** One series, so no legend: the title names it and each column carries its own value. */
function NeedsChart({ cases }: { cases: CaseResult[] }) {
  const counts = new Map<string, number>();
  for (const item of cases) for (const need of item.situation.needs) counts.set(need, (counts.get(need) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  if (rows.length === 0) return <p className="mt-3 text-slate-600">No cases recorded yet.</p>;
  return (
    <ol className="mt-5 flex h-64 items-end gap-0.5 border-b border-slate-200" aria-label="Cases by need">
      {rows.map(([need, count]) => (
        <li key={need} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${needName(need)}: ${count} ${count === 1 ? "case" : "cases"}`}>
          <span className="tabular mb-1 text-[13px] font-semibold text-navy">{count}</span>
          <span className="w-7 rounded-t bg-navy transition-opacity group-hover:opacity-80" style={{ height: `${(count / max) * 82}%` }} />
        </li>
      ))}
    </ol>
  );
}

export default function OverviewPage() {
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  const [activity, setActivity] = useState<CaseTimelineEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [today, setToday] = useState({ greeting: "Welcome", date: "" });

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setToday({ greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening", date: now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) });
    api.listCases().then(setCases).catch(() => setError("Can't load cases. Is the API running?"));
    api.getRecentActivity().then(setActivity).catch(() => setActivity([]));
    api.listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  const columns = useMemo<ColDef<CaseResult>[]>(() => [
    { headerName: "Case ID", cellRenderer: CaseCell, width: 130, sortable: false },
    { headerName: "Urgency", cellRenderer: UrgencyCell, width: 105, sortable: false },
    { headerName: "Location", valueGetter: (p) => p.data?.situation.location ?? "Not stated", flex: 1, minWidth: 120, sortable: false },
    { headerName: "Needs", valueGetter: (p) => p.data?.situation.needs.map(needName).join(", "), flex: 1, minWidth: 130, sortable: false },
    { headerName: "Status", cellRenderer: StatusCell, width: 115, sortable: false },
  ], []);

  const all = cases ?? [];
  const urgent = all.filter(isUrgent).sort((a, b) => URGENCY_RANK[b.situation.urgency] - URGENCY_RANK[a.situation.urgency]);
  const approved = all.filter((item) => item.operations?.allocation);
  const awaiting = all.filter((item) => item.status === "complete" && !item.operations?.allocation);
  const needsInfo = all.filter((item) => item.status === "needs_information");
  const noRoute = all.filter((item) => item.status === "no_usable_route");
  const unfunded = approved.filter((item) => (item.operations?.funding.captured ?? 0) <= 0);
  const pendingSuppliers = suppliers.filter((supplier) => supplier.status === "pending");
  const currency = approved[0]?.operations?.allocation?.currency;
  const captured = Math.round(approved.reduce((sum, item) => sum + (item.operations?.allocation?.currency === currency ? (item.operations?.funding.captured ?? 0) : 0), 0) * 100) / 100;

  const tiles = [
    { label: "Active Cases", value: String(all.length), note: `${needsInfo.length} need more information` },
    { label: "Urgent Cases", value: String(urgent.length), note: "High or critical", danger: true },
    { label: "Awaiting Approval", value: String(awaiting.length), note: "Plans ready for review" },
    { label: "Funded Allocations", value: currency ? formatMoney(captured, currency) : "—", note: "Donations captured" },
    { label: "Approved Plans", value: String(approved.length), note: `${unfunded.length} not funded yet` },
  ];
  const alerts = [
    noRoute.length > 0 && { tone: "bg-critical-tint text-critical", title: `${noRoute.length} ${noRoute.length === 1 ? "case has" : "cases have"} no safe route`, text: "Needs an NGO worker to look at other options", href: "/dashboard" },
    needsInfo.length > 0 && { tone: "bg-warning-tint text-warning", title: `${needsInfo.length} ${needsInfo.length === 1 ? "case needs" : "cases need"} more information`, text: "Waiting on answers before a route can be found", href: "/dashboard" },
    unfunded.length > 0 && { tone: "bg-warning-tint text-warning", title: `${unfunded.length} approved ${unfunded.length === 1 ? "plan is" : "plans are"} not funded`, text: "No donation has been captured yet", href: "/dashboard" },
    pendingSuppliers.length > 0 && { tone: "bg-warning-tint text-warning", title: `${pendingSuppliers.length} ${pendingSuppliers.length === 1 ? "supplier awaits" : "suppliers await"} review`, text: "They can't receive orders until approved", href: "/suppliers" },
  ].filter((alert): alert is { tone: string; title: string; text: string; href: string } => Boolean(alert));

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy">{today.greeting}, NGO team</h1>
          <p className="text-slate-600">{today.date}{today.date ? " · " : ""}{urgent.length} urgent {urgent.length === 1 ? "case" : "cases"}</p>
        </div>
        <Link href="/situation" className={button.primary}>+ Create New Case</Link>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((tile) => (
          <section key={tile.label} className={`rounded-2xl border bg-white p-4 ${tile.danger ? "border-critical/30 border-t-2 border-t-critical" : "border-slate-200"}`}>
            <p className={`text-sm ${tile.danger ? "font-semibold text-critical" : "text-slate-600"}`}>{tile.label}</p>
            <p className="tabular mt-0.5 text-3xl font-bold text-navy">{tile.value}</p>
            <p className="mt-0.5 text-[13px] text-slate-600">{tile.note}</p>
          </section>
        ))}
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Cases by need</h2>
          <NeedsChart cases={all} />
          <ol className="flex gap-0.5 pt-2" aria-hidden="true">
            {[...new Set(all.flatMap((item) => item.situation.needs))].sort((a, b) => all.filter((c) => c.situation.needs.includes(b as never)).length - all.filter((c) => c.situation.needs.includes(a as never)).length).map((need) => <li key={need} className="min-w-0 flex-1 truncate text-center text-[13px] text-slate-600">{needName(need)}</li>)}
          </ol>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Alerts</h2>
          <ul className="mt-3 space-y-2.5">
            {alerts.map((alert) => <li key={alert.title}><Link href={alert.href} className={`block rounded-xl p-3.5 text-sm hover:opacity-90 ${alert.tone}`}><strong className="block">{alert.title}</strong>{alert.text}</Link></li>)}
            {alerts.length === 0 && <li className="text-sm text-slate-600">Nothing needs attention right now.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold text-navy">Urgent cases</h2><Link href="/dashboard" className="text-sm font-semibold text-teal-text hover:underline">View all cases →</Link></div>
          <AgGridReact<CaseResult> theme={lifelineGridTheme} rowData={urgent.slice(0, 5)} columnDefs={columns} getRowId={(p) => p.data.case_id} rowHeight={52} domLayout="autoHeight" suppressCellFocus overlayNoRowsTemplate="No urgent cases." />
        </section>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Recent activity</h2>
          <ol className="mt-3 space-y-3">
            {activity.map((entry) => (
              <li key={`${entry.title}-${entry.at}`} className="flex gap-3 text-sm">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[entry.kind]}`} aria-hidden="true" />
                <span><span className="font-medium text-navy">{entry.title}</span><span className="block text-[13px] text-slate-600">{entry.detail ? `${entry.detail} · ` : ""}{new Date(entry.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-sm text-slate-600">No activity recorded yet.</li>}
          </ol>
        </Card>
      </div>
    </div>
  );
}
