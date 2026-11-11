"use client";

import { useState } from "react";
import type { CaseResult, CommerceResult, NeedCategory } from "@lifeline/contracts";
import { BasketIcon, CheckIcon } from "@/components/icons";
import { Badge, fieldClass } from "@/components/ui";
import { api } from "@/services/api";
import { caseRef, formatMoney, recommendedRoute, routeName, sourceLabel } from "../dashboard/case-row";
import { CasePicker, useSelectedCase } from "../dashboard/use-cases";

// Owner: Member 1. A case's basket, styled from "LIFELINE Screen Designs" page 13, and a quick planner for trying amounts.

const categories: NeedCategory[] = ["food", "water", "medicine", "hygiene", "baby_supplies", "clothing", "shelter", "other"];
const currencies = ["EUR", "USD"];
const needLabel = (need: string) => need.replaceAll("_", " ");
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
const hasBasket = (item: CaseResult) => item.commerce !== null;
const inputClass = "w-full rounded-xl border border-slate-300 bg-white p-3 font-normal focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100";

export default function ProductBasketsPage() {
  const { cases, selected, setSelectedId, error } = useSelectedCase(hasBasket);
  const [tab, setTab] = useState<"case" | "planner">("case");
  const showPlanner = tab === "planner" || cases?.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Basket view">
          {([["case", "Case baskets"], ["planner", "Quick planner"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === value ? "bg-white text-navy shadow-sm" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>
        {!showPlanner && cases && selected && <CasePicker cases={cases} value={selected.case_id} onChange={setSelectedId} />}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      <div className="mt-4">
        {showPlanner ? <QuickPlanner /> : selected ? <CaseBasket item={selected} /> : !error && <p className="text-slate-600">Loading…</p>}
      </div>
    </div>
  );
}

const CHIPS = ["all", "food", "water", "medicine", "hygiene", "shelter", "baby_supplies", "clothing", "other"];

function CaseBasket({ item }: { item: CaseResult }) {
  const [chip, setChip] = useState("all");
  const [search, setSearch] = useState("");
  const commerce = item.commerce!;
  const route = recommendedRoute(item);
  const fee = route?.estimated_fee ?? 0;
  const budget = item.situation.budget ?? commerce.total + commerce.reserve;
  const totalCost = Math.round((commerce.total + fee) * 100) / 100;
  const chips = CHIPS.filter((value) => value === "all" || [...commerce.items, ...commerce.alternatives].some((product) => product.category === value));
  const products = [...commerce.items.map((product) => ({ product, inBasket: true })), ...commerce.alternatives.map((product) => ({ product, inBasket: false }))]
    .filter(({ product }) => (chip === "all" || product.category === chip) && product.name.toLowerCase().includes(search.trim().toLowerCase()));
  const money = (value: number) => formatMoney(value, commerce.currency);

  return (
    <div>
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Case needs · <span className="font-mono">{caseRef(item.case_id)}</span></p>
          <h1 className="text-lg font-bold text-navy">{item.situation.summary}</h1>
          {route && <p className="mt-1 text-sm text-slate-600">Route: <strong className="text-navy">{routeName(route.route_id)}</strong></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.situation.needs.map((need) => {
            const unmet = commerce.unmet_needs.includes(need);
            return <span key={need} className={`rounded-md px-2.5 py-1 text-sm font-semibold capitalize ${unmet ? "bg-warning-tint text-warning" : "bg-success-tint text-success"}`}>{unmet ? needLabel(need) + " · not covered" : <span className="inline-flex items-center gap-1"><CheckIcon className="h-3.5 w-3.5" />{needLabel(need)}</span>}</span>;
          })}
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className={`${fieldClass} max-w-xs`} />
            {chips.map((value) => <button key={value} type="button" aria-pressed={chip === value} onClick={() => setChip(value)} className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${chip === value ? "bg-navy text-white" : "border border-slate-300 bg-white text-navy hover:bg-slate-50"}`}>{value === "all" ? "All" : needLabel(value)}</button>)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {products.map(({ product, inBasket }) => (
              <article key={`${product.product_id}-${inBasket}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex h-24 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><BasketIcon className="h-9 w-9" /></div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <h2 className="font-bold text-navy">{product.name}</h2>
                  <p className="tabular font-bold text-navy">{money(product.unit_price)}</p>
                </div>
                <p className="text-sm text-slate-600">{product.merchant_name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={inBasket ? "success" : "warning"}>{inBasket ? "Suggested" : "Alternative"}</Badge>
                  <Badge tone="neutral">{product.source === "channel3" ? "External · not verified" : "Synthetic demo"}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Quantity <strong className="tabular text-navy">{inBasket ? product.quantity : 0}</strong></span>
                  {inBasket && <span className="rounded-lg border border-teal/30 bg-teal-tint px-3 py-1.5 font-semibold text-teal-text">In basket</span>}
                </div>
              </article>
            ))}
            {products.length === 0 && <p className="text-slate-600">No products match this filter.</p>}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-navy">Assistance basket</h2><Badge tone="neutral">Draft</Badge></div>
          <ul className="mt-3 divide-y divide-slate-100">
            {commerce.items.map((product) => (
              <li key={product.product_id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <span><strong className="text-navy">{product.name}</strong><span className="block text-slate-600">{product.quantity} × {money(product.unit_price)}</span></span>
                <strong className="tabular text-navy">{money(product.subtotal)}</strong>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600"><dt>Items subtotal</dt><dd className="tabular">{money(commerce.total)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Payment fees (est.)</dt><dd className="tabular">{money(fee)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-navy"><dt>Total estimated</dt><dd className="tabular">{money(totalCost)}</dd></div>
          </dl>
          <div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-teal" style={{ width: `${Math.min(100, budget > 0 ? (totalCost / budget) * 100 : 0)}%` }} /></div>
          <div className="mt-1.5 flex justify-between text-sm"><span className="text-slate-600">Budget {money(budget)}</span><span className="font-semibold text-success">Reserve {money(commerce.reserve)}</span></div>
          {commerce.unmet_needs.length > 0 && <p className="mt-3 rounded-lg bg-warning-tint p-3 text-sm text-warning"><strong className="capitalize">{commerce.unmet_needs.map(needLabel).join(", ")}</strong> not covered yet.</p>}
          <p className="mt-3 text-[13px] text-slate-600">Local catalogue prices are illustrative and online prices are estimates. Stock isn't guaranteed until a supplier accepts an order.</p>
        </aside>
      </div>
    </div>
  );
}

function QuickPlanner() {
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
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
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
                  className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${on ? "bg-navy text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
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
          <button disabled={busy || needs.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-navy px-6 py-2.5 font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
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

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
