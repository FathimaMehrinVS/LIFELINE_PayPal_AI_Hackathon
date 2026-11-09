"use client";

import type { Supplier, SupplierStatus } from "@lifeline/contracts";
import type { ColDef, ICellRendererParams, IRowNode } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, button, fieldClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { lifelineGridTheme } from "../dashboard/cases-grid";
import { STATUS_LABEL, STATUS_TONE, needName, shortDate } from "./supplier-format";

// Owner: Member 1. The supplier directory, styled from "LIFELINE Screen Designs" page 14. Real records only.

const NEEDS = ["food", "water", "medicine", "shelter", "hygiene", "baby_supplies", "clothing", "transport", "other"] as const;
type Filter = "all" | SupplierStatus;

function BusinessCell({ data }: ICellRendererParams<Supplier>) {
  if (!data) return null;
  return (
    <span className="flex h-full flex-col justify-center leading-tight">
      <span className="font-bold text-navy">{data.name}</span>
      <span className="text-xs text-slate-500">{data.location}</span>
    </span>
  );
}

function StatusCell({ data }: ICellRendererParams<Supplier>) {
  return data ? <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge> : null;
}

function PerformanceCell({ data }: ICellRendererParams<Supplier>) {
  const score = data?.scorecard.score;
  return (
    <span className="flex h-full items-center gap-2" title="Weighted by the number of finished orders">
      <span className="h-1.5 w-16 rounded-full bg-slate-200"><span className="block h-1.5 rounded-full bg-navy" style={{ width: `${score ?? 0}%` }} /></span>
      <span className="tabular text-sm text-navy">{score == null ? "—" : Math.round(score)}</span>
    </span>
  );
}

function ComplaintsCell({ data }: ICellRendererParams<Supplier>) {
  const open = data?.scorecard.open_complaints ?? 0;
  return open === 0 ? <span className="text-slate-600">None</span> : <span className={`font-semibold ${open > 1 ? "text-critical" : "text-warning"}`}>{open} open</span>;
}

function ReviewCell({ data }: ICellRendererParams<Supplier>) {
  return data ? <Link href={`/suppliers/${encodeURIComponent(data.supplier_id)}`} className="font-semibold text-teal-text hover:underline">Review →</Link> : null;
}

function RegisterForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [areas, setAreas] = useState("");
  const [accepts, setAccepts] = useState("");
  const [contact, setContact] = useState("");
  const [categories, setCategories] = useState<(typeof NEEDS)[number][]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const list = (text: string) => text.split(",").map((item) => item.trim()).filter(Boolean);
      await api.registerSupplier({ name, location, categories, service_areas: list(areas), accepts: list(accepts), ...(contact.trim() ? { contact: contact.trim() } : {}) });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not register this supplier.");
      setBusy(false);
    }
  }

  const field = "block text-sm font-bold text-navy";
  return (
    <Card className="mt-4 p-6">
      <h2 className="text-lg font-bold text-navy">Register supplier</h2>
      <p className="mt-0.5 text-sm text-slate-600">New suppliers start as Pending and can't receive orders until a reviewer approves them.</p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={field}><span className="mb-1.5 block">Business name</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} /></label>
        <label className={field}><span className="mb-1.5 block">Location</span><input required minLength={2} value={location} onChange={(e) => setLocation(e.target.value)} className={fieldClass} /></label>
        <label className={field}><span className="mb-1.5 block">Service areas <span className="font-normal text-slate-500">(separate with commas)</span></span><input value={areas} onChange={(e) => setAreas(e.target.value)} className={fieldClass} /></label>
        <label className={field}><span className="mb-1.5 block">Payment methods <span className="font-normal text-slate-500">(separate with commas)</span></span><input value={accepts} onChange={(e) => setAccepts(e.target.value)} className={fieldClass} /></label>
        <label className={field}><span className="mb-1.5 block">Contact <span className="font-normal text-slate-500">(optional)</span></span><input value={contact} onChange={(e) => setContact(e.target.value)} className={fieldClass} /></label>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-bold text-navy">Categories</legend>
          <div className="flex flex-wrap gap-2">
            {NEEDS.map((need) => {
              const on = categories.includes(need);
              return <button key={need} type="button" aria-pressed={on} onClick={() => setCategories((list) => (on ? list.filter((item) => item !== need) : [...list, need]))} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-navy text-white" : "border border-slate-300 bg-white text-navy hover:bg-slate-50"}`}>{needName(need)}</button>;
            })}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-critical sm:col-span-2">{error}</p>}
        <div className="flex gap-3 sm:col-span-2">
          <button disabled={busy || categories.length === 0} className={button.primary}>{busy ? "Registering…" : "Register supplier"}</button>
          <button type="button" onClick={onCancel} className={button.secondary}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [registering, setRegistering] = useState(false);

  const load = useCallback(() => {
    api.listSuppliers().then((rows) => { setSuppliers(rows); setError(""); }).catch(() => setError("Can't load suppliers. Is the API running?"));
  }, []);
  useEffect(load, [load]);

  const count = (status: SupplierStatus) => suppliers?.filter((supplier) => supplier.status === status).length ?? 0;
  const pills: { value: Filter; label: string; on: string; off: string }[] = [
    { value: "all", label: `All ${suppliers?.length ?? 0}`, on: "bg-navy text-white", off: "border border-slate-300 bg-white text-navy" },
    { value: "approved", label: `Approved ${count("approved")}`, on: "bg-success text-white", off: "border border-success/30 bg-success-tint text-success" },
    { value: "pending", label: `Pending ${count("pending")}`, on: "bg-warning text-white", off: "border border-warning/30 bg-warning-tint text-warning" },
    { value: "suspended", label: `Suspended ${count("suspended")}`, on: "bg-critical text-white", off: "border border-critical/30 bg-critical-tint text-critical" },
  ];

  const columns = useMemo<ColDef<Supplier>[]>(() => [
    { headerName: "Business", valueGetter: (p) => `${p.data?.name} ${p.data?.location}`, cellRenderer: BusinessCell, flex: 2, minWidth: 260, tooltipValueGetter: (p) => p.data?.name },
    { headerName: "Categories", valueGetter: (p) => p.data?.categories.map(needName).join(", "), minWidth: 110, flex: 1, tooltipValueGetter: (p) => p.value },
    { headerName: "Trust status", colId: "status", valueGetter: (p) => p.data?.status, cellRenderer: StatusCell, width: 112 },
    { headerName: "Orders", valueGetter: (p) => p.data?.scorecard.orders_completed, type: "rightAligned", width: 84, headerTooltip: "Completed orders: confirmed by the recipient" },
    { headerName: "Performance", colId: "score", valueGetter: (p) => p.data?.scorecard.score ?? -1, cellRenderer: PerformanceCell, width: 140, sort: "desc", headerTooltip: "Weighted by the number of finished orders, so one good order can't outrank a long record" },
    { headerName: "Complaints", valueGetter: (p) => p.data?.scorecard.open_complaints, cellRenderer: ComplaintsCell, width: 112 },
    { headerName: "Payment", valueGetter: (p) => p.data?.accepts.join(", ") || "—", width: 118 },
    { headerName: "Decided", valueGetter: (p) => shortDate(p.data?.status_changed_at), width: 108 },
    { headerName: "", colId: "review", cellRenderer: ReviewCell, sortable: false, resizable: false, width: 98, pinned: "right" },
  ], []);

  const passes = useCallback((node: IRowNode<Supplier>) => node.data?.status === filter, [filter]);

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy">Supplier directory</h1>
          <p className="text-slate-600">{suppliers?.length ?? 0} suppliers · {count("approved")} approved · {count("pending")} pending · {count("suspended")} suspended</p>
        </div>
        <button type="button" onClick={() => setRegistering(true)} className={button.primary}>+ Register Supplier</button>
      </header>

      {registering && <RegisterForm onCancel={() => setRegistering(false)} onCreated={() => { setRegistering(false); load(); }} />}

      <p className="mt-4 rounded-xl border border-teal/30 bg-teal-tint/60 p-4 text-sm text-navy">
        <strong>Suppliers found through external product search are not automatically verified.</strong> They can only receive orders after an NGO reviewer approves them.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, location or category" className={`${fieldClass} min-w-64 flex-1`} />
        {pills.map((pill) => <button key={pill.value} type="button" aria-pressed={filter === pill.value} onClick={() => setFilter(pill.value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === pill.value ? pill.on : pill.off}`}>{pill.label}</button>)}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}

      <div className="mt-4">
        <AgGridReact<Supplier>
          theme={lifelineGridTheme}
          rowData={suppliers ?? []}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true }}
          getRowId={(p) => p.data.supplier_id}
          quickFilterText={search}
          isExternalFilterPresent={() => filter !== "all"}
          doesExternalFilterPass={passes}
          rowHeight={62}
          tooltipShowDelay={300}
          domLayout="autoHeight"
          overlayNoRowsTemplate="No suppliers yet. Use Register Supplier to add one."
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">Sorted by performance to compare suppliers. Click any column to re-sort.</p>
    </div>
  );
}
