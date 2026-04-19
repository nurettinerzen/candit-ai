import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { RuntimeConfigService, isLocalOrigin } from "./runtime-config.service";

function createRuntimeConfig(values: Record<string, string>) {
  return new RuntimeConfigService(new ConfigService(values));
}

test("isLocalOrigin detects localhost style hosts", () => {
  assert.equal(isLocalOrigin("http://localhost:3000"), true);
  assert.equal(isLocalOrigin("https://127.0.0.1:4000"), true);
  assert.equal(isLocalOrigin("https://app.candit.ai"), false);
});

test("assertProductionSafety rejects insecure auth and local launch config", () => {
  const runtimeConfig = createRuntimeConfig({
    APP_RUNTIME_MODE: "production",
    AUTH_SESSION_MODE: "hybrid",
    AUTH_TOKEN_TRANSPORT: "header",
    AUTH_COOKIE_SECURE: "false",
    JWT_SECRET: "change-me",
    PUBLIC_WEB_BASE_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000"
  });

  assert.throws(() => runtimeConfig.assertProductionSafety(), /Production safety ihlali/);
});

test("assertProductionSafety accepts hardened production settings", () => {
  const runtimeConfig = createRuntimeConfig({
    APP_RUNTIME_MODE: "production",
    AUTH_SESSION_MODE: "jwt",
    AUTH_TOKEN_TRANSPORT: "cookie",
    AUTH_COOKIE_SECURE: "true",
    JWT_SECRET: "super-secure-launch-secret",
    PUBLIC_WEB_BASE_URL: "https://app.candit.ai",
    CORS_ORIGIN: "https://app.candit.ai"
  });

  assert.doesNotThrow(() => runtimeConfig.assertProductionSafety());
});

test("launchBoundaries expose pilot, setup-required, and unsupported providers clearly", () => {
  const runtimeConfig = createRuntimeConfig({
    AUTH_SESSION_MODE: "jwt",
    EMAIL_PROVIDER: "console",
    CALENDLY_OAUTH_CLIENT_ID: "cal_client",
    CALENDLY_OAUTH_CLIENT_SECRET: "cal_secret",
    CALENDLY_OAUTH_REDIRECT_URI: "https://app.candit.ai/auth/calendly/callback",
    GOOGLE_OAUTH_CLIENT_ID: "google_client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google_secret",
    GOOGLE_AUTH_REDIRECT_URI: "https://app.candit.ai/auth/google/callback"
  });

  const boundaries = runtimeConfig.launchBoundaries;

  assert.equal(boundaries.email.status, "pilot");
  assert.equal(boundaries.email.provider, "console");
  assert.equal(boundaries.billing.status, "setup_required");
  assert.equal(boundaries.authentication.sessionMode, "jwt");
  assert.equal(boundaries.authentication.googleOAuth.status, "pilot");
  assert.equal(boundaries.authentication.enterpriseSso.status, "unsupported");
  assert.equal(
    boundaries.scheduling.providers.find((provider) => provider.provider === "CALENDLY")?.status,
    "pilot"
  );
  assert.equal(
    boundaries.scheduling.providers.find((provider) => provider.provider === "ZOOM")?.status,
    "unsupported"
  );
});

test("getProviderConfigurationWarnings highlights production credential drift and local OAuth redirects", () => {
  const runtimeConfig = createRuntimeConfig({
    APP_RUNTIME_MODE: "production",
    AUTH_SESSION_MODE: "jwt",
    AUTH_TOKEN_TRANSPORT: "cookie",
    AUTH_COOKIE_SECURE: "true",
    JWT_SECRET: "super-secure-launch-secret",
    PUBLIC_WEB_BASE_URL: "https://app.candit.ai",
    CORS_ORIGIN: "https://app.candit.ai",
    EMAIL_PROVIDER: "console",
    STRIPE_SECRET_KEY: "sk_test_launch_drift",
    GOOGLE_OAUTH_CLIENT_ID: "google_client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google_secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:4000/v1/integrations/google/callback",
    CALENDLY_OAUTH_CLIENT_ID: "cal_client",
    CALENDLY_OAUTH_CLIENT_SECRET: "cal_secret",
    CALENDLY_OAUTH_REDIRECT_URI: "http://localhost:4000/v1/integrations/calendly/callback"
  });

  const warnings = runtimeConfig.getProviderConfigurationWarnings();

  assert.ok(
    warnings.some((warning) => warning.includes("EMAIL_PROVIDER=console in production"))
  );
  assert.ok(
    warnings.some((warning) => warning.includes("Stripe test secret key is configured in production"))
  );
  assert.ok(
    warnings.some((warning) => warning.includes("Google OAuth redirect URI still points to a local origin"))
  );
  assert.ok(
    warnings.some((warning) =>
      warning.includes("Calendly OAuth redirect URI still points to a local origin")
    )
  );
});
