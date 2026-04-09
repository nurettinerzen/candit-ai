-- CreateTable
CREATE TABLE "BillingTrialClaim" (
    "id" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "emailDomain" TEXT,
    "firstTenantId" TEXT NOT NULL,
    "firstUserId" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "metadataJson" JSONB,

    CONSTRAINT "BillingTrialClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingTrialClaim_normalizedEmail_key" ON "BillingTrialClaim"("normalizedEmail");

-- CreateIndex
CREATE INDEX "BillingTrialClaim_emailDomain_claimedAt_idx" ON "BillingTrialClaim"("emailDomain", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "BillingTrialClaim_firstTenantId_claimedAt_idx" ON "BillingTrialClaim"("firstTenantId", "claimedAt" DESC);
