-- AlterEnum
ALTER TYPE "AiTaskType" ADD VALUE 'APPLICANT_FIT_SCORING';

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "externalSource" TEXT,
ADD COLUMN     "locationText" TEXT,
ADD COLUMN     "yearsOfExperience" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "ApplicantFitScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "aiTaskRunId" TEXT,
    "overallScore" DECIMAL(65,30) NOT NULL,
    "confidence" DECIMAL(65,30) NOT NULL,
    "subScoresJson" JSONB NOT NULL,
    "strengthsJson" JSONB,
    "risksJson" JSONB,
    "missingInfoJson" JSONB,
    "reasoningJson" JSONB,
    "modelKey" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantFitScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "noteText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicantFitScore_tenantId_applicationId_createdAt_idx" ON "ApplicantFitScore"("tenantId", "applicationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ApplicantFitScore_tenantId_overallScore_idx" ON "ApplicantFitScore"("tenantId", "overallScore" DESC);

-- CreateIndex
CREATE INDEX "RecruiterNote_tenantId_applicationId_createdAt_idx" ON "RecruiterNote"("tenantId", "applicationId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ApplicantFitScore" ADD CONSTRAINT "ApplicantFitScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantFitScore" ADD CONSTRAINT "ApplicantFitScore_aiTaskRunId_fkey" FOREIGN KEY ("aiTaskRunId") REFERENCES "AiTaskRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterNote" ADD CONSTRAINT "RecruiterNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
