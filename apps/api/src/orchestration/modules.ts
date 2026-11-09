import { CommerceRequestSchema } from "@lifeline/contracts";
import { llm } from "../ai/llm-client";
import { productSource } from "../modules/commerce/product-source";
import { evaluateRoutes } from "../modules/finance/finance.service";
import { getDemoRouteCatalogue } from "../modules/finance/route-catalogue";
import { rankProducts } from "../modules/commerce/service";
import { analyzeSituation } from "../modules/situation/situation.service";
import { buildBasket } from "../rules/basket";
import type { CaseModules } from "./run-case";

// Owner: Member 1. Connects the real modules (Members 1, 2 and 3) to the Orchestrator.

export const caseModules: CaseModules = {
  analyzeSituation: (input) => analyzeSituation(input, llm),
  // Member 2: fees, scores and verdicts are deterministic; the LLM only writes the explanation.
  evaluateRoutes: (input) => evaluateRoutes(input, llm),
  // The demo catalogue is synthetic and currency-independent (fees are percentages), so currency isn't used yet.
  // Receives (currency, location) and may be async, so a route can depend on the approved suppliers serving that area.
  routesFor: () => getDemoRouteCatalogue(),
  // Member 3's building blocks, without createCommerceBasket's own saving: the case store saves the basket with
  // the case, so it isn't stored twice as an unrelated request.
  buildBasket: async (input) => {
    const request = CommerceRequestSchema.parse(input);
    const products = await productSource.search(request);
    const ranking = await rankProducts(request, products);
    return buildBasket(request, products, ranking);
  },
};
