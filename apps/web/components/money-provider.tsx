"use client";

import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { type FxRates, detectCurrency, setDisplayCurrency } from "@/lib/currency";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// Owner: Member 1. Works out the viewer's display currency once per page load, before the page renders amounts.

export const CURRENCY_METADATA_KEY = "display_currency";

interface MoneySettings {
  /** What amounts are shown in. */
  currency: string;
  /** What detection suggested, used when the viewer hasn't chosen. */
  detected: string;
  /** The viewer's own choice, saved on their account, or null for automatic. */
  saved: string | null;
  fx: FxRates | null;
}

const MoneyContext = createContext<MoneySettings | null>(null);
export const useMoneySettings = () => useContext(MoneyContext);

const FALLBACK = "EUR";

export function MoneyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MoneySettings | null>(null);

  useEffect(() => {
    let active = true;
    const finish = (value: MoneySettings) => {
      if (!active) return;
      setDisplayCurrency(value.currency, value.fx);
      setSettings(value);
    };
    // A slow rate service must never hold up the page; amounts then show in their own currency.
    const timer = window.setTimeout(() => finish({ currency: FALLBACK, detected: FALLBACK, saved: null, fx: null }), 2_500);

    void (async () => {
      const [fxResult, session] = await Promise.all([
        fetch("/api/fx").then(async (response) => ({ ok: response.ok, body: await response.json() as Partial<FxRates> & { country?: string | null } })).catch(() => null),
        getSupabaseBrowserClient().auth.getSession().catch(() => null),
      ]);
      window.clearTimeout(timer);
      const fx = fxResult?.ok && fxResult.body.rates ? { rates: fxResult.body.rates, date: fxResult.body.date ?? "", source: fxResult.body.source ?? "" } : null;
      const savedValue = session?.data.session?.user.user_metadata?.[CURRENCY_METADATA_KEY];
      const saved = typeof savedValue === "string" && /^[A-Z]{3}$/.test(savedValue) ? savedValue : null;
      const detected = detectCurrency({ country: fxResult?.body.country, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, languages: navigator.languages }) ?? FALLBACK;
      const wanted = saved ?? detected;
      // Without a published rate for it (for example AED), keep amounts in their own currency.
      finish({ currency: fx?.rates[wanted] ? wanted : FALLBACK, detected, saved, fx });
    })();

    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  return <MoneyContext.Provider value={settings}>{children}</MoneyContext.Provider>;
}

/** Holds back page content until the display currency is known, so no amount changes after it appears. */
export function MoneyGate({ children }: { children: ReactNode }) {
  const settings = useMoneySettings();
  if (!settings) return <p className="text-sm text-slate-600" role="status">Loading…</p>;
  return children;
}
