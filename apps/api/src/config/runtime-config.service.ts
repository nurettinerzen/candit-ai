import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AppRuntimeMode = "development" | "demo" | "production";
export type AuthSessionMode = "jwt" | "hybrid" | "dev_header";
export type AuthTokenTransport = "header" | "cookie";
export type LaunchSupportStatus = "ready" | "pilot" | "setup_required" | "unsupported";

export function isLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return value.includes("localhost") || value.includes("127.0.0.1") || value.includes("0.0.0.0");
  }
}

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
}

function toCsvList(value: string | undefined) {
  return value
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? [];
}

function inferStripeSecretKeyMode(secretKey: string | undefined) {
  const trimmed = secretKey?.trim();
  if (!trimmed) {
    return "not_configured" as const;
  }

  if (trimmed.startsWith("sk_live_")) {
    return "live" as const;
  }

  if (trimmed.startsWith("sk_test_")) {
    return "test" as const;
  }

  return "unknown" as const;
}

@Injectable()
export class RuntimeConfigService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  get runtimeMode(): AppRuntimeMode {
    const configured =
      this.configService.get<string>("APP_RUNTIME_MODE") ?? this.configService.get<string>("NODE_ENV");
    const normalized = configured?.trim().toLowerCase();

    if (normalized === "production") {
      return "production";
    }

    if (normalized === "demo") {
      return "demo";
    }

    return "development";
  }

  get authMode(): AuthSessionMode {
    const raw = this.configService.get<string>("AUTH_SESSION_MODE")?.trim().toLowerCase();

    if (raw === "jwt" || raw === "hybrid" || raw === "dev_header") {
      return raw;
    }

    if (this.runtimeMode === "production") {
      return "jwt";
    }

    return this.runtimeMode === "demo" ? "hybrid" : "dev_header";
  }

  get authTokenTransport(): AuthTokenTransport {
    const raw = this.configService.get<string>("AUTH_TOKEN_TRANSPORT")?.trim().toLowerCase();

    if (raw === "header" || raw === "cookie") {
      return raw;
    }

    return this.isProduction ? "cookie" : "header";
  }

  get isProduction() {
    return this.runtimeMode === "production";
  }

  get isDemoMode() {
    return this.runtimeMode === "demo";
  }

  get allowDevHeaderAuth() {
    if (this.isProduction) {
      return false;
    }

    if (this.authMode === "dev_header" || this.authMode === "hybrid") {
      return toBool(
        this.configService.get<string>("ALLOW_DEV_AUTH_HEADERS"),
        true
      );
    }

    return false;
  }

  get requireTenantHeader() {
    return toBool(
      this.configService.get<string>("REQUIRE_TENANT_HEADER"),
      this.authMode === "dev_header"
    );
  }

  get allowDemoShortcuts() {
    if (this.isProduction) {
      return false;
    }

    return this.isDemoMode || toBool(this.configService.get<string>("ALLOW_DEMO_SHORTCUTS"), false);
  }

  get allowDemoCredentialLogin() {
    return !this.isProduction && toBool(this.configService.get<string>("ALLOW_DEMO_CREDENTIAL_LOGIN"), true);
  }

  get accessTokenCookieName() {
    return this.configService.get<string>("AUTH_ACCESS_COOKIE_NAME") ?? "aii_access_token";
  }

  get refreshTokenCookieName() {
    return this.configService.get<string>("AUTH_REFRESH_COOKIE_NAME") ?? "aii_refresh_token";
  }

  get cookieSecure() {
    return toBool(this.configService.get<string>("AUTH_COOKIE_SECURE"), this.isProduction);
  }

  get cookieDomain() {
    return this.configService.get<string>("AUTH_COOKIE_DOMAIN")?.trim() || undefined;
  }

  get accessTokenTtlMinutes() {
    const raw = Number(this.configService.get<string>("AUTH_ACCESS_TTL_MINUTES") ?? "15");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 15;
  }

  get refreshTokenTtlDays() {
    const raw = Number(this.configService.get<string>("AUTH_REFRESH_TTL_DAYS") ?? "14");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 14;
  }

  get sessionTtlDays() {
    const raw = Number(this.configService.get<string>("AUTH_SESSION_TTL_DAYS") ?? "14");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 14;
  }

  get invitationTtlHours() {
    const raw = Number(this.configService.get<string>("AUTH_INVITATION_TTL_HOURS") ?? "72");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 72;
  }

  get emailVerificationTtlHours() {
    const raw = Number(this.configService.get<string>("AUTH_EMAIL_VERIFICATION_TTL_HOURS") ?? "48");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 48;
  }

  get passwordResetTtlHours() {
    const raw = Number(this.configService.get<string>("AUTH_PASSWORD_RESET_TTL_HOURS") ?? "2");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;
  }

  get oauthRelayTtlHours() {
    const raw = Number(this.configService.get<string>("AUTH_OAUTH_RELAY_TTL_HOURS") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }

  get googleSchedulingEnabled() {
    return toBool(this.configService.get<string>("GOOGLE_SCHEDULING_ENABLED"), !this.isProduction);
  }

  get googleAuthEnabled() {
    return toBool(this.configService.get<string>("GOOGLE_AUTH_ENABLED"), !this.isProduction);
  }

  assertProductionSafety() {
    if (!this.isProduction) {
      return;
    }

    const violations: string[] = [];
    const publicWebBaseUrl = this.publicWebBaseUrl;

    if (this.authMode !== "jwt") {
      violations.push("AUTH_SESSION_MODE production ortaminda jwt olmalidir.");
    }

    if (this.authTokenTransport !== "cookie") {
      violations.push("AUTH_TOKEN_TRANSPORT production ortaminda cookie olmalidir.");
    }

    if (!this.cookieSecure) {
      violations.push("AUTH_COOKIE_SECURE production ortaminda aktif olmalidir.");
    }

    if (this.allowDevHeaderAuth) {
      violations.push("ALLOW_DEV_AUTH_HEADERS production ortaminda aktif olamaz.");
    }

    if (this.allowDemoShortcuts) {
      violations.push("ALLOW_DEMO_SHORTCUTS production ortaminda aktif olamaz.");
    }

    if (this.allowDemoCredentialLogin) {
      violations.push("ALLOW_DEMO_CREDENTIAL_LOGIN production ortaminda aktif olamaz.");
    }

    const jwtSecret = this.configService.get<string>("JWT_SECRET")?.trim();
    if (!jwtSecret || jwtSecret === "change-me") {
      violations.push("JWT_SECRET production ortaminda guclu bir deger ile ayarlanmalidir.");
    }

    if (isLocalOrigin(publicWebBaseUrl)) {
      violations.push("PUBLIC_WEB_BASE_URL production ortaminda localhost olamaz.");
    }

    if (!publicWebBaseUrl.startsWith("https://")) {
      violations.push("PUBLIC_WEB_BASE_URL production ortaminda https ile baslamalidir.");
    }

    if (this.corsOrigins.some((origin) => isLocalOrigin(origin))) {
      violations.push("CORS_ORIGIN production ortaminda localhost iceremez.");
    }

    if (violations.length > 0) {
      throw new Error(`Production safety ihlali: ${violations.join(" ")}`);
    }
  }

  get corsOrigins() {
    const configured = this.configService.get<string>("CORS_ORIGIN")?.trim();

    if (configured && configured.length > 0) {
      return configured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }

    if (this.runtimeMode === "development") {
      return ["http://localhost:3000", "http://localhost:3100"];
    }

    return ["http://localhost:3000"];
  }

  get publicWebBaseUrl() {
    const explicit = this.configService.get<string>("PUBLIC_WEB_BASE_URL")?.trim();
    if (explicit && explicit.length > 0) {
      return explicit.replace(/\/+$/, "");
    }

    return this.corsOrigins[0]?.replace(/\/+$/, "") ?? "http://localhost:3000";
  }

  get openAiConfig() {
    return {
      apiKeyConfigured: Boolean(toOptionalString(this.configService.get<string>("OPENAI_API_KEY"))),
      baseUrl:
        toOptionalString(this.configService.get<string>("OPENAI_API_BASE_URL")) ??
        "https://api.openai.com/v1",
      models: {
        default: this.configService.get<string>("OPENAI_MODEL")?.trim() || "gpt-4o-mini",
        cvParsing: toOptionalString(this.configService.get<string>("OPENAI_MODEL_CV_PARSING")),
        screeningSupport: toOptionalString(
          this.configService.get<string>("OPENAI_MODEL_SCREENING_SUPPORT")
        ),
        reportGeneration: toOptionalString(
          this.configService.get<string>("OPENAI_MODEL_REPORT_GENERATION")
        ),
        recommendationGeneration: toOptionalString(
          this.configService.get<string>("OPENAI_MODEL_RECOMMENDATION_GENERATION")
        ),
        transcriptSummarization: toOptionalString(
          this.configService.get<string>("OPENAI_MODEL_TRANSCRIPT_SUMMARIZATION")
        ),
        interviewOrchestration: toOptionalString(
          this.configService.get<string>("OPENAI_MODEL_INTERVIEW_ORCHESTRATION")
        ),
        speechStt: toOptionalString(this.configService.get<string>("OPENAI_STT_MODEL")),
        speechTts: toOptionalString(this.configService.get<string>("OPENAI_TTS_MODEL"))
      }
    };
  }

  get speechRuntimeConfig() {
    const preferredSttProvider =
      this.configService.get<string>("SPEECH_STT_PROVIDER")?.trim().toLowerCase() ?? "browser";
    const preferredTtsProvider =
      this.configService.get<string>("SPEECH_TTS_PROVIDER")?.trim().toLowerCase() ?? "browser";
    const bothBrowser =
      preferredSttProvider === "browser" && preferredTtsProvider === "browser";
    const providerMode = bothBrowser
      ? "browser_fallback"
      : preferredSttProvider === preferredTtsProvider
        ? `provider_backed_${preferredSttProvider}`
        : "provider_backed_mixed";

    return {
      preferredSttProvider,
      preferredTtsProvider,
      providerMode,
      openAiSpeechReady: this.openAiConfig.apiKeyConfigured,
      elevenLabsSpeechReady: Boolean(
        toOptionalString(this.configService.get<string>("ELEVENLABS_API_KEY"))
      )
    };
  }

  get googleCalendarConfig() {
    return {
      launchEnabled: this.googleSchedulingEnabled,
      oauthClientId: toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_CLIENT_ID")) ?? "",
      oauthClientSecret:
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET")) ?? "",
      oauthRedirectUri:
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_REDIRECT_URI")) ?? "",
      oauthClientIdConfigured: Boolean(
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_CLIENT_ID"))
      ),
      oauthClientSecretConfigured: Boolean(
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET"))
      ),
      oauthRedirectUriConfigured: Boolean(
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_REDIRECT_URI"))
      ),
      oauthScopes:
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_SCOPES"))
          ?.split(",")
          .map((value) => value.trim())
          .filter(Boolean) ?? [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar.readonly"
        ],
      defaultCalendarId:
        toOptionalString(this.configService.get<string>("GOOGLE_CALENDAR_DEFAULT_ID")) ??
        "primary"
    };
  }

  get googleAuthConfig() {
    return {
      launchEnabled: this.googleAuthEnabled,
      clientId:
        toOptionalString(this.configService.get<string>("GOOGLE_AUTH_CLIENT_ID")) ??
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_CLIENT_ID")) ??
        "",
      clientSecret:
        toOptionalString(this.configService.get<string>("GOOGLE_AUTH_CLIENT_SECRET")) ??
        toOptionalString(this.configService.get<string>("GOOGLE_OAUTH_CLIENT_SECRET")) ??
        "",
      redirectUri:
        toOptionalString(this.configService.get<string>("GOOGLE_AUTH_REDIRECT_URI")) ?? "",
      scopes:
        toOptionalString(this.configService.get<string>("GOOGLE_AUTH_SCOPES"))
          ?.split(",")
          .map((value) => value.trim())
          .filter(Boolean) ?? ["openid", "email", "profile"]
    };
  }

  get elevenLabsConfig() {
    const apiKey = toOptionalString(this.configService.get<string>("ELEVENLABS_API_KEY"));
    const agentId = toOptionalString(this.configService.get<string>("ELEVENLABS_AGENT_ID"));
    const webhookSecret = toOptionalString(this.configService.get<string>("ELEVENLABS_WEBHOOK_SECRET"));

    return {
      apiKey,
      agentId,
      webhookSecret,
      isConfigured: Boolean(apiKey && agentId)
    };
  }

  get launchEnvironment() {
    const nextPublicRuntimeMode =
      this.configService.get<string>("NEXT_PUBLIC_APP_RUNTIME_MODE")?.trim().toLowerCase() ?? null;
    const nextPublicAuthSessionMode =
      this.configService.get<string>("NEXT_PUBLIC_AUTH_SESSION_MODE")?.trim().toLowerCase() ?? null;
    const nextPublicAuthTokenTransport =
      this.configService.get<string>("NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT")?.trim().toLowerCase() ?? null;
    const devLoginPassword = this.configService.get<string>("DEV_LOGIN_PASSWORD")?.trim();

    return {
      runtimeMode: this.runtimeMode,
      authMode: this.authMode,
      authTokenTransport: this.authTokenTransport,
      requireTenantHeader: this.requireTenantHeader,
      allowDevHeaderAuth: this.allowDevHeaderAuth,
      allowDemoShortcuts: this.allowDemoShortcuts,
      allowDemoCredentialLogin: this.allowDemoCredentialLogin,
      devLoginPasswordConfigured: Boolean(
        devLoginPassword && devLoginPassword !== "disabled-for-production"
      ),
      publicWebBaseUrl: this.publicWebBaseUrl,
      corsOrigins: this.corsOrigins,
      frontend: {
        runtimeMode: nextPublicRuntimeMode,
        authSessionMode: nextPublicAuthSessionMode,
        authTokenTransport: nextPublicAuthTokenTransport,
        enableDemoSession: toBool(
          this.configService.get<string>("NEXT_PUBLIC_ENABLE_DEMO_SESSION"),
          false
        )
      }
    };
  }

  get emailRuntimeConfig() {
    return {
      provider: this.configService.get<string>("EMAIL_PROVIDER")?.trim().toLowerCase() ?? "console",
      from: this.configService.get<string>("EMAIL_FROM")?.trim() ?? "noreply@ai-interviewer.local",
      resendApiConfigured: Boolean(
        toOptionalString(this.configService.get<string>("RESEND_API_KEY"))
      )
    };
  }

  get stripeBillingConfig() {
    return {
      apiKey: toOptionalString(this.configService.get<string>("STRIPE_SECRET_KEY")) ?? "",
      apiKeyConfigured: Boolean(
        toOptionalString(this.configService.get<string>("STRIPE_SECRET_KEY"))
      ),
      webhookSecret:
        toOptionalString(this.configService.get<string>("STRIPE_WEBHOOK_SECRET")) ?? "",
      portalConfigurationId:
        toOptionalString(this.configService.get<string>("STRIPE_BILLING_PORTAL_CONFIGURATION_ID")) ??
        null,
      planPriceIds: {
        FLEX:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_FLEX_MONTHLY")) ?? "",
        STARTER:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_STARTER_MONTHLY")) ?? "",
        GROWTH:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_GROWTH_MONTHLY")) ?? "",
        ENTERPRISE:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_ENTERPRISE_MONTHLY")) ?? ""
      },
      addOnPriceIds: {
        JOB_CREDIT_PACK_1:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_JOB_CREDIT_PACK_1")) ?? "",
        JOB_CREDIT_PACK_3:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_JOB_CREDIT_PACK_3")) ?? "",
        CANDIDATE_PROCESSING_PACK_50:
          toOptionalString(
            this.configService.get<string>("STRIPE_PRICE_CANDIDATE_PROCESSING_PACK_50")
          ) ?? "",
        INTERVIEW_PACK_10:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_INTERVIEW_PACK_10")) ?? "",
        INTERVIEW_PACK_25:
          toOptionalString(this.configService.get<string>("STRIPE_PRICE_INTERVIEW_PACK_25")) ?? "",
        CANDIDATE_PROCESSING_PACK_100:
          toOptionalString(
            this.configService.get<string>("STRIPE_PRICE_CANDIDATE_PROCESSING_PACK_100")
          ) ?? ""
      }
    };
  }

  get internalBillingAdminEmailAllowlist() {
    const configured = [
      ...toCsvList(this.configService.get<string>("INTERNAL_ADMIN_EMAIL_ALLOWLIST")),
      ...toCsvList(this.configService.get<string>("INTERNAL_BILLING_ADMIN_EMAIL_ALLOWLIST"))
    ];
    const defaults = ["info@candit.ai"];

    if (configured.length > 0) {
      return Array.from(new Set([...defaults, ...configured]));
    }

    return defaults;
  }

  get internalBillingAdminDomainAllowlist() {
    return [
      ...toCsvList(this.configService.get<string>("INTERNAL_ADMIN_DOMAIN_ALLOWLIST")),
      ...toCsvList(this.configService.get<string>("INTERNAL_BILLING_ADMIN_DOMAIN_ALLOWLIST"))
    ].map((domain) => domain.replace(/^@+/, ""));
  }

  isInternalAdmin(email?: string | null) {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return false;
    }

    if (this.internalBillingAdminEmailAllowlist.includes(normalizedEmail)) {
      return true;
    }

    const emailDomain = normalizedEmail.split("@")[1];
    if (!emailDomain) {
      return false;
    }

    return this.internalBillingAdminDomainAllowlist.includes(emailDomain);
  }

  isInternalBillingAdmin(email?: string | null) {
    return this.isInternalAdmin(email);
  }

  get providerReadiness() {
    const openAi = this.openAiConfig;
    const google = this.googleCalendarConfig;
    const email = this.emailRuntimeConfig;
    const speech = this.speechRuntimeConfig;
    const stripe = this.stripeBillingConfig;
    const stripePlanIdsReady = Boolean(
      stripe.planPriceIds.STARTER && stripe.planPriceIds.GROWTH
    );
    const stripeWebhookReady = Boolean(stripe.webhookSecret);

    return {
      parsing: {
        provider: openAi.apiKeyConfigured ? "openai" : "deterministic-fallback",
        mode: openAi.apiKeyConfigured ? "provider" : "fallback",
        ready: openAi.apiKeyConfigured
      },
      screening: {
        provider: openAi.apiKeyConfigured ? "openai" : "deterministic-fallback",
        mode: openAi.apiKeyConfigured ? "provider" : "fallback",
        ready: openAi.apiKeyConfigured
      },
      speech: {
        ...speech,
        ready: speech.providerMode === "provider_backed" ? speech.openAiSpeechReady : true
      },
      googleCalendar: {
        oauthConfigured:
          google.launchEnabled &&
          google.oauthClientIdConfigured &&
          google.oauthClientSecretConfigured &&
          google.oauthRedirectUriConfigured
      },
      notifications: {
        emailProvider: email.provider,
        ready: email.provider !== "resend" || email.resendApiConfigured
      },
      billing: {
        ready: stripe.apiKeyConfigured && stripePlanIdsReady && stripeWebhookReady
      },
      elevenLabs: {
        configured: this.elevenLabsConfig.isConfigured,
        agentId: Boolean(this.elevenLabsConfig.agentId)
      }
    };
  }

  get meetingProviderCatalog() {
    const readiness = this.providerReadiness;
    const googleLaunchEnabled = this.googleSchedulingEnabled;
    const googleReady = readiness.googleCalendar.oauthConfigured;
    const googleStatus = !googleLaunchEnabled
      ? ("unsupported" as const)
      : googleReady
        ? ("pilot" as const)
        : ("setup_required" as const);

    return [
      {
        provider: "GOOGLE_CALENDAR",
        status: googleStatus,
        ready: googleReady,
        requiresConnection: true,
        oauthConfigured: googleReady
      },
      {
        provider: "GOOGLE_MEET",
        status: googleStatus,
        ready: googleReady,
        requiresConnection: true,
        oauthConfigured: googleReady
      },
      {
        provider: "ZOOM",
        status: "unsupported" as const,
        ready: false,
        requiresConnection: true,
        oauthConfigured: false
      },
      {
        provider: "MICROSOFT_CALENDAR",
        status: "unsupported" as const,
        ready: false,
        requiresConnection: true,
        oauthConfigured: false
      }
    ];
  }

  get launchBoundaries() {
    const readiness = this.providerReadiness;
    const emailProvider = this.emailRuntimeConfig.provider;
    const googleAuth = this.googleAuthConfig;
    const googleAuthReady = Boolean(
      googleAuth.launchEnabled &&
        googleAuth.clientId &&
        googleAuth.clientSecret &&
        googleAuth.redirectUri
    );
    const googleAuthStatus: LaunchSupportStatus = !googleAuth.launchEnabled
      ? "unsupported"
      : googleAuthReady
        ? "pilot"
        : "setup_required";

    const emailStatus: LaunchSupportStatus =
      emailProvider === "resend"
        ? readiness.notifications.ready
          ? "ready"
          : "setup_required"
        : "pilot";

    const billingStatus: LaunchSupportStatus = readiness.billing.ready
      ? "ready"
      : "setup_required";

    return {
      email: {
        provider: emailProvider,
        status: emailStatus,
        ready: emailStatus !== "setup_required",
        liveDelivery: emailProvider === "resend" && readiness.notifications.ready
      },
      billing: {
        provider: "stripe",
        status: billingStatus,
        ready: readiness.billing.ready,
        selfServeEnabled: readiness.billing.ready
      },
      voiceInterviews: {
        provider: readiness.elevenLabs.configured ? "elevenlabs" : "browser_fallback",
        status: "pilot" as const,
        ready: true,
        browserFallback: !readiness.elevenLabs.configured
      },
      authentication: {
        sessionMode: this.authMode,
        googleOAuth: {
          provider: "google",
          status: googleAuthStatus,
          ready: googleAuthReady
        },
        enterpriseSso: {
          provider: "oidc_sso",
          status: "unsupported" as const,
          ready: false
        }
      },
      scheduling: {
        fallback: {
          provider: "INTERNAL_FALLBACK",
          status: "pilot" as const,
          ready: true
        },
        providers: this.meetingProviderCatalog
      }
    };
  }

  getProviderConfigurationWarnings() {
    const warnings: string[] = [];
    const readiness = this.providerReadiness;
    const stripeSecretMode = inferStripeSecretKeyMode(this.stripeBillingConfig.apiKey);
    const email = this.emailRuntimeConfig;

    if (!this.openAiConfig.apiKeyConfigured) {
      warnings.push("OPENAI_API_KEY missing; AI parsing/screening runs will use deterministic fallback.");
    }

    if (
      this.speechRuntimeConfig.preferredSttProvider === "openai" &&
      !this.speechRuntimeConfig.openAiSpeechReady
    ) {
      warnings.push("SPEECH_STT_PROVIDER=openai but OPENAI_API_KEY is missing.");
    }

    if (
      this.speechRuntimeConfig.preferredTtsProvider === "openai" &&
      !this.speechRuntimeConfig.openAiSpeechReady
    ) {
      warnings.push("SPEECH_TTS_PROVIDER=openai but OPENAI_API_KEY is missing.");
    }

    if (this.googleSchedulingEnabled && !readiness.googleCalendar.oauthConfigured) {
      warnings.push("Google OAuth env vars are incomplete (ready-after-config state).");
    }

    if (this.isProduction && email.provider === "console") {
      warnings.push("EMAIL_PROVIDER=console in production; candidate-facing emails will not be delivered.");
    }

    if (!readiness.notifications.ready) {
      warnings.push("Email provider selected but provider credentials are missing.");
    }

    if (email.provider === "resend" && email.from.endsWith(".local")) {
      warnings.push("EMAIL_FROM still uses a local placeholder domain; verify a real sender domain before launch.");
    }

    if (!readiness.billing.ready) {
      warnings.push(
        "Stripe billing ayarları eksik; secret key, webhook secret ve temel plan price id'leri tamamlanmadan self-serve abonelik akışları güvenli çalışmaz."
      );
    }

    if (this.isProduction && stripeSecretMode === "test") {
      warnings.push("Stripe test secret key is configured in production runtime.");
    }

    if (!this.isProduction && stripeSecretMode === "live") {
      warnings.push("Stripe live secret key is configured outside production runtime.");
    }

    if (
      this.isProduction &&
      this.googleSchedulingEnabled &&
      this.googleCalendarConfig.oauthRedirectUri &&
      isLocalOrigin(this.googleCalendarConfig.oauthRedirectUri)
    ) {
      warnings.push("Google OAuth redirect URI still points to a local origin in production runtime.");
    }

    if (!readiness.elevenLabs.configured) {
      warnings.push(
        "ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID missing; voice interviews will use browser speech fallback."
      );
    }

    return warnings;
  }

  getEnvironmentConfigurationWarnings() {
    const warnings: string[] = [];
    const environment = this.launchEnvironment;

    if (
      environment.frontend.runtimeMode &&
      environment.frontend.runtimeMode !== environment.runtimeMode
    ) {
      warnings.push(
        `NEXT_PUBLIC_APP_RUNTIME_MODE (${environment.frontend.runtimeMode}) does not match APP_RUNTIME_MODE (${environment.runtimeMode}).`
      );
    }

    if (
      environment.frontend.authSessionMode &&
      environment.frontend.authSessionMode !== environment.authMode
    ) {
      warnings.push(
        `NEXT_PUBLIC_AUTH_SESSION_MODE (${environment.frontend.authSessionMode}) does not match AUTH_SESSION_MODE (${environment.authMode}).`
      );
    }

    if (
      environment.frontend.authTokenTransport &&
      environment.frontend.authTokenTransport !== environment.authTokenTransport
    ) {
      warnings.push(
        `NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT (${environment.frontend.authTokenTransport}) does not match AUTH_TOKEN_TRANSPORT (${environment.authTokenTransport}).`
      );
    }

    if (environment.allowDevHeaderAuth) {
      warnings.push("ALLOW_DEV_AUTH_HEADERS is active; header-based dev auth should stay disabled for pilot/launch runtimes.");
    }

    if (environment.allowDemoShortcuts) {
      warnings.push("ALLOW_DEMO_SHORTCUTS is active; demo shortcuts should stay disabled for pilot/launch runtimes.");
    }

    if (environment.allowDemoCredentialLogin) {
      warnings.push("ALLOW_DEMO_CREDENTIAL_LOGIN is active; demo credential login should stay disabled for pilot/launch runtimes.");
    }

    if (environment.frontend.enableDemoSession) {
      warnings.push("NEXT_PUBLIC_ENABLE_DEMO_SESSION is active; demo session UX should stay disabled for pilot/launch runtimes.");
    }

    if (environment.devLoginPasswordConfigured) {
      warnings.push("DEV_LOGIN_PASSWORD is set to a usable value; seeded demo credentials should not remain active in pilot/launch runtimes.");
    }

    return warnings;
  }

  get port() {
    const raw = this.configService.get<string>("PORT");
    const value = raw ? Number(raw) : 4000;
    return Number.isFinite(value) ? value : 4000;
  }

  validateAtStartup(): {
    healthy: boolean;
    warnings: string[];
    providers: Record<string, { ready: boolean; mode: string }>;
  } {
    this.assertProductionSafety();

    const warnings = this.getProviderConfigurationWarnings();
    const readiness = this.providerReadiness;

    const providers: Record<string, { ready: boolean; mode: string }> = {
      ai_parsing: {
        ready: readiness.parsing.ready,
        mode: readiness.parsing.mode
      },
      ai_screening: {
        ready: readiness.screening.ready,
        mode: readiness.screening.mode
      },
      speech: {
        ready: readiness.speech.ready,
        mode: readiness.speech.providerMode
      },
      google_calendar: {
        ready: readiness.googleCalendar.oauthConfigured,
        mode: readiness.googleCalendar.oauthConfigured ? "oauth_configured" : "not_configured"
      },
      email_notifications: {
        ready: readiness.notifications.ready,
        mode: readiness.notifications.emailProvider
      },
      stripe_billing: {
        ready: readiness.billing.ready,
        mode: readiness.billing.ready ? "stripe_checkout" : "not_configured"
      },
      elevenlabs_voice: {
        ready: readiness.elevenLabs.configured,
        mode: readiness.elevenLabs.configured ? "elevenlabs_conversational_ai" : "browser_fallback"
      }
    };

    const aiParsing = providers["ai_parsing"];
    const emailNotifications = providers["email_notifications"];
    const allCriticalReady = (aiParsing?.ready ?? false) && (emailNotifications?.ready ?? false);

    return {
      healthy: allCriticalReady || !this.isProduction,
      warnings,
      providers
    };
  }
}
