ALTER TYPE "ApplicationStage" ADD VALUE IF NOT EXISTS 'TALENT_POOL';
ALTER TYPE "ApplicationStage" ADD VALUE IF NOT EXISTS 'SHORTLISTED';

ALTER TABLE "Tenant"
ADD COLUMN "hiringSettingsJson" JSONB;

CREATE TABLE "ReferenceCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "referenceName" TEXT NOT NULL,
    "companyName" TEXT,
    "relationship" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "openEndedResponsesJson" JSONB,
    "closedEndedResponsesJson" JSONB,
    "summaryText" TEXT,
    "createdBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReferenceCheck_tenantId_applicationId_createdAt_idx"
ON "ReferenceCheck"("tenantId", "applicationId", "createdAt" DESC);

CREATE INDEX "ReferenceCheck_tenantId_status_createdAt_idx"
ON "ReferenceCheck"("tenantId", "status", "createdAt" DESC);

ALTER TABLE "ReferenceCheck"
ADD CONSTRAINT "ReferenceCheck_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferenceCheck"
ADD CONSTRAINT "ReferenceCheck_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
