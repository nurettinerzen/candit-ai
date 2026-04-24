import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

function createController(overrides?: {
  validateAtStartup?: () => {
    healthy: boolean;
    warnings: string[];
    providers: Record<string, { ready: boolean; mode: string }>;
  };
  providerReadiness?: Record<string, unknown>;
  runtimeMode?: string;
  authMode?: string;
  authTokenTransport?: string;
}) {
  const runtimeConfig = {
    validateAtStartup:
      overrides?.validateAtStartup ??
      (() => ({
        healthy: true,
        warnings: [],
        providers: {
          ai_parsing: {
            ready: true,
            mode: "provider"
          }
        }
      })),
    providerReadiness:
      overrides?.providerReadiness ??
      ({
        parsing: {
          provider: "openai",
          mode: "provider",
          ready: true
        }
      } as Record<string, unknown>),
    runtimeMode: overrides?.runtimeMode ?? "production",
    authMode: overrides?.authMode ?? "jwt",
    authTokenTransport: overrides?.authTokenTransport ?? "cookie"
  };

  return new HealthController(runtimeConfig as never);
}

test("getHealth reports degraded status when startup validation is unhealthy", () => {
  const controller = createController({
    validateAtStartup: () => ({
      healthy: false,
      warnings: ["Email provider selected but provider credentials are missing."],
      providers: {
        email_notifications: {
          ready: false,
          mode: "console"
        }
      }
    })
  });

  const result = controller.getHealth();

  assert.equal(result.status, "degraded");
  assert.equal(result.healthy, false);
  assert.equal(result.warningCount, 1);
  assert.equal(result.auth.sessionMode, "jwt");
  assert.equal(result.auth.tokenTransport, "cookie");
});

test("getProviderHealth exposes startup warnings alongside provider readiness", () => {
  const controller = createController({
    validateAtStartup: () => ({
      healthy: false,
      warnings: ["OPENAI_API_KEY missing; AI parsing/screening runs will use deterministic fallback."],
      providers: {
        ai_parsing: {
          ready: false,
          mode: "fallback"
        }
      }
    }),
    providerReadiness: {
      parsing: {
        provider: "deterministic-fallback",
        mode: "fallback",
        ready: false
      }
    }
  });

  const result = controller.getProviderHealth();

  assert.equal(result.status, "degraded");
  assert.equal(result.healthy, false);
  assert.deepEqual(result.warnings, [
    "OPENAI_API_KEY missing; AI parsing/screening runs will use deterministic fallback."
  ]);
  assert.deepEqual(result.startupValidation.providers.ai_parsing, {
    ready: false,
    mode: "fallback"
  });
});

test("getReadiness throws 503 with payload when startup validation is unhealthy", () => {
  const controller = createController({
    validateAtStartup: () => ({
      healthy: false,
      warnings: ["Stripe billing ayarları eksik."],
      providers: {
        stripe_billing: {
          ready: false,
          mode: "not_configured"
        }
      }
    })
  });

  assert.throws(
    () => controller.getReadiness(),
    (error: unknown) => {
      assert.ok(error instanceof ServiceUnavailableException);
      const response = error.getResponse() as Record<string, unknown>;
      assert.equal(response.status, "not_ready");
      assert.equal(response.healthy, false);
      assert.deepEqual(response.warnings, ["Stripe billing ayarları eksik."]);
      return true;
    }
  );
});
