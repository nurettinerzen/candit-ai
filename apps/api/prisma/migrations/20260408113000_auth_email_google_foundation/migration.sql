CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

CREATE TYPE "AuthActionTokenType" AS ENUM (
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'OAUTH_LOGIN_RELAY'
);

ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "avatarUrl" TEXT;

CREATE TABLE "UserIdentity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthActionToken" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "type" "AuthActionTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "payloadJson" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthActionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserIdentity_provider_providerSubject_key"
ON "UserIdentity"("provider", "providerSubject");

CREATE UNIQUE INDEX "UserIdentity_userId_provider_key"
ON "UserIdentity"("userId", "provider");

CREATE INDEX "UserIdentity_tenantId_provider_email_idx"
ON "UserIdentity"("tenantId", "provider", "email");

CREATE UNIQUE INDEX "AuthActionToken_tokenHash_key"
ON "AuthActionToken"("tokenHash");

CREATE INDEX "AuthActionToken_email_type_createdAt_idx"
ON "AuthActionToken"("email", "type", "createdAt" DESC);

CREATE INDEX "AuthActionToken_userId_type_createdAt_idx"
ON "AuthActionToken"("userId", "type", "createdAt" DESC);

CREATE INDEX "AuthActionToken_expiresAt_idx"
ON "AuthActionToken"("expiresAt");

ALTER TABLE "UserIdentity"
ADD CONSTRAINT "UserIdentity_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserIdentity"
ADD CONSTRAINT "UserIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthActionToken"
ADD CONSTRAINT "AuthActionToken_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthActionToken"
ADD CONSTRAINT "AuthActionToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
