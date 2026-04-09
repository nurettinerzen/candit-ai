import type { AuthSessionMode } from "./types";

export type AuthTokenTransport = "header" | "cookie";
export type WebRuntimeMode = "development" | "demo" | "production";

function trimSlashSuffix(value: string) {
  return value.replace(/\/+$/, "");
}

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no"].includes(normalized)) {
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

export function resolveWebRuntimeMode(raw: string | undefined): WebRuntimeMode {
  const normalized = raw?.trim().toLowerCase();

  if (normalized === "production") {
    return "production";
  }

  if (normalized === "demo") {
    return "demo";
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const WEB_RUNTIME_MODE = resolveWebRuntimeMode(process.env.NEXT_PUBLIC_APP_RUNTIME_MODE);

export function resolveAuthSessionMode(
  raw: string | undefined,
  runtimeMode: WebRuntimeMode
): AuthSessionMode {
  if (raw === "jwt" || raw === "hybrid" || raw === "dev_header") {
    if (runtimeMode === "production" && raw !== "jwt") {
      return "jwt";
    }

    return raw;
  }

  if (runtimeMode === "production") {
    return "jwt";
  }

  return runtimeMode === "demo" ? "hybrid" : "dev_header";
}

export const API_BASE_URL =
  (() => {
    if (typeof window !== "undefined") {
      const override = new URLSearchParams(window.location.search).get("apiBase")?.trim();
      if (override) {
        return trimSlashSuffix(override);
      }
    }

    return trimSlashSuffix(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1");
  })();

export const AUTH_SESSION_MODE = resolveAuthSessionMode(
  process.env.NEXT_PUBLIC_AUTH_SESSION_MODE,
  WEB_RUNTIME_MODE
);

export function resolveAuthTokenTransport(
  raw: string | undefined,
  runtimeMode: WebRuntimeMode,
  authMode: AuthSessionMode
): AuthTokenTransport {
  if (runtimeMode === "production") {
    return "cookie";
  }

  if (raw === "header" || raw === "cookie") {
    return raw;
  }

  return authMode === "jwt" ? "cookie" : "header";
}

export const AUTH_TOKEN_TRANSPORT = resolveAuthTokenTransport(
  process.env.NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT,
  WEB_RUNTIME_MODE,
  AUTH_SESSION_MODE
);

export const AUTH_ACCESS_COOKIE_NAME =
  process.env.NEXT_PUBLIC_AUTH_ACCESS_COOKIE_NAME ?? "aii_access_token";
export const AUTH_REFRESH_COOKIE_NAME =
  process.env.NEXT_PUBLIC_AUTH_REFRESH_COOKIE_NAME ?? "aii_refresh_token";

export const ENABLE_DEMO_SESSION = toBool(
  process.env.NEXT_PUBLIC_ENABLE_DEMO_SESSION,
  WEB_RUNTIME_MODE === "development" && AUTH_SESSION_MODE !== "jwt"
);

export const DEMO_SESSION_DEFAULTS = {
  tenantId: process.env.NEXT_PUBLIC_DEV_TENANT_ID ?? "ten_demo",
  userId: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "usr_admin_demo",
  roles: process.env.NEXT_PUBLIC_DEV_ROLES ?? "owner",
  userLabel: process.env.NEXT_PUBLIC_DEV_USER_LABEL ?? "Demo Hesap Sahibi",
  email: process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "owner@demo.local"
};

const INTERNAL_ADMIN_EMAIL_ALLOWLIST = (() => {
  const configured = [
    ...toCsvList(process.env.NEXT_PUBLIC_INTERNAL_ADMIN_EMAIL_ALLOWLIST),
    ...toCsvList(process.env.NEXT_PUBLIC_INTERNAL_BILLING_ADMIN_EMAIL_ALLOWLIST)
  ];
  if (configured.length > 0) {
    return Array.from(new Set(configured));
  }

  return WEB_RUNTIME_MODE === "development" ? ["owner@demo.local"] : [];
})();

const INTERNAL_ADMIN_DOMAIN_ALLOWLIST = [
  ...toCsvList(process.env.NEXT_PUBLIC_INTERNAL_ADMIN_DOMAIN_ALLOWLIST),
  ...toCsvList(process.env.NEXT_PUBLIC_INTERNAL_BILLING_ADMIN_DOMAIN_ALLOWLIST)
]
  .map((domain) => domain.replace(/^@+/, ""))
  .filter(Boolean);

export function isInternalAdminEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  if (INTERNAL_ADMIN_EMAIL_ALLOWLIST.includes(normalizedEmail)) {
    return true;
  }

  const emailDomain = normalizedEmail.split("@")[1];
  if (!emailDomain) {
    return false;
  }

  return INTERNAL_ADMIN_DOMAIN_ALLOWLIST.includes(emailDomain);
}

export const isInternalBillingAdminEmail = isInternalAdminEmail;
