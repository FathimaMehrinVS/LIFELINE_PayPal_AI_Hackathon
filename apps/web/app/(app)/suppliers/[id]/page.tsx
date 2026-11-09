"use client";

import type { SupplierDetail, SupplierStatus } from "@lifeline/contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, button, fieldClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { STATUS_LABEL, STATUS_TONE, needName, shortDate } from "../supplier-format";

// Owner: Member 1. One supplier, styled from "LIFELINE Screen Designs" page 15. Every decision needs a recorded reason.

const ACTIONS: Record<SupplierStatus, { to: SupplierStatus; label: string; style: string }[]> = {
  pending: [{ to: "suspended", label: "Suspend Supplier", style: button.destructive }, { to: "approved", label: "Approve Supplier", style: button.confirm }],
  approved: [{ to: "suspended", label: "Suspend Supplier", style: button.destructive }],
  suspended: [{ to: "approved", label: "Reinstate Supplier", style: button.confirm }],
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-sm text-slate-600">{label}</dt><dd className="font-semibold text-navy">{children}</dd></div>;
}

function Tile({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="tabular text-2xl font-bold text-navy">{value}</p><p className="text-[13px] text-slate-600">{label}</p></div>;
}

function historyTitle(entry: SupplierDetail["history"][number]) {
  if (entry.action === "supplier.registered") return "Registered";
  return entry.from && entry.to ? `${STATUS_LABEL[entry.from]} → ${STATUS_LABEL[entry.to]}` : entry.action;
}

export default function SupplierReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [message, setMessage] = useState("Loading…");
  const [pending, setPending] = useState<SupplierStatus | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.getSupplier(decodeURIComponent(id)).then(setSupplier).catch((err) => setMessage(err instanceof ApiRequestError && err.status === 404 ? "This supplier was not found." : "Can't load this supplier."));
  }, [id]);
  useEffect(load, [load]);

  async function decide() {
    if (!pending || !supplier) return;
    setBusy(true);
    setError("");
    try {
      setSupplier(await api.updateSupplierStatus(supplier.supplier_id, { status: pending, reason }));
      setPending(null);
      setReason("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save this decision.");
    } finally {
      setBusy(false);
    }
  }

  const back = <Link href="/suppliers" className="text-sm font-semibold text-teal-text hover:underline">← Supplier directory</Link>;
  if (!supplier) return <div>{back}<p className="mt-3 text-slate-600">{message}</p></div>;

  const { scorecard } = supplier;
  const initials = supplier.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 font-bold text-navy">{initials}</span>
          <div>
            {back}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] font-bold leading-tight text-navy">{supplier.name}</h1>
              <Badge tone={STATUS_TONE[supplier.status]}>{STATUS_LABEL[supplier.status]}</Badge>
            </div>
            <p className="text-sm text-slate-600">Registered {shortDate(supplier.created_at)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {ACTIONS[supplier.status].map((action) => <button key={action.to} type="button" onClick={() => { setPending(action.to); setError(""); }} className={action.style}>{action.label}</button>)}
        </div>
      </div>

      {pending && (
        <Card className="mt-4 p-5">
          <label className="block text-sm font-bold text-navy">
            <span className="mb-1.5 block">Why are you marking this supplier as {STATUS_LABEL[pending].toLowerCase()}?</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you checked, or what went wrong" className={fieldClass} />
          </label>
          <p className="mt-1 text-xs text-slate-500">Saved to the audit log with your name and the time.</p>
          {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void decide()} className={button.primary}>{busy ? "Saving…" : "Save decision"}</button>
            <button type="button" onClick={() => setPending(null)} className={button.secondary}>Cancel</button>
          </div>
        </Card>
      )}

      <p className="mt-4 rounded-xl border border-accent/50 bg-warning-tint p-4 text-sm text-warning">
        <strong>Approval must be based on actual verification evidence, not public ratings.</strong> {supplier.status === "approved" ? "This supplier can receive purchase orders." : "This supplier can't receive purchase orders until it is approved."}
      </p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-navy">Business identity</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Fact label="Business name">{supplier.name}</Fact>
              <Fact label="Location">{supplier.location}</Fact>
              <Fact label="Contact">{supplier.contact ?? "Not provided"}</Fact>
              <Fact label="Payment methods">{supplier.accepts.join(", ") || "Not provided"}</Fact>
            </dl>
            <p className="mt-3 text-sm text-slate-600">Service areas</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {supplier.service_areas.map((area) => <span key={area} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-navy">{area}</span>)}
              {supplier.service_areas.length === 0 && <span className="text-sm text-slate-500">None listed</span>}
            </div>
            <p className="mt-3 text-sm text-slate-600">Product categories</p>
            <p className="font-semibold text-navy">{supplier.categories.map(needName).join(", ") || "None listed"}</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-bold text-navy">Performance &amp; incidents</h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Tile value={String(scorecard.orders_completed)} label="Completed orders" />
              <Tile value={scorecard.score == null ? "—" : String(Math.round(scorecard.score))} label="Performance" />
              <Tile value={String(scorecard.open_complaints)} label="Open complaints" />
            </div>
            <p className="mt-3 text-sm text-slate-600">{scorecard.orders_finished === 0 ? "No finished orders yet." : `Based on ${scorecard.orders_finished} finished ${scorecard.orders_finished === 1 ? "order" : "orders"}, ${scorecard.fulfilment_rate}% confirmed by the recipient.`}</p>
            {supplier.incidents.length > 0 && (
              <ul className="mt-3 space-y-2">
                {supplier.incidents.map((incident) => (
                  <li key={incident.incident_id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm text-navy">
                    <span>{incident.description}<span className="block text-xs text-slate-500">{shortDate(incident.created_at)} · {incident.severity} severity</span></span>
                    <Badge tone={incident.status === "open" ? "warning" : "success"} className="capitalize">{incident.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Decision history</h2>
          <ol className="mt-3 space-y-3">
            {supplier.history.map((entry) => (
              <li key={`${entry.action}-${entry.at}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold text-navy">{historyTitle(entry)}</p><p className="text-xs text-slate-500">{shortDate(entry.at)}</p></div>
                {entry.reason && <p className="mt-1 text-sm text-slate-700">{entry.reason}</p>}
                <p className="mt-1 text-xs text-slate-500">{entry.actor ?? "System"}</p>
              </li>
            ))}
            {supplier.history.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No decisions recorded yet.</li>}
          </ol>
        </Card>
      </div>
    </div>
  );
}
