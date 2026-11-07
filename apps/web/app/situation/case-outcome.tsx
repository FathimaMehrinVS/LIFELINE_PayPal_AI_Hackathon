"use client";

import type { CaseResult } from "@lifeline/contracts";
import Link from "next/link";
import { useState } from "react";
import { formatMoney, recommendedRoute, routeName } from "../dashboard/case-row";
import { MISSING_QUESTIONS, SituationResultView } from "./situation-result";

// Owner: Member 1. The answer to "can we help, and how?" for one case, in plain words.

const NEED_LABELS: Record<string, string> = { baby_supplies: "baby supplies" };

interface CaseOutcomeProps {
  result: CaseResult;
  /** Re-runs the case with the person's answers added to the message. */
  onAnswer: (answers: string) => void;
  busy: boolean;
}

export function CaseOutcome({ result, onAnswer, busy }: CaseOutcomeProps) {
  const [showDetails, setShowDetails] = useState(result.status !== "complete");

  return (
    <div className="space-y-6">
      {result.status === "complete" && <Ready result={result} />}
      {result.status === "needs_information" && (
        <NeedsAnswers questions={result.missing_information} onAnswer={onAnswer} busy={busy} />
      )}
      {result.status === "no_usable_route" && <NoRoute result={result} />}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold text-slate-800"
        >
          What we understood from the message
          <span className="text-slate-500" aria-hidden="true">
            {showDetails ? "−" : "+"}
          </span>
        </button>
        {showDetails && (
          <div className="border-t border-slate-200 p-5">
            <SituationResultView result={result.situation} />
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Case reference <span className="font-mono">{result.case_id}</span>. Every case is listed on the{" "}
        <Link href="/dashboard" className="underline">
          NGO dashboard
        </Link>
        .
      </p>
    </div>
  );
}

function Ready({ result }: { result: CaseResult }) {
  const route = recommendedRoute(result);
  const { finance, commerce, situation } = result;
  if (!route || !finance) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2 className="text-lg font-semibold text-emerald-900">We found a way to help</h2>
          <p className="text-sm text-emerald-800">An NGO reviews it next. Nothing is paid until they approve.</p>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <Figure label="You send" value={formatMoney(situation.budget, situation.currency)} />
        <Figure label={`Fees (${route.fee_label})`} value={formatMoney(route.estimated_fee, finance.currency)} />
        <Figure label="Arrives for the family" value={formatMoney(route.usable_value, finance.currency)} highlight />
      </div>

      <div className="space-y-4 border-t border-slate-200 p-5">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Best route</h3>
          <p className="mt-1 font-medium text-slate-900">{routeName(route.route_id)}</p>
          <p className="mt-1 text-sm text-slate-600">{finance.explanation}</p>
        </div>

        {commerce && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Suggested essentials</h3>
            {commerce.items.length > 0 ? (
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {commerce.items.map((item) => (
                  <li key={item.product_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span>
                      <span className="font-medium">
                        {item.quantity} × {item.name}
                      </span>
                      <span className="text-slate-500"> · {item.merchant_name}</span>
                    </span>
                    <span className="tabular font-medium">{formatMoney(item.subtotal, commerce.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-600">No products were found for these needs in this currency yet.</p>
            )}
            <p className="mt-2 text-sm text-slate-600">
              Basket {formatMoney(commerce.total, commerce.currency)}, and{" "}
              <strong>{formatMoney(commerce.reserve, commerce.currency)} kept as an emergency reserve</strong> so the family
              stays flexible.
              {commerce.unmet_needs.length > 0 &&
                ` Not covered yet: ${commerce.unmet_needs.map((n) => NEED_LABELS[n] ?? n).join(", ")}.`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/dashboard" className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Open in NGO dashboard
          </Link>
          <Link href="/donate" className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Support with a donation
          </Link>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-indigo-50 ring-1 ring-indigo-100" : "bg-slate-50"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tabular mt-1 text-2xl font-bold ${highlight ? "text-indigo-700" : "text-slate-900"}`}>{value || "—"}</div>
    </div>
  );
}

function NeedsAnswers({ questions, onAnswer, busy }: { questions: string[]; onAnswer: (answers: string) => void; busy: boolean }) {
  const [answers, setAnswers] = useState("");
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-lg font-semibold text-amber-900">A few answers, and we can find a route</h2>
      <p className="mt-1 text-sm text-amber-800">
        LIFELINE never guesses these, because a wrong guess could send money where it can&apos;t be used.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-900">
        {questions.map((q) => (
          <li key={q}>{MISSING_QUESTIONS[q] ?? q}</li>
        ))}
      </ol>
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (answers.trim()) onAnswer(answers.trim());
        }}
      >
        <label htmlFor="answers" className="block text-sm font-medium text-amber-900">
          Your answers
        </label>
        <textarea
          id="answers"
          value={answers}
          onChange={(e) => setAnswers(e.target.value)}
          rows={3}
          placeholder="e.g. They can pay with a mobile wallet. The internet works in the evening."
          className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={busy || !answers.trim()}
          className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Checking again…" : "Add answers and check again"}
        </button>
      </form>
    </section>
  );
}

function NoRoute({ result }: { result: CaseResult }) {
  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">No safe route yet</h2>
      <p className="mt-1 text-sm text-slate-600">
        None of the payment routes would get the money to the family safely with what we know now. The case is saved, and an
        NGO worker can look at other options.
      </p>
      {result.finance && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{result.finance.explanation}</p>}
    </section>
  );
}
