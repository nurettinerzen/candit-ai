import assert from "node:assert/strict";
import test from "node:test";
import { NotificationsService } from "./notifications.service";

function createService() {
  const deliveries: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];

  const prisma = {
    notificationDelivery: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const record = {
          id: `delivery_${deliveries.length + 1}`,
          ...data
        };
        deliveries.push(record);
        return record;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data
      })
    },
    candidateApplication: {
      findFirst: async () => ({
        id: "app_1",
        candidate: {
          fullName: "Ayse Yilmaz",
          email: "ayse@example.com"
        },
        job: {
          title: "Depo Operasyon Uzmani"
        }
      })
    },
    tenant: {
      findUnique: async () => ({
        name: "Candit"
      })
    }
  };

  const auditWriter = {
    write: async (input: Record<string, unknown>) => {
      audits.push(input);
      return {
        id: `audit_${audits.length}`
      };
    }
  };

  const runtimeConfig = {
    publicWebBaseUrl: "https://app.candit.ai"
  };

  return {
    service: new NotificationsService(
      prisma as never,
      auditWriter as never,
      runtimeConfig as never
    ),
    deliveries,
    audits
  };
}

test("handleDomainEvent sends a candidate rejection email for approved reject decisions", async () => {
  const originalEmailProvider = process.env.EMAIL_PROVIDER;
  const originalResendApiKey = process.env.RESEND_API_KEY;

  process.env.EMAIL_PROVIDER = "console";
  delete process.env.RESEND_API_KEY;

  try {
    const { service, deliveries } = createService();

    const result = await service.handleDomainEvent({
      tenantId: "ten_1",
      eventType: "application.decision_recorded",
      aggregateType: "CandidateApplication",
      aggregateId: "app_1",
      traceId: "trace_1",
      payload: {
        decision: "reject"
      }
    });

    assert.deepEqual(result, {
      notified: true,
      channel: "email",
      deliveryId: "delivery_1",
      provider: "console-email",
      status: "queued"
    });

    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]?.toAddress, "ayse@example.com");
    assert.equal(deliveries[0]?.templateKey, "application_rejected_v1");
  } finally {
    if (originalEmailProvider === undefined) {
      delete process.env.EMAIL_PROVIDER;
    } else {
      process.env.EMAIL_PROVIDER = originalEmailProvider;
    }

    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }
  }
});
