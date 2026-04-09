-- CreateEnum
CREATE TYPE "BillingPlanKey" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingAccountStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BillingQuotaKey" AS ENUM ('SEATS', 'ACTIVE_JOBS', 'CANDIDATE_PROCESSING', 'AI_INTERVIEWS');

-- CreateEnum
CREATE TYPE "BillingGrantSource" AS ENUM ('PLAN', 'ADDON', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillingCheckoutType" AS ENUM ('PLAN_SUBSCRIPTION', 'ADDON_PURCHASE', 'ENTERPRISE_OFFER');

-- CreateEnum
CREATE TYPE "BillingCheckoutStatus" AS ENUM ('OPEN', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingAddonKey" AS ENUM ('INTERVIEW_PACK_25', 'CANDIDATE_PROCESSING_PACK_100', 'PROFESSIONAL_ONBOARDING', 'CUSTOM_INTEGRATION_SETUP');

-- CreateTable
CREATE TABLE "TenantBillingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingEmail" TEXT,
    "stripeCustomerId" TEXT,
    "currentPlanKey" "BillingPlanKey" NOT NULL DEFAULT 'STARTER',
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeSubscriptionId" TEXT,
    "lastCheckoutSessionId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "featuresJson" JSONB,
    "planSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBillingSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "planKey" "BillingPlanKey" NOT NULL,
    "status" "BillingAccountStatus" NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeCustomerId" TEXT,
    "billingEmail" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "seatsIncluded" INTEGER NOT NULL,
    "activeJobsIncluded" INTEGER NOT NULL,
    "candidateProcessingIncluded" INTEGER NOT NULL,
    "aiInterviewsIncluded" INTEGER NOT NULL,
    "featuresJson" JSONB,
    "metadataJson" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "TenantBillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingQuotaGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "quotaKey" "BillingQuotaKey" NOT NULL,
    "source" "BillingGrantSource" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingQuotaGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "quotaKey" "BillingQuotaKey" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metadataJson" JSONB,

    CONSTRAINT "BillingUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCheckoutSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "checkoutType" "BillingCheckoutType" NOT NULL,
    "status" "BillingCheckoutStatus" NOT NULL DEFAULT 'OPEN',
    "stripeCheckoutSessionId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planKey" "BillingPlanKey",
    "addOnKey" "BillingAddonKey",
    "label" TEXT,
    "billingEmail" TEXT,
    "checkoutUrl" TEXT,
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "payloadJson" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BillingCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBillingAccount_tenantId_key" ON "TenantBillingAccount"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBillingAccount_stripeCustomerId_key" ON "TenantBillingAccount"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBillingAccount_stripeSubscriptionId_key" ON "TenantBillingAccount"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "TenantBillingAccount_currentPlanKey_status_idx" ON "TenantBillingAccount"("currentPlanKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBillingSubscription_stripeSubscriptionId_key" ON "TenantBillingSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "TenantBillingSubscription_tenantId_status_createdAt_idx" ON "TenantBillingSubscription"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TenantBillingSubscription_accountId_createdAt_idx" ON "TenantBillingSubscription"("accountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingQuotaGrant_tenantId_quotaKey_createdAt_idx" ON "BillingQuotaGrant"("tenantId", "quotaKey", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingQuotaGrant_accountId_quotaKey_createdAt_idx" ON "BillingQuotaGrant"("accountId", "quotaKey", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingQuotaGrant_expiresAt_idx" ON "BillingQuotaGrant"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingUsageEvent_uniqueKey_key" ON "BillingUsageEvent"("uniqueKey");

-- CreateIndex
CREATE INDEX "BillingUsageEvent_tenantId_quotaKey_occurredAt_idx" ON "BillingUsageEvent"("tenantId", "quotaKey", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "BillingUsageEvent_accountId_quotaKey_occurredAt_idx" ON "BillingUsageEvent"("accountId", "quotaKey", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "BillingUsageEvent_entityType_entityId_idx" ON "BillingUsageEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutSession_stripeCheckoutSessionId_key" ON "BillingCheckoutSession"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_tenantId_checkoutType_createdAt_idx" ON "BillingCheckoutSession"("tenantId", "checkoutType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_accountId_createdAt_idx" ON "BillingCheckoutSession"("accountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_status_createdAt_idx" ON "BillingCheckoutSession"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "TenantBillingAccount" ADD CONSTRAINT "TenantBillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBillingSubscription" ADD CONSTRAINT "TenantBillingSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBillingSubscription" ADD CONSTRAINT "TenantBillingSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TenantBillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingQuotaGrant" ADD CONSTRAINT "BillingQuotaGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingQuotaGrant" ADD CONSTRAINT "BillingQuotaGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TenantBillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingQuotaGrant" ADD CONSTRAINT "BillingQuotaGrant_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantBillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageEvent" ADD CONSTRAINT "BillingUsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageEvent" ADD CONSTRAINT "BillingUsageEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TenantBillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutSession" ADD CONSTRAINT "BillingCheckoutSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutSession" ADD CONSTRAINT "BillingCheckoutSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TenantBillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
