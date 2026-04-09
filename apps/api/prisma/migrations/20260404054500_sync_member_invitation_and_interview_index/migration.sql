-- Align database state with current Prisma schema so migrate runs non-interactively.
ALTER TABLE "MemberInvitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER INDEX "InterviewSession_tenantId_invitationStatus_candidateAccessEx_idx"
RENAME TO "InterviewSession_tenantId_invitationStatus_candidateAccessE_idx";
