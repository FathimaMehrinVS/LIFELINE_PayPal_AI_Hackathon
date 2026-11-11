"use client";

import type { DeliveryPartner, DeliveryRecord } from "@lifeline/contracts";
import { useCallback, useEffect, useState } from "react";
import { useAuthProfile } from "@/components/auth-session";
import { Badge, Card, Overline, fieldClass, button } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { caseRef, formatMoney } from "../dashboard/case-row";
import { CheckIcon } from "@/components/icons";

const NEXT: Record<string, { status: "accepted" | "preparing" | "ready" | "dispatched" | "handed_over"; label: string }> = {
  awaiting_acceptance: { status: "accepted", label: "Accept assignment" },
  accepted: { status: "preparing", label: "Start preparation" },
  preparing: { status: "ready", label: "Mark ready" },
  ready: { status: "dispatched", label: "Mark dispatched" },
  dispatched: { status: "handed_over", label: "Record handover" },
};

const money = (amount: number, currency: string) => formatMoney(amount, currency);

function actorLabel(record: DeliveryRecord, actorId: string | null) {
  if (!actorId) return "System";
  return actorId === record.partner?.user_id ? `Partner (${record.partner.name})` : "NGO staff";
}

function DeliveryHistory({ record }: { record: DeliveryRecord }) {
  return record.events.length ? (
    <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
      {record.events.map((event, index) => (
        <li key={`${event.status}-${event.at}-${index}`} className="text-sm">
          <p className="font-semibold capitalize text-navy">{event.status.replaceAll("_", " ")}{event.evidence_type === "pickup_code" && <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium normal-case text-success"><CheckIcon className="h-3 w-3" /> family's pickup code checked</span>}</p>
          <p className="text-slate-600">{new Date(event.at).toLocaleString()} · {actorLabel(record, event.actor_id)}</p>
          {event.note && <p className="text-slate-600">{event.note}</p>}
        </li>
      ))}
    </ol>
  ) : <p className="mt-2 text-sm text-slate-500">No delivery steps recorded yet.</p>;
}

export default function DeliveriesPage() {
  const profile = useAuthProfile();
  const [records, setRecords] = useState<DeliveryRecord[] | null>(null);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [partnerChoices, setPartnerChoices] = useState<Record<string, string>>({});
  const [pickupCodes, setPickupCodes] = useState<Record<string, string>>({});
  const [pickupCodeInputs, setPickupCodeInputs] = useState<Record<string, string>>({});
  const [handoverQuantities, setHandoverQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acceptedShortfalls, setAcceptedShortfalls] = useState<Record<string, boolean>>({});
  const [shortfallReasons, setShortfallReasons] = useState<Record<string, string>>({});
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
    ]).then(([rows, partnerRows]) => {
      if (!active) return;
      setRecords(rows);
      setPartners(partnerRows);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiRequestError ? cause.message : "Could not load delivery records.");
    });
    return () => { active = false; };
  }, [profile.role]);

  async function act(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key); setError(""); setMessage("");
    try {
      const result = await action();
      const pickupCode = result && typeof result === "object" ? (result as { pickup_code?: unknown }).pickup_code : undefined;
      if (typeof pickupCode === "string") {
        setPickupCodes((current) => ({ ...current, [key]: pickupCode }));
      }
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
        const handedOverQuantities = new Map(handedOver?.delivered_items.map((item) => [item.basket_item_id, item.quantity]) ?? []);
        const shortfalls = record.expected_items.filter((item) => (handedOverQuantities.get(item.basket_item_id) ?? 0) < item.quantity);
        const assigned = Boolean(record.partner);
        return (
          <Card key={key} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold text-navy">Case <span className="font-mono">{caseRef(record.case_id)}</span></h2><p className="mt-1 text-sm text-slate-600">Allocation {money(record.amount, record.currency)} · captured {money(record.captured_amount, record.currency)}</p></div>
              <Badge tone={record.allocation_status === "completed" ? "success" : assigned ? "human" : "neutral"} className="capitalize">{record.fulfilment_status?.replaceAll("_", " ") ?? record.allocation_status}</Badge>
            </div>
            {record.expected_items.length > 0 && <div className="mt-4"><p className="text-sm font-semibold text-navy">Approved basket</p><ul className="mt-1 space-y-1 text-sm text-slate-600">{record.expected_items.map((item) => <li key={item.basket_item_id}>{item.quantity} × {item.name}</li>)}</ul></div>}
            {ngo && !assigned && record.purchase_order_id && (
              <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <p className="text-sm font-semibold text-navy">Approved supplier<span className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal">{record.merchant?.name ?? "Unavailable"}</span></p>
                <label className="text-sm font-semibold text-navy">Partner profile<select className={`${fieldClass} mt-1`} value={partnerChoices[key] ?? ""} onChange={(event) => setPartnerChoices((current) => ({ ...current, [key]: event.target.value }))}><option value="">Choose assigned partner</option>{partners.map((item) => <option key={item.user_id} value={item.user_id}>{item.name} · {item.email}</option>)}</select></label>
                <div className="sm:col-span-2"><button className={button.primary} disabled={busy === key || record.captured_amount < record.amount || !record.merchant || !partnerChoices[key]} onClick={() => void act(key, () => api.assignDelivery({ allocation_id: key, merchant_id: record.merchant!.merchant_id, partner_user_id: partnerChoices[key]! }), "Partner assigned to funded purchase order.")}>{busy === key ? "Assigning…" : "Assign partner"}</button>{record.captured_amount < record.amount && <p className="mt-2 text-xs text-warning">Captured donations must cover the approved amount before partner assignment.</p>}</div>
              </div>
            )}
            {assigned && <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600"><span>Supplier: <strong className="text-navy">{record.merchant?.name}</strong></span><span>· Partner: <strong className="text-navy">{record.partner?.name ?? "unassigned"}</strong></span></div>}
            {ngo && assigned && ["awaiting_acceptance", "accepted", "preparing", "ready", "dispatched"].includes(record.fulfilment_status ?? "") && (
              <div className="mt-4 rounded-xl border border-teal/30 bg-teal-tint/40 p-4">
                <p className="font-semibold text-navy">Pickup code for the family</p>
                {pickupCodes[key] ? (
                  <div role="status">
                    <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-teal-text">{pickupCodes[key]}</p>
                    <p className="mt-1 text-sm text-slate-700">Give this to the family by phone, SMS or on paper. <strong>Don&apos;t share it with the partner.</strong> It&apos;s shown only now.</p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-700">{record.pickup_code_issued ? "A code has been given to the family. Create a new one only if they lost it; the old code then stops working." : "The family gives this code to the partner when they collect the goods. It proves the right family received them."}</p>
                )}
                <button type="button" className={`${record.pickup_code_issued || pickupCodes[key] ? button.secondary : button.primary} mt-3`} disabled={busy === key} onClick={() => void act(key, () => api.issuePickupCode(key), "Pickup code created. Give it to the family.")}>{busy === key ? "Creating…" : record.pickup_code_issued || pickupCodes[key] ? "Create a new code" : "Create pickup code"}</button>
              </div>
            )}
            {partner && assigned && next && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                {next.status === "handed_over" && <div className="mb-3 space-y-2"><p className="text-sm font-semibold text-navy">Enter quantities actually handed over</p>{record.expected_items.map((item) => <label key={item.basket_item_id} className="flex items-center justify-between gap-3 text-sm text-slate-700"><span>{item.name} (planned {item.quantity})</span><input type="number" min={0} max={item.quantity} value={handoverQuantities[`${key}:${item.basket_item_id}`] ?? 0} onChange={(event) => setHandoverQuantities((current) => ({ ...current, [`${key}:${item.basket_item_id}`]: Number(event.target.value) }))} className={`${fieldClass} w-24`} /></label>)}</div>}
                {next.status === "handed_over" && (
                  <label className="mb-3 block text-sm font-semibold text-navy">Pickup code from the family
                    <input className={`${fieldClass} mt-1 max-w-56 font-mono tracking-widest`} inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="8 digits" value={pickupCodeInputs[key] ?? ""} onChange={(event) => setPickupCodeInputs((current) => ({ ...current, [key]: event.target.value.replace(/\D/g, "").slice(0, 8) }))} />
                    <span className="mt-1 block text-xs font-normal text-slate-600">Ask the family for the code the NGO gave them. Wrong codes are counted, and the code locks after 5.</span>
                  </label>
                )}
                <label className="mb-3 block text-sm font-semibold text-navy">Update note <input className={`${fieldClass} mt-1`} maxLength={500} value={notes[key] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} /></label>
                <button className={button.primary} disabled={busy === key || (next.status === "handed_over" && (pickupCodeInputs[key]?.length !== 8 || !record.expected_items.some((item) => (handoverQuantities[`${key}:${item.basket_item_id}`] ?? 0) > 0)))} onClick={() => {
                  const delivered = record.expected_items.flatMap((item) => { const quantity = handoverQuantities[`${key}:${item.basket_item_id}`] ?? 0; return quantity > 0 ? [{ basket_item_id: item.basket_item_id, quantity }] : []; });
                  void act(key, () => api.submitDeliveryEvent(key, { status: next.status, ...(notes[key] ? { note: notes[key] } : {}), ...(next.status === "handed_over" ? { delivered_items: delivered, pickup_code: pickupCodeInputs[key]! } : {}) }), next.status === "handed_over" ? "Handover recorded for NGO verification." : `Delivery marked ${next.status.replaceAll("_", " ")}.`);
                }}>{busy === key ? "Saving…" : next.label}</button>
              </div>
            )}
            {ngo && record.fulfilment_status === "handed_over" && <div className="mt-4 rounded-xl border border-teal/30 bg-teal-tint/40 p-4"><p className="font-semibold text-navy">Partner handover for review</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{handedOver?.delivered_items.map((item) => <li key={item.basket_item_id}>{item.quantity} × {item.name}</li>)}</ul>{shortfalls.length > 0 && <div className="mt-3 rounded-lg border border-warning/30 bg-warning-tint p-3"><p className="text-sm font-semibold text-warning">Shortfall against approved basket</p><ul className="mt-1 text-sm text-warning">{shortfalls.map((item) => <li key={item.basket_item_id}>{item.name}: {handedOverQuantities.get(item.basket_item_id) ?? 0} of {item.quantity}</li>)}</ul><label className="mt-3 flex items-start gap-2 text-sm font-semibold text-navy"><input type="checkbox" checked={acceptedShortfalls[key] ?? false} onChange={(event) => setAcceptedShortfalls((current) => ({ ...current, [key]: event.target.checked }))} /><span>I approve completing this allocation with the recorded shortfall.</span></label>{acceptedShortfalls[key] && <label className="mt-3 block text-sm font-semibold text-navy">Reason for accepting the shortfall<input className={`${fieldClass} mt-1`} maxLength={500} value={shortfallReasons[key] ?? ""} onChange={(event) => setShortfallReasons((current) => ({ ...current, [key]: event.target.value }))} /></label>}</div>}{handedOver?.evidence_type === "pickup_code" ? <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-success"><CheckIcon className="h-4 w-4" /> The family&apos;s pickup code was checked at handover.</p> : <label className="mt-3 block text-sm font-semibold text-navy">Pickup code<input className={`${fieldClass} mt-1`} inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={pickupCodeInputs[key] ?? ""} onChange={(event) => setPickupCodeInputs((current) => ({ ...current, [key]: event.target.value.replace(/\D/g, "").slice(0, 8) }))} /></label>}<label className="mt-3 block text-sm font-semibold text-navy">Verification note <input className={`${fieldClass} mt-1`} maxLength={500} value={notes[key] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} /></label><button className={`${button.primary} mt-3`} disabled={busy === key || (handedOver?.evidence_type !== "pickup_code" && pickupCodeInputs[key]?.length !== 8) || (shortfalls.length > 0 && (!acceptedShortfalls[key] || !shortfallReasons[key]?.trim()))} onClick={() => void act(key, () => api.verifyDelivery(key, { ...(handedOver?.evidence_type !== "pickup_code" ? { pickup_code: pickupCodeInputs[key]! } : {}), ...(notes[key] ? { note: notes[key] } : {}), ...(shortfalls.length > 0 ? { accept_shortfall: true, shortfall_reason: shortfallReasons[key] } : {}) }), "Delivery confirmed. The case is complete.")}>{busy === key ? "Confirming…" : "Confirm delivery"}</button></div>}
            {assigned && <><h3 className="mt-5 text-sm font-bold text-navy">Recorded history</h3><DeliveryHistory record={record} /></>}
          </Card>
        );
      })}
    </div>
  );
}
