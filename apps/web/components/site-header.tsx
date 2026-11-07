"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/situation", label: "Situation" },
  { href: "/finance", label: "Financial access" },
  { href: "/commerce", label: "Essentials" },
  { href: "/donate", label: "Donate" },
  { href: "/dashboard", label: "Dashboard" },
];

/** A heart drawn as one continuous line: the "lifeline" that carries help to people. */
export function LifelineMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16 27.5S3.5 20 3.5 11.5A6.5 6.5 0 0 1 16 8.4a6.5 6.5 0 0 1 12.5 3.1C28.5 20 16 27.5 16 27.5Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M8 15.5h4.5l2-3.5 3 7 2-3.5H24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="bg-slate-900 text-white">
      <nav className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3">
        <Link href="/" className="mr-6 flex items-center gap-2 text-lg font-bold tracking-wide">
          <LifelineMark className="h-8 w-8 text-indigo-300" />
          LIFELINE
        </Link>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-indigo-700 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
