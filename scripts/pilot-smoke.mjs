#!/usr/bin/env node

const API_BASE_URL = stripTrailingSlash(process.env.CANDIT_API_BASE_URL ?? "http://localhost:4000/v1");
const WEB_BASE_URL = stripTrailingSlash(process.env.CANDIT_WEB_BASE_URL ?? "http://localhost:3000");
const STRICT_MODE = isTruthy(process.env.CANDIT_SMOKE_STRICT);

const AUTH_HEADERS = {
  "content-type": "application/json",
  "x-tenant-id": process.env.CANDIT_TENANT_ID ?? "ten_demo",
  "x-user-id": process.env.CANDIT_USER_ID ?? "usr_admin_demo",
  "x-roles": process.env.CANDIT_USER_ROLES ?? "owner",
  "x-user-label": process.env.CANDIT_USER_LABEL ?? "Pilot Smoke",
  "x-user-email": process.env.CANDIT_USER_EMAIL ?? "owner@demo.local"
};

const warnings = [];

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function logStatus(kind, label, detail) {
  console.log(`${kind} ${label}`);
  if (detail) {
    console.log(`    ${detail}`);
  }
}

function addWarning(label, detail) {
  warnings.push({ label, detail });
  logStatus("WARN", label, detail);
}

function ensure(condition, label, detail) {
  if (!condition) {
    const error = new Error(detail ? `${label}: ${detail}` : label);
    error.label = label;
    throw error;
  }
}

async function request(label, url, options = {}) {
  const response = await fetch(url, options);
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
    data
  };
}

async function requestJson(label, path, options = {}) {
  const response = await request(label, `${API_BASE_URL}${path}`, options);
  return response.data;
}

async function poll(label, callback, predicate, options = {}) {
  const attempts = options.attempts ?? 12;
  const intervalMs = options.intervalMs ?? 2000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const value = await callback();
    if (predicate(value)) {
      return value;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`${label} timed out after ${attempts} attempts.`);
}

function pickJob(jobs) {
  const rows = Array.isArray(jobs) ? jobs : [];
  return rows.find((job) => job.status === "PUBLISHED") ?? rows[0] ?? null;
}

function formatWarnings(items) {
  return items
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .join(" | ");
}

async function main() {
  logStatus("INFO", "Pilot smoke started", `${API_BASE_URL} | ${WEB_BASE_URL}`);

  const apiHealth = await request("API health", `${API_BASE_URL}/health`);
  logStatus("PASS", "API reachable", `status=${apiHealth.status}`);

  const webRoot = await request("Web root", `${WEB_BASE_URL}/`);
  ensure(typeof webRoot.data === "string" && webRoot.data.length > 0, "Web root empty");
  logStatus("PASS", "Web reachable", `status=${webRoot.status}`);

  const recruiterOverview = await requestJson("Recruiter overview", "/read-models/recruiter-overview", {
    headers: AUTH_HEADERS
  });
  logStatus(
    "PASS",
    "Recruiter overview loaded",
    `jobs=${recruiterOverview?.pipeline?.activeJobs ?? "?"}, candidates=${recruiterOverview?.pipeline?.totalCandidates ?? "?"}`
  );

  const providerHealth = await requestJson("Provider health", "/read-models/provider-health", {
    headers: AUTH_HEADERS
  });
  const infrastructure = await requestJson("Infrastructure readiness", "/read-models/infrastructure-readiness", {
    headers: AUTH_HEADERS
  });
  const billingOverview = await requestJson("Billing overview", "/billing/overview", {
    headers: AUTH_HEADERS
  });

  if (providerHealth?.overall === "degraded") {
    addWarning("Provider health degraded", formatWarnings(providerHealth.warnings ?? []));
  } else {
    logStatus("PASS", "Provider health healthy");
  }

  if (!infrastructure?.runtime?.notifications?.ready || infrastructure?.runtime?.notifications?.emailProvider === "console") {
    addWarning(
      "Email delivery not launch-ready",
      `provider=${infrastructure?.runtime?.notifications?.emailProvider ?? "unknown"}`
    );
  } else {
    logStatus("PASS", "Email delivery configured", infrastructure.runtime.notifications.emailProvider);
  }

  if (!billingOverview?.stripeReady) {
    addWarning("Stripe billing not ready", "Self-serve billing flows remain disabled.");
  } else {
    logStatus("PASS", "Stripe billing configured");
  }

  const jobs = await requestJson("Jobs list", "/jobs", { headers: AUTH_HEADERS });
  const job = pickJob(jobs);
  ensure(job, "No job found for pilot smoke");
  logStatus("PASS", "Using job", `${job.id} (${job.title})`);

  const stamp = `${Date.now()}`;
  const candidatePayload = {
    fullName: `Pilot Smoke ${stamp.slice(-6)}`,
    email: `pilot-smoke+${stamp}@example.com`,
    phone: `+90555${stamp.slice(-7)}`,
    source: "manual"
  };

  const candidateResult = await requestJson("Create candidate", "/candidates", {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify(candidatePayload)
  });
  const candidateId = candidateResult?.candidate?.id ?? candidateResult?.id ?? null;
  ensure(candidateId, "Candidate creation returned no id");
  logStatus("PASS", "Candidate created", candidateId);

  const applicationResult = await requestJson("Create application", "/applications", {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      candidateId,
      jobId: process.env.CANDIT_JOB_ID ?? job.id
    })
  });
  const applicationId = applicationResult?.id ?? applicationResult?.application?.id ?? null;
  ensure(applicationId, "Application creation returned no id");
  logStatus("PASS", "Application created", applicationId);

  await requestJson("Application detail", `/read-models/applications/${applicationId}`, {
    headers: AUTH_HEADERS
  });
  logStatus("PASS", "Application detail loaded");

  await requestJson("Trigger fit score", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ action: "trigger_fit_score" })
  });
  logStatus("PASS", "Fit score queued");

  const screeningDetail = await poll(
    "Screening completion",
    () =>
      requestJson("Poll application detail", `/read-models/applications/${applicationId}`, {
        headers: AUTH_HEADERS
      }),
    (detail) => detail?.artifacts?.latestScreeningRun?.status === "SUCCEEDED",
    { attempts: 15, intervalMs: 2000 }
  );
  logStatus(
    "PASS",
    "Screening completed",
    screeningDetail?.artifacts?.latestScreeningRun?.id ?? "latest run succeeded"
  );

  const inviteResult = await requestJson("Invite interview", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ action: "invite_interview" })
  });
  const sessionId = inviteResult?.sessionId ?? null;
  const interviewLink = inviteResult?.interviewLink ?? null;
  ensure(sessionId && interviewLink, "Invite interview response missing session or link");
  logStatus("PASS", "Interview invite created", sessionId);

  const interviewUrl = new URL(interviewLink);
  const token = interviewUrl.searchParams.get("token");
  ensure(token, "Interview invite missing token");

  const publicSession = await requestJson("Public interview session", `/interviews/public/sessions/${sessionId}?token=${encodeURIComponent(token)}`);
  ensure(publicSession?.sessionId === sessionId, "Public session payload mismatch");
  logStatus("PASS", "Public interview loaded", publicSession.status ?? "unknown");

  await requestJson("Start public interview", `/interviews/public/sessions/${sessionId}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      capabilities: {
        speechRecognition: false,
        speechSynthesis: false,
        locale: "tr-TR"
      }
    })
  });
  logStatus("PASS", "Public interview started");

  await requestJson("Submit readiness answer", `/interviews/public/sessions/${sessionId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      transcriptText: "Hazirim, baslayabiliriz.",
      answerSource: "text",
      locale: "tr-TR"
    })
  });
  logStatus("PASS", "Readiness answer accepted");

  const interviewProgress = await requestJson("Submit interview answer", `/interviews/public/sessions/${sessionId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      transcriptText: "Son iki yilda vardiyali operasyon ekiplerinde calistim, hizli tempoda hata payini dusurmek icin kontrol listeleri kullandim.",
      answerSource: "text",
      locale: "tr-TR"
    })
  });
  ensure(interviewProgress?.activePrompt || interviewProgress?.conversation, "Interview did not advance after answer");
  logStatus("PASS", "Interview advanced after answer");

  if (warnings.length > 0) {
    const detail = warnings.map((warning) => `${warning.label}${warning.detail ? ` (${warning.detail})` : ""}`).join(" | ");
    if (STRICT_MODE) {
      throw new Error(`Strict smoke failed because launch warnings remain: ${detail}`);
    }

    logStatus("WARN", "Smoke completed with launch warnings", detail);
  } else {
    logStatus("PASS", "Smoke completed with no warnings");
  }
}

main().catch((error) => {
  logStatus("FAIL", error.label ?? "Pilot smoke failed", error.message);
  process.exit(1);
});
