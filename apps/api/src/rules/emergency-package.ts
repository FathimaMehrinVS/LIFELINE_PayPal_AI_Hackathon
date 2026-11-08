import { type NeedCategory, PLANNING_HOUSEHOLD_SIZE } from "@lifeline/contracts";
import { roundMoney } from "../utils/money";

// Owner: Member 1. The amount for a standard emergency package, used when an urgent case has no stated budget, so a
// family isn't kept waiting for a figure it doesn't have. Plain code, no AI. The NGO still approves every plan.

/** The currency the allowances are set in. They are not converted, because we don't invent exchange rates. */
export const PACKAGE_CURRENCY = "EUR";

/** Illustrative weekly allowance per person, for demo planning only. */
const WEEKLY_ALLOWANCE_PER_PERSON: Record<NeedCategory, number> = {
  food: 16,
  water: 12,
  medicine: 6,
  shelter: 15,
  hygiene: 4,
  baby_supplies: 10,
  clothing: 10,
  transport: 6,
  other: 6,
};

export function emergencyPackageAmount(needs: readonly NeedCategory[], householdSize: number | null | undefined): number {
  const people = householdSize ?? PLANNING_HOUSEHOLD_SIZE;
  return roundMoney([...new Set(needs)].reduce((sum, need) => sum + WEEKLY_ALLOWANCE_PER_PERSON[need], 0) * people);
}
