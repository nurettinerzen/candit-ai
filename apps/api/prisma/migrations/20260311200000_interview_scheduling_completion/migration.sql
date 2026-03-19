-- AlterEnum
ALTER TYPE "InterviewMode" ADD VALUE IF NOT EXISTS 'MEETING_LINK';
ALTER TYPE "InterviewMode" ADD VALUE IF NOT EXISTS 'PHONE';
ALTER TYPE "InterviewMode" ADD VALUE IF NOT EXISTS 'ONSITE';

-- AlterTable
ALTER TABLE "InterviewSession"
ADD COLUMN "scheduledBy" TEXT,
ADD COLUMN "schedulingSource" TEXT NOT NULL DEFAULT 'manual_recruiter',
ADD COLUMN "scheduleNote" TEXT,
ADD COLUMN "interviewerName" TEXT,
ADD COLUMN "interviewerUserId" TEXT,
ADD COLUMN "interviewType" TEXT,
ADD COLUMN "modeContextJson" JSONB,
ADD COLUMN "meetingProvider" "IntegrationProvider",
ADD COLUMN "meetingProviderSource" TEXT,
ADD COLUMN "meetingConnectionId" TEXT,
ADD COLUMN "meetingJoinUrl" TEXT,
ADD COLUMN "meetingExternalRef" TEXT,
ADD COLUMN "meetingCalendarEventRef" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledBy" TEXT,
ADD COLUMN "cancelReasonCode" TEXT,
ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRescheduledAt" TIMESTAMP(3),
ADD COLUMN "lastRescheduledBy" TEXT,
ADD COLUMN "lastRescheduleReasonCode" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill updatedAt from createdAt for historical records.
UPDATE "InterviewSession"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "InterviewSession"
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Transcript"
ADD COLUMN "ingestionMethod" TEXT NOT NULL DEFAULT 'stream_segments',
ADD COLUMN "ingestionStatus" TEXT NOT NULL DEFAULT 'available',
ADD COLUMN "reviewNotes" TEXT,
ADD COLUMN "lastIngestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InterviewSession_tenantId_applicationId_createdAt_idx"
ON "InterviewSession"("tenantId", "applicationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InterviewSession_tenantId_meetingProvider_idx"
ON "InterviewSession"("tenantId", "meetingProvider");
