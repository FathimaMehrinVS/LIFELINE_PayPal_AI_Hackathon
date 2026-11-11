"use client";

import type { CaseResult } from "@lifeline/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, type BadgeTone, Card, Overline, button } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";
import { caseRef } from "../dashboard/case-row";
import { Pager, usePaged } from "@/components/pager";

const STATUS: Record<CaseResult["status"], { label: string; tone: BadgeTone }> = {
  complete: { label: "Reviewed", tone: "success" },
  needs_information: { label: "Needs information", tone: "warning" },
  no_usable_route: { label: "No route found yet", tone: "critical" },
};

export default function MyRequestsPage() {
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  const [error, setError] = useState("");
  const requestPage = usePaged(cases ?? [], 10);
  useEffect(() => {
    api.listMyCases().then(setCases).catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load your requests."));
  }, []);
  return (
    <section className="space-y-5">
      <div>
        <Overline>Your activity</Overline>
        <h1 className="mt-1 text-[28px] font-bold text-navy">My requests</h1>
        <p className="mt-1 text-slate-600">Only requests submitted by your account are shown here.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {cases === null && !error && <p className="text-slate-600">Loading your requests…</p>}
      {cases?.length === 0 && (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-bold text-navy">No requests yet</h2>
          <p className="mt-1 text-sm text-slate-600">When you submit a request while signed in, it will appear here.</p>
          <Link href="/situation" className={`${button.primary} mt-4`}>Start a request</Link>
        </Card>
      )}
      {!!cases?.length && (
        <div className="grid gap-4">
          {requestPage.pageItems.map((item) => (
            <Card key={item.case_id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[13px] font-bold text-teal-text">{caseRef(item.case_id)}</span>
                <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
              </div>
              <h2 className="mt-2 font-bold text-navy">{item.situation.summary}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.situation.location ?? "Location pending"} · {item.situation.needs.join(", ").replaceAll("_", " ") || "Needs being reviewed"}</p>
            </Card>
          ))}
          <Pager paged={requestPage} label="Requests" />
        </div>
      )}
    </section>
  );
}
