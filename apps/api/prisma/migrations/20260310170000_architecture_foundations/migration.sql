-- CreateEnum
CREATE TYPE "AiTaskType" AS ENUM (
  'CV_PARSING',
  'JOB_REQUIREMENT_INTERPRETATION',
  'CANDIDATE_FIT_ASSISTANCE',
  'SCREENING_SUPPORT',
  'INTERVIEW_PREPARATION',
  'INTERVIEW_ORCHESTRATION',
  'TRANSCRIPT_SUMMARIZATION',
  'REPORT_GENERATION',
  'RECOMMENDATION_GENERATION'
);

-- CreateEnum
CREATE TYPE "AiTaskStatus" AS ENUM (
  'PENDING',
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'NEEDS_REVIEW'
);

-- CreateEnum
CREATE TYPE "AiAutomationLevel" AS ENUM (
  'ASSISTED',
  'MANUAL_WITH_AI_SUPPORT',
  'AUTOMATED'
);

-- CreateEnum
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "AiPromptTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "stage" "AiTaskType" NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'tr',
  "systemPrompt" TEXT NOT NULL,
  "userPrompt" TEXT,
  "outputSchema" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRubric" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  "rubricJson" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScoringRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTaskRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "taskType" "AiTaskType" NOT NULL,
  "status" "AiTaskStatus" NOT NULL DEFAULT 'PENDING',
  "automationLevel" "AiAutomationLevel" NOT NULL DEFAULT 'ASSISTED',
  "candidateId" TEXT,
  "jobId" TEXT,
  "applicationId" TEXT,
  "sessionId" TEXT,
  "aiReportId" TEXT,
  "promptTemplateId" TEXT,
  "rubricId" TEXT,
  "workflowJobId" TEXT,
  "inputJson" JSONB NOT NULL,
  "outputJson" JSONB,
  "uncertaintyJson" JSONB,
  "guardrailFlags" JSONB,
  "providerKey" TEXT,
  "modelKey" TEXT,
  "promptVersion" TEXT,
  "policyVersion" TEXT,
  "requestedBy" TEXT NOT NULL,
  "humanApprovedBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiTaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRecommendation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "aiTaskRunId" TEXT,
  "recommendation" "Recommendation" NOT NULL,
  "confidence" DECIMAL(65,30) NOT NULL,
  "summaryText" TEXT NOT NULL,
  "rationaleJson" JSONB,
  "uncertaintyJson" JSONB,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApplicationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanApproval" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "reasonCode" TEXT,
  "requestedBy" TEXT NOT NULL,
  "approvedBy" TEXT NOT NULL,
  "aiTaskRunId" TEXT,
  "recommendationId" TEXT,
  "metadata" JSONB,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HumanApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "traceId" TEXT,
  "payload" JSONB NOT NULL,
  "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),

  CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptTemplate_tenantId_key_version_key" ON "AiPromptTemplate"("tenantId", "key", "version");

-- CreateIndex
CREATE INDEX "AiPromptTemplate_tenantId_stage_isActive_idx" ON "AiPromptTemplate"("tenantId", "stage", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringRubric_tenantId_key_version_key" ON "ScoringRubric"("tenantId", "key", "version");

-- CreateIndex
CREATE INDEX "ScoringRubric_tenantId_domain_isActive_idx" ON "ScoringRubric"("tenantId", "domain", "isActive");

-- CreateIndex
CREATE INDEX "AiTaskRun_tenantId_taskType_createdAt_idx" ON "AiTaskRun"("tenantId", "taskType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiTaskRun_tenantId_status_createdAt_idx" ON "AiTaskRun"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiTaskRun_workflowJobId_idx" ON "AiTaskRun"("workflowJobId");

-- CreateIndex
CREATE INDEX "ApplicationRecommendation_tenantId_applicationId_createdAt_idx" ON "ApplicationRecommendation"("tenantId", "applicationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HumanApproval_tenantId_entityType_entityId_approvedAt_idx" ON "HumanApproval"("tenantId", "entityType", "entityId", "approvedAt" DESC);

-- CreateIndex
CREATE INDEX "HumanApproval_tenantId_actionType_approvedAt_idx" ON "HumanApproval"("tenantId", "actionType", "approvedAt" DESC);

-- CreateIndex
CREATE INDEX "DomainEvent_tenantId_status_createdAt_idx" ON "DomainEvent"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DomainEvent_eventType_createdAt_idx" ON "DomainEvent"("eventType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AiPromptTemplate" ADD CONSTRAINT "AiPromptTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRubric" ADD CONSTRAINT "ScoringRubric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_aiReportId_fkey" FOREIGN KEY ("aiReportId") REFERENCES "AiReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "AiPromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "ScoringRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTaskRun" ADD CONSTRAINT "AiTaskRun_workflowJobId_fkey" FOREIGN KEY ("workflowJobId") REFERENCES "WorkflowJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecommendation" ADD CONSTRAINT "ApplicationRecommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecommendation" ADD CONSTRAINT "ApplicationRecommendation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecommendation" ADD CONSTRAINT "ApplicationRecommendation_aiTaskRunId_fkey" FOREIGN KEY ("aiTaskRunId") REFERENCES "AiTaskRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_aiTaskRunId_fkey" FOREIGN KEY ("aiTaskRunId") REFERENCES "AiTaskRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ApplicationRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
