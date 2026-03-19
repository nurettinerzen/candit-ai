import type { AuthSessionMode } from "./types";

export type AuthTokenTransport = "header" | "cookie";

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

function readMode(raw: string | undefined): AuthSessionMode {
  if (raw === "jwt" || raw === "hybrid" || raw === "dev_header") {
    return raw;
  }

  return process.env.NODE_ENV === "production" ? "jwt" : "dev_header";
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";

export const AUTH_SESSION_MODE = readMode(process.env.NEXT_PUBLIC_AUTH_SESSION_MODE);

function readTransport(raw: string | undefined): AuthTokenTransport {
  if (raw === "header" || raw === "cookie") {
    return raw;
  }

  return AUTH_SESSION_MODE === "jwt" ? "cookie" : "header";
}

export const AUTH_TOKEN_TRANSPORT = readTransport(process.env.NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT);

export const AUTH_ACCESS_COOKIE_NAME =
  process.env.NEXT_PUBLIC_AUTH_ACCESS_COOKIE_NAME ?? "aii_access_token";
export const AUTH_REFRESH_COOKIE_NAME =
  process.env.NEXT_PUBLIC_AUTH_REFRESH_COOKIE_NAME ?? "aii_refresh_token";

export const ENABLE_DEMO_SESSION = toBool(
  process.env.NEXT_PUBLIC_ENABLE_DEMO_SESSION,
  AUTH_SESSION_MODE !== "jwt"
);

export const DEMO_SESSION_DEFAULTS = {
  tenantId: process.env.NEXT_PUBLIC_DEV_TENANT_ID ?? "ten_demo",
  userId: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "usr_recruiter_demo",
  roles: process.env.NEXT_PUBLIC_DEV_ROLES ?? "recruiter",
  userLabel: process.env.NEXT_PUBLIC_DEV_USER_LABEL ?? "Demo İşe Alım Uzmanı"
};
