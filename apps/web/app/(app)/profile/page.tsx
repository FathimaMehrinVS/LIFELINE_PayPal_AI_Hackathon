"use client";

import { useState } from "react";
import { useAuthProfile } from "@/components/auth-session";
import { CURRENCY_METADATA_KEY, useMoneySettings } from "@/components/money-provider";
import { Badge, Card, Overline, button, fieldClass } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const AUTOMATIC = "auto";

function CurrencySetting() {
  const settings = useMoneySettings();
  const [choice, setChoice] = useState(settings?.saved ?? AUTOMATIC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!settings) return null;
  const available = Object.keys(settings.fx?.rates ?? { EUR: 1 }).sort();

  async function save() {
    setBusy(true);
    setError("");
    const { error: failure } = await getSupabaseBrowserClient().auth.updateUser({ data: { [CURRENCY_METADATA_KEY]: choice === AUTOMATIC ? null : choice } });
    if (failure) {
      setError("Couldn't save your currency. Please try again.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-navy">Display currency</h2>
      <p className="mt-1 text-sm text-slate-600">Amounts are shown in this currency, with the original amount beside them. Plans are always approved and paid in their own currency.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-64 text-sm font-bold text-navy">
          <span className="mb-1.5 block">Show amounts in</span>
          <select value={choice} onChange={(event) => setChoice(event.target.value)} className={`${fieldClass} font-normal`}>
            <option value={AUTOMATIC}>Automatic ({settings.detected}, detected from your location)</option>
            {available.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy || choice === (settings.saved ?? AUTOMATIC)} onClick={() => void save()} className={button.primary}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
      <p className="mt-3 text-[13px] text-slate-600">
        {settings.fx ? `Rates: ${settings.fx.source}, ${settings.fx.date}. Converted amounts are approximate.` : "Exchange rates are unavailable right now, so amounts are shown in their own currency."}
        {settings.fx && !settings.fx.rates[settings.saved ?? settings.detected] && ` There is no published rate for ${settings.saved ?? settings.detected}, so amounts are shown in their own currency.`}
      </p>
    </Card>
  );
}

export default function ProfilePage() {
  const profile = useAuthProfile();
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <Overline>Account</Overline>
        <h1 className="mt-1 text-[28px] font-bold text-navy">Profile</h1>
      </div>
      <Card className="p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-600">Email</dt><dd className="mt-1 break-all font-semibold text-navy">{profile.email}</dd></div>
          <div><dt className="text-sm text-slate-600">LIFELINE role</dt><dd className="mt-1"><Badge tone="human">{profile.role}</Badge></dd></div>
        </dl>
        <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">Roles are assigned by a LIFELINE operator. You can&apos;t change your own role from this page.</p>
      </Card>
      <CurrencySetting />
    </section>
  );
}
