ALTER TYPE "AllocationStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "FulfilmentStatus" ADD VALUE 'VERIFIED';

ALTER TABLE "PurchaseOrder" ADD COLUMN "partnerUserId" TEXT;
ALTER TABLE "FulfilmentEvent" ADD COLUMN "deliveredItems" JSONB;

CREATE INDEX "PurchaseOrder_partnerUserId_idx" ON "PurchaseOrder"("partnerUserId");

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_partnerUserId_fkey"
FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
