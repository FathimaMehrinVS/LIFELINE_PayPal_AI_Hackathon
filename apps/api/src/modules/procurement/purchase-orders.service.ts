import type { AuthSession } from "../../auth/session";
import type { PurchaseOrder } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
import { HttpError } from "../../utils/http-error";

type Database = ReturnType<typeof getPrisma>;

const include = {
  merchant: { select: { id: true, name: true } },
  events: { orderBy: { createdAt: "asc" as const } },
  allocation: { include: { request: { include: { basket: { include: { items: true } } } } } },
} satisfies Prisma.PurchaseOrderInclude;

function mapOrder(order: Prisma.PurchaseOrderGetPayload<{ include: typeof include }>): PurchaseOrder {
  const items = order.allocation.request.basket?.items ?? [];
  return {
    purchase_order_id: order.id,
    allocation_id: order.allocationId,
    merchant_id: order.merchantId,
    supplier_name: order.merchant.name,
    amount: order.amount.toNumber(),
    currency: order.currency,
    status: order.fulfilmentStatus.toLowerCase() as PurchaseOrder["status"],
    expected_ready_at: order.expectedReadyAt?.toISOString() ?? null,
    items: items.map((item) => ({
      basket_item_id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit_price: item.unitPrice.toNumber(),
      subtotal: item.subtotal.toNumber(),
    })),
    events: order.events.map((event) => ({
      status: event.status.toLowerCase() as PurchaseOrder["events"][number]["status"],
      actor_id: event.actorId,
      note: event.note,
      evidence_type: event.evidenceType?.toLowerCase() ?? null,
      delivered_items: Array.isArray(event.deliveredItems)
        ? event.deliveredItems.flatMap((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
            const row = entry as Record<string, Prisma.JsonValue>;
            return typeof row.basket_item_id === "string" && typeof row.name === "string" && typeof row.quantity === "number"
              ? [{ basket_item_id: row.basket_item_id, name: row.name, quantity: row.quantity }]
              : [];
          })
        : [],
      at: event.createdAt.toISOString(),
    })),
  };
}

/** NGO users may view every order; a delivery partner only sees orders explicitly assigned to their profile. */
export async function listPurchaseOrders(db: Database, session: AuthSession): Promise<PurchaseOrder[]> {
  const rows = await db.purchaseOrder.findMany({
    where: session.role === "NGO" ? undefined : { partnerUserId: session.id },
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapOrder);
}

export async function getPurchaseOrderAllocationId(db: Database, orderId: string, session: AuthSession): Promise<string> {
  const order = await db.purchaseOrder.findUnique({
    where: { id: orderId },
    select: { allocationId: true, partnerUserId: true },
  });
  if (!order || (session.role !== "NGO" && order.partnerUserId !== session.id)) {
    throw new HttpError("NOT_FOUND", "Purchase order not found");
  }
  return order.allocationId;
}
