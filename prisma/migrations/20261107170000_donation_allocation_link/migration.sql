-- Keep existing campaign donations valid while linking new donations to their approved assistance allocation.
ALTER TABLE "Donation" ADD COLUMN "allocationId" TEXT;

CREATE INDEX "Donation_allocationId_idx" ON "Donation"("allocationId");

ALTER TABLE "Donation"
ADD CONSTRAINT "Donation_allocationId_fkey"
FOREIGN KEY ("allocationId") REFERENCES "AidAllocation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
