import { z } from "zod";
import type { CommerceRequest } from "@lifeline/contracts";
import { getPrisma } from "../../database/prisma";
import { llm } from "../../ai/llm-client";
import { buildBasket } from "../../rules/basket";
import { productSource, type ProductCandidate } from "./product-source";

const RankingSchema = z.object({ ranked_products: z.array(z.object({ product_id: z.string(), reason: z.string().min(1).max(300) })).max(100) });

export async function rankProducts(request: CommerceRequest, products: ProductCandidate[], ranker = llm.generateJson.bind(llm)) {
  if (!products.length) return [];
  try {
    const result = await ranker({
      schema: RankingSchema, temperature: 0.1,
      system: "Rank candidate products for humanitarian needs. Return JSON {ranked_products:[{product_id,reason}]}. Only use supplied product IDs. Prioritize direct need match, appropriate basic essentials, and affordability. Do not calculate or state authoritative totals or alter prices.",
      user: JSON.stringify({ needs: request.needs, location: request.location, budget: request.budget, currency: request.currency,
        candidates: products.map(({ id, name, description, category, price, currency, availability }) => ({ id, name, description, category, price, currency, availability })) }),
    });
    return result.ranked_products.filter((entry) => products.some((product) => product.id === entry.product_id));
  } catch { return []; }
}

export async function createCommerceBasket(request: CommerceRequest) {
  const products = await productSource.search(request);
  const ranking = await rankProducts(request, products);
  const result = buildBasket(request, products, ranking);
  const prisma = getPrisma();
  const requestRow = await prisma.assistanceRequest.create({ data: { message: `Commerce basket: ${request.needs.join(", ")}`, location: request.location, currency: request.currency, status: "BASKET_READY" } });
  const used = result.items.map((item) => ({ item, candidate: products.find((product) => product.id === item.product_id)! }));
  await prisma.$transaction(async (tx) => {
    for (const { item, candidate } of used) {
      await tx.merchant.upsert({ where: { id: candidate.merchantId }, create: { id: candidate.merchantId, name: candidate.merchantName, location: "Demo catalogue; confirm availability before purchase", verified: false, accepts: [] }, update: { name: candidate.merchantName, verified: false } });
      await tx.product.upsert({ where: { id: candidate.id }, create: { id: candidate.id, merchantId: candidate.merchantId, name: candidate.name, description: candidate.description, category: candidate.category, price: candidate.price.toFixed(2), currency: candidate.currency, availability: candidate.availability }, update: { merchantId: candidate.merchantId, name: candidate.name, description: candidate.description, category: candidate.category, price: candidate.price.toFixed(2), currency: candidate.currency, availability: candidate.availability } });
    }
    return tx.basket.create({ data: {
      requestId: requestRow.id, total: result.total.toFixed(2), reserve: result.reserve.toFixed(2), currency: result.currency,
      unmetNeeds: result.unmet_needs, explanation: result.explanation,
      items: { create: used.map(({ item }) => ({ productId: item.product_id, name: item.name, category: item.category, merchantId: item.merchant_id, merchantName: item.merchant_name,
        source: item.source, quantity: item.quantity, unitPrice: item.unit_price.toFixed(2), subtotal: item.subtotal.toFixed(2), priceLabel: item.price_label, purchaseUrl: item.purchase_url })) },
    } });
  });
  return result;
}

export type { ProductCandidate };
