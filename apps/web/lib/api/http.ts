import { API_BASE_URL, AUTH_TOKEN_TRANSPORT } from "../auth/runtime";
import {
  buildAuthHeaders,
  refreshJwtSession,
  resolveActiveSession
} from "../auth/session";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const url = new URL(path.replace(/^\//, ""), base);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

function normalizeErrorMessage(rawMessage: unknown) {
  if (Array.isArray(rawMessage)) {
    return rawMessage.join(", ");
  }

  if (typeof rawMessage === "string") {
    return rawMessage;
  }

  return "Beklenmeyen API hatası.";
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  const session = resolveActiveSession();
  const credentials = AUTH_TOKEN_TRANSPORT === "cookie" ? "include" : "same-origin";
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...buildAuthHeaders(session)
  };

  if (!isFormData) {
    headers["content-type"] = "application/json";
  }

  const body = options.body
    ? isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body)
    : undefined;

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body,
    credentials,
    cache: "no-store"
  });

  if (
    response.status === 401 &&
    session &&
    (session.authMode === "jwt" || session.authMode === "jwt_cookie") &&
    !path.startsWith("auth/")
  ) {
    const refreshed = await refreshJwtSession(session);

    if (refreshed) {
      const retryResponse = await fetch(buildUrl(path, options.query), {
        method: options.method ?? "GET",
        headers: !isFormData
          ? {
              "content-type": "application/json",
              ...buildAuthHeaders(refreshed)
            }
          : {
              ...buildAuthHeaders(refreshed)
            },
        body,
        credentials,
        cache: "no-store"
      });

      if (retryResponse.ok) {
        return (await retryResponse.json()) as T;
      }
    }
  }

  if (!response.ok) {
    let payload: unknown = undefined;

    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    const message =
      payload && typeof payload === "object" && "message" in payload
        ? normalizeErrorMessage((payload as { message?: unknown }).message)
        : `HTTP ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T;
  }

  const text = await response.text();
  if (!text || text.trim().length === 0) {
    return null as T;
  }

  return JSON.parse(text) as T;
}
