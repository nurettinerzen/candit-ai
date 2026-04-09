import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformIncidentCategory,
  PlatformIncidentSeverity,
  SecurityEventSeverity
} from "@prisma/client";
import { SecurityEventsService, createIncidentKey } from "./security-events.service";

function createMockPrisma() {
  const securityEvents: Array<Record<string, unknown>> = [];
  const incidents = new Map<string, Record<string, unknown>>();

  const tx = {
    securityEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        securityEvents.push(data);
        return data;
      }
    },
    platformIncident: {
      findUnique: async ({ where }: { where: { incidentKey: string } }) => {
        const record = incidents.get(where.incidentKey);
        return record ? { severity: record.severity } : null;
      },
      upsert: async ({
        where,
        create,
        update
      }: {
        where: { incidentKey: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = incidents.get(where.incidentKey);

        if (!existing) {
          incidents.set(where.incidentKey, { ...create });
          return create;
        }

        const nextRecord = {
          ...existing,
          ...Object.fromEntries(Object.entries(update).filter(([key]) => key !== "repeatCount")),
          repeatCount:
            Number(existing.repeatCount ?? 1) +
            Number((update.repeatCount as { increment?: number } | undefined)?.increment ?? 0)
        };

        incidents.set(where.incidentKey, nextRecord);
        return nextRecord;
      }
    }
  };

  return {
    securityEvents,
    incidents,
    prisma: {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)
    }
  };
}

test("createIncidentKey stays stable for the same signal", () => {
  const first = createIncidentKey({
    tenantId: "ten_launch",
    category: PlatformIncidentCategory.SECURITY,
    source: "auth.refresh",
    code: "auth.refresh.reuse_detected",
    message: "Refresh token tekrar kullanimi tespit edildi."
  });

  const second = createIncidentKey({
    tenantId: "ten_launch",
    category: PlatformIncidentCategory.SECURITY,
    source: "auth.refresh",
    code: "auth.refresh.reuse_detected",
    message: "Refresh token tekrar kullanimi tespit edildi."
  });

  assert.equal(first, second);
});

test("recordSecurityEvent stores the timeline and escalates the incident", async () => {
  const { prisma, incidents, securityEvents } = createMockPrisma();
  const service = new SecurityEventsService(prisma as never);

  await service.recordSecurityEvent({
    tenantId: "ten_launch",
    userId: "usr_owner",
    sessionId: "ses_1",
    source: "auth.login",
    code: "auth.login.invalid_password",
    message: "Hatali sifre ile giris denemesi algilandi.",
    severity: SecurityEventSeverity.WARNING,
    ipAddress: "203.0.113.10",
    userAgent: "Mozilla/5.0"
  });

  await service.recordSecurityEvent({
    tenantId: "ten_launch",
    userId: "usr_owner",
    sessionId: "ses_1",
    source: "auth.login",
    code: "auth.login.invalid_password",
    message: "Hatali sifre ile giris denemesi algilandi.",
    severity: SecurityEventSeverity.CRITICAL,
    ipAddress: "203.0.113.10",
    userAgent: "Mozilla/5.0"
  });

  assert.equal(securityEvents.length, 2);
  assert.equal(incidents.size, 1);

  const incident = [...incidents.values()][0];
  assert.ok(incident);
  assert.equal(incident.category, PlatformIncidentCategory.SECURITY);
  assert.equal(incident.severity, PlatformIncidentSeverity.CRITICAL);
  assert.equal(incident.repeatCount, 2);

  const firstEvent = securityEvents[0];
  assert.ok(firstEvent);
  if (!firstEvent) {
    return;
  }

  assert.ok(firstEvent.ipAddressHash);
  assert.notEqual(firstEvent.ipAddressHash, "203.0.113.10");
});
