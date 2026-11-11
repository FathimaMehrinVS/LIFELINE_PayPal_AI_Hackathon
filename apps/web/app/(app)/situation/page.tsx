"use client";

import type { CaseResult, SituationRequest, SituationResult } from "@lifeline/contracts";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, HeartHandIcon, ShieldCheckIcon, UsersIcon } from "@/components/icons";
import { AiPanel, Badge, Card, Choice, button, fieldClass, FieldError, fieldErrorClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { caseRef } from "../dashboard/case-row";
import { ACCESS_ANSWERS, type Choice as AccessChoice, type ReporterRole, accessSentence, needLabel } from "./answers";
import { type CaseAnswers, CaseOutcome } from "./case-outcome";
import { QuickAnswers, type QuickRequest } from "./quick-answers";
import { VoiceInput } from "./voice";

// Owner: Member 1. The four-step request flow, styled from "LIFELINE Screen Designs" pages 4-7.
// Step 2 reads the report with the AI; nothing is saved until the person submits in step 3.
// Each screen asks for one thing, so nobody under stress faces a long form.

const MAX_LENGTH = 4000;
type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Choose reporting method", "Describe situation", "Review details", "Submit"];

const ROLES: { role: ReporterRole; title: string; text: string; tint: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { role: "self", title: "I need assistance", text: "For an affected person or family asking for help for themselves.", tint: "bg-teal-tint text-teal-text", Icon: HeartHandIcon },
  { role: "family", title: "I am reporting for someone", text: "For relatives, volunteers or community members reporting on behalf of a person or family.", tint: "bg-slate-100 text-navy", Icon: UsersIcon },
  { role: "ngo", title: "I am an NGO worker", text: "For NGO staff recording a case from the field.", tint: "bg-warning-tint text-warning", Icon: ShieldCheckIcon },
];

const QUICK_PHRASES = ["We need food.", "Our home was damaged.", "We need medical essentials.", "We need drinking water."];

const URGENCY = [
  { value: "weeks", label: "Can wait a few weeks", sentence: "It can wait a few weeks." },
  { value: "week", label: "Needed this week", sentence: "Help is needed this week." },
  { value: "days", label: "Needed in 1–2 days", sentence: "Help is needed within one or two days." },
  { value: "now", label: "Life-threatening now", sentence: "Someone's life is in danger right now." },
];

const CURRENCIES = ["EUR", "USD", "GBP", "INR", "AED", "CAD", "AUD"];

/** A quick check for the live panel only. The AI does the real reading, and asks about anything it can't find. */
const TOPICS: { key: string; label: string; test: (message: string, location: string, people: string) => boolean }[] = [
  { key: "where", label: "Where they are", test: (m, l) => l.trim() !== "" || /\b(in|near|at|from)\s+[A-Z][a-z]/.test(m) },
  { key: "people", label: "How many people", test: (m, _l, p) => p.trim() !== "" || /\b(family of|parents|children|\d+ (people|of us))\b/i.test(m) },
  { key: "needs", label: "What they need", test: (m) => /\b(food|water|medicine|medical|shelter|baby|diaper|hygiene|cloth|blanket|bedding|insulin)/i.test(m) },
  { key: "money", label: "How they can get money", test: (m) => /\b(bank|atm|wallet|upi|m-?pesa|paypal|cash|agent|shop|market)/i.test(m) },
  { key: "connection", label: "Internet or phone", test: (m) => /\b(internet|phone|signal|network|offline|online|wifi)/i.test(m) },
];

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) {
    if (err.status === 400) return "Please describe the situation in a few words.";
    if (err.status === 429) return "Too many reports in a short time. Please wait a minute and try again.";
    if (err.status === 502) return "The AI service is busy right now. Please try again in a minute.";
    return err.message;
  }
  return "We can't reach LIFELINE right now. Check your connection and try again.";
}

type IntakePage = "describe" | "details" | "urgency" | "amount";

/** One question per screen, with Back and the main action always in the same place. */
function Screen({ screenKey, progress, title, hint, children, footer }: { screenKey: string; progress?: string; title: string; hint?: string; children: ReactNode; footer: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, [screenKey]);
  return (
    <div className="mx-auto max-w-2xl">
      {progress && <p className="text-sm font-semibold text-teal-text">{progress}</p>}
      <h1 ref={heading} tabIndex={-1} className="mt-1 text-3xl font-extrabold tracking-tight text-navy outline-none sm:text-4xl">{title}</h1>
      {hint && <p className="mt-2 text-lg text-slate-600">{hint}</p>}
      <div className="mt-6">{children}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">{footer}</div>
    </div>
  );
}

function validAmount(text: string): number | undefined {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
}

export default function RequestFlowPage() {
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<ReporterRole>("self");
  const [mode, setMode] = useState<"write" | "tap">("write");
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("");
  const [urgency, setUrgency] = useState<string | null>(null);
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [report, setReport] = useState("");
  const [analysis, setAnalysis] = useState<SituationResult | null>(null);
  const [choices, setChoices] = useState<Record<string, AccessChoice>>({});
  const [clarifiedLocation, setClarifiedLocation] = useState("");
  const [result, setResult] = useState<CaseResult | null>(null);
  const [submittedAt, setSubmittedAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messageMissing, setMessageMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Read from the message alone, so answering a later screen can't change the list of screens.
  const mentioned = useMemo(() => new Set(TOPICS.filter((t) => t.test(message, "", "")).map((t) => t.key)), [message]);
  const askWhere = !mentioned.has("where");
  const askPeople = !mentioned.has("people");
  const pages: IntakePage[] = ["describe", ...(askWhere || askPeople ? (["details"] as const) : []), "urgency", ...(role === "ngo" ? (["amount"] as const) : [])];
  const page = pages[Math.min(pageIndex, pages.length - 1)]!;
  const lastPage = pageIndex >= pages.length - 1;

  function nextPage(event?: FormEvent) {
    event?.preventDefault();
    if (page === "describe" && !message.trim()) {
      setMessageMissing(true);
      return;
    }
    if (lastPage) continueFromWriting();
    else setPageIndex(pageIndex + 1);
  }

  function body(text: string, place = location, code = currency, ngoAmount = validAmount(amount)): SituationRequest {
    const request: SituationRequest = { message: text.trim().slice(0, MAX_LENGTH) };
    if (place.trim()) request.location = place.trim();
    if (/^[A-Z]{3}$/.test(code)) request.currency = code;
    if (role === "ngo" && ngoAmount !== undefined) request.assistance_amount = ngoAmount;
    return request;
  }

  async function analyse(text: string, place?: string, code?: string, ngoAmount?: number) {
    setBusy(true);
    setError(null);
    try {
      const understood = await api.analyzeSituation(body(text, place ?? location, code ?? currency, ngoAmount ?? validAmount(amount)));
      setReport(text);
      setAnalysis(understood);
      setChoices({});
      setStep(3);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Adds the form's facts to the message as full sentences, so the AI reads them the way they were meant. */
  function continueFromWriting() {
    if (!message.trim()) {
      setMessageMissing(true);
      return;
    }
    const extra = [
      people.trim() && `There are ${people.trim()} people who need help.`,
      URGENCY.find((u) => u.value === urgency)?.sentence,
    ].filter(Boolean);
    void analyse([message.trim(), ...extra].join(" "));
  }

  function continueFromTaps(request: QuickRequest) {
    setMessage(request.message);
    if (request.location) setLocation(request.location);
    if (request.currency) setCurrency(request.currency);
    if (request.assistance_amount !== undefined) setAmount(String(request.assistance_amount));
    void analyse(request.message, request.location, request.currency, request.assistance_amount);
  }

  async function submit(replaces?: string, text?: string, place?: string, code?: string) {
    setBusy(true);
    setError(null);
    try {
      const answers = text ? [] : Object.keys(ACCESS_ANSWERS).map((key) => accessSentence(key, choices[key])).filter((s): s is string => Boolean(s));
      const where = text ? place : clarifiedLocation.trim() || undefined;
      const full = text ?? [report, where && `They are in ${where}.`, ...answers].filter(Boolean).join(" ");
      const created = await api.createCase(body(full, where ?? location, code ?? currency), replaces);
      setReport(full);
      if (where) setLocation(where);
      setResult(created);
      setSubmittedAt(new Date().toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
      setStep(4);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onAnswer(answers: CaseAnswers) {
    if (!result) return;
    void submit(result.case_id, `${report.trim()} ${answers.sentences.join(" ")}`, answers.location ?? location, answers.currency ?? currency);
  }

  function startOver() {
    setStep(1); setPageIndex(0); setMessage(""); setLocation(""); setPeople(""); setUrgency(null); setCurrency(""); setAmount("");
    setReport(""); setAnalysis(null); setChoices({}); setClarifiedLocation(""); setResult(null); setError(null); setMode("write");
  }

  return (
    <div className="mx-auto max-w-[1130px]">
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEP_LABELS.map((label, index) => {
          const n = index + 1;
          return (
            <li key={label} aria-current={n === step ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${n <= step ? "bg-teal" : "bg-slate-200"}`} />
              <span className={`mt-1.5 block text-xs sm:text-[13px] ${n === step ? "font-bold text-teal-text" : "text-slate-500"}`}>{n} · {label}</span>
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="mb-5 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}

      {step === 1 && (
        <div>
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-[40px]">How would you like to report a need?</h1>
            <p className="mt-3 text-lg text-slate-600">Choose the option that fits you best. It only takes a few minutes.</p>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {ROLES.map(({ role: value, title, text, tint, Icon }) => (
              <button key={value} type="button" onClick={() => { setRole(value); setPageIndex(0); setStep(2); }} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-7 text-left transition hover:border-teal">
                <span className={`flex h-28 w-full items-center justify-center rounded-xl ${tint}`}><Icon className="h-12 w-12" /></span>
                <span className="mt-5 text-xl font-bold text-navy">{title}</span>
                <span className="mt-2 flex-1 text-slate-600">{text}</span>
                <span className="mt-4 inline-flex items-center gap-1.5 font-semibold text-teal-text">Continue <ArrowRightIcon className="h-4 w-4" /></span>
              </button>
            ))}
          </div>
          <p className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-xl border border-teal/30 bg-teal-tint p-4 text-navy">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-text" />
            <span><strong>You do not need a bank account or PayPal account to request assistance.</strong> Requesting help is always free.</span>
          </p>
        </div>
      )}

      {step === 2 && mode === "tap" && (
        <Screen
          screenKey="tap"
          title="Tell us what's happening"
          hint="Tap the answers that fit. We'll ask about anything that's missing."
          footer={<button type="button" onClick={() => setMode("write")} className="font-semibold text-teal-text hover:underline">← Write or speak instead</button>}
        >
          <Card className="p-6"><QuickAnswers role={role} busy={busy} onSubmit={continueFromTaps} /></Card>
        </Screen>
      )}

      {step === 2 && mode === "write" && (
        <form onSubmit={nextPage} noValidate>
          <Screen
            screenKey={page}
            progress={`Question ${Math.min(pageIndex, pages.length - 1) + 1} of ${pages.length}`}
            title={page === "describe" ? (role === "ngo" ? "What did the family tell you?" : "What happened?")
              : page === "details" ? (askWhere && askPeople ? "Where are they, and how many people need help?" : askWhere ? "Where are they?" : "How many people need help?")
              : page === "urgency" ? "How urgent is it?"
              : "Does the NGO have an amount to spend?"}
            hint={page === "describe" ? "Write or speak in any language. A few words is enough."
              : page === "details" ? "A best guess is fine. You can skip this if you don't know."
              : page === "urgency" ? "If you're not sure, just continue."
              : "Optional. If you skip this, urgent cases use a standard emergency package."}
            footer={<>
              <button type="button" onClick={() => (pageIndex === 0 ? setStep(1) : setPageIndex(pageIndex - 1))} className={button.secondary}>← Back</button>
              <button type="submit" disabled={busy} className={`${button.primary} px-7 py-3 text-base`}>{busy ? "Reading your report…" : <>Continue <ArrowRightIcon className="h-4 w-4" /></>}</button>
            </>}
          >
            {page === "describe" && (
              <Card className="p-6">
                <label htmlFor="message" className="sr-only">Describe the situation</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setMessageMissing(false); }}
                  aria-invalid={messageMissing}
                  aria-describedby={messageMissing ? "message-error" : undefined}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) nextPage(); }}
                  maxLength={MAX_LENGTH}
                  rows={5}
                  placeholder="Describe the situation in your own words."
                  className={`${fieldClass} leading-relaxed ${messageMissing ? fieldErrorClass : ""}`}
                />
                {messageMissing && <FieldError id="message-error">Please tell us what happened so we can help.</FieldError>}
                <div className="mt-3"><VoiceInput compact onText={(t) => { setMessage((m) => (m.trim() ? `${m.trim()} ${t}` : t).slice(0, MAX_LENGTH)); setMessageMissing(false); }} /></div>
                <p className="mt-4 text-[13px] text-slate-600">Or tap to add:</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {QUICK_PHRASES.map((phrase) => (
                    <button key={phrase} type="button" onClick={() => { setMessage((m) => (m.trim() ? `${m.trim()} ${phrase}` : phrase)); setMessageMissing(false); }} className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[13px] font-medium text-navy hover:bg-slate-50">{phrase.replace(".", "")}</button>
                  ))}
                </div>
                {message.trim() && mentioned.size > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-3" aria-live="polite">
                    <p className="text-[13px] text-slate-600">We&apos;ve picked up:</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {TOPICS.filter((topic) => mentioned.has(topic.key)).map((topic) => <li key={topic.key}><Badge tone="success"><CheckIcon className="h-3 w-3" /> {topic.label}</Badge></li>)}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-[13px] text-slate-600">Only share what&apos;s needed to coordinate help. Donors never see names or addresses.</p>
                <button type="button" onClick={() => setMode("tap")} className="mt-3 text-sm font-semibold text-teal-text hover:underline">Prefer to tap answers instead?</button>
              </Card>
            )}

            {page === "details" && (
              <Card className="grid gap-5 p-6">
                {askWhere && (
                  <label className="block text-sm font-bold text-navy">
                    <span className="mb-1.5 block">Location</span>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="off" placeholder="Town, district or nearby landmark" className={fieldClass} />
                  </label>
                )}
                {askPeople && (
                  <label className="block text-sm font-bold text-navy">
                    <span className="mb-1.5 block">Number of people</span>
                    <input inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value.replace(/\D/g, ""))} className={`${fieldClass} max-w-40`} />
                  </label>
                )}
              </Card>
            )}

            {page === "urgency" && (
              <div>
                <div className="grid gap-2.5" role="radiogroup" aria-label="How urgent is it?">
                  {URGENCY.map((option) => (
                    <Choice key={option.value} selected={urgency === option.value} onClick={() => setUrgency(urgency === option.value ? null : option.value)} tone={option.value === "now" ? "critical" : "default"} className="w-full rounded-xl px-5 py-4 text-base">{option.label}</Choice>
                  ))}
                </div>
                <p className="mt-4 text-sm font-semibold text-navy">If someone is in immediate danger, please contact local emergency services first.</p>
              </div>
            )}

            {page === "amount" && (
              <Card className="grid gap-5 p-6 sm:grid-cols-2">
                <label className="block text-sm font-bold text-navy">
                  <span className="mb-1.5 block">Amount</span>
                  <input inputMode="decimal" value={amount} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ""); setAmount(v); if (v && !currency) setCurrency("EUR"); }} className={fieldClass} />
                </label>
                <label className="block text-sm font-bold text-navy">
                  <span className="mb-1.5 block">Currency</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${fieldClass} font-normal`}>
                    <option value="">As in the report</option>
                    {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
                  </select>
                </label>
              </Card>
            )}
          </Screen>
        </form>
      )}

      {step === 3 && analysis && (
        <ReviewStep
          analysis={analysis}
          role={role}
          ngoAmount={validAmount(amount)}
          choices={choices}
          onChoice={(key, value) => setChoices((c) => ({ ...c, [key]: value }))}
          clarifiedLocation={clarifiedLocation}
          onClarifiedLocation={setClarifiedLocation}
          busy={busy}
          onEdit={() => { setPageIndex(0); setStep(2); }}
          onSubmit={() => void submit()}
        />
      )}

      {step === 4 && result && (
        <SubmittedStep result={result} role={role} submittedAt={submittedAt} busy={busy} onAnswer={onAnswer} onReset={startOver} />
      )}
    </div>
  );
}

const LOCATION_QUESTION = "__location";

function ReviewStep({ analysis, role, ngoAmount, choices, onChoice, clarifiedLocation, onClarifiedLocation, busy, onEdit, onSubmit }: {
  analysis: SituationResult; role: ReporterRole; ngoAmount?: number; choices: Record<string, AccessChoice>; onChoice: (key: string, value: AccessChoice) => void;
  clarifiedLocation: string; onClarifiedLocation: (value: string) => void; busy: boolean; onEdit: () => void; onSubmit: () => void;
}) {
  const questions = [...(analysis.location === null ? [LOCATION_QUESTION] : []), ...analysis.missing_information.filter((key) => ACCESS_ANSWERS[key])];
  const [index, setIndex] = useState(-1);
  const submitButton = <button type="button" disabled={busy} onClick={onSubmit} className={`${button.primary} px-7 py-3 text-base`}>{busy ? "Submitting…" : "Submit Request"}</button>;

  if (index >= 0 && questions.length > 0) {
    const key = questions[index]!;
    const isLocation = key === LOCATION_QUESTION;
    const isLast = index === questions.length - 1;
    const answered = isLocation ? clarifiedLocation.trim() !== "" : Boolean(choices[key]);
    const answer = (value: AccessChoice) => {
      onChoice(key, value);
      if (!isLast) window.setTimeout(() => setIndex(index + 1), 180);
    };
    return (
      <Screen
        screenKey={key}
        progress={`Question ${index + 1} of ${questions.length}`}
        title={isLocation ? "Where are they?" : ACCESS_ANSWERS[key]!.short}
        hint={isLocation ? "A neighbourhood or nearby landmark is enough." : "\u201cI'm not sure\u201d is a fine answer. We won't guess."}
        footer={<>
          <button type="button" onClick={() => setIndex(index - 1)} className={button.secondary}>← Back</button>
          {isLast ? submitButton : <button type="button" onClick={() => setIndex(index + 1)} className={button.secondary}>{answered ? "Next" : "Skip"}</button>}
        </>}
      >
        {isLocation
          ? <input aria-label="Where are they?" value={clarifiedLocation} onChange={(e) => onClarifiedLocation(e.target.value)} placeholder="Town or district" className={fieldClass} />
          : (
            <div className="grid gap-2.5" role="radiogroup" aria-label={ACCESS_ANSWERS[key]!.short}>
              {([["yes", "Yes"], ["no", "No"], ["unsure", "I'm not sure"]] as const).map(([value, label]) => (
                <Choice key={value} selected={choices[key] === value} onClick={() => answer(value)} className="w-full rounded-xl px-5 py-4 text-base">{label}</Choice>
              ))}
            </div>
          )}
      </Screen>
    );
  }

  const row = (label: string, value: ReactNode) => <div className="grid gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[150px_1fr]"><dt className="text-sm text-slate-600">{label}</dt><dd className="font-semibold text-navy">{value}</dd></div>;
  const amountText = role === "ngo" && ngoAmount !== undefined ? `${ngoAmount} ${analysis.currency ?? ""}`
    : analysis.budget !== null ? `${analysis.budget} ${analysis.currency ?? ""}`
    : role === "ngo" ? "Not set. Urgent cases use a standard emergency package." : "You don't need to know costs. The NGO team will plan this.";

  return (
    <Screen
      screenKey="summary"
      title="Did we get this right?"
      hint="An NGO team member checks it afterwards."
      footer={<>
        <button type="button" onClick={onEdit} className={button.secondary}>Edit Information</button>
        {questions.length > 0 ? <button type="button" onClick={() => setIndex(0)} className={`${button.primary} px-7 py-3 text-base`}>Looks right <ArrowRightIcon className="h-4 w-4" /></button> : submitButton}
      </>}
    >
      <AiPanel title="AI summary" label="AI-generated · not yet verified">{analysis.summary}</AiPanel>
      <Card className="mt-4 px-6 py-3">
        <dl>
          {row("Needs", analysis.needs.length > 0 ? <span className="flex flex-wrap gap-2">{analysis.needs.map((need) => <span key={need} className="rounded-md bg-slate-100 px-2.5 py-0.5 text-sm font-medium capitalize">{needLabel(need)}</span>)}</span> : "Not stated")}
          {row("People", analysis.household_size ? `${analysis.household_size} ${analysis.household_size === 1 ? "person" : "people"}` : "Not stated")}
          {row("Location", analysis.location ?? "Not stated")}
          {row("Urgency", <Badge tone={analysis.urgency === "critical" ? "critical" : analysis.urgency === "high" ? "warning" : "neutral"} className="capitalize">{analysis.urgency}</Badge>)}
          {row(role === "ngo" ? "Amount" : "Budget", <span className="font-normal">{amountText}</span>)}
          {row("How sure we are", analysis.confidence >= 0.8 ? "High" : analysis.confidence >= 0.6 ? "Medium" : "Low")}
        </dl>
      </Card>
      {questions.length > 0 && <p className="mt-3 text-sm text-slate-600">Next, {questions.length === 1 ? "one quick question" : `${questions.length} quick questions`}. Each is a single tap.</p>}
    </Screen>
  );
}

function SubmittedStep({ result, role, submittedAt, busy, onAnswer, onReset }: { result: CaseResult; role: ReporterRole; submittedAt: string; busy: boolean; onAnswer: (answers: CaseAnswers) => void; onReset: () => void }) {
  const { situation } = result;
  const reviewNote = result.status === "complete" ? "Waiting for a reviewer" : result.status === "needs_information" ? "Waiting for more details" : "An NGO worker will review options";
  const stages = [
    { label: "Request received", note: `Done · ${submittedAt}`, bar: "bg-success", text: "text-success" },
    { label: "AI assessment", note: `Done · ${submittedAt}`, bar: "bg-success", text: "text-success" },
    { label: "NGO verification", note: reviewNote, bar: "bg-accent", text: "text-warning" },
    { label: "Assistance planning", note: "Not started", bar: "", text: "text-slate-500" },
  ];
  return (
    <div className="mx-auto max-w-[920px]">
      <div className="text-center">
        <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-tint text-success"><CheckIcon className="h-9 w-9" /></span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Your request has been submitted.</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">Thank you for telling us. An NGO team member will review it. Keep your case reference so it can be found again.</p>
      </div>

      <Card className="mt-7 p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm text-slate-600">Case reference</p>
            <p className="font-mono text-3xl font-extrabold tracking-wide text-navy">{caseRef(result.case_id)}</p>
          </div>
          <Badge tone="warning" className="px-3 py-1 text-sm">Awaiting NGO review</Badge>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-4">
          <div><dt className="text-sm text-slate-600">Needs</dt><dd className="font-semibold capitalize text-navy">{situation.needs.map(needLabel).join(", ") || "Not stated"}</dd></div>
          <div><dt className="text-sm text-slate-600">People</dt><dd className="font-semibold text-navy">{situation.household_size ?? "Not stated"}</dd></div>
          <div><dt className="text-sm text-slate-600">Area</dt><dd className="font-semibold text-navy">{situation.location ?? "Not stated"}</dd></div>
          <div><dt className="text-sm text-slate-600">Urgency</dt><dd className="font-semibold capitalize text-navy">{situation.urgency}</dd></div>
        </dl>
        <ol className="mt-5 grid gap-3 sm:grid-cols-4">
          {stages.map((stage) => (
            <li key={stage.label}>
              <span className={`block h-1.5 rounded-full ${stage.bar || "border-t-2 border-dashed border-slate-300 bg-transparent"}`} />
              <p className="mt-2 text-sm font-bold text-navy">{stage.label}</p>
              <p className={`text-xs font-medium ${stage.text}`}>{stage.note}</p>
            </li>
          ))}
        </ol>
      </Card>

      {(role === "ngo" || result.status === "needs_information") && (
        <div className="mt-5"><CaseOutcome key={result.case_id} role={role} result={result} onAnswer={onAnswer} busy={busy} showDetails={false} /></div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">What happens next</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-700">
            <li>An NGO reviewer checks the request.</li>
            <li>If anything is unclear, you may be asked a short follow-up question.</li>
            <li>Once it&apos;s approved, the team prepares an assistance plan.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">Expected next action</h2>
          <p className="mt-2 text-slate-700">Response times depend on how many requests the team is handling, so we can&apos;t promise an exact time. Urgent cases are shown first.</p>
        </Card>
      </div>

      <p className="mt-5 flex items-start gap-3 rounded-xl border border-teal/30 bg-teal-tint p-4 text-navy">
        <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-text" />
        <span><strong>Submitting a request never requires payment.</strong> LIFELINE will never ask you for money.</span>
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {role === "ngo" && <Link href="/dashboard" className={button.primary}>Open Assistance Cases</Link>}
        <button type="button" onClick={onReset} className={button.secondary}>Report another need</button>
        <Link href="/" className={button.secondary}>Return home</Link>
      </div>
    </div>
  );
}
