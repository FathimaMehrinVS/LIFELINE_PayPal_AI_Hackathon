-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('AWAITING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'HANDED_OVER', 'RECIPIENT_CONFIRMED', 'ISSUE_REPORTED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('NGO_CONFIRMATION', 'SUPPLIER_CONFIRMATION', 'PICKUP_CODE', 'RECIPIENT_ACKNOWLEDGEMENT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contact" TEXT,
ADD COLUMN     "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" "SupplierStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "purchaseOrderId" TEXT,
ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "fulfilmentStatus" "FulfilmentStatus" NOT NULL DEFAULT 'AWAITING_ACCEPTANCE',
    "pickupCodeHash" TEXT,
    "pickupAttempts" INTEGER NOT NULL DEFAULT 0,
    "expectedReadyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentEvent" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "status" "FulfilmentStatus" NOT NULL,
    "actorId" TEXT,
    "evidenceType" "EvidenceType",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfilmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierIncident" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_allocationId_key" ON "PurchaseOrder"("allocationId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_merchantId_idx" ON "PurchaseOrder"("merchantId");

-- CreateIndex
CREATE INDEX "FulfilmentEvent_purchaseOrderId_createdAt_idx" ON "FulfilmentEvent"("purchaseOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierIncident_merchantId_status_idx" ON "SupplierIncident"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Payout_purchaseOrderId_idx" ON "Payout"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "AidAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentEvent" ADD CONSTRAINT "FulfilmentEvent_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentEvent" ADD CONSTRAINT "FulfilmentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierIncident" ADD CONSTRAINT "SupplierIncident_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierIncident" ADD CONSTRAINT "SupplierIncident_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

