CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "PlatformIncidentCategory" AS ENUM ('APPLICATION', 'SECURITY', 'ASSISTANT', 'OPERATIONS');
CREATE TYPE "PlatformIncidentSeverity" AS ENUM ('WARNING', 'CRITICAL');
CREATE TYPE "PlatformIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT,
  "sessionId" TEXT,
  "source" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'WARNING',
  "ipAddressHash" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformIncident" (
  "id" TEXT NOT NULL,
  "incidentKey" TEXT NOT NULL,
  "tenantId" TEXT,
  "category" "PlatformIncidentCategory" NOT NULL,
  "severity" "PlatformIncidentSeverity" NOT NULL DEFAULT 'WARNING',
  "source" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "PlatformIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "repeatCount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformIncident_incidentKey_key" ON "PlatformIncident"("incidentKey");
CREATE INDEX "SecurityEvent_tenantId_occurredAt_idx" ON "SecurityEvent"("tenantId", "occurredAt" DESC);
CREATE INDEX "SecurityEvent_userId_occurredAt_idx" ON "SecurityEvent"("userId", "occurredAt" DESC);
CREATE INDEX "SecurityEvent_sessionId_occurredAt_idx" ON "SecurityEvent"("sessionId", "occurredAt" DESC);
CREATE INDEX "SecurityEvent_code_occurredAt_idx" ON "SecurityEvent"("code", "occurredAt" DESC);
CREATE INDEX "PlatformIncident_status_lastSeenAt_idx" ON "PlatformIncident"("status", "lastSeenAt" DESC);
CREATE INDEX "PlatformIncident_tenantId_category_lastSeenAt_idx" ON "PlatformIncident"("tenantId", "category", "lastSeenAt" DESC);
CREATE INDEX "PlatformIncident_category_severity_lastSeenAt_idx" ON "PlatformIncident"("category", "severity", "lastSeenAt" DESC);

ALTER TABLE "SecurityEvent"
ADD CONSTRAINT "SecurityEvent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecurityEvent"
ADD CONSTRAINT "SecurityEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlatformIncident"
ADD CONSTRAINT "PlatformIncident_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
