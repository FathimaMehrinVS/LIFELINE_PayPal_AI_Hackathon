"use client";

import type { AuditEntry, AuditRecords, Incident } from "@lifeline/contracts";
import { useEffect, useMemo, useState } from "react";
import { Badge, type BadgeTone, Card } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";

// Owner: Member 1. Styled from "LIFELINE Screen Designs" page 19. Shows the latest entries in the audit table.

const FILTERS: { key: AuditEntry["category"] | "all"; label: string }[] = [
  { key: "all", label: "All events" },
  { key: "case", label: "Cases" },
  { key: "approval", label: "Approvals" },
  { key: "payment", label: "Payments" },
  { key: "supplier", label: "Supplier verification" },
  { key: "other", label: "Other" },
];
const SEVERITY: Record<Incident["severity"], BadgeTone> = { low: "neutral", medium: "warning", high: "critical" };
const timestamp = (iso: string) => iso.replace("T", " ").slice(0, 19);
const eventRef = (id: string) => `EV-${id.slice(-6).toUpperCase()}`;
const TH = "whitespace-nowrap px-4 py-2 font-semibold";

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecords | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAuditRecords().then((data) => { setRecords(data); setSelectedId(data.entries[0]?.id ?? null); })
      .catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Could not load the audit log."));
  }, []);

  const shown = useMemo(() => (records?.entries ?? []).filter((entry) => filter === "all" || entry.category === filter), [records, filter]);
  const selected = shown.find((entry) => entry.id === selectedId) ?? shown[0];
  const openIncidents = records?.incidents.filter((incident) => incident.status === "open").length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold text-navy">Audit logs &amp; incidents</h1>
        <p className="mt-1 text-slate-600">Recorded approvals, payments and supplier changes, newest first. Shows the latest 100.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {!records && !error && <p className="text-slate-600">Loading the audit log…</p>}
      {records && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter events">
            {FILTERS.map(({ key, label }) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === key ? "bg-navy text-white" : "border border-slate-300 bg-white text-navy hover:bg-slate-50"}`}>{label}</button>)}
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="overflow-hidden">
              {shown.length === 0 ? <p className="p-8 text-center text-sm text-slate-600">No events of this kind yet.</p> : (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50"><tr className="border-b border-slate-200 text-left text-[13px] text-slate-600"><th className={TH}>Event</th><th className={TH}>Actor</th><th className={TH}>Action</th><th className={TH}>Subject</th><th className={TH}>Timestamp (UTC)</th></tr></thead>
                    <tbody>
                      {shown.map((entry) => {
                        const active = entry.id === selected?.id;
                        return (
                          <tr key={entry.id} onClick={() => setSelectedId(entry.id)} className={`cursor-pointer border-b border-slate-100 last:border-0 ${active ? "bg-teal-tint/60" : "hover:bg-slate-50"}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-600"><button type="button" onClick={() => setSelectedId(entry.id)} aria-pressed={active} className="hover:underline">{eventRef(entry.id)}</button></td>
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-navy">{entry.actor}</td>
                            <td className="px-4 py-3 text-navy">{entry.title}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{entry.subject ?? "—"}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-600">{timestamp(entry.at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {selected && (
              <Card className="p-5">
                <h2 className="font-bold text-navy">Event {eventRef(selected.id)}</h2>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div><dt className="inline text-slate-600">Action: </dt><dd className="inline text-navy">{selected.title}</dd></div>
                  <div><dt className="inline text-slate-600">Actor: </dt><dd className="inline text-navy">{selected.actor}</dd></div>
                  {selected.subject && <div><dt className="inline text-slate-600">Subject: </dt><dd className="inline text-navy">{selected.subject}</dd></div>}
                  <div><dt className="inline text-slate-600">Time: </dt><dd className="inline font-mono text-[13px] text-navy">{timestamp(selected.at)} UTC</dd></div>
                  {selected.note && <div><dt className="inline text-slate-600">Note: </dt><dd className="inline text-navy">{selected.note}</dd></div>}
                </dl>
                {(selected.from || selected.to) && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">Before</p><p className="mt-1 text-sm capitalize text-navy">{selected.from ?? "—"}</p></div>
                    <div className="rounded-xl bg-teal-tint p-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-text">After</p><p className="mt-1 text-sm capitalize text-navy">{selected.to ?? "—"}</p></div>
                  </div>
                )}
              </Card>
            )}
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5"><h2 className="font-bold text-navy">Incident management</h2><span className="text-[13px] text-slate-600">{openIncidents} open</span></div>
            {records.incidents.length === 0 ? <p className="border-t border-slate-200 p-6 text-center text-sm text-slate-600">No supplier incidents recorded.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-[13px] text-slate-600"><th className={TH}>Incident</th><th className={TH}>Supplier</th><th className={TH}>Severity</th><th className={TH}>Status</th><th className={TH}>Recorded</th></tr></thead>
                  <tbody>
                    {records.incidents.map((incident) => (
                      <tr key={incident.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-navy">{incident.description}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{incident.supplier}</td>
                        <td className="px-4 py-3"><Badge tone={SEVERITY[incident.severity]} className="capitalize">{incident.severity}</Badge></td>
                        <td className="px-4 py-3"><Badge tone={incident.status === "open" ? "warning" : "success"} className="capitalize">{incident.status}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-600">{timestamp(incident.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
