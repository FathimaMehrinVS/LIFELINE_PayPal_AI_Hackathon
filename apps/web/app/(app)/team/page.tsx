"use client";

import type { TeamMember, TeamRole } from "@lifeline/contracts";
import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/components/auth-session";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, type BadgeTone, Card, EmptyState, button, fieldClass } from "@/components/ui";
import { ApiRequestError, api } from "@/services/api";

// Owner: Member 1. NGO staff give people access here instead of running a terminal command. Each change is audited.

const ROLES: { role: TeamRole; label: string; text: string }[] = [
  { role: "DONOR", label: "Donor", text: "Can fund approved plans and follow them. Sees no family details." },
  { role: "PARTNER", label: "Partner", text: "Records preparation and handover for deliveries assigned to them." },
  { role: "NGO", label: "NGO staff", text: "Sees cases and family details, approves plans and manages suppliers and access." },
];
const LABEL: Record<TeamRole, string> = { DONOR: "Donor", PARTNER: "Partner", NGO: "NGO staff" };
const TONE: Record<TeamRole, BadgeTone> = { DONOR: "info", PARTNER: "neutral", NGO: "human" };
type Filter = "all" | "pending" | TeamRole;

export default function TeamPage() {
  const me = useAuthProfile();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [choices, setChoices] = useState<Record<string, TeamRole>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<{ member: TeamMember; role: TeamRole } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api.listTeam().then(setMembers).catch((cause: unknown) => setError(cause instanceof ApiRequestError ? cause.message : "Couldn't load accounts. Please try again."));
  }, []);

  const shown = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (members ?? [])
      .filter((member) => filter === "all" || (filter === "pending" ? member.role === null : member.role === filter))
      .filter((member) => !text || `${member.email} ${member.name}`.toLowerCase().includes(text));
  }, [members, filter, search]);

  const count = (value: Filter) => (members ?? []).filter((member) => (value === "pending" ? member.role === null : member.role === value)).length;
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `All ${members?.length ?? 0}` },
    { value: "pending", label: `No access ${count("pending")}` },
    { value: "NGO", label: `NGO staff ${count("NGO")}` },
    { value: "PARTNER", label: `Partners ${count("PARTNER")}` },
    { value: "DONOR", label: `Donors ${count("DONOR")}` },
  ];

  async function apply(member: TeamMember, role: TeamRole) {
    setBusy(member.id);
    setError("");
    setNotice("");
    try {
      const updated = await api.changeTeamRole(member.id, { role });
      setMembers((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setNotice(`${updated.email} now has ${LABEL[role]} access. They may need to sign out and in again.`);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : "Couldn't change access. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold text-navy">Team &amp; access</h1>
        <p className="mt-1 text-slate-600">New accounts start as donors. Give partner or NGO access to people you trust. Every change is saved to the audit log.</p>
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        {ROLES.map(({ role, label, text }) => <div key={role}><Badge tone={TONE[role]}>{label}</Badge><p className="mt-1.5 text-sm text-slate-600">{text}</p></div>)}
      </Card>

      {error && <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-success/30 bg-success-tint p-4 text-sm text-success">{notice}</p>}
      {!members && !error && <p className="text-slate-600">Loading accounts…</p>}

      {members && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email or name" aria-label="Search accounts" className={`${fieldClass} min-w-64 flex-1`} />
            {filters.map(({ value, label }) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`inline-flex h-[46px] items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${filter === value ? "bg-navy text-white" : "border border-slate-300 bg-white text-navy hover:bg-slate-50"}`}>{label}</button>)}
          </div>

          {shown.length === 0 ? (
            <EmptyState title={members.length === 0 ? "No accounts yet" : "No accounts match"} text={members.length === 0 ? "People appear here after they create an account." : "Try a different search or filter."} action={members.length > 0 ? <button type="button" onClick={() => { setSearch(""); setFilter("all"); }} className={button.secondary}>Clear filters</button> : undefined} />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {shown.map((member) => {
                  const isMe = member.id === me.id;
                  const choice = choices[member.id] ?? member.role ?? "DONOR";
                  const changed = choice !== member.role;
                  return (
                    <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="break-all font-semibold text-navy">{member.email} {isMe && <span className="text-sm font-normal text-slate-600">(you)</span>}</p>
                        <p className="mt-0.5 text-[13px] text-slate-600">Joined {new Date(member.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {member.role ? <Badge tone={TONE[member.role]}>{LABEL[member.role]}</Badge> : <Badge tone="warning">No access yet</Badge>}
                        {isMe ? <span className="text-[13px] text-slate-600">Another NGO team member must change your access</span> : (
                          <>
                            <label className="sr-only" htmlFor={`role-${member.id}`}>Access for {member.email}</label>
                            <select id={`role-${member.id}`} value={choice} onChange={(event) => setChoices((current) => ({ ...current, [member.id]: event.target.value as TeamRole }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy">
                              {ROLES.map(({ role, label }) => <option key={role} value={role}>{label}</option>)}
                            </select>
                            <button type="button" disabled={!changed || busy === member.id} onClick={() => setConfirming({ member, role: choice })} className={button.primary}>{busy === member.id ? "Saving…" : "Change access"}</button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.role === "NGO" ? "Give NGO staff access?" : "Change this person's access?"}
        confirmLabel="Change access"
        onCancel={() => setConfirming(null)}
        onConfirm={() => { if (confirming) void apply(confirming.member, confirming.role); setConfirming(null); }}
      >
        {confirming && <p><strong className="text-navy">{confirming.member.email}</strong> will become <strong className="text-navy">{LABEL[confirming.role]}</strong>. {ROLES.find((item) => item.role === confirming.role)?.text}{confirming.role === "NGO" ? " Only give this to people your organisation trusts." : ""}</p>}
      </ConfirmDialog>
    </div>
  );
}
