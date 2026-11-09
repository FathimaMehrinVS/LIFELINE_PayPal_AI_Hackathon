import { type CaseResult, CaseResultSchema, type SituationRequest } from "@lifeline/contracts";
import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { saveFinancialAssessment } from "../modules/finance/finance.persistence";

// Owner: Member 1. Where cases are kept for the dashboard.
// With DATABASE_URL set, cases go to Supabase; without it, they stay in memory (lost on restart).

export interface CaseStore {
  /** `request` is the original form input; the database keeps its message. */
  save(result: CaseResult, request?: SituationRequest, createdById?: string, actorId?: string): Promise<void>;
  /** Newest first. */
  list(): Promise<CaseResult[]>;
  listByOwner(ownerId: string): Promise<CaseResult[]>;
  ownerOf(caseId: string): Promise<string | null>;
}

const LIST_LIMIT = 200;

/** Keeps the latest cases in memory. Enough for local development and a demo without a database. */
export function createMemoryCaseStore(limit = LIST_LIMIT): CaseStore {
  const cases = new Map<string, CaseResult>();
  const owners = new Map<string, string>();
  return {
    async save(result, _request, createdById) {
      cases.delete(result.case_id);
      cases.set(result.case_id, result);
      if (createdById) owners.set(result.case_id, createdById);
      if (cases.size > limit) {
        const oldest = cases.keys().next().value!;
        cases.delete(oldest);
        owners.delete(oldest);
      }
    },
    async list() {
      return [...cases.values()].reverse();
    },
    async listByOwner(ownerId) {
      return [...cases.values()].filter((entry) => owners.get(entry.case_id) === ownerId).reverse();
    },
    async ownerOf(caseId) {
      return owners.get(caseId) ?? null;
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
    async save(result, request, createdById, actorId) {
      const db = prisma();
      const { case_id: id, situation, finance, commerce } = result;
      const previous = await db.assistanceRequest.findUnique({ where: { id }, select: { createdById: true } });
      const ownerId = createdById ?? previous?.createdById ?? null;

      // A case re-run with the person's answers keeps its id: replace its old rows (assessments and basket go with
      // them by cascade). The audit log keeps every version; list() shows the newest.
      await db.assistanceRequest.deleteMany({ where: { id } });
      await db.assistanceRequest.create({
        data: {
          id,
          message: request?.message ?? situation.summary,
          location: situation.location ?? request?.location ?? null,
          currency: situation.currency ?? request?.currency ?? null,
          status: requestStatus(result.status),
          createdById: ownerId,
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
          data: { actorId: actorId ?? createdById ?? null, action: CASE_AUDIT_ACTION, entityType: "AssistanceRequest", entityId: id, details: toJson(result) },
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

    async listByOwner(ownerId) {
      const db = prisma();
      const requests = await db.assistanceRequest.findMany({ where: { createdById: ownerId }, select: { id: true } });
      const ids = requests.map((item) => item.id);
      if (!ids.length) return [];
      const entries = await db.auditLog.findMany({
        where: { action: CASE_AUDIT_ACTION, entityType: "AssistanceRequest", entityId: { in: ids } },
        orderBy: { createdAt: "desc" },
      });
      const seen = new Set<string>();
      const cases: CaseResult[] = [];
      for (const entry of entries) {
        if (seen.has(entry.entityId)) continue;
        seen.add(entry.entityId);
        const parsed = CaseResultSchema.safeParse(entry.details);
        if (parsed.success) cases.push(parsed.data);
      }
      return cases;
    },

    async ownerOf(caseId) {
      const request = await prisma().assistanceRequest.findUnique({ where: { id: caseId }, select: { createdById: true } });
      return request?.createdById ?? null;
    },
  };
}

export const caseStore: CaseStore = env.DATABASE_URL ? createPrismaCaseStore() : createMemoryCaseStore();
