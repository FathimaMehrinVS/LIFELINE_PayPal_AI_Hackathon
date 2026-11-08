"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRightIcon, BasketIcon, HeartHandIcon, ShieldCheckIcon } from "@/components/icons";
import { LifelineMark } from "@/components/site-header";
import { ApiRequestError, api, type AuthProfile } from "@/services/api";
import { signInWithPassword, signOutLocally, signUpWithPassword } from "@/lib/auth-actions";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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

function destinationFor(profile: AuthProfile): string {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (requested === "/donate" && (profile.role === "DONOR" || profile.role === "NGO")) return requested;
  if (requested === "/situation") return requested;
  return profile.role === "NGO" ? "/dashboard" : "/workspace";
}

export default function LoginPage() {
  const router = useRouter();
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
      router.replace(destinationFor(result));
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
  }, [router]);

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

    const { data: { subscription } } = client.auth.onAuthStateChange((_event: AuthChangeEvent, next: Session | null) => applySession(next));
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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "sign-up") setMode("sign-up");
  }, []);

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
        const current = await signInWithPassword(client, email.trim(), password);
        await syncServerSession(current.access_token);
        setNotice("Signed in. Checking your LIFELINE account…");
      } else {
        const current = await signUpWithPassword(client, email.trim(), password);
        await syncServerSession(current.access_token);
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
      await fetch("/api/auth-session", { method: "DELETE", credentials: "same-origin" });
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
    <div className="grid min-h-screen lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative isolate flex min-h-[35vh] flex-col overflow-hidden bg-[#142D4E] px-6 py-6 text-white sm:px-10 sm:py-8 lg:min-h-screen lg:px-12 lg:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 -z-10 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 -z-10 h-[24rem] w-[24rem] rounded-full border border-white/10" />
        <Link href="/" className="inline-flex w-fit items-center gap-3" aria-label="LIFELINE home"><LifelineMark className="h-10 w-10 rounded-xl bg-white" /><span className="text-lg font-extrabold tracking-[0.08em]">LIFELINE</span></Link>
        <div className="my-auto max-w-xl py-10 lg:py-16">
          <p className="text-sm font-bold uppercase tracking-[0.17em] text-[#65D2C6]">From need to verified assistance</p>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">One platform. Three workspaces. Every step accountable.</h1>
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#1B3A60] p-5 sm:p-6">
            <div className="relative grid gap-3">
              <div className="absolute bottom-6 left-5 top-6 w-px bg-white/20" aria-hidden="true" />
              {[
                { label: "Case reviewed", text: "Needs verified by an NGO", tone: "bg-[#65D2C6]" },
                { label: "Plan approved", text: "Assistance authorized by people", tone: "bg-[#F2B65D]" },
                { label: "Progress recorded", text: "Payment and delivery tracked separately", tone: "bg-white" },
              ].map((item) => <div key={item.label} className="relative flex items-center gap-4 rounded-2xl bg-white p-3.5 text-[#142D4E] shadow-sm"><span className={`z-10 h-4 w-4 shrink-0 rounded-full ring-4 ring-white ${item.tone}`} /><span><span className="block text-sm font-extrabold">{item.label}</span><span className="mt-0.5 block text-xs text-slate-600">{item.text}</span></span></div>)}
            </div>
          </div>
          <ul className="mt-7 grid gap-3 text-sm leading-6 text-blue-100 sm:grid-cols-2 lg:grid-cols-1">
            <li className="flex gap-3"><ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#65D2C6]" /><span><strong className="text-white">NGO teams</strong> review cases and approve assistance plans.</span></li>
            <li className="flex gap-3"><HeartHandIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#F2B65D]" /><span><strong className="text-white">Donors</strong> fund approved plans and follow their progress.</span></li>
            <li className="flex gap-3"><BasketIcon className="mt-0.5 h-5 w-5 shrink-0 text-white" /><span><strong className="text-white">Local partners</strong> participate after NGO verification.</span></li>
          </ul>
        </div>
        <p className="hidden text-xs text-blue-200 sm:block">AI supports review. It never authorizes assistance or payments.</p>
      </aside>

      <section className="flex min-h-[65vh] items-center justify-center px-5 py-10 sm:px-10 lg:min-h-screen lg:px-12 lg:py-14" aria-live="polite">
        <div className="w-full max-w-md">
          {configurationError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">{configurationError}</div>
          ) : signedIn ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6"><p className="text-sm font-bold uppercase tracking-[0.12em] text-[#117F78]">LIFELINE account</p><h2 className="mt-2 text-2xl font-extrabold text-[#142D4E]">Signed in</h2><p className="mt-1 break-all text-sm text-slate-600">{session?.user.email}</p></div>
              {profileState === "loading" && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600" role="status">Checking your LIFELINE profile…</p>}
              {profileState === "ready" && profile && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold text-emerald-950">LIFELINE profile found</p><p className="mt-1 text-sm text-emerald-900">Role: <span className="font-bold">{profile.role}</span></p><p className="text-sm text-emerald-900">Profile email: {profile.email}</p></div>}
              {profileState === "pending" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status"><p className="font-bold text-amber-950">Account setup pending</p><p className="mt-1 text-sm leading-6 text-amber-900">Your sign-in is valid, but your LIFELINE profile or role is not ready yet. An administrator must link and assign it before application access is available.</p></div>}
              {profileState === "unsupported" && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert"><p className="font-bold text-rose-950">Application role not supported</p><p className="mt-1 text-sm text-rose-900">Contact the project administrator. No role has been changed.</p></div>}
              {profileState === "session-expired" && <p className="text-sm text-rose-800" role="alert">Your session expired. Please sign in again.</p>}
              {profileState === "error" && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">We couldn&apos;t check your LIFELINE profile. Please try again shortly.</p>}
              {notice && <p className="mt-4 text-sm text-slate-600" role="status">{notice}</p>}
              <button type="button" onClick={() => void signOut()} disabled={busy} className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 font-bold text-[#142D4E] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Signing out…" : "Sign out"}</button>
            </div>
          ) : (
            <>
              <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#117F78] lg:hidden"><span aria-hidden="true">←</span> Back to LIFELINE</Link>
              <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#117F78]">Welcome to LIFELINE</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#142D4E]">{mode === "sign-in" ? "Sign in" : "Create your account"}</h2>
              <p className="mt-2 text-slate-600">{mode === "sign-in" ? "Welcome back. Continue to your LIFELINE workspace." : "Set up your login. Your application role is assigned separately."}</p>

              <div className="mt-7 flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
                {(["sign-in", "sign-up"] as const).map((option) => <button key={option} type="button" role="tab" aria-selected={mode === option} onClick={() => { setMode(option); setFormError(""); setNotice(""); }} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === option ? "bg-white text-[#142D4E] shadow-sm" : "text-slate-600 hover:text-[#142D4E]"}`}>{option === "sign-in" ? "Sign in" : "Create account"}</button>)}
              </div>

              <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
                <div><label htmlFor="email" className="mb-2 block text-sm font-bold text-[#142D4E]">Email address</label><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[#142D4E] outline-none transition placeholder:text-slate-400 focus:border-[#159B91] focus:ring-4 focus:ring-[#159B91]/10" placeholder="name@organisation.org" /></div>
                <div><label htmlFor="password" className="mb-2 block text-sm font-bold text-[#142D4E]">Password</label><input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[#142D4E] outline-none transition placeholder:text-slate-400 focus:border-[#159B91] focus:ring-4 focus:ring-[#159B91]/10" placeholder="Enter your password" /></div>
                {formError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm leading-6 text-rose-900" role="alert">{formError}</p>}
                {notice && <p className="rounded-xl border border-[#BFE6E2] bg-[#EAF7F5] p-3.5 text-sm text-[#105D58]" role="status">{notice}</p>}
                <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142D4E] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#203F67] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#159B91] disabled:cursor-not-allowed disabled:opacity-60">{busy ? (mode === "sign-in" ? "Signing in…" : "Creating account…") : (mode === "sign-in" ? "Sign in" : "Create account")} {!busy && <ArrowRightIcon className="h-5 w-5" />}</button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">{mode === "sign-in" ? "New to LIFELINE?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setFormError(""); setNotice(""); }} className="font-bold text-[#117F78] hover:text-[#0B655F]">{mode === "sign-in" ? "Create an account" : "Sign in"}</button></p>
              <p className="mt-6 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">Creating an account does not assign an NGO, donor or partner role. New profiles remain pending until an administrator reviews and assigns access.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

async function syncServerSession(accessToken: string) {
  const response = await fetch("/api/auth-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!response.ok) throw new Error("Your session could not be securely established. Please try again.");
}
