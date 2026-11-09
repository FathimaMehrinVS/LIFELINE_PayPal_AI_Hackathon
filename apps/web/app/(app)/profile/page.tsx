"use client";

import { useAuthProfile } from "@/components/auth-session";
import { Badge, Card, Overline } from "@/components/ui";

export default function ProfilePage() {
  const profile = useAuthProfile();
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <Overline>Account</Overline>
        <h1 className="mt-1 text-[28px] font-bold text-navy">Profile</h1>
      </div>
      <Card className="p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-600">Email</dt><dd className="mt-1 break-all font-semibold text-navy">{profile.email}</dd></div>
          <div><dt className="text-sm text-slate-600">LIFELINE role</dt><dd className="mt-1"><Badge tone="human">{profile.role}</Badge></dd></div>
        </dl>
        <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">Roles are assigned by a LIFELINE operator. You can't change your own role from this page.</p>
      </Card>
    </section>
  );
}
