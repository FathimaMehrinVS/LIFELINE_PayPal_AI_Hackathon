"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DonationResult } from "@lifeline/contracts";
import { api } from "../../../services/api";

export default function DonationReturnPage() {
  const [state, setState] = useState<"capturing" | "captured" | "failed">("capturing");
  const [donation, setDonation] = useState<DonationResult | null>(null);
  const [message, setMessage] = useState("Confirming the payment with the LIFELINE server…");

  useEffect(() => {
    const donationId = new URLSearchParams(window.location.search).get("donation_id");
    if (!donationId) { setState("failed"); setMessage("The return link is missing its donation reference. No success was recorded."); return; }
    api.captureDonation(donationId).then((result) => {
      if (result.status !== "captured") throw new Error("The server did not confirm a completed capture");
      setDonation(result); setState("captured"); setMessage("Your donation was captured successfully.");
    }).catch((error: unknown) => {
      setState("failed"); setMessage(error instanceof Error ? error.message : "Capture failed. Please contact support before retrying.");
    });
  }, []);

  const tone = { capturing: "border-slate-200 bg-white", captured: "border-emerald-200 bg-emerald-50", failed: "border-amber-200 bg-amber-50" }[state];

  return (
    <section className={`mx-auto max-w-xl space-y-4 rounded-3xl border p-8 text-center shadow-sm ${tone}`}>
      {state === "capturing" && <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" aria-hidden="true" />}
      {state === "captured" && <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white" aria-hidden="true">✓</span>}
      {state === "failed" && <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-2xl font-bold text-white" aria-hidden="true">!</span>}
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{state === "capturing" ? "Confirming donation" : state === "captured" ? "Donation complete" : "Donation not confirmed"}</h1>
      <p role="status" className="text-slate-700">{message}</p>
      {donation && <p className="tabular text-3xl font-bold text-emerald-800">{new Intl.NumberFormat(undefined, { style: "currency", currency: donation.currency }).format(donation.amount)}</p>}
      {state === "captured" && <p className="text-sm text-slate-600">Thank you. Paying the supplier and delivering the goods are separate steps that the NGO records.</p>}
      {state === "failed" && <p className="text-sm text-slate-600">This page only reports success after the backend confirms PayPal capture.</p>}
      {state !== "capturing" && <Link href="/" className="inline-flex text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline">Back to LIFELINE</Link>}
    </section>
  );
}
