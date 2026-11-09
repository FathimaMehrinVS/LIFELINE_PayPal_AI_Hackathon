import type { ReactNode } from "react";

// Shared pieces from page 1 of "LIFELINE Screen Designs".

export type BadgeTone = "success" | "warning" | "critical" | "neutral" | "info" | "simulated" | "ai" | "human";

const BADGE_TONES: Record<BadgeTone, string> = {
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  critical: "bg-critical-tint text-critical",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-teal-tint text-teal-text",
  simulated: "border border-dashed border-simulated bg-simulated-tint text-simulated",
  ai: "border border-teal bg-white text-teal-text",
  human: "bg-navy text-white",
};

export function Badge({ tone, children, className = "" }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]} ${className}`}>{children}</span>;
}

const BASE_BUTTON = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${BASE_BUTTON} bg-navy text-white hover:opacity-90`,
  confirm: `${BASE_BUTTON} bg-teal-text text-white hover:opacity-90`,
  secondary: `${BASE_BUTTON} border border-slate-300 bg-white text-navy hover:bg-slate-50`,
  destructive: `${BASE_BUTTON} border border-critical/30 bg-white text-critical hover:bg-critical-tint`,
};

export const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-navy placeholder:text-slate-400 focus:border-2 focus:border-teal focus:px-[13px] focus:py-[9px] focus:outline-none";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</section>;
}

export function Overline({ children, className = "text-teal-text" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-bold uppercase tracking-[0.08em] ${className}`}>{children}</p>;
}

/** Always labelled as AI output, per the design system. */
export function AiPanel({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-teal/30 bg-teal-tint/50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold text-navy">{title}</h2>
        <Badge tone="ai">{label}</Badge>
      </div>
      <div className="mt-2 text-slate-800">{children}</div>
    </section>
  );
}

/** A radio-style pill or tile. */
export function Choice({ selected, onClick, children, className = "", tone = "default" }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string; tone?: "default" | "critical" }) {
  const off = tone === "critical" ? "border-critical/30 text-critical" : "border-slate-300 text-navy";
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={`inline-flex items-center gap-2.5 border bg-white text-left text-sm font-medium transition ${selected ? "border-2 border-navy bg-slate-100 text-navy" : `${off} hover:bg-slate-50`} ${className}`}>
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-teal-text" : "border-slate-400"}`} aria-hidden="true">
        {selected && <span className="h-2 w-2 rounded-full bg-teal-text" />}
      </span>
      {children}
    </button>
  );
}
