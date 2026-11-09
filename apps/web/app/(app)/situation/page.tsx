"use client";

import type { CaseResult, SituationRequest, SituationResult } from "@lifeline/contracts";
import Link from "next/link";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, CheckIcon, HeartHandIcon, ShieldCheckIcon, UsersIcon } from "@/components/icons";
import { AiPanel, Badge, Card, Choice, button, fieldClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { caseRef } from "../dashboard/case-row";
import { ACCESS_ANSWERS, type Choice as AccessChoice, type ReporterRole, accessSentence, needLabel } from "./answers";
import { type CaseAnswers, CaseOutcome } from "./case-outcome";
import { QuickAnswers, type QuickRequest } from "./quick-answers";
import { VoiceInput } from "./voice";

// Owner: Member 1. The four-step request flow, styled from "LIFELINE Screen Designs" pages 4-7.
// Step 2 reads the report with the AI; nothing is saved until the person submits in step 3.

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

const EXAMPLES: Record<ReporterRole, { title: string; message: string; amount?: string; currency?: string }[]> = {
  self: [{ title: "No bank, family of 4", message: "We are a family of four in Demo Town (synthetic). Our bank is closed and the internet keeps cutting out. We can use a mobile wallet. We need food and medicine." }],
  family: [{ title: "Parents, bank closed", message: "My parents live in Demo Town (synthetic). Their bank is inaccessible and internet is intermittent. They can use a mobile wallet. They need food and medicine." }],
  ngo: [
    { title: "Displaced family at a shelter", message: "Family arrived at Demo Shelter in Demo Town (synthetic) after leaving a conflict area. Two children and their diabetic mother, no money. No functioning bank access, but they can use a mobile wallet and have phone signal. They need food and medicine." },
    { title: "Flood, NGO sets €150", message: "Family of 5 in Demo Town (synthetic) after a flood needs drinking water and hygiene items. Bank is closed. They can use a mobile wallet and the internet works.", amount: "150", currency: "EUR" },
  ],
};

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
    if (err.status === 502) return "The AI service is busy right now. Please try again in a minute.";
    return err.message;
  }
  return "We can't reach LIFELINE right now. Check your connection and try again.";
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const covered = useMemo(() => new Set(TOPICS.filter((t) => t.test(message, location, people)).map((t) => t.key)), [message, location, people]);

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
    setStep(1); setMessage(""); setLocation(""); setPeople(""); setUrgency(null); setCurrency(""); setAmount("");
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
            {ROLES.map(({ role: value, title, text, tint, Icon }) => {
              const selected = role === value;
              return (
                <article key={value} className={`flex flex-col rounded-2xl bg-white p-7 ${selected ? "border-2 border-teal shadow-lg shadow-slate-200/70" : "border border-slate-200"}`}>
                  <button type="button" onClick={() => setRole(value)} aria-pressed={selected} className="flex flex-1 flex-col text-left">
                    <span className={`flex h-28 items-center justify-center rounded-xl ${tint}`}><Icon className="h-12 w-12" /></span>
                    <span className="mt-5 text-xl font-bold text-navy">{title}</span>
                    <span className="mt-2 flex-1 text-slate-600">{text}</span>
                  </button>
                  <button type="button" onClick={() => { setRole(value); setStep(2); }} className={`${selected ? button.primary : button.secondary} mt-5 w-full`}>
                    Continue {selected && <ArrowRightIcon className="h-4 w-4" />}
                  </button>
                </article>
              );
            })}
          </div>
          <p className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-xl border border-teal/30 bg-teal-tint p-4 text-navy">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-text" />
            <span><strong>You do not need a bank account or PayPal account to request assistance.</strong> Requesting help is always free.</span>
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-7 lg:grid-cols-[1fr_330px]">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Tell us what&apos;s happening</h1>
            <p className="mt-2 text-lg text-slate-600">Write, speak or tap, in any language. We&apos;ll organise the details and ask about anything that&apos;s missing.</p>

            <div className="mt-6 inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="How to describe the situation">
              {([["write", "Write or speak"], ["tap", "Tap to answer"]] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${mode === value ? "bg-white text-navy shadow-sm" : "text-slate-600"}`}>{label}</button>
              ))}
            </div>

            {mode === "tap" ? (
              <Card className="mt-4 p-6"><QuickAnswers role={role} busy={busy} onSubmit={continueFromTaps} /></Card>
            ) : (
              <>
                <Card className="mt-4 p-6">
                  <label htmlFor="message" className="mb-2 block text-sm font-bold text-navy">{role === "ngo" ? "What did the family tell you?" : "What happened, and what kind of help is needed?"}</label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && message.trim()) continueFromWriting(); }}
                    maxLength={MAX_LENGTH}
                    rows={6}
                    placeholder="Describe the situation in your own words."
                    className={`${fieldClass} leading-relaxed`}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PHRASES.map((phrase) => (
                        <button key={phrase} type="button" onClick={() => setMessage((m) => (m.trim() ? `${m.trim()} ${phrase}` : phrase))} className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[13px] font-medium text-navy hover:bg-slate-50">{phrase.replace(".", "")}</button>
                      ))}
                    </div>
                    <VoiceInput compact onText={(t) => setMessage((m) => (m.trim() ? `${m.trim()} ${t}` : t).slice(0, MAX_LENGTH))} />
                  </div>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    Try an example:
                    {EXAMPLES[role].map((example) => (
                      <button key={example.title} type="button" onClick={() => { setMessage(example.message); setAmount(example.amount ?? ""); setCurrency(example.currency ?? ""); }} className="font-semibold text-teal-text underline-offset-2 hover:underline">{example.title}</button>
                    ))}
                  </p>
                </Card>

                <Card className="mt-5 p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-bold text-navy">
                      <span className="mb-1.5 block">Location</span>
                      <input value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="off" placeholder="Town or district" className={fieldClass} />
                      <span className="mt-1 block text-xs font-normal text-slate-500">A neighbourhood or nearby landmark is enough.</span>
                    </label>
                    <label className="block text-sm font-bold text-navy">
                      <span className="mb-1.5 block">Number of people affected</span>
                      <input inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value.replace(/\D/g, ""))} className={fieldClass} />
                    </label>
                    {role === "ngo" && (
                      <>
                        <label className="block text-sm font-bold text-navy">
                          <span className="mb-1.5 block">Amount the NGO will spend <span className="font-normal text-slate-500">(optional)</span></span>
                          <input inputMode="decimal" value={amount} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ""); setAmount(v); if (v && !currency) setCurrency("EUR"); }} className={fieldClass} />
                          <span className="mt-1 block text-xs font-normal text-slate-500">If left blank, urgent cases use a standard emergency package.</span>
                        </label>
                        <label className="block text-sm font-bold text-navy">
                          <span className="mb-1.5 block">Currency</span>
                          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass}>
                            <option value="">As in the report</option>
                            {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                  <p className="mb-2 mt-5 text-sm font-bold text-navy">How urgent is it?</p>
                  <div className="grid gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="How urgent is it?">
                    {URGENCY.map((option) => (
                      <Choice key={option.value} selected={urgency === option.value} onClick={() => setUrgency(urgency === option.value ? null : option.value)} tone={option.value === "now" ? "critical" : "default"} className="rounded-lg px-4 py-3">{option.label}</Choice>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[13px] text-slate-600">If someone is in immediate danger, please contact local emergency services first.</p>
                </Card>

                <div className="mt-6 flex items-center justify-between">
                  <button type="button" onClick={() => setStep(1)} className="text-slate-600 hover:text-navy">← Back</button>
                  <button type="button" disabled={busy || !message.trim()} onClick={continueFromWriting} className={`${button.primary} px-7 py-3 text-base`}>
                    {busy ? "Reading your report…" : <>Continue <ArrowRightIcon className="h-4 w-4" /></>}
                  </button>
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4">
            {mode === "write" && (
              <Card className="p-5">
                <h2 className="font-bold text-navy">Your information</h2>
                <p className="mt-1 text-[13px] text-slate-500">Updating as you type. Anything missing, we ask about instead of guessing.</p>
                <ul className="mt-3 space-y-2.5">
                  {TOPICS.map((topic) => (
                    <li key={topic.key} className="flex items-center justify-between gap-2 text-sm text-navy">
                      {topic.label}
                      <Badge tone={covered.has(topic.key) ? "success" : "neutral"}>{covered.has(topic.key) ? "Mentioned" : "Missing"}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
              <strong className="text-navy">Only share information needed to coordinate assistance.</strong> Donors never see your name or address.
            </div>
          </aside>
        </div>
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
          onEdit={() => setStep(2)}
          onSubmit={() => void submit()}
        />
      )}

      {step === 4 && result && (
        <SubmittedStep result={result} role={role} submittedAt={submittedAt} busy={busy} onAnswer={onAnswer} onReset={startOver} />
      )}
    </div>
  );
}

function ReviewStep({ analysis, role, ngoAmount, choices, onChoice, clarifiedLocation, onClarifiedLocation, busy, onEdit, onSubmit }: {
  analysis: SituationResult; role: ReporterRole; ngoAmount?: number; choices: Record<string, AccessChoice>; onChoice: (key: string, value: AccessChoice) => void;
  clarifiedLocation: string; onClarifiedLocation: (value: string) => void; busy: boolean; onEdit: () => void; onSubmit: () => void;
}) {
  const accessQuestions = analysis.missing_information.filter((key) => ACCESS_ANSWERS[key]);
  const askLocation = analysis.location === null;
  const count = accessQuestions.length + (askLocation ? 1 : 0);
  const known = (value: unknown) => <Badge tone={value ? "ai" : "neutral"}>{value ? "AI-extracted" : "Missing"}</Badge>;
  const edit = <button type="button" onClick={onEdit} className="mt-3 text-sm font-semibold text-teal-text hover:underline">Edit</button>;

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Here&apos;s what we understood.</h1>
      <p className="mt-2 text-lg text-slate-600">Please check each card. You can edit anything that&apos;s wrong; an NGO team member reviews it afterwards.</p>

      <div className="mt-6"><AiPanel title="AI summary" label="AI-generated · not yet verified">{analysis.summary}</AiPanel></div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">Identified needs</p>{known(analysis.needs.length)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.needs.map((need) => <span key={need} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium capitalize text-navy">{needLabel(need)}</span>)}
            {analysis.needs.length === 0 && <span className="text-slate-500">None stated yet</span>}
          </div>
          {edit}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">People affected</p>{known(analysis.household_size)}</div>
          <p className="mt-2 text-2xl font-bold text-navy">{analysis.household_size ? `${analysis.household_size} ${analysis.household_size === 1 ? "person" : "people"}` : "Not stated"}</p>
          {analysis.special_needs && analysis.special_needs.length > 0 && <p className="mt-1 text-[13px] text-slate-600">{analysis.special_needs.join(", ")}</p>}
          {edit}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">Location</p>{known(analysis.location)}</div>
          <p className="mt-2 text-xl font-bold text-navy">{analysis.location ?? "Not stated"}</p>
          <p className="mt-1 text-[13px] text-slate-600">Shared only with the NGO team</p>
          {edit}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">Urgency</p><Badge tone="ai">AI-extracted</Badge></div>
          <p className="mt-2"><Badge tone={analysis.urgency === "critical" ? "critical" : analysis.urgency === "high" ? "warning" : "neutral"} className="capitalize">{analysis.urgency}</Badge></p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">{role === "ngo" ? "Assistance amount" : "Estimated budget"}</p>{role !== "ngo" && analysis.budget === null ? <Badge tone="neutral">Not provided</Badge> : null}</div>
          <p className="mt-2 text-slate-600">
            {role === "ngo" && ngoAmount !== undefined ? <strong className="text-xl text-navy">{ngoAmount} {analysis.currency ?? ""}</strong> : analysis.budget !== null ? <strong className="text-xl text-navy">{analysis.budget} {analysis.currency ?? ""}</strong> : role === "ngo" ? "Not set. Urgent cases use a standard emergency package." : "You don't need to know costs. The NGO team will prepare an assistance plan."}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-600">How sure we are</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-navy">
            <span className="h-2 flex-1 rounded-full bg-slate-200"><span className={`block h-2 rounded-full ${analysis.confidence >= 0.6 ? "bg-teal" : "bg-accent"}`} style={{ width: `${Math.round(analysis.confidence * 100)}%` }} /></span>
            {analysis.confidence >= 0.8 ? "High" : analysis.confidence >= 0.6 ? "Medium" : "Low"}
          </div>
        </Card>
      </div>

      {count > 0 && (
        <Card className="mt-5 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-navy">A few things we&apos;d like to clarify</h2>
            <Badge tone="warning">{count} to clarify</Badge>
          </div>
          <div className="mt-4 space-y-5">
            {askLocation && (
              <label className="block max-w-md text-sm font-bold text-navy">
                <span className="mb-2 block">Where are they?</span>
                <input value={clarifiedLocation} onChange={(e) => onClarifiedLocation(e.target.value)} placeholder="Town or district" className={fieldClass} />
              </label>
            )}
            {accessQuestions.map((key) => (
              <div key={key}>
                <p className="mb-2 text-sm font-bold text-navy">{ACCESS_ANSWERS[key]!.short}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ACCESS_ANSWERS[key]!.short}>
                  {([["yes", "Yes"], ["no", "No"], ["unsure", "I'm not sure"]] as const).map(([value, label]) => (
                    <Choice key={value} selected={choices[key] === value} onClick={() => onChoice(key, value)} className="rounded-full px-4 py-2">{label}</Choice>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onEdit} className={button.secondary}>Edit Information</button>
        <button type="button" disabled={busy} onClick={onSubmit} className={`${button.primary} px-7 py-3 text-base`}>{busy ? "Submitting…" : "Submit Request"}</button>
      </div>
    </div>
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
