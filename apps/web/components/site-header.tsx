"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuthProfile } from "./auth-session";
import { BasketIcon, GridIcon, HeartHandIcon, HomeIcon, PlusCircleIcon, RouteIcon, ShieldCheckIcon } from "./icons";

const NAV = [
  { href: "/workspace", label: "Dashboard", Icon: HomeIcon },
  { href: "/situation", label: "New request", Icon: PlusCircleIcon },
  { href: "/requests", label: "My Requests", Icon: GridIcon },
  { href: "/finance", label: "Financial access", Icon: RouteIcon },
  { href: "/commerce", label: "Essentials", Icon: BasketIcon },
  { href: "/donate", label: "Donations", Icon: HeartHandIcon },
  { href: "/profile", label: "Profile", Icon: ShieldCheckIcon },
];

/** A heart held in an open hand: help that reaches people. */
export function LifelineMark({ className = "h-10 w-10", inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={inverse ? "#fff" : "#142D4E"} />
      <path d="M8 25h7l3.2-6.5 5.5 13 4.3-8 2.4 3.5H40" stroke={inverse ? "#142D4E" : "#fff"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M31.5 14.5c-2-2-5.2-2-7.2 0l-.3.3-.3-.3c-2-2-5.2-2-7.2 0s-2 5.2 0 7.2l7.5 7.2 7.5-7.2c2-2 2-5.2 0-7.2Z" stroke={inverse ? "#159B91" : "#65D2C6"} strokeWidth="1.4" fill="none" />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar on large screens; a scrollable top bar on phones and tablets. */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useAuthProfile();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
      await fetch("/api/auth-session", { method: "DELETE", credentials: "same-origin" });
    } finally {
      router.replace("/login");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r">
      <Link href="/" className="flex items-center gap-2 px-5 pt-4 lg:flex-col lg:gap-1 lg:pt-8">
        <LifelineMark className="h-9 w-9 lg:h-14 lg:w-14" />
        <span className="text-xl font-extrabold tracking-wide text-slate-900 lg:text-2xl">LIFELINE</span>
        <span className="hidden text-xs text-slate-500 lg:block">Payments through PayPal Sandbox</span>
      </Link>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:mt-8 lg:flex-col lg:overflow-visible lg:px-4" aria-label="Main">
        {[...NAV.filter((item) => item.label !== "Donations" || profile.role !== "PARTNER"), ...(profile.role === "NGO" ? [{ href: "/dashboard", label: "NGO dashboard", Icon: GridIcon }, { href: "/overview", label: "Case overview", Icon: GridIcon }] : [])].map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:border-l-4 ${
                active
                  ? "bg-indigo-50 text-indigo-700 lg:border-indigo-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 lg:border-transparent"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 mb-4 mt-3 rounded-2xl bg-slate-50 p-4 lg:mb-6 lg:mt-auto">
        <p className="truncate text-sm font-semibold text-slate-900">{profile.email}</p>
        <p className="mt-1 text-xs text-slate-500">{profile.role === "NGO" ? "NGO team" : profile.role === "DONOR" ? "Donor account" : "Community partner"}</p>
        <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-60">
          {signingOut ? "Signing out…" : "Log out"}
        </button>
      </div>
    </aside>
  );
}
