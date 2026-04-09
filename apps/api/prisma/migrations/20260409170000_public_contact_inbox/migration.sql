CREATE TYPE "PublicLeadStatus" AS ENUM ('NEW', 'REVIEWING', 'CONTACTED', 'ARCHIVED');

CREATE TABLE "PublicLeadSubmission" (
  "id" TEXT NOT NULL,
  "status" "PublicLeadStatus" NOT NULL DEFAULT 'NEW',
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "company" TEXT,
  "phone" TEXT,
  "role" TEXT,
  "teamSize" TEXT,
  "message" TEXT,
  "sourcePage" TEXT,
  "landingUrl" TEXT,
  "referrerUrl" TEXT,
  "locale" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmTerm" TEXT,
  "utmContent" TEXT,
  "ipAddressHash" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "submissionCount" INTEGER NOT NULL DEFAULT 1,
  "lastSubmittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opsNotificationStatus" "NotificationDeliveryStatus",
  "opsNotificationProvider" TEXT,
  "opsNotificationError" TEXT,
  "opsNotificationLastTriedAt" TIMESTAMP(3),
  "opsNotificationSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PublicLeadSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicLeadSubmission_normalizedEmail_key" ON "PublicLeadSubmission"("normalizedEmail");
CREATE INDEX "PublicLeadSubmission_status_lastSubmittedAt_idx" ON "PublicLeadSubmission"("status", "lastSubmittedAt" DESC);
CREATE INDEX "PublicLeadSubmission_ipAddressHash_lastSubmittedAt_idx" ON "PublicLeadSubmission"("ipAddressHash", "lastSubmittedAt" DESC);
