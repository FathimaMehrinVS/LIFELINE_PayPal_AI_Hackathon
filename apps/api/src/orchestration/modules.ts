import { CommerceRequestSchema } from "@lifeline/contracts";
import { llm } from "../ai/llm-client";
import { productSource } from "../modules/commerce/product-source";
import { rankProducts } from "../modules/commerce/service";
import { analyzeSituation } from "../modules/situation/situation.service";
import { buildBasket } from "../rules/basket";
import { HttpError } from "../utils/http-error";
import type { CaseModules } from "./run-case";

// Owner: Member 1. Connects the real modules to the Orchestrator.
// Merge day: replace each placeholder with the teammate's function (one import + one line each):
//   evaluateRoutes → modules/finance/finance.service.ts       (Member 2)
//   routesFor      → modules/finance/route-catalogue.ts       (Member 2)

const notMerged = (what: string, branch: string) => () => {
  throw new HttpError("NOT_IMPLEMENTED", `${what} is not merged yet (${branch})`);
};

export const caseModules: CaseModules = {
  analyzeSituation: (input) => analyzeSituation(input, llm),
  evaluateRoutes: notMerged("Financial Intelligence", "feature/financial-intelligence"),
  routesFor: notMerged("Route catalogue", "feature/financial-intelligence"),
  // Member 3's building blocks, without createCommerceBasket's own saving: the case store saves the basket with
  // the case, so it isn't stored twice as an unrelated request.
  buildBasket: async (input) => {
    const request = CommerceRequestSchema.parse(input);
    const products = await productSource.search(request);
    const ranking = await rankProducts(request, products);
    return buildBasket(request, products, ranking);
  },
};
