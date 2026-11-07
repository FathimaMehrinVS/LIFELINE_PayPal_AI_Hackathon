"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BasketIcon, GridIcon, HeartHandIcon, HomeIcon, PlusCircleIcon, RouteIcon, ShieldCheckIcon } from "./icons";

const NAV = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/situation", label: "New request", Icon: PlusCircleIcon },
  { href: "/finance", label: "Financial access", Icon: RouteIcon },
  { href: "/commerce", label: "Essentials", Icon: BasketIcon },
  { href: "/donate", label: "Donate", Icon: HeartHandIcon },
  { href: "/dashboard", label: "NGO dashboard", Icon: GridIcon },
];

/** A heart held in an open hand: help that reaches people. */
export function LifelineMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path d="M24 26s-9-5.4-9-11.6A5.2 5.2 0 0 1 24 11a5.2 5.2 0 0 1 9 3.4C33 20.6 24 26 24 26Z" fill="#2F66C4" />
      <path d="M27.5 13.2a5.2 5.2 0 0 1 5.5 1.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M5 31h6l9 3h7a2.6 2.6 0 0 0 0-5.2h-5.5" stroke="#0F2547" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M11 31v9.5l12 2 17-8.5a3 3 0 0 0-3-5.2l-8.5 4" stroke="#0F2547" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar on large screens; a scrollable top bar on phones and tablets. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r">
      <Link href="/" className="flex items-center gap-2 px-5 pt-4 lg:flex-col lg:gap-1 lg:pt-8">
        <LifelineMark className="h-9 w-9 lg:h-14 lg:w-14" />
        <span className="text-xl font-extrabold tracking-wide text-slate-900 lg:text-2xl">LIFELINE</span>
        <span className="hidden text-xs text-slate-500 lg:block">Payments through PayPal Sandbox</span>
      </Link>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:mt-8 lg:flex-col lg:overflow-visible lg:px-4" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => {
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

      <div className="mx-4 mb-6 mt-auto hidden rounded-2xl bg-indigo-50 p-4 text-center lg:block">
        <ShieldCheckIcon className="mx-auto h-8 w-8 text-indigo-600" />
        <p className="mt-2 text-sm font-semibold text-slate-900">Demo mode</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Synthetic data only. Payments run in PayPal Sandbox; no real money moves.
        </p>
      </div>
    </aside>
  );
}
