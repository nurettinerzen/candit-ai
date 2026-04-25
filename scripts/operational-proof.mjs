#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "..");
const ARTIFACT_DIR = path.join(WORKSPACE_ROOT, "artifacts", "ops");

const API_BASE_URL = stripTrailingSlash(
  process.env.CANDIT_OPERATIONAL_API_BASE_URL ??
    process.env.CANDIT_API_BASE_URL ??
    "http://localhost:4100/v1"
);
const WEB_BASE_URL = stripTrailingSlash(
  process.env.CANDIT_OPERATIONAL_WEB_BASE_URL ??
    process.env.CANDIT_WEB_BASE_URL ??
    "http://localhost:3600"
);
const INTERNAL_ADMIN_EMAIL = process.env.CANDIT_INTERNAL_ADMIN_EMAIL?.trim() || "info@candit.ai";
const INTERNAL_ADMIN_PASSWORD =
  process.env.CANDIT_INTERNAL_ADMIN_PASSWORD?.trim() ||
  process.env.DEV_LOGIN_PASSWORD?.trim() ||
  "demo12345";
const INTERNAL_ADMIN_RECOVERY_PASSWORD =
  process.env.CANDIT_INTERNAL_ADMIN_RECOVERY_PASSWORD?.trim() || "InternalAdmin123!";
const INTERNAL_ADMIN_TENANT_ID =
  process.env.CANDIT_INTERNAL_ADMIN_TENANT_ID?.trim() || "ten_demo";
const OWNER_PASSWORD =
  process.env.CANDIT_OPERATIONAL_OWNER_PASSWORD?.trim() || "OwnerLaunch123!";
const OWNER_RESET_PASSWORD =
  process.env.CANDIT_OPERATIONAL_OWNER_RESET_PASSWORD?.trim() || "OwnerLaunch456!";
const MEMBER_PASSWORD =
  process.env.CANDIT_OPERATIONAL_MEMBER_PASSWORD?.trim() || "MemberLaunch123!";
const MEMBER_RESET_PASSWORD =
  process.env.CANDIT_OPERATIONAL_MEMBER_RESET_PASSWORD?.trim() || "MemberLaunch456!";

const steps = [];

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  capture(response) {
    const rawCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);

    for (const rawCookie of rawCookies) {
      const [cookiePair] = String(rawCookie).split(";");
      const [name, ...valueParts] = cookiePair.split("=");
      const cookieName = name?.trim();

      if (!cookieName || valueParts.length === 0) {
        continue;
      }

      this.cookies.set(cookieName, valueParts.join("=").trim());
    }
  }

  apply(headers) {
    if (this.cookies.size === 0) {
      return;
    }

    headers.set(
      "cookie",
      [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
    );
  }

  hasCookies() {
    return this.cookies.size > 0;
  }
}

function stripTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function buildStamp() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0")
  ].join("");
}

function logStatus(kind, label, detail) {
  console.log(`${kind} ${label}`);
  if (detail) {
    console.log(`    ${detail}`);
  }

  steps.push({
    kind,
    label,
    detail: detail ?? null
  });
}

function ensure(condition, label, detail) {
  if (!condition) {
    const error = new Error(detail ? `${label}: ${detail}` : label);
    error.label = label;
    throw error;
  }
}

function extractVerificationToken(previewUrl) {
  if (typeof previewUrl !== "string" || previewUrl.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(previewUrl);
    const token = url.searchParams.get("token");
    return token?.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

async function findNotificationPrimaryLink({
  tenantId,
  toAddress,
  eventType,
  attempts = 4
}) {
  if (!process.env.DATABASE_URL || !tenantId || !toAddress || !eventType) {
    return null;
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const command = spawnSync(
      "corepack",
      [
        "pnpm",
        "--filter",
        "@ai-interviewer/api",
        "exec",
        "tsx",
        "-e",
        [
          "import { PrismaClient } from '@prisma/client';",
          "(async () => {",
          "  const prisma = new PrismaClient();",
          "  const delivery = await prisma.notificationDelivery.findFirst({",
          "    where: {",
          "      tenantId: process.env.NOTIFICATION_TENANT_ID,",
          "      toAddress: process.env.NOTIFICATION_TO_ADDRESS,",
          "      eventType: process.env.NOTIFICATION_EVENT_TYPE",
          "    },",
          "    orderBy: { createdAt: 'desc' },",
          "    select: { metadata: true }",
          "  });",
          "  const metadata = delivery?.metadata && typeof delivery.metadata === 'object' && !Array.isArray(delivery.metadata) ? delivery.metadata : null;",
          "  const primaryLink = metadata && typeof metadata.primaryLink === 'string' ? metadata.primaryLink : null;",
          "  console.log(JSON.stringify({ primaryLink }));",
          "  await prisma.$disconnect();",
          "})();"
        ].join(" ")
      ],
      {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          NOTIFICATION_TENANT_ID: tenantId,
          NOTIFICATION_TO_ADDRESS: toAddress,
          NOTIFICATION_EVENT_TYPE: eventType
        }
      }
    );

    const output =
      command.status === 0
        ? parseJsonOutput(command.stdout, `${eventType} notification lookup`)
        : { primaryLink: null };
    const primaryLink =
      typeof output?.primaryLink === "string" && output.primaryLink.trim().length > 0
        ? output.primaryLink.trim()
        : null;

    if (primaryLink) {
      return primaryLink;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  return null;
}

async function fetchWithRetry(url, options, label, attempts = 2) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function request(label, url, options = {}) {
  const { cookieJar, headers: rawHeaders, ...fetchOptions } = options;
  const headers = new Headers(rawHeaders ?? {});
  cookieJar?.apply(headers);

  const response = await fetchWithRetry(url, { ...fetchOptions, headers }, label);
  cookieJar?.capture(response);
  const text = await response.text();
  let data = null;

  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${label} failed (${response.status}): ${detail}`);
  }

  return {
    status: response.status,
    data,
    url: response.url
  };
}

async function requestJson(label, pathOrUrl, options = {}) {
  const target = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE_URL}${pathOrUrl}`;
  const response = await request(label, target, options);
  return response.data;
}

async function requestStatus(label, pathOrUrl, expectedStatus, options = {}) {
  const target = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE_URL}${pathOrUrl}`;
  const { cookieJar, headers: rawHeaders, ...fetchOptions } = options;
  const headers = new Headers(rawHeaders ?? {});
  cookieJar?.apply(headers);

  const response = await fetchWithRetry(target, { ...fetchOptions, headers }, label);
  cookieJar?.capture(response);
  const text = await response.text();
  let data = null;

  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (response.status !== expectedStatus) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${label} failed (${response.status}): ${detail}`);
  }

  return {
    status: response.status,
    data
  };
}

async function requestWebPage(label, pathOrUrl, options = {}) {
  const target = pathOrUrl.startsWith("http") ? pathOrUrl : `${WEB_BASE_URL}${pathOrUrl}`;
  return request(label, target, options);
}

function ensureFinalPath(response, expectedPath, label) {
  const finalUrl = response?.url;
  ensure(finalUrl, `${label} final URL missing`);

  const parsed = new URL(finalUrl);
  ensure(parsed.pathname === expectedPath, label, `redirected to ${parsed.pathname}`);
}

function authenticatedRequestOptions(session, tenantId = session.tenantId, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("x-tenant-id", tenantId);

  if (session.token) {
    headers.set("authorization", `Bearer ${session.token}`);
  }

  return {
    ...options,
    headers,
    cookieJar: session.cookieJar ?? options.cookieJar
  };
}

function authenticatedJsonRequestOptions(session, tenantId = session.tenantId, options = {}) {
  return authenticatedRequestOptions(session, tenantId, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      "content-type": "application/json"
    }
  });
}

async function loginUser({ label, email, password, tenantId }) {
  const cookieJar = new CookieJar();
  const result = await request(`${label} login`, `${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    cookieJar,
    body: JSON.stringify({
      email,
      password
    })
  });

  ensure(result.data?.accessToken || cookieJar.hasCookies(), `${label} returned no auth context`);

  return {
    email,
    tenantId,
    token: result.data?.accessToken ?? null,
    cookieJar,
    userId: result.data?.user?.id ?? null
  };
}

function isLocalHostUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function parseJsonOutput(stdout, label) {
  const trimmed = String(stdout ?? "").trim();
  ensure(trimmed.length > 0, `${label} returned no stdout`);

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const lastObjectStart = trimmed.lastIndexOf("{");
    if (lastObjectStart >= 0) {
      const candidate = trimmed.slice(lastObjectStart);

      try {
        return JSON.parse(candidate);
      } catch {
        // Fall through to the original error below.
      }
    }

    throw new Error(
      `${label} returned non-JSON stdout: ${trimmed.slice(0, 400)}${
        trimmed.length > 400 ? "..." : ""
      }`
    );
  }
}

function runProvisioning() {
  const suffix = `${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`;
  const companyName = `Operational Proof ${suffix}`;
  const ownerName = `Operational Proof Owner ${suffix.slice(-4)}`;
  const ownerEmail = `pilot-proof-owner-${suffix}@example.com`;
  const billingEmail = `pilot-proof-billing-${suffix}@example.com`;
  const tenantId = `ten_operational_proof_${suffix}`;

  const args = [
    "pnpm",
    "--filter",
    "@ai-interviewer/api",
    "exec",
    "tsx",
    "../../scripts/provision-pilot-account.ts",
    "--company-name",
    companyName,
    "--owner-name",
    ownerName,
    "--owner-email",
    ownerEmail,
    "--billing-email",
    billingEmail,
    "--tenant-id",
    tenantId,
    "--plan",
    "ENTERPRISE",
    "--seats",
    "3",
    "--active-jobs",
    "10",
    "--candidate-processing",
    "250",
    "--ai-interviews",
    "25",
    "--grant-seats",
    "1",
    "--grant-active-jobs",
    "2",
    "--grant-candidate-processing",
    "25",
    "--grant-ai-interviews",
    "5",
    "--actor-email",
    INTERNAL_ADMIN_EMAIL
  ];

  const result = spawnSync("corepack", args, {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PUBLIC_WEB_BASE_URL: WEB_BASE_URL
    }
  });

  if (result.status !== 0) {
    throw new Error(
      `Pilot provisioning failed: ${result.stderr?.trim() || result.stdout?.trim() || "unknown error"}`
    );
  }

  const payload = parseJsonOutput(result.stdout, "Pilot provisioning");
  ensure(payload?.tenantId === tenantId, "Provisioned tenant id mismatch");
  ensure(typeof payload?.activationUrl === "string" && payload.activationUrl.length > 0, "Provisioning activation URL missing");

  return {
    suffix,
    companyName,
    ownerName,
    ownerEmail,
    billingEmail,
    tenantId,
    payload
  };
}

async function writeArtifacts(stamp, payload) {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const jsonPath = path.join(ARTIFACT_DIR, `operational-proof-${stamp}.json`);
  const markdownPath = path.join(ARTIFACT_DIR, `operational-proof-${stamp}.md`);

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(
    markdownPath,
    [
      `# Operational Proof - ${payload.tenantId}`,
      "",
      `- API: ${payload.apiBaseUrl}`,
      `- Web: ${payload.webBaseUrl}`,
      `- Tenant: ${payload.tenantId}`,
      `- Company: ${payload.companyName}`,
      `- Owner: ${payload.owner.email}`,
      `- Team member: ${payload.teamMember.email}`,
      `- Internal admin: ${payload.internalAdmin.email}`,
      "",
      "## Verified",
      ...payload.steps.map((step) => `- [${step.kind}] ${step.label}${step.detail ? `: ${step.detail}` : ""}`),
      "",
      "## Provisioning artifacts",
      `- JSON: ${payload.provisioning.artifacts.jsonPath}`,
      `- Markdown: ${payload.provisioning.artifacts.markdownPath}`
    ].join("\n"),
    "utf8"
  );

  return {
    jsonPath,
    markdownPath
  };
}

async function main() {
  const stamp = buildStamp();
  logStatus("INFO", "Operational proof started", `${API_BASE_URL} | ${WEB_BASE_URL}`);

  const apiHealth = await request("Operational API health", `${API_BASE_URL}/health`);
  ensure(apiHealth.status === 200, "Operational API not reachable");
  logStatus("PASS", "Operational API reachable", `status=${apiHealth.status}`);

  const webRoot = await requestWebPage("Operational web root", "/");
  ensure(typeof webRoot.data === "string" && webRoot.data.length > 0, "Operational web root empty");
  logStatus("PASS", "Operational web reachable", `status=${webRoot.status}`);

  const provisioning = runProvisioning();
  await access(provisioning.payload.artifacts.jsonPath);
  await access(provisioning.payload.artifacts.markdownPath);
  logStatus("PASS", "Pilot tenant provisioned", provisioning.tenantId);
  logStatus("PASS", "Provisioning artifacts written", `${provisioning.payload.artifacts.jsonPath} | ${provisioning.payload.artifacts.markdownPath}`);

  const ownerActivationPage = await requestWebPage("Owner activation page", provisioning.payload.activationUrl);
  ensure(typeof ownerActivationPage.data === "string" && ownerActivationPage.data.length > 0, "Owner activation page empty");
  ensureFinalPath(ownerActivationPage, "/auth/invitations/accept", "Owner activation page");
  logStatus("PASS", "Owner activation page loaded");

  const ownerToken = extractVerificationToken(provisioning.payload.activationUrl);
  ensure(ownerToken, "Owner activation token missing");

  const ownerInvitation = await requestJson(
    "Resolve owner invitation",
    `/auth/invitations/resolve?token=${encodeURIComponent(ownerToken)}`
  );
  ensure(ownerInvitation?.invitation?.email === provisioning.ownerEmail, "Owner invitation resolve email mismatch");
  logStatus("PASS", "Owner invitation resolved", provisioning.ownerEmail);

  const ownerCookieJar = new CookieJar();
  const ownerAccept = await request("Accept owner invitation", `${API_BASE_URL}/auth/invitations/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cookieJar: ownerCookieJar,
    body: JSON.stringify({
      token: ownerToken,
      password: OWNER_PASSWORD,
      fullName: provisioning.ownerName
    })
  });
  const ownerSession = {
    email: provisioning.ownerEmail,
    tenantId: provisioning.tenantId,
    token: ownerAccept.data?.accessToken ?? null,
    cookieJar: ownerCookieJar
  };
  ensure(ownerAccept.data?.accessToken || ownerCookieJar.hasCookies(), "Owner invitation accept returned no auth context");
  ownerSession.userId = ownerAccept.data?.user?.id ?? null;
  logStatus("PASS", "Owner invitation accepted", provisioning.ownerEmail);

  const ownerAuthSession = await requestJson("Owner auth session", "/auth/session", {
    ...authenticatedRequestOptions(ownerSession)
  });
  ensure(ownerAuthSession?.user?.email === provisioning.ownerEmail, "Owner auth session email mismatch");
  logStatus("PASS", "Owner auth session loaded", ownerAuthSession.user.email);

  const ownerPages = ["/dashboard", "/team", "/settings", "/subscription"];
  for (const page of ownerPages) {
    const response = await requestWebPage(`Owner page ${page}`, page, {
      cookieJar: ownerSession.cookieJar
    });
    ensure(typeof response.data === "string" && response.data.length > 0, `Owner page empty: ${page}`);
    ensureFinalPath(response, page, `Owner page ${page}`);
  }
  logStatus("PASS", "Owner recruiter pages loaded", `pages=${ownerPages.length}`);

  const ownerBilling = await requestJson("Owner billing overview", "/billing/overview", {
    ...authenticatedRequestOptions(ownerSession)
  });
  const seatQuota = ownerBilling?.usage?.quotas?.find?.((quota) => quota?.key === "SEATS") ?? null;
  ensure(seatQuota?.limit >= 3, "Provisioned seat quota mismatch");
  logStatus("PASS", "Provisioned billing quotas visible", `seats=${seatQuota.used}/${seatQuota.limit}`);

  const memberEmail = `pilot-proof-member-${provisioning.suffix}@example.com`;
  const memberName = `Operational Proof Manager ${provisioning.suffix.slice(-4)}`;
  const memberInvite = await requestJson("Invite team member", "/members/invitations", {
    ...authenticatedJsonRequestOptions(ownerSession, provisioning.tenantId, {
      method: "POST",
      body: JSON.stringify({
        email: memberEmail,
        fullName: memberName,
        role: "manager"
      })
    })
  });
  ensure(memberInvite?.userId, "Team invite returned no user id");
  const memberInvitationUrl =
    memberInvite?.invitationUrl ??
    (await findNotificationPrimaryLink({
      tenantId: provisioning.tenantId,
      toAddress: memberEmail,
      eventType: "member_invitation"
    }));
  ensure(memberInvitationUrl, "Team invite returned no invitation URL");
  logStatus("PASS", "Team member invited", memberInvite.userId);

  const memberToken = extractVerificationToken(memberInvitationUrl);
  ensure(memberToken, "Team invitation token missing");

  const memberAcceptPage = await requestWebPage("Team invitation page", memberInvitationUrl);
  ensure(typeof memberAcceptPage.data === "string" && memberAcceptPage.data.length > 0, "Team invitation page empty");
  ensureFinalPath(memberAcceptPage, "/auth/invitations/accept", "Team invitation page");
  logStatus("PASS", "Team invitation page loaded");

  const memberInvitation = await requestJson(
    "Resolve team invitation",
    `/auth/invitations/resolve?token=${encodeURIComponent(memberToken)}`
  );
  ensure(memberInvitation?.invitation?.email === memberEmail, "Team invitation resolve email mismatch");
  logStatus("PASS", "Team invitation resolved", memberEmail);

  const memberCookieJar = new CookieJar();
  const memberAccept = await request("Accept team invitation", `${API_BASE_URL}/auth/invitations/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cookieJar: memberCookieJar,
    body: JSON.stringify({
      token: memberToken,
      password: MEMBER_PASSWORD,
      fullName: memberName
    })
  });
  ensure(memberAccept.data?.accessToken || memberCookieJar.hasCookies(), "Team invitation accept returned no auth context");
  const memberSession = {
    email: memberEmail,
    tenantId: provisioning.tenantId,
    token: memberAccept.data?.accessToken ?? null,
    cookieJar: memberCookieJar,
    userId: memberAccept.data?.user?.id ?? memberInvite.userId
  };
  logStatus("PASS", "Team invitation accepted", memberEmail);

  const memberAuthSession = await requestJson("Team member auth session", "/auth/session", {
    ...authenticatedRequestOptions(memberSession)
  });
  ensure(memberAuthSession?.user?.email === memberEmail, "Team member auth session email mismatch");
  logStatus("PASS", "Team member auth session loaded", memberAuthSession.user.email);

  const memberDashboard = await requestWebPage("Team member dashboard", "/dashboard", {
    cookieJar: memberSession.cookieJar
  });
  ensure(typeof memberDashboard.data === "string" && memberDashboard.data.length > 0, "Team member dashboard empty");
  ensureFinalPath(memberDashboard, "/dashboard", "Team member dashboard");
  logStatus("PASS", "Team member dashboard loaded");

  const passwordResetRequest = await requestJson("Request member password reset", "/auth/password/forgot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: memberEmail
    })
  });
  const passwordResetPreviewUrl =
    passwordResetRequest?.previewUrl ??
    (await findNotificationPrimaryLink({
      tenantId: provisioning.tenantId,
      toAddress: memberEmail,
      eventType: "auth.password_reset_requested"
    }));
  ensure(passwordResetPreviewUrl, "Password reset preview URL missing");
  logStatus("PASS", "Password reset preview generated", memberEmail);

  const passwordResetToken = extractVerificationToken(passwordResetPreviewUrl);
  ensure(passwordResetToken, "Password reset token missing");

  const passwordResetPage = await requestWebPage("Password reset page", passwordResetPreviewUrl);
  ensure(typeof passwordResetPage.data === "string" && passwordResetPage.data.length > 0, "Password reset page empty");
  ensureFinalPath(passwordResetPage, "/auth/reset-password", "Password reset page");
  logStatus("PASS", "Password reset page loaded");

  const passwordResetResolve = await requestJson(
    "Resolve password reset",
    `/auth/password/reset/resolve?token=${encodeURIComponent(passwordResetToken)}`
  );
  ensure(passwordResetResolve?.reset?.email === memberEmail, "Password reset resolve email mismatch");
  logStatus("PASS", "Password reset resolved", memberEmail);

  const passwordResetCookieJar = new CookieJar();
  const passwordResetResult = await request("Reset member password", `${API_BASE_URL}/auth/password/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cookieJar: passwordResetCookieJar,
    body: JSON.stringify({
      token: passwordResetToken,
      password: MEMBER_RESET_PASSWORD
    })
  });
  ensure(passwordResetResult.data?.accessToken || passwordResetCookieJar.hasCookies(), "Password reset returned no auth context");
  logStatus("PASS", "Password reset completed", memberEmail);

  await requestStatus("Old member password rejected", "/auth/login", 401, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": provisioning.tenantId
    },
    body: JSON.stringify({
      email: memberEmail,
      password: MEMBER_PASSWORD
    })
  });
  logStatus("PASS", "Old member password rejected");

  const memberRelogin = await loginUser({
    label: "Member relogin after password reset",
    email: memberEmail,
    password: MEMBER_RESET_PASSWORD,
    tenantId: provisioning.tenantId
  });
  const memberReloginSession = await requestJson("Member relogin auth session", "/auth/session", {
    ...authenticatedRequestOptions(memberRelogin)
  });
  ensure(memberReloginSession?.user?.email === memberEmail, "Member relogin session email mismatch");
  logStatus("PASS", "Member relogin works after password reset", memberEmail);

  let internalAdmin = null;
  let internalAdminRecovered = false;

  try {
    internalAdmin = await loginUser({
      label: "Internal admin",
      email: INTERNAL_ADMIN_EMAIL,
      password: INTERNAL_ADMIN_PASSWORD,
      tenantId: INTERNAL_ADMIN_TENANT_ID
    });
  } catch (error) {
    if (!isLocalHostUrl(API_BASE_URL)) {
      throw error;
    }

    const internalAdminResetRequest = await requestJson(
      "Request internal admin password reset",
      "/auth/password/forgot",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: INTERNAL_ADMIN_EMAIL
        })
      }
    );
    ensure(internalAdminResetRequest?.previewUrl, "Internal admin password reset preview URL missing");
    logStatus("PASS", "Internal admin password reset preview generated", INTERNAL_ADMIN_EMAIL);

    const internalAdminResetToken = extractVerificationToken(internalAdminResetRequest.previewUrl);
    ensure(internalAdminResetToken, "Internal admin password reset token missing");

    const internalAdminResetPage = await requestWebPage(
      "Internal admin password reset page",
      internalAdminResetRequest.previewUrl
    );
    ensure(
      typeof internalAdminResetPage.data === "string" && internalAdminResetPage.data.length > 0,
      "Internal admin password reset page empty"
    );
    ensureFinalPath(
      internalAdminResetPage,
      "/auth/reset-password",
      "Internal admin password reset page"
    );
    logStatus("PASS", "Internal admin password reset page loaded");

    const internalAdminResetResolve = await requestJson(
      "Resolve internal admin password reset",
      `/auth/password/reset/resolve?token=${encodeURIComponent(internalAdminResetToken)}`
    );
    ensure(
      internalAdminResetResolve?.reset?.email === INTERNAL_ADMIN_EMAIL,
      "Internal admin password reset resolve email mismatch"
    );
    logStatus("PASS", "Internal admin password reset resolved", INTERNAL_ADMIN_EMAIL);

    const internalAdminResetCookieJar = new CookieJar();
    const internalAdminResetResult = await request(
      "Reset internal admin password",
      `${API_BASE_URL}/auth/password/reset`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        cookieJar: internalAdminResetCookieJar,
        body: JSON.stringify({
          token: internalAdminResetToken,
          password: INTERNAL_ADMIN_RECOVERY_PASSWORD
        })
      }
    );
    ensure(
      internalAdminResetResult.data?.accessToken || internalAdminResetCookieJar.hasCookies(),
      "Internal admin password reset returned no auth context"
    );
    logStatus("PASS", "Internal admin password reset completed", INTERNAL_ADMIN_EMAIL);

    internalAdmin = await loginUser({
      label: "Internal admin recovered",
      email: INTERNAL_ADMIN_EMAIL,
      password: INTERNAL_ADMIN_RECOVERY_PASSWORD,
      tenantId: INTERNAL_ADMIN_TENANT_ID
    });
    internalAdminRecovered = true;
  }

  const internalAdminSession = await requestJson("Internal admin auth session", "/auth/session", {
    ...authenticatedRequestOptions(internalAdmin, INTERNAL_ADMIN_TENANT_ID)
  });
  ensure(internalAdminSession?.user?.email === INTERNAL_ADMIN_EMAIL, "Internal admin session email mismatch");
  logStatus(
    "PASS",
    "Internal admin session loaded",
    internalAdminRecovered ? `${INTERNAL_ADMIN_EMAIL} (recovered)` : INTERNAL_ADMIN_EMAIL
  );

  const accountList = await requestJson(
    "Internal admin account list",
    `/internal-admin/accounts?query=${encodeURIComponent(provisioning.tenantId)}`,
    {
      ...authenticatedRequestOptions(internalAdmin, INTERNAL_ADMIN_TENANT_ID)
    }
  );
  ensure(Array.isArray(accountList?.rows), "Internal admin account list payload invalid");
  ensure(accountList.rows.some((row) => row?.tenantId === provisioning.tenantId), "Provisioned tenant missing in internal admin account list");
  logStatus("PASS", "Provisioned tenant visible in internal admin account list", provisioning.tenantId);

  const accountDetail = await requestJson(
    "Internal admin account detail",
    `/internal-admin/accounts/${encodeURIComponent(provisioning.tenantId)}`,
    {
      ...authenticatedRequestOptions(internalAdmin, INTERNAL_ADMIN_TENANT_ID)
    }
  );
  ensure(accountDetail?.tenant?.id === provisioning.tenantId, "Internal admin account detail tenant mismatch");
  ensure(accountDetail?.owner?.email === provisioning.ownerEmail, "Internal admin account detail owner mismatch");
  logStatus("PASS", "Internal admin account detail loaded", provisioning.tenantId);

  const ownerReset = await requestJson(
    "Internal admin owner reset",
    `/internal-admin/accounts/${encodeURIComponent(provisioning.tenantId)}/reset-owner-password`,
    {
      ...authenticatedJsonRequestOptions(internalAdmin, INTERNAL_ADMIN_TENANT_ID, {
        method: "POST",
        body: JSON.stringify({})
      })
    }
  );
  ensure(ownerReset?.sent === true, "Owner reset did not return sent=true");
  const ownerResetInvitationUrl =
    ownerReset?.invitationUrl ??
    (await findNotificationPrimaryLink({
      tenantId: provisioning.tenantId,
      toAddress: provisioning.ownerEmail,
      eventType: "internal_admin_password_reset"
    }));
  ensure(ownerResetInvitationUrl, "Owner reset invitation URL missing");
  logStatus("PASS", "Owner reset invitation generated", provisioning.ownerEmail);

  const ownerResetToken = extractVerificationToken(ownerResetInvitationUrl);
  ensure(ownerResetToken, "Owner reset token missing");

  const ownerResetPage = await requestWebPage("Owner reset page", ownerResetInvitationUrl);
  ensure(typeof ownerResetPage.data === "string" && ownerResetPage.data.length > 0, "Owner reset page empty");
  ensureFinalPath(ownerResetPage, "/auth/invitations/accept", "Owner reset page");
  logStatus("PASS", "Owner reset page loaded");

  const ownerResetResolve = await requestJson(
    "Resolve owner reset invitation",
    `/auth/invitations/resolve?token=${encodeURIComponent(ownerResetToken)}`
  );
  ensure(ownerResetResolve?.invitation?.email === provisioning.ownerEmail, "Owner reset resolve email mismatch");
  logStatus("PASS", "Owner reset invitation resolved", provisioning.ownerEmail);

  const ownerResetCookieJar = new CookieJar();
  const ownerResetAccept = await request("Accept owner reset invitation", `${API_BASE_URL}/auth/invitations/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cookieJar: ownerResetCookieJar,
    body: JSON.stringify({
      token: ownerResetToken,
      password: OWNER_RESET_PASSWORD,
      fullName: provisioning.ownerName
    })
  });
  ensure(ownerResetAccept.data?.accessToken || ownerResetCookieJar.hasCookies(), "Owner reset accept returned no auth context");
  logStatus("PASS", "Owner reset invitation accepted", provisioning.ownerEmail);

  await requestStatus("Old owner password rejected", "/auth/login", 401, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": provisioning.tenantId
    },
    body: JSON.stringify({
      email: provisioning.ownerEmail,
      password: OWNER_PASSWORD
    })
  });
  logStatus("PASS", "Old owner password rejected");

  const ownerRelogin = await loginUser({
    label: "Owner relogin after reset",
    email: provisioning.ownerEmail,
    password: OWNER_RESET_PASSWORD,
    tenantId: provisioning.tenantId
  });
  const ownerReloginSession = await requestJson("Owner relogin auth session", "/auth/session", {
    ...authenticatedRequestOptions(ownerRelogin)
  });
  ensure(ownerReloginSession?.user?.email === provisioning.ownerEmail, "Owner relogin session email mismatch");
  logStatus("PASS", "Owner relogin works after reset", provisioning.ownerEmail);

  const finalPayload = {
    stamp,
    apiBaseUrl: API_BASE_URL,
    webBaseUrl: WEB_BASE_URL,
    tenantId: provisioning.tenantId,
    companyName: provisioning.companyName,
    owner: {
      email: provisioning.ownerEmail
    },
    teamMember: {
      email: memberEmail
    },
    internalAdmin: {
      email: INTERNAL_ADMIN_EMAIL,
      tenantId: INTERNAL_ADMIN_TENANT_ID
    },
    provisioning: {
      artifacts: provisioning.payload.artifacts,
      planKey: provisioning.payload.planKey,
      quotas: provisioning.payload.quotas
    },
    steps
  };

  const artifacts = await writeArtifacts(stamp, finalPayload);
  logStatus("PASS", "Operational proof artifacts written", `${artifacts.jsonPath} | ${artifacts.markdownPath}`);
  logStatus("PASS", "Operational proof completed", provisioning.tenantId);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`FAIL Operational proof: ${detail}`);
  process.exitCode = 1;
});
