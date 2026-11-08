"use client";

import { useState } from "react";
import type { FinanceResult } from "@lifeline/contracts";
import { ApiRequestError, api } from "@/services/api";
import { FinancePageHeader } from "./components/FinancePageHeader";
import { FinanceResults } from "./components/FinanceResults";
import { SAMPLE_REQUEST } from "./finance-sample";

export default function FinancePage() {
  const [result, setResult] = useState<FinanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function evaluateSample() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.evaluateFinance(SAMPLE_REQUEST));
    } catch (cause) {
      const message = cause instanceof ApiRequestError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "The financial assessment could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-8 pb-10">
      <FinancePageHeader loading={loading} hasResult={result !== null} onEvaluate={evaluateSample} />

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          <p className="font-bold">Couldn’t evaluate the routes</p>
          <p className="mt-1">{error}. Check that the API is running, then try again.</p>
        </div>
      )}

      {result ? (
        <FinanceResults result={result} />
      ) : (
        <section className="grid gap-4 rounded-3xl border border-dashed border-slate-300 bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8" aria-live="polite">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ready to compare</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">See what remains usable after fees.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              The assessment uses a fixed sample request. Every route is scored with deterministic rules before an explanation is generated.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">No route has been selected yet</span>
        </section>
      )}
    </section>
  );
}
