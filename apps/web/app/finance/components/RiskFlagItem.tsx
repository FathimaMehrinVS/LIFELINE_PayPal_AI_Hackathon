import type { RiskFlag } from "@lifeline/contracts";
import { flagEvidence, formatName } from "../formatters";

export function RiskFlagItem({ flag }: { flag: RiskFlag }) {
  const style = flag.severity === "critical"
    ? "border-rose-200 bg-rose-50"
    : flag.severity === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50";

  return (
    <li className={`rounded-2xl border p-3 ${style}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-800">{formatName(flag.code)}</p>
      <p className="mt-1 text-sm text-slate-700">{flag.message}</p>
      <p className="mt-1 text-xs font-medium text-slate-600">Evidence: {flagEvidence(flag)}</p>
    </li>
  );
}
