"use client";

import type { CaseResult } from "@lifeline/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  BasketIcon,
  BrainIcon,
  CheckIcon,
  CoinsIcon,
  HeartHandIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/icons";
import { api } from "@/services/api";
import { formatMoney, recommendedRoute, routeName } from "../dashboard/case-row";

// Owner: Member 1. Home: what LIFELINE does, and where the latest request stands (real cases only).

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; cases: CaseResult[] };

const NEED_LABELS: Record<string, string> = { baby_supplies: "Baby supplies" };
const needLabel = (n: string) => NEED_LABELS[n] ?? n.charAt(0).toUpperCase() + n.slice(1).replace("_", " ");

export default function HomePage() {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    api
      .listCases()
      .then((cases) => setLoad({ state: "ready", cases }))
      .catch(() => setLoad({ state: "error" }));
  }, []);

  const cases = load.state === "ready" ? load.cases : [];
  const latest = cases[0] ?? null;

  return (
    <div className="space-y-6">
      <Hero />
      <HowItWorks />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr_1fr]">
        <Journey latest={latest} load={load} />
        <Summary latest={latest} />
        <Insights latest={latest} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Impact cases={cases} load={load} />
        <PayPalCard />
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-navy text-white shadow-lg">
      <div className="grid items-center gap-6 p-8 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10 space-y-5">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Emergency support.
            <br />
            Made smarter with AI.
          </h1>
          <p className="max-w-md text-lg text-indigo-100">
            Describe the situation and let LIFELINE find the best help: safely, quickly and fairly.
          </p>
          <Link
            href="/situation"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50"
          >
            Start new request <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}

/** Help travelling along a route to a family: a globe, a path and a heart. Drawn, not a photo. */
function HeroArt() {
  return (
    <svg viewBox="0 0 420 260" className="h-auto w-full max-w-lg justify-self-end" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#85ABE6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#85ABE6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="250" cy="130" r="125" fill="url(#glow)" />
      <g fill="none" stroke="#B5CDF1" strokeOpacity="0.35" strokeWidth="1.2">
        <circle cx="250" cy="130" r="95" />
        <ellipse cx="250" cy="130" rx="45" ry="95" />
        <ellipse cx="250" cy="130" rx="80" ry="95" />
        <path d="M155 130h190M165 85h170M165 175h170" />
      </g>
      <path d="M60 205C120 120 190 210 250 130S360 60 390 70" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="60" cy="205" r="9" fill="#fff" />
      <circle cx="60" cy="205" r="16" fill="#fff" fillOpacity="0.2" />
      <g transform="translate(250 130)">
        <circle r="26" fill="#fff" />
        <path d="M0 9s-11-6.6-11-14.2A6.4 6.4 0 0 1 0-9.5a6.4 6.4 0 0 1 11 4.3C11 2.4 0 9 0 9Z" fill="#D64545" />
      </g>
      <g transform="translate(372 52)">
        <rect x="-26" y="-20" width="52" height="40" rx="10" fill="#22A06B" />
        <path d="m-10 0 6 6 13-13" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="#fff" fillOpacity="0.85" fontFamily="inherit" fontSize="12" fontWeight="600">
        <text x="40" y="236">Sender abroad</text>
        <text x="216" y="182">Family</text>
        <text x="330" y="96">Approved</text>
      </g>
    </svg>
  );
}

const STEPS = [
  { n: 1, title: "Understand", text: "AI reads the situation and marks what it doesn't know.", Icon: BrainIcon, tone: "bg-indigo-50 text-indigo-600" },
  { n: 2, title: "Plan", text: "We find the payment route and essentials that really work.", Icon: ShieldCheckIcon, tone: "bg-emerald-50 text-emerald-600" },
  { n: 3, title: "Support", text: "An NGO approves, and help is paid through PayPal.", Icon: HeartHandIcon, tone: "bg-sky-50 text-sky-600" },
];

function HowItWorks() {
  return (
    <Card className="p-4 sm:p-5">
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ n, title, text, Icon, tone }, i) => (
          <li key={n} className="flex items-center gap-4">
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">{n}</span>
                {title}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">{text}</p>
            </div>
            {i < STEPS.length - 1 && <span className="hidden text-2xl text-slate-300 md:block" aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

type StepState = "done" | "current" | "todo";

function journeySteps(c: CaseResult | null): { label: string; state: StepState }[] {
  if (!c) return ["Situation analysed", "Route confirmed", "Basket ready", "Awaiting approval"].map((label) => ({ label, state: "todo" as const }));
  const routed = Boolean(c.finance?.recommended_route_id);
  const basket = Boolean(c.commerce);
  return [
    { label: "Situation analysed", state: "done" },
    { label: "Route confirmed", state: routed ? "done" : "current" },
    { label: "Basket ready", state: basket ? "done" : routed ? "current" : "todo" },
    { label: "Awaiting approval", state: c.status === "complete" ? "current" : "todo" },
  ];
}

function Journey({ latest, load }: { latest: CaseResult | null; load: Load }) {
  const steps = journeySteps(latest);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Latest request</h2>
        <Link href="/dashboard" className="flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
          View all <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <ol className="mt-6 grid grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.label} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${step.state === "todo" ? "bg-slate-200" : "bg-emerald-400"}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                step.state === "done"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : step.state === "current"
                    ? "border-indigo-600 bg-white ring-4 ring-indigo-100"
                    : "border-slate-300 bg-white"
              }`}
            >
              {step.state === "done" && <CheckIcon className="h-4 w-4" />}
              {step.state === "current" && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
            </span>
            <span className={`mt-2 text-xs font-medium ${step.state === "todo" ? "text-slate-400" : step.state === "current" ? "text-indigo-700" : "text-slate-800"}`}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <JourneyMessage latest={latest} load={load} />
      </div>
    </Card>
  );
}

function JourneyMessage({ latest, load }: { latest: CaseResult | null; load: Load }) {
  if (load.state === "loading") return <p className="text-sm text-slate-500">Loading the latest request…</p>;
  if (load.state === "error") {
    return <Notice tone="slate" title="Can't reach LIFELINE right now" text="Start the API with npm run dev:api, then refresh." />;
  }
  if (!latest) {
    return <Notice tone="indigo" title="No requests yet" text="Describe a situation to start the first one." href="/situation" cta="Start new request" />;
  }
  if (latest.status === "complete") {
    return <Notice tone="emerald" title="Ready for review" text="A route and basket are prepared. An NGO approves before anything is paid." href="/dashboard" cta="Open dashboard" />;
  }
  if (latest.status === "needs_information") {
    return <Notice tone="amber" title="A few answers needed" text="LIFELINE won't guess. Answer the open questions to find a route." href="/situation" cta="Add details" />;
  }
  return <Notice tone="slate" title="No safe route yet" text="An NGO worker can look at other options for this case." href="/dashboard" cta="Open dashboard" />;
}

const NOTICE_TONES = {
  emerald: { box: "bg-emerald-50 text-emerald-900", badge: "bg-emerald-500", symbol: "✓" },
  amber: { box: "bg-amber-50 text-amber-900", badge: "bg-amber-400", symbol: "?" },
  indigo: { box: "bg-indigo-50 text-indigo-900", badge: "bg-indigo-600", symbol: "+" },
  slate: { box: "bg-slate-100 text-slate-800", badge: "bg-slate-500", symbol: "!" },
};

function Notice({ tone, title, text, href, cta }: { tone: keyof typeof NOTICE_TONES; title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className={`flex items-start gap-4 rounded-2xl p-4 ${NOTICE_TONES[tone].box}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${NOTICE_TONES[tone].badge}`} aria-hidden="true">
        {NOTICE_TONES[tone].symbol}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm opacity-90">{text}</p>
        {href && cta && (
          <Link href={href} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
            {cta} <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

const URGENCY_BADGE = {
  low: "border-slate-300 text-slate-600",
  medium: "border-indigo-300 text-indigo-700",
  high: "border-amber-400 text-amber-700",
  critical: "border-red-400 text-red-600",
};

function Summary({ latest }: { latest: CaseResult | null }) {
  const s = latest?.situation;
  const route = latest ? recommendedRoute(latest) : null;
  const commerce = latest?.commerce;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900">Request summary</h2>
        {s && <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${URGENCY_BADGE[s.urgency]}`}>{s.urgency}</span>}
      </div>

      <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-2 text-sm">
        <dt className="text-slate-500">Needs</dt>
        <dd className="font-medium text-slate-900">{s && s.needs.length > 0 ? s.needs.map(needLabel).join(", ") : "—"}</dd>
        <dt className="text-slate-500">Budget</dt>
        <dd className="tabular font-medium text-slate-900">{s?.budget != null ? formatMoney(s.budget, s.currency) : "—"}</dd>
        <dt className="text-slate-500">Location</dt>
        <dd className="font-medium text-slate-900">{s?.location ?? "—"}</dd>
      </dl>

      <h3 className="mt-5 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-800">Recommended options</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Option
          Icon={RouteIcon}
          tone="bg-emerald-50 text-emerald-600"
          title="Payment route"
          value={route ? routeName(route.route_id) : "Not yet"}
          note={route && latest?.finance ? `${formatMoney(route.usable_value, latest.finance.currency)} arrives` : undefined}
        />
        <Option
          Icon={BasketIcon}
          tone="bg-amber-50 text-amber-600"
          title="Essentials"
          value={commerce ? formatMoney(commerce.total, commerce.currency) : "Not yet"}
          note={commerce ? `${commerce.items.length} items` : undefined}
        />
      </div>

      <Link
        href={latest ? "/dashboard" : "/situation"}
        className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
      >
        {latest ? "Review & approve" : "Start new request"} <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </Card>
  );
}

function Option({ Icon, tone, title, value, note }: { Icon: (p: { className?: string }) => React.ReactNode; tone: string; title: string; value: string; note?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="truncate text-slate-700">{value}</p>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
    </div>
  );
}

function Insights({ latest }: { latest: CaseResult | null }) {
  const items = [
    {
      title: "Situation insight",
      Icon: BrainIcon,
      tone: "bg-indigo-50 text-indigo-600",
      text: latest?.situation.summary,
    },
    {
      title: "Financial insight",
      Icon: RouteIcon,
      tone: "bg-emerald-50 text-emerald-600",
      text: latest?.finance?.explanation,
    },
    {
      title: "Essentials insight",
      Icon: BasketIcon,
      tone: "bg-amber-50 text-amber-600",
      text: latest?.commerce
        ? latest.commerce.items.length > 0
          ? `Suggested: ${latest.commerce.items.map((i) => i.name).join(", ")}. ${formatMoney(latest.commerce.reserve, latest.commerce.currency)} kept as reserve.`
          : "No products found for these needs yet."
        : undefined,
    },
  ];
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <SparkleIcon className="h-5 w-5 text-indigo-500" /> AI insights
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map(({ title, Icon, tone, text }) => (
          <li key={title} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-indigo-700">{title}</p>
              <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">{text ?? "Appears after the next request is analysed."}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Impact({ cases, load }: { cases: CaseResult[]; load: Load }) {
  const ready = cases.filter((c) => c.status === "complete");
  // Money that reaches families after fees, per currency (never added across currencies).
  const arriving = new Map<string, number>();
  for (const c of ready) {
    const route = recommendedRoute(c);
    if (route && c.finance) arriving.set(c.finance.currency, (arriving.get(c.finance.currency) ?? 0) + route.usable_value);
  }
  const [mainCurrency, mainAmount] = [...arriving.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["EUR", 0];
  const dash = load.state !== "ready";

  const stats = [
    { Icon: UsersIcon, tone: "bg-indigo-50 text-indigo-600", value: dash ? "—" : String(cases.length), label: "Requests received" },
    { Icon: ShieldCheckIcon, tone: "bg-emerald-50 text-emerald-600", value: dash ? "—" : String(ready.length), label: "Ready for approval" },
    {
      Icon: CoinsIcon,
      tone: "bg-sky-50 text-sky-600",
      value: dash ? "—" : formatMoney(mainAmount, mainCurrency),
      label: arriving.size > 1 ? "Reaches families (+ other currencies)" : "Reaches families after fees",
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900">Impact so far</h2>
        <span className="text-xs text-slate-500">Live from this demo&apos;s cases</span>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {stats.map(({ Icon, tone, value, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="tabular text-2xl font-extrabold text-slate-900">{value}</p>
              <p className="text-sm text-slate-600">{label}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PayPalCard() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-lg">
      <ShieldCheckIcon className="absolute -right-3 -top-3 h-28 w-28 text-white/10" />
      <p className="text-2xl font-extrabold italic tracking-tight">PayPal Sandbox</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-indigo-200">Secure · Approved · Traceable</p>
      <p className="mt-3 text-sm text-indigo-100">
        Donations are captured through PayPal. Nothing is paid out until an NGO approves the case.
      </p>
      <Link href="/donate" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white underline-offset-4 hover:underline">
        Support a family <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  );
}
