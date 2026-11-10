import { afterEach, describe, expect, it } from "vitest";
import { convert, detectCurrency, formatMoney, setDisplayCurrency } from "../../apps/web/lib/currency";

const fx = { rates: { EUR: 1, INR: 105.3315, USD: 1.1214 }, date: "2026-11-10", source: "European Central Bank" };

describe("display currency", () => {
  afterEach(() => setDisplayCurrency(null, null));

  it.each([
    [{ country: "IN" }, "INR"],
    [{ country: "DE" }, "EUR"],
    [{ timeZone: "Asia/Kolkata" }, "INR"],
    [{ languages: ["en-IN"] }, "INR"],
    [{ country: "DE", timeZone: "Asia/Kolkata" }, "EUR"],
    [{ languages: ["de"] }, undefined],
  ])("detects %j as %s", (input, expected) => {
    expect(detectCurrency(input)).toBe(expected);
  });

  it("converts through EUR and refuses without a rate", () => {
    expect(convert(25, "EUR", "INR", fx)).toBeCloseTo(2633.29, 2);
    expect(convert(105.3315, "INR", "USD", fx)).toBeCloseTo(1.1214, 4);
    expect(convert(25, "EUR", "AED", fx)).toBeNull();
  });

  it("keeps the original amount next to a converted one", () => {
    setDisplayCurrency("INR", fx);
    const text = formatMoney(25, "EUR");
    expect(text.startsWith("≈ ")).toBe(true);
    expect(text).toContain("2,633");
    expect(text).toMatch(/\(€25\.00\)$/);
  });

  it("shows the amount unchanged in its own currency, or when no rate exists", () => {
    setDisplayCurrency("EUR", fx);
    expect(formatMoney(25, "EUR")).toBe("€25.00");
    setDisplayCurrency("AED", fx);
    expect(formatMoney(25, "EUR")).toBe("€25.00");
  });
});
