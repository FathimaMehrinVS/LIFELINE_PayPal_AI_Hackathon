"use client";

import type { CaseResult, SituationRequest, SituationResult } from "@lifeline/contracts";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { ApiRequestError, api } from "../../services/api";
import { CaseOutcome } from "./case-outcome";
import { SituationResultView } from "./situation-result";

// Owner: Member 1 (feature/situation-agent)
// For the person abroad sending money home, or the NGO worker writing the case down for them.

const MAX_LENGTH = 4000;

const EXAMPLES = [
  {
    label: "Parents in a conflict area · €300",
    message:
      "My parents are in a conflict-affected area. Their bank is inaccessible and internet is intermittent. I have €300 to send. They need food and medicine.",
    currency: "EUR",
  },
  {
    label: "Family in Kerala · ₹5000",
    message: "My family in Kerala needs food and medicine, budget 5000 INR. Shops near them take UPI but the ATM is broken.",
    currency: "INR",
  },
  { label: "A very short message", message: "please help us", currency: "" },
];

const CURRENCIES = [
  { code: "EUR", label: "EUR · Euro" },
  { code: "USD", label: "USD · US dollar" },
  { code: "GBP", label: "GBP · British pound" },
  { code: "INR", label: "INR · Indian rupee" },
  { code: "AED", label: "AED · UAE dirham" },
  { code: "CAD", label: "CAD · Canadian dollar" },
  { code: "AUD", label: "AUD · Australian dollar" },
];

const TIPS = [
  { title: "Who and where", text: "e.g. my parents, in a town or district" },
  { title: "What they need", text: "food, water, medicine, shelter…" },
  { title: "How much you can send", text: "the amount and currency" },
  { title: "How they can get money", text: "bank, ATM, mobile wallet, cash, shops" },
  { title: "Internet or phone", text: "working, patchy or down" },
];

const STEPS = ["Describe", "Find a route", "Essentials", "NGO approval"];

type Outcome = { kind: "case"; result: CaseResult } | { kind: "analysis"; result: SituationResult };

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) {
    if (err.status === 400) return "Please describe the situation in a few words.";
    if (err.status === 502) return "The AI service is busy right now. Please try again in a minute.";
    return err.message;
  }
  return "We can't reach LIFELINE right now. Check your connection, or that the API is running (npm run dev:api).";
}

export default function SituationPage() {
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"case" | "analysis" | null>(null);

  function buildRequest(text: string): SituationRequest {
    const body: SituationRequest = { message: text.trim().slice(0, MAX_LENGTH) };
    if (location.trim()) body.location = location.trim();
    if (currency) body.currency = currency;
    return body;
  }

  async function run(kind: "case" | "analysis", text = message) {
    if (!text.trim()) return;
    setLoading(kind);
    setError(null);
    try {
      const body = buildRequest(text);
      setOutcome(
        kind === "case"
          ? { kind, result: await api.createCase(body) }
          : { kind, result: await api.analyzeSituation(body) },
      );
    } catch (err) {
      setOutcome(null);
      setError(errorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run("case");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void run("case");
    }
  }

  /** Adds the person's answers to the message, so the case is checked again with everything they said. */
  function onAnswer(answers: string) {
    const updated = `${message.trim()}\n\nMore details: ${answers}`;
    setMessage(updated);
    void run("case", updated);
  }

  const busy = loading !== null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500" aria-label="How LIFELINE works">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${i === 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "text-slate-900" : undefined}>{step}</span>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-slate-300" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Get help to your family</h1>
        <p className="max-w-3xl text-slate-600">
          Tell us what is happening, in your own words and any language. LIFELINE finds a way for the money to actually reach
          them, suggests essentials it can buy, and is honest about what it doesn&apos;t know.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label htmlFor="message" className="mb-1 block font-semibold text-slate-900">
              What is happening?
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_LENGTH}
              rows={6}
              required
              placeholder="e.g. My parents' bank is closed and the internet keeps cutting out. I can send €300. They need food and medicine. Shops nearby take mobile payments."
              className="w-full rounded-xl border border-slate-300 p-3 leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-2">
                <span>Try an example:</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => {
                      setMessage(example.message);
                      setCurrency(example.currency);
                    }}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              <span className="tabular">
                {message.length}/{MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="location" className="mb-1 block text-sm font-medium">
                Where is the family? <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Town or district"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label htmlFor="currency" className="mb-1 block text-sm font-medium">
                Currency you&apos;re sending in <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Not sure / as in the message</option>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="submit"
              disabled={busy || message.trim() === ""}
              className="rounded-full bg-indigo-600 px-7 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading === "case" ? "Finding a way…" : "Find a way to help"}
            </button>
            <button
              type="button"
              disabled={busy || message.trim() === ""}
              onClick={() => void run("analysis")}
              className="text-sm font-medium text-indigo-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {loading === "analysis" ? "Reading…" : "Only read the message"}
            </button>
            <span className="hidden text-xs text-slate-400 sm:inline">Ctrl + Enter to send</span>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">What helps us</h2>
            <p className="mt-1 text-xs text-slate-500">Anything you leave out, we ask about instead of guessing.</p>
            <ul className="mt-3 space-y-3">
              {TIPS.map((tip) => (
                <li key={tip.title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    <span className="font-medium text-slate-800">{tip.title}</span>
                    <span className="block text-xs text-slate-500">{tip.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <h2 className="font-semibold">Keep them safe</h2>
            <p className="mt-1 text-xs leading-relaxed">
              No full names, phone numbers or account numbers are needed. A first name or &quot;my parents&quot; is enough.
            </p>
          </section>
        </aside>
      </div>

      <div aria-live="polite" className="space-y-4">
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {loading === "case" && (
          <LoadingCard text="Reading the message, comparing payment routes and building a basket. This takes a few seconds." />
        )}
        {loading === "analysis" && <LoadingCard text="Reading the message…" />}
        {!busy && outcome?.kind === "case" && <CaseOutcome key={outcome.result.case_id} result={outcome.result} onAnswer={onAnswer} busy={busy} />}
        {!busy && outcome?.kind === "analysis" && <SituationResultView result={outcome.result} />}
      </div>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden="true" />
      {text}
    </div>
  );
}
