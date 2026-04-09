-- CreateEnum
CREATE TYPE "SourcingProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourcingProspectStage" AS ENUM ('NEW', 'NEEDS_REVIEW', 'GOOD_FIT', 'SAVED', 'CONTACTED', 'REPLIED', 'CONVERTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProspectFitLabel" AS ENUM ('STRONG_MATCH', 'GOOD_MATCH', 'PARTIAL_MATCH', 'WEAK_MATCH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TalentSourceKind" AS ENUM ('INTERNAL_CANDIDATE', 'PUBLIC_PROFESSIONAL', 'RECRUITER_IMPORT', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactSuppressionStatus" AS ENUM ('ALLOWED', 'DO_NOT_CONTACT', 'OPTED_OUT', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "OutreachMessageStatus" AS ENUM ('DRAFT', 'READY_TO_SEND', 'SENT', 'FAILED', 'REPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TalentProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT,
    "fullName" TEXT NOT NULL,
    "normalizedEmail" TEXT,
    "normalizedPhone" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "headline" TEXT,
    "summary" TEXT,
    "locationText" TEXT,
    "currentTitle" TEXT,
    "currentCompany" TEXT,
    "yearsOfExperience" DECIMAL(65,30),
    "workModel" TEXT,
    "salaryExpectationMin" DECIMAL(65,30),
    "salaryExpectationMax" DECIMAL(65,30),
    "sourceKind" "TalentSourceKind" NOT NULL DEFAULT 'OTHER',
    "primarySourceLabel" TEXT,
    "suppressionStatus" "ContactSuppressionStatus" NOT NULL DEFAULT 'ALLOWED',
    "doNotContactReason" TEXT,
    "skillTagsJson" JSONB,
    "languageTagsJson" JSONB,
    "educationJson" JSONB,
    "experienceJson" JSONB,
    "contactSignalsJson" JSONB,
    "marketSignalsJson" JSONB,
    "sourceMetadataJson" JSONB,
    "lastEnrichedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProfileSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "talentProfileId" TEXT NOT NULL,
    "sourceKind" "TalentSourceKind" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerLabel" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalRef" TEXT,
    "sourceUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentProfileSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "name" TEXT NOT NULL,
    "personaSummary" TEXT,
    "searchQuery" TEXT,
    "filtersJson" JSONB,
    "notes" TEXT,
    "status" "SourcingProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "stageGoalsJson" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SourcingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingProjectProspect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "talentProfileId" TEXT NOT NULL,
    "attachedCandidateId" TEXT,
    "attachedApplicationId" TEXT,
    "stage" "SourcingProspectStage" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "fitLabel" "ProspectFitLabel" NOT NULL DEFAULT 'UNKNOWN',
    "fitScore" DECIMAL(65,30),
    "fitConfidence" DECIMAL(65,30),
    "strengthsJson" JSONB,
    "risksJson" JSONB,
    "missingInfoJson" JSONB,
    "evidenceJson" JSONB,
    "recruiterNote" TEXT,
    "contactState" TEXT,
    "sourceSnapshotJson" JSONB,
    "lastReviewedAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingProjectProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingOutreachTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "sequenceJson" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingOutreachTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingOutreachMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectProspectId" TEXT NOT NULL,
    "templateId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "OutreachMessageStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reviewNote" TEXT,
    "providerKey" TEXT,
    "providerMessageId" TEXT,
    "sendError" TEXT,
    "reviewedBy" TEXT,
    "sentBy" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingOutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_candidateId_key" ON "TalentProfile"("candidateId");

-- CreateIndex
CREATE INDEX "TalentProfile_tenantId_createdAt_idx" ON "TalentProfile"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TalentProfile_tenantId_sourceKind_idx" ON "TalentProfile"("tenantId", "sourceKind");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_tenantId_normalizedEmail_key" ON "TalentProfile"("tenantId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_tenantId_normalizedPhone_key" ON "TalentProfile"("tenantId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "TalentProfileSource_tenantId_talentProfileId_createdAt_idx" ON "TalentProfileSource"("tenantId", "talentProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TalentProfileSource_tenantId_sourceKind_providerKey_idx" ON "TalentProfileSource"("tenantId", "sourceKind", "providerKey");

-- CreateIndex
CREATE INDEX "SourcingProject_tenantId_createdAt_idx" ON "SourcingProject"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SourcingProject_tenantId_jobId_idx" ON "SourcingProject"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "SourcingProject_tenantId_status_idx" ON "SourcingProject"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SourcingProjectProspect_tenantId_projectId_stage_idx" ON "SourcingProjectProspect"("tenantId", "projectId", "stage");

-- CreateIndex
CREATE INDEX "SourcingProjectProspect_tenantId_attachedCandidateId_idx" ON "SourcingProjectProspect"("tenantId", "attachedCandidateId");

-- CreateIndex
CREATE INDEX "SourcingProjectProspect_tenantId_attachedApplicationId_idx" ON "SourcingProjectProspect"("tenantId", "attachedApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcingProjectProspect_tenantId_projectId_talentProfileId_key" ON "SourcingProjectProspect"("tenantId", "projectId", "talentProfileId");

-- CreateIndex
CREATE INDEX "SourcingOutreachTemplate_tenantId_createdAt_idx" ON "SourcingOutreachTemplate"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SourcingOutreachTemplate_tenantId_projectId_idx" ON "SourcingOutreachTemplate"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "SourcingOutreachMessage_tenantId_projectProspectId_createdA_idx" ON "SourcingOutreachMessage"("tenantId", "projectProspectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SourcingOutreachMessage_tenantId_status_createdAt_idx" ON "SourcingOutreachMessage"("tenantId", "status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfileSource" ADD CONSTRAINT "TalentProfileSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfileSource" ADD CONSTRAINT "TalentProfileSource_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingProject" ADD CONSTRAINT "SourcingProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingProject" ADD CONSTRAINT "SourcingProject_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingProjectProspect" ADD CONSTRAINT "SourcingProjectProspect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingProjectProspect" ADD CONSTRAINT "SourcingProjectProspect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SourcingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingProjectProspect" ADD CONSTRAINT "SourcingProjectProspect_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingOutreachTemplate" ADD CONSTRAINT "SourcingOutreachTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingOutreachTemplate" ADD CONSTRAINT "SourcingOutreachTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SourcingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingOutreachMessage" ADD CONSTRAINT "SourcingOutreachMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingOutreachMessage" ADD CONSTRAINT "SourcingOutreachMessage_projectProspectId_fkey" FOREIGN KEY ("projectProspectId") REFERENCES "SourcingProjectProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingOutreachMessage" ADD CONSTRAINT "SourcingOutreachMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SourcingOutreachTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

