"use client";

import { useEffect, useState } from "react";
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

  return <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-white p-6">
    <h1 className="text-2xl font-bold">{state === "capturing" ? "Confirming donation" : state === "captured" ? "Donation complete" : "Donation not confirmed"}</h1>
    <p role="status" className="text-slate-700">{message}</p>
    {donation && <p className="font-medium">€{donation.amount.toFixed(2)} {donation.currency} · {donation.status}</p>}
    {state === "failed" && <p className="text-sm text-slate-500">This page only reports success after the backend confirms PayPal capture.</p>}
  </section>;
}
