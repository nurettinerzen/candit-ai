-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "aiDraftText" TEXT;

-- AlterTable
ALTER TABLE "PlatformIncident" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PublicLeadSubmission" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PublicLeadSubmission_normalizedEmail_idx" ON "PublicLeadSubmission"("normalizedEmail");
