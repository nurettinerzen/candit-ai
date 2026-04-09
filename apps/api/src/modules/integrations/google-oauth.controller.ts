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

/**
 * Handles the full Google OAuth2 authorization code flow:
 *
 *   1. GET /integrations/google/authorize
 *      → Authenticated recruiter hits this to start the flow.
 *        Redirects to Google's consent screen with proper scopes.
 *
 *   2. GET /integrations/google/callback
 *      → Google redirects here after user grants consent.
 *        Exchanges the authorization code for tokens and stores them.
 *        This must be @Public() because Google redirects the browser directly.
 */
@Controller("integrations/google")
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

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

  /**
   * Step 1: Redirect authenticated user to Google's consent screen.
   * The `state` param encodes tenantId + userId so the callback can attribute the tokens.
   */
  @Get("authorize")
  @Permissions("integration.manage")
  async authorize(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: ExpressResponse
  ) {
    void user;
    await this.billingService.assertFeatureEnabled(tenantId, "calendarIntegrations");
    const googleCalendar = this.runtimeConfig.googleCalendarConfig;
    const clientId = googleCalendar.oauthClientId;
    const redirectUri = googleCalendar.oauthRedirectUri;

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_REDIRECT_URI."
      );
    }

    const scopes = googleCalendar.oauthScopes.join(" ");

    // Encode tenant + user into state so callback knows who authorized
    const statePayload = Buffer.from(
      JSON.stringify({ tenantId, userId: user.userId })
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      access_type: "offline",       // ensures we get a refresh_token
      prompt: "consent",            // force consent to always get refresh_token
      state: statePayload
    });

    const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(authorizeUrl);
  }

  /**
   * Step 2: Google redirects here with ?code=...&state=...
   * Must be @Public() because the browser follows Google's redirect (no auth headers).
   */
  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: ExpressResponse
  ) {
    // Google returned an error (user denied consent, etc.)
    if (error) {
      this.logger.warn(`Google OAuth error: ${error}`);
      return res.redirect(this.integrationsSettingsUrl({ error }));
    }

    if (!code || !state) {
      this.logger.warn("Google OAuth callback missing code or state");
      return res.redirect(this.integrationsSettingsUrl({ error: "missing_code_or_state" }));
    }

    // Decode state to get tenantId + userId
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
      this.logger.warn("Google OAuth callback: invalid state parameter");
      return res.redirect(this.integrationsSettingsUrl({ error: "invalid_state" }));
    }

    // Exchange authorization code for tokens
    const googleCalendar = this.runtimeConfig.googleCalendarConfig;
    const clientId = googleCalendar.oauthClientId;
    const clientSecret = googleCalendar.oauthClientSecret;
    const redirectUri = googleCalendar.oauthRedirectUri;

    if (
      !googleCalendar.oauthClientIdConfigured ||
      !googleCalendar.oauthClientSecretConfigured ||
      !googleCalendar.oauthRedirectUriConfigured ||
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      this.logger.error("Google OAuth callback reached without complete OAuth configuration");
      return res.redirect(this.integrationsSettingsUrl({ error: "google_oauth_not_configured" }));
    }

    let tokenResponse: globalThis.Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
      this.logger.error("Google OAuth token exchange network error", err);
      return res.redirect(this.integrationsSettingsUrl({ error: "token_exchange_failed" }));
    }

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      this.logger.error(`Google OAuth token exchange failed: ${tokenResponse.status} ${errorBody.slice(0, 300)}`);
      return res.redirect(
        this.integrationsSettingsUrl({ error: `token_exchange_http_${tokenResponse.status}` })
      );
    }

    const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : undefined;
    const refreshToken = typeof tokenData.refresh_token === "string" ? tokenData.refresh_token : undefined;
    const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : undefined;
    const scope = typeof tokenData.scope === "string" ? tokenData.scope : undefined;

    if (!accessToken) {
      this.logger.error("Google OAuth: no access_token in response");
      return res.redirect(this.integrationsSettingsUrl({ error: "no_access_token" }));
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;

    // Ensure GOOGLE_CALENDAR connection exists, then store credentials
    try {
      await this.ensureGoogleConnection(tenantId);

      await this.integrationsService.upsertConnectionCredential({
        tenantId,
        provider: IntegrationProvider.GOOGLE_CALENDAR,
        accessToken,
        refreshToken,
        expiresAt,
        scope,
        requestedBy: userId,
        traceId: `google_oauth_callback_${Date.now()}`
      });

      this.logger.log(`Google OAuth tokens stored for tenant=${tenantId}, user=${userId}`);
    } catch (err) {
      this.logger.error("Failed to store Google OAuth credentials", err);
      return res.redirect(this.integrationsSettingsUrl({ error: "credential_storage_failed" }));
    }

    // Redirect back to integrations page with success
    return res.redirect(this.integrationsSettingsUrl({ google_connected: "true" }));
  }

  /**
   * Ensures an IntegrationConnection row exists for GOOGLE_CALENDAR.
   * If the seed data already created one (INACTIVE), we activate it.
   */
  private async ensureGoogleConnection(tenantId: string) {
    const existing = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: IntegrationProvider.GOOGLE_CALENDAR
        }
      }
    });

    if (existing) {
      // Activate if currently inactive
      if (existing.status !== "ACTIVE") {
        await this.prisma.integrationConnection.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            displayName: "Google Calendar",
            lastError: null
          }
        });
      }
      return existing;
    }

    // Create fresh connection
    return this.prisma.integrationConnection.create({
      data: {
        tenantId,
        provider: IntegrationProvider.GOOGLE_CALENDAR,
        status: "ACTIVE",
        displayName: "Google Calendar",
        configJson: {},
        credentialsJson: {}
      }
    });
  }
}
