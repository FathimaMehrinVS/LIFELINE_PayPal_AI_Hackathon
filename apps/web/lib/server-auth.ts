import { cookies } from "next/headers";

export const AUTH_COOKIE = "lifeline_access_token";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ServerAuthProfile {
  id: string;
  email: string;
  role: "ADMIN" | "NGO" | "DONOR" | "PARTNER";
}

export async function getServerAuthProfile(): Promise<ServerAuthProfile | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const profile = await response.json() as ServerAuthProfile;
    if (!profile.id || !profile.email || !["ADMIN", "NGO", "DONOR", "PARTNER"].includes(profile.role)) return null;
    return profile;
  } catch {
    return null;
  }
}
