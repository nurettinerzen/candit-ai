import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { AuthController } from "./auth.controller";

function createController(values: Record<string, string> = {}) {
  const runtimeConfig = new RuntimeConfigService(new ConfigService(values));
  return new AuthController({} as never, runtimeConfig);
}

test("getProviders exposes Google readiness and the V1 enterprise SSO boundary", () => {
  const controller = createController({
    GOOGLE_AUTH_CLIENT_ID: "google-client-id",
    GOOGLE_AUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_AUTH_REDIRECT_URI: "https://app.candit.ai/auth/google/callback"
  });

  assert.deepEqual(controller.getProviders(), {
    google: {
      enabled: true
    },
    enterpriseSso: {
      enabled: false,
      launchStatus: "unsupported",
      reason: "Enterprise OIDC/SSO V1 kapsamına dahil değil."
    }
  });
});

test("getProviders disables Google when auth provider configuration is incomplete", () => {
  const controller = createController({
    GOOGLE_AUTH_CLIENT_ID: "",
    GOOGLE_AUTH_CLIENT_SECRET: "",
    GOOGLE_AUTH_REDIRECT_URI: "",
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    GOOGLE_OAUTH_REDIRECT_URI: ""
  });

  assert.deepEqual(controller.getProviders(), {
    google: {
      enabled: false
    },
    enterpriseSso: {
      enabled: false,
      launchStatus: "unsupported",
      reason: "Enterprise OIDC/SSO V1 kapsamına dahil değil."
    }
  });
});

test("getProviders keeps Google disabled in production until explicitly enabled", () => {
  const controller = createController({
    APP_RUNTIME_MODE: "production",
    GOOGLE_AUTH_CLIENT_ID: "google-client-id",
    GOOGLE_AUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_AUTH_REDIRECT_URI: "https://app.candit.ai/auth/google/callback"
  });

  assert.deepEqual(controller.getProviders(), {
    google: {
      enabled: false
    },
    enterpriseSso: {
      enabled: false,
      launchStatus: "unsupported",
      reason: "Enterprise OIDC/SSO V1 kapsamına dahil değil."
    }
  });
});
