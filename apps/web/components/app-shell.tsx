"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BasketIcon, GridIcon, PlusCircleIcon, RouteIcon, ShieldCheckIcon } from "./icons";

// The page frames from "LIFELINE Screen Designs": public site, intake, NGO workspace, donor area, sign-in.
// Links appear here only once their page exists; the NGO menu grows as Suppliers, Orders and the rest are built.

type Shell = "public" | "intake" | "ngo" | "donor" | "bare";

function shellFor(path: string): Shell {
  if (path === "/login") return "bare";
  if (path.startsWith("/situation")) return "intake";
  if (["/dashboard", "/finance", "/commerce"].some((route) => path.startsWith(route))) return "ngo";
  if (path.startsWith("/donate")) return "donor";
  return "public";
}

const NGO_NAV = [
  { href: "/dashboard", label: "Assistance Cases", Icon: GridIcon },
  { href: "/finance", label: "Financial Assessments", Icon: RouteIcon },
  { href: "/commerce", label: "Product Baskets", Icon: BasketIcon },
];

/** A heart outline crossed by a pulse line ending in a forward arrow: care, connection and movement. */
export function LifelineMark({ className = "h-9 w-9", light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="10" fill={light ? "#FFFFFF" : "#142D4E"} />
      <path d="M20 31s-11-6.6-11-14.6A6 6 0 0 1 20 13a6 6 0 0 1 11 3.4c0 2.5-1.1 4.9-2.7 7" fill="none" stroke={light ? "#142D4E" : "#FFFFFF"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 21h7l2-4 3.5 8 2.5-4h9" fill="none" stroke="#159B91" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m27 18 3.5 3-3.5 3" fill="none" stroke="#F2B65D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Wordmark({ light = false, tag }: { light?: boolean; tag?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LifelineMark light={light} />
      <span className={`text-lg font-extrabold tracking-[0.08em] ${light ? "text-white" : "text-navy"}`}>LIFELINE</span>
      {tag && <span className="rounded-md bg-teal-tint px-2 py-0.5 text-xs font-semibold text-teal-text">{tag}</span>}
    </Link>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600" aria-label="Main">
            <Link href="/" className="font-semibold text-navy">Home</Link>
            <Link href="/login" className="hover:text-navy">Sign In</Link>
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

function NgoShell({ path, children }: { path: string; children: ReactNode }) {
  const current = NGO_NAV.find((item) => path.startsWith(item.href));
  return (
    <div className="min-h-screen lg:pl-[260px]">
      <aside className="bg-navy text-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[260px] lg:flex-col">
        <div className="px-5 pb-1 pt-5">
          <Wordmark light />
          <p className="ml-[46px] hidden text-xs text-slate-300 lg:block">NGO Workspace</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:mt-3 lg:flex-col lg:overflow-visible" aria-label="NGO workspace">
          {NGO_NAV.map(({ href, label, Icon }) => {
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
          <p className="text-sm font-semibold">Demo Relief NGO</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">Demo organisation · sample data only</p>
        </div>
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
          <div>
            <p className="text-xs text-slate-500">Demo Relief NGO</p>
            <p className="font-bold text-navy">{current?.label}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full border border-dashed border-simulated bg-simulated-tint px-3 py-1 text-xs font-semibold text-simulated">Demo data</span>
            <Link href="/situation" className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 font-semibold text-white hover:opacity-90"><PlusCircleIcon className="h-4 w-4" /> New case</Link>
            <Link href="/login" className="font-medium text-slate-600 hover:text-navy">Sign in</Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const shell = shellFor(path);
  if (shell === "bare") return <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">{children}</main>;
  if (shell === "ngo") return <NgoShell path={path}>{children}</NgoShell>;
  if (shell === "intake") return <TopBarShell right={<Link href="/login" className="font-medium hover:text-navy">NGO sign in</Link>}>{children}</TopBarShell>;
  if (shell === "donor") return <TopBarShell tag="Donor" right={<span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-4 w-4 text-success" /> Secure checkout</span>}>{children}</TopBarShell>;
  return <PublicShell>{children}</PublicShell>;
}
