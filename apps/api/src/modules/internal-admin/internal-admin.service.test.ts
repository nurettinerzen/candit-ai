import assert from "node:assert/strict";
import test from "node:test";
import { BillingAccountStatus, BillingPlanKey, TenantStatus } from "@prisma/client";
import { InternalAdminService } from "./internal-admin.service";

function createService() {
  const audits: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const securityEvents: Array<Record<string, unknown>> = [];

  const tx = {
    memberInvitation: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }: { data: Record<string, unknown> }) => data
    },
    user: {
      update: async ({ data }: { data: Record<string, unknown> }) => data
    },
    authSession: {
      updateMany: async () => ({ count: 2 })
    },
    authRefreshToken: {
      updateMany: async () => ({ count: 3 })
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      }
    }
  };

  const prisma = {
    user: {
      findFirst: async () => ({
        id: "usr_owner",
        fullName: "Launch Owner",
        email: "owner@candit.ai"
      })
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)
  };

  const runtimeConfig = {
    isInternalAdmin: () => true,
    publicWebBaseUrl: "https://app.candit.ai"
  };

  const service = new InternalAdminService(
    prisma as never,
    runtimeConfig as never,
    {} as never,
    {
      createInvitationToken: async () => ({
        rawToken: "invite-token",
        tokenHash: "hashed-invite-token",
        expiresAt: new Date("2026-05-01T12:00:00.000Z")
      })
    } as never,
    {} as never,
    {
      send: async (input: Record<string, unknown>) => {
        notifications.push(input);
        return {
          id: `delivery_${notifications.length}`
        };
      }
    } as never,
    {
      recordSecurityEvent: async (input: Record<string, unknown>) => {
        securityEvents.push(input);
        return {
          id: `security_${securityEvents.length}`
        };
      }
    } as never
  );

  return {
    service,
    audits,
    notifications,
    securityEvents
  };
}

test("sendOwnerResetInvite records audit and security evidence", async () => {
  const { service, audits, notifications, securityEvents } = createService();

  const result = await service.sendOwnerResetInvite({
    tenantId: "ten_launch",
    actorUserId: "usr_internal_admin",
    actorEmail: "info@candit.ai"
  });

  assert.deepEqual(result, {
    sent: true,
    email: "owner@candit.ai",
    invitationUrl: "https://app.candit.ai/auth/invitations/accept?token=invite-token"
  });
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "internal_admin.owner_password_reset_requested");
  assert.equal(audits[0]?.entityType, "User");
  assert.equal(audits[0]?.entityId, "usr_owner");
  assert.deepEqual(audits[0]?.metadata, {
    ownerEmail: "owner@candit.ai",
    expiresAt: "2026-05-01T12:00:00.000Z",
    revokedSessionCount: 2,
    revokedRefreshTokenCount: 3
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.templateKey, "internal_admin_password_reset");
  assert.equal(securityEvents.length, 1);
  assert.equal(
    securityEvents[0]?.code,
    "internal_admin.owner_password_reset.invitation_issued"
  );
});

test("listAccounts supports tenant id search", async () => {
  const filtersSeen: Array<Record<string, unknown>> = [];
  const service = new InternalAdminService(
    {
      tenant: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          filtersSeen.push(where);

          return [
            {
              id: "ten_launch",
              name: "Launch Account",
              status: TenantStatus.ACTIVE,
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
              billingAccount: {
                billingEmail: "billing@candit.ai",
                currentPlanKey: BillingPlanKey.ENTERPRISE,
                status: BillingAccountStatus.ACTIVE
              },
              users: [
                {
                  id: "usr_owner",
                  fullName: "Launch Owner",
                  email: "owner@candit.ai",
                  status: "ACTIVE",
                  lastLoginAt: null
                }
              ]
            }
          ];
        }
      },
      job: { count: async () => 0 },
      candidate: { count: async () => 0 },
      candidateApplication: { count: async () => 0 },
      interviewSession: { count: async () => 0 }
    } as never,
    {
      isInternalAdmin: () => true
    } as never,
    {
      getOverview: async () => ({
        account: {
          billingEmail: "billing@candit.ai",
          currentPlanKey: BillingPlanKey.ENTERPRISE,
          status: BillingAccountStatus.ACTIVE,
          currentPeriodEnd: "2026-05-01T00:00:00.000Z"
        },
        trial: {
          isActive: false,
          isExpired: false,
          startedAt: null,
          endsAt: null,
          daysRemaining: 0
        },
        usage: {
          quotas: []
        }
      })
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.listAccounts({ query: "ten_launch" }, "info@candit.ai");

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.tenantId, "ten_launch");
  assert.equal(filtersSeen.length, 1);
  assert.deepEqual(filtersSeen[0]?.OR?.[0], {
    id: {
      contains: "ten_launch",
      mode: "insensitive"
    }
  });
});
