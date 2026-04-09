#!/usr/bin/env node

const API_BASE_URL = stripTrailingSlash(process.env.CANDIT_API_BASE_URL ?? "http://localhost:4000/v1");
const WEB_BASE_URL = stripTrailingSlash(process.env.CANDIT_WEB_BASE_URL ?? "http://localhost:3000");
const STRICT_MODE = isTruthy(process.env.CANDIT_SMOKE_STRICT);
const DEFAULT_PASSWORD = process.env.CANDIT_SMOKE_PASSWORD ?? "Launch123!";

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
  const attempts = options.attempts ?? 15;
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

function formatWarnings(items) {
  return items
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .join(" | ");
}

function jsonHeaders(token) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`
  };
}

function buildPilotCv(stamp) {
  return [
    "Ad Soyad: Pilot Smoke Candidate",
    `E-posta: pilot-smoke+${stamp}@example.com`,
    "Telefon: +90 555 123 45 67",
    "Lokasyon: Istanbul",
    "",
    "Deneyim",
    "2022-2025 Depo Operasyon Personeli - ABC Lojistik",
    "Sevkiyat, stok takibi, vardiya koordinasyonu ve ekip ici raporlama gorevleri yuruttum.",
    "",
    "Yetenekler",
    "Excel, stok yonetimi, vardiyali calisma, raporlama, ekip iletisim",
    "",
    "Egitim",
    "Lise mezunu"
  ].join("\n");
}

async function signupPilotUser() {
  const stamp = Date.now().toString();
  const email = `pilot-smoke+${stamp}@example.com`;

  const signup = await requestJson("Pilot signup", "/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: `Candit Pilot ${stamp}`,
      fullName: "Pilot Smoke",
      email,
      password: DEFAULT_PASSWORD
    })
  });

  ensure(signup?.accessToken, "Signup access token missing");

  logStatus("PASS", "Pilot tenant created", signup.user?.tenantId ?? email);

  return {
    stamp,
    token: signup.accessToken,
    tenantId: signup.user?.tenantId ?? null
  };
}

async function ensurePublishedJob(token) {
  const jobs = await requestJson("Jobs list", "/jobs", {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const existing = Array.isArray(jobs)
    ? jobs.find((job) => job.status === "PUBLISHED") ?? jobs[0] ?? null
    : null;

  if (existing) {
    logStatus("PASS", "Using existing job", `${existing.id} (${existing.title})`);
    return existing;
  }

  const created = await requestJson("Create job", "/jobs", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      title: "Operasyon Uzmani",
      roleFamily: "Operasyon",
      department: "Operasyon",
      status: "PUBLISHED",
      locationText: "Istanbul",
      shiftType: "Vardiyali",
      jdText: "Depo operasyonu, vardiya koordinasyonu ve ekip ici raporlama sorumluluklari.",
      requirements: [
        { key: "vardiya", value: "Vardiyali calisma deneyimi", required: true },
        { key: "iletisim", value: "Ekip ici iletisim", required: true }
      ]
    })
  });

  logStatus("PASS", "Published job created", `${created.id} (${created.title})`);
  return created;
}

async function uploadPilotCv(token, candidateId, stamp) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([buildPilotCv(stamp)], "pilot-smoke-cv.txt", {
      type: "text/plain"
    })
  );

  const upload = await requestJson("Upload CV", `/candidates/${candidateId}/cv-files`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`
    },
    body: formData
  });

  ensure(upload?.id, "CV upload returned no id");
  logStatus("PASS", "CV uploaded", upload.id);

  return upload;
}

async function main() {
  logStatus("INFO", "Pilot smoke started", `${API_BASE_URL} | ${WEB_BASE_URL}`);

  const apiHealth = await request("API health", `${API_BASE_URL}/health`);
  logStatus("PASS", "API reachable", `status=${apiHealth.status}`);

  const webRoot = await request("Web root", `${WEB_BASE_URL}/`);
  ensure(typeof webRoot.data === "string" && webRoot.data.length > 0, "Web root empty");
  logStatus("PASS", "Web reachable", `status=${webRoot.status}`);

  const pilot = await signupPilotUser();
  const auth = { authorization: `Bearer ${pilot.token}` };

  const session = await requestJson("Auth session", "/auth/session", {
    headers: auth
  });
  logStatus("PASS", "Auth session loaded", session?.runtime?.authTransport ?? "unknown");

  const recruiterOverview = await requestJson("Recruiter overview", "/read-models/recruiter-overview", {
    headers: auth
  });
  logStatus(
    "PASS",
    "Recruiter overview loaded",
    `jobs=${recruiterOverview?.pipeline?.activeJobs ?? "?"}, candidates=${recruiterOverview?.pipeline?.totalCandidates ?? "?"}`
  );

  const providerHealth = await requestJson("Provider health", "/read-models/provider-health", {
    headers: auth
  });
  const infrastructure = await requestJson("Infrastructure readiness", "/read-models/infrastructure-readiness", {
    headers: auth
  });
  const billingOverview = await requestJson("Billing overview", "/billing/overview", {
    headers: auth
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

  const job = await ensurePublishedJob(pilot.token);
  const candidatePayload = {
    fullName: `Pilot Smoke ${pilot.stamp.slice(-6)}`,
    email: `pilot-candidate+${pilot.stamp}@example.com`,
    phone: `+90555${pilot.stamp.slice(-7)}`,
    source: "manual"
  };

  const candidateResult = await requestJson("Create candidate", "/candidates", {
    method: "POST",
    headers: jsonHeaders(pilot.token),
    body: JSON.stringify(candidatePayload)
  });
  const candidateId = candidateResult?.candidate?.id ?? candidateResult?.id ?? null;
  ensure(candidateId, "Candidate creation returned no id");
  logStatus("PASS", "Candidate created", candidateId);

  const cvUpload = await uploadPilotCv(pilot.token, candidateId, pilot.stamp);

  const cvParseTrigger = await requestJson("Trigger CV parsing", `/candidates/${candidateId}/cv-parsing/trigger`, {
    method: "POST",
    headers: jsonHeaders(pilot.token),
    body: JSON.stringify({
      cvFileId: cvUpload.id
    })
  });
  logStatus("PASS", "CV parsing queued", cvParseTrigger?.taskRun?.taskRunId ?? cvUpload.id);

  const latestCvParsing = await poll(
    "CV parsing completion",
    () =>
      requestJson(`Poll latest CV parsing`, `/candidates/${candidateId}/cv-parsing/latest?cvFileId=${encodeURIComponent(cvUpload.id)}`, {
        headers: auth
      }),
    (detail) => {
      const status = detail?.taskRun?.status;
      return Boolean(status && !["PENDING", "QUEUED", "RUNNING"].includes(status));
    },
    { attempts: 20, intervalMs: 2000 }
  );

  ensure(
    latestCvParsing?.taskRun?.status === "SUCCEEDED",
    "CV parsing did not succeed",
    latestCvParsing?.taskRun?.errorMessage ?? JSON.stringify(latestCvParsing?.taskRun?.outputJson ?? {})
  );
  ensure(latestCvParsing?.parsedProfile?.id, "Parsed CV profile missing after successful parse");
  logStatus("PASS", "CV parsing completed", latestCvParsing.parsedProfile.id);

  const applicationResult = await requestJson("Create application", "/applications", {
    method: "POST",
    headers: jsonHeaders(pilot.token),
    body: JSON.stringify({
      candidateId,
      jobId: process.env.CANDIT_JOB_ID ?? job.id
    })
  });
  const applicationId = applicationResult?.id ?? applicationResult?.application?.id ?? null;
  ensure(applicationId, "Application creation returned no id");
  logStatus("PASS", "Application created", applicationId);

  await requestJson("Application detail", `/read-models/applications/${applicationId}`, {
    headers: auth
  });
  logStatus("PASS", "Application detail loaded");

  await requestJson("Trigger fit score", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: jsonHeaders(pilot.token),
    body: JSON.stringify({ action: "trigger_fit_score" })
  });
  logStatus("PASS", "Fit score queued");

  const applicationDetail = await poll(
    "Fit score completion",
    async () => {
      const [detail, latestFitScore] = await Promise.all([
        requestJson("Poll application detail", `/read-models/applications/${applicationId}`, {
          headers: auth
        }),
        requestJson("Poll latest fit score", `/applications/${applicationId}/fit-score/latest`, {
          headers: auth
        })
      ]);

      return {
        detail,
        latestFitScore
      };
    },
    (snapshot) => {
      const fitStatus = snapshot?.detail?.artifacts?.latestFitScoreRun?.status;
      const fitScoreReady = Boolean(snapshot?.latestFitScore?.id);
      return Boolean(
        fitScoreReady ||
        (fitStatus && !["PENDING", "QUEUED", "RUNNING"].includes(fitStatus))
      );
    },
    { attempts: 20, intervalMs: 2000 }
  );

  const detail = applicationDetail.detail;
  const latestFitScore = applicationDetail.latestFitScore;

  ensure(
    Boolean(latestFitScore?.id),
    "Fit score did not succeed",
    detail?.artifacts?.latestFitScoreRun?.errorMessage ??
      JSON.stringify(detail?.artifacts?.latestFitScoreRun?.outputJson ?? {})
  );
  logStatus(
    "PASS",
    "Fit score completed",
    latestFitScore?.id ?? detail?.artifacts?.latestFitScoreRun?.id ?? "latest fit score succeeded"
  );

  const screeningStatus = detail?.artifacts?.latestScreeningRun?.status;
  if (screeningStatus && screeningStatus === "SUCCEEDED") {
    logStatus(
      "PASS",
      "Screening completed",
      detail?.artifacts?.latestScreeningRun?.id ?? "latest screening succeeded"
    );
  } else {
    addWarning(
      "Screening run not terminal",
      screeningStatus ?? "latestScreeningRun missing"
    );
  }

  const inviteResult = await requestJson("Invite interview", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: jsonHeaders(pilot.token),
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
      answerSource: "manual_text",
      locale: "tr-TR"
    })
  });
  logStatus("PASS", "Readiness answer accepted");

  const interviewProgress = await requestJson("Submit interview answer", `/interviews/public/sessions/${sessionId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      transcriptText: "Son iki yilda vardiyali operasyon ekiplerinde calistim, hata payini azaltmak icin kontrol listeleri ve raporlama kullandim.",
      answerSource: "manual_text",
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
