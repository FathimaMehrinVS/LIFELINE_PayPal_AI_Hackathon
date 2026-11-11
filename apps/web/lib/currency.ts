// Owner: Member 1. Shows money in each viewer's own currency. Display only: plans are approved and paid in the
// campaign currency, and every converted figure keeps the original amount beside it.

export interface FxRates {
  /** Rates against EUR, with EUR itself set to 1. */
  rates: Record<string, number>;
  date: string;
  source: string;
}

const EURO_COUNTRIES = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];

const COUNTRY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((country) => [country, "EUR"])),
  IN: "INR", US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", AE: "AED", JP: "JPY", SG: "SGD", CH: "CHF",
  SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", IS: "ISK", TR: "TRY", ZA: "ZAR",
  BR: "BRL", MX: "MXN", CN: "CNY", HK: "HKD", KR: "KRW", ID: "IDR", MY: "MYR", PH: "PHP", TH: "THB", IL: "ILS",
};

const TIMEZONE_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Madrid": "ES",
  "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Vienna": "AT", "Europe/Dublin": "IE",
  "Europe/Lisbon": "PT", "Europe/Helsinki": "FI", "Europe/Athens": "GR", "Europe/London": "GB", "America/New_York": "US",
  "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  "Asia/Dubai": "AE", "Asia/Tokyo": "JP", "Asia/Singapore": "SG", "Europe/Zurich": "CH",
};

export const currencyForCountry = (country: string | null | undefined) => (country ? COUNTRY_CURRENCY[country.toUpperCase()] : undefined);

/** Best guess for a default: the hosting provider's country, then the time zone, then the browser language. */
export function detectCurrency(input: { country?: string | null; timeZone?: string | null; languages?: readonly string[] }): string | undefined {
  const fromLanguage = (input.languages ?? []).map((tag) => tag.split("-")[1]).find((region) => region && currencyForCountry(region));
  return currencyForCountry(input.country) ?? currencyForCountry(TIMEZONE_COUNTRY[input.timeZone ?? ""]) ?? currencyForCountry(fromLanguage);
}

export function convert(amount: number, from: string, to: string, fx: FxRates | null): number | null {
  if (from === to) return amount;
  const fromRate = fx?.rates[from];
  const toRate = fx?.rates[to];
  return fromRate && toRate ? (amount / fromRate) * toRate : null;
}

function format(amount: number, currency: string, approximate = false): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, ...(approximate ? { maximumFractionDigits: 0 } : {}) }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/** The viewer's display currency and today's rates, set once by the money provider before pages render. */
let display: { currency: string | null; fx: FxRates | null } = { currency: null, fx: null };
export const setDisplayCurrency = (currency: string | null, fx: FxRates | null) => { display = { currency, fx }; };

/** "≈ ₹3,705" in the viewer's currency, or null when it's the same currency or there's no rate. For amounts that must
 * stay primary in their own currency, such as what PayPal will charge. */
export function approximateInDisplay(amount: number, currency: string): string | null {
  const target = display.currency;
  if (!target || target === currency) return null;
  const converted = convert(amount, currency, target, display.fx);
  return converted === null ? null : `≈ ${format(converted, target, true)}`;
}

/** "≈ ₹2,633" alone, for narrow table columns. The full figure belongs in a tooltip (use formatMoney). */
export function formatMoneyShort(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || !currency) return formatMoney(amount, currency);
  return approximateInDisplay(amount, currency) ?? format(amount, currency);
}

/** "≈ ₹2,633 (€25.00)" for a viewer in India, "€25.00" for one in Germany. */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  if (!currency) return amount.toLocaleString();
  const target = display.currency;
  if (!target || target === currency) return format(amount, currency);
  const converted = convert(amount, currency, target, display.fx);
  return converted === null ? format(amount, currency) : `≈ ${format(converted, target, true)} (${format(amount, currency)})`;
}
