-- Extend provider enum with Calendly-first integration support.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'CALENDLY';

-- CV extraction lifecycle enums.
CREATE TYPE "CvExtractionStatus" AS ENUM ('EXTRACTED', 'PARTIAL', 'UNSUPPORTED', 'FAILED');
CREATE TYPE "CvExtractionMethod" AS ENUM (
  'UTF8_PLAIN_TEXT',
  'PDF_PARSE',
  'DOCX_MAMMOTH',
  'DOC_LEGACY',
  'DOC_OS_CONVERSION',
  'METADATA_ONLY'
);

-- Assistant-led scheduling workflow enums.
CREATE TYPE "SchedulingWorkflowState" AS ENUM (
  'DRAFT',
  'COLLECTING_RECRUITER_AVAILABILITY',
  'COLLECTING_CANDIDATE_AVAILABILITY',
  'SLOT_PROPOSAL_READY',
  'SLOT_SELECTED',
  'BOOKING_IN_PROGRESS',
  'BOOKED',
  'RESCHEDULE_PENDING',
  'CANCELLED',
  'FAILED'
);
CREATE TYPE "SchedulingWorkflowStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CV parsed profile extraction metadata.
ALTER TABLE "CVParsedProfile"
ADD COLUMN "extractionStatus" "CvExtractionStatus" NOT NULL DEFAULT 'FAILED',
ADD COLUMN "extractionMethod" "CvExtractionMethod" NOT NULL DEFAULT 'METADATA_ONLY',
ADD COLUMN "extractionProvider" TEXT,
ADD COLUMN "extractionCharCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "extractionQuality" DECIMAL(65,30),
ADD COLUMN "extractionNotesJson" JSONB;

-- Per-run extraction lineage records.
CREATE TABLE "CVExtractionRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "cvFileId" TEXT NOT NULL,
  "aiTaskRunId" TEXT,
  "status" "CvExtractionStatus" NOT NULL,
  "method" "CvExtractionMethod" NOT NULL,
  "providerKey" TEXT NOT NULL,
  "charCount" INTEGER NOT NULL,
  "qualityScore" DECIMAL(65,30),
  "metadata" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CVExtractionRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CVExtractionRun_tenantId_candidateId_createdAt_idx"
ON "CVExtractionRun"("tenantId", "candidateId", "createdAt" DESC);
CREATE INDEX "CVExtractionRun_tenantId_cvFileId_createdAt_idx"
ON "CVExtractionRun"("tenantId", "cvFileId", "createdAt" DESC);
CREATE INDEX "CVExtractionRun_tenantId_aiTaskRunId_createdAt_idx"
ON "CVExtractionRun"("tenantId", "aiTaskRunId", "createdAt" DESC);

ALTER TABLE "CVExtractionRun"
ADD CONSTRAINT "CVExtractionRun_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CVExtractionRun"
ADD CONSTRAINT "CVExtractionRun_cvFileId_fkey"
FOREIGN KEY ("cvFileId") REFERENCES "CVFile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CVExtractionRun"
ADD CONSTRAINT "CVExtractionRun_aiTaskRunId_fkey"
FOREIGN KEY ("aiTaskRunId") REFERENCES "AiTaskRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Integration credential/token persistence.
CREATE TABLE "IntegrationCredential" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "authType" TEXT NOT NULL DEFAULT 'oauth2',
  "status" TEXT NOT NULL DEFAULT 'MISSING',
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenType" TEXT,
  "scope" TEXT,
  "expiresAt" TIMESTAMP(3),
  "refreshExpiresAt" TIMESTAMP(3),
  "idToken" TEXT,
  "metadata" JSONB,
  "lastRefreshedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationCredential_connectionId_key" ON "IntegrationCredential"("connectionId");
CREATE INDEX "IntegrationCredential_tenantId_provider_status_idx"
ON "IntegrationCredential"("tenantId", "provider", "status");
CREATE INDEX "IntegrationCredential_tenantId_expiresAt_idx"
ON "IntegrationCredential"("tenantId", "expiresAt");

ALTER TABLE "IntegrationCredential"
ADD CONSTRAINT "IntegrationCredential_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationCredential"
ADD CONSTRAINT "IntegrationCredential_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Scheduling notification template metadata.
ALTER TABLE "NotificationDelivery"
ADD COLUMN "templateKey" TEXT,
ADD COLUMN "eventType" TEXT;

-- Assistant-led scheduling runtime table.
CREATE TABLE "SchedulingWorkflow" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "sessionId" TEXT,
  "provider" "IntegrationProvider",
  "connectionId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'assistant',
  "state" "SchedulingWorkflowState" NOT NULL DEFAULT 'DRAFT',
  "status" "SchedulingWorkflowStatus" NOT NULL DEFAULT 'ACTIVE',
  "recruiterConstraintsJson" JSONB,
  "candidateAvailabilityJson" JSONB,
  "proposedSlotsJson" JSONB,
  "selectedSlotJson" JSONB,
  "bookingResultJson" JSONB,
  "conversationContextJson" JSONB,
  "lastError" TEXT,
  "initiatedBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchedulingWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchedulingWorkflow_tenantId_applicationId_createdAt_idx"
ON "SchedulingWorkflow"("tenantId", "applicationId", "createdAt" DESC);
CREATE INDEX "SchedulingWorkflow_tenantId_status_state_updatedAt_idx"
ON "SchedulingWorkflow"("tenantId", "status", "state", "updatedAt" DESC);
CREATE INDEX "SchedulingWorkflow_tenantId_sessionId_createdAt_idx"
ON "SchedulingWorkflow"("tenantId", "sessionId", "createdAt" DESC);

ALTER TABLE "SchedulingWorkflow"
ADD CONSTRAINT "SchedulingWorkflow_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulingWorkflow"
ADD CONSTRAINT "SchedulingWorkflow_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulingWorkflow"
ADD CONSTRAINT "SchedulingWorkflow_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
