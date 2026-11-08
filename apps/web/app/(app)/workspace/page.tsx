"use client";

import Link from "next/link";
import { useAuthProfile } from "@/components/auth-session";
import { BasketIcon, HeartHandIcon, PlusCircleIcon, RouteIcon, GridIcon, ShieldCheckIcon } from "@/components/icons";

const links = [
  { href: "/situation", title: "Start a new request", text: "Share a need and begin the assistance review.", Icon: PlusCircleIcon },
  { href: "/requests", title: "My requests", text: "Review requests you submitted through LIFELINE.", Icon: GridIcon },
  { href: "/finance", title: "Financial assistance", text: "Explore the available financial access assessment.", Icon: RouteIcon },
  { href: "/commerce", title: "Essentials", text: "Build a needs-based basket from available products.", Icon: BasketIcon },
  { href: "/donate", title: "Donations", text: "Fund an assistance allocation approved by an NGO.", Icon: HeartHandIcon },
  { href: "/profile", title: "Profile", text: "View your LIFELINE account and assigned role.", Icon: ShieldCheckIcon },
];

export default function WorkspacePage() {
  const profile = useAuthProfile();
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-900 p-8 text-white sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">Your LIFELINE workspace</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Welcome back</h1>
        <p className="mt-3 text-blue-100">Signed in as {profile.email}. Your account role is {profile.role.toLowerCase()}.</p>
      </section>
      <section aria-label="Your LIFELINE tools" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ href, title, text, Icon }) => <Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
          <Icon className="h-7 w-7 text-emerald-700" />
          <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-emerald-800">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
        </Link>)}
      </section>
      {profile.role === "NGO" && <Link href="/dashboard" className="inline-flex rounded-full bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800">Open NGO dashboard</Link>}
    </div>
  );
}
