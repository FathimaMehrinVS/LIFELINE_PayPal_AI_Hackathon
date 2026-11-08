"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import type { AuthProfile } from "@/services/api";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const AuthProfileContext = createContext<AuthProfile | null>(null);

export function useAuthProfile() {
  const profile = useContext(AuthProfileContext);
  if (!profile) throw new Error("Authenticated profile context is unavailable");
  return profile;
}

export function AuthSessionBridge() {
  useEffect(() => {
    let client;
    try { client = getSupabaseBrowserClient(); } catch { return; }
    let active = true;
    const sync = async (accessToken: string | null) => {
      try {
        await fetch("/api/auth-session", {
          method: accessToken ? "POST" : "DELETE",
          headers: accessToken ? { "Content-Type": "application/json" } : undefined,
          body: accessToken ? JSON.stringify({ access_token: accessToken }) : undefined,
          credentials: "same-origin",
        });
      } catch {
        // The server-side route guard still validates all API access tokens.
      }
    };

    void client.auth.getSession().then(({ data }) => { if (active) void sync(data.session?.access_token ?? null); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) queueMicrotask(() => { if (active) void sync(session?.access_token ?? null); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return null;
}

export function AuthProfileProvider({ profile, children }: { profile: AuthProfile; children: ReactNode }) {
  return <AuthProfileContext.Provider value={profile}>{children}</AuthProfileContext.Provider>;
}
