-- AlterEnum
ALTER TYPE "InterviewSessionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterEnum
ALTER TYPE "DomainEventStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- CreateEnum
CREATE TYPE "AuthSessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TranscriptQualityStatus" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "InterviewSession"
ADD COLUMN "rubricKey" TEXT,
ADD COLUMN "rubricVersion" INTEGER,
ADD COLUMN "completionAutomationQueuedAt" TIMESTAMP(3),
ADD COLUMN "completionAutomationRunAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transcript"
ADD COLUMN "ownerType" TEXT NOT NULL DEFAULT 'INTERVIEW_SESSION',
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "qualityStatus" "TranscriptQualityStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "qualityReviewedAt" TIMESTAMP(3),
ADD COLUMN "qualityReviewedBy" TEXT,
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "retentionLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Transcript" SET "ownerId" = "sessionId" WHERE "ownerId" IS NULL;
ALTER TABLE "Transcript" ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AiReport"
ADD COLUMN "transcriptId" TEXT,
ADD COLUMN "rubricKey" TEXT,
ADD COLUMN "rubricVersion" INTEGER;

-- AlterTable
ALTER TABLE "ApplicationRecommendation"
ADD COLUMN "sessionId" TEXT,
ADD COLUMN "rubricKey" TEXT,
ADD COLUMN "rubricVersion" INTEGER;

-- AlterTable
ALTER TABLE "DomainEvent"
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT,
ADD COLUMN "processedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AuthSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "authMode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRefreshToken" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "parentTokenId" TEXT,
  "replacedByTokenId" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,

  CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentityMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "internalEntityType" TEXT NOT NULL,
  "internalEntityId" TEXT NOT NULL,
  "externalTenantId" TEXT,
  "externalEntityType" TEXT NOT NULL,
  "externalEntityId" TEXT NOT NULL,
  "externalParentId" TEXT,
  "metadata" JSONB,
  "firstMappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalIdentityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "displayName" TEXT,
  "configJson" JSONB NOT NULL,
  "credentialsJson" JSONB NOT NULL,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "providerKey" TEXT,
  "providerMessageId" TEXT,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "metadata" JSONB,
  "requestedBy" TEXT,
  "traceId" TEXT,
  "errorMessage" TEXT,
  "domainEventId" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewSession_tenantId_applicationId_endedAt_idx" ON "InterviewSession"("tenantId", "applicationId", "endedAt" DESC);

-- CreateIndex
CREATE INDEX "Transcript_tenantId_ownerType_ownerId_idx" ON "Transcript"("tenantId", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Transcript_tenantId_qualityStatus_createdAt_idx" ON "Transcript"("tenantId", "qualityStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiReport_tenantId_sessionId_createdAt_idx" ON "AiReport"("tenantId", "sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ApplicationRecommendation_tenantId_sessionId_createdAt_idx" ON "ApplicationRecommendation"("tenantId", "sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DomainEvent_status_availableAt_createdAt_idx" ON "DomainEvent"("status", "availableAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DomainEvent_lockedAt_idx" ON "DomainEvent"("lockedAt");

-- CreateIndex
CREATE INDEX "AuthSession_tenantId_userId_status_idx" ON "AuthSession"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "AuthSession_tenantId_status_createdAt_idx" ON "AuthSession"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key" ON "AuthRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_sessionId_expiresAt_idx" ON "AuthRefreshToken"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_tenantId_userId_issuedAt_idx" ON "AuthRefreshToken"("tenantId", "userId", "issuedAt" DESC);

-- CreateIndex
CREATE INDEX "AuthRefreshToken_revokedAt_idx" ON "AuthRefreshToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ext_idmap_ext_uidx" ON "ExternalIdentityMapping"("tenantId", "provider", "externalEntityType", "externalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ext_idmap_int_uidx" ON "ExternalIdentityMapping"("tenantId", "provider", "internalEntityType", "internalEntityId", "externalEntityType");

-- CreateIndex
CREATE INDEX "ext_idmap_int_idx" ON "ExternalIdentityMapping"("tenantId", "provider", "internalEntityType", "internalEntityId");

-- CreateIndex
CREATE INDEX "ext_idmap_ext_idx" ON "ExternalIdentityMapping"("tenantId", "provider", "externalEntityType", "externalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_tenantId_provider_key" ON "IntegrationConnection"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationConnection_tenantId_status_idx" ON "IntegrationConnection"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_status_queuedAt_idx" ON "NotificationDelivery"("tenantId", "status", "queuedAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_channel_queuedAt_idx" ON "NotificationDelivery"("tenantId", "channel", "queuedAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_domainEventId_idx" ON "NotificationDelivery"("domainEventId");

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecommendation" ADD CONSTRAINT "ApplicationRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "AuthRefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_replacedByTokenId_fkey" FOREIGN KEY ("replacedByTokenId") REFERENCES "AuthRefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentityMapping" ADD CONSTRAINT "ExternalIdentityMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
