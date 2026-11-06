import { Router } from "express";
import { CommerceRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { createCommerceBasket } from "../modules/commerce/service";

// Owner: Member 3 (feature/commerce-payments)
export function createCommerceRouter(buildBasket = createCommerceBasket) {
  const router = Router();
  router.post("/basket", validateBody(CommerceRequestSchema), async (req, res) => {
  const result = await buildBasket(CommerceRequestSchema.parse(req.body));
  res.status(201).json(result);
});
  return router;
}

export const commerceRouter = createCommerceRouter();
