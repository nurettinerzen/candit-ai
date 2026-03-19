-- AlterTable
ALTER TABLE "CVFile"
ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local_fs',
ADD COLUMN "checksumSha256" TEXT,
ADD COLUMN "uploadedBy" TEXT,
ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill legacy rows
UPDATE "CVFile"
SET "uploadedBy" = 'system:legacy'
WHERE "uploadedBy" IS NULL;

-- Finalize non-null ownership column
ALTER TABLE "CVFile"
ALTER COLUMN "uploadedBy" SET NOT NULL;

-- AlterTable
ALTER TABLE "CVParsedProfile"
ADD COLUMN "aiTaskRunId" TEXT,
ADD COLUMN "providerMode" TEXT NOT NULL DEFAULT 'deterministic_fallback',
ADD COLUMN "providerKey" TEXT,
ADD COLUMN "modelKey" TEXT,
ADD COLUMN "uncertaintyJson" JSONB,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep updatedAt aligned with existing historical records
UPDATE "CVParsedProfile"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "CVParsedProfile"
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "CVFile_tenantId_candidateId_uploadedAt_idx"
ON "CVFile"("tenantId", "candidateId", "uploadedAt" DESC);

-- CreateIndex
CREATE INDEX "CVFile_tenantId_candidateId_isPrimary_idx"
ON "CVFile"("tenantId", "candidateId", "isPrimary");

-- CreateIndex
CREATE INDEX "CVParsedProfile_tenantId_aiTaskRunId_idx"
ON "CVParsedProfile"("tenantId", "aiTaskRunId");

-- AddForeignKey
ALTER TABLE "CVParsedProfile"
ADD CONSTRAINT "CVParsedProfile_aiTaskRunId_fkey"
FOREIGN KEY ("aiTaskRunId") REFERENCES "AiTaskRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
