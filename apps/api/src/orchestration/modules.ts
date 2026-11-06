import { llm } from "../ai/llm-client";
import { analyzeSituation } from "../modules/situation/situation.service";
import { HttpError } from "../utils/http-error";
import type { CaseModules } from "./run-case";

// Owner: Member 1. Connects the real modules to the Orchestrator.
// Merge day: replace each placeholder with the teammate's function (one import + one line each):
//   evaluateRoutes → modules/finance/finance.service.ts       (Member 2)
//   routesFor      → modules/finance/route-catalogue.ts       (Member 2)
//   buildBasket    → modules/commerce/commerce.service.ts     (Member 3)

const notMerged = (what: string, branch: string) => () => {
  throw new HttpError("NOT_IMPLEMENTED", `${what} is not merged yet (${branch})`);
};

export const caseModules: CaseModules = {
  analyzeSituation: (input) => analyzeSituation(input, llm),
  evaluateRoutes: notMerged("Financial Intelligence", "feature/financial-intelligence"),
  routesFor: notMerged("Route catalogue", "feature/financial-intelligence"),
  buildBasket: notMerged("Commerce Intelligence", "feature/commerce-payments"),
};
