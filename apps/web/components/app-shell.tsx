"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuthProfile } from "./auth-session";
import { BasketIcon, GridIcon, HeartHandIcon, HomeIcon, PlusCircleIcon, RouteIcon, ShieldCheckIcon, StoreIcon } from "./icons";

// The page frames from "LIFELINE Screen Designs": public site, intake, NGO workspace, donor area, sign-in.
// Sign-in and roles are checked by the (app) layout; the menu shows only what a role can use.

type Frame = "intake" | "donor" | "workspace";

function frameFor(path: string): Frame {
  if (path.startsWith("/situation")) return "intake";
  if (path.startsWith("/donate")) return "donor";
  return "workspace";
}

const NAV: { href: string; label: string; Icon: (p: { className?: string }) => ReactNode; roles?: string[] }[] = [
  { href: "/workspace", label: "Workspace", Icon: HomeIcon },
  { href: "/dashboard", label: "Assistance Cases", Icon: GridIcon, roles: ["NGO"] },
  { href: "/overview", label: "Overview", Icon: GridIcon, roles: ["NGO"] },
  { href: "/requests", label: "My Requests", Icon: PlusCircleIcon },
  { href: "/finance", label: "Financial Assessments", Icon: RouteIcon },
  { href: "/commerce", label: "Product Baskets", Icon: BasketIcon },
  { href: "/suppliers", label: "Suppliers", Icon: StoreIcon, roles: ["NGO"] },
  { href: "/donate", label: "Donations", Icon: HeartHandIcon, roles: ["NGO", "DONOR"] },
  { href: "/profile", label: "Profile", Icon: ShieldCheckIcon },
];

const ROLE_LABEL: Record<string, string> = { NGO: "NGO team", DONOR: "Donor account", PARTNER: "Community partner" };

function useSignOut() {
  const router = useRouter();
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
  return { signOut, signingOut };
}

/** A heart outline crossed by a pulse line ending in a forward arrow: care, connection and movement. */
export function LifelineMark({ className = "h-9 w-9", inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="10" fill={inverse ? "#FFFFFF" : "#142D4E"} />
      <path d="M20 31s-11-6.6-11-14.6A6 6 0 0 1 20 13a6 6 0 0 1 11 3.4c0 2.5-1.1 4.9-2.7 7" fill="none" stroke={inverse ? "#142D4E" : "#FFFFFF"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 21h7l2-4 3.5 8 2.5-4h9" fill="none" stroke="#159B91" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m27 18 3.5 3-3.5 3" fill="none" stroke="#F2B65D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Wordmark({ light = false, tag }: { light?: boolean; tag?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LifelineMark inverse={light} />
      <span className={`text-lg font-extrabold tracking-[0.08em] ${light ? "text-white" : "text-navy"}`}>LIFELINE</span>
      {tag && <span className="rounded-md bg-teal-tint px-2 py-0.5 text-xs font-semibold text-teal-text">{tag}</span>}
    </Link>
  );
}

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600" aria-label="Main">
            <Link href="/" className="font-semibold text-navy">Home</Link>
            <Link href="/#how" className="hover:text-navy">How It Works</Link>
            <Link href="/login" className="hover:text-navy">Sign In</Link>
            <Link href="/login?mode=sign-up" className="hover:text-navy">Create account</Link>
            <Link href="/situation" className="rounded-lg bg-navy px-4 py-2 font-semibold text-white hover:opacity-90">Request Assistance</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-slate-950 text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6">
          <p className="font-bold tracking-[0.08em]">LIFELINE</p>
          <p className="text-sm text-slate-300">From emergency report to verified aid delivery.</p>
        </div>
      </footer>
    </div>
  );
}

function TopBarShell({ tag, right, children }: { tag?: string; right: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark tag={tag} />
          <div className="flex items-center gap-4 text-sm text-slate-600">{right}</div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function Account() {
  const profile = useAuthProfile();
  const { signOut, signingOut } = useSignOut();
  return (
    <span className="flex items-center gap-3">
      <span className="hidden max-w-48 truncate sm:inline">{profile.email}</span>
      <button type="button" onClick={() => void signOut()} disabled={signingOut} className="font-medium text-navy hover:underline disabled:opacity-60">{signingOut ? "Signing out…" : "Log out"}</button>
    </span>
  );
}

function WorkspaceFrame({ path, children }: { path: string; children: ReactNode }) {
  const profile = useAuthProfile();
  const { signOut, signingOut } = useSignOut();
  const items = NAV.filter((item) => !item.roles || item.roles.includes(profile.role));
  const current = items.find((item) => path.startsWith(item.href));
  const isNgo = profile.role === "NGO";
  return (
    <div className="min-h-screen lg:pl-[260px]">
      <aside className="bg-navy text-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[260px] lg:flex-col">
        <div className="px-5 pb-1 pt-5">
          <Wordmark light />
          <p className="ml-[46px] hidden text-xs text-slate-300 lg:block">{isNgo ? "NGO Workspace" : "Workspace"}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:mt-3 lg:flex-col lg:overflow-visible" aria-label="Workspace">
          {items.map(({ href, label, Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium ${active ? "border-teal bg-slate-800 text-white" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 mt-auto hidden rounded-xl bg-slate-800 p-3.5 lg:block">
          <p className="truncate text-sm font-semibold">{profile.email}</p>
          <p className="mt-0.5 text-xs text-slate-300">{ROLE_LABEL[profile.role] ?? profile.role}</p>
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-3 w-full rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">{signingOut ? "Signing out…" : "Log out"}</button>
        </div>
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
          <div>
            <p className="text-xs text-slate-500">{isNgo ? "NGO workspace" : "LIFELINE"}</p>
            <p className="font-bold text-navy">{current?.label}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full border border-dashed border-simulated bg-simulated-tint px-3 py-1 text-xs font-semibold text-simulated">Demo data</span>
            <Link href="/situation" className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 font-semibold text-white hover:opacity-90"><PlusCircleIcon className="h-4 w-4" /> New case</Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

/** The signed-in pages. Member 3's (app) layout has already checked the session and role. */
export function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const frame = frameFor(path);
  if (frame === "intake") return <TopBarShell right={<Account />}>{children}</TopBarShell>;
  if (frame === "donor") return <TopBarShell tag="Donor" right={<><span className="hidden items-center gap-1.5 sm:inline-flex"><ShieldCheckIcon className="h-4 w-4 text-success" /> Secure checkout</span><Account /></>}>{children}</TopBarShell>;
  return <WorkspaceFrame path={path}>{children}</WorkspaceFrame>;
}
