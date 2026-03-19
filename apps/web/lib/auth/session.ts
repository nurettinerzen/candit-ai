import {
  API_BASE_URL,
  AUTH_SESSION_MODE,
  AUTH_TOKEN_TRANSPORT,
  DEMO_SESSION_DEFAULTS,
  ENABLE_DEMO_SESSION
} from "./runtime";
import { clearStoredSession, persistSession, readStoredSession } from "./session-store";
import type { WebAuthSession } from "./types";

export function getDemoSession(): WebAuthSession {
  return {
    tenantId: DEMO_SESSION_DEFAULTS.tenantId,
    userId: DEMO_SESSION_DEFAULTS.userId,
    roles: DEMO_SESSION_DEFAULTS.roles,
    userLabel: DEMO_SESSION_DEFAULTS.userLabel,
    authMode: "dev_header"
  };
}

function isStoredJwtSession(session: WebAuthSession | null) {
  if (!session) {
    return false;
  }

  if (AUTH_TOKEN_TRANSPORT === "cookie") {
    return session.authMode === "jwt_cookie";
  }

  return session.authMode === "jwt";
}

export function resolveActiveSession(): WebAuthSession | null {
  const stored = readStoredSession();

  if (AUTH_SESSION_MODE === "jwt") {
    return isStoredJwtSession(stored) ? stored : null;
  }

  if (AUTH_SESSION_MODE === "hybrid") {
    if (isStoredJwtSession(stored)) {
      return stored;
    }

    return ENABLE_DEMO_SESSION ? getDemoSession() : null;
  }

  return getDemoSession();
}

export function hasAnyRole(session: WebAuthSession | null, roles: string[]) {
  if (!session) {
    return false;
  }

  const assigned = session.roles
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return roles.some((role) => assigned.includes(role));
}

export function buildAuthHeaders(session: WebAuthSession | null): Record<string, string> {
  if (!session) {
    return {};
  }

  if (session.authMode === "jwt" && session.accessToken && AUTH_TOKEN_TRANSPORT === "header") {
    return {
      authorization: `Bearer ${session.accessToken}`,
      "x-tenant-id": session.tenantId
    };
  }

  if (session.authMode === "jwt_cookie") {
    return session.tenantId
      ? {
          "x-tenant-id": session.tenantId
        }
      : {};
  }

  return {
    "x-tenant-id": session.tenantId,
    "x-user-id": session.userId,
    "x-roles": session.roles
  };
}

export async function loginWithPassword(input: {
  tenantId: string;
  email: string;
  password: string;
}): Promise<WebAuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
    session?: { id?: string };
    user?: {
      id?: string;
      tenantId?: string;
      email?: string;
      fullName?: string;
      roles?: string[];
    };
    message?: string;
  };

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw new Error(payload?.message ?? `Giriş başarısız (${response.status}).`);
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Giriş cevabı access token içermiyor.");
  }

  const session: WebAuthSession = {
    tenantId: payload.user.tenantId,
    userId: payload.user.id,
    roles: (payload.user.roles ?? ["recruiter"]).join(","),
    userLabel: payload.user.fullName ?? payload.user.email ?? payload.user.id,
    authMode: isCookieTransport ? "jwt_cookie" : "jwt",
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    sessionId: payload.session?.id,
    email: payload.user.email
  };

  persistSession(session);

  return session;
}

export async function refreshJwtSession(session: WebAuthSession): Promise<WebAuthSession | null> {
  if (session.authMode === "jwt_cookie") {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...buildAuthHeaders(session)
      },
      credentials: "include",
      body: JSON.stringify({}),
      cache: "no-store"
    });

    if (!response.ok) {
      clearStoredSession();
      return null;
    }

    const next = {
      ...session
    };

    persistSession(next);
    return next;
  }

  if (session.authMode !== "jwt" || !session.refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify({
      refreshToken: session.refreshToken
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    clearStoredSession();
    return null;
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
    session?: {
      id?: string;
    };
  };

  const next = {
    ...session,
    accessToken: payload.accessToken ?? session.accessToken,
    refreshToken: payload.refreshToken ?? session.refreshToken,
    sessionId: payload.session?.id ?? session.sessionId
  };

  persistSession(next);
  return next;
}

export async function resolveSessionFromServer(currentSession: WebAuthSession | null) {
  if (AUTH_TOKEN_TRANSPORT !== "cookie") {
    return currentSession;
  }

  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "GET",
    headers: {
      ...buildAuthHeaders(currentSession)
    },
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    user?: {
      id?: string;
      tenantId?: string;
      email?: string | null;
      roles?: string[];
    };
    session?: {
      id?: string | null;
    };
  };

  if (!payload.user?.id || !payload.user.tenantId) {
    return null;
  }

  const session: WebAuthSession = {
    tenantId: payload.user.tenantId,
    userId: payload.user.id,
    roles: (payload.user.roles ?? ["recruiter"]).join(","),
    userLabel: payload.user.email ?? payload.user.id,
    email: payload.user.email ?? undefined,
    sessionId: payload.session?.id ?? undefined,
    authMode: "jwt_cookie"
  };

  persistSession(session);
  return session;
}

export function clearAuthSession() {
  clearStoredSession();
}

export function saveSession(session: WebAuthSession) {
  persistSession(session);
}
