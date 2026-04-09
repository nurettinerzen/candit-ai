CREATE TYPE "Role_new" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

ALTER TABLE "User"
ADD COLUMN "role" "Role_new",
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "passwordSetAt" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

UPDATE "User" AS "u"
SET "role" = COALESCE(
  (
    SELECT
      CASE "urb"."role"::text
        WHEN 'ADMIN' THEN 'OWNER'::"Role_new"
        WHEN 'RECRUITER' THEN 'MANAGER'::"Role_new"
        WHEN 'HIRING_MANAGER' THEN 'STAFF'::"Role_new"
        ELSE 'STAFF'::"Role_new"
      END
    FROM "UserRoleBinding" AS "urb"
    WHERE "urb"."tenantId" = "u"."tenantId"
      AND "urb"."userId" = "u"."id"
    ORDER BY
      CASE "urb"."role"::text
        WHEN 'ADMIN' THEN 0
        WHEN 'RECRUITER' THEN 1
        WHEN 'HIRING_MANAGER' THEN 2
        ELSE 3
      END
    LIMIT 1
  ),
  'STAFF'::"Role_new"
);

ALTER TABLE "User"
ALTER COLUMN "role" SET NOT NULL;

ALTER TABLE "FeatureFlagOverride"
ALTER COLUMN "role" TYPE TEXT USING ("role"::text);

ALTER TABLE "FeatureFlagOverride"
ALTER COLUMN "role" TYPE "Role_new"
USING (
  CASE
    WHEN "role" IS NULL THEN NULL
    WHEN "role" = 'ADMIN' THEN 'OWNER'::"Role_new"
    WHEN "role" = 'RECRUITER' THEN 'MANAGER'::"Role_new"
    WHEN "role" = 'HIRING_MANAGER' THEN 'STAFF'::"Role_new"
    ELSE NULL
  END
);

CREATE TABLE "MemberInvitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role_new" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MemberInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberInvitation_tokenHash_key" ON "MemberInvitation"("tokenHash");
CREATE INDEX "MemberInvitation_tenantId_email_createdAt_idx" ON "MemberInvitation"("tenantId", "email", "createdAt" DESC);
CREATE INDEX "MemberInvitation_tenantId_userId_createdAt_idx" ON "MemberInvitation"("tenantId", "userId", "createdAt" DESC);
CREATE INDEX "MemberInvitation_tenantId_role_createdAt_idx" ON "MemberInvitation"("tenantId", "role", "createdAt" DESC);
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");
CREATE UNIQUE INDEX "User_single_owner_per_tenant_uidx" ON "User"("tenantId") WHERE "role" = 'OWNER' AND "deletedAt" IS NULL;

ALTER TABLE "MemberInvitation"
ADD CONSTRAINT "MemberInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberInvitation"
ADD CONSTRAINT "MemberInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberInvitation"
ADD CONSTRAINT "MemberInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "UserRoleBinding";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
