// Owner: Member 1. Daily European Central Bank reference rates, cached for 12 hours, plus the visitor's country as
// Vercel reports it. Used only to show amounts in the viewer's currency.

const SOURCE_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";

export async function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country");
  try {
    const response = await fetch(SOURCE_URL, { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { date?: string; rates?: Record<string, number> };
    if (!body.date || !body.rates) throw new Error("Unexpected response");
    return Response.json({ date: body.date, rates: { EUR: 1, ...body.rates }, source: "European Central Bank", country });
  } catch {
    return Response.json({ error: "Exchange rates are unavailable right now", country }, { status: 503 });
  }
}
