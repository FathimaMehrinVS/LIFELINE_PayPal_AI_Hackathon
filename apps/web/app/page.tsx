import Link from "next/link";

const STEPS = [
  {
    href: "/situation",
    step: "1",
    title: "Situation",
    text: "Describe what happened. The AI pulls out needs, budget and access, and marks what it doesn't know.",
  },
  {
    href: "/finance",
    step: "2",
    title: "Financial access",
    text: "Compare the ways money can reach the family: fees, usable value and what each route needs.",
  },
  {
    href: "/commerce",
    step: "3",
    title: "Essentials",
    text: "Turn the money that actually arrives into a basket of food, medicine and other needs.",
  },
  {
    href: "/donate",
    step: "4",
    title: "Donate",
    text: "Donors give through PayPal Sandbox. Nothing is paid out without NGO approval.",
  },
  {
    href: "/dashboard",
    step: "5",
    title: "NGO dashboard",
    text: "Triage every case, check route and basket, and approve aid.",
  },
];

export default function HomePage() {
  return (
    <section className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">LIFELINE</h1>
          <p className="text-xl text-slate-700">AI-Powered Humanitarian Financial Access</p>
        </div>
        <p className="border-r-4 border-indigo-600 pr-4 text-right text-lg italic text-slate-700">
          Money should reach people.
          <br />
          Access should reach them too.
        </p>
      </header>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                {s.step}
              </span>
              <span className="text-lg font-semibold text-slate-900 group-hover:text-indigo-700">{s.title}</span>
              <span className="text-sm text-slate-600">{s.text}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
