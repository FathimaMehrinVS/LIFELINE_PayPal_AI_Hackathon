"use client";

import type { SituationRequest, SituationResult } from "@lifeline/contracts";
import { type FormEvent, useState } from "react";
import { ApiRequestError, api } from "../../services/api";
import { SituationResultView } from "./situation-result";

// Owner: Member 1 (feature/situation-agent)

const MAX_LENGTH = 4000;

const EXAMPLES = [
  {
    label: "Conflict area, €300",
    message:
      "My parents are in a conflict-affected area. Their bank is inaccessible and internet is intermittent. I have €300 to send. They need food and medicine.",
  },
  {
    label: "Kerala, UPI shops",
    message: "My family in Kerala needs food and medicine, budget 5000 INR. Shops near them take UPI but the ATM is broken.",
  },
  { label: "Vague", message: "please help us" },
];

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) {
    if (err.status === 400) return "Please describe the situation in a few words.";
    if (err.status === 502) return "The AI service is busy or unavailable. Please try again in a minute.";
    return err.message;
  }
  return "Can't reach the LIFELINE API. Is it running (npm run dev:api)?";
}

export default function SituationPage() {
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState("");
  const [result, setResult] = useState<SituationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: SituationRequest = { message: message.trim() };
      if (location.trim()) body.location = location.trim();
      if (/^[A-Z]{3}$/.test(currency)) body.currency = currency;
      setResult(await api.analyzeSituation(body));
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Describe the situation</h1>
        <p className="text-slate-600">
          Write it in your own words. LIFELINE works out what is needed and what financial access exists, and tells you
          what it still doesn&apos;t know.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="message" className="mb-1 block text-sm font-medium">
            What is happening?
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={5}
            required
            placeholder="e.g. My parents' bank is closed, the internet is intermittent. I have €300. They need food and medicine."
            className="w-full rounded-xl border border-slate-300 p-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex flex-wrap gap-2">
              <span>Try:</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => setMessage(example.message)}
                  className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
                >
                  {example.label}
                </button>
              ))}
            </div>
            <span>
              {message.length}/{MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="location" className="mb-1 block text-sm font-medium">
              Location <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Town or district"
              className="w-full rounded-xl border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label htmlFor="currency" className="mb-1 block text-sm font-medium">
              Currency <span className="font-normal text-slate-500">(optional, e.g. EUR, INR)</span>
            </label>
            <input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
              placeholder="3-letter code"
              className="w-full rounded-xl border border-slate-300 p-2 uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || message.trim() === ""}
          className="rounded-full bg-indigo-600 px-6 py-2.5 shadow-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Analysing…" : "Analyse"}
        </button>
      </form>

      <div aria-live="polite">
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {loading && <p className="text-slate-500">Reading the message… this takes a few seconds.</p>}
        {result && !loading && <SituationResultView result={result} />}
      </div>
    </div>
  );
}
