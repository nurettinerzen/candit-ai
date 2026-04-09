-- AlterTable
ALTER TABLE "InterviewSession"
ADD COLUMN "invitationStatus" TEXT,
ADD COLUMN "invitationIssuedAt" TIMESTAMP(3),
ADD COLUMN "invitationReminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "invitationReminder1SentAt" TIMESTAMP(3),
ADD COLUMN "invitationReminder2SentAt" TIMESTAMP(3);

-- Backfill existing direct AI invite sessions so they continue to work with the new model
UPDATE "InterviewSession"
SET
  "invitationStatus" = CASE
    WHEN "status" = 'COMPLETED' THEN 'COMPLETED'
    WHEN "status" IN ('FAILED', 'CANCELLED') THEN 'FAILED'
    WHEN "status" = 'NO_SHOW' THEN 'EXPIRED'
    WHEN "status" = 'RUNNING' THEN 'IN_PROGRESS'
    ELSE 'SENT'
  END,
  "invitationIssuedAt" = COALESCE("scheduledAt", "createdAt")
WHERE "mode" = 'VOICE'
  AND "schedulingSource" IN ('recruiter_direct_invite', 'recruiter_direct_ai_invite_v1');

CREATE INDEX "InterviewSession_tenantId_invitationStatus_candidateAccessEx_idx"
ON "InterviewSession"("tenantId", "invitationStatus", "candidateAccessExpiresAt");
