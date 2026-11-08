"use client";

import type { CaseResult, SituationRequest, SituationResult } from "@lifeline/contracts";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { BasketIcon, BrainIcon, CheckIcon, HeartHandIcon, RouteIcon, ShieldCheckIcon, SparkleIcon, UsersIcon } from "../../components/icons";
import { ApiRequestError, api } from "../../services/api";
import type { ReporterRole } from "./answers";
import { type CaseAnswers, CaseOutcome } from "./case-outcome";
import { QuickAnswers, type QuickRequest } from "./quick-answers";
import { VoiceInput } from "./voice";
import { SituationResultView } from "./situation-result";

// Owner: Member 1 (feature/situation-agent)
// For the NGO worker writing a case down, or a relative reporting a family in need.

const MAX_LENGTH = 4000;

const ROLES: Record<ReporterRole, { label: string; heading: string; intro: string; question: string; placeholder: string }> = {
  ngo: {
    label: "I'm an NGO worker",
    heading: "Log a request for help",
    intro: "Write down what the family or caller told you, in any language. LIFELINE structures it, checks how aid can reach them, and prepares a plan for you to approve.",
    question: "What did the family tell you?",
    placeholder:
      "e.g. Family of 4 arrived at the shelter. Two children, one diabetic adult. Bank branch closed, phone signal on and off. They need food and medicine.",
  },
  family: {
    label: "I'm helping my family",
    heading: "Report a family in need",
    intro: "Tell us what is happening, in your own words and any language. Your report goes to the NGO, which checks how aid can reach them.",
    question: "What is happening to your family?",
    placeholder:
      "e.g. My parents' bank is closed and the internet keeps cutting out. They need food and medicine. Shops nearby take mobile payments.",
  },
};

type Example = { title: string; detail: string; message: string; currency: string; amount?: string; Icon: (p: { className?: string }) => React.ReactNode };

const EXAMPLES: Record<ReporterRole, Example[]> = {
  ngo: [
    {
      title: "Displaced family at a shelter",
      detail: "No money · 2 children · diabetic mother",
      message:
        "Family arrived at Demo Shelter in Demo Town (synthetic) after leaving a conflict area. Two children and their diabetic mother, no money. No functioning bank access, but they can use a mobile wallet and have phone signal. They need food and medicine.",
      currency: "",
      Icon: UsersIcon,
    },
    {
      title: "Family of 5 after a flood",
      detail: "NGO sets €150 · bank closed",
      message:
        "Family of 5 in Demo Town (synthetic) after a flood needs drinking water and hygiene items. Bank is closed. They can use a mobile wallet and the internet works.",
      currency: "EUR",
      amount: "150",
      Icon: ShieldCheckIcon,
    },
    {
      title: "A very short message",
      detail: "See how LIFELINE asks instead of guessing",
      message: "please help us",
      currency: "",
      Icon: SparkleIcon,
    },
  ],
  family: [
  {
    title: "Parents in a conflict area",
    detail: "€300 · bank closed · patchy internet",
    message:
      "My parents are in a conflict-affected area. Their bank is inaccessible and internet is intermittent. I have €300 to send. They need food and medicine.",
    currency: "EUR",
    Icon: ShieldCheckIcon,
  },
  {
    title: "Family in Kerala",
    detail: "₹5000 · UPI shops · broken ATM",
    message: "My family in Kerala needs food and medicine, budget 5000 INR. Shops near them take UPI but the ATM is broken.",
    currency: "INR",
    Icon: BasketIcon,
  },
  {
    title: "A very short message",
    detail: "See how LIFELINE asks instead of guessing",
    message: "please help us",
    currency: "",
    Icon: SparkleIcon,
  },
  ],
};

const CURRENCIES = [
  { code: "EUR", label: "EUR · Euro" },
  { code: "USD", label: "USD · US dollar" },
  { code: "GBP", label: "GBP · British pound" },
  { code: "INR", label: "INR · Indian rupee" },
  { code: "AED", label: "AED · UAE dirham" },
  { code: "CAD", label: "CAD · Canadian dollar" },
  { code: "AUD", label: "AUD · Australian dollar" },
];

/**
 * Hints for the checklist only: they tick when the text seems to cover a topic. The AI does the real reading,
 * and anything it can't find is asked for, never guessed.
 */
const TIPS: { key: string; title: string; text: string; test: (msg: string, location: string) => boolean }[] = [
  {
    key: "who",
    title: "Who and where",
    text: "e.g. my parents, in a town or district",
    test: (m, loc) => loc.trim() !== "" || /\b(in|near|at|from)\s+[A-Z][a-z]/.test(m),
  },
  {
    key: "needs",
    title: "What they need",
    text: "food, water, medicine, shelter…",
    test: (m) => /\b(food|water|medicine|medical|shelter|baby|diaper|formula|hygiene|cloth|blanket|rice|insulin)/i.test(m),
  },
  {
    key: "amount",
    title: "How much you can send",
    text: "the amount and currency",
    test: (m) => /([€$£₹]\s?\d)|(\d[\d,.]*\s?(eur|euro|usd|dollar|gbp|pound|inr|rupee|aed|cad|aud))/i.test(m),
  },
  {
    key: "access",
    title: "How they can get money",
    text: "bank, ATM, mobile wallet, cash, shops",
    test: (m) => /\b(bank|atm|wallet|upi|m-?pesa|paypal|cash|agent|shop|store|market|merchant)/i.test(m),
  },
  {
    key: "connectivity",
    title: "Internet or phone",
    text: "working, patchy or down",
    test: (m) => /\b(internet|phone|signal|network|offline|online|connect|wifi|mobile data)/i.test(m),
  },
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

type RunOverrides = { location?: string; currency?: string; assistance_amount?: number };

/** A positive amount with at most two decimals, or undefined if the box is empty or invalid. */
function validAmount(text: string): number | undefined {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
}

export default function SituationPage() {
  const [role, setRole] = useState<ReporterRole>("ngo");
  const [mode, setMode] = useState<"write" | "tap">("write");
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState("");
  const [assistanceAmount, setAssistanceAmount] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"case" | "analysis" | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const copy = ROLES[role];

  // Bring the answer (or the loading card) into view, so it isn't missed below the form.
  useEffect(() => {
    if (loading || outcome || error) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, outcome, error]);
  const covered = useMemo(
    () => new Set(TIPS.filter((t) => t.test(message, location) || (t.key === "amount" && role === "ngo" && validAmount(assistanceAmount) !== undefined)).map((t) => t.key)),
    [message, location, role, assistanceAmount],
  );
  const empty = message.trim() === "";
  const busy = loading !== null;

  function buildRequest(text: string, overrides: RunOverrides = {}): SituationRequest {
    const body: SituationRequest = { message: text.trim().slice(0, MAX_LENGTH) };
    const loc = overrides.location ?? location.trim();
    const cur = overrides.currency ?? currency;
    if (loc) body.location = loc;
    if (/^[A-Z]{3}$/.test(cur)) body.currency = cur;
    // Only the NGO sets an amount; a relative's report never does.
    const amount = role === "ngo" ? (overrides.assistance_amount ?? validAmount(assistanceAmount)) : undefined;
    if (amount !== undefined) body.assistance_amount = amount;
    return body;
  }

  /** `replaces` updates a case that needed information instead of creating a second one. */
  async function run(
    kind: "case" | "analysis",
    text = message,
    options: RunOverrides & { replaces?: string } = {},
  ) {
    if (!text.trim()) return;
    setLoading(kind);
    setError(null);
    try {
      const body = buildRequest(text, options);
      setOutcome(
        kind === "case"
          ? { kind, result: await api.createCase(body, options.replaces) }
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

  /** "Tap to answer" builds the message from the taps; it also fills the written form, so nothing is hidden. */
  function onQuickSubmit(request: QuickRequest) {
    setMessage(request.message);
    if (request.location) setLocation(request.location);
    if (request.currency) setCurrency(request.currency);
    setAssistanceAmount(request.assistance_amount !== undefined ? String(request.assistance_amount) : "");
    void run("case", request.message, { location: request.location, currency: request.currency, assistance_amount: request.assistance_amount });
  }

  /**
   * Adds the answers to the message as plain sentences ("They cannot use a mobile wallet."), so the AI reads them
   * the way they were meant, and re-runs the same case.
   */
  function onAnswer(answers: CaseAnswers) {
    const updated = `${message.trim()}\n${answers.sentences.join(" ")}`;
    setMessage(updated);
    if (answers.location) setLocation(answers.location);
    if (answers.currency && CURRENCIES.some((c) => c.code === answers.currency)) setCurrency(answers.currency);
    const replaces = outcome?.kind === "case" ? outcome.result.case_id : undefined;
    void run("case", updated, { replaces, location: answers.location, currency: answers.currency });
  }

  // Which step the progress bar shows as current.
  const stepIndex = outcome?.kind === "case" ? (outcome.result.status === "complete" ? 3 : outcome.result.finance ? 1 : 0) : 0;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-800 to-indigo-600 p-7 text-white shadow-lg sm:p-9">
        <HeartHandIcon className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-white/10" />
        <ol className="relative flex flex-wrap items-center gap-2 text-xs font-medium" aria-label="How LIFELINE works">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  i < stepIndex ? "bg-emerald-400 text-white" : i === stepIndex ? "bg-white text-indigo-700" : "bg-white/15 text-indigo-100"
                }`}
              >
                {i < stepIndex ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={i === stepIndex ? "text-white" : "text-indigo-200"}>{step}</span>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-white/30" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <h1 className="relative mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.heading}</h1>
        <p className="relative mt-2 max-w-2xl text-indigo-100">{copy.intro}</p>

        <div className="relative mt-5 inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/20" role="radiogroup" aria-label="Who is writing">
          {(Object.keys(ROLES) as ReporterRole[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                role === r ? "bg-white text-indigo-700 shadow" : "text-white hover:bg-white/10"
              }`}
            >
              {r === "family" ? <HeartHandIcon className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
              {ROLES[r].label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="How to describe the situation">
          {(
            [
              ["write", "Write or speak", "In your own words, any language"],
              ["tap", "Tap to answer", "Quick questions, no typing"],
            ] as const
          ).map(([value, label, sub]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-xl px-4 py-2.5 text-left transition ${mode === value ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
            >
              <span className={`block text-sm font-semibold ${mode === value ? "text-indigo-700" : "text-slate-700"}`}>{label}</span>
              <span className="block text-xs text-slate-500">{sub}</span>
            </button>
          ))}
        </div>

        {mode === "tap" ? (
          <QuickAnswers role={role} busy={busy} onSubmit={onQuickSubmit} />
        ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Start from an example, or write your own below</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {EXAMPLES[role].map(({ title, detail, message: text, currency: cur, amount, Icon }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => {
                    setMessage(text);
                    setCurrency(cur);
                    setAssistanceAmount(amount ?? "");
                  }}
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{title}</span>
                    <span className="block text-xs text-slate-500">{detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="message" className="mb-2 block text-lg font-bold text-slate-900">
              {copy.question}
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_LENGTH}
              rows={6}
              required
              placeholder={copy.placeholder}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 p-4 text-base leading-relaxed transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <CoverageBar count={covered.size} total={TIPS.length} />
              <span className="tabular shrink-0">
                {message.length}/{MAX_LENGTH}
              </span>
            </div>
            <div className="mt-3">
              <VoiceInput onText={(t) => setMessage((m) => (m.trim() ? `${m.trim()} ${t}` : t).slice(0, MAX_LENGTH))} />
            </div>
          </div>

          <div className={`grid gap-4 ${role === "ngo" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div>
              <label htmlFor="location" className="mb-1 block text-sm font-semibold text-slate-800">
                Where is the family? <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Town or district"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 p-3 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor="currency" className="mb-1 block text-sm font-semibold text-slate-800">
                {role === "ngo" ? "Currency" : "Currency, if you know it"} <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">Not sure / as in the message</option>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {role === "ngo" && (
              <div>
                <label htmlFor="assistance-amount" className="mb-1 block text-sm font-semibold text-slate-800">
                  Amount the NGO will spend <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="assistance-amount"
                  inputMode="decimal"
                  value={assistanceAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, "");
                    setAssistanceAmount(value);
                    if (value && !currency) setCurrency("EUR");
                  }}
                  placeholder="e.g. 150"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 p-3 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs text-slate-500">If left blank, urgent cases use a standard emergency package.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={busy || empty}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {loading === "case" ? (
                <>
                  <Spinner /> Finding a way…
                </>
              ) : (
                <>
                  <RouteIcon className="h-5 w-5" /> Find a way to help
                </>
              )}
            </button>
            <button
              type="button"
              disabled={busy || empty}
              onClick={() => void run("analysis")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              <BrainIcon className="h-4 w-4" />
              {loading === "analysis" ? "Reading…" : "Only read the message"}
            </button>
            <span className="text-xs text-slate-500">{empty ? "Write a few words, or pick an example, to start." : "Ctrl + Enter also sends."}</span>
          </div>
        </form>
        )}
        </div>

        <aside className="space-y-4">
          {mode === "write" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">What helps us</h2>
            <p className="mt-1 text-xs text-slate-500">Ticks turn green as your message covers them. Anything missing, we ask about instead of guessing.</p>
            <ul className="mt-4 space-y-3">
              {TIPS.map((tip) => {
                const done = covered.has(tip.key);
                return (
                  <li key={tip.key} className="flex gap-3 text-sm">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                        done ? "bg-emerald-500 text-white" : "border-2 border-dashed border-slate-300 text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className={`font-semibold ${done ? "text-slate-900" : "text-slate-700"}`}>{tip.key === "amount" && role === "ngo" ? "Amount, if known" : tip.title}</span>
                      <span className="sr-only">{done ? " (covered)" : " (not mentioned yet)"}</span>
                      <span className="block text-xs text-slate-500">{tip.key === "amount" && role === "ngo" ? "from the report, or set by the NGO" : tip.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          )}
          <section className="rounded-3xl bg-indigo-50 p-5 text-sm text-indigo-900">
            <h2 className="flex items-center gap-2 font-bold">
              <ShieldCheckIcon className="h-5 w-5 text-indigo-600" /> Keep them safe
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-indigo-800">
              No full names, phone numbers or account numbers are needed. A first name or &quot;my parents&quot; is enough.
            </p>
          </section>
        </aside>
      </div>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-6 space-y-4">
        {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {loading === "case" && (
          <LoadingCard text="Reading the message, comparing payment routes and building a basket. This takes a few seconds." />
        )}
        {loading === "analysis" && <LoadingCard text="Reading the message…" />}
        {!busy && outcome?.kind === "case" && (
          <CaseOutcome key={outcome.result.case_id} role={role} result={outcome.result} onAnswer={onAnswer} busy={busy} />
        )}
        {!busy && outcome?.kind === "analysis" && <SituationResultView result={outcome.result} />}
      </div>
    </div>
  );
}

function CoverageBar({ count, total }: { count: number; total: number }) {
  const pct = Math.round((count / total) * 100);
  const tone = count >= 4 ? "bg-emerald-500" : count >= 2 ? "bg-amber-400" : "bg-slate-300";
  const text = count === 0 ? "Not started" : count >= 4 ? "Great detail" : count >= 2 ? "Good start, add a bit more" : "Add a bit more detail";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="h-1.5 w-28 shrink-0 rounded-full bg-slate-200" aria-hidden="true">
        <div className={`h-1.5 rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="truncate">
        {text} · {count}/{total} topics
      </span>
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />;
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden="true" />
      {text}
    </div>
  );
}
