"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, api, type AdminUser } from "@/services/api";
import { useAuthProfile } from "@/components/auth-session";
import { Badge, Card, Overline } from "@/components/ui";

const ROLES: NonNullable<AdminUser["role"]>[] = ["NGO", "DONOR", "PARTNER", "ADMIN"];

function messageFor(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return error instanceof Error ? error.message : "Could not load LIFELINE accounts.";
}

export default function AdminUsersPage() {
  const profile = useAuthProfile();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setUsers(await api.listAdminUsers()); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function changeRole(user: AdminUser, role: NonNullable<AdminUser["role"]>) {
    setSavingId(user.id);
    setError("");
    setNotice("");
    try {
      const updated = await api.setUserRole(user.id, role);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Updated ${user.email} to ${role}.`);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div>
        <Overline>Administration</Overline>
        <h1 className="mt-1 text-[28px] font-bold text-navy">Manage accounts</h1>
        <p className="mt-1 text-slate-600">Assign a LIFELINE role to a person who has already created an account and signed in at least once.</p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-critical/30 bg-critical-tint p-4 text-sm text-critical">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-success/30 bg-success-tint p-4 text-sm text-success">{notice}</p>}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div><h2 className="font-bold text-navy">Registered accounts</h2><p className="mt-1 text-sm text-slate-600">{users.length} account{users.length === 1 ? "" : "s"}</p></div>
          <button type="button" onClick={() => void loadUsers()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-60">{loading ? "Refreshing…" : "Refresh list"}</button>
        </div>
        {loading ? <p className="p-5 text-sm text-slate-600">Loading accounts…</p> : users.length === 0 ? <p className="p-5 text-sm text-slate-600">No registered accounts yet. Ask the person to create an account, sign in, then refresh this list.</p> : (
          <ul className="divide-y divide-slate-100">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{user.name}</p>
                  <p className="truncate text-sm text-slate-600">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">Joined {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  {user.id === profile.id && <Badge tone="neutral">You</Badge>}
                  <label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.email}</label>
                  <select id={`role-${user.id}`} value={user.role ?? ""} disabled={savingId === user.id || user.id === profile.id} onChange={(event) => void changeRole(user, event.target.value as NonNullable<AdminUser["role"]>)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy disabled:opacity-60">
                    {!user.role && <option value="">Unassigned</option>}
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  {savingId === user.id && <span className="text-xs text-slate-500">Saving…</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">For safety, you can’t change your own role here, and LIFELINE always keeps at least one Admin.</p>
      </Card>
    </section>
  );
}
