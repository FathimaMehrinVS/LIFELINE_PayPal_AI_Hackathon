"use client";

import { useState } from "react";
import type { CommerceResult, NeedCategory } from "@lifeline/contracts";
import { api } from "../../services/api";

const categories: NeedCategory[] = ["food", "water", "medicine", "hygiene", "baby_supplies", "clothing", "shelter", "other"];
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

export default function CommercePage() {
  const [needs, setNeeds] = useState<NeedCategory[]>(["food", "water", "hygiene"]);
  const [budget, setBudget] = useState("100");
  const [location, setLocation] = useState("Demo location");
  const [basket, setBasket] = useState<CommerceResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { setBasket(await api.buildBasket({ needs, budget: Number(budget), currency: "EUR", location, reserve_ratio: 0.2 })); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not build basket"); }
    finally { setBusy(false); }
  }

  return <section className="space-y-6">
    <div><h1 className="text-2xl font-bold">Essentials basket</h1><p className="text-slate-600">Product prices in the local demo registry are illustrative.</p></div>
    <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
      <label className="grid gap-1 text-sm">Spendable budget (EUR)<input className="rounded border p-2" type="number" min="0.01" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} required /></label>
      <label className="grid gap-1 text-sm">Location<input className="rounded border p-2" value={location} onChange={(e) => setLocation(e.target.value)} required /></label>
      <fieldset className="md:col-span-2"><legend className="mb-2 text-sm font-medium">Needs</legend><div className="flex flex-wrap gap-3">{categories.map((category) => <label key={category} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={needs.includes(category)} onChange={(event) => setNeeds(event.target.checked ? [...needs, category] : needs.filter((item) => item !== category))} />{category.replaceAll("_", " ")}</label>)}</div></fieldset>
      <button disabled={busy || needs.length === 0} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50 md:col-span-2">{busy ? "Building basket…" : "Build basket"}</button>
      {error && <p role="alert" className="text-red-700 md:col-span-2">{error}</p>}
    </form>
    {basket && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3"><Summary label="Basket total" value={money(basket.total, basket.currency)} /><Summary label="Remaining reserve" value={money(basket.reserve, basket.currency)} /><Summary label="Needs not covered" value={basket.unmet_needs.length ? basket.unmet_needs.join(", ") : "None"} /></div>
      <div className="space-y-3">{basket.items.map((item) => <article key={item.product_id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white p-4"><div><h2 className="font-semibold">{item.name} <span className="text-sm font-normal text-slate-500">× {item.quantity}</span></h2><p className="text-sm text-slate-600">{item.merchant_name} · {item.category.replaceAll("_", " ")} · {item.source === "local_registry" ? "synthetic local demo" : "Channel3 estimate"}</p><p className="text-xs text-slate-500">Unit price: {money(item.unit_price, basket.currency)} ({item.price_label})</p></div><strong>{money(item.subtotal, basket.currency)}</strong></article>)}</div>
      <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950">{basket.explanation}</p>
      {!!basket.alternatives.length && <section><h2 className="mb-2 font-semibold">Alternatives</h2><div className="grid gap-2 sm:grid-cols-2">{basket.alternatives.map((item) => <div key={item.product_id} className="rounded-lg border bg-white p-3 text-sm"><strong>{item.name}</strong><p>{item.merchant_name} · {money(item.unit_price, basket.currency)} · {item.category.replaceAll("_", " ")}</p></div>)}</div></section>}
    </div>}
  </section>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
