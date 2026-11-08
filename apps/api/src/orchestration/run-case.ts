import {
  type AccessFactorKey,
  type AccessFactors,
  type BudgetSource,
  type CaseResult,
  type CommerceRequestInput,
  type CommerceResult,
  type FinanceRequest,
  type FinanceResult,
  type FinancialRoute,
  type SituationRequest,
  PLANNING_DAYS_OF_COVER,
  PLANNING_HOUSEHOLD_SIZE,
  type SituationResult,
} from "@lifeline/contracts";
import { PACKAGE_CURRENCY, emergencyPackageAmount } from "../rules/emergency-package";

// Owner: Member 1. Chains Situation → Finance → Commerce for one case.
// Stops honestly instead of inventing a missing value. Never moves money: payments need NGO approval.

/** The three modules, passed in so tests use fakes and the real ones are connected in modules.ts. */
export interface CaseModules {
  analyzeSituation(input: SituationRequest): Promise<SituationResult>;
  evaluateRoutes(input: FinanceRequest): Promise<FinanceResult>;
  buildBasket(input: CommerceRequestInput): Promise<CommerceResult>;
  /** Candidate payment routes to compare (Member 2's route catalogue). */
  routesFor(currency: string): FinancialRoute[];
}

/**
 * Access factors that are the only reason a route needs review: the route is verified, has no warning or critical
 * flag, and some of the access it requires is "unknown". Asking for these can turn the route into a pass.
 */
export function unknownsBlockingRoutes(
  finance: FinanceResult,
  routes: FinancialRoute[],
  access: AccessFactors,
): AccessFactorKey[] {
  const blocking = new Set<AccessFactorKey>();
  for (const assessment of finance.routes) {
    if (assessment.verdict !== "review") continue;
    const route = routes.find((r) => r.id === assessment.route_id);
    if (!route || route.eligibility !== "verified") continue;
    if (assessment.flags.some((flag) => flag.severity !== "info")) continue;
    for (const key of route.requires) {
      if (access[key] === "unknown") blocking.add(key);
    }
  }
  return [...blocking];
}

/**
 * Decides the amount a case is planned around, in priority order: what the NGO set, what the message stated, or, for an
 * urgent case with neither, a standard emergency package. Otherwise the amount stays unknown and is asked for.
 */
function resolveFunding(analysed: SituationResult, input: SituationRequest): { situation: SituationResult; source?: BudgetSource } {
  const urgent = analysed.urgency === "high" || analysed.urgency === "critical";
  let funding: { budget: number; currency: string | null; source: BudgetSource } | undefined;
  if (input.assistance_amount !== undefined) {
    funding = { budget: input.assistance_amount, currency: analysed.currency, source: "ngo" };
  } else if (analysed.budget !== null && analysed.budget > 0) {
    return { situation: analysed, source: "stated" };
  } else if (urgent && analysed.needs.length > 0 && (analysed.currency === null || analysed.currency === PACKAGE_CURRENCY)) {
    funding = {
      budget: emergencyPackageAmount(analysed.needs, analysed.household_size),
      currency: PACKAGE_CURRENCY,
      source: "emergency_package",
    };
  }
  if (!funding) return { situation: analysed };

  const { budget, currency, source } = funding;
  const settled = currency === null ? ["budget"] : ["budget", "currency"];
  return {
    situation: { ...analysed, budget, currency, missing_information: analysed.missing_information.filter((key) => !settled.includes(key)) },
    source,
  };
}

export async function runCase(caseId: string, input: SituationRequest, modules: CaseModules): Promise<CaseResult> {
  const { situation, source: budgetSource } = resolveFunding(await modules.analyzeSituation(input), input);
  const stop = (status: CaseResult["status"], missing: string[], finance: FinanceResult | null = null): CaseResult => ({
    case_id: caseId,
    status,
    situation,
    finance,
    commerce: null,
    missing_information: missing,
    ...(budgetSource ? { budget_source: budgetSource } : {}),
  });

  // 1. Facts every later step needs. Ask for all of them at once.
  const { budget, currency, location, needs, access } = situation;
  const missing: string[] = [];
  if (budget === null || budget <= 0) missing.push("budget");
  if (currency === null) missing.push("currency");
  if (location === null) missing.push("location");
  if (needs.length === 0) missing.push("needs");
  // The null checks repeat so TypeScript knows the values are set below.
  if (missing.length > 0 || budget === null || currency === null || location === null) {
    return stop("needs_information", missing);
  }

  // 2. How can the money reach them?
  const routes = modules.routesFor(currency);
  const finance = await modules.evaluateRoutes({ amount: budget, currency, access, routes });
  const recommended = finance.routes.find((r) => r.route_id === finance.recommended_route_id);

  if (!recommended) {
    const unknowns = unknownsBlockingRoutes(finance, routes, access);
    // Routes held back only by unknown access: ask, don't give up.
    return unknowns.length > 0 ? stop("needs_information", unknowns, finance) : stop("no_usable_route", [], finance);
  }

  // 3. What should the money that actually arrives buy?
  const commerce = await modules.buildBasket({
    needs,
    budget: recommended.usable_value,
    currency,
    location,
    household_size: situation.household_size ?? PLANNING_HOUSEHOLD_SIZE,
    days_of_cover: PLANNING_DAYS_OF_COVER,
  });

  return {
    case_id: caseId,
    status: "complete",
    situation,
    finance,
    commerce,
    missing_information: [],
    ...(budgetSource ? { budget_source: budgetSource } : {}),
  };
}
