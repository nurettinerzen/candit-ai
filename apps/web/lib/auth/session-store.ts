import type { WebAuthSession } from "./types";

const STORAGE_KEY = "ai_interviewer_web_session_v1";
const LAST_TENANT_KEY = "ai_interviewer_web_last_tenant_v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStoredSession(): WebAuthSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as WebAuthSession;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!parsed.tenantId || !parsed.userId || !parsed.roles || !parsed.authMode) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function persistSession(session: WebAuthSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.localStorage.setItem(LAST_TENANT_KEY, session.tenantId);
}

export function clearStoredSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function readLastTenantId() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(LAST_TENANT_KEY);
}

const LOGGED_OUT_KEY = "ai_interviewer_logged_out";

export function isExplicitlyLoggedOut(): boolean {
  if (!canUseStorage()) return false;
  return window.localStorage.getItem(LOGGED_OUT_KEY) === "1";
}

export function setExplicitlyLoggedOut(value: boolean) {
  if (!canUseStorage()) return;
  if (value) {
    window.localStorage.setItem(LOGGED_OUT_KEY, "1");
  } else {
    window.localStorage.removeItem(LOGGED_OUT_KEY);
  }
}
