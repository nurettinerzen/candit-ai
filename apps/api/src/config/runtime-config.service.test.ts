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
    GOOGLE_OAUTH_CLIENT_ID: "google_client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google_secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://app.candit.ai/v1/integrations/google/callback",
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
    boundaries.scheduling.providers.find((provider) => provider.provider === "GOOGLE_CALENDAR")?.status,
    "pilot"
  );
  assert.equal(
    boundaries.scheduling.providers.find((provider) => provider.provider === "ZOOM")?.status,
    "unsupported"
  );
});

test("launchBoundaries keep Google surfaces unsupported in production until explicitly enabled", () => {
  const runtimeConfig = createRuntimeConfig({
    APP_RUNTIME_MODE: "production",
    AUTH_SESSION_MODE: "jwt",
    AUTH_TOKEN_TRANSPORT: "cookie",
    AUTH_COOKIE_SECURE: "true",
    JWT_SECRET: "super-secure-launch-secret",
    PUBLIC_WEB_BASE_URL: "https://app.candit.ai",
    CORS_ORIGIN: "https://app.candit.ai",
    GOOGLE_OAUTH_CLIENT_ID: "google_client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google_secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://app.candit.ai/v1/integrations/google/callback",
    GOOGLE_AUTH_CLIENT_ID: "google-client-id",
    GOOGLE_AUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_AUTH_REDIRECT_URI: "https://app.candit.ai/auth/google/callback"
  });

  const boundaries = runtimeConfig.launchBoundaries;

  assert.equal(boundaries.authentication.googleOAuth.status, "unsupported");
  assert.equal(boundaries.authentication.googleOAuth.ready, false);
  assert.equal(
    boundaries.scheduling.providers.find((provider) => provider.provider === "GOOGLE_CALENDAR")?.status,
    "unsupported"
  );
  assert.equal(
    runtimeConfig.getProviderConfigurationWarnings().some((warning) =>
      warning.includes("Google OAuth env vars are incomplete")
    ),
    false
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
    GOOGLE_SCHEDULING_ENABLED: "true",
    GOOGLE_OAUTH_CLIENT_ID: "google_client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google_secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:4000/v1/integrations/google/callback"
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
});

test("getEnvironmentConfigurationWarnings highlights frontend/runtime drift and demo shortcuts", () => {
  const runtimeConfig = createRuntimeConfig({
    APP_RUNTIME_MODE: "production",
    AUTH_SESSION_MODE: "jwt",
    AUTH_TOKEN_TRANSPORT: "cookie",
    AUTH_COOKIE_SECURE: "true",
    JWT_SECRET: "super-secure-launch-secret",
    PUBLIC_WEB_BASE_URL: "https://app.candit.ai",
    CORS_ORIGIN: "https://app.candit.ai",
    NEXT_PUBLIC_APP_RUNTIME_MODE: "demo",
    NEXT_PUBLIC_AUTH_SESSION_MODE: "hybrid",
    NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT: "header",
    NEXT_PUBLIC_ENABLE_DEMO_SESSION: "true",
    DEV_LOGIN_PASSWORD: "demo12345"
  });

  const warnings = runtimeConfig.getEnvironmentConfigurationWarnings();

  assert.ok(
    warnings.some((warning) =>
      warning.includes("NEXT_PUBLIC_APP_RUNTIME_MODE (demo) does not match APP_RUNTIME_MODE (production)")
    )
  );
  assert.ok(
    warnings.some((warning) =>
      warning.includes("NEXT_PUBLIC_AUTH_SESSION_MODE (hybrid) does not match AUTH_SESSION_MODE (jwt)")
    )
  );
  assert.ok(
    warnings.some((warning) =>
      warning.includes("NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT (header) does not match AUTH_TOKEN_TRANSPORT (cookie)")
    )
  );
  assert.ok(
    warnings.some((warning) => warning.includes("NEXT_PUBLIC_ENABLE_DEMO_SESSION is active"))
  );
  assert.ok(
    warnings.some((warning) => warning.includes("DEV_LOGIN_PASSWORD is set to a usable value"))
  );
});

test("development corsOrigins include common local web ports used by smoke and browser QA", () => {
  const runtimeConfig = createRuntimeConfig({});

  assert.deepEqual(runtimeConfig.corsOrigins, [
    "http://localhost:3000",
    "http://localhost:3100",
    "http://localhost:3200",
    "http://localhost:3500",
    "http://localhost:3600"
  ]);
});

test("providerReadiness marks speech unready when provider-backed speech env is missing", () => {
  const runtimeConfig = createRuntimeConfig({
    SPEECH_STT_PROVIDER: "openai",
    SPEECH_TTS_PROVIDER: "elevenlabs"
  });

  const readiness = runtimeConfig.providerReadiness;
  const warnings = runtimeConfig.getProviderConfigurationWarnings();

  assert.equal(readiness.speech.ready, false);
  assert.ok(
    warnings.some((warning) => warning.includes("SPEECH_STT_PROVIDER=openai but OPENAI_API_KEY is missing"))
  );
  assert.ok(
    warnings.some((warning) =>
      warning.includes("SPEECH_TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY is missing")
    )
  );
});
