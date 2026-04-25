import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import {
  AuthActionTokenType,
  AuthSessionStatus,
  Role,
  UserStatus
} from "@prisma/client";
import { AuthService } from "./auth.service";

function createService() {
  const audits: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const securityEvents: Array<Record<string, unknown>> = [];

  const tx = {
    user: {
      update: async ({ data }: { data: Record<string, unknown> }) => data
    },
    authActionToken: {
      update: async ({ data }: { data: Record<string, unknown> }) => data,
      updateMany: async () => ({ count: 1 })
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
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      }
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)
  };

  const runtimeConfig = {
    passwordResetTtlHours: 2,
    emailVerificationTtlHours: 24,
    publicWebBaseUrl: "https://app.candit.ai",
    isProduction: false
  };

  const notificationsService = {
    send: async (input: Record<string, unknown>) => {
      notifications.push(input);
      return {
        id: `delivery_${notifications.length}`
      };
    }
  };

  const securityEventsService = {
    recordSecurityEvent: async (input: Record<string, unknown>) => {
      securityEvents.push(input);
      return {
        id: `security_${securityEvents.length}`
      };
    }
  };

  const service = new AuthService(
    prisma as never,
    {} as never,
    new ConfigService({}),
    runtimeConfig as never,
    {
      isGlobalEnabled: async () => false
    } as never,
    notificationsService as never,
    securityEventsService as never,
    {} as never
  );

  return {
    service,
    audits,
    notifications,
    securityEvents
  };
}

test("requestPasswordReset records an audit trail for active users", async () => {
  const { service, audits, notifications } = createService();

  (service as unknown as { findUsersByEmail: (email: string) => Promise<unknown[]> }).findUsersByEmail =
    async () => [
      {
        id: "usr_owner",
        tenantId: "ten_launch",
        email: "owner@candit.ai",
        fullName: "Launch Owner",
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: "hashed-password",
        emailVerifiedAt: null,
        avatarUrl: null
      }
    ];
  (service as unknown as { createActionToken: () => Promise<{ rawToken: string; expiresAt: Date }> }).createActionToken =
    async () => ({
      rawToken: "reset-token",
      expiresAt: new Date("2026-05-01T12:00:00.000Z")
    });

  const result = await service.requestPasswordReset({
    email: "owner@candit.ai"
  });

  assert.equal(result.ok, true);
  assert.equal(notifications.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "auth.password.reset_requested");
  assert.equal(audits[0]?.entityType, "User");
  assert.equal(audits[0]?.entityId, "usr_owner");
  assert.deepEqual(audits[0]?.metadata, {
    email: "owner@candit.ai",
    expiresAt: "2026-05-01T12:00:00.000Z"
  });
});

test("requestPasswordReset reports ambiguous multi-tenant emails as a security event", async () => {
  const { service, securityEvents } = createService();

  (service as unknown as { findUsersByEmail: (email: string) => Promise<unknown[]> }).findUsersByEmail =
    async () => [
      {
        id: "usr_owner_1",
        tenantId: "ten_a",
        email: "shared@candit.ai",
        fullName: "Owner A",
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: "hashed-password",
        emailVerifiedAt: null,
        avatarUrl: null
      },
      {
        id: "usr_owner_2",
        tenantId: "ten_b",
        email: "shared@candit.ai",
        fullName: "Owner B",
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: "hashed-password",
        emailVerifiedAt: null,
        avatarUrl: null
      }
    ];

  await assert.rejects(
    () =>
      service.requestPasswordReset({
        email: "shared@candit.ai"
      }),
    /birden fazla hesapta kayıtlı/i
  );

  assert.equal(securityEvents.length, 1);
  assert.equal(securityEvents[0]?.code, "auth.password.reset.ambiguous_email");
});

test("requestEmailVerification records audit and notification for active users", async () => {
  const { service, audits, notifications } = createService();

  (service as unknown as { findUsersByEmail: (email: string) => Promise<unknown[]> }).findUsersByEmail =
    async () => [
      {
        id: "usr_owner",
        tenantId: "ten_launch",
        email: "owner@candit.ai",
        fullName: "Launch Owner",
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: "hashed-password",
        emailVerifiedAt: null,
        avatarUrl: null
      }
    ];
  (service as unknown as { createActionToken: () => Promise<{ rawToken: string; expiresAt: Date }> }).createActionToken =
    async () => ({
      rawToken: "verify-token",
      expiresAt: new Date("2026-05-01T12:00:00.000Z")
    });
  (service as unknown as { resolveEmailVerificationState: () => Promise<Record<string, unknown>> }).resolveEmailVerificationState =
    async () => ({
      enabled: true,
      required: true,
      deliveryEnabled: true
    });

  const result = await service.requestEmailVerification({
    email: "owner@candit.ai"
  });

  assert.equal(result.ok, true);
  assert.equal(notifications.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "auth.email_verification_requested");
  assert.deepEqual(audits[0]?.metadata, {
    email: "owner@candit.ai",
    expiresAt: "2026-05-01T12:00:00.000Z",
    deliveryEnabled: true
  });
});

test("requestEmailVerification reports ambiguous multi-tenant emails as a security event", async () => {
  const { service, securityEvents } = createService();

  (service as unknown as { findUsersByEmail: (email: string) => Promise<unknown[]> }).findUsersByEmail =
    async () => [
      {
        id: "usr_owner_1",
        tenantId: "ten_a",
        email: "shared@candit.ai",
        fullName: "Owner A",
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: "hashed-password",
        emailVerifiedAt: null,
        avatarUrl: null
      },
      {
        id: "usr_owner_2",
        tenantId: "ten_b",
        email: "shared@candit.ai",
        fullName: "Owner B",
        role: Role.OWNER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: "hashed-password",
        emailVerifiedAt: null,
        avatarUrl: null
      }
    ];

  await assert.rejects(
    () =>
      service.requestEmailVerification({
        email: "shared@candit.ai"
      }),
    /birden fazla hesapta kayıtlı/i
  );

  assert.equal(securityEvents.length, 1);
  assert.equal(securityEvents[0]?.code, "auth.email_verification.ambiguous_email");
});

test("resetPassword reports invalid tokens and audits successful completions", async () => {
  {
    const { service, securityEvents } = createService();

    (service as unknown as { findActionTokenByRawToken: () => Promise<unknown> }).findActionTokenByRawToken =
      async () => null;

    await assert.rejects(
      () =>
        service.resetPassword({
          token: "missing-token",
          password: "Launch123!"
        }),
      /bulunamadi veya gecersiz/i
    );

    assert.equal(securityEvents.length, 1);
    assert.equal(securityEvents[0]?.code, "auth.password.reset.token_not_found");
  }

  {
    const { service, audits } = createService();

    const user = {
      id: "usr_owner",
      tenantId: "ten_launch",
      email: "owner@candit.ai",
      fullName: "Launch Owner",
      role: Role.OWNER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      passwordHash: "previous-password-hash",
      emailVerifiedAt: null,
      avatarUrl: null
    };

    (service as unknown as { findActionTokenByRawToken: () => Promise<unknown> }).findActionTokenByRawToken =
      async () => ({
        id: "tok_reset_1",
        tenantId: user.tenantId,
        userId: user.id,
        email: user.email,
        type: AuthActionTokenType.PASSWORD_RESET,
        expiresAt: new Date("2026-05-01T12:00:00.000Z"),
        consumedAt: null,
        revokedAt: null,
        payloadJson: null,
        user
      });
    (service as unknown as { assertActionTokenUsable: (token: unknown, message: string) => void }).assertActionTokenUsable =
      () => undefined;
    (service as unknown as { issueSessionForUserId: (userId: string) => Promise<Record<string, unknown>> }).issueSessionForUserId =
      async (userId: string) => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
          id: userId
        },
        session: {
          id: "ses_new",
          authMode: "jwt",
          expiresAt: new Date("2026-05-02T12:00:00.000Z").toISOString()
        }
      });

    const result = await service.resetPassword({
      token: "valid-token",
      password: "Launch123!"
    });

    assert.equal(result.session.id, "ses_new");
    assert.equal(audits.length, 1);
    assert.equal(audits[0]?.action, "auth.password.reset_completed");
    assert.equal(audits[0]?.entityType, "User");
    assert.equal(audits[0]?.entityId, "usr_owner");
    assert.deepEqual(audits[0]?.metadata, {
      tokenId: "tok_reset_1",
      revokedSessionCount: 2,
      revokedRefreshTokenCount: 3
    });
  }
});

test("changePassword writes an audit entry after revoking older sessions", async () => {
  const { service, audits } = createService();

  const currentPassword = "Current123!";

  const { hashPassword } = await import("./password.js");
  const passwordHash = await hashPassword(currentPassword);

  (
    service as unknown as {
      prisma: {
        user: {
          findFirst: (input: Record<string, unknown>) => Promise<unknown>;
        };
      };
    }
  ).prisma.user = {
    findFirst: async () => ({
      id: "usr_owner",
      tenantId: "ten_launch",
      email: "owner@candit.ai",
      fullName: "Launch Owner",
      role: Role.OWNER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      passwordHash,
      emailVerifiedAt: null,
      avatarUrl: null
    })
  };
  (service as unknown as { issueSessionForUserId: (userId: string) => Promise<Record<string, unknown>> }).issueSessionForUserId =
    async (userId: string) => ({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: userId
      },
      session: {
        id: "ses_rotated",
        authMode: "jwt",
        expiresAt: new Date("2026-05-02T12:00:00.000Z").toISOString()
      }
    });

  const result = await service.changePassword({
    userId: "usr_owner",
    tenantId: "ten_launch",
    sessionId: "ses_current",
    currentPassword,
    newPassword: "Launch456!"
  });

  assert.equal(result.session.id, "ses_rotated");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "auth.password.changed");
  assert.deepEqual(audits[0]?.metadata, {
    sessionId: "ses_current",
    revokedSessionCount: 2,
    revokedRefreshTokenCount: 3
  });
});
