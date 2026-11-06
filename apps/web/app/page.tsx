import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>LIFELINE</h1>
      <p>AI-Powered Humanitarian Financial Access and Payment Coordination Network</p>
      <nav>
        <Link href="/request">Request help</Link> · <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  );
}
