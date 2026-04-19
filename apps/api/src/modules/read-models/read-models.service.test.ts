import assert from "node:assert/strict";
import test from "node:test";
import { ReadModelsService } from "./read-models.service";

function createService() {
  const speechStatus = {
    preferred: {
      preferredSttProvider: "browser",
      preferredTtsProvider: "browser",
      providerMode: "browser_fallback",
      openAiSpeechReady: false
    },
    providers: []
  };

  const runtimeConfig = {
    providerReadiness: {
      parsing: {
        provider: "openai",
        mode: "provider",
        ready: true
      },
      screening: {
        provider: "openai",
        mode: "provider",
        ready: true
      },
      speech: {
        preferredSttProvider: "browser",
        preferredTtsProvider: "browser",
        providerMode: "browser_fallback",
        openAiSpeechReady: false,
        ready: true
      },
      calendly: {
        oauthConfigured: false,
        webhookSigningSecretConfigured: false
      },
      googleCalendar: {
        oauthConfigured: false
      },
      notifications: {
        emailProvider: "console",
        ready: false
      }
    },
    getProviderConfigurationWarnings: () => [
      "EMAIL_PROVIDER=console in production; candidate-facing emails will not be delivered."
    ],
    validateAtStartup: () => ({
      healthy: false,
      warnings: ["Email provider selected but provider credentials are missing."],
      providers: {
        email_notifications: {
          ready: false,
          mode: "console"
        },
        stripe_billing: {
          ready: false,
          mode: "not_configured"
        }
      }
    })
  };

  const service = new ReadModelsService(
    {
      interviewSession: {
        findMany: async () => []
      },
      schedulingWorkflow: {
        groupBy: async () => []
      },
      notificationDelivery: {
        groupBy: async () => []
      }
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      listSchedulingProviders: async () => ({
        providers: [],
        catalog: [
          {
            provider: "CALENDLY",
            status: "pilot",
            ready: true,
            requiresConnection: true,
            oauthConfigured: true,
            connected: false,
            connectionId: null,
            displayName: null,
            hasMeetingUrlTemplate: false,
            updatedAt: null,
            selectable: false,
            selectionReason: "CALENDLY için aktif tenant baglantisi bulunmuyor."
          }
        ],
        fallback: {
          provider: null,
          source: "internal_fallback",
          label: "Dahili Meeting Link Fallback"
        }
      })
    } as never,
    {
      listConnections: async () => []
    } as never,
    {
      getProviderStatus: () => speechStatus
    } as never,
    runtimeConfig as never,
    {} as never
  );

  (service as unknown as { aiSupportCenter: (tenantId: string) => Promise<unknown> }).aiSupportCenter =
    async (_tenantId: string) => ({
      providers: ["openai"],
      providerStatus: {
        defaultProvider: "openai",
        providers: [
          {
            key: "openai",
            configured: true,
            mode: "provider",
            active: true,
            reason: null
          }
        ]
      },
      flags: [],
      speech: speechStatus,
      integrations: [],
      extraction: {
        byStatus: {
          SUCCEEDED: 1
        },
        byMethod: {
          llm: 1
        }
      },
      taskRuns: []
    });

  return service;
}

test("infrastructureReadiness exposes startup health and launch warnings together", async () => {
  const service = createService();

  const result = await service.infrastructureReadiness("ten_1");

  assert.deepEqual(result.launchWarnings, [
    "EMAIL_PROVIDER=console in production; candidate-facing emails will not be delivered."
  ]);
  assert.equal(result.startupHealth.healthy, false);
  assert.deepEqual(result.startupHealth.warnings, [
    "Email provider selected but provider credentials are missing."
  ]);
  assert.deepEqual(result.startupHealth.providers.email_notifications, {
    ready: false,
    mode: "console"
  });
  assert.deepEqual(result.notifications, {
    deliveriesByStatus: {},
    totalDeliveries: 0
  });
  assert.deepEqual(result.scheduling, {
    workflowsByState: {},
    totalWorkflows: 0,
    catalog: [
      {
        provider: "CALENDLY",
        status: "pilot",
        ready: true,
        requiresConnection: true,
        oauthConfigured: true,
        connected: false,
        connectionId: null,
        displayName: null,
        hasMeetingUrlTemplate: false,
        updatedAt: null,
        selectable: false,
        selectionReason: "CALENDLY için aktif tenant baglantisi bulunmuyor."
      }
    ],
    fallback: {
      provider: null,
      source: "internal_fallback",
      label: "Dahili Meeting Link Fallback"
    }
  });
});
