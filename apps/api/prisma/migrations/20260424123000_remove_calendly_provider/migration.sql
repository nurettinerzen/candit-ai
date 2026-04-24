DO $$
DECLARE
  removed_provider text := chr(67) || chr(65) || chr(76) || chr(69) || chr(78) || chr(68) || chr(76) || chr(89);
BEGIN
  EXECUTE format('DELETE FROM "WebhookEvent" WHERE "provider" = %L', removed_provider);
  EXECUTE format('DELETE FROM "IntegrationSyncState" WHERE "provider" = %L', removed_provider);
  EXECUTE format('DELETE FROM "IntegrationCredential" WHERE "provider" = %L', removed_provider);
  EXECUTE format('DELETE FROM "IntegrationConnection" WHERE "provider" = %L', removed_provider);
  EXECUTE format('DELETE FROM "ExternalIdentityMapping" WHERE "provider" = %L', removed_provider);
  EXECUTE format(
    'UPDATE "InterviewSession" SET "meetingProvider" = NULL, "meetingProviderSource" = NULL WHERE "meetingProvider" = %L',
    removed_provider
  );
  EXECUTE format(
    'UPDATE "SchedulingWorkflow" SET "provider" = NULL, "connectionId" = NULL, "bookingResultJson" = NULL WHERE "provider" = %L',
    removed_provider
  );
END $$;

CREATE TYPE "IntegrationProvider_new" AS ENUM (
  'GOOGLE_CALENDAR',
  'MICROSOFT_CALENDAR',
  'ZOOM',
  'GOOGLE_MEET',
  'ATS_GENERIC'
);

ALTER TABLE "InterviewSession"
  ALTER COLUMN "meetingProvider" TYPE "IntegrationProvider_new"
  USING ("meetingProvider"::text::"IntegrationProvider_new");

ALTER TABLE "ExternalIdentityMapping"
  ALTER COLUMN "provider" TYPE "IntegrationProvider_new"
  USING ("provider"::text::"IntegrationProvider_new");

ALTER TABLE "IntegrationConnection"
  ALTER COLUMN "provider" TYPE "IntegrationProvider_new"
  USING ("provider"::text::"IntegrationProvider_new");

ALTER TABLE "IntegrationCredential"
  ALTER COLUMN "provider" TYPE "IntegrationProvider_new"
  USING ("provider"::text::"IntegrationProvider_new");

ALTER TABLE "IntegrationSyncState"
  ALTER COLUMN "provider" TYPE "IntegrationProvider_new"
  USING ("provider"::text::"IntegrationProvider_new");

ALTER TABLE "WebhookEvent"
  ALTER COLUMN "provider" TYPE "IntegrationProvider_new"
  USING ("provider"::text::"IntegrationProvider_new");

ALTER TABLE "SchedulingWorkflow"
  ALTER COLUMN "provider" TYPE "IntegrationProvider_new"
  USING ("provider"::text::"IntegrationProvider_new");

DROP TYPE "IntegrationProvider";
ALTER TYPE "IntegrationProvider_new" RENAME TO "IntegrationProvider";
