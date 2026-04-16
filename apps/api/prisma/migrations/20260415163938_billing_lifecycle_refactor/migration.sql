-- CreateEnum
CREATE TYPE "BillingPlanChangeKind" AS ENUM ('UPGRADE', 'DOWNGRADE', 'FLEX_TRANSITION');

-- DropIndex
DROP INDEX "TenantBillingSubscription_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "TenantBillingAccount" ADD COLUMN     "lastReconciledAt" TIMESTAMP(3),
ADD COLUMN     "pendingChangeEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "pendingChangeKind" "BillingPlanChangeKind",
ADD COLUMN     "pendingChangeMetadataJson" JSONB,
ADD COLUMN     "pendingChangeRequestedAt" TIMESTAMP(3),
ADD COLUMN     "pendingChangeRequestedBy" TEXT,
ADD COLUMN     "pendingPlanKey" "BillingPlanKey";

-- CreateIndex
CREATE INDEX "TenantBillingSubscription_stripeSubscriptionId_createdAt_idx" ON "TenantBillingSubscription"("stripeSubscriptionId", "createdAt" DESC);
