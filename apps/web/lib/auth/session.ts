import {
  API_BASE_URL,
  AUTH_SESSION_MODE,
  AUTH_TOKEN_TRANSPORT,
  DEMO_SESSION_DEFAULTS,
  ENABLE_DEMO_SESSION
} from "./runtime";
import {
  clearStoredSession,
  isExplicitlyLoggedOut,
  persistSession,
  readStoredSession,
  setExplicitlyLoggedOut
} from "./session-store";
import type { WebAuthSession } from "./types";

export type AuthEmailVerificationPayload = {
  ok?: boolean;
  enabled?: boolean;
  required?: boolean;
  deliveryEnabled?: boolean;
  expiresAt?: string;
  previewUrl?: string | null;
};

type AuthResponsePayload = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  emailVerification?: AuthEmailVerificationPayload;
  session?: { id?: string };
  user?: {
    id?: string;
    tenantId?: string;
    email?: string | null;
    fullName?: string | null;
    roles?: string[];
    emailVerifiedAt?: string | null;
    avatarUrl?: string | null;
  };
  message?: string | string[];
};

export type AuthFlowError = Error & {
  code?: string;
  emailVerification?: AuthEmailVerificationPayload;
};

function resolveErrorMessage(message: string | string[] | undefined, fallback: string) {
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  if (Array.isArray(message)) {
    const flattened = message
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(" ");

    if (flattened.length > 0) {
      return flattened;
    }
  }

  return fallback;
}

function createAuthError(payload: AuthResponsePayload, fallback: string): AuthFlowError {
  const error = new Error(resolveErrorMessage(payload.message, fallback)) as AuthFlowError;

  if (payload.code) {
    error.code = payload.code;
  }

  if (payload.emailVerification) {
    error.emailVerification = payload.emailVerification;
  }

  return error;
}

function buildSessionFromPayload(
  payload: AuthResponsePayload,
  authMode: "jwt" | "jwt_cookie"
): WebAuthSession {
  return {
    tenantId: payload.user?.tenantId ?? "",
    userId: payload.user?.id ?? "",
    roles: (payload.user?.roles ?? ["manager"]).join(","),
    userLabel: payload.user?.fullName ?? payload.user?.email ?? payload.user?.id ?? "",
    authMode,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    sessionId: payload.session?.id,
    email: payload.user?.email ?? undefined,
    emailVerifiedAt: payload.user?.emailVerifiedAt ?? null,
    avatarUrl: payload.user?.avatarUrl ?? null
  };
}

function buildPublicApiUrl(path: string, query?: Record<string, string | undefined>) {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const url = new URL(path.replace(/^\//, ""), base);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value && value.trim().length > 0) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

export function getDemoSession(): WebAuthSession {
  return {
    tenantId: DEMO_SESSION_DEFAULTS.tenantId,
    userId: DEMO_SESSION_DEFAULTS.userId,
    roles: DEMO_SESSION_DEFAULTS.roles,
    userLabel: DEMO_SESSION_DEFAULTS.userLabel,
    authMode: "dev_header",
    email: DEMO_SESSION_DEFAULTS.email
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

    if (isExplicitlyLoggedOut()) return null;
    return ENABLE_DEMO_SESSION ? getDemoSession() : null;
  }

  if (isExplicitlyLoggedOut()) return null;
  return ENABLE_DEMO_SESSION ? getDemoSession() : null;
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
    "x-roles": session.roles,
    "x-user-label": session.userLabel,
    ...(session.email ? { "x-user-email": session.email } : {})
  };
}

export async function loginWithPassword(input: {
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

  const payload = (await response.json()) as AuthResponsePayload;

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw createAuthError(payload, `Giriş başarısız (${response.status}).`);
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Giriş cevabı access token içermiyor.");
  }

  const session = buildSessionFromPayload(payload, isCookieTransport ? "jwt_cookie" : "jwt");

  setExplicitlyLoggedOut(false);
  persistSession(session);

  return session;
}

export async function resolveInvitation(token: string) {
  const response = await fetch(
    `${API_BASE_URL}/auth/invitations/resolve?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  const payload = (await response.json()) as {
    invitation?: {
      tenantId: string;
      tenantName: string;
      email: string;
      fullName: string;
      role: string;
      expiresAt: string;
      status: "pending" | "accepted" | "revoked" | "expired";
    };
    message?: string;
  };

  if (!response.ok || !payload.invitation) {
    throw new Error(resolveErrorMessage(payload.message, `Davet doğrulanamadı (${response.status}).`));
  }

  return payload.invitation;
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  fullName?: string;
}): Promise<WebAuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/invitations/accept`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as AuthResponsePayload;

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw new Error(resolveErrorMessage(payload.message, `Davet kabul edilemedi (${response.status}).`));
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Davet kabul cevabı access token içermiyor.");
  }

  const session = buildSessionFromPayload(payload, isCookieTransport ? "jwt_cookie" : "jwt");
  persistSession(session);
  return session;
}

export async function signupWithPassword(input: {
  companyName: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<{
  session: WebAuthSession | null;
  emailVerification?: AuthEmailVerificationPayload;
}> {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as AuthResponsePayload;

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw createAuthError(payload, `Hesap olusturulamadi (${response.status}).`);
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";
  const hasIssuedSession = isCookieTransport
    ? Boolean(payload.session?.id)
    : Boolean(payload.accessToken);

  if (!hasIssuedSession) {
    return {
      session: null,
      emailVerification: payload.emailVerification
    };
  }

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Kayit cevabi access token icermiyor.");
  }

  const session = buildSessionFromPayload(payload, isCookieTransport ? "jwt_cookie" : "jwt");
  persistSession(session);
  return {
    session,
    emailVerification: payload.emailVerification
  };
}

export async function requestPasswordReset(input: { email: string }) {
  const response = await fetch(`${API_BASE_URL}/auth/password/forgot`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    expiresAt?: string;
    previewUrl?: string | null;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      resolveErrorMessage(payload.message, `Sifre sifirlama talebi basarisiz (${response.status}).`)
    );
  }

  return payload;
}

export async function requestEmailVerification(input: { email: string }) {
  const response = await fetch(`${API_BASE_URL}/auth/email-verification/request`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    expiresAt?: string;
    previewUrl?: string | null;
    message?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(resolveErrorMessage(payload.message, `Doğrulama e-postası gönderilemedi (${response.status}).`));
  }

  return payload;
}

export async function resolvePasswordReset(token: string) {
  const response = await fetch(
    `${API_BASE_URL}/auth/password/reset/resolve?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  const payload = (await response.json()) as {
    reset?: {
      email: string;
      fullName: string;
      expiresAt: string;
      status: "pending" | "used" | "revoked" | "expired";
    };
    message?: string;
  };

  if (!response.ok || !payload.reset) {
    throw new Error(
      resolveErrorMessage(
        payload.message,
        `Sifre sifirlama baglantisi dogrulanamadi (${response.status}).`
      )
    );
  }

  return payload.reset;
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<WebAuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/password/reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as AuthResponsePayload;

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw new Error(resolveErrorMessage(payload.message, `Sifre sifirlanamadi (${response.status}).`));
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Sifre sifirlama cevabi access token icermiyor.");
  }

  const session = buildSessionFromPayload(payload, isCookieTransport ? "jwt_cookie" : "jwt");
  persistSession(session);
  return session;
}

export async function resendEmailVerification(session: WebAuthSession | null) {
  const response = await fetch(`${API_BASE_URL}/auth/email-verification/resend`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildAuthHeaders(session)
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify({}),
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    message?: string | string[];
  } & AuthEmailVerificationPayload;

  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload.message, `Dogrulama e-postasi gonderilemedi (${response.status}).`));
  }

  return payload;
}

export async function changePasswordForCurrentSession(
  session: WebAuthSession | null,
  input: {
    currentPassword: string;
    newPassword: string;
  }
): Promise<WebAuthSession> {
  if (!session) {
    throw new Error("Aktif oturum bulunamadi.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/password/change`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildAuthHeaders(session)
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as AuthResponsePayload;

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw createAuthError(payload, `Sifre degistirilemedi (${response.status}).`);
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Sifre degistirme cevabi access token icermiyor.");
  }

  const nextSession = buildSessionFromPayload(payload, isCookieTransport ? "jwt_cookie" : "jwt");
  setExplicitlyLoggedOut(false);
  persistSession(nextSession);
  return nextSession;
}

export async function deleteCurrentAccount(
  session: WebAuthSession | null,
  input: {
    currentPassword: string;
    confirmationText: string;
  }
) {
  if (!session) {
    throw new Error("Aktif oturum bulunamadi.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/account/delete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildAuthHeaders(session)
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    message?: string | string[];
  };

  if (!response.ok) {
    throw new Error(
      resolveErrorMessage(payload.message, `Hesap silinemedi (${response.status}).`)
    );
  }

  clearStoredSession();
  setExplicitlyLoggedOut(true);

  return payload;
}

export function readAuthFlowError(error: unknown): AuthFlowError | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as Partial<AuthFlowError>;
  if (typeof candidate.message !== "string") {
    return null;
  }

  return candidate as AuthFlowError;
}

export async function confirmEmailVerification(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/email-verification/confirm`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ token }),
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    user?: {
      emailVerifiedAt?: string | null;
    };
    message?: string;
  };

  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload.message, `E-posta dogrulanamadi (${response.status}).`));
  }

  return payload;
}

export async function exchangeGoogleOauthToken(token: string): Promise<WebAuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/exchange`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
    body: JSON.stringify({ token }),
    cache: "no-store"
  });

  const payload = (await response.json()) as AuthResponsePayload;

  if (!response.ok || !payload.user?.id || !payload.user.tenantId) {
    throw new Error(
      resolveErrorMessage(payload.message, `Google oturumu tamamlanamadi (${response.status}).`)
    );
  }

  const isCookieTransport = AUTH_TOKEN_TRANSPORT === "cookie";

  if (!isCookieTransport && !payload.accessToken) {
    throw new Error("Google oturum cevabi access token icermiyor.");
  }

  const session = buildSessionFromPayload(payload, isCookieTransport ? "jwt_cookie" : "jwt");
  persistSession(session);
  return session;
}

export async function getAuthProviders() {
  const response = await fetch(`${API_BASE_URL}/auth/providers`, {
    method: "GET",
    cache: "no-store"
  });

  const payload = (await response.json()) as {
    google?: {
      enabled?: boolean;
    };
    enterpriseSso?: {
      enabled?: boolean;
      launchStatus?: string;
      reason?: string;
    };
  };

  if (!response.ok) {
    throw new Error(`Auth provider bilgisi okunamadi (${response.status}).`);
  }

  return payload;
}

export function getGoogleAuthAuthorizeUrl(input: {
  intent: "login" | "signup";
  companyName?: string | null;
  returnTo?: string;
}) {
  return buildPublicApiUrl("auth/google/authorize", {
    intent: input.intent,
    companyName: input.companyName ?? undefined,
    returnTo: input.returnTo ?? "/dashboard"
  });
}

export function getGoogleCalendarIntegrationAuthorizeUrl() {
  return buildPublicApiUrl("integrations/google/authorize");
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
  if (
    AUTH_TOKEN_TRANSPORT !== "cookie" &&
    (!currentSession || (currentSession.authMode !== "jwt" && currentSession.authMode !== "jwt_cookie"))
  ) {
    return currentSession;
  }

  const cookieSessionHeaders =
    AUTH_TOKEN_TRANSPORT === "cookie"
      ? currentSession?.tenantId
        ? { "x-tenant-id": currentSession.tenantId }
        : {}
      : buildAuthHeaders(currentSession);

  const readServerSession = async () =>
    fetch(`${API_BASE_URL}/auth/session`, {
      method: "GET",
      headers: {
        ...cookieSessionHeaders
      },
      credentials: "include",
      cache: "no-store"
    });

  const hydrateServerSession = async (response: Response) => {
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      user?: {
        id?: string;
        tenantId?: string;
        email?: string | null;
        fullName?: string | null;
        roles?: string[];
        emailVerifiedAt?: string | null;
        avatarUrl?: string | null;
      };
      session?: {
        id?: string | null;
      };
    };

    if (!payload.user?.id || !payload.user.tenantId) {
      return null;
    }

    const session = buildSessionFromPayload(
      {
        user: payload.user,
        session: {
          id: payload.session?.id ?? undefined
        }
      },
      "jwt_cookie"
    );

    persistSession(session);
    return session;
  };

  let response = await readServerSession();

  if (!response.ok && AUTH_TOKEN_TRANSPORT === "cookie" && (response.status === 401 || response.status === 403)) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...cookieSessionHeaders
      },
      credentials: "include",
      body: JSON.stringify({}),
      cache: "no-store"
    });

    if (refreshResponse.ok) {
      response = await readServerSession();
    } else {
      clearStoredSession();
    }
  }

  return hydrateServerSession(response);
}

export function clearAuthSession() {
  clearStoredSession();
  setExplicitlyLoggedOut(true);
}

export function loginWithDemoSession(): WebAuthSession {
  setExplicitlyLoggedOut(false);
  const session = getDemoSession();
  persistSession(session);
  return session;
}

export function saveSession(session: WebAuthSession) {
  persistSession(session);
}

export async function logoutCurrentSession(session: WebAuthSession | null) {
  if (session) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(session)
        },
        credentials: AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin",
        body: JSON.stringify({
          refreshToken:
            session.authMode === "jwt" && AUTH_TOKEN_TRANSPORT !== "cookie"
              ? session.refreshToken
              : undefined
        }),
        cache: "no-store"
      });
    } catch {
      // Best-effort logout; local session is still cleared below.
    }
  }

  clearStoredSession();
  setExplicitlyLoggedOut(true);
}
