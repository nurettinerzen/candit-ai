import { Controller, Get, Query, Res, Inject, Logger } from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { AuthService } from "./auth.service";

function normalizeIntent(raw: string | undefined) {
  return raw === "signup" ? "signup" : "login";
}

function normalizeReturnTo(raw: string | undefined) {
  const trimmed = raw?.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/dashboard";
  }

  return trimmed;
}

@Controller("auth/google")
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Get("authorize")
  @Public()
  authorize(
    @Query("intent") rawIntent: string | undefined,
    @Query("companyName") companyName: string | undefined,
    @Query("returnTo") returnTo: string | undefined,
    @Res() response: ExpressResponse
  ) {
    const intent = normalizeIntent(rawIntent);
    const googleAuth = this.runtimeConfig.googleAuthConfig;

    if (!googleAuth.launchEnabled) {
      return response.redirect(
        this.toWebErrorUrl(intent, "google_auth_disabled", normalizeReturnTo(returnTo))
      );
    }

    if (!googleAuth.clientId || !googleAuth.clientSecret || !googleAuth.redirectUri) {
      return response.redirect(
        this.toWebErrorUrl(intent, "google_auth_not_configured", normalizeReturnTo(returnTo))
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        intent,
        companyName: companyName?.trim() || null,
        returnTo: normalizeReturnTo(returnTo)
      })
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: googleAuth.clientId,
      redirect_uri: googleAuth.redirectUri,
      response_type: "code",
      scope: googleAuth.scopes.join(" "),
      access_type: "offline",
      prompt: "select_account",
      state
    });

    return response.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  }

  @Get("callback")
  @Public()
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() response: ExpressResponse
  ) {
    let decodedState: {
      intent: "login" | "signup";
      companyName?: string | null;
      returnTo: string;
    };

    try {
      decodedState = JSON.parse(
        Buffer.from(state ?? "", "base64url").toString("utf-8")
      ) as typeof decodedState;
    } catch {
      return response.redirect(this.toWebErrorUrl("login", "invalid_google_state", "/dashboard"));
    }

    const intent = normalizeIntent(decodedState.intent);
    const resolvedReturnTo = normalizeReturnTo(decodedState.returnTo);
    const googleAuth = this.runtimeConfig.googleAuthConfig;

    if (!googleAuth.launchEnabled) {
      return response.redirect(this.toWebErrorUrl(intent, "google_auth_disabled", resolvedReturnTo));
    }

    if (error) {
      return response.redirect(this.toWebErrorUrl(intent, error, resolvedReturnTo));
    }

    if (!code || !state) {
      return response.redirect(
        this.toWebErrorUrl(intent, "missing_google_code_or_state", resolvedReturnTo)
      );
    }

    if (!googleAuth.clientId || !googleAuth.clientSecret || !googleAuth.redirectUri) {
      return response.redirect(
        this.toWebErrorUrl(intent, "google_auth_not_configured", resolvedReturnTo)
      );
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          client_id: googleAuth.clientId,
          client_secret: googleAuth.clientSecret,
          redirect_uri: googleAuth.redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenResponse.ok) {
        this.logger.warn(`google.auth.token_exchange_failed:${tokenResponse.status}`);
        return response.redirect(
          this.toWebErrorUrl(intent, `google_token_exchange_${tokenResponse.status}`, resolvedReturnTo)
        );
      }

      const tokenPayload = (await tokenResponse.json()) as {
        access_token?: string;
      };

      if (!tokenPayload.access_token) {
        return response.redirect(
          this.toWebErrorUrl(intent, "google_access_token_missing", resolvedReturnTo)
        );
      }

      const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`
        }
      });

      if (!userInfoResponse.ok) {
        this.logger.warn(`google.auth.userinfo_failed:${userInfoResponse.status}`);
        return response.redirect(
          this.toWebErrorUrl(intent, `google_userinfo_${userInfoResponse.status}`, resolvedReturnTo)
        );
      }

      const profile = (await userInfoResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };

      if (!profile.sub || !profile.email) {
        return response.redirect(
          this.toWebErrorUrl(intent, "google_profile_incomplete", resolvedReturnTo)
        );
      }

      const user = await this.authService.resolveGoogleAuth({
        intent,
        companyName: decodedState.companyName ?? undefined,
        profile: {
          subject: profile.sub,
          email: profile.email,
          emailVerified: Boolean(profile.email_verified),
          fullName: profile.name?.trim() || profile.email,
          avatarUrl: profile.picture ?? null
        }
      });

      const relay = await this.authService.createOauthRelayToken({
        userId: user.id
      });

      const callbackUrl = new URL(
        `${this.runtimeConfig.publicWebBaseUrl.replace(/\/+$/, "")}/auth/oauth/callback`
      );
      callbackUrl.searchParams.set("token", relay.rawToken);
      callbackUrl.searchParams.set("returnTo", resolvedReturnTo);
      callbackUrl.searchParams.set("intent", intent);

      return response.redirect(callbackUrl.toString());
    } catch (callbackError) {
      const message =
        callbackError instanceof Error && callbackError.message.trim().length > 0
          ? callbackError.message
          : "google_auth_failed";

      this.logger.warn(`google.auth.callback_failed:${message}`);
      return response.redirect(this.toWebErrorUrl(intent, message, resolvedReturnTo));
    }
  }

  private toWebErrorUrl(
    intent: "login" | "signup",
    errorCode: string,
    returnTo: string
  ) {
    const url = new URL(
      `${this.runtimeConfig.publicWebBaseUrl.replace(/\/+$/, "")}/auth/${intent}`
    );

    url.searchParams.set("oauth_error", errorCode);
    url.searchParams.set("returnTo", normalizeReturnTo(returnTo));
    return url.toString();
  }
}
