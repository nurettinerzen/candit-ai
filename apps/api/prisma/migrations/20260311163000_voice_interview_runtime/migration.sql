-- AlterTable
ALTER TABLE "InterviewSession"
ADD COLUMN "candidateAccessToken" TEXT,
ADD COLUMN "candidateAccessExpiresAt" TIMESTAMP(3),
ADD COLUMN "candidateLocale" TEXT NOT NULL DEFAULT 'tr-TR',
ADD COLUMN "runtimeMode" TEXT NOT NULL DEFAULT 'guided_voice_turn_v1',
ADD COLUMN "runtimeProviderMode" TEXT NOT NULL DEFAULT 'browser_native',
ADD COLUMN "voiceInputProvider" TEXT,
ADD COLUMN "voiceOutputProvider" TEXT,
ADD COLUMN "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentFollowUpCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentQuestionKey" TEXT,
ADD COLUMN "engineStateJson" JSONB,
ADD COLUMN "sessionSummaryJson" JSONB,
ADD COLUMN "lastCandidateActivityAt" TIMESTAMP(3),
ADD COLUMN "abandonedAt" TIMESTAMP(3),
ADD COLUMN "completedReasonCode" TEXT;

-- CreateTable
CREATE TABLE "InterviewTurn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "blockKey" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRIMARY',
    "promptText" TEXT NOT NULL,
    "promptAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answerText" TEXT,
    "answerConfidence" DECIMAL(65,30),
    "answerLatencyMs" INTEGER,
    "answerDurationMs" INTEGER,
    "answerLanguage" TEXT,
    "answerSource" TEXT,
    "answerSubmittedAt" TIMESTAMP(3),
    "followUpDepth" INTEGER NOT NULL DEFAULT 0,
    "completionStatus" TEXT NOT NULL DEFAULT 'ASKED',
    "transitionDecision" TEXT,
    "decisionReason" TEXT,
    "promptSegmentId" TEXT,
    "answerSegmentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_candidateAccessToken_key" ON "InterviewSession"("candidateAccessToken");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewTurn_sessionId_sequenceNo_key" ON "InterviewTurn"("sessionId", "sequenceNo");

-- CreateIndex
CREATE INDEX "InterviewTurn_tenantId_sessionId_sequenceNo_idx" ON "InterviewTurn"("tenantId", "sessionId", "sequenceNo");

-- AddForeignKey
ALTER TABLE "InterviewTurn" ADD CONSTRAINT "InterviewTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
