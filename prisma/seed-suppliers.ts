import type { PrismaClient } from "../apps/api/src/generated/prisma/client";

// Owner: Member 1. Synthetic suppliers with a recorded order history, so the scorecard has something to calculate.
// None of these businesses exist. Safe to run more than once, and it never changes a status the NGO has set.

type Db = Pick<PrismaClient, "campaign" | "merchant" | "assistanceRequest" | "aidAllocation" | "purchaseOrder" | "fulfilmentEvent" | "supplierIncident">;

const HISTORY_CAMPAIGN = "camp_demo_history";
const AREAS = ["Demo Town (synthetic)", "Demo region (synthetic)"];

const SUPPLIERS = [
  { id: "demo-market", name: "Community Market (synthetic)", location: "Demo Town (synthetic)", categories: ["food", "water"], accepts: ["Bank transfer"], status: "APPROVED", completed: 11, issues: 1, complaints: [] },
  { id: "demo-health", name: "Neighborhood Health Co-op (synthetic)", location: "Demo Town (synthetic)", categories: ["medicine", "hygiene", "water"], accepts: ["Bank transfer"], status: "APPROVED", completed: 19, issues: 1, complaints: ["Late delivery on one order (synthetic)"] },
  { id: "demo-family", name: "Family Essentials Co-op (synthetic)", location: "Demo region (synthetic)", categories: ["baby_supplies", "clothing"], accepts: ["Mobile money"], status: "APPROVED", completed: 1, issues: 0, complaints: [] },
  { id: "demo-home", name: "Home Basics Co-op (synthetic)", location: "Demo region (synthetic)", categories: ["shelter", "other"], accepts: ["Bank transfer"], status: "PENDING", completed: 0, issues: 0, complaints: [] },
  { id: "demo-quick", name: "Quick Supply Depot (synthetic)", location: "Demo Town (synthetic)", categories: ["food", "other"], accepts: ["Bank transfer"], status: "SUSPENDED", completed: 3, issues: 3, complaints: ["Goods did not match the order (synthetic)", "Repeated late deliveries (synthetic)"] },
] as const;

export async function seedSuppliers(db: Db, ownerId: string) {
  await db.campaign.upsert({
    where: { id: HISTORY_CAMPAIGN },
    update: {},
    create: { id: HISTORY_CAMPAIGN, title: "Past demo orders (synthetic)", description: "Holds the synthetic order history behind supplier scorecards. Not a real appeal and not part of any balance.", currency: "EUR", goalAmount: "0.00", active: false, ownerId },
  });

  for (const supplier of SUPPLIERS) {
    const details = { location: supplier.location, serviceAreas: [...AREAS], categories: [...supplier.categories], accepts: [...supplier.accepts] };
    await db.merchant.upsert({ where: { id: supplier.id }, update: details, create: { id: supplier.id, name: supplier.name, status: supplier.status, ...details } });

    const total = supplier.completed + supplier.issues;
    const ids = Array.from({ length: total }, (_, index) => `demo_hist_${supplier.id}_${index + 1}`);
    const common = { amount: "60.00", currency: "EUR" };
    await db.assistanceRequest.createMany({ data: ids.map((id) => ({ id, message: "Synthetic past order for the supplier scorecard (demo only).", currency: "EUR", status: "COMPLETED" as const })), skipDuplicates: true });
    await db.aidAllocation.createMany({ data: ids.map((id) => ({ id, requestId: id, campaignId: HISTORY_CAMPAIGN, status: "DISBURSED" as const, ...common })), skipDuplicates: true });
    const fulfilment = (index: number) => (index < supplier.completed ? ("RECIPIENT_CONFIRMED" as const) : ("ISSUE_REPORTED" as const));
    await db.purchaseOrder.createMany({ data: ids.map((id, index) => ({ id, allocationId: id, merchantId: supplier.id, fulfilmentStatus: fulfilment(index), ...common })), skipDuplicates: true });
    await db.fulfilmentEvent.createMany({ data: ids.map((id, index) => ({ id, purchaseOrderId: id, status: fulfilment(index), note: "Synthetic order history (demo only)." })), skipDuplicates: true });

    for (const [index, description] of supplier.complaints.entries()) {
      const id = `demo_incident_${supplier.id}_${index + 1}`;
      await db.supplierIncident.upsert({ where: { id }, update: {}, create: { id, merchantId: supplier.id, severity: "MEDIUM", description } });
    }
  }
}
