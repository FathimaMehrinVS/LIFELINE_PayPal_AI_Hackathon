"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CaseResult } from "@lifeline/contracts";
import { ApiRequestError, api } from "@/services/api";

export default function MyRequestsPage() {
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api.listMyCases().then(setCases).catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load your requests.")); }, []);
  return <section className="space-y-6">
    <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Your activity</p><h1 className="mt-2 text-3xl font-extrabold text-slate-950">My requests</h1><p className="mt-2 text-slate-600">Only requests submitted by your account are shown here.</p></div>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900" role="alert">{error}</p>}
    {cases === null && !error && <p className="text-slate-600">Loading your requests…</p>}
    {cases?.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-xl font-bold text-slate-900">No requests yet</h2><p className="mt-2 text-slate-600">When you submit a request while signed in, it will appear here.</p><Link href="/situation" className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">Start a request</Link></div>}
    {!!cases?.length && <div className="grid gap-4">{cases.map((item) => <article key={item.case_id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{item.situation.summary}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{item.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm text-slate-600">{item.situation.location ?? "Location pending"} · {item.situation.needs.join(", ") || "Needs being reviewed"}</p></article>)}</div>}
  </section>;
}
