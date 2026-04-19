import { Controller, Get, Query, Res, Inject, BadRequestException, Logger } from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import { IntegrationProvider } from "@prisma/client";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { IntegrationsService } from "./integrations.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";

@Controller("integrations/calendly")
export class CalendlyOAuthController {
  private readonly logger = new Logger(CalendlyOAuthController.name);

  constructor(
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(IntegrationsService) private readonly integrationsService: IntegrationsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BillingService) private readonly billingService: BillingService
  ) {}

  private integrationsSettingsUrl(search: Record<string, string>) {
    const url = new URL(`${this.runtimeConfig.publicWebBaseUrl}/settings`);
    url.searchParams.set("tab", "entegrasyonlar");

    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  @Get("authorize")
  @Permissions("integration.manage")
  async authorize(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: ExpressResponse
  ) {
    await this.billingService.assertFeatureEnabled(tenantId, "calendarIntegrations");

    const calendly = this.runtimeConfig.calendlyConfig;
    const clientId = process.env.CALENDLY_OAUTH_CLIENT_ID?.trim() ?? "";
    const redirectUri = process.env.CALENDLY_OAUTH_REDIRECT_URI?.trim() ?? "";

    if (!clientId || !redirectUri || !calendly.oauthClientSecretConfigured) {
      throw new BadRequestException(
        "Calendly OAuth is not configured. Set CALENDLY_OAUTH_CLIENT_ID, CALENDLY_OAUTH_CLIENT_SECRET and CALENDLY_OAUTH_REDIRECT_URI."
      );
    }

    const statePayload = Buffer.from(
      JSON.stringify({ tenantId, userId: user.userId })
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      state: statePayload
    });

    const authorizeUrl =
      process.env.CALENDLY_OAUTH_AUTHORIZE_URL?.trim() ??
      "https://auth.calendly.com/oauth/authorize";

    return res.redirect(`${authorizeUrl}?${params.toString()}`);
  }

  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: ExpressResponse
  ) {
    if (error) {
      this.logger.warn(`Calendly OAuth error: ${error}`);
      return res.redirect(this.integrationsSettingsUrl({ error }));
    }

    if (!code || !state) {
      this.logger.warn("Calendly OAuth callback missing code or state");
      return res.redirect(this.integrationsSettingsUrl({ error: "missing_code_or_state" }));
    }

    let tenantId: string;
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      tenantId = decoded.tenantId;
      userId = decoded.userId;
      if (!tenantId || !userId) {
        throw new Error("missing fields");
      }
    } catch {
      this.logger.warn("Calendly OAuth callback: invalid state parameter");
      return res.redirect(this.integrationsSettingsUrl({ error: "invalid_state" }));
    }

    const clientId = process.env.CALENDLY_OAUTH_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.CALENDLY_OAUTH_CLIENT_SECRET?.trim() ?? "";
    const redirectUri = process.env.CALENDLY_OAUTH_REDIRECT_URI?.trim() ?? "";

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error("Calendly OAuth callback reached without complete OAuth configuration");
      return res.redirect(this.integrationsSettingsUrl({ error: "calendly_oauth_not_configured" }));
    }

    const tokenEndpoint =
      process.env.CALENDLY_OAUTH_TOKEN_URL?.trim() ?? "https://auth.calendly.com/oauth/token";

    let tokenResponse: globalThis.Response;
    try {
      tokenResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });
    } catch (err) {
      this.logger.error("Calendly OAuth token exchange network error", err);
      return res.redirect(this.integrationsSettingsUrl({ error: "token_exchange_failed" }));
    }

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      this.logger.error(
        `Calendly OAuth token exchange failed: ${tokenResponse.status} ${errorBody.slice(0, 300)}`
      );
      return res.redirect(
        this.integrationsSettingsUrl({ error: `token_exchange_http_${tokenResponse.status}` })
      );
    }

    const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : undefined;
    const refreshToken =
      typeof tokenData.refresh_token === "string" ? tokenData.refresh_token : undefined;
    const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : undefined;
    const scope = typeof tokenData.scope === "string" ? tokenData.scope : undefined;

    if (!accessToken) {
      this.logger.error("Calendly OAuth: no access_token in response");
      return res.redirect(this.integrationsSettingsUrl({ error: "no_access_token" }));
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;

    try {
      await this.ensureCalendlyConnection(tenantId);

      await this.integrationsService.upsertConnectionCredential({
        tenantId,
        provider: IntegrationProvider.CALENDLY,
        accessToken,
        refreshToken,
        expiresAt,
        scope,
        requestedBy: userId,
        traceId: `calendly_oauth_callback_${Date.now()}`
      });
    } catch (err) {
      this.logger.error("Failed to store Calendly OAuth credentials", err);
      return res.redirect(this.integrationsSettingsUrl({ error: "credential_storage_failed" }));
    }

    return res.redirect(this.integrationsSettingsUrl({ calendly_connected: "true" }));
  }

  private async ensureCalendlyConnection(tenantId: string) {
    const existing = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: IntegrationProvider.CALENDLY
        }
      }
    });

    if (existing) {
      if (existing.status !== "ACTIVE") {
        await this.prisma.integrationConnection.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            displayName: "Calendly",
            lastError: null
          }
        });
      }
      return existing;
    }

    return this.prisma.integrationConnection.create({
      data: {
        tenantId,
        provider: IntegrationProvider.CALENDLY,
        status: "ACTIVE",
        displayName: "Calendly",
        configJson: {},
        credentialsJson: {}
      }
    });
  }
}
