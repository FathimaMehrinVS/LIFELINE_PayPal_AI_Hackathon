import type { ReactNode } from "react";
import Link from "next/link";
import { LifelineMark } from "../../components/site-header";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-ngos", label: "For NGOs" },
  { href: "/#for-donors", label: "For donors" },
  { href: "/#donate", label: "Donate" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.02] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="LIFELINE home">
            <LifelineMark className="h-10 w-10" />
            <span className="text-lg font-extrabold tracking-[0.06em] text-[#142D4E]">LIFELINE</span>
          </Link>
          <div className="order-3 w-full overflow-x-auto md:order-2 md:w-auto">
            <nav className="flex min-w-max items-center gap-5 py-1 text-sm font-semibold text-slate-600 sm:gap-7" aria-label="Public navigation">
              {PUBLIC_LINKS.map(({ href, label }) => <Link key={label} href={href} className="transition-colors hover:text-[#117F78]">{label}</Link>)}
            </nav>
          </div>
          <div className="order-2 flex shrink-0 items-center gap-2 md:order-3">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-bold text-[#142D4E] transition hover:bg-slate-100">Sign in</Link>
            <Link href="/login?mode=sign-up" className="rounded-lg bg-[#142D4E] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#203F67] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#159B91]">Get started</Link>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
