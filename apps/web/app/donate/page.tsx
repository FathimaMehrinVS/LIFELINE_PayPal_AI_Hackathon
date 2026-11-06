"use client";

import { useEffect, useState } from "react";
import { api } from "../../services/api";

export default function DonatePage() {
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("state") === "cancelled") setMessage("Checkout was cancelled. No donation was captured."); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const donation = await api.createDonation({ campaign_id: "camp_demo", amount: Number(amount), currency: "EUR" });
      if (!donation.approval_url) throw new Error("PayPal did not return an approval link");
      window.location.assign(donation.approval_url);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not start PayPal checkout"); setBusy(false); }
  }

  return <section className="mx-auto max-w-xl space-y-5">
    <div><h1 className="text-2xl font-bold">Support the essentials fund</h1><p className="text-slate-600">Demo campaign. Payment is processed through PayPal Sandbox.</p></div>
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5">
      <label className="grid gap-1 text-sm">Donation amount (EUR)<input className="rounded border p-2" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <button disabled={busy} className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Connecting to PayPal…" : "Continue to PayPal Sandbox"}</button>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </form>
  </section>;
}
