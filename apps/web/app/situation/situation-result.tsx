import type { AccessFactorKey, Availability, SituationResult, Urgency } from "@lifeline/contracts";

// Owner: Member 1. Shows one SituationResult. Reused by the dashboard (Day 3).
// Unknown is shown as unknown, in grey, never as a guess.

const ACCESS_LABELS: Record<AccessFactorKey, string> = {
  bank_availability: "Bank",
  atm_access: "ATM",
  wallet_acceptance: "Mobile wallet",
  cash_availability: "Cash",
  merchant_acceptance: "Local shops",
  connectivity: "Internet / phone",
};

const AVAILABILITY_STYLES: Record<Availability, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  limited: "border-amber-200 bg-amber-50 text-amber-800",
  unavailable: "border-red-200 bg-red-50 text-red-800",
  unknown: "border-dashed border-slate-300 bg-slate-50 text-slate-500",
};

const AVAILABILITY_TEXT: Record<Availability, string> = {
  available: "Available",
  limited: "Limited",
  unavailable: "Unavailable",
  unknown: "Unknown — not stated",
};

const URGENCY_STYLES: Record<Urgency, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-900",
  critical: "bg-red-600 text-white",
};

/** What to ask the person for each missing field. Unlisted names fall back to the raw name. */
const MISSING_QUESTIONS: Record<string, string> = {
  budget: "How much money is available to send?",
  currency: "Which currency is the money in?",
  location: "Where is the family (town or district)?",
  bank_availability: "Can the family use a bank branch or account?",
  atm_access: "Is there a working ATM they can reach?",
  wallet_acceptance: "Can they receive or pay with a mobile wallet (e.g. UPI, M-Pesa, PayPal)?",
  cash_availability: "Can they get physical cash locally (cash points, agents)?",
  merchant_acceptance: "Are local shops open, and how do they accept payment?",
  connectivity: "Do they have internet or phone signal?",
};

const NEED_LABELS: Record<string, string> = { baby_supplies: "baby supplies" };

function formatBudget(budget: number | null, currency: string | null) {
  if (budget === null) return null;
  if (!currency) return budget.toLocaleString();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(budget);
  } catch {
    return `${budget.toLocaleString()} ${currency}`;
  }
}

export function SituationResultView({ result }: { result: SituationResult }) {
  const budget = formatBudget(result.budget, result.currency);
  const accessKeys = Object.keys(ACCESS_LABELS) as AccessFactorKey[];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${URGENCY_STYLES[result.urgency]}`}>
            {result.urgency} urgency
          </span>
          <span className="text-xs text-slate-500" title="How clearly the message stated these facts">
            Confidence {Math.round(result.confidence * 100)}%
          </span>
        </div>
        <p className="text-lg leading-relaxed">{result.summary}</p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Needs</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {result.needs.length === 0 && <span className="text-slate-500">None stated</span>}
              {result.needs.map((need) => (
                <span key={need} className="rounded-full bg-sky-50 px-3 py-0.5 text-sm font-medium capitalize text-sky-800 ring-1 ring-sky-100">
                  {NEED_LABELS[need] ?? need}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Budget</dt>
            <dd className="mt-1">{budget ?? <span className="text-slate-500">Not stated</span>}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Location</dt>
            <dd className="mt-1">{result.location ?? <span className="text-slate-500">Not stated</span>}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Financial access</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {accessKeys.map((key) => {
            const value = result.access[key];
            return (
              <li key={key} className={`rounded-xl border p-3 ${AVAILABILITY_STYLES[value]}`}>
                <div className="text-sm font-medium">{ACCESS_LABELS[key]}</div>
                <div className="text-xs">{AVAILABILITY_TEXT[value]}</div>
              </li>
            );
          })}
        </ul>
      </section>

      {result.missing_information.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">We still need to know</h2>
          <p className="mb-2 text-sm text-amber-800">
            LIFELINE never fills these in by guessing. Asking for them gives better routes and baskets.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {result.missing_information.map((field) => (
              <li key={field}>{MISSING_QUESTIONS[field] ?? field}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
