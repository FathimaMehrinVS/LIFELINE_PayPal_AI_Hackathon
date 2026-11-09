import type { SupplierStatus } from "@lifeline/contracts";
import type { BadgeTone } from "@/components/ui";

export const STATUS_LABEL: Record<SupplierStatus, string> = { approved: "Approved", pending: "Pending", suspended: "Suspended" };
export const STATUS_TONE: Record<SupplierStatus, BadgeTone> = { approved: "success", pending: "warning", suspended: "critical" };

export function needName(need: string) {
  const text = need.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function shortDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}
