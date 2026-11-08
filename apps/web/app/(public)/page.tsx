import Link from "next/link";
import { ArrowRightIcon, BasketIcon, HeartHandIcon, RouteIcon, ShieldCheckIcon, UsersIcon } from "../../components/icons";

const steps = [
  { number: "01", title: "Share what is needed", description: "A family or local NGO describes the situation and the essentials required. No payment account is needed to ask for help." },
  { number: "02", title: "Review and verify", description: "The NGO reviews the case. Financial and product information can support the review, while people make every approval decision." },
  { number: "03", title: "Fund an approved plan", description: "Donors can support an approved assistance allocation through the existing secure checkout flow." },
  { number: "04", title: "Coordinate assistance", description: "The NGO coordinates the approved support and records progress separately from the donor payment." },
];

export default function PublicLandingPage() {
  return (
    <main className="overflow-hidden bg-[#F7F9FC] text-[#142D4E]">
      <section className="relative isolate bg-[#142D4E] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-[25rem] w-[25rem] rounded-full border border-white/10" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-teal-100"><HeartHandIcon className="h-5 w-5" /> Accountable humanitarian support</p>
            <h1 className="mt-7 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.65rem]">From emergency report to <span className="text-[#65D2C6]">verified aid delivery.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100">LIFELINE helps humanitarian teams review urgent needs, plan practical assistance and keep each step visible to the people supporting it.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?mode=sign-up" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#159B91] px-6 py-3 font-bold text-white shadow-lg shadow-black/10 transition hover:bg-[#117F78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Get started <ArrowRightIcon className="h-5 w-5" /></Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/35 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10">See how it works</a>
            </div>
            <ul className="mt-8 flex flex-col gap-3 text-sm text-blue-100 sm:flex-row sm:flex-wrap sm:gap-x-6">
              <li className="flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-[#65D2C6]" /> Every case reviewed by an NGO</li>
              <li className="flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-[#65D2C6]" /> No payment needed to request help</li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-xl rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold text-teal-200">A clear, human-reviewed journey</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">One need. Accountable steps.</h2></div>
              <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-blue-100">How LIFELINE works</span>
            </div>
            <div className="mt-7 space-y-3">
              {[
                { name: "Request received", detail: "Situation shared with an NGO", state: "01", color: "bg-[#159B91]" },
                { name: "Needs reviewed", detail: "Details assessed by a person", state: "02", color: "bg-[#159B91]" },
                { name: "Plan approved", detail: "Assistance authorized by an NGO", state: "03", color: "bg-[#F2B65D]" },
                { name: "Support coordinated", detail: "Progress recorded separately", state: "04", color: "bg-white/35" },
              ].map((item, index) => (
                <div key={item.state} className="relative flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1B3A60]/80 p-4">
                  {index < 3 && <span aria-hidden="true" className="absolute -bottom-4 left-[2.15rem] z-10 h-5 w-px bg-white/20" />}
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.color} text-sm font-extrabold text-[#142D4E]`}>{item.state}</span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{item.name}</span><span className="mt-0.5 block text-sm text-blue-100">{item.detail}</span></span>
                  {index === 2 && <span className="hidden rounded-full bg-[#F2B65D]/15 px-2.5 py-1 text-xs font-bold text-[#FFD58F] sm:inline">NGO decision</span>}
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-blue-200">AI can help organize information. It does not decide eligibility, approve aid or confirm delivery.</p>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div><p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#117F78]">Built around dignity and trust</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Assistance should be clear at every step.</h2><p className="mt-5 leading-7 text-slate-600">LIFELINE connects case review, financial access analysis and essential-goods planning in one workflow. NGO teams remain responsible for verification and approval.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E4F4F2] text-[#117F78]"><RouteIcon className="h-6 w-6" /></span><h3 className="mt-4 font-bold">Clear options</h3><p className="mt-2 text-sm leading-6 text-slate-600">Financial access information helps teams compare practical routes.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E4F4F2] text-[#117F78]"><BasketIcon className="h-6 w-6" /></span><h3 className="mt-4 font-bold">Useful essentials</h3><p className="mt-2 text-sm leading-6 text-slate-600">Product options can be planned around needs, budget and availability.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E4F4F2] text-[#117F78]"><UsersIcon className="h-6 w-6" /></span><h3 className="mt-4 font-bold">People decide</h3><p className="mt-2 text-sm leading-6 text-slate-600">NGO review—not an AI score—controls eligibility and approval.</p></article>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#117F78]">How it works</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">A thoughtful path from need to support.</h2></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step) => <article key={step.number} className="relative rounded-2xl border border-slate-200 bg-[#F7F9FC] p-5"><p className="text-sm font-extrabold text-[#117F78]">STEP {step.number}</p><h3 className="mt-3 text-lg font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></article>)}</div></div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-2">
        <article id="for-ngos" className="rounded-3xl bg-[#142D4E] p-7 text-white sm:p-9"><p className="text-sm font-bold uppercase tracking-[0.14em] text-teal-200">For NGO teams</p><h2 className="mt-3 text-2xl font-extrabold">Review needs. Coordinate responsibly.</h2><p className="mt-3 leading-7 text-blue-100">Use the LIFELINE workspace to review cases, financial assessments and assistance plans. Your team stays in control of approvals.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 font-bold text-white hover:text-teal-200">Sign in to your workspace <ArrowRightIcon className="h-5 w-5" /></Link></article>
        <article id="for-donors" className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><p className="text-sm font-bold uppercase tracking-[0.14em] text-[#117F78]">For donors</p><h2 className="mt-3 text-2xl font-extrabold">Fund an approved assistance need.</h2><p className="mt-3 leading-7 text-slate-600">Donations are linked to an NGO-approved allocation. A captured donation is not the same as supplier payment or delivered assistance.</p><Link href="/login?next=%2Fdonate" className="mt-6 inline-flex items-center gap-2 font-bold text-[#117F78] hover:text-[#0B655F]">Continue to Donations <ArrowRightIcon className="h-5 w-5" /></Link></article>
      </section>

      <section id="donate" className="bg-[#E4F4F2] px-5 py-12 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#117F78]">Need help?</p><h2 className="mt-2 text-2xl font-extrabold">You do not need a bank or PayPal account to ask for assistance.</h2><p className="mt-2 max-w-3xl leading-7 text-slate-700">Beneficiaries do not need a LIFELINE login for the MVP. An NGO partner manages and reviews assistance cases.</p></div><Link href="/login" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#142D4E] px-5 py-3 font-bold text-white transition hover:bg-[#203F67]">NGO / donor sign in</Link></div></section>

      <footer className="bg-[#142D4E] px-5 py-8 text-sm text-blue-100 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><span>© LIFELINE · Humanitarian support coordination</span><div className="flex gap-5"><a href="#about" className="hover:text-white">About</a><a href="#how-it-works" className="hover:text-white">How it works</a><Link href="/login" className="hover:text-white">Sign in</Link></div></div></footer>
    </main>
  );
}
