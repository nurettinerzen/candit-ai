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
