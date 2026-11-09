import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/server-auth";

const MAX_TOKEN_LENGTH = 8_192;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return Response.json({ error: "Supabase is not configured" }, { status: 503 });

  let accessToken: unknown;
  try { accessToken = (await request.json()).access_token; } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (typeof accessToken !== "string" || !accessToken || accessToken.length > MAX_TOKEN_LENGTH) {
    return Response.json({ error: "A valid access token is required" }, { status: 400 });
  }

  let identityResponse: Response;
  try {
    identityResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Could not verify the Supabase session" }, { status: 502 });
  }
  if (!identityResponse.ok) return Response.json({ error: "The Supabase session is invalid or expired" }, { status: 401 });

  (await cookies()).set(AUTH_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(AUTH_COOKIE);
  return Response.json({ ok: true });
}
