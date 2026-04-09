import type { Route } from "next";

const APPLICATION_ROUTE_PREFIX = "appref";
const CANDIDATE_ROUTE_PREFIX = "candref";
const SOURCING_PROJECT_ROUTE_PREFIX = "srcproj";
const LEGACY_ROUTE_PREFIXES = new Set(["app", "cand"]);
const SAFE_DECODED_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeRouteEntityId(prefix: string, rawId: string) {
  return `${prefix}_${toBase64Url(rawId)}`;
}

export function decodeRouteEntityId(routeId: string) {
  const separatorIndex = routeId.indexOf("_");
  if (separatorIndex <= 0) {
    return routeId;
  }

  const prefix = routeId.slice(0, separatorIndex);
  const isKnownEncodedPrefix =
    prefix === APPLICATION_ROUTE_PREFIX ||
    prefix === CANDIDATE_ROUTE_PREFIX ||
    prefix === SOURCING_PROJECT_ROUTE_PREFIX ||
    LEGACY_ROUTE_PREFIXES.has(prefix);

  if (!isKnownEncodedPrefix) {
    return routeId;
  }

  const encodedPart = routeId.slice(separatorIndex + 1);
  if (!encodedPart) {
    return routeId;
  }

  try {
    const decoded = fromBase64Url(encodedPart).trim();
    if (!decoded || !SAFE_DECODED_ID_PATTERN.test(decoded)) {
      return routeId;
    }

    return decoded;
  } catch {
    return routeId;
  }
}

export function applicationDetailHref(applicationId: string) {
  return `/applications/${encodeRouteEntityId(APPLICATION_ROUTE_PREFIX, applicationId)}` as Route;
}

export function candidateDetailHref(candidateId: string) {
  return `/candidates/${encodeRouteEntityId(CANDIDATE_ROUTE_PREFIX, candidateId)}` as Route;
}

export function sourcingProjectDetailHref(projectId: string) {
  return `/sourcing/${encodeRouteEntityId(SOURCING_PROJECT_ROUTE_PREFIX, projectId)}` as Route;
}

export function withApiBaseOverride(
  href: string,
  searchParams?: Pick<URLSearchParams, "get"> | null
): Route {
  if (!searchParams) {
    return href as Route;
  }

  const apiBase = searchParams.get("apiBase")?.trim();
  if (!apiBase) {
    return href as Route;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}apiBase=${encodeURIComponent(apiBase)}` as Route;
}

export function pickCanonicalApplicationId(
  applications: Array<{ id: string; stageUpdatedAt?: string | null; createdAt?: string | null }>
) {
  const sorted = [...applications].sort((left, right) => {
    const leftDate = new Date(left.stageUpdatedAt ?? left.createdAt ?? 0).getTime();
    const rightDate = new Date(right.stageUpdatedAt ?? right.createdAt ?? 0).getTime();
    return rightDate - leftDate;
  });

  return sorted[0]?.id ?? null;
}
