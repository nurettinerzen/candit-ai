import type { WebAuthSession } from "./types";

const STORAGE_KEY = "ai_interviewer_web_session_v1";

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
}

export function clearStoredSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
