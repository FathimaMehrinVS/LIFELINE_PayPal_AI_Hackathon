ALTER TABLE "AssistanceRequest" ADD COLUMN "createdById" TEXT;

CREATE INDEX "AssistanceRequest_createdById_idx" ON "AssistanceRequest"("createdById");

ALTER TABLE "AssistanceRequest"
ADD CONSTRAINT "AssistanceRequest_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
