-- CreateTable
CREATE TABLE "CVFileBlob" (
    "cvFileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentBytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CVFileBlob_pkey" PRIMARY KEY ("cvFileId")
);

-- CreateIndex
CREATE INDEX "CVFileBlob_tenantId_createdAt_idx" ON "CVFileBlob"("tenantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "CVFileBlob" ADD CONSTRAINT "CVFileBlob_cvFileId_fkey" FOREIGN KEY ("cvFileId") REFERENCES "CVFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
