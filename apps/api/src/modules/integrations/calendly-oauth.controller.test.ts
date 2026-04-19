import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response as ExpressResponse } from "express";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { CalendlyOAuthController } from "./calendly-oauth.controller";

function createController(values: Record<string, string> = {}) {
  const runtimeConfig = new RuntimeConfigService(
    new ConfigService({
      PUBLIC_WEB_BASE_URL: "https://app.candit.ai",
      ...values
    })
  );
  const credentialWrites: Array<Record<string, unknown>> = [];
  let billingTenantId = "";

  const controller = new CalendlyOAuthController(
    runtimeConfig,
    {
      upsertConnectionCredential: async (input: Record<string, unknown>) => {
        credentialWrites.push(input);
        return { id: "cred_1" };
      }
    } as never,
    {
      integrationConnection: {
        findUnique: async () => null,
        update: async (input: Record<string, unknown>) => input,
        create: async (input: Record<string, unknown>) => input
      }
    } as never,
    {
      assertFeatureEnabled: async (tenantId: string) => {
        billingTenantId = tenantId;
      }
    } as never
  );

  return {
    controller,
    credentialWrites,
    getBillingTenantId() {
      return billingTenantId;
    }
  };
}

function createResponseCapture() {
  let redirectedTo = "";

  return {
    response: {
      redirect(url: string) {
        redirectedTo = url;
        return url;
      }
    } as unknown as ExpressResponse,
    get redirectedTo() {
      return redirectedTo;
    }
  };
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T> | T
) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("authorize rejects Calendly OAuth setup when required configuration is missing", async () => {
  const { controller } = createController();
  const { response } = createResponseCapture();

  await withEnv(
    {
      CALENDLY_OAUTH_CLIENT_ID: undefined,
      CALENDLY_OAUTH_CLIENT_SECRET: undefined,
      CALENDLY_OAUTH_REDIRECT_URI: undefined
    },
    async () => {
      await assert.rejects(
        () =>
          controller.authorize("ten_1", { userId: "usr_1" } as never, response),
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.message.includes("Calendly OAuth is not configured")
      );
    }
  );
});

test("authorize redirects to Calendly with tenant and user encoded in state", async () => {
  const { controller, getBillingTenantId } = createController({
    CALENDLY_OAUTH_CLIENT_SECRET: "cal-secret"
  });
  const redirectCapture = createResponseCapture();

  await withEnv(
    {
      CALENDLY_OAUTH_CLIENT_ID: "cal-client",
      CALENDLY_OAUTH_CLIENT_SECRET: "cal-secret",
      CALENDLY_OAUTH_REDIRECT_URI: "https://app.candit.ai/v1/integrations/calendly/callback"
    },
    async () => {
      await controller.authorize(
        "ten_42",
        { userId: "usr_99" } as never,
        redirectCapture.response
      );
    }
  );

  assert.equal(getBillingTenantId(), "ten_42");

  const redirectedUrl = new URL(redirectCapture.redirectedTo);
  assert.equal(redirectedUrl.origin, "https://auth.calendly.com");
  assert.equal(redirectedUrl.pathname, "/oauth/authorize");
  assert.equal(redirectedUrl.searchParams.get("client_id"), "cal-client");
  assert.equal(redirectedUrl.searchParams.get("response_type"), "code");
  assert.equal(
    redirectedUrl.searchParams.get("redirect_uri"),
    "https://app.candit.ai/v1/integrations/calendly/callback"
  );

  const state = redirectedUrl.searchParams.get("state");
  assert.ok(state);
  assert.deepEqual(JSON.parse(Buffer.from(state!, "base64url").toString("utf-8")), {
    tenantId: "ten_42",
    userId: "usr_99"
  });
});

test("callback redirects to settings when Calendly OAuth returns incomplete parameters", async () => {
  const { controller } = createController();
  const redirectCapture = createResponseCapture();

  await controller.callback(undefined, undefined, undefined, redirectCapture.response);

  assert.equal(
    redirectCapture.redirectedTo,
    "https://app.candit.ai/settings?tab=entegrasyonlar&error=missing_code_or_state"
  );
});

test("callback rejects invalid Calendly state payloads before token exchange", async () => {
  const { controller } = createController();
  const redirectCapture = createResponseCapture();

  await controller.callback("code_1", "not-base64", undefined, redirectCapture.response);

  assert.equal(
    redirectCapture.redirectedTo,
    "https://app.candit.ai/settings?tab=entegrasyonlar&error=invalid_state"
  );
});
