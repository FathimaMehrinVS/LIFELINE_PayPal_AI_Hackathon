import { type CaseResult, CaseResultSchema, type SituationRequest } from "@lifeline/contracts";
import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { saveFinancialAssessment } from "../modules/finance/finance.persistence";

// Owner: Member 1. Where cases are kept for the dashboard.
// With DATABASE_URL set, cases go to Supabase; without it, they stay in memory (lost on restart).

export interface CaseStore {
  /** `request` is the original form input; the database keeps its message. */
  save(result: CaseResult, request?: SituationRequest): Promise<void>;
  /** Newest first. */
  list(): Promise<CaseResult[]>;
}

const LIST_LIMIT = 200;

/** Keeps the latest cases in memory. Enough for local development and a demo without a database. */
export function createMemoryCaseStore(limit = LIST_LIMIT): CaseStore {
  const cases = new Map<string, CaseResult>();
  return {
    async save(result) {
      cases.delete(result.case_id);
      cases.set(result.case_id, result);
      if (cases.size > limit) cases.delete(cases.keys().next().value!);
    },
    async list() {
      return [...cases.values()].reverse();
    },
  };
}

/** The audit entry holding the whole CaseResult as the Orchestrator returned it. */
export const CASE_AUDIT_ACTION = "case.orchestrated";

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Only complete cases wait for an NGO decision; the others stopped after analysis or routing. */
function requestStatus(status: CaseResult["status"]) {
  if (status === "complete") return "AWAITING_APPROVAL" as const;
  return status === "no_usable_route" ? ("ROUTED" as const) : ("ANALYZED" as const);
}

/**
 * Saves each case as the shared tables expect, so the other modules can use it:
 * - AssistanceRequest (id = case_id, so an AidAllocation can point at it when the NGO approves)
 * - SituationAssessment, FinancialAssessment (Member 2's saveFinancialAssessment) and Basket + items
 * The tables can't hold everything (case status, missing information, alternatives), so the full CaseResult is also
 * kept in an AuditLog entry; the dashboard list is read from there.
 */
export function createPrismaCaseStore(prisma: () => PrismaClient = getPrisma): CaseStore {
  return {
    async save(result, request) {
      const db = prisma();
      const { case_id: id, situation, finance, commerce } = result;

      await db.assistanceRequest.create({
        data: {
          id,
          message: request?.message ?? situation.summary,
          location: situation.location ?? request?.location ?? null,
          currency: situation.currency ?? request?.currency ?? null,
          status: requestStatus(result.status),
          situation: {
            create: {
              summary: situation.summary,
              needs: situation.needs,
              budget: situation.budget,
              currency: situation.currency,
              location: situation.location,
              urgency: situation.urgency.toUpperCase() as Uppercase<typeof situation.urgency>,
              access: toJson(situation.access),
              missingInformation: situation.missing_information,
              confidence: situation.confidence,
            },
          },
        },
      });

      try {
        if (finance) await saveFinancialAssessment(id, finance, db);
        if (commerce) {
          await db.basket.create({
            data: {
              requestId: id,
              total: commerce.total,
              reserve: commerce.reserve,
              currency: commerce.currency,
              unmetNeeds: commerce.unmet_needs,
              explanation: commerce.explanation,
              items: {
                create: commerce.items.map((item) => ({
                  productId: item.product_id,
                  name: item.name,
                  category: item.category,
                  merchantId: item.merchant_id,
                  merchantName: item.merchant_name,
                  source: item.source,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  subtotal: item.subtotal,
                  priceLabel: item.price_label,
                  purchaseUrl: item.purchase_url ?? null,
                })),
              },
            },
          });
        }
        await db.auditLog.create({
          data: { action: CASE_AUDIT_ACTION, entityType: "AssistanceRequest", entityId: id, details: toJson(result) },
        });
      } catch (error) {
        // Don't leave half a case behind; the assessments and basket are deleted with it (cascade).
        await db.assistanceRequest.delete({ where: { id } }).catch(() => undefined);
        throw error;
      }
    },

    async list() {
      const entries = await prisma().auditLog.findMany({
        where: { action: CASE_AUDIT_ACTION, entityType: "AssistanceRequest" },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
      });
      const seen = new Set<string>();
      const cases: CaseResult[] = [];
      for (const entry of entries) {
        if (seen.has(entry.entityId)) continue; // newest entry wins
        seen.add(entry.entityId);
        const parsed = CaseResultSchema.safeParse(entry.details);
        if (parsed.success) cases.push(parsed.data); // skip rows from an older contract instead of failing the list
      }
      return cases;
    },
  };
}

export const caseStore: CaseStore = env.DATABASE_URL ? createPrismaCaseStore() : createMemoryCaseStore();
