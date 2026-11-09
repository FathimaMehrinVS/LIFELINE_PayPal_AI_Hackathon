"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Badge, Card, button } from "@/components/ui";
import type { DonationResult } from "@lifeline/contracts";
import { api } from "@/services/api";

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

  if (state !== "captured" || !donation) {
    return (
      <section className={`mx-auto max-w-xl rounded-2xl border p-8 text-center ${state === "failed" ? "border-accent/50 bg-warning-tint" : "border-slate-200 bg-white"}`}>
        {state === "capturing" ? <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal" aria-hidden="true" /> : <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white" aria-hidden="true">!</span>}
        <h1 className="mt-4 text-2xl font-bold text-navy">{state === "capturing" ? "Confirming donation" : "Donation not confirmed"}</h1>
        <p role="status" className="mt-1 text-slate-700">{message}</p>
        {state === "failed" && <p className="mt-2 text-sm text-slate-600">This page only reports success after the backend confirms PayPal capture.</p>}
        {state === "failed" && <Link href="/workspace" className={`${button.secondary} mt-4`}>Back to your workspace</Link>}
      </section>
    );
  }

  const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: donation.currency }).format(donation.amount);
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="text-center">
        <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-tint text-success"><CheckIcon className="h-9 w-9" /></span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Your contribution has been received.</h1>
        <p role="status" className="mt-2 text-slate-600">Thank you. Your {amount} is now part of the funding for this plan.</p>
      </div>

      <Card className="mt-7 p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
          <div><p className="text-sm text-slate-600">Amount</p><p className="tabular text-3xl font-extrabold text-navy">{amount} <span className="text-lg font-semibold text-slate-600">{donation.currency}</span></p></div>
          <Badge tone="success" className="px-3 py-1 text-sm">✓ Payment status: Captured</Badge>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-slate-600">Donation reference</dt><dd className="break-all font-mono text-sm font-bold text-navy">{donation.donation_id}</dd></div>
          <div><dt className="text-sm text-slate-600">PayPal transaction reference</dt><dd className="break-all font-mono text-sm font-bold text-navy">{donation.paypal_capture_id ?? donation.paypal_order_id}</dd></div>
          <div><dt className="text-sm text-slate-600">Date and time</dt><dd className="font-bold text-navy">{new Date().toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div>
        </dl>
      </Card>

      <p className="mt-5 rounded-xl border border-accent/50 bg-warning-tint p-4 text-warning"><strong>Your donation is captured. The supplier has not been paid yet, and the aid has not been delivered yet.</strong> Each of those is recorded separately.</p>

      <Card className="mt-5 p-6">
        <h2 className="text-lg font-bold text-navy">What happens next</h2>
        <ol className="mt-3 grid gap-4 sm:grid-cols-4">
          {["NGO procurement", "Supplier payment", "Goods preparation", "Delivery confirmation"].map((step, index) => (
            <li key={step}><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-sm font-bold text-slate-600">{index + 1}</span><p className="mt-2 text-sm font-bold text-navy">{step}</p><p className="text-xs text-slate-500">Pending</p></li>
          ))}
        </ol>
      </Card>

      <div className="mt-6 text-center"><Link href="/workspace" className={button.primary}>Back to your workspace</Link></div>
    </div>
  );
}
