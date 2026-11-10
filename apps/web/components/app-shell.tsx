"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuthProfile } from "./auth-session";
import { MoneyGate, MoneyProvider, useMoneySettings } from "./money-provider";
import { BasketIcon, CoinsIcon, GridIcon, HeartHandIcon, HomeIcon, PlusCircleIcon, RouteIcon, ShieldCheckIcon, StoreIcon, UsersIcon } from "./icons";

// The page frames from "LIFELINE Screen Designs": public site, intake, NGO workspace, donor area, sign-in.
// Sign-in and roles are checked by the (app) layout; the menu shows only what a role can use.

type Frame = "intake" | "donor" | "workspace";

function frameFor(path: string): Frame {
  if (path.startsWith("/situation")) return "intake";
  if (["/donate", "/plans", "/contributions"].some((prefix) => path.startsWith(prefix))) return "donor";
  return "workspace";
}

const NAV: { href: string; label: string; Icon: (p: { className?: string }) => ReactNode; roles?: string[] }[] = [
  { href: "/overview", label: "Overview", Icon: HomeIcon, roles: ["NGO"] },
  { href: "/dashboard", label: "Assistance Cases", Icon: GridIcon, roles: ["NGO"] },
  { href: "/finance", label: "Financial Assessments", Icon: RouteIcon, roles: ["NGO"] },
  { href: "/commerce", label: "Product Baskets", Icon: BasketIcon, roles: ["NGO"] },
  { href: "/suppliers", label: "Suppliers", Icon: StoreIcon, roles: ["NGO"] },
  { href: "/payments", label: "Payments", Icon: CoinsIcon, roles: ["NGO"] },
  { href: "/deliveries", label: "Delivery Tracking", Icon: UsersIcon, roles: ["NGO", "PARTNER"] },
  { href: "/audit", label: "Audit Logs", Icon: ShieldCheckIcon, roles: ["NGO"] },
  { href: "/requests", label: "My Requests", Icon: PlusCircleIcon },
  { href: "/plans", label: "Approved Plans", Icon: HeartHandIcon, roles: ["NGO", "DONOR"] },
  { href: "/contributions", label: "My Contributions", Icon: HeartHandIcon, roles: ["DONOR"] },
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
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 whitespace-nowrap text-sm font-medium text-slate-600" aria-label="Main">
            <Link href="/" className="hidden font-semibold text-navy sm:inline">Home</Link>
            <Link href="/#how" className="hover:text-navy">How It Works</Link>
            <Link href="/login" className="hover:text-navy">Sign In</Link>
            <Link href="/login?mode=sign-up" className="hidden hover:text-navy sm:inline">Create account</Link>
            <Link href="/situation" className="rounded-lg bg-navy px-4 py-2 font-semibold text-white hover:opacity-90">Request Assistance</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
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
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark tag={tag} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">{right}</div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

const DONOR_NAV = [{ href: "/plans", label: "Approved plans" }, { href: "/contributions", label: "My contributions" }];

function DonorNav({ path }: { path: string }) {
  const profile = useAuthProfile();
  const links = [...DONOR_NAV, profile.role === "NGO" ? { href: "/overview", label: "NGO workspace" } : { href: "/profile", label: "Profile" }];
  return (
    <nav aria-label="Donor" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {links.map(({ href, label }) => <Link key={href} href={href} className={path.startsWith(href) ? "font-bold text-navy" : "hover:text-navy"}>{label}</Link>)}
    </nav>
  );
}

/** Shows which currency amounts are in, and links to where it can be changed. */
function CurrencyLink() {
  const settings = useMoneySettings();
  if (!settings) return null;
  return <Link href="/profile" className="whitespace-nowrap text-sm text-slate-600 hover:text-navy" title="Change the currency amounts are shown in">Amounts in <strong className="font-semibold text-navy">{settings.currency}</strong></Link>;
}

function Account() {
  const profile = useAuthProfile();
  const { signOut, signingOut } = useSignOut();
  return (
    <span className="flex items-center gap-3">
      <span className="hidden max-w-48 truncate sm:inline">{profile.email}</span>
      <button type="button" onClick={() => void signOut()} disabled={signingOut} className="font-medium text-navy hover:underline disabled:opacity-60">{signingOut ? "Signing out…" : "Sign out"}</button>
    </span>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

function WorkspaceFrame({ path, children }: { path: string; children: ReactNode }) {
  const profile = useAuthProfile();
  const { signOut, signingOut } = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV.filter((item) => !item.roles || item.roles.includes(profile.role));
  const current = items.find((item) => path.startsWith(item.href));
  const isNgo = profile.role === "NGO";

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:pl-[260px]">
      {menuOpen && <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-navy/40 lg:hidden" />}
      <aside className="relative z-40 bg-navy text-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[260px] lg:flex-col">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:pb-1 lg:pt-5">
          <div>
            <Wordmark light />
            <p className="ml-[46px] hidden text-xs text-slate-300 lg:block">{isNgo ? "NGO Workspace" : "Workspace"}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="workspace-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
        <div
          id="workspace-menu"
          className={`${menuOpen ? "flex" : "hidden"} absolute inset-x-0 top-full max-h-[calc(100vh-4.5rem)] flex-col overflow-y-auto bg-navy pb-3 shadow-xl lg:static lg:flex lg:max-h-none lg:flex-1 lg:overflow-visible lg:pb-0 lg:shadow-none`}
        >
          <nav className="flex flex-col gap-1 px-3 py-2 lg:mt-3 lg:py-3" aria-label="Workspace">
            {items.map(({ href, label, Icon }) => {
              const active = path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium ${active ? "border-teal bg-slate-800 text-white" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon className="h-5 w-5" /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="mx-3 mt-2 rounded-xl bg-slate-800 p-3.5 lg:mb-4 lg:mt-auto">
            <p className="truncate text-sm font-semibold">{profile.email}</p>
            <p className="mt-0.5 text-xs text-slate-300">{ROLE_LABEL[profile.role] ?? profile.role}</p>
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-3 w-full rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">{signingOut ? "Signing out…" : "Sign out"}</button>
          </div>
        </div>
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
          <div>
            <p className="text-xs text-slate-500">{isNgo ? "NGO workspace" : "LIFELINE"}</p>
            <p className="font-bold text-navy">{current?.label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <CurrencyLink />
            <span className="hidden rounded-full border border-dashed border-simulated bg-simulated-tint px-3 py-1 text-xs font-semibold text-simulated sm:inline-flex">PayPal Sandbox</span>
            <Link href="/situation" className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 font-semibold text-white hover:opacity-90"><PlusCircleIcon className="h-4 w-4" /> New case</Link>
          </div>
        </header>
        <main id="main" className="max-w-[1680px] px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

/** The signed-in pages. Member 3's (app) layout has already checked the session and role. */
const SKIP_LINK = "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-navy";

const OTHER_TITLES: [string, string][] = [["/situation", "Request assistance"], ["/donate", "Donate"]];

function pageTitle(path: string): string {
  return NAV.find((item) => path.startsWith(item.href))?.label ?? OTHER_TITLES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? "Workspace";
}

export function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const frame = frameFor(path);
  useEffect(() => {
    document.title = `${pageTitle(path)} · LIFELINE`;
  }, [path]);
  const skip = <a href="#main" className={SKIP_LINK}>Skip to main content</a>;
  const content = <MoneyGate>{children}</MoneyGate>;
  if (frame === "intake") return <MoneyProvider>{skip}<TopBarShell right={<><CurrencyLink /><Account /></>}>{content}</TopBarShell></MoneyProvider>;
  if (frame === "donor") return <MoneyProvider>{skip}<TopBarShell tag="Donor" right={<><DonorNav path={path} /><CurrencyLink /><Account /></>}>{content}</TopBarShell></MoneyProvider>;
  return <MoneyProvider>{skip}<WorkspaceFrame path={path}>{content}</WorkspaceFrame></MoneyProvider>;
}
