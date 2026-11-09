"use client";

import type { CaseResult } from "@lifeline/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, BasketIcon, BrainIcon, CheckIcon, CoinsIcon, HeartHandIcon, RouteIcon, ShieldCheckIcon, UsersIcon } from "@/components/icons";
import { Badge, Overline, button } from "@/components/ui";
import { api } from "@/services/api";

// Owner: Member 1. Public home, styled from "LIFELINE Screen Designs" pages 2-3. Any figures are real.

const JOURNEY = [
  { title: "Family report", text: "Needs described by text, voice or taps", who: "Family or NGO", Icon: UsersIcon },
  { title: "AI assessment", text: "Needs, urgency and missing details", who: "AI", Icon: BrainIcon },
  { title: "NGO approval", text: "A person checks and approves the plan", who: "NGO", Icon: ShieldCheckIcon },
  { title: "Funding", text: "Donors fund the approved plan", who: "Donor", Icon: HeartHandIcon },
  { title: "Delivery", text: "Recorded step by step until received", who: "Partner", Icon: BasketIcon },
];

const DIFFERENT = [
  { title: "AI-powered needs assessment", text: "People describe their situation in their own words. LIFELINE structures the needs, flags urgency and asks only what's missing, and never guesses.", Icon: BrainIcon },
  { title: "Rules before money", text: "Fees, budgets and approvals are decided by plain rules, not by AI. An AI can explain a result but can never change it.", Icon: RouteIcon },
  { title: "Transparent payments", text: "Donations, supplier payments and delivery are recorded separately, so nobody mistakes money received for aid delivered.", Icon: CoinsIcon },
];

const STEPS = [
  { title: "Report a need", text: "A family, a volunteer or an NGO worker describes the situation by text, taps or voice, in their language." },
  { title: "Assess & approve", text: "AI structures the request, rules check how money can reach the family, and NGO staff approve the plan." },
  { title: "Plan & fund", text: "An itemised basket becomes an approved aid plan that donors can fund through PayPal Sandbox." },
  { title: "Deliver & confirm", text: "The supplier is paid as a separate step, and goods are recorded until the family has received them." },
];

const TRUST = [
  { title: "Donation ≠ supplier payment", text: "A captured donation never marks a supplier as paid. Each is its own record." },
  { title: "No early ticks", text: "A later stage is shown as pending until someone has actually recorded it." },
  { title: "Privacy by default", text: "Donors see anonymised summaries. Names and addresses stay with the NGO." },
  { title: "AI never decides who gets aid", text: "AI organises information and flags urgency. A person approves every allocation." },
];

export default function HomePage() {
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  useEffect(() => {
    api.listCases().then(setCases).catch(() => setCases(null));
  }, []);

  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-100">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <Badge tone="info">Humanitarian operations platform</Badge>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-navy sm:text-[48px]">From emergency report to verified aid delivery.</h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">LIFELINE turns a report of need into a checked, costed plan that an NGO approves and donors can fund.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/situation" className={button.primary}>Request Assistance <ArrowRightIcon className="h-4 w-4" /></Link>
              <Link href="/donate" className={button.secondary}>Explore Approved Aid Plans</Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-600">
              {["No payment needed to request help", "An NGO approves every plan", "AI never decides who gets aid"].map((point) => (
                <li key={point} className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-teal-text" /> {point}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
            <p className="text-[13px] font-semibold text-navy">Assistance journey</p>
            <ol className="mt-4">
              {JOURNEY.map(({ title, text, who, Icon }, index) => (
                <li key={title} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  {index < JOURNEY.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-36px)] w-px bg-teal/50" aria-hidden="true" />}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal-text"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{title}</p>
                    <p className="text-xs text-slate-500">{text}</p>
                  </div>
                  <Badge tone="neutral">{who}</Badge>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] space-y-16 px-4 py-16 sm:px-6">
        <section>
          <Overline>What makes it different</Overline>
          <h2 className="mt-1 text-[28px] font-bold text-navy">Built for accountability at every step</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {DIFFERENT.map(({ title, text, Icon }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-tint text-teal-text"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-lg font-semibold text-navy">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how">
          <Overline>How LIFELINE works</Overline>
          <h2 className="mt-1 text-[28px] font-bold text-navy">Four steps, each one recorded</h2>
          <ol className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ title, text }, index) => (
              <li key={title} className="border-t-2 border-navy pt-4">
                <p className="text-xs font-bold text-teal-text">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 font-semibold text-navy">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {cases && cases.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[28px] font-bold text-navy">So far</h2>
              <Badge tone="warning">Live from this demo</Badge>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Cases recorded", value: cases.length },
                { label: "Plans ready for NGO approval", value: cases.filter((c) => c.status === "complete").length },
                { label: "Urgent cases", value: cases.filter((c) => c.situation.urgency === "high" || c.situation.urgency === "critical").length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-5">
                  <dd className="tabular text-3xl font-extrabold text-navy">{value}</dd>
                  <dt className="text-sm text-slate-600">{label}</dt>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <Overline className="text-accent">Trust &amp; accountability</Overline>
            <h2 className="mt-2 text-3xl font-bold leading-tight">We record what actually happened, never what we hope happened.</h2>
            <p className="mt-3 text-slate-300">Later stages are never marked complete automatically.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {TRUST.map(({ title, text }) => (
              <article key={title} className="rounded-xl border border-white/15 bg-slate-800 p-5">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1200px] gap-5 px-4 py-16 sm:px-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-7">
          <Overline>For NGOs</Overline>
          <h2 className="mt-1 text-2xl font-bold text-navy">Run assistance like an operations team</h2>
          <p className="mt-2 text-sm text-slate-600">Triage cases, check routes and baskets, and approve aid in one workspace.</p>
          <Link href="/dashboard" className={`${button.primary} mt-5`}>Open NGO workspace</Link>
        </article>
        <article className="rounded-2xl border border-teal/30 bg-teal-tint p-7">
          <Overline>For donors</Overline>
          <h2 className="mt-1 text-2xl font-bold text-navy">Fund assistance with a clear destination</h2>
          <p className="mt-2 text-sm text-slate-600">Support a plan an NGO has already approved, and see what it buys.</p>
          <Link href="/donate" className={`${button.confirm} mt-5`}>Explore approved aid plans</Link>
        </article>
      </div>
    </div>
  );
}
