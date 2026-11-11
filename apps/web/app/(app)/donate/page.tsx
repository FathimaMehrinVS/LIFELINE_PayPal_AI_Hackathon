"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { Badge, Card, Choice, button, fieldClass } from "@/components/ui";
import { approximateInDisplay } from "@/lib/currency";
import { api } from "@/services/api";
import { caseRef } from "../dashboard/case-row";
import { parseDonationTarget, type DonationTarget } from "./donation-target";

const NEXT_STEPS = [
  "You approve the payment on PayPal's Sandbox page.",
  "Our server confirms the payment with PayPal before anything is recorded as received.",
  "The NGO pays the supplier as a separate, recorded step.",
];

export default function DonatePage() {
  const [target, setTarget] = useState<DonationTarget | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [targetMessage, setTargetMessage] = useState("Loading the approved assistance target…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("state") === "cancelled") {
      const donationId = params.get("donation_id")?.trim();
      if (!donationId) {
        setMessage("Checkout returned without a donation reference. Payment status has not been changed.");
      } else {
        api.cancelDonation(donationId).then((result) => {
          setMessage(result.status === "cancelled"
            ? "Checkout was cancelled. The donation is marked cancelled; PayPal has not confirmed a capture."
            : result.status === "captured"
              ? "PayPal confirmed that this donation was captured."
              : `Checkout ended. Current donation status: ${result.status}.`);
        }).catch((error: unknown) => {
          setMessage(error instanceof Error ? `Could not update checkout status: ${error.message}` : "Could not update checkout status.");
        });
      }
    }

    const parsedTarget = parseDonationTarget(window.location.search);
    if (!parsedTarget) {
      setTarget(null);
      setTargetMessage("Choose an NGO-approved plan before donating.");
      return;
    }

    setTarget(parsedTarget);
    setAmount(parsedTarget.amount.toFixed(2));
    setTargetMessage("");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setBusy(true); setMessage("");
    try {
      const donation = await api.createDonation({ allocation_id: target.allocationId, amount: Number(amount), currency: target.currency });
      if (!donation.approval_url) throw new Error("PayPal did not return an approval link");
      window.location.assign(donation.approval_url);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not start PayPal checkout"); setBusy(false); }
  }

  const entered = Number(amount);
  const presets = target ? [...[25, 50, 100].filter((value) => value < target.amount), target.amount] : [];
  const money = (value: number) => (target ? new Intl.NumberFormat(undefined, { style: "currency", currency: target.currency }).format(value) : "");

  return (
    <div className="mx-auto max-w-[1130px]">
      <Link href="/plans" className="text-sm font-semibold text-teal-text hover:underline">← All approved plans</Link>
      <h1 className="mt-2 text-[28px] font-bold text-navy">Support this assistance plan</h1>
      {message && <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-navy">{message}</p>}

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} className="space-y-5">
          <Card className="p-6">
            <p className="font-bold text-navy">Donation amount</p>
            {targetMessage && (
              <div role="status" className="mt-3 rounded-xl border border-accent/50 bg-warning-tint p-4 text-sm text-warning">
                <p>{targetMessage}</p>
                {!target && <Link href="/plans" className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline">See approved plans <ArrowRightIcon className="h-4 w-4" /></Link>}
              </div>
            )}
            {target && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Donation amount">
                {presets.map((value) => (
                  <Choice key={value} selected={entered === value} onClick={() => setAmount(value.toFixed(2))} className="justify-center rounded-xl px-3 py-4 text-base font-bold">
                    <span className="flex flex-col items-center leading-tight">
                      <span>{value === target.amount ? `Full · ${money(value)}` : money(value)}</span>
                      {approximateInDisplay(value, target.currency) && <span className="text-xs font-medium text-slate-500">{approximateInDisplay(value, target.currency)}</span>}
                    </span>
                  </Choice>
                ))}
              </div>
            )}
            <label className="mt-4 block text-sm font-bold text-navy">
              <span className="mb-1.5 block">Other amount ({target?.currency ?? "currency"})</span>
              <input className={fieldClass} type="number" min="0.01" max={target?.amount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
          </Card>

          <Card className="p-6">
            <p className="font-bold text-navy">Payment</p>
            <p className="mt-2 rounded-xl border border-dashed border-simulated bg-simulated-tint p-4 text-center text-sm text-simulated">You'll approve this on PayPal's Sandbox page, so no real money moves. LIFELINE never collects card or account details.</p>
            <button disabled={busy || !target} className={`${button.primary} mt-4 w-full py-3.5 text-base`}>{busy ? "Connecting to PayPal…" : "Continue with PayPal"}</button>
            <p className="mt-3 text-center text-[13px] text-slate-600">Processed by PayPal Sandbox · No assistance payment is made by creating this donation.</p>
            {target && approximateInDisplay(target.amount, target.currency) && <p className="mt-2 text-center text-[13px] text-slate-600">PayPal charges in {target.currency}. If your PayPal account uses another currency, PayPal converts it and shows the exact amount before you approve.</p>}
          </Card>
        </form>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap gap-2"><Badge tone="human">NGO approved</Badge>{target && <Badge tone="neutral"><span className="font-mono">{caseRef(target.caseId)}</span></Badge>}</div>
            <h2 className="mt-3 text-lg font-bold text-navy">The plan you are funding</h2>
            {target ? <dl className="mt-3 flex justify-between text-sm font-bold text-navy"><dt>Approved amount</dt><dd className="tabular">{money(target.amount)}</dd></dl> : <p className="mt-2 text-sm text-slate-600">Choose an approved plan first.</p>}
            {target && <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-100 p-4"><span className="font-semibold text-navy">You pay today</span><span className="text-right"><span className="tabular block text-2xl font-extrabold text-navy">{entered > 0 ? money(entered) : "—"}</span>{entered > 0 && target && approximateInDisplay(entered, target.currency) && <span className="tabular block text-sm text-slate-600">{approximateInDisplay(entered, target.currency)} in your currency</span>}</span></div>}
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-navy">What happens next</h2>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
              {NEXT_STEPS.map((step, index) => <li key={step} className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{index + 1}</span>{step}</li>)}
            </ol>
          </Card>
          <p className="rounded-xl border border-teal/30 bg-teal-tint p-4 text-sm text-navy">Your contribution supports the NGO-approved plan shown above.</p>
        </aside>
      </div>
    </div>
  );
}
