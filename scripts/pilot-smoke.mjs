#!/usr/bin/env node

const API_BASE_URL = stripTrailingSlash(process.env.CANDIT_API_BASE_URL ?? "http://localhost:4000/v1");
const STRICT_MODE = isTruthy(process.env.CANDIT_SMOKE_STRICT);
const DEFAULT_PASSWORD = process.env.CANDIT_SMOKE_PASSWORD ?? "Launch123!";

const warnings = [];

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
  return value.replace(/\/+$/, "");
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function candidateWebBaseUrls() {
  const explicit = process.env.CANDIT_WEB_BASE_URL?.trim();
  if (explicit) {
    return [stripTrailingSlash(explicit)];
  }

  return ["http://localhost:3000", "http://localhost:3100", "http://localhost:3200"];
}

function normalizeComparableText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDecisionPattern(value, pattern) {
  return pattern.test(normalizeComparableText(value));
}

function recommendationCopyLooksAligned(outcome, summary, action) {
  const advancePattern =
    /(uygun oldugu|uygun gorunuyor|guclu aday|\bilerlet(?!me)\w*|sonraki asama|mulakata al|mulakata davet|gorusmeye al|gorusmeye davet)/;
  const holdPattern =
    /(teyit|dogrula|follow up|follow-up|acik nokta|ek gorusme|kisa gorusme|incelemesinde tut|kritik nokta|beklet)/;
  const reviewPattern =
    /(manuel inceleme|daha siki|ilerletmeden once|ilerletme karari vermeden once|yakindan incele|uyum net degil|risk|review|yeniden degerlendir)/;

  const summaryHasAdvance = hasDecisionPattern(summary, advancePattern);
  const summaryHasHold = hasDecisionPattern(summary, holdPattern);
  const summaryHasReview = hasDecisionPattern(summary, reviewPattern);
  const actionHasAdvance = hasDecisionPattern(action, advancePattern);
  const actionHasHold = hasDecisionPattern(action, holdPattern);
  const actionHasReview = hasDecisionPattern(action, reviewPattern);

  if (outcome === "ADVANCE") {
    return summaryHasAdvance && actionHasAdvance && !summaryHasReview && !actionHasReview;
  }

  if (outcome === "HOLD") {
    return summaryHasHold && actionHasHold && !summaryHasAdvance && !actionHasAdvance;
  }

  if (outcome === "REVIEW") {
    return summaryHasReview && actionHasReview && !summaryHasAdvance && !actionHasAdvance;
  }

  return true;
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

async function fetchWithRetry(url, options, retryLabel, attempts = 2) {
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
    `${retryLabel} fetch failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

async function request(label, url, options = {}) {
  const { cookieJar, headers: rawHeaders, ...fetchOptions } = options;
  const headers = new Headers(rawHeaders ?? {});
  cookieJar?.apply(headers);

  const response = await fetchWithRetry(url, {
    ...fetchOptions,
    headers
  }, label);
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

async function requestJson(label, path, options = {}) {
  const response = await request(label, `${API_BASE_URL}${path}`, options);
  return response.data;
}

async function requestWebPage(label, path, options = {}) {
  const webBaseUrl = options.webBaseUrl;
  ensure(typeof webBaseUrl === "string" && webBaseUrl.length > 0, `${label} web base URL missing`);
  const { webBaseUrl: _ignored, ...requestOptions } = options;
  return request(label, `${webBaseUrl}${path}`, requestOptions);
}

async function requestStatus(label, path, expectedStatus, options = {}) {
  const { cookieJar, headers: rawHeaders, ...fetchOptions } = options;
  const headers = new Headers(rawHeaders ?? {});
  cookieJar?.apply(headers);

  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers
  }, label);
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

function ensureFinalPath(response, expectedPath, label) {
  const finalUrl = response?.url;
  ensure(finalUrl, `${label} final URL missing`);

  try {
    const parsed = new URL(finalUrl);
    ensure(parsed.pathname === expectedPath, label, `redirected to ${parsed.pathname}`);
  } catch {
    throw new Error(`${label}: invalid final URL ${finalUrl}`);
  }
}

async function resolveWebBaseUrl() {
  const diagnostics = [];

  for (const candidate of candidateWebBaseUrls()) {
    try {
      const [pricing, login] = await Promise.all([
        fetchWithRetry(`${candidate}/pricing`, undefined, `${candidate}/pricing probe`),
        fetchWithRetry(`${candidate}/auth/login`, undefined, `${candidate}/auth/login probe`)
      ]);

      if (pricing.ok && login.ok) {
        return candidate;
      }

      diagnostics.push(`${candidate} (pricing=${pricing.status}, login=${login.status})`);
    } catch (error) {
      diagnostics.push(
        `${candidate} (${error instanceof Error ? error.message : String(error)})`
      );
    }
  }

  throw new Error(
    `No compatible web runtime found. Tried: ${diagnostics.join(" | ")}`
  );
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

function authHeaders(token, tenantId, contentType = null) {
  const headers = {
    "x-tenant-id": tenantId
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  if (contentType) {
    headers["content-type"] = contentType;
  }

  return headers;
}

function jsonHeaders(token, tenantId) {
  return authHeaders(token, tenantId, "application/json");
}

function authenticatedRequestOptions(session, tenantId, options = {}) {
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

function authenticatedJsonRequestOptions(session, tenantId, options = {}) {
  return authenticatedRequestOptions(session, tenantId, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      "content-type": "application/json"
    }
  });
}

function buildPilotCv(stamp) {
  return [
    "Ad Soyad: Pilot Smoke Candidate",
    `E-posta: pilot-smoke-${stamp}@example.com`,
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

async function loginPilotUser(session, options = {}) {
  const cookieJar = options.cookieJar ?? session.cookieJar;
  const login = await request(options.label ?? "Pilot login", `${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cookieJar,
    body: JSON.stringify({
      email: session.email,
      password: options.password ?? DEFAULT_PASSWORD,
      tenantId: session.tenantId
    })
  });

  ensure(
    login.data?.accessToken || cookieJar?.hasCookies(),
    "Login auth context missing"
  );

  return {
    token: login.data?.accessToken ?? null,
    user: login.data?.user ?? null,
    session: login.data?.session ?? null,
    cookieJar
  };
}

async function signupPilotUser() {
  const stamp = Date.now().toString();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `pilot-smoke-${stamp}-${suffix}@example.com`;
  const cookieJar = new CookieJar();
  let signup = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const signupResponse = await request("Pilot signup", `${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cookieJar,
        body: JSON.stringify({
          companyName: `Candit ${suffix} Pilot ${stamp}`,
          fullName: "Pilot Smoke",
          email,
          password: DEFAULT_PASSWORD
        })
      });
      signup = signupResponse.data;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /failed \((5\d{2})\):/i.test(message);
      if (!retryable || attempt === 3) {
        throw error;
      }

      logStatus("INFO", "Pilot signup retrying", `attempt=${attempt + 1}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  const tenantId = signup?.user?.tenantId ?? null;
  const directAccessToken = typeof signup?.accessToken === "string" ? signup.accessToken : null;

  ensure(tenantId, "Signup tenant id missing");
  ensure(signup?.user?.id, "Signup user id missing");

  if (directAccessToken) {
    logStatus("PASS", "Pilot tenant created", tenantId ?? email);
    return {
      stamp,
      email,
      token: directAccessToken,
      cookieJar,
      tenantId,
      userId: signup.user?.id ?? null
    };
  }

  const previewUrl = typeof signup?.emailVerification?.previewUrl === "string"
    ? signup.emailVerification.previewUrl
    : null;
  const verificationToken = extractVerificationToken(previewUrl);

  if (verificationToken) {
    await requestJson("Pilot email verification confirm", "/auth/email-verification/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: verificationToken })
    });
    logStatus("PASS", "Pilot user email verified", email);
  }

  const login = await request("Pilot login after signup", `${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cookieJar,
    body: JSON.stringify({
      email,
      password: DEFAULT_PASSWORD,
      tenantId
    })
  });

  ensure(
    login.data?.accessToken || cookieJar.hasCookies(),
    "Login auth context missing"
  );

  logStatus("PASS", "Pilot tenant created", login.data?.user?.tenantId ?? tenantId ?? email);

  return {
    stamp,
    email,
    token: login.data?.accessToken ?? null,
    cookieJar,
    tenantId: login.data?.user?.tenantId ?? tenantId,
    userId: signup.user?.id ?? null
  };
}

function buildCrudJobPayload(stamp) {
  return {
    title: `Pilot CRUD ${stamp.slice(-6)}`,
    roleFamily: "Operasyon",
    department: "Operasyon",
    locationText: "Istanbul",
    shiftType: "Vardiyali",
    status: "DRAFT",
    jdText: "Pilot recruiter CRUD proof icin olusturulan taslak ilan.",
    requirements: [
      { key: "koordinasyon", value: "Saha ve ekip koordinasyonu", required: true },
      { key: "raporlama", value: "Gunluk operasyon raporlamasi", required: true }
    ]
  };
}

async function ensurePublishedJob(session, tenantId) {
  const jobs = await requestJson("Jobs list", "/jobs", {
    ...authenticatedRequestOptions(session, tenantId)
  });

  const existing = Array.isArray(jobs)
    ? jobs.find((job) => job.status === "PUBLISHED") ?? jobs[0] ?? null
    : null;

  if (existing) {
    logStatus("PASS", "Using existing job", `${existing.id} (${existing.title})`);
    return existing;
  }

  const baseJobPayload = {
    title: "Operasyon Uzmani",
    roleFamily: "Operasyon",
    department: "Operasyon",
    locationText: "Istanbul",
    shiftType: "Vardiyali",
    jdText: "Depo operasyonu, vardiya koordinasyonu ve ekip ici raporlama sorumluluklari.",
    requirements: [
      { key: "vardiya", value: "Vardiyali calisma deneyimi", required: true },
      { key: "iletisim", value: "Ekip ici iletisim", required: true }
    ]
  };

  try {
    const created = await requestJson("Create job", "/jobs", {
      ...authenticatedJsonRequestOptions(session, tenantId, {
        method: "POST",
        body: JSON.stringify({
          ...baseJobPayload,
          status: "PUBLISHED"
        })
      }),
    });

    logStatus("PASS", "Published job created", `${created.id} (${created.title})`);
    return created;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("ücretsiz denemeyi daha önce kullandı")) {
      throw error;
    }

    addWarning(
      "Published job billing guardrail hit",
      "Smoke DRAFT job fallback ile devam ediyor."
    );

    const fallback = await requestJson("Create draft job", "/jobs", {
      ...authenticatedJsonRequestOptions(session, tenantId, {
        method: "POST",
        body: JSON.stringify({
          ...baseJobPayload,
          status: "DRAFT"
        })
      })
    });

    logStatus("PASS", "Draft job created", `${fallback.id} (${fallback.title})`);
    return fallback;
  }
}

async function uploadPilotCv(session, tenantId, candidateId, stamp) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([buildPilotCv(stamp)], "pilot-smoke-cv.txt", {
      type: "text/plain"
    })
  );

  const upload = await requestJson("Upload CV", `/candidates/${candidateId}/cv-files`, {
    ...authenticatedRequestOptions(session, tenantId, {
      method: "POST",
      body: formData
    })
  });

  ensure(upload?.id, "CV upload returned no id");
  logStatus("PASS", "CV uploaded", upload.id);

  return upload;
}

async function main() {
  const webBaseUrl = await resolveWebBaseUrl();
  logStatus("INFO", "Pilot smoke started", `${API_BASE_URL} | ${webBaseUrl}`);

  const apiHealth = await request("API health", `${API_BASE_URL}/health`);
  logStatus("PASS", "API reachable", `status=${apiHealth.status}`);

  const webRoot = await request("Web root", `${webBaseUrl}/`);
  ensure(typeof webRoot.data === "string" && webRoot.data.length > 0, "Web root empty");
  logStatus("PASS", "Web reachable", `status=${webRoot.status}`);

  const publicPages = [
    { path: "/auth/login", label: "Login page" },
    { path: "/auth/signup", label: "Signup page" },
    { path: "/pricing", label: "Pricing page" }
  ];

  for (const page of publicPages) {
    const response = await requestWebPage(page.label, page.path, {
      webBaseUrl
    });
    ensure(typeof response.data === "string" && response.data.length > 0, `${page.label} empty`);
    ensureFinalPath(response, page.path, page.label);
  }
  logStatus("PASS", "Public web surfaces loaded", `pages=${publicPages.length}`);

  const pilot = await signupPilotUser();
  let auth = authenticatedRequestOptions(pilot, pilot.tenantId);

  const session = await requestJson("Auth session", "/auth/session", {
    ...auth
  });
  logStatus("PASS", "Auth session loaded", session?.runtime?.authTransport ?? "unknown");

  await requestJson("Auth logout", "/auth/logout", {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({})
    })
  });
  logStatus("PASS", "Auth logout completed");

  await requestStatus("Auth session blocked after logout", "/auth/session", 401, {
    ...authenticatedRequestOptions(pilot, pilot.tenantId)
  });
  logStatus("PASS", "Auth session blocked after logout");

  const relogin = await loginPilotUser(pilot, {
    label: "Pilot login after logout"
  });
  pilot.token = relogin.token;
  pilot.cookieJar = relogin.cookieJar;
  auth = authenticatedRequestOptions(pilot, pilot.tenantId);
  logStatus("PASS", "Auth login completed after logout", relogin.user?.id ?? pilot.userId ?? pilot.email);

  const restoredSession = await requestJson("Auth session after relogin", "/auth/session", {
    ...authenticatedRequestOptions(pilot, pilot.tenantId)
  });
  logStatus("PASS", "Auth session restored after relogin", restoredSession?.session?.id ?? "active");

  const recruiterPages = [
    { path: "/dashboard", label: "Dashboard page" },
    { path: "/jobs", label: "Jobs page" },
    { path: "/candidates", label: "Candidates page" },
    { path: "/applications", label: "Applications page" },
    { path: "/team", label: "Team page" },
    { path: "/interviews", label: "Interviews page" },
    { path: "/settings", label: "Settings page" },
    { path: "/subscription", label: "Subscription page" },
    { path: "/ai-support", label: "AI support page" }
  ];

  for (const page of recruiterPages) {
    const response = await requestWebPage(page.label, page.path, {
      webBaseUrl,
      cookieJar: pilot.cookieJar
    });
    ensure(typeof response.data === "string" && response.data.length > 0, `${page.label} empty`);
    ensureFinalPath(response, page.path, page.label);
  }
  logStatus("PASS", "Recruiter web surfaces loaded", `pages=${recruiterPages.length}`);

  const recruiterOverview = await requestJson("Recruiter overview", "/read-models/recruiter-overview", {
    ...auth
  });
  logStatus(
    "PASS",
    "Recruiter overview loaded",
    `jobs=${recruiterOverview?.pipeline?.activeJobs ?? "?"}, candidates=${recruiterOverview?.pipeline?.totalCandidates ?? "?"}`
  );

  const providerHealth = await requestJson("Provider health", "/read-models/provider-health", {
    ...auth
  });
  const aiSupportCenter = await requestJson("AI support center", "/read-models/ai-support-center", {
    ...auth
  });
  const infrastructure = await requestJson("Infrastructure readiness", "/read-models/infrastructure-readiness", {
    ...auth
  });
  const billingOverview = await requestJson("Billing overview", "/billing/overview", {
    ...auth
  });

  if (providerHealth?.overall === "degraded") {
    addWarning("Provider health degraded", formatWarnings(providerHealth.warnings ?? []));
  } else {
    logStatus("PASS", "Provider health healthy");
  }

  logStatus(
    "PASS",
    "AI support center loaded",
    `providers=${Array.isArray(aiSupportCenter?.providers) ? aiSupportCenter.providers.length : 0}`
  );

  ensure(Array.isArray(infrastructure?.scheduling?.catalog), "Infrastructure scheduling catalog missing");
  ensure(infrastructure?.scheduling?.fallback?.label, "Infrastructure scheduling fallback missing");
  logStatus(
    "PASS",
    "Infrastructure scheduling catalog loaded",
    `providers=${infrastructure.scheduling.catalog.length}, fallback=${infrastructure.scheduling.fallback.label}`
  );

  if (Array.isArray(infrastructure?.launchWarnings) && infrastructure.launchWarnings.length > 0) {
    addWarning("Infrastructure launch warnings present", formatWarnings(infrastructure.launchWarnings));
  } else {
    logStatus("PASS", "Infrastructure launch warnings clear");
  }

  if (Array.isArray(infrastructure?.queryWarnings) && infrastructure.queryWarnings.length > 0) {
    addWarning("Infrastructure query warnings present", formatWarnings(infrastructure.queryWarnings));
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

  const job = await ensurePublishedJob(pilot, pilot.tenantId);
  const crudJobPayload = buildCrudJobPayload(pilot.stamp);
  const crudJob = await requestJson("Create draft CRUD job", "/jobs", {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify(crudJobPayload)
    })
  });
  ensure(crudJob?.id, "CRUD draft job creation returned no id");
  logStatus("PASS", "Draft CRUD job created", `${crudJob.id} (${crudJob.title})`);

  const jobsList = await requestJson("Jobs list", "/jobs", {
    ...auth
  });
  ensure(Array.isArray(jobsList), "Jobs list response invalid");
  ensure(
    jobsList.some((item) => item?.id === crudJob.id),
    "Jobs list missing CRUD draft job"
  );
  logStatus("PASS", "Jobs list includes CRUD draft job", crudJob.id);

  const crudJobDetail = await requestJson("Draft CRUD job detail", `/jobs/${crudJob.id}`, {
    ...auth
  });
  ensure(crudJobDetail?.id === crudJob.id, "CRUD draft job detail mismatch");
  logStatus("PASS", "Draft CRUD job detail loaded", crudJobDetail.id);

  const crudJobUpdatedTitle = `${crudJob.title} Guncellendi`;
  const crudJobUpdatedLocation = "Ankara";
  const updatedCrudJob = await requestJson("Update draft CRUD job", `/jobs/${crudJob.id}`, {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "PATCH",
      body: JSON.stringify({
        title: crudJobUpdatedTitle,
        locationText: crudJobUpdatedLocation
      })
    })
  });
  ensure(updatedCrudJob?.title === crudJobUpdatedTitle, "Draft CRUD job title did not update");
  ensure(updatedCrudJob?.locationText === crudJobUpdatedLocation, "Draft CRUD job location did not update");
  logStatus("PASS", "Draft CRUD job updated", `${updatedCrudJob.title} | ${updatedCrudJob.locationText}`);

  const archivedCrudJob = await requestJson("Archive draft CRUD job", `/jobs/${crudJob.id}`, {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ARCHIVED"
      })
    })
  });
  ensure(archivedCrudJob?.status === "ARCHIVED", "Draft CRUD job did not archive");
  logStatus("PASS", "Draft CRUD job archived", archivedCrudJob.id);

  const archivedCrudJobDetail = await requestJson("Archived CRUD job detail", `/jobs/${crudJob.id}`, {
    ...auth
  });
  ensure(archivedCrudJobDetail?.status === "ARCHIVED", "Archived CRUD job detail mismatch");
  logStatus("PASS", "Archived CRUD job detail loaded", archivedCrudJobDetail.id);

  const candidatePayload = {
    fullName: `Pilot Smoke ${pilot.stamp.slice(-6)}`,
    email: `pilot-candidate-${pilot.stamp}@example.com`,
    phone: `+90555${pilot.stamp.slice(-7)}`,
    source: "manual"
  };

  const candidateResult = await requestJson("Create candidate", "/candidates", {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify(candidatePayload)
    })
  });
  const candidateId = candidateResult?.candidate?.id ?? candidateResult?.id ?? null;
  ensure(candidateId, "Candidate creation returned no id");
  logStatus("PASS", "Candidate created", candidateId);

  const candidatesList = await requestJson("Candidates list", "/candidates", {
    ...auth
  });
  ensure(Array.isArray(candidatesList), "Candidates list response invalid");
  ensure(
    candidatesList.some((item) => item?.id === candidateId),
    "Candidates list missing created candidate"
  );
  logStatus("PASS", "Candidates list includes created candidate", candidateId);

  const isolatedTenant = await signupPilotUser();

  await requestStatus("Tenant header mismatch", "/auth/session", 403, {
    ...authenticatedRequestOptions(pilot, isolatedTenant.tenantId)
  });
  logStatus("PASS", "Tenant header mismatch blocked");

  await requestStatus("Cross-tenant candidate read blocked", `/candidates/${candidateId}`, 404, {
    ...authenticatedRequestOptions(isolatedTenant, isolatedTenant.tenantId)
  });
  logStatus("PASS", "Cross-tenant candidate read blocked", candidateId);

  const cvUpload = await uploadPilotCv(pilot, pilot.tenantId, candidateId, pilot.stamp);

  const cvParseTrigger = await requestJson("Trigger CV parsing", `/candidates/${candidateId}/cv-parsing/trigger`, {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({
        cvFileId: cvUpload.id
      })
    })
  });
  logStatus("PASS", "CV parsing queued", cvParseTrigger?.taskRun?.taskRunId ?? cvUpload.id);

  const latestCvParsing = await poll(
    "CV parsing completion",
    () =>
      requestJson(`Poll latest CV parsing`, `/candidates/${candidateId}/cv-parsing/latest?cvFileId=${encodeURIComponent(cvUpload.id)}`, {
        ...auth
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
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({
        candidateId,
        jobId: process.env.CANDIT_JOB_ID ?? job.id
      })
    })
  });
  const applicationId = applicationResult?.id ?? applicationResult?.application?.id ?? null;
  ensure(applicationId, "Application creation returned no id");
  logStatus("PASS", "Application created", applicationId);

  const candidateDetail = await requestJson("Candidate detail", `/candidates/${candidateId}`, {
    ...auth
  });
  ensure(candidateDetail?.id === candidateId, "Candidate detail mismatch");
  ensure(
    Array.isArray(candidateDetail?.applications) &&
      candidateDetail.applications.some((item) => item?.id === applicationId),
    "Candidate detail missing linked application"
  );
  logStatus("PASS", "Candidate detail loaded", `${candidateDetail.id} | applications=${candidateDetail.applications.length}`);

  const applicationsList = await requestJson("Applications list", `/applications?jobId=${encodeURIComponent(job.id)}`, {
    ...auth
  });
  ensure(Array.isArray(applicationsList), "Applications list response invalid");
  ensure(
    applicationsList.some((item) => item?.id === applicationId),
    "Applications list missing created application"
  );
  logStatus("PASS", "Applications list includes created application", applicationId);

  const applicationApiDetail = await requestJson("Application API detail", `/applications/${applicationId}`, {
    ...auth
  });
  ensure(applicationApiDetail?.id === applicationId, "Application API detail mismatch");
  logStatus("PASS", "Application API detail loaded", applicationApiDetail.id);

  const recruiterDetailPages = [
    { path: `/jobs/${encodeURIComponent(job.id)}`, label: "Job detail page" },
    { path: `/candidates/${encodeURIComponent(candidateId)}`, label: "Candidate detail page" },
    { path: `/applications/${encodeURIComponent(applicationId)}`, label: "Application detail page" }
  ];

  for (const page of recruiterDetailPages) {
    const response = await requestWebPage(page.label, page.path, {
      webBaseUrl,
      cookieJar: pilot.cookieJar
    });
    ensure(typeof response.data === "string" && response.data.length > 0, `${page.label} empty`);
    ensureFinalPath(response, page.path, page.label);
  }
  logStatus("PASS", "Recruiter detail web surfaces loaded", `pages=${recruiterDetailPages.length}`);

  await requestJson("Application detail", `/read-models/applications/${applicationId}`, {
    ...auth
  });
  logStatus("PASS", "Application detail loaded");

  const stageCandidateResult = await requestJson("Create stage-transition candidate", "/candidates", {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({
        fullName: `Pilot Stage ${pilot.stamp.slice(-6)}`,
        email: `pilot-stage-${pilot.stamp}@example.com`,
        phone: `+90544${pilot.stamp.slice(-7)}`,
        source: "manual"
      })
    })
  });
  const stageCandidateId = stageCandidateResult?.candidate?.id ?? stageCandidateResult?.id ?? null;
  ensure(stageCandidateId, "Stage-transition candidate creation returned no id");
  logStatus("PASS", "Stage-transition candidate created", stageCandidateId);

  const stageApplicationResult = await requestJson("Create stage-transition application", "/applications", {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({
        candidateId: stageCandidateId,
        jobId: process.env.CANDIT_JOB_ID ?? job.id
      })
    })
  });
  const stageApplicationId = stageApplicationResult?.id ?? stageApplicationResult?.application?.id ?? null;
  ensure(stageApplicationId, "Stage-transition application creation returned no id");
  logStatus("PASS", "Stage-transition application created", stageApplicationId);

  const stageTransitionResult = await requestJson("Stage-transition application", `/applications/${stageApplicationId}/stage-transition`, {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({
        toStage: "SCREENING",
        reasonCode: "pilot_smoke_stage_transition"
      })
    })
  });
  ensure(stageTransitionResult?.applicationId === stageApplicationId, "Stage-transition response mismatch");
  ensure(stageTransitionResult?.toStage === "SCREENING", "Stage-transition target stage mismatch");
  logStatus("PASS", "Application stage transitioned", `${stageApplicationId} -> ${stageTransitionResult.toStage}`);

  const screeningApplications = await requestJson(
    "Applications list filtered by stage",
    `/applications?stage=SCREENING&jobId=${encodeURIComponent(job.id)}`,
    {
      ...auth
    }
  );
  ensure(Array.isArray(screeningApplications), "Screening applications list response invalid");
  ensure(
    screeningApplications.some((item) => item?.id === stageApplicationId),
    "Stage-filtered applications list missing transitioned application"
  );
  logStatus("PASS", "Applications stage filter includes transitioned application", stageApplicationId);

  const stageApplicationDetail = await requestJson("Stage-transition application detail", `/applications/${stageApplicationId}`, {
    ...auth
  });
  ensure(stageApplicationDetail?.id === stageApplicationId, "Stage-transition application detail mismatch");
  ensure(stageApplicationDetail?.currentStage === "SCREENING", "Stage-transition application detail stage mismatch");
  logStatus("PASS", "Stage-transition application detail loaded", `${stageApplicationDetail.id} | ${stageApplicationDetail.currentStage}`);

  await requestJson("Trigger fit score", `/applications/${applicationId}/quick-action`, {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({ action: "trigger_fit_score" })
    })
  });
  logStatus("PASS", "Fit score queued");

  const applicationDetail = await poll(
    "Fit score completion",
    async () => {
      const [detail, latestFitScore] = await Promise.all([
        requestJson("Poll application detail", `/read-models/applications/${applicationId}`, {
          ...auth
        }),
        requestJson("Poll latest fit score", `/applications/${applicationId}/fit-score/latest`, {
          ...auth
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
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({ action: "invite_interview" })
    })
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
      consentAccepted: true,
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

  const completedSession = await requestJson("Complete public interview", `/interviews/public/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      locale: "tr-TR",
      completionReasonCode: "candidate_completed",
      transcriptSegments: [
        { speaker: "AI", text: "Hos geldiniz, hazirsaniz baslayalim." },
        {
          speaker: "CANDIDATE",
          text: "Hazirim. Son iki yilda vardiyali operasyon ekiplerinde calistim ve gunluk akislari raporlayarak yonettim."
        },
        { speaker: "AI", text: "Baski altinda nasil karar verirsiniz?" },
        {
          speaker: "CANDIDATE",
          text: "Onceliklendirme, kontrol listeleri ve ekip ici net is dagilimi ile ilerlerim. Hatalari azaltmak icin ikinci kontrol uygularim."
        }
      ]
    })
  });
  ensure(
    completedSession?.status === "COMPLETED",
    "Public interview did not complete",
    completedSession?.status ?? "unknown"
  );
  logStatus("PASS", "Public interview completed", completedSession.status);

  const reviewPack = await poll(
    "Interview review pack completion",
    async () => {
      const [reports, recommendation] = await Promise.all([
        requestJson("Poll report list", `/reports/applications/${applicationId}`, {
          ...auth
        }),
        requestJson("Poll latest recommendation", `/recommendations/applications/${applicationId}/latest`, {
          ...auth
        })
      ]);

      return { reports, recommendation };
    },
    (snapshot) =>
      Array.isArray(snapshot?.reports) &&
      snapshot.reports.length > 0 &&
      Boolean(snapshot?.recommendation?.id),
    // Report and recommendation generation can legitimately take longer under live providers.
    { attempts: 40, intervalMs: 2000 }
  );

  ensure(Array.isArray(reviewPack.reports) && reviewPack.reports.length > 0, "Report generation did not complete");
  ensure(reviewPack.recommendation?.id, "Recommendation generation did not complete");
  logStatus(
    "PASS",
    "Interview review pack completed",
    `${reviewPack.reports[0]?.id ?? "report"} | ${reviewPack.recommendation.id}`
  );

  const recommendationOutcome =
    reviewPack.recommendation?.recommendation ??
    reviewPack.recommendation?.rationaleJson?.recommendation?.recommendedOutcome ??
    null;
  const recommendationSummary =
    reviewPack.recommendation?.summaryText ??
    reviewPack.recommendation?.rationaleJson?.recommendation?.summary ??
    "";
  const recommendationAction =
    reviewPack.recommendation?.rationaleJson?.recommendation?.action ?? "";

  if (
    recommendationOutcome &&
    recommendationCopyLooksAligned(
      recommendationOutcome,
      recommendationSummary,
      recommendationAction
    )
  ) {
    logStatus("PASS", "Recommendation copy aligned", recommendationOutcome);
  } else if (recommendationOutcome) {
    addWarning(
      "Recommendation copy misaligned",
      `${recommendationOutcome} | ${recommendationSummary} | ${recommendationAction}`
    );
  }

  const latestReportId = reviewPack.reports[0]?.id ?? null;
  ensure(latestReportId, "Latest report id missing after review pack completion");

  const decisionResult = await requestJson("Record recruiter decision", `/applications/${applicationId}/decision`, {
    ...authenticatedJsonRequestOptions(pilot, pilot.tenantId, {
      method: "POST",
      body: JSON.stringify({
        decision: "advance",
        reasonCode: "advanced_by_recruiter",
        aiReportId: latestReportId,
        humanApprovedBy: pilot.userId
      })
    })
  });
  ensure(decisionResult?.applicationId === applicationId, "Decision response application mismatch");
  logStatus("PASS", "Recruiter decision recorded", decisionResult?.status ?? "advance");

  const finalApplicationDetail = await poll(
    "Application decision propagation",
    () =>
      requestJson("Final application detail", `/read-models/applications/${applicationId}`, {
        ...auth
      }),
    (detail) => {
      const decisionRecorded = detail?.summary?.humanDecision === "advance";
      const stageAdvanced = detail?.summary?.stage === "HIRING_MANAGER_REVIEW";
      const approvalLogged = Array.isArray(detail?.governance?.humanApprovals) && detail.governance.humanApprovals.length > 0;
      const notificationLogged =
        Array.isArray(detail?.governance?.notificationDeliveries) &&
        detail.governance.notificationDeliveries.some(
          (delivery) =>
            delivery?.eventType === "application.decision_recorded" ||
            delivery?.templateKey === "application_advanced_v1"
        );

      return Boolean(decisionRecorded && stageAdvanced && approvalLogged && notificationLogged);
    },
    { attempts: 20, intervalMs: 2000 }
  );

  ensure(
    Array.isArray(finalApplicationDetail?.governance?.notificationDeliveries),
    "Application detail governance notification list missing"
  );
  ensure(
    Array.isArray(finalApplicationDetail?.governance?.humanApprovals),
    "Application detail human approval list missing"
  );
  ensure(
    (finalApplicationDetail?.interview?.latestSession?.transcript?.segmentCount ?? 0) > 0,
    "Application detail transcript evidence missing after interview completion"
  );
  ensure(
    finalApplicationDetail?.summary?.humanDecision === "advance",
    "Application detail human decision missing after recruiter decision"
  );
  ensure(
    finalApplicationDetail?.summary?.stage === "HIRING_MANAGER_REVIEW",
    "Application detail stage did not advance after recruiter decision"
  );
  logStatus(
    "PASS",
    "Application dossier governance loaded",
    `decision=${finalApplicationDetail.summary.humanDecision}, notifications=${finalApplicationDetail.governance.notificationDeliveries.length}, approvals=${finalApplicationDetail.governance.humanApprovals.length}, transcriptSegments=${finalApplicationDetail.interview.latestSession.transcript.segmentCount}`
  );

  if (finalApplicationDetail.governance.notificationDeliveries.length === 0) {
    addWarning(
      "Application communication log empty",
      "Invite or decision notifications are not yet visible in the dossier."
    );
  }

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
