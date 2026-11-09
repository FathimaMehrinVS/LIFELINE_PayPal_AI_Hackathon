"use client";

import type { CaseResult } from "@lifeline/contracts";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/components/auth-session";
import { fieldClass } from "@/components/ui";
import { api } from "@/services/api";
import { caseRef } from "./case-row";

/** Cases this account may see, with one selected: `?case=<id>` if given, otherwise the newest that qualifies. */
export function useSelectedCase(qualifies: (item: CaseResult) => boolean) {
  const profile = useAuthProfile();
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (profile.role === "NGO" ? api.listCases() : api.listMyCases())
      .then((rows) => {
        const usable = rows.filter(qualifies);
        const requested = new URLSearchParams(window.location.search).get("case");
        setCases(usable);
        setSelectedId(usable.find((item) => item.case_id === requested)?.case_id ?? usable[0]?.case_id ?? null);
      })
      .catch(() => setError("Can't load cases. Please check your connection and try again."));
    // `qualifies` is a fixed test for each page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.role]);

  return { cases, selected: cases?.find((item) => item.case_id === selectedId) ?? null, setSelectedId, error };
}

export function CasePicker({ cases, value, onChange }: { cases: CaseResult[]; value: string | undefined; onChange: (id: string) => void }) {
  return (
    <label className="block min-w-64 text-sm font-bold text-navy">
      <span className="sr-only">Case</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        {cases.map((item) => <option key={item.case_id} value={item.case_id}>{caseRef(item.case_id)} · {item.situation.location ?? "Location not stated"}</option>)}
      </select>
    </label>
  );
}
