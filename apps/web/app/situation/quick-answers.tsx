"use client";

import { useState } from "react";
import { RouteIcon } from "../../components/icons";
import { ACCESS_ANSWERS, type Choice, NEED_OPTIONS, type ReporterRole, accessSentence, needLabel } from "./answers";
import { VoiceInput } from "./voice";

// Owner: Member 1. "Tap to answer": the same facts as a written message, gathered with taps, for someone in a hurry.
// The answers become plain sentences that the Situation Agent reads like any message, so nothing is filled in by
// guessing, and fewer follow-up questions are needed.

const WHO: Record<ReporterRole, { value: string; label: string; sentence: string }[]> = {
  self: [
    { value: "self", label: "Me", sentence: "I need help." },
    { value: "family", label: "My family", sentence: "My family needs help." },
    { value: "children", label: "My children", sentence: "My children need help." },
    { value: "elderly", label: "An elderly relative", sentence: "An elderly relative needs help." },
  ],
  ngo: [
    { value: "family", label: "A family", sentence: "A family needs help." },
    { value: "children", label: "Children", sentence: "Children need help." },
    { value: "elderly", label: "An elderly person", sentence: "An elderly person needs help." },
    { value: "other", label: "Someone else", sentence: "A person needs help." },
  ],
  family: [
    { value: "parents", label: "My parents", sentence: "My parents need help." },
    { value: "family", label: "My family", sentence: "My family needs help." },
    { value: "children", label: "Children", sentence: "Children in my family need help." },
    { value: "elderly", label: "An elderly relative", sentence: "An elderly relative needs help." },
    { value: "other", label: "Someone else", sentence: "Someone I know needs help." },
  ],
};

const URGENCY = [
  { value: "danger", label: "Someone's life is in danger", sentence: "Someone's life is in danger right now." },
  { value: "days", label: "Running out within days", sentence: "They will run out of essentials within days." },
  { value: "weeks", label: "Can manage for a few weeks", sentence: "They can manage for a few weeks, but need support." },
];

const CURRENCIES = ["EUR", "USD", "GBP", "INR", "AED", "CAD", "AUD"];

export interface QuickRequest {
  message: string;
  location?: string;
  currency?: string;
  assistance_amount?: number;
}

interface QuickAnswersProps {
  role: ReporterRole;
  onSubmit: (request: QuickRequest) => void;
  busy: boolean;
}

export function QuickAnswers({ role, onSubmit, busy }: QuickAnswersProps) {
  const [who, setWho] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [urgency, setUrgency] = useState<string | null>(null);
  const [access, setAccess] = useState<Record<string, Choice>>({});
  const [extra, setExtra] = useState("");

  const sentences = [
    WHO[role].find((w) => w.value === who)?.sentence,
    place.trim() && `They are in ${place.trim()}.`,
    needs.length > 0 && `They need ${needs.map(needLabel).join(", ")}.`,
    // The NGO's amount is a decision, sent separately; it isn't part of what the family reported.
    role !== "ngo" && amount && `I can send ${amount} ${currency}.`,
    URGENCY.find((u) => u.value === urgency)?.sentence,
    ...Object.keys(ACCESS_ANSWERS).map((key) => accessSentence(key, access[key])),
    extra.trim(),
  ].filter((s): s is string => Boolean(s));
  const message = sentences.join(" ");

  const answered = [who, place.trim(), needs.length > 0, amount, urgency, Object.keys(access).length > 0].filter(Boolean).length;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!message) return;
        const ngoAmount = role === "ngo" && Number(amount) > 0 ? Math.round(Number(amount) * 100) / 100 : undefined;
        onSubmit({ message, location: place.trim() || undefined, currency: amount ? currency : undefined, assistance_amount: ngoAmount });
      }}
    >
      <Question n={1} title="Who needs help?">
        <Chips options={WHO[role]} value={who} onChange={setWho} />
      </Question>

      <Question n={2} title="Where are they?">
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Town or district"
          className="w-full max-w-md rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      </Question>

      <Question n={3} title="What do they need most?" hint="Pick all that apply">
        <div className="flex flex-wrap gap-2">
          {NEED_OPTIONS.map((n) => {
            const on = needs.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => setNeeds((list) => (on ? list.filter((x) => x !== n) : [...list, n]))}
                className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                  on ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {needLabel(n)}
              </button>
            );
          })}
        </div>
      </Question>

      <Question
        n={4}
        title={role === "ngo" ? "How much will the NGO spend?" : "How much can you send?"}
        hint={role === "ngo" ? "If left blank, urgent cases use a standard package" : undefined}
      >
        <div className="flex max-w-sm gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="e.g. 300"
            aria-label="Amount"
            className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
            className="rounded-xl border border-slate-300 bg-white p-2.5 focus:border-indigo-500 focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </Question>

      <Question n={5} title="How urgent is it?">
        <Chips options={URGENCY} value={urgency} onChange={setUrgency} />
      </Question>

      <Question n={6} title="How can they get or use money?" hint="Not sure is fine: we'll keep it as unknown">
        <ul className="space-y-2">
          {Object.entries(ACCESS_ANSWERS).map(([key, { short }]) => (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-800">{short}</span>
              <span className="flex gap-1.5" role="radiogroup" aria-label={short}>
                {(
                  [
                    ["yes", "Yes"],
                    ["no", "No"],
                    ["unsure", "Not sure"],
                  ] as const
                ).map(([value, label]) => {
                  const on = access[key] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAccess((a) => ({ ...a, [key]: value }))}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        on
                          ? value === "yes"
                            ? "bg-emerald-500 text-white"
                            : value === "no"
                              ? "bg-slate-800 text-white"
                              : "bg-slate-300 text-slate-800"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
      </Question>

      <Question n={7} title="Anything else?" hint="Optional: type or speak">
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          placeholder="e.g. My mother needs insulin every day."
          className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
        <div className="mt-2">
          <VoiceInput compact onText={(t) => setExtra((v) => (v.trim() ? `${v.trim()} ${t}` : t))} />
        </div>
      </Question>

      <section className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">What we&apos;ll send to LIFELINE</h3>
        <p className="mt-1 text-sm text-slate-800">{message || <span className="text-slate-500">Your answers appear here as you tap.</span>}</p>
        {role === "ngo" && Number(amount) > 0 && (
          <p className="mt-2 text-xs font-medium text-indigo-800">
            NGO amount: {amount} {currency}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-100 pt-5">
        <button
          type="submit"
          disabled={busy || !message}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
        >
          <RouteIcon className="h-5 w-5" /> {busy ? "Finding a way…" : "Find a way to help"}
        </button>
        <span className="text-xs text-slate-500">
          {answered === 0 ? "Tap a few answers to start. You can skip any question." : `${answered} of 6 answered. Skipped questions are asked later if needed.`}
        </span>
      </div>
    </form>
  );
}

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4">
      <legend className="flex items-center gap-2 px-1 text-base font-semibold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">{n}</span>
        {title}
        {hint && <span className="text-xs font-normal text-slate-500">· {hint}</span>}
      </legend>
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}

function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              on ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
