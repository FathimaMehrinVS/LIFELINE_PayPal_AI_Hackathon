"use client";

import { useAuthProfile } from "@/components/auth-session";

export default function ProfilePage() {
  const profile = useAuthProfile();
  return <section className="mx-auto max-w-2xl space-y-6"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Account</p><h1 className="mt-2 text-3xl font-extrabold text-slate-950">Profile</h1></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-900">{profile.email}</dd></div><div><dt className="text-sm text-slate-500">LIFELINE role</dt><dd className="mt-1 font-semibold text-slate-900">{profile.role}</dd></div></dl><p className="mt-6 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-600">Application roles are assigned by a LIFELINE operator. You cannot change your own role from this page.</p></div></section>;
}
