"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiRequestError, api, type AuthProfile } from "../../services/api";
import { signInWithPassword, signOutLocally, signUpWithPassword } from "../../lib/auth-actions";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Mode = "sign-in" | "sign-up";
type ProfileState = "loading" | "ready" | "pending" | "unsupported" | "session-expired" | "error";

function profileStateForError(error: unknown): ProfileState {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.body.error.code === "AUTHENTICATION_REQUIRED") return "session-expired";
    if (error.status === 403 && (error.body.error.message.includes("No LIFELINE profile") || error.body.error.message.includes("role is pending"))) return "pending";
    if (error.status === 403) return "unsupported";
  }
  return "error";
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>("loading");
  const [configurationError, setConfigurationError] = useState("");

  const loadProfile = useCallback(async (current: Session) => {
    setProfileState("loading");
    setProfile(null);
    try {
      await api.provisionAuthProfile(current.access_token);
      const result = await api.getAuthProfile(current.access_token);
      setProfile(result);
      setProfileState("ready");
    } catch (error) {
      const state = profileStateForError(error);
      setProfileState(state);
      if (state === "session-expired") {
        const client = getSupabaseBrowserClient();
        await client.auth.signOut({ scope: "local" });
        setSession(null);
        setFormError("Your session expired. Please sign in again.");
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    let client;
    try {
      client = getSupabaseBrowserClient();
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : "Supabase sign-in is not configured.");
      setProfileState("error");
      return;
    }

    const applySession = (next: Session | null) => {
      if (!active) return;
      setSession(next);
      setFormError("");
      setNotice("");
      if (next) {
        // Keep Supabase's auth state callback synchronous; do profile I/O in a microtask.
        queueMicrotask(() => { if (active) void loadProfile(next); });
      } else {
        setProfile(null);
        setProfileState("error");
      }
    };

    const { data: { subscription } } = client.auth.onAuthStateChange((_event: AuthChangeEvent, next: Session | null) => {
      applySession(next);
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setFormError("We couldn't restore your session. Please sign in again.");
        setProfileState("error");
        return;
      }
      applySession(data.session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");
    if (!email.trim() || !password) {
      setFormError("Enter your email address and password.");
      return;
    }

    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      if (mode === "sign-in") {
        await signInWithPassword(client, email.trim(), password);
        setNotice("Signed in. Checking your LIFELINE account…");
      } else {
        await signUpWithPassword(client, email.trim(), password);
        setNotice("Account created. Checking your LIFELINE profile…");
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setFormError("");
    try {
      await signOutLocally(getSupabaseBrowserClient());
      setSession(null);
      setProfile(null);
      setProfileState("error");
      setNotice("You have been signed out.");
      setMode("sign-in");
      setPassword("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const signedIn = Boolean(session);

  return (
    <div className="mx-auto grid min-h-[65vh] max-w-5xl items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">LIFELINE account</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">Sign in to continue</h1>
        <p className="max-w-xl text-lg leading-relaxed text-slate-600">
          Accounts use Supabase authentication. LIFELINE access also requires an application profile and a role assigned by the project team.
        </p>
        <Link href="/" className="inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900">← Back to LIFELINE</Link>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
        {configurationError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">{configurationError}</div>
        ) : signedIn ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Signed in</h2>
              <p className="mt-1 break-all text-sm text-slate-600">{session?.user.email}</p>
            </div>
            {profileState === "loading" && <p className="text-sm text-slate-600">Checking your LIFELINE profile…</p>}
            {profileState === "ready" && profile && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-950">LIFELINE profile found</p>
                <p className="mt-1 text-sm text-emerald-900">Role: <span className="font-bold">{profile.role}</span></p>
                <p className="text-sm text-emerald-900">Profile email: {profile.email}</p>
              </div>
            )}
            {profileState === "pending" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status">
                <p className="font-bold text-amber-950">Account setup pending</p>
                <p className="mt-1 text-sm text-amber-900">Your sign-in is valid, but no LIFELINE profile is linked yet. An administrator must set up your profile and role before application access is available.</p>
              </div>
            )}
            {profileState === "unsupported" && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
                <p className="font-bold text-rose-950">Application role not supported</p>
                <p className="mt-1 text-sm text-rose-900">This LIFELINE profile is not assigned a supported role. Contact the project administrator; no role has been changed.</p>
              </div>
            )}
            {profileState === "session-expired" && <p className="text-sm text-rose-800" role="alert">Your session expired. Please sign in again.</p>}
            {profileState === "error" && <p className="text-sm text-rose-800" role="alert">We couldn't check your LIFELINE profile. Please try again shortly.</p>}
            {notice && <p className="text-sm text-slate-600" role="status">{notice}</p>}
            <button type="button" onClick={() => void signOut()} disabled={busy} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
              {(["sign-in", "sign-up"] as const).map((option) => (
                <button key={option} type="button" role="tab" aria-selected={mode === option} onClick={() => { setMode(option); setFormError(""); setNotice(""); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === option ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                  {option === "sign-in" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <h2 className="text-2xl font-bold text-slate-950">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-1 text-sm text-slate-600">{mode === "sign-in" ? "Use your email and password." : "Your LIFELINE role is assigned separately after sign-up."}</p>
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-800">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-800">Password</label>
                <input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </div>
              {formError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{formError}</p>}
              {notice && <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900" role="status">{notice}</p>}
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? (mode === "sign-in" ? "Signing in…" : "Creating account…") : (mode === "sign-in" ? "Sign in" : "Sign up")}
              </button>
            </form>
            <p className="mt-5 text-xs leading-relaxed text-slate-500">Signing in does not automatically grant access. A linked LIFELINE profile with a supported role is required.</p>
          </>
        )}
      </section>
    </div>
  );
}
