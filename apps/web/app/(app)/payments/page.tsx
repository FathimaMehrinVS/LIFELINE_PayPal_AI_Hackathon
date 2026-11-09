"use client";

import type { Ledger } from "@lifeline/contracts";
import { useEffect, useState } from "react";
import { Badge, type BadgeTone, Card } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { caseRef, formatMoney } from "../dashboard/case-row";
import { formatDateTime } from "../plans/plan-parts";

// Owner: Member 1. Styled from "LIFELINE Screen Designs" page 17. Reads the recorded donations and supplier payments.

const DONATION: Record<Ledger["donations"][number]["status"], { label: string; tone: BadgeTone }> = {
  created: { label: "Created", tone: "neutral" },
  approved: { label: "Approved", tone: "info" },
  captured: { label: "Captured", tone: "success" },
  failed: { label: "Failed", tone: "critical" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  refunded: { label: "Refunded", tone: "warning" },
};
const PAYOUT: Record<Ledger["payouts"][number]["status"], { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "warning" },
  processing: { label: "Processing", tone: "info" },
  completed: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "critical" },
  returned: { label: "Returned", tone: "warning" },
};
const CONFIRMATION: Record<Ledger["donations"][number]["status"], string> = {
  created: "Awaiting donor approval",
  approved: "Donor approved, not captured",
  captured: "Confirmed with PayPal Sandbox",
  failed: "Capture failed",
  cancelled: "Checkout cancelled",
  refunded: "Refunded",
};

const TH = "whitespace-nowrap px-4 py-2 font-semibold";
const TD = "whitespace-nowrap px-4 py-3";

export default function PaymentsPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLedger().then(setLedger).catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load payments."));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold text-navy">Payment management</h1>
        <p className="mt-1 text-slate-600">Donations in and supplier payments out are recorded separately.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {!ledger && !error && <p className="text-slate-600">Loading payments…</p>}
      {ledger && (
        <>
          {ledger.totals.length === 0 && <Card className="p-6 text-center text-sm text-slate-600">No money has been recorded yet.</Card>}
          {ledger.totals.map((total) => (
            <section key={total.currency} className="grid gap-5 rounded-2xl bg-navy p-6 text-white sm:grid-cols-2 lg:grid-cols-4" aria-label={`Totals in ${total.currency}`}>
              <div><p className="text-sm text-slate-300">Total donated (captured)</p><p className="tabular text-[28px] font-extrabold">{formatMoney(total.captured, total.currency)}</p></div>
              <div><p className="text-sm text-slate-300">Total allocated to plans</p><p className="tabular text-[28px] font-extrabold">{formatMoney(total.allocated, total.currency)}</p></div>
              <div><p className="text-sm text-slate-300">Supplier payments recorded</p><p className="tabular text-[28px] font-extrabold">{formatMoney(total.paid, total.currency)}</p>{total.simulated > 0 && <p className="tabular text-xs text-slate-300">Plus {formatMoney(total.simulated, total.currency)} simulated</p>}</div>
              <div><p className="text-sm text-slate-300">Remaining balance</p><p className="tabular text-[28px] font-extrabold text-accent">{formatMoney(total.balance, total.currency)}</p><p className="text-xs text-slate-300">Captured minus supplier payments</p></div>
            </section>
          ))}
          <p className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-navy">A captured donation <strong>never</strong> marks a supplier as paid. A supplier payment is its own record.</p>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5"><h2 className="font-bold text-navy">1 · Donor donations <span className="font-normal text-slate-600">· money in</span></h2><span className="text-[13px] text-slate-600">Via PayPal Sandbox</span></div>
            {ledger.donations.length === 0 ? <p className="border-t border-slate-200 p-6 text-center text-sm text-slate-600">No donations recorded yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-[13px] text-slate-600"><th className={TH}>Donation</th><th className={TH}>Donor ref.</th><th className={TH}>Plan / case</th><th className={`${TH} text-right`}>Amount</th><th className={TH}>PayPal capture</th><th className={TH}>Status</th><th className={TH}>Confirmation</th></tr></thead>
                  <tbody>
                    {ledger.donations.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className={`${TD} font-bold text-navy`}>{row.reference}</td><td className={`${TD} text-slate-600`}>{row.donor}</td>
                        <td className={`${TD} font-mono text-[13px] text-slate-600`}>{row.plan_reference ?? "—"}{row.case_id ? ` · ${caseRef(row.case_id)}` : ""}</td>
                        <td className={`${TD} tabular text-right font-bold text-navy`}>{formatMoney(row.amount, row.currency)}</td>
                        <td className={`${TD} font-mono text-[13px] text-slate-600`}>{row.paypal_capture_id ?? "—"}</td>
                        <td className={TD}><Badge tone={DONATION[row.status].tone}>{DONATION[row.status].label}</Badge></td>
                        <td className={`${TD} text-slate-600`}>{CONFIRMATION[row.status]} · {formatDateTime(row.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <h2 className="p-5 font-bold text-navy">2 · Supplier payments <span className="font-normal text-slate-600">· money out</span></h2>
            {ledger.payouts.length === 0 ? <p className="border-t border-slate-200 p-6 text-center text-sm text-slate-600">No supplier payments recorded yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-[13px] text-slate-600"><th className={TH}>Payment</th><th className={TH}>Plan</th><th className={TH}>Supplier</th><th className={`${TH} text-right`}>Amount</th><th className={TH}>Reference</th><th className={TH}>Status</th></tr></thead>
                  <tbody>
                    {ledger.payouts.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className={`${TD} font-bold text-navy`}>{row.reference}</td><td className={`${TD} font-mono text-[13px] text-slate-600`}>{row.plan_reference}</td>
                        <td className={`${TD} text-slate-600`}>{row.supplier ?? "—"}</td>
                        <td className={`${TD} tabular text-right font-bold text-navy`}>{formatMoney(row.amount, row.currency)}</td>
                        <td className={`${TD} font-mono text-[13px] text-slate-600`}>{row.payment_reference ?? "—"}</td>
                        <td className={TD}>{row.mode === "simulated" ? <Badge tone="simulated">Simulated</Badge> : <Badge tone={PAYOUT[row.status].tone}>{PAYOUT[row.status].label}</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
