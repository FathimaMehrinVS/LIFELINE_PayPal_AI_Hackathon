"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthProfile } from "@/components/auth-session";
import { BasketIcon, GridIcon, HeartHandIcon, PlusCircleIcon, RouteIcon, ShieldCheckIcon, StoreIcon } from "@/components/icons";
import { Badge, Card, Overline } from "@/components/ui";

type Tool = { href: string; title: string; text: string; Icon: (props: { className?: string }) => ReactNode; roles?: string[] };

const TOOLS: Tool[] = [
  { href: "/situation", title: "Start a new request", text: "Share a need and begin the assistance review.", Icon: PlusCircleIcon },
  { href: "/dashboard", title: "Assistance cases", text: "Review, approve and follow every case.", Icon: GridIcon, roles: ["NGO"] },
  { href: "/overview", title: "Overview", text: "See urgent cases, alerts and recent activity.", Icon: GridIcon, roles: ["NGO"] },
  { href: "/requests", title: "My requests", text: "See the requests you submitted.", Icon: PlusCircleIcon },
  { href: "/finance", title: "Financial assessments", text: "Compare the ways support can reach a family.", Icon: RouteIcon },
  { href: "/commerce", title: "Product baskets", text: "Review the essentials chosen for a case.", Icon: BasketIcon },
  { href: "/suppliers", title: "Suppliers", text: "Register, review and approve suppliers.", Icon: StoreIcon, roles: ["NGO"] },
  { href: "/payments", title: "Payments", text: "Follow donations in and supplier payments out.", Icon: RouteIcon, roles: ["NGO"] },
  { href: "/audit", title: "Audit logs", text: "Check who did what, and when.", Icon: ShieldCheckIcon, roles: ["NGO"] },
  { href: "/deliveries", title: "Delivery verification", text: "Assign funded assistance, review handovers and verify completion.", Icon: ShieldCheckIcon, roles: ["NGO"] },
  { href: "/deliveries", title: "My assigned deliveries", text: "Record preparation, dispatch and handover for your assigned assistance.", Icon: StoreIcon, roles: ["PARTNER"] },
  { href: "/plans", title: "Approved plans", text: "Fund a plan an NGO has approved.", Icon: HeartHandIcon, roles: ["NGO", "DONOR"] },
  { href: "/contributions", title: "My contributions", text: "Follow what happened after you gave.", Icon: HeartHandIcon, roles: ["NGO", "DONOR"] },
  { href: "/profile", title: "Profile", text: "View your account and assigned role.", Icon: ShieldCheckIcon },
];

export default function WorkspacePage() {
  const profile = useAuthProfile();
  const tools = TOOLS.filter((tool) => !tool.roles || tool.roles.includes(profile.role));
  return (
    <div className="space-y-6">
      <div>
        <Overline>Your LIFELINE workspace</Overline>
        <h1 className="mt-1 text-[28px] font-bold text-navy">Welcome back</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-600">Signed in as {profile.email} <Badge tone="human">{profile.role}</Badge></p>
      </div>
      <section aria-label="Your LIFELINE tools" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map(({ href, title, text, Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full p-5 transition group-hover:border-teal">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-tint text-teal-text"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-3 font-bold text-navy">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
