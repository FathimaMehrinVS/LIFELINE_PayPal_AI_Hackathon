import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseResult, CommerceResult, FinanceRequest, FinanceResult, SituationResult } from "@lifeline/contracts";

// Owner: Member 1. Sample cases built from packages/contracts/samples, for previewing the dashboard before the
// Finance and Commerce modules are merged. Served at GET /api/cases/samples and always labelled as samples in the UI.

const SAMPLES_DIR = join(import.meta.dirname, "../../../../packages/contracts/samples");
const read = <T>(file: string): T => JSON.parse(readFileSync(join(SAMPLES_DIR, file), "utf8"));

export function sampleCases(): CaseResult[] {
  const situation = read<SituationResult>("situation-result.json");
  const finance = read<FinanceResult>("finance-result.json");
  const commerce = read<CommerceResult>("commerce-result.json");
  const answeredAccess = read<FinanceRequest>("finance-request.json").access;

  return [
    {
      case_id: "sample_priya",
      status: "complete",
      situation: { ...situation, location: "Demo region (synthetic)", access: answeredAccess, missing_information: [] },
      finance,
      commerce,
      missing_information: [],
    },
    {
      case_id: "sample_flood",
      status: "needs_information",
      situation: {
        ...situation,
        summary: "A family in a flooded village needs clean water and baby milk for an infant. $200 is available.",
        needs: ["water", "baby_supplies"],
        budget: 200,
        currency: "USD",
        urgency: "critical",
        missing_information: ["location", "bank_availability", "atm_access", "wallet_acceptance"],
      },
      finance: null,
      commerce: null,
      missing_information: ["location"],
    },
    {
      case_id: "sample_blocked",
      status: "no_usable_route",
      situation: { ...situation, summary: "Parents need food; every payment route needs access they don't have.", needs: ["food"], urgency: "medium", location: "Demo town (synthetic)" },
      finance: {
        ...finance,
        recommended_route_id: null,
        routes: finance.routes.map((r) => ({ ...r, verdict: "block" as const })),
        explanation: "No route can currently reach the family: each one needs access that is unavailable.",
      },
      commerce: null,
      missing_information: [],
    },
    {
      case_id: "sample_no_budget",
      status: "needs_information",
      situation: {
        ...situation,
        summary: "An elderly couple needs medicine. No amount or currency is given.",
        needs: ["medicine"],
        budget: null,
        currency: null,
        urgency: "high",
        location: "Ernakulam, Kerala",
      },
      finance: null,
      commerce: null,
      missing_information: ["budget", "currency"],
    },
  ];
}
