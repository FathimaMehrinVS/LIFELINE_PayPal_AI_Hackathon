import type { DonorPlan, PlanStep, Urgency } from "@lifeline/contracts";
import { Badge, type BadgeTone } from "@/components/ui";

// Owner: Member 1. Shared pieces of the donor pages, styled from "LIFELINE Screen Designs" pages 22, 23 and 26.

const URGENCY: Record<Urgency, { label: string; tone: BadgeTone }> = {
  critical: { label: "Critical urgency", tone: "critical" },
  high: { label: "High urgency", tone: "critical" },
  medium: { label: "Medium urgency", tone: "warning" },
  low: { label: "Standard urgency", tone: "neutral" },
};

export const URGENCY_ORDER: Record<Urgency, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <Badge tone={URGENCY[urgency].tone}>{URGENCY[urgency].label}</Badge>;
}

export const needLabel = (need: string) => {
  const text = need.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function FundingBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-teal" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function donateHref(plan: DonorPlan): string {
  const params = new URLSearchParams({ allocation_id: plan.plan_id, case_id: plan.case_id, amount: plan.funding.remaining.toFixed(2), currency: plan.currency });
  return `/donate?${params.toString()}`;
}

export const STEP_STATE: Record<PlanStep["state"], { label: string; tone: BadgeTone }> = {
  complete: { label: "Complete", tone: "success" },
  in_progress: { label: "In progress", tone: "info" },
  not_recorded: { label: "Not yet recorded", tone: "neutral" },
  issue: { label: "Problem reported", tone: "critical" },
};

export const PRIVACY_NOTE = "Plans describe needs only. Names, documents, photos and addresses are never shown to donors.";
