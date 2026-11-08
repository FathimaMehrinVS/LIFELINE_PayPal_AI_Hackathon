"use client";

import { useState } from "react";
import type { CommerceResult, NeedCategory } from "@lifeline/contracts";
import { BasketIcon } from "../../components/icons";
import { api } from "../../services/api";
import { sourceLabel } from "../dashboard/case-row";

// Owner: Member 1. Check what an amount can buy. Cases from New request build their basket automatically.

const categories: NeedCategory[] = ["food", "water", "medicine", "hygiene", "baby_supplies", "clothing", "shelter", "other"];
const currencies = ["EUR", "USD"];
const needLabel = (need: string) => need.replaceAll("_", " ");
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
const inputClass = "w-full rounded-xl border border-slate-300 bg-white p-3 font-normal focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100";

export default function CommercePage() {
  const [needs, setNeeds] = useState<NeedCategory[]>(["food", "water", "hygiene"]);
  const [budget, setBudget] = useState("100");
  const [currency, setCurrency] = useState("EUR");
  const [location, setLocation] = useState("Demo location");
  const [householdSize, setHouseholdSize] = useState("4");
  const [days, setDays] = useState("7");
  const [basket, setBasket] = useState<CommerceResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      setBasket(await api.buildBasket({
        needs,
        budget: Number(budget),
        currency,
        location,
        reserve_ratio: 0.2,
        ...(Number(householdSize) > 0 ? { household_size: Math.floor(Number(householdSize)), days_of_cover: Math.max(1, Math.floor(Number(days) || 7)) } : {}),
      }));
    }
    catch (err) { setBasket(null); setError(err instanceof Error ? err.message : "Could not build basket"); }
    finally { setBusy(false); }
  }

  const toggle = (category: NeedCategory) => setNeeds((list) => (list.includes(category) ? list.filter((item) => item !== category) : [...list, category]));

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-navy p-7 text-white shadow-lg sm:p-9">
        <BasketIcon className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-white/10" />
        <h1 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Essentials planner</h1>
        <p className="relative mt-2 max-w-2xl text-indigo-100">
          See what an amount can buy for a household. Rules keep the total within budget and hold back an emergency reserve.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <fieldset>
          <legend className="mb-3 font-bold text-slate-900">What does the household need?</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const on = needs.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${on ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {needLabel(category)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Budget">
            <input className={inputClass} type="number" min="0.01" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} required />
          </Field>
          <Field label="Currency">
            <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((code) => <option key={code}>{code}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
          </Field>
          <Field label="People">
            <input className={inputClass} type="number" min="1" step="1" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} />
          </Field>
          <Field label="Days to cover">
            <input className={inputClass} type="number" min="1" max="90" step="1" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-100 pt-5">
          <button disabled={busy || needs.length === 0} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none">
            <BasketIcon className="h-5 w-5" /> {busy ? "Building basket…" : "Build basket"}
          </button>
          <span className="text-xs text-slate-500">{needs.length === 0 ? "Pick at least one need." : "Local catalogue prices are illustrative; online prices are estimates."}</span>
        </div>
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      </form>

      {basket && (
        <div className="space-y-5" aria-live="polite">
          <div className="grid gap-4 sm:grid-cols-3">
            <Summary label="Basket total" value={money(basket.total, basket.currency)} highlight />
            <Summary label="Kept as reserve" value={money(basket.reserve, basket.currency)} />
            <Summary label="Needs not covered" value={basket.unmet_needs.length ? basket.unmet_needs.map(needLabel).join(", ") : "None"} />
          </div>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-6 py-4 text-lg font-bold text-slate-900">Suggested items</h2>
            {basket.items.length === 0 && <p className="px-6 py-5 text-slate-600">No suitable products were found for these needs at this budget and currency.</p>}
            <ul className="divide-y divide-slate-100">
              {basket.items.map((item) => (
                <li key={item.product_id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.quantity} × {item.name}</p>
                    <p className="text-sm capitalize text-slate-600">{needLabel(item.category)} · <span className="normal-case">{item.merchant_name}</span></p>
                    <p className="mt-0.5 text-xs text-slate-500">{sourceLabel(item.source)} · {money(item.unit_price, basket.currency)} each ({item.price_label})</p>
                  </div>
                  <strong className="tabular text-slate-900">{money(item.subtotal, basket.currency)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <p className="rounded-2xl bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-950">{basket.explanation}</p>

          {basket.alternatives.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold text-slate-900">Alternatives</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {basket.alternatives.map((item) => (
                  <div key={item.product_id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-slate-600">{item.merchant_name} · {money(item.unit_price, basket.currency)}</p>
                    <p className="text-xs capitalize text-slate-500">{needLabel(item.category)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-800"><span className="mb-1 block">{label}</span>{children}</label>;
}

function Summary({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${highlight ? "bg-indigo-50 ring-1 ring-indigo-100" : "border border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold capitalize ${highlight ? "text-indigo-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
