"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, HeartHandIcon } from "@/components/icons";
import { api } from "@/services/api";
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

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-navy p-7 text-white shadow-lg sm:p-9">
        <HeartHandIcon className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-white/10" />
        <h1 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Support approved assistance</h1>
        <p className="relative mt-2 max-w-2xl text-indigo-100">
          Fund a plan an NGO has already checked and approved. Payment is processed through PayPal Sandbox, so no real money moves.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">The plan you are funding</h2>
          {targetMessage && (
            <div role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>{targetMessage}</p>
              {!target && <Link href="/dashboard" className="mt-2 inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">Open the NGO dashboard <ArrowRightIcon className="h-4 w-4" /></Link>}
            </div>
          )}
          {target && (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-indigo-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Approved amount</dt>
                <dd className="tabular mt-1 text-2xl font-bold text-indigo-700">{target.amount.toFixed(2)} {target.currency}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Case reference</dt>
                <dd className="mt-1 break-all font-mono text-sm text-slate-800">{target.caseId}</dd>
              </div>
            </dl>
          )}
          <h3 className="mt-6 text-sm font-semibold text-slate-800">What happens next</h3>
          <ol className="mt-3 space-y-3 text-sm text-slate-600">
            {NEXT_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <form onSubmit={submit} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-800">
            <span className="mb-1 block">Donation amount ({target?.currency ?? "currency"})</span>
            <input className="w-full rounded-xl border border-slate-300 bg-white p-3 font-normal focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100" type="number" min="0.01" max={target?.amount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <button disabled={busy || !target} className="w-full rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none">{busy ? "Connecting to PayPal…" : "Continue to PayPal Sandbox"}</button>
          <p className="text-xs text-slate-500">No assistance payment is made by creating this donation.</p>
          {message && <p role="status" className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
        </form>
      </div>
    </div>
  );
}
