"use client";

import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { parseDonationTarget, type DonationTarget } from "./donation-target";

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
      setTargetMessage("Choose an NGO-approved assistance allocation from the dashboard before donating.");
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

  return <section className="mx-auto max-w-xl space-y-5">
    <div><h1 className="text-2xl font-bold">Support approved assistance</h1><p className="text-slate-600">Payment is processed through PayPal Sandbox. No assistance payment is made by creating this donation.</p></div>
    {targetMessage && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{targetMessage}</p>}
    {target && <p className="rounded-xl border bg-white p-4 text-sm text-slate-700">Approved case {target.caseId} · allocation limit {target.amount.toFixed(2)} {target.currency}</p>}
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5">
      <label className="grid gap-1 text-sm">Donation amount ({target?.currency ?? "currency"})<input className="rounded border p-2" type="number" min="0.01" max={target?.amount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <button disabled={busy || !target} className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Connecting to PayPal…" : "Continue to PayPal Sandbox"}</button>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </form>
  </section>;
}
