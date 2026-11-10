-- Closes direct access through Supabase's public API. The browser's public key must not reach these tables.
-- No policies are added on purpose, so the anon and authenticated roles get no rows.
-- The API connects as the table owner and is not affected. Any new table needs the same line.

ALTER TABLE "AidAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Basket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BasketItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Donation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FulfilmentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Merchant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SituationAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
