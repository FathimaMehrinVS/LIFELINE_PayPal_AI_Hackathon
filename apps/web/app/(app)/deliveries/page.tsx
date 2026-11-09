"use client";

import type { DeliveryPartner, DeliveryRecord, Supplier } from "@lifeline/contracts";
import { useCallback, useEffect, useState } from "react";
import { useAuthProfile } from "@/components/auth-session";
import { Badge, Card, Overline, fieldClass, button } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";

const NEXT: Record<string, { status: "accepted" | "preparing" | "ready" | "dispatched" | "handed_over"; label: string }> = {
  awaiting_acceptance: { status: "accepted", label: "Accept assignment" },
  accepted: { status: "preparing", label: "Start preparation" },
  preparing: { status: "ready", label: "Mark ready" },
  ready: { status: "dispatched", label: "Mark dispatched" },
  dispatched: { status: "handed_over", label: "Record handover" },
};

const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${amount.toFixed(2)} ${currency}`; }
};

function DeliveryHistory({ record }: { record: DeliveryRecord }) {
  return record.events.length ? <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">{record.events.map((event, index) => <li key={`${event.status}-${event.at}-${index}`} className="text-sm"><p className="font-semibold capitalize text-navy">{event.status.replaceAll("_", " ")}</p><p className="text-slate-600">{new Date(event.at).toLocaleString()} · actor {event.actor_id ?? "not available"}</p>{event.note && <p className="mt-1 text-slate-600">{event.note}</p>}{event.delivered_items.length > 0 && <ul className="mt-1 text-slate-600">{event.delivered_items.map((item) => <li key={item.basket_item_id}>{item.quantity} × {item.name}</li>)}</ul>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No delivery updates recorded yet.</p>;
}

export default function DeliveriesPage() {
  const profile = useAuthProfile();
  const [records, setRecords] = useState<DeliveryRecord[] | null>(null);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partnerChoices, setPartnerChoices] = useState<Record<string, string>>({});
  const [supplierChoices, setSupplierChoices] = useState<Record<string, string>>({});
  const [handoverQuantities, setHandoverQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const rows = await api.listDeliveries();
    setRecords(rows);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.listDeliveries(),
      profile.role === "NGO" ? api.listDeliveryPartners() : Promise.resolve([]),
      profile.role === "NGO" ? api.listSuppliers() : Promise.resolve([]),
    ]).then(([rows, partnerRows, supplierRows]) => {
      if (!active) return;
      setRecords(rows);
      setPartners(partnerRows);
      setSuppliers(supplierRows.filter((supplier) => supplier.status === "approved"));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiRequestError ? cause.message : "Could not load delivery records.");
    });
    return () => { active = false; };
  }, [profile.role]);

  async function act(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key); setError(""); setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : "The delivery update could not be saved.");
    } finally { setBusy(null); }
  }

  const ngo = profile.role === "NGO";
  const partner = profile.role === "PARTNER";
  if (!ngo && !partner) return <Card className="p-6"><h1 className="text-xl font-bold text-navy">Delivery access is restricted</h1><p className="mt-2 text-sm text-slate-600">Only an NGO reviewer or an assigned partner can access delivery records.</p></Card>;

  return (
    <div className="space-y-5">
      <div><Overline>Assistance operations</Overline><h1 className="mt-1 text-3xl font-extrabold text-navy">Delivery verification</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Partner handover and NGO verification are recorded separately. A completed record confirms the NGO reviewed the handover; it does not claim PayPal paid a recipient.</p></div>
      {error && <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-success/30 bg-success-tint p-4 text-sm text-success">{message}</p>}
      {records === null && !error && <p className="text-slate-600">Loading delivery records…</p>}
      {records?.length === 0 && <Card className="p-6"><h2 className="font-bold text-navy">{ngo ? "No eligible allocations yet" : "No deliveries assigned"}</h2><p className="mt-1 text-sm text-slate-600">{ngo ? "An allocation appears here after NGO approval." : "An NGO will assign an approved and funded assistance allocation to your partner profile."}</p></Card>}
      {records?.map((record) => {
        const key = record.allocation_id;
        const next = NEXT[record.fulfilment_status ?? ""];
        const handedOver = [...record.events].reverse().find((event) => event.status === "handed_over");
        const assigned = Boolean(record.fulfilment_status);
        return (
          <Card key={key} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold text-navy">Case {record.case_id}</h2><p className="mt-1 text-sm text-slate-600">Allocation {money(record.amount, record.currency)} · captured {money(record.captured_amount, record.currency)}</p></div>
              <Badge tone={record.allocation_status === "completed" ? "success" : assigned ? "human" : "neutral"}>{record.fulfilment_status?.replaceAll("_", " ") ?? record.allocation_status}</Badge>
            </div>
            {record.expected_items.length > 0 && <div className="mt-4"><p className="text-sm font-semibold text-navy">Approved basket</p><ul className="mt-1 space-y-1 text-sm text-slate-600">{record.expected_items.map((item) => <li key={item.basket_item_id}>{item.quantity} × {item.name}</li>)}</ul></div>}
            {ngo && !assigned && (
              <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-navy">Approved supplier<select className={`${fieldClass} mt-1`} value={supplierChoices[key] ?? ""} onChange={(event) => setSupplierChoices((current) => ({ ...current, [key]: event.target.value }))}><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></label>
                <label className="text-sm font-semibold text-navy">Partner profile<select className={`${fieldClass} mt-1`} value={partnerChoices[key] ?? ""} onChange={(event) => setPartnerChoices((current) => ({ ...current, [key]: event.target.value }))}><option value="">Choose assigned partner</option>{partners.map((item) => <option key={item.user_id} value={item.user_id}>{item.name} · {item.email}</option>)}</select></label>
                <div className="sm:col-span-2"><button className={button.primary} disabled={busy === key || record.captured_amount < record.amount || !supplierChoices[key] || !partnerChoices[key]} onClick={() => void act(key, () => api.assignDelivery({ allocation_id: key, merchant_id: supplierChoices[key]!, partner_user_id: partnerChoices[key]! }), "Partner assigned to funded allocation.")}>{busy === key ? "Assigning…" : "Assign partner"}</button>{record.captured_amount < record.amount && <p className="mt-2 text-xs text-warning">Captured donations must cover the approved amount before supplier assignment.</p>}</div>
              </div>
            )}
            {assigned && <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600"><span>Supplier: <strong className="text-navy">{record.merchant?.name}</strong></span><span>· Partner: <strong className="text-navy">{record.partner?.name ?? "unassigned"}</strong></span></div>}
            {partner && assigned && next && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                {next.status === "handed_over" && <div className="mb-3 space-y-2"><p className="text-sm font-semibold text-navy">Enter quantities actually handed over</p>{record.expected_items.map((item) => <label key={item.basket_item_id} className="flex items-center justify-between gap-3 text-sm text-slate-700"><span>{item.name} (planned {item.quantity})</span><input type="number" min={0} max={item.quantity} value={handoverQuantities[`${key}:${item.basket_item_id}`] ?? 0} onChange={(event) => setHandoverQuantities((current) => ({ ...current, [`${key}:${item.basket_item_id}`]: Number(event.target.value) }))} className={`${fieldClass} w-24`} /></label>)}</div>}
                <label className="mb-3 block text-sm font-semibold text-navy">Update note <input className={`${fieldClass} mt-1`} maxLength={500} value={notes[key] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} /></label>
                <button className={button.primary} disabled={busy === key || (next.status === "handed_over" && !record.expected_items.some((item) => (handoverQuantities[`${key}:${item.basket_item_id}`] ?? 0) > 0))} onClick={() => {
                  const delivered = record.expected_items.flatMap((item) => { const quantity = handoverQuantities[`${key}:${item.basket_item_id}`] ?? 0; return quantity > 0 ? [{ basket_item_id: item.basket_item_id, quantity }] : []; });
                  void act(key, () => api.submitDeliveryEvent(key, { status: next.status, ...(notes[key] ? { note: notes[key] } : {}), ...(next.status === "handed_over" ? { delivered_items: delivered } : {}) }), next.status === "handed_over" ? "Handover recorded for NGO verification." : `Delivery marked ${next.status.replaceAll("_", " ")}.`);
                }}>{busy === key ? "Saving…" : next.label}</button>
              </div>
            )}
            {ngo && record.fulfilment_status === "handed_over" && <div className="mt-4 rounded-xl border border-teal/30 bg-teal-tint/40 p-4"><p className="font-semibold text-navy">Partner handover for review</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{handedOver?.delivered_items.map((item) => <li key={item.basket_item_id}>{item.quantity} × {item.name}</li>)}</ul><label className="mt-3 block text-sm font-semibold text-navy">Verification note <input className={`${fieldClass} mt-1`} maxLength={500} value={notes[key] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} /></label><button className={`${button.primary} mt-3`} disabled={busy === key} onClick={() => void act(key, () => api.verifyDelivery(key, notes[key] ? { note: notes[key] } : {}), "Delivery verified and assistance case completed.")}>{busy === key ? "Verifying…" : "Verify delivery and complete case"}</button></div>}
            {assigned && <><h3 className="mt-5 text-sm font-bold text-navy">Recorded history</h3><DeliveryHistory record={record} /></>}
          </Card>
        );
      })}
    </div>
  );
}
