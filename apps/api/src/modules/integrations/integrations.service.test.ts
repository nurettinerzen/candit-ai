import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { IntegrationConnectionStatus, IntegrationProvider } from "@prisma/client";
import { IntegrationsService } from "./integrations.service";

function createService() {
  let activeConnections: Array<Record<string, unknown>> = [];

  const service = new IntegrationsService(
    {
      integrationConnection: {
        findMany: async () => activeConnections
      }
    } as never,
    {} as never,
    {
      upsert: async () => undefined
    } as never,
    {
      recordPlatformIncident: async () => undefined
    } as never,
    {
      meetingProviderCatalog: [
        {
          provider: "GOOGLE_CALENDAR",
          status: "pilot",
          ready: true,
          requiresConnection: true,
          oauthConfigured: true
        },
        {
          provider: "GOOGLE_MEET",
          status: "pilot",
          ready: true,
          requiresConnection: true,
          oauthConfigured: true
        },
        {
          provider: "ZOOM",
          status: "unsupported",
          ready: false,
          requiresConnection: true,
          oauthConfigured: false
        },
        {
          provider: "MICROSOFT_CALENDAR",
          status: "unsupported",
          ready: false,
          requiresConnection: true,
          oauthConfigured: false
        }
      ]
    } as never
  );

  return {
    service,
    setActiveConnections(next: Array<Record<string, unknown>>) {
      activeConnections = next;
    }
  };
}

test("assertMeetingProviderSelectable rejects launch-unsupported providers", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.assertMeetingProviderSelectable({
        tenantId: "ten_1",
        provider: IntegrationProvider.ZOOM
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message.includes("ZOOM V1 kapsaminda desteklenmiyor")
  );
});

test("resolveMeetingContext blocks an explicitly selected provider when the tenant connection is missing", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.resolveMeetingContext({
        tenantId: "ten_1",
        sessionId: "sess_1",
        mode: "MEETING_LINK",
        preferredProvider: IntegrationProvider.GOOGLE_CALENDAR
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message.includes("GOOGLE_CALENDAR için aktif tenant baglantisi bulunmuyor")
  );
});

test("resolveMeetingContext ignores unsupported active providers and falls back internally", async () => {
  const { service, setActiveConnections } = createService();

  setActiveConnections([
    {
      id: "conn_zoom",
      provider: IntegrationProvider.ZOOM,
      displayName: "Zoom Pilot",
      status: IntegrationConnectionStatus.ACTIVE,
      configJson: {},
      credentialsJson: {},
      credential: null
    }
  ]);

  const result = await service.resolveMeetingContext({
    tenantId: "ten_1",
    sessionId: "sess_fallback",
    mode: "MEETING_LINK"
  });

  assert.deepEqual(result, {
    provider: null,
    connectionId: null,
    providerSource: "internal_fallback",
    joinUrl: "https://interview.local/session/sess_fallback",
    externalRef: "internal-sess_fallback",
    calendarEventRef: null,
    details: {
      message: "Harici provider secilemedigi icin internal fallback kullanildi."
    }
  });
});
