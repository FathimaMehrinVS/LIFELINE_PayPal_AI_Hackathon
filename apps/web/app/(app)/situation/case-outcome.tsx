"use client";

import { type CaseResult, PLANNING_DAYS_OF_COVER, PLANNING_HOUSEHOLD_SIZE } from "@lifeline/contracts";
import Link from "next/link";
import { useState } from "react";
import { formatMoney, recommendedRoute, routeName, sourceLabel } from "../dashboard/case-row";
import { ACCESS_ANSWERS, type Choice, NEED_LABELS, NEED_OPTIONS, type ReporterRole, accessSentence } from "./answers";
import { MISSING_QUESTIONS, SituationResultView } from "./situation-result";
import { ListenButton } from "./voice";

// Owner: Member 1. The answer to "can we help, and how?" for one case, in plain words.


interface CaseOutcomeProps {
  role: ReporterRole;
  result: CaseResult;
  /** The full analysis is hidden when the page has already shown it. */
  showDetails?: boolean;
  /** Re-runs the case with the person's answers added to the message. */
  onAnswer: (answers: CaseAnswers) => void;
  busy: boolean;
}

export function CaseOutcome({ role, result, onAnswer, busy, showDetails: detailsAllowed = true }: CaseOutcomeProps) {
  const [showDetails, setShowDetails] = useState(result.status !== "complete");

  // Costs are the NGO's job: a family is never asked how much money there is.
  const familyQuestions = role === "ngo" ? result.missing_information : result.missing_information.filter((q) => q !== "budget" && q !== "currency");

  return (
    <div className="space-y-6">
      {result.status === "complete" && <Ready role={role} result={result} />}
      {result.status === "needs_information" && familyQuestions.length > 0 && (
        <NeedsAnswers questions={familyQuestions} onAnswer={onAnswer} busy={busy} />
      )}
      {result.status === "no_usable_route" && <NoRoute role={role} result={result} onAnswer={onAnswer} busy={busy} />}

      {detailsAllowed && <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
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
            <SituationResultView result={result.situation} showMissing={false} />
          </div>
        )}
      </section>}

      {detailsAllowed && <p className="text-xs text-slate-500">
        Case reference <span className="font-mono">{result.case_id}</span>. Every case is listed on the{" "}
        <Link href="/dashboard" className="underline">
          NGO dashboard
        </Link>
        .
      </p>}
    </div>
  );
}

function Ready({ role, result }: { role: ReporterRole; result: CaseResult }) {
  const route = recommendedRoute(result);
  const { finance, commerce, situation } = result;
  if (!route || !finance) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white" aria-hidden="true">
          ✓
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-emerald-900">{role === "ngo" ? "A plan is ready for your review" : "We found a way to help"}</h2>
          <p className="text-sm text-emerald-800">
            {role === "ngo" ? "Check it and approve it on the NGO dashboard. Nothing is paid until you do." : "An NGO reviews it next. Nothing is paid until they approve."}
          </p>
        </div>
        <ListenButton
          text={`We found a way to help. ${formatMoney(route.usable_value, finance.currency)} can reach the family through ${routeName(route.route_id)}, after ${formatMoney(route.estimated_fee, finance.currency)} in fees.${commerce && commerce.items.length > 0 ? ` Suggested essentials: ${commerce.items.map((i) => i.name).join(", ")}.` : ""} An NGO reviews it next. Nothing is paid until they approve.`}
        />
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <Figure label={fundingLabel(result.budget_source ?? "stated", role)} value={formatMoney(situation.budget, situation.currency)} />
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
                      <span className="block text-xs text-slate-500">{sourceLabel(item.source)}</span>
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
            <p className="mt-1 text-xs text-slate-500">
              {situation.household_size
                ? `Planned for ${situation.household_size} ${situation.household_size === 1 ? "person" : "people"} for ${PLANNING_DAYS_OF_COVER} days.`
                : `The report didn't say how many people, so this is planned for ${PLANNING_HOUSEHOLD_SIZE} people for ${PLANNING_DAYS_OF_COVER} days. The NGO should check this before approving.`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/dashboard" className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            {role === "ngo" ? "Review and approve" : "Open in NGO dashboard"}
          </Link>
          <Link href="/dashboard" className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            NGO approval is required before donation
          </Link>
        </div>
      </div>
    </section>
  );
}

function fundingLabel(source: NonNullable<CaseResult["budget_source"]>, role: ReporterRole) {
  if (source === "ngo") return "NGO assistance amount";
  if (source === "emergency_package") return "Standard emergency package";
  return role === "ngo" ? "Amount in the report" : "Amount you stated";
}

function Figure({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-indigo-50 ring-1 ring-indigo-100" : "bg-slate-50"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tabular mt-1 text-2xl font-bold ${highlight ? "text-indigo-700" : "text-slate-900"}`}>{value || "—"}</div>
    </div>
  );
}

export interface CaseAnswers {
  /** Plain sentences added to the message, e.g. "They cannot use a mobile wallet." */
  sentences: string[];
  location?: string;
  currency?: string;
}

interface NeedsAnswersProps {
  questions: string[];
  onAnswer: (answers: CaseAnswers) => void;
  busy: boolean;
  title?: string;
  intro?: string;
}

function NeedsAnswers({ questions, onAnswer, busy, title, intro }: NeedsAnswersProps) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [needs, setNeeds] = useState<string[]>([]);
  const [extra, setExtra] = useState("");

  const setText = (key: string, value: string) => setTexts((t) => ({ ...t, [key]: value }));

  function collect(): CaseAnswers {
    const answers: CaseAnswers = { sentences: [] };
    for (const q of questions) {
      const text = texts[q]?.trim();
      if (ACCESS_ANSWERS[q]) {
        const sentence = accessSentence(q, choices[q]);
        if (sentence) answers.sentences.push(sentence);
      } else if (q === "budget" && text) {
        answers.sentences.push(`I can send ${text}${texts.currency ? ` ${texts.currency}` : ""}.`);
      } else if (q === "currency" && text) {
        answers.currency = text;
        answers.sentences.push(`The money is in ${text}.`);
      } else if (q === "location" && text) {
        answers.location = text;
        answers.sentences.push(`They are in ${text}.`);
      } else if (q === "needs" && needs.length > 0) {
        answers.sentences.push(`They need ${needs.map((n) => NEED_LABELS[n] ?? n).join(", ")}.`);
      } else if (text) {
        answers.sentences.push(`${MISSING_QUESTIONS[q] ?? q} ${text}`);
      }
    }
    if (extra.trim()) answers.sentences.push(extra.trim());
    return answers;
  }

  const answered = collect().sentences.length > 0;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-900">
          {title ?? (questions.length === 1 ? "One answer, and we can look again" : "A few answers, and we can look again")}
        </h2>
        <ListenButton label="Listen to the questions" text={questions.map((q) => MISSING_QUESTIONS[q] ?? q).join(" ")} />
      </div>
      <p className="mt-1 text-sm text-amber-800">
        {intro ?? "LIFELINE never guesses these, because a wrong guess could send money where it can't be used."}
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (answered) onAnswer(collect());
        }}
      >
        {questions.map((q) => (
          <fieldset key={q} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
            <legend className="sr-only">{MISSING_QUESTIONS[q] ?? q}</legend>
            <p className="font-medium text-slate-900" aria-hidden="true">
              {MISSING_QUESTIONS[q] ?? q}
            </p>
            <div className="mt-3">
              {ACCESS_ANSWERS[q] ? (
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {(
                    [
                      ["yes", "Yes"],
                      ["no", "No"],
                      ["unsure", "Not sure"],
                    ] as const
                  ).map(([value, label]) => {
                    const on = choices[q] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setChoices((c) => ({ ...c, [q]: value }))}
                        className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                          on
                            ? value === "yes"
                              ? "bg-emerald-500 text-white"
                              : value === "no"
                                ? "bg-slate-800 text-white"
                                : "bg-slate-300 text-slate-800"
                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {choices[q] === "unsure" && (
                    <span className="self-center text-xs text-slate-500">That&apos;s fine: we keep it as unknown.</span>
                  )}
                </div>
              ) : q === "needs" ? (
                <div className="flex flex-wrap gap-2">
                  {NEED_OPTIONS.map((n) => {
                    const on = needs.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setNeeds((list) => (on ? list.filter((x) => x !== n) : [...list, n]))}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                          on ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {NEED_LABELS[n] ?? n}
                      </button>
                    );
                  })}
                </div>
              ) : q === "budget" ? (
                <div className="flex max-w-sm gap-2">
                  <input
                    inputMode="decimal"
                    value={texts.budget ?? ""}
                    onChange={(e) => setText("budget", e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="Amount, e.g. 300"
                    aria-label="Amount"
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                  {!questions.includes("currency") && (
                    <input
                      value={texts.currency ?? ""}
                      onChange={(e) => setText("currency", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
                      placeholder="EUR"
                      aria-label="Currency"
                      className="w-24 rounded-xl border border-slate-300 p-2.5 uppercase focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                    />
                  )}
                </div>
              ) : (
                <input
                  value={texts[q] ?? ""}
                  onChange={(e) => setText(q, q === "currency" ? e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) : e.target.value)}
                  placeholder={q === "location" ? "Town or district" : q === "currency" ? "e.g. EUR" : "Your answer"}
                  aria-label={MISSING_QUESTIONS[q] ?? q}
                  className="w-full max-w-md rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
              )}
            </div>
          </fieldset>
        ))}

        <div>
          <label htmlFor="extra" className="text-sm font-medium text-amber-900">
            Anything else? <span className="font-normal text-amber-800">(optional)</span>
          </label>
          <input
            id="extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="e.g. A cash agent opens twice a week in the next village."
            className="mt-1 w-full rounded-xl border border-amber-200 bg-white p-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={busy || !answered}
            className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {busy ? "Checking again…" : "Check again with my answers"}
          </button>
          <span className="text-xs text-amber-800">
            {answered ? "Your answers are added to the message, and this case is updated." : "Answer at least one question."}
          </span>
        </div>
      </form>
    </section>
  );
}

const ACCESS_NAMES: Record<string, string> = {
  bank_availability: "a bank",
  atm_access: "an ATM",
  wallet_acceptance: "a mobile wallet",
  cash_availability: "local cash",
  merchant_acceptance: "open shops",
  connectivity: "internet or phone",
};

type RouteAssessmentItem = NonNullable<CaseResult["finance"]>["routes"][number];

/** Why a route can't be used, in words a family member understands (from Member 2's flags). */
export function plainReason(route: RouteAssessmentItem, currency: string): string {
  const unavailable = route.flags.find((f) => f.code === "REQUIRED_ACCESS_UNAVAILABLE");
  if (unavailable) {
    const factor = (unavailable.evidence as { factor?: string } | undefined)?.factor;
    return `needs ${factor ? (ACCESS_NAMES[factor] ?? factor) : "something"} they can't use`;
  }
  if (route.flags.some((f) => f.code === "ROUTE_UNSUPPORTED")) return "isn't available where they are";
  if (route.flags.some((f) => f.code === "FEE_ABOVE_REFERENCE")) {
    return `fees look too high (${formatMoney(route.estimated_fee, currency)}), so a person must check it first`;
  }
  return "isn't confirmed yet, so a person must check it first";
}

function NoRoute({ role, result, onAnswer, busy }: { role: ReporterRole; result: CaseResult; onAnswer: (answers: CaseAnswers) => void; busy: boolean }) {
  const { finance, situation } = result;
  const unknown = Object.entries(situation.access)
    .filter(([key, value]) => value === "unknown" && ACCESS_ANSWERS[key])
    .map(([key]) => key);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">No safe route yet</h2>
          {finance && (
            <ListenButton
              text={`No safe route yet. ${finance.routes.map((r) => `${routeName(r.route_id)} ${plainReason(r, finance.currency)}.`).join(" ")}`}
            />
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          With what we know now, none of the ways to send money would safely reach the family. The case is saved
          {role === "ngo" ? ", so the team can come back to it when a new option is available." : ", and an NGO worker will review it."}
        </p>
        {finance && finance.routes.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {finance.routes.map((route) => (
              <li key={route.route_id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    route.verdict === "block" ? "bg-red-500" : "bg-amber-400"
                  }`}
                  aria-hidden="true"
                >
                  {route.verdict === "block" ? "×" : "!"}
                </span>
                <span>
                  <span className="font-semibold text-slate-900">{routeName(route.route_id)}</span>{" "}
                  <span className="text-slate-600">{plainReason(route, finance.currency)}.</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unknown.length > 0 && (
        <NeedsAnswers
          questions={unknown}
          onAnswer={onAnswer}
          busy={busy}
          title="Do you know any of these? A new answer may open a route."
          intro="Answer what you know. Anything you skip stays unknown."
        />
      )}
    </div>
  );
}
