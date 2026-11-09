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

export const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-navy placeholder:text-slate-500 focus:border-2 focus:border-teal focus:px-[13px] focus:py-[9px] focus:outline-none";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</section>;
}

export function Overline({ children, className = "text-teal-text" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-bold uppercase tracking-[0.08em] ${className}`}>{children}</p>;
}

/** Added to a field that failed validation. */
export const fieldErrorClass = "border-critical bg-critical-tint/30 focus:border-critical";

/** In-line validation text: Critical red with an icon, never colour alone. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold text-critical">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16.5h.01" /></svg>
      <span>{children}</span>
    </p>
  );
}

/** Shown when a list has nothing to display, with a way forward. */
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </span>
      <h2 className="mt-3 font-bold text-navy">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

/** A full-width banner with an icon, used for rules a reviewer must keep in mind. */
export function Notice({ tone, children, className = "" }: { tone: "warning" | "info"; children: ReactNode; className?: string }) {
  const style = tone === "warning" ? "border-accent/50 bg-warning-tint text-warning" : "border-teal/30 bg-teal-tint/60 text-navy";
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${style} ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tone === "warning"
          ? <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>
          : <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>}
      </svg>
      <p>{children}</p>
    </div>
  );
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
