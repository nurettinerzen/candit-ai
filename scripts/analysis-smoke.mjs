#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { BillingGrantSource, BillingQuotaKey, PrismaClient } = apiRequire("@prisma/client");

const API_BASE_URL = stripTrailingSlash(process.env.CANDIT_API_BASE_URL ?? "http://localhost:4000/v1");
const WEB_BASE_URL = stripTrailingSlash(process.env.CANDIT_WEB_BASE_URL ?? "http://localhost:3000");
const SMOKE_EMAIL = (process.env.CANDIT_SMOKE_EMAIL ?? "analysis-smoke@example.com").trim().toLowerCase();
const SMOKE_PASSWORD = process.env.CANDIT_SMOKE_PASSWORD ?? "Analysis123!";
const SMOKE_TENANT_ID = (process.env.CANDIT_SMOKE_TENANT_ID ?? "").trim() || null;
const SMOKE_EXISTING_JOB_ID = (process.env.CANDIT_SMOKE_EXISTING_JOB_ID ?? "").trim() || null;
const SMOKE_COMPANY = process.env.CANDIT_SMOKE_COMPANY ?? "Candit Analysis Smoke";
const SMOKE_FULL_NAME = process.env.CANDIT_SMOKE_FULL_NAME ?? "Analysis Smoke";
const SMOKE_SCENARIO_KEYS = (process.env.CANDIT_SMOKE_SCENARIO_KEYS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const SMOKE_ACTIVE_JOB_QUOTA = Number(process.env.CANDIT_SMOKE_ACTIVE_JOB_QUOTA ?? "1000");
const SMOKE_CANDIDATE_QUOTA = Number(process.env.CANDIT_SMOKE_CANDIDATE_QUOTA ?? "5000000");
const SMOKE_AI_INTERVIEW_QUOTA = Number(process.env.CANDIT_SMOKE_AI_INTERVIEW_QUOTA ?? "100000");
const RUN_STAMP = buildRunStamp();
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "smoke");
const ARTIFACT_JSON_PATH = path.join(ARTIFACT_DIR, `analysis-smoke-${RUN_STAMP}.json`);
const ARTIFACT_MD_PATH = path.join(ARTIFACT_DIR, `analysis-smoke-${RUN_STAMP}.md`);
const prisma = new PrismaClient();

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function buildRunStamp() {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0")
  ];
  return parts.join("");
}

function logStatus(kind, label, detail) {
  console.log(`${kind} ${label}`);
  if (detail) {
    console.log(`    ${detail}`);
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

async function request(label, url, options = {}) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
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
        const error = new Error(`${label} failed (${response.status})`);
        error.status = response.status;
        error.detail = data;

        const retriableStatus = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
        if (retriableStatus && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
          continue;
        }

        throw error;
      }

      return {
        status: response.status,
        data
      };
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }

  throw new Error(`${label} failed`);
}

async function requestJson(label, pathName, options = {}) {
  const response = await request(label, `${API_BASE_URL}${pathName}`, options);
  return response.data;
}

function positiveInt(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

async function ensureSmokeQuotaGrant(tenantId) {
  const account = await prisma.tenantBillingAccount.findUnique({
    where: { tenantId },
    include: {
      quotaGrants: {
        where: {
          quotaKey: {
            in: [
              BillingQuotaKey.ACTIVE_JOBS,
              BillingQuotaKey.CANDIDATE_PROCESSING,
              BillingQuotaKey.AI_INTERVIEWS
            ]
          }
        }
      }
    }
  });

  if (!account) {
    return {
      applied: false,
      reason: "billing_account_missing"
    };
  }

  const desiredByQuota = new Map([
    [BillingQuotaKey.ACTIVE_JOBS, positiveInt(SMOKE_ACTIVE_JOB_QUOTA, 1000)],
    [BillingQuotaKey.CANDIDATE_PROCESSING, positiveInt(SMOKE_CANDIDATE_QUOTA, 5000000)],
    [BillingQuotaKey.AI_INTERVIEWS, positiveInt(SMOKE_AI_INTERVIEW_QUOTA, 100000)]
  ]);

  const grantsToCreate = [];
  for (const [quotaKey, desiredQuantity] of desiredByQuota.entries()) {
    const remaining = account.quotaGrants
      .filter((grant) => grant.quotaKey === quotaKey)
      .reduce((sum, grant) => sum + Math.max(0, grant.quantity - grant.consumedQuantity), 0);
    const delta = desiredQuantity - remaining;
    if (delta > 0) {
      grantsToCreate.push({
        tenantId,
        accountId: account.id,
        quotaKey,
        source: BillingGrantSource.MANUAL,
        label: "Smoke automation grant",
        quantity: delta,
        createdBy: "system:analysis-smoke",
        metadataJson: {
          smokeScript: true,
          runStamp: RUN_STAMP
        }
      });
    }
  }

  if (grantsToCreate.length === 0) {
    return {
      applied: false,
      reason: "already_sufficient"
    };
  }

  await prisma.billingQuotaGrant.createMany({
    data: grantsToCreate
  });

  return {
    applied: true,
    grants: grantsToCreate.map((item) => ({
      quotaKey: item.quotaKey,
      quantity: item.quantity
    }))
  };
}

function parseTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function poll(label, callback, predicate, options = {}) {
  const attempts = options.attempts ?? 30;
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

  throw new Error(`${label} timed out after ${attempts} attempts`);
}

async function waitForTaskRun(token, tenantId, taskRunId, label) {
  return poll(
    label,
    () => requestJson("Poll task run", `/ai/task-runs/${taskRunId}`, {
      headers: authHeaders(token, tenantId)
    }),
    (detail) => {
      const status = detail?.status;
      return Boolean(status && !["PENDING", "QUEUED", "RUNNING"].includes(status));
    },
    { attempts: 50, intervalMs: 2000 }
  );
}

async function waitForFreshFitScore(token, tenantId, applicationId, previousFitScore, triggerTimestamp, label) {
  const previousId = previousFitScore?.id ?? null;
  const previousCreatedAt = parseTimestamp(previousFitScore?.createdAt);

  return poll(
    label,
    () => requestJson("Poll fit score", `/applications/${applicationId}/fit-score/latest`, {
      headers: authHeaders(token, tenantId)
    }),
    (detail) => {
      if (!detail?.id) {
        return false;
      }

      const createdAt = parseTimestamp(detail.createdAt);
      if (previousId && detail.id !== previousId) {
        return true;
      }

      if (createdAt !== null && createdAt >= triggerTimestamp) {
        return true;
      }

      if (previousCreatedAt !== null && createdAt !== null && createdAt > previousCreatedAt) {
        return true;
      }

      return !previousId;
    },
    { attempts: 50, intervalMs: 2000 }
  );
}

function authHeaders(token, tenantId, contentType = null) {
  const headers = {
    authorization: `Bearer ${token}`,
    "x-tenant-id": tenantId
  };

  if (contentType) {
    headers["content-type"] = contentType;
  }

  return headers;
}

function jsonHeaders(token, tenantId) {
  return authHeaders(token, tenantId, "application/json");
}

function toBulletList(items) {
  return (items ?? [])
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => `- ${item}`)
    .join("\n");
}

function listOrEmpty(items) {
  const cleaned = (items ?? []).filter((item) => typeof item === "string" && item.trim().length > 0);
  return cleaned.length > 0 ? cleaned : ["(bos)"];
}

function firstLine(items) {
  const cleaned = listOrEmpty(items);
  return cleaned[0];
}

function categoryMap(subScores) {
  const categories = Array.isArray(subScores?.categories) ? subScores.categories : [];
  return categories.reduce((acc, item) => {
    if (!item || typeof item !== "object") {
      return acc;
    }

    const key = typeof item.key === "string" ? item.key : null;
    if (!key) {
      return acc;
    }

    acc[key] = {
      key,
      label: typeof item.label === "string" ? item.label : key,
      weight: typeof item.weight === "number" ? item.weight : null,
      score: typeof item.score === "number" ? item.score : Number(item.score ?? 0),
      reasoning: typeof item.reasoning === "string" ? item.reasoning : "",
      strengths: Array.isArray(item.strengths) ? item.strengths : [],
      risks: Array.isArray(item.risks) ? item.risks : []
    };
    return acc;
  }, {});
}

function weightedAverageFromCategories(categories) {
  const values = Object.values(categories);
  if (values.length === 0) {
    return null;
  }

  const weighted = values.filter((item) => typeof item.weight === "number");
  if (weighted.length === values.length) {
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight > 0) {
      return Math.round(weighted.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
    }
  }

  return Math.round(values.reduce((sum, item) => sum + item.score, 0) / values.length);
}

function scoreForCategory(categories, pattern) {
  const entry = Object.values(categories).find((item) => pattern.test(normalizeText(`${item.key} ${item.label}`)));
  return entry?.score ?? null;
}

function outputJsonOf(taskRun) {
  const output = taskRun?.outputJson;
  return output && typeof output === "object" ? output : {};
}

function screeningSummary(taskRun) {
  const output = outputJsonOf(taskRun);
  const sections = output.sections && typeof output.sections === "object"
    ? output.sections
    : output;
  const recommendation = sections.recommendation ?? output.recommendation ?? {};
  const uncertainty = output.uncertainty ?? {};
  const support = output.screeningSupport ?? output.additional?.screeningSupport ?? {};
  const flags = Array.isArray(sections.flags)
    ? sections.flags.map((flag) => {
        if (typeof flag === "string") {
          return flag;
        }

        if (flag && typeof flag === "object") {
          const code = typeof flag.code === "string" ? flag.code : "FLAG";
          const note = typeof flag.note === "string" ? flag.note : JSON.stringify(flag);
          return `${code}: ${note}`;
        }

        return String(flag);
      })
    : [];

  return {
    status: taskRun?.status ?? null,
    providerKey: output.provider?.key ?? output.providerKey ?? null,
    modelKey: output.provider?.model ?? output.modelKey ?? null,
    recommendedOutcome: recommendation.recommendedOutcome ?? null,
    summary: recommendation.summary ?? null,
    action: recommendation.action ?? null,
    confidence: typeof uncertainty.confidence === "number" ? uncertainty.confidence : null,
    facts: Array.isArray(sections.facts) ? sections.facts : [],
    interpretation: Array.isArray(sections.interpretation) ? sections.interpretation : [],
    flags,
    missingInformation: Array.isArray(sections.missingInformation) ? sections.missingInformation : [],
    evidenceLinks: Array.isArray(output.evidenceLinks) ? output.evidenceLinks : [],
    strengthSignals: Array.isArray(support.strengths) ? support.strengths : [],
    riskSignals: Array.isArray(support.risks) ? support.risks : []
  };
}

function fitSummary(fitScore) {
  const categories = categoryMap(fitScore?.subScores);
  const categoryWeightedAverage = weightedAverageFromCategories(categories);
  const overallScore = typeof fitScore?.overallScore === "number" ? fitScore.overallScore : null;

  return {
    overallScore,
    confidence: typeof fitScore?.confidence === "number" ? fitScore.confidence : null,
    strengths: Array.isArray(fitScore?.strengths) ? fitScore.strengths : [],
    risks: Array.isArray(fitScore?.risks) ? fitScore.risks : [],
    missingInformation: Array.isArray(fitScore?.missingInfo) ? fitScore.missingInfo : [],
    reasoning: typeof fitScore?.reasoning === "string" ? fitScore.reasoning : "",
    categories,
    categoryWeightedAverage,
    consistencyGap:
      overallScore !== null && categoryWeightedAverage !== null
        ? Math.abs(overallScore - categoryWeightedAverage)
        : null
  };
}

function buildCvText(input) {
  return [
    `Ad Soyad: ${input.fullName}`,
    `E-posta: ${input.email}`,
    `Telefon: ${input.phone}`,
    `Lokasyon: ${input.location}`,
    input.workPreference ? `Calisma Tercihi: ${input.workPreference}` : null,
    "",
    "Profil Ozeti",
    input.summary,
    "",
    "Deneyim",
    ...input.experience,
    "",
    "Beceriler",
    input.skills.join(", "),
    "",
    "Egitim",
    input.education,
    input.certifications?.length ? "" : null,
    input.certifications?.length ? "Sertifikalar" : null,
    input.certifications?.length ? input.certifications.join(", ") : null,
    input.notes?.length ? "" : null,
    input.notes?.length ? "Ek Notlar" : null,
    ...(input.notes ?? [])
  ].filter(Boolean).join("\n");
}

const SCENARIOS = [
  {
    key: "strong_local_mid",
    label: "Guclu lokal eslesme",
    expectedFitBand: "high",
    expectedThemes: ["performance", "ga4", "google ads", "meta ads", "hibrit"],
    profile: {
      location: "Istanbul / Umraniye",
      workPreference: "Hibrit calisabilirim, haftada 4 gun ofis duzeni benim icin uygun.",
      summary: "5 yildir B2B SaaS ve teknoloji markalarinda lead generation odakli performance marketing rolleri ustleniyorum. Google Ads, Meta Ads, LinkedIn Ads, GA4, GTM ve CRM raporlamasinda aktif calistim.",
      experience: [
        "2022-2026 Senior Performance Marketing Specialist - LeadBridge SaaS / Istanbul",
        "Aylik 2.4M TL medya butcesi yonettim; SQL basina maliyeti %28 azalttim.",
        "GA4, GTM, HubSpot ve Looker Studio ile attribution ve funnel dashboard'lari kurdum.",
        "Pazarlama, tasarim ve satis ekipleri ile haftalik kampanya ritmi yonettim.",
        "2019-2022 Performance Marketing Executive - AdsCraft Agency / Istanbul",
        "B2B ve e-ticaret hesaplarinda Google Search, Meta ve remarketing kampanyalari optimize ettim."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "HubSpot", "Looker Studio", "Lead Generation"],
      education: "Bogazici Universitesi - Isletme Lisans",
      certifications: ["Google Ads Search Certification", "GA4 Certification"],
      notes: ["Cekmekoy ofisine duzenli ulasimim var."]
    }
  },
  {
    key: "strong_local_senior",
    label: "Guclu senior ancak hala hands-on",
    expectedFitBand: "high",
    expectedThemes: ["butce", "kampanya", "performance", "lead"],
    profile: {
      location: "Istanbul / Atasehir",
      workPreference: "Hibrit veya ofis duzeniyle calisabilirim.",
      summary: "8 yillik performance marketing gecmisine sahibim. Son 3 yilda ekip mentorlugu yaptim ama kampanya optimizasyonunu dogrudan ben de surduruyorum.",
      experience: [
        "2021-2026 Growth Marketing Lead - Finpulse / Istanbul",
        "Google, Meta ve programmatic tarafta aylik 4M TL butce yonettim.",
        "Landing page testleri ve CRM nurtuting akislarini satis ekibiyle beraber kurguladim.",
        "2018-2021 Senior Performance Marketing Specialist - ScaleHub / Istanbul",
        "B2B lead generation kampanyalarinda CAC'i %22 dusurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "GA4", "GTM", "LinkedIn Ads", "A/B Testing", "CRM"],
      education: "Yildiz Teknik Universitesi - Endustri Muhendisligi",
      certifications: ["Google Analytics Individual Qualification"]
    }
  },
  {
    key: "junior_growth_intern",
    label: "Junior aday",
    expectedFitBand: "low",
    expectedThemes: ["staj", "junior", "deneyim"],
    profile: {
      location: "Istanbul / Kadikoy",
      workPreference: "Ofise gelebilirim.",
      summary: "1 yillik staj ve junior seviye growth marketing deneyimim var. Kampanya setup'larini destekledim ama butce yonetimi ve strateji tarafinda sinirli tecrubem bulunuyor.",
      experience: [
        "2025-2026 Growth Marketing Intern - AppNest / Istanbul",
        "Meta Ads panelinde kreatif testleri ve raporlamayi destekledim.",
        "2024-2025 Digital Marketing Intern - Nova Academy / Istanbul",
        "Blog, e-posta ve temel reklam paneli islemlerine yardimci oldum."
      ],
      skills: ["Meta Ads", "Canva", "Excel", "GA4 temel raporlama"],
      education: "Marmara Universitesi - Iletisim Fakultesi"
    }
  },
  {
    key: "irrelevant_lawyer",
    label: "Ilgisiz meslek gecmisi",
    expectedFitBand: "low",
    expectedThemes: ["avukat", "pazarlama deneyimi yok", "uyumsuz"],
    profile: {
      location: "Hakkari",
      workPreference: "Yer degistirmeyi planlamiyorum.",
      summary: "7 yildir sirketler hukuku ve sozlesme yonetimi alaninda calisiyorum. Pazarlama deneyimim bulunmuyor.",
      experience: [
        "2019-2026 Kurumsal Avukat - Kuzey Hukuk / Hakkari",
        "Sirket sozlesmeleri, dava takibi ve uyum sureclerini yuruttum.",
        "2016-2019 Avukat - Serbest / Van"
      ],
      skills: ["Sozlesme yonetimi", "Hukuki analiz", "Muzakere", "Uyum surecleri"],
      education: "Ankara Universitesi - Hukuk Fakultesi"
    }
  },
  {
    key: "sales_crm_adjacent",
    label: "Satis ve CRM tarafindan yaklasan aday",
    expectedFitBand: "medium",
    expectedThemes: ["crm", "satis", "performance ile kismi bag"],
    profile: {
      location: "Istanbul / Basaksehir",
      workPreference: "Hibrit calisabilirim.",
      summary: "B2B satis operasyonlari ve CRM otomasyonu tarafinda calistim. Reklam paneli yonetimim sinirli ama lead kalitesi ve pipeline analizi konularinda gucluyum.",
      experience: [
        "2021-2026 CRM & Revenue Operations Specialist - Softgate / Istanbul",
        "HubSpot otomasyonlari ve lead scoring modeli kurdum.",
        "2018-2021 Sales Operations Analyst - Dataline / Istanbul",
        "Kampanya kaynakli lead'lerin satisa donusum raporlamasini hazirladim."
      ],
      skills: ["HubSpot", "CRM", "Lead Scoring", "Looker Studio", "Excel"],
      education: "Istanbul Universitesi - Iktisat"
    }
  },
  {
    key: "brand_marketer",
    label: "Brand marketing agirlikli aday",
    expectedFitBand: "medium",
    expectedThemes: ["brand", "performance eksigi", "hands-on paid media"],
    profile: {
      location: "Istanbul / Besiktas",
      workPreference: "Hibrit calisabilirim.",
      summary: "7 yildir brand marketing ve iletiisim planlama tarafinda calisiyorum. Performance kampanyalari ile temas ettim ancak gunluk optimizasyon deneyimim sinirli.",
      experience: [
        "2022-2026 Brand Marketing Manager - UrbanBeverage / Istanbul",
        "360 kampanya planlari ve kreatif ajans yonetimi yaptim.",
        "2018-2022 Marketing Communications Specialist - Northstar / Istanbul",
        "Marka lansmanlari ve etkinlik planlamasi yuruttum."
      ],
      skills: ["Brand Strategy", "Campaign Planning", "Agency Management", "Brief Writing"],
      education: "Galatasaray Universitesi - Iletisim"
    }
  },
  {
    key: "director_overqualified",
    label: "Direktor seviyesi ve yonetim agirlikli",
    expectedFitBand: "medium",
    expectedThemes: ["direktor", "yonetim", "hands-on riski"],
    profile: {
      location: "Istanbul / Etiler",
      workPreference: "Hibrit olabilir ama daha cok liderlik rolu ariyorum.",
      summary: "15 yillik pazarlama kariyerimde son 8 yilimi direktor ve ekip lideri olarak gecirdim. Strateji, butce ve ekip yonetimi guclu tarafim; gunluk reklam paneli optimizasyonuna daha az giriyorum.",
      experience: [
        "2020-2026 Marketing Director - FinOrbit / Istanbul",
        "12 kisilik ekibi ve tum kanal butcesini yonettim.",
        "2016-2020 Head of Growth - ShopWave / Istanbul",
        "Kanal stratejisini kurdum, ekip KPI'larini yonettim."
      ],
      skills: ["Leadership", "Budget Planning", "Team Management", "Growth Strategy", "Board Reporting"],
      education: "Koc Universitesi - Isletme Yuksek Lisans"
    }
  },
  {
    key: "remote_only_izmir",
    label: "Uzaktan tercih eden guclu aday",
    expectedFitBand: "medium",
    expectedThemes: ["uzaktan", "remote", "hibrit uyumsuzlugu"],
    profile: {
      location: "Izmir / Karsiyaka",
      workPreference: "Sadece uzaktan roller degerlendiriyorum.",
      summary: "8 yillik performance marketing deneyimim var. Teknik uyumum yuksek ancak tam zamanli remote roller disinda firsat degerlendirmiyorum.",
      experience: [
        "2021-2026 Freelance Performance Marketing Consultant - Izmir",
        "SaaS ve e-ticaret musterilerinde Google, Meta ve LinkedIn kampanyalari yonettim.",
        "2017-2021 Senior Performance Marketing Specialist - Wavecommerce / Izmir",
        "Aylik 1.8M TL butce optimize ettim."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "Looker Studio"],
      education: "Dokuz Eylul Universitesi - Isletme"
    }
  },
  {
    key: "same_city_far_district",
    label: "Ayni sehir farkli ilce",
    expectedFitBand: "high",
    expectedThemes: ["halkali", "ulasim", "ayni il"],
    profile: {
      location: "Istanbul / Halkali",
      workPreference: "Hibrit duzende calisabilirim.",
      summary: "6 yillik performance marketing tecrubem var. Rolun teknik ihtiyacina uyuyorum; ofis ulasimi uzun surebilir ama duzenli katilim saglayabilirim.",
      experience: [
        "2022-2026 Performance Marketing Manager - B2B Cloud Labs / Istanbul",
        "Lead generation ve conversion optimization odakli kampanyalar yonettim.",
        "2019-2022 Digital Acquisition Specialist - PayBridge / Istanbul",
        "Google Search, Meta ve retargeting kampanyalari yuruttum."
      ],
      skills: ["Google Ads", "Meta Ads", "GA4", "GTM", "Hotjar", "Lead Generation"],
      education: "Istanbul Teknik Universitesi - Isletme Muhendisligi",
      notes: ["Halkali'dan Cekmekoy'e duzenli gidip gelebilirim."]
    }
  },
  {
    key: "different_city_no_relocation",
    label: "Farkli sehir ve tasinma esnekligi yok",
    expectedFitBand: "low",
    expectedThemes: ["farkli il", "tasinma", "ulasim"],
    profile: {
      location: "Hakkari",
      workPreference: "Yer degistirmeyi dusunmuyorum.",
      summary: "Teknik olarak guclu bir performance marketing gecmisim var ancak su an Hakkari'den calisiyorum ve tasinma planim bulunmuyor.",
      experience: [
        "2021-2026 Performance Marketing Specialist - Remote eCommerce Studio / Hakkari",
        "Google ve Meta tarafinda ROAS optimizasyonu yaptim.",
        "2018-2021 Paid Media Executive - Eastern Growth / Van",
        "Arama ve social kampanyalar yonettim."
      ],
      skills: ["Google Ads", "Meta Ads", "GA4", "GTM", "Merchant Center"],
      education: "Dicle Universitesi - Isletme"
    }
  },
  {
    key: "crm_marketing_ops",
    label: "Marketing ops / lifecycle profili",
    expectedFitBand: "medium",
    expectedThemes: ["crm", "lifecycle", "paid media sinirli"],
    profile: {
      location: "Istanbul / Maltepe",
      workPreference: "Hibrit calisabilirim.",
      summary: "Lifecycle marketing, CRM otomasyonu ve lead nurture tarafinda gucluyum. Paid media yonetimi temel seviyede.",
      experience: [
        "2022-2026 Marketing Operations Manager - SaaSFlow / Istanbul",
        "HubSpot lifecycle akislari ve lead scoring yapisi kurdum.",
        "2019-2022 CRM Specialist - B2BWorks / Istanbul",
        "E-posta, webinar ve nurture programlarini yonettim."
      ],
      skills: ["HubSpot", "Lifecycle Marketing", "GA4", "Looker Studio", "SQL basic"],
      education: "Marmara Universitesi - Endustri Muhendisligi"
    }
  },
  {
    key: "ecommerce_perf_cekmekoy",
    label: "Lokasyon avantajli guclu aday",
    expectedFitBand: "high",
    expectedThemes: ["cekmekoy", "performans", "ga4"],
    profile: {
      location: "Istanbul / Cekmekoy",
      workPreference: "Hibrit veya ofis calisabilirim.",
      summary: "5 yildir e-ticaret ve lead generation performance marketing projelerinde calisiyorum. Ofis lokasyonuna yuruyus mesafesindeyim.",
      experience: [
        "2021-2026 Senior Performance Marketing Specialist - RapidCart / Istanbul",
        "Google Shopping, Search, Meta ve CAPI kurulumlari uzerinde calistim.",
        "2018-2021 Digital Marketing Executive - CommerceOne / Istanbul",
        "GA4, GTM ve kreatif testleriyle ROAS iyilestirdim."
      ],
      skills: ["Google Ads", "Meta Ads", "GA4", "GTM", "Merchant Center", "CAPI"],
      education: "Yeditepe Universitesi - Pazarlama",
      notes: ["Cekmekoy lokasyonundayim."]
    }
  },
  {
    key: "freelancer_with_gaps",
    label: "Freelance deneyimli ama kopuk gecmis",
    expectedFitBand: "medium",
    expectedThemes: ["freelance", "bosluk", "belirsizlik"],
    profile: {
      location: "Istanbul / Kartal",
      workPreference: "Hibrit calisabilirim.",
      summary: "Freelance tarafta performans reklamlari yonettim. Son yillarda proje bazli calistigim icin sureklilik ve ekip ici ritim tarafinda soru isareti olabilir.",
      experience: [
        "2023-2026 Freelance Paid Media Consultant - Istanbul",
        "KOBI ve D2C musteriler icin Google ve Meta kampanyalari yonettim.",
        "2020-2021 Digital Marketing Specialist - Sparkly / Istanbul",
        "GA4 raporlamasi ve paid social optimizasyonu yaptim."
      ],
      skills: ["Google Ads", "Meta Ads", "GA4", "Excel", "Client Reporting"],
      education: "Anadolu Universitesi - Isletme"
    }
  },
  {
    key: "agency_expert_besiktas",
    label: "Ajans kokenli guclu aday",
    expectedFitBand: "high",
    expectedThemes: ["ajans", "google ads", "meta", "butce"],
    profile: {
      location: "Istanbul / Besiktas",
      workPreference: "Hibrit calisabilirim.",
      summary: "Ajans tarafinda 6 yil boyunca B2B ve teknoloji musterilerinde paid media yonettim. Hizli test etme ve kampanya optimizasyonu benim guclu tarafim.",
      experience: [
        "2021-2026 Senior Paid Media Specialist - Rocket Agency / Istanbul",
        "B2B SaaS musterilerinde LinkedIn, Google ve Meta kampanyalari yonettim.",
        "2018-2021 Paid Media Executive - GrowthPort / Istanbul",
        "Aylik 1.2M TL reklam butcesi optimize ettim."
      ],
      skills: ["LinkedIn Ads", "Google Ads", "Meta Ads", "GA4", "GTM", "Looker Studio"],
      education: "Bahcesehir Universitesi - Reklamcilik"
    }
  },
  {
    key: "data_analyst_adjacent",
    label: "Analitik guclu ama reklam eli zayif",
    expectedFitBand: "medium",
    expectedThemes: ["analitik", "ga4", "kampanya yonetimi sinirli"],
    profile: {
      location: "Istanbul / Uskudar",
      workPreference: "Hibrit calisabilirim.",
      summary: "Pazarlama analitigi, dashboard ve attribution tarafinda gucluyum. Kampanya paneli yonetimi ise daha destekleyici seviyede.",
      experience: [
        "2022-2026 Marketing Analytics Analyst - SignalIQ / Istanbul",
        "GA4, BigQuery ve Looker Studio ile funnel raporlari hazirladim.",
        "2019-2022 Data Analyst - Finlite / Istanbul",
        "Paid media performans raporlarini olusturdum ancak butce yonetimi yapmadim."
      ],
      skills: ["GA4", "Looker Studio", "BigQuery", "SQL", "Attribution"],
      education: "Bogazici Universitesi - Istatistik"
    }
  },
  {
    key: "seo_specialist",
    label: "SEO agirlikli aday",
    expectedFitBand: "medium",
    expectedThemes: ["seo", "paid media eksigi", "performance'e kismi yakinlik"],
    profile: {
      location: "Istanbul / Kagithane",
      workPreference: "Hibrit calisabilirim.",
      summary: "SEO, icerik ve organic growth tarafinda gucluyum. Ucretli reklam kampanyasi yonetimi ikincil deneyimim.",
      experience: [
        "2021-2026 SEO Manager - SearchPilot / Istanbul",
        "Teknik SEO ve content roadmap yonettim.",
        "2018-2021 Digital Growth Specialist - Northorganic / Istanbul",
        "Temel search ads kampanyalarini destekledim."
      ],
      skills: ["SEO", "Search Console", "GA4", "Content Strategy", "Keyword Research"],
      education: "Istanbul Universitesi - Gazetecilik"
    }
  },
  {
    key: "content_marketer",
    label: "Icerik pazarlamasi aday",
    expectedFitBand: "low",
    expectedThemes: ["icerik", "paid media eksigi", "uyum dusuk"],
    profile: {
      location: "Istanbul / Sisli",
      workPreference: "Hibrit olabilir.",
      summary: "Icerik stratejisi ve editorial planning tarafinda 6 yillik deneyimim var. Paid media performans yönetimi ana uzmanligim degil.",
      experience: [
        "2020-2026 Content Marketing Manager - StoryWorks / Istanbul",
        "Blog, webinar ve e-kitap funnel'lari kurdum.",
        "2017-2020 Content Specialist - BrandLoom / Istanbul",
        "Yayin takvimi ve e-posta kampanya metinleri hazirladim."
      ],
      skills: ["Content Strategy", "Copywriting", "SEO temel", "Email Marketing"],
      education: "Istanbul Bilgi Universitesi - Medya ve Iletisim"
    }
  },
  {
    key: "returnship_relevant",
    label: "Ara vermis ama ilgili aday",
    expectedFitBand: "medium",
    expectedThemes: ["ara", "guncellik", "ilgili deneyim"],
    profile: {
      location: "Istanbul / Sancaktepe",
      workPreference: "Hibrit calisabilirim.",
      summary: "2017-2022 arasinda performance marketing alaninda calistim. Son iki yillik kariyer aramdan sonra role geri donmek istiyorum.",
      experience: [
        "2019-2022 Performance Marketing Specialist - Appcommerce / Istanbul",
        "Google ve Meta kampanyalari, GA4 ve GTM kurulumlarini yonettim.",
        "2017-2019 Paid Media Executive - PixelRoute / Istanbul",
        "Lead generation kampanyalari ve raporlamayi surdurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "GA4", "GTM", "Lead Generation"],
      education: "Sakarya Universitesi - Isletme",
      notes: ["2023-2025 arasinda aile nedeni ile kariyer arasi verdim."]
    }
  },
  {
    key: "ankara_relocation_open",
    label: "Farkli sehir ama tasinmaya acik aday",
    expectedFitBand: "high",
    expectedThemes: ["ankara", "tasinabilirim", "hibrit"],
    profile: {
      location: "Ankara / Cankaya",
      workPreference: "Istanbul'a tasinabilirim, hibrit rol benim icin uygundur.",
      summary: "7 yillik B2B performance marketing deneyimim var. Istanbul'a tasinmaya acigim ve hibrit duzende calisabilirim.",
      experience: [
        "2021-2026 Senior Performance Marketing Specialist - LedgerAI / Ankara",
        "Google, Meta ve LinkedIn Ads ile lead generation kampanyalari yonettim.",
        "2018-2021 Performance Marketing Executive - DataForge / Ankara",
        "GA4, GTM ve CRM entegrasyonlari uzerinde calistim."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "HubSpot"],
      education: "TED Universitesi - Isletme"
    }
  },
  {
    key: "agency_manager_hands_on",
    label: "Manager title var ama hala operasyonel",
    expectedFitBand: "high",
    expectedThemes: ["manager", "hands-on", "kampanya"],
    profile: {
      location: "Istanbul / Pendik",
      workPreference: "Hibrit calisabilirim.",
      summary: "Title olarak manager olsam da kampanya setup, optimizasyon ve raporlama tarafinda aktif ellerim kirlenmeye devam ediyor.",
      experience: [
        "2022-2026 Performance Marketing Manager - Launchers Agency / Istanbul",
        "3 kisilik ekibi koordine ederken Google ve Meta hesaplarini bizzat optimize ediyorum.",
        "2018-2022 Senior Paid Media Specialist - Reachlab / Istanbul",
        "B2B lead generation kampanyalarinda CPL ve demo maliyetini dusurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "Looker Studio"],
      education: "Istanbul Medeniyet Universitesi - Isletme"
    }
  },
  {
    key: "same_city_near_district_strong",
    label: "Ayni sehir yakin ilce ve guclu aday",
    expectedFitBand: "high",
    expectedThemes: ["umraniye", "ulasim", "hibrit"],
    profile: {
      location: "Istanbul / Umraniye",
      workPreference: "Hibrit duzende haftada 4 gun ofise gelebilirim.",
      summary: "6 yillik B2B performance marketing deneyimim var. Cekmekoy ofisine duzenli ulasim benim icin yonetilebilir durumda.",
      experience: [
        "2021-2026 Performance Marketing Specialist - FunnelGrid / Istanbul",
        "Google, Meta ve LinkedIn Ads tarafinda lead generation kampanyalari yonettim.",
        "2018-2021 Paid Media Executive - Leadship / Istanbul",
        "GA4, GTM ve dashboard raporlamalari kurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "Looker Studio"],
      education: "Yildiz Teknik Universitesi - Isletme"
    }
  },
  {
    key: "same_city_same_side_strong",
    label: "Ayni sehir ayni yakada guclu aday",
    expectedFitBand: "high",
    expectedThemes: ["sancaktepe", "ulasim", "lead generation"],
    profile: {
      location: "Istanbul / Sancaktepe",
      workPreference: "Hibrit veya ofis duzenine uygunum.",
      summary: "7 yillik paid media ve B2B demand generation tecrubem var. Anadolu yakasinda yasiyorum ve Cekmekoy ulasimi benim icin rahat.",
      experience: [
        "2020-2026 Senior Performance Marketing Specialist - DemandPilot / Istanbul",
        "Google Search, Meta ve LinkedIn Ads kampanyalari ile MQL hacmini buyuttum.",
        "2017-2020 Digital Acquisition Specialist - GrowthBridge / Istanbul",
        "Aylik 1.5M TL butce optimize ettim."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "HubSpot"],
      education: "Marmara Universitesi - Isletme"
    }
  },
  {
    key: "same_city_far_district_no_signal",
    label: "Ayni sehir uzak ilce ama ulasim sinyali yok",
    expectedFitBand: "medium",
    expectedThemes: ["halkali", "ulasim", "teyit"],
    profile: {
      location: "Istanbul / Halkali",
      workPreference: "Hibrit rol degerlendirebilirim.",
      summary: "6 yillik performance marketing tecrubem var. Teknik olarak role guclu uyuyorum ancak fiziksel ofis duzeni hakkinda ek konusmaya acigim.",
      experience: [
        "2021-2026 Senior Paid Media Specialist - DemandForge / Istanbul",
        "Google, Meta ve LinkedIn kampanyalarinda lead generation hedefleriyle calistim.",
        "2018-2021 Performance Marketing Executive - ScaleRoute / Istanbul",
        "GA4, GTM ve CRM raporlarini olusturdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "Looker Studio"],
      education: "Istanbul Universitesi - Isletme"
    }
  },
  {
    key: "same_city_far_district_remote_only",
    label: "Ayni sehir uzak ilce ve remote-only",
    expectedFitBand: "low",
    expectedThemes: ["halkali", "remote", "hibrit uyumsuzlugu"],
    profile: {
      location: "Istanbul / Halkali",
      workPreference: "Sadece uzaktan rollerle ilgileniyorum.",
      summary: "7 yillik paid media deneyimim var ancak su asamada tam zamanli remote disindaki firsatlara acik degilim.",
      experience: [
        "2020-2026 Freelance Performance Marketing Consultant - Istanbul",
        "B2B SaaS ve e-ticaret musterilerinde Google, Meta ve LinkedIn kampanyalari yonettim.",
        "2017-2020 Senior Paid Media Specialist - RocketMint / Istanbul",
        "GA4 ve GTM ile attribution altyapisi kurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "HubSpot"],
      education: "Kadir Has Universitesi - Reklamcilik"
    }
  },
  {
    key: "same_city_near_district_low_role",
    label: "Yakin ilce ama role uzak aday",
    expectedFitBand: "low",
    expectedThemes: ["icerik", "paid media eksigi", "lokasyon tek basina yetmez"],
    profile: {
      location: "Istanbul / Umraniye",
      workPreference: "Hibrit calisabilirim.",
      summary: "Icerik stratejisi ve editorial planning tarafinda 5 yillik deneyimim var. Paid media ve performance execution ana uzmanligim degil.",
      experience: [
        "2021-2026 Content Marketing Lead - StoryGrid / Istanbul",
        "Blog, webinar ve e-kitap funnel'lari kurguladim.",
        "2018-2021 Content Specialist - Bluepage / Istanbul",
        "Email nurture ve landing page metinleri hazirladim."
      ],
      skills: ["Content Strategy", "Copywriting", "SEO temel", "Email Marketing"],
      education: "Istanbul Bilgi Universitesi - Medya ve Iletisim"
    }
  },
  {
    key: "same_city_far_district_low_role",
    label: "Uzak ilce ve role uzak aday",
    expectedFitBand: "low",
    expectedThemes: ["halkali", "icerik", "uyum dusuk"],
    profile: {
      location: "Istanbul / Halkali",
      workPreference: "Hibrit olabilir.",
      summary: "Icerik pazarlamasi ve SEO tarafinda gucluyum. Paid media kampanya yonetimi ana uzmanligim degil ve ofis duzeni benim icin ikincil oncelik.",
      experience: [
        "2021-2026 Content Marketing Manager - StoryFlow / Istanbul",
        "Editorial takvim, webinar funnel ve nurture icerikleri yonettim.",
        "2018-2021 SEO & Content Specialist - SearchLeaf / Istanbul",
        "Organik trafik ve blog buyumesi odakli calistim."
      ],
      skills: ["Content Strategy", "SEO", "Copywriting", "GA4 temel"],
      education: "Yeditepe Universitesi - Halkla Iliskiler"
    }
  },
  {
    key: "bursa_relocation_open",
    label: "Farkli sehir ama tasinmaya acik guclu aday",
    expectedFitBand: "medium",
    expectedThemes: ["bursa", "tasinabilirim", "hibrit"],
    profile: {
      location: "Bursa",
      workPreference: "Istanbul'a tasinabilirim; hibrit rol benim icin uygundur.",
      summary: "7 yillik B2B performance marketing deneyimim var. Role teknik olarak guclu uyuyorum ve Istanbul'a tasinmaya acigim.",
      experience: [
        "2021-2026 Senior Performance Marketing Specialist - LeadMetric / Bursa",
        "Google, Meta ve LinkedIn ile lead generation kampanyalari yonettim.",
        "2018-2021 Paid Media Executive - Convertly / Bursa",
        "GA4, GTM ve CRM tarafinda aktif calistim."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "HubSpot"],
      education: "Uludag Universitesi - Isletme"
    }
  },
  {
    key: "bursa_no_relocation",
    label: "Farkli sehir ve tasinmaya kapali guclu aday",
    expectedFitBand: "low",
    expectedThemes: ["bursa", "tasinma yok", "hibrit zor"],
    profile: {
      location: "Bursa",
      workPreference: "Bulundugum sehirde kalmak istiyorum; tasinma dusunmuyorum.",
      summary: "Teknik olarak guclu bir performance marketing gecmisim var ancak Bursa disinda kalici bir ofis duzenine acik degilim.",
      experience: [
        "2021-2026 Performance Marketing Specialist - GrowthYard / Bursa",
        "Google, Meta ve LinkedIn kampanyalarinda lead generation yaptim.",
        "2018-2021 Paid Media Executive - DemandLine / Bursa",
        "GA4, GTM ve funnel dashboard'lari kurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "Looker Studio"],
      education: "Bursa Teknik Universitesi - Endustri Muhendisligi"
    }
  },
  {
    key: "foreign_relocation_open_strong",
    label: "Yurt disinda ama tasinmaya acik guclu aday",
    expectedFitBand: "medium",
    expectedThemes: ["yurt disi", "tasinabilirim", "lokasyon riski"],
    profile: {
      location: "Sofia / Bulgaria",
      workPreference: "Turkiye'ye veya Istanbul'a tasinabilirim.",
      summary: "6 yillik B2B paid media ve demand generation deneyimim var. Istanbul merkezli hibrit role tasinarak devam etmeye acigim.",
      experience: [
        "2021-2026 Senior Paid Media Specialist - PipelineFox / Sofia",
        "Google, Meta ve LinkedIn kampanyalariyla inbound demo hacmini buyuttum.",
        "2018-2021 Performance Marketing Executive - Trackly / Sofia",
        "GA4, GTM ve CRM entegrasyonlari kurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "HubSpot"],
      education: "Sofia University - Business Administration"
    }
  },
  {
    key: "foreign_remote_only_strong",
    label: "Yurt disinda ve remote-only guclu aday",
    expectedFitBand: "low",
    expectedThemes: ["yurt disi", "remote-only", "uyumsuz"],
    profile: {
      location: "Berlin / Germany",
      workPreference: "Yalnizca remote firsatlarla ilgileniyorum.",
      summary: "Paid media ve B2B growth tarafinda guclu bir profile sahibim ancak yalnizca uzaktan rollerle ilgileniyorum.",
      experience: [
        "2020-2026 Senior Performance Marketing Specialist - DemandOrbit / Berlin",
        "Google, Meta ve LinkedIn Ads kampanyalarinda demo cost optimizasyonu yaptim.",
        "2017-2020 Paid Media Executive - ScaleRocket / Berlin",
        "GA4, GTM ve Looker Studio dashboard'lari kurdum."
      ],
      skills: ["Google Ads", "Meta Ads", "LinkedIn Ads", "GA4", "GTM", "Looker Studio"],
      education: "Humboldt University - Economics"
    }
  }
];

const ACTIVE_SCENARIOS = SMOKE_SCENARIO_KEYS.length > 0
  ? SCENARIOS.filter((scenario) => SMOKE_SCENARIO_KEYS.includes(scenario.key))
  : SCENARIOS;

if (SMOKE_SCENARIO_KEYS.length > 0 && ACTIVE_SCENARIOS.length === 0) {
  throw new Error("No smoke scenarios matched CANDIT_SMOKE_SCENARIO_KEYS");
}

async function ensureSmokeUser() {
  if (SMOKE_TENANT_ID) {
    const login = await requestJson("Smoke login", "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: SMOKE_EMAIL,
        password: SMOKE_PASSWORD,
        tenantId: SMOKE_TENANT_ID
      })
    });

    logStatus("PASS", "Smoke user logged in", `${SMOKE_EMAIL} | tenant=${login?.user?.tenantId ?? SMOKE_TENANT_ID}`);
    return {
      created: false,
      token: login.accessToken,
      tenantId: login?.user?.tenantId ?? SMOKE_TENANT_ID,
      user: login?.user ?? null
    };
  }

  try {
    const signup = await requestJson("Smoke signup", "/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: SMOKE_COMPANY,
        fullName: SMOKE_FULL_NAME,
        email: SMOKE_EMAIL,
        password: SMOKE_PASSWORD
      })
    });

    logStatus("PASS", "Smoke user created", `${SMOKE_EMAIL} | tenant=${signup?.user?.tenantId ?? "unknown"}`);
    return {
      created: true,
      token: signup.accessToken,
      tenantId: signup?.user?.tenantId ?? null,
      user: signup?.user ?? null
    };
  } catch (error) {
    const detail = normalizeText(JSON.stringify(error.detail ?? ""));
    const duplicate =
      detail.includes("zaten bir hesap var")
      || detail.includes("already")
      || detail.includes("already exists")
      || detail.includes("tenantid_email");

    if (!duplicate) {
      throw error;
    }

    const login = await requestJson("Smoke login", "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: SMOKE_EMAIL,
        password: SMOKE_PASSWORD
      })
    });

    logStatus("PASS", "Smoke user logged in", `${SMOKE_EMAIL} | tenant=${login?.user?.tenantId ?? "unknown"}`);
    return {
      created: false,
      token: login.accessToken,
      tenantId: login?.user?.tenantId ?? null,
      user: login?.user ?? null
    };
  }
}

async function createMarketingJob(token, tenantId) {
  const payload = {
    title: `Performance Marketing Specialist Smoke ${RUN_STAMP.slice(-6)}`,
    roleFamily: "Marketing",
    department: "Pazarlama",
    locationText: "Istanbul / Cekmekoy",
    shiftType: "Hibrit (haftada 4 gun Cekmekoy ofis, 1 gun remote)",
    jdText: [
      "B2B SaaS lead generation odakli performance marketing roludur.",
      "Adayin Google Ads, Meta Ads, LinkedIn Ads, GA4 ve GTM uzerinde hands-on calismis olmasi beklenir.",
      "Rol tam zamanlidir ve haftada 4 gun Cekmekoy ofisten ekiplerle koordineli calismayi gerektirir.",
      "Bu nedenle remote-only tercih uygun degildir; hibrit ritimde duzenli fiziksel katilim beklenir."
    ].join(" "),
    requirements: [
      { key: "experience", value: "Performance marketing, paid search veya paid social alaninda en az 4 yil hands-on deneyim", required: true },
      { key: "lead_gen", value: "B2B lead generation veya demand generation kampanyasi deneyimi", required: true },
      { key: "analytics", value: "GA4, GTM ve attribution/raporlama deneyimi", required: true },
      { key: "budget", value: "Anlamli medya butcesi yonetimi ve optimizasyon deneyimi", required: true },
      { key: "hands_on", value: "Rol bireysel katkici yapidadir; salt yonetici profil tek basina yeterli degildir", required: true },
      { key: "location", value: "Rol hibrittir; aday haftada 4 gun Istanbul Cekmekoy ofisine duzenli ulasim saglayabilmelidir", required: true },
      { key: "work_model", value: "Remote-only tercih bu rol icin uygun degildir", required: true },
      { key: "communication", value: "Satis, tasarim ve urun ekipleri ile koordineli calisabilme", required: true },
      { key: "english", value: "Ingilizce reklam platformu ve dokuman takibi", required: false }
    ]
  };

  try {
    const created = await requestJson("Create smoke job", "/jobs", {
      method: "POST",
      headers: jsonHeaders(token, tenantId),
      body: JSON.stringify({
        ...payload,
        status: "PUBLISHED"
      })
    });

    logStatus("PASS", "Smoke job created", `${created.id} | ${created.title}`);
    return created;
  } catch (error) {
    const detail = normalizeText(JSON.stringify(error.detail ?? ""));
    const billingGuardrail = detail.includes("ucretsiz denemeyi daha once kullandi")
      || detail.includes("aktif ilan limiti doldu")
      || detail.includes("billing")
      || detail.includes("trial");

    if (!billingGuardrail) {
      throw error;
    }

    const created = await requestJson("Create draft smoke job", "/jobs", {
      method: "POST",
      headers: jsonHeaders(token, tenantId),
      body: JSON.stringify({
        ...payload,
        status: "DRAFT"
      })
    });

    logStatus("WARN", "Published smoke job blocked; draft created", `${created.id} | ${created.title}`);
    return created;
  }
}

async function loadExistingJobContext(token, tenantId, jobId) {
  const [jobs, applications] = await Promise.all([
    requestJson("List jobs", "/jobs?limit=100", {
      headers: authHeaders(token, tenantId)
    }),
    requestJson("List applications", `/applications?jobId=${encodeURIComponent(jobId)}`, {
      headers: authHeaders(token, tenantId)
    })
  ]);

  const job = Array.isArray(jobs) ? jobs.find((item) => item?.id === jobId) : null;
  if (!job) {
    throw new Error(`Existing smoke job not found: ${jobId}`);
  }

  if (!Array.isArray(applications) || applications.length === 0) {
    throw new Error(`Existing smoke job has no applications: ${jobId}`);
  }

  return { job, applications };
}

async function uploadCvFile(token, tenantId, candidateId, fileName, content) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([content], fileName, {
      type: "text/plain"
    })
  );

  return requestJson("Upload CV", `/candidates/${candidateId}/cv-files`, {
    method: "POST",
    headers: authHeaders(token, tenantId),
    body: formData
  });
}

async function processScenario(token, tenantId, job, scenario, index) {
  const fullName = `Smoke ${String(index + 1).padStart(2, "0")} ${scenario.label}`;
  const email = `analysis-smoke-${scenario.key}-${RUN_STAMP}@example.com`;
  const phone = `+905550${String(index + 1).padStart(6, "0")}`;
  const cvText = buildCvText({
    ...scenario.profile,
    fullName,
    email,
    phone
  });

  const candidateResult = await requestJson("Create candidate", "/candidates", {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({
      fullName,
      email,
      phone,
      source: "analysis_smoke"
    })
  });
  const candidateId = candidateResult?.candidate?.id ?? candidateResult?.id ?? null;
  if (!candidateId) {
    throw new Error("Candidate creation returned no id");
  }

  const cvUpload = await uploadCvFile(token, tenantId, candidateId, `${scenario.key}.txt`, cvText);
  const cvFileId = cvUpload?.id;
  if (!cvFileId) {
    throw new Error("CV upload returned no file id");
  }

  await requestJson("Trigger CV parsing", `/candidates/${candidateId}/cv-parsing/trigger`, {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({ cvFileId })
  });

  const cvParsing = await poll(
    `CV parsing ${scenario.key}`,
    () => requestJson("Poll CV parsing", `/candidates/${candidateId}/cv-parsing/latest?cvFileId=${encodeURIComponent(cvFileId)}`, {
      headers: authHeaders(token, tenantId)
    }),
    (detail) => {
      const status = detail?.taskRun?.status;
      return Boolean(status && !["PENDING", "QUEUED", "RUNNING"].includes(status));
    },
    { attempts: 35, intervalMs: 2000 }
  );

  if (cvParsing?.taskRun?.status !== "SUCCEEDED") {
    throw new Error(`CV parsing failed: ${cvParsing?.taskRun?.errorMessage ?? "unknown"}`);
  }

  const applicationResult = await requestJson("Create application", "/applications", {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({
      candidateId,
      jobId: job.id
    })
  });
  const applicationId = applicationResult?.id ?? applicationResult?.application?.id ?? null;
  if (!applicationId) {
    throw new Error("Application creation returned no id");
  }

  const fitTriggerStartedAt = Date.now();
  const fitTrigger = await requestJson("Trigger fit score", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({ action: "trigger_fit_score" })
  });
  if (!fitTrigger?.taskRunId) {
    throw new Error("Fit score trigger returned no taskRunId");
  }

  const fitTaskRun = await waitForTaskRun(
    token,
    tenantId,
    fitTrigger.taskRunId,
    `Fit score task ${scenario.key}`
  );

  if (fitTaskRun?.status !== "SUCCEEDED") {
    throw new Error(`Fit score task failed: ${fitTaskRun?.errorMessage ?? "unknown"}`);
  }

  const fitScore = await waitForFreshFitScore(
    token,
    tenantId,
    applicationId,
    null,
    fitTriggerStartedAt,
    `Fit score ${scenario.key}`
  );

  const screeningTrigger = await requestJson("Trigger screening", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({ action: "trigger_screening" })
  });
  if (!screeningTrigger?.taskRunId) {
    throw new Error("Screening trigger returned no taskRunId");
  }

  const screening = await waitForTaskRun(
    token,
    tenantId,
    screeningTrigger.taskRunId,
    `Screening ${scenario.key}`
  );

  if (screening?.status !== "SUCCEEDED") {
    throw new Error(`Screening failed: ${screening?.errorMessage ?? "unknown"}`);
  }

  const applicationDetail = await requestJson("Application detail", `/read-models/applications/${applicationId}`, {
    headers: authHeaders(token, tenantId)
  });

  const fit = fitSummary(fitScore);
  const screeningView = screeningSummary(screening);
  const heuristic = deriveHeuristicAssessment(scenario, fit, screeningView);

  logStatus(
    heuristic.status === "pass" ? "PASS" : "WARN",
    `${String(index + 1).padStart(2, "0")} ${scenario.label}`,
    `fit=${fit.overallScore ?? "?"} outcome=${screeningView.recommendedOutcome ?? "?"} heuristic=${heuristic.label}`
  );

  return {
    scenario: {
      key: scenario.key,
      label: scenario.label,
      expectedFitBand: scenario.expectedFitBand,
      expectedThemes: scenario.expectedThemes
    },
    candidate: {
      id: candidateId,
      fullName,
      email,
      phone,
      location: scenario.profile.location
    },
    cvFileId,
    applicationId,
    cvParsing: {
      taskRunId: cvParsing?.taskRun?.id ?? cvParsing?.taskRun?.taskRunId ?? null,
      parsedProfileId: cvParsing?.parsedProfile?.id ?? null,
      parseConfidence: cvParsing?.parsedProfile?.parseConfidence ?? null,
      extractionStatus: cvParsing?.parsedProfile?.extractionStatus ?? null,
      profilePreview: cvParsing?.parsedProfile?.profileJson ?? null
    },
    fit,
    screening: screeningView,
    heuristic,
    applicationDetail
  };
}

async function replayScenario(token, tenantId, job, scenario, index, existingApplication) {
  const applicationId = existingApplication?.id ?? null;
  const candidate = existingApplication?.candidate ?? {};
  if (!applicationId) {
    throw new Error(`Existing application missing for scenario: ${scenario.label}`);
  }

  const previousFitScore = await requestJson("Read previous fit score", `/applications/${applicationId}/fit-score/latest`, {
    headers: authHeaders(token, tenantId)
  });
  const fitTriggerStartedAt = Date.now();
  const fitTrigger = await requestJson("Trigger fit score", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({ action: "trigger_fit_score" })
  });
  if (!fitTrigger?.taskRunId) {
    throw new Error("Fit score trigger returned no taskRunId");
  }

  const fitTaskRun = await waitForTaskRun(
    token,
    tenantId,
    fitTrigger.taskRunId,
    `Fit score task ${scenario.key}`
  );

  if (fitTaskRun?.status !== "SUCCEEDED") {
    throw new Error(`Fit score task failed: ${fitTaskRun?.errorMessage ?? "unknown"}`);
  }

  const fitScore = await waitForFreshFitScore(
    token,
    tenantId,
    applicationId,
    previousFitScore,
    fitTriggerStartedAt,
    `Fit score ${scenario.key}`
  );

  const screeningTrigger = await requestJson("Trigger screening", `/applications/${applicationId}/quick-action`, {
    method: "POST",
    headers: jsonHeaders(token, tenantId),
    body: JSON.stringify({ action: "trigger_screening" })
  });
  if (!screeningTrigger?.taskRunId) {
    throw new Error("Screening trigger returned no taskRunId");
  }

  const screening = await waitForTaskRun(
    token,
    tenantId,
    screeningTrigger.taskRunId,
    `Screening ${scenario.key}`
  );

  if (screening?.status !== "SUCCEEDED") {
    throw new Error(`Screening failed: ${screening?.errorMessage ?? "unknown"}`);
  }

  const applicationDetail = await requestJson("Application detail", `/read-models/applications/${applicationId}`, {
    headers: authHeaders(token, tenantId)
  });

  const fit = fitSummary(fitScore);
  const screeningView = screeningSummary(screening);
  const heuristic = deriveHeuristicAssessment(scenario, fit, screeningView);

  logStatus(
    heuristic.status === "pass" ? "PASS" : "WARN",
    `${String(index + 1).padStart(2, "0")} ${scenario.label}`,
    `fit=${fit.overallScore ?? "?"} outcome=${screeningView.recommendedOutcome ?? "?"} heuristic=${heuristic.label}`
  );

  return {
    scenario: {
      key: scenario.key,
      label: scenario.label,
      expectedFitBand: scenario.expectedFitBand,
      expectedThemes: scenario.expectedThemes
    },
    candidate: {
      id: candidate.id ?? null,
      fullName: candidate.fullName ?? `Smoke ${String(index + 1).padStart(2, "0")} ${scenario.label}`,
      email: candidate.email ?? null,
      phone: candidate.phone ?? null,
      location: candidate.locationText ?? scenario.profile.location
    },
    cvFileId: null,
    applicationId,
    cvParsing: {
      taskRunId: null,
      parsedProfileId: null,
      parseConfidence: null,
      extractionStatus: null,
      profilePreview: null
    },
    fit,
    screening: screeningView,
    heuristic,
    applicationDetail
  };
}

function deriveHeuristicAssessment(scenario, fit, screening) {
  const band = scenario.expectedFitBand;
  const blob = normalizeText([
    fit.reasoning,
    ...fit.strengths,
    ...fit.risks,
    ...fit.missingInformation,
    screening.summary,
    screening.action,
    ...screening.facts,
    ...screening.interpretation,
    ...screening.flags,
    ...screening.missingInformation,
    ...screening.riskSignals
  ].filter(Boolean).join(" "));

  const fitScore = fit.overallScore ?? -1;
  const fitBandOk =
    (band === "high" && fitScore >= 70)
    || (band === "medium" && fitScore >= 45 && fitScore < 80)
    || (band === "low" && fitScore < 60);

  const themesOk = scenario.expectedThemes.some((theme) => blob.includes(normalizeText(theme)));
  const nonAdvanceOk = band !== "low" || screening.recommendedOutcome !== "ADVANCE";
  const overallConsistencyOk = fit.consistencyGap === null || fit.consistencyGap <= 15;
  const scenarioChecks = evaluateScenarioSpecificChecks(scenario.key, fit, {
    blob,
    strengthsBlob: normalizeText(fit.strengths.join(" "))
  });
  const passes = fitBandOk && themesOk && nonAdvanceOk && overallConsistencyOk && scenarioChecks.every((item) => item.ok);

  return {
    status: passes ? "pass" : "warn",
    label: passes ? "Beklenen mantiga yakin" : "Elle gozden gecirilmeli",
    fitBandOk,
    themesOk,
    nonAdvanceOk,
    overallConsistencyOk,
    scenarioChecks
  };
}

function evaluateScenarioSpecificChecks(key, fit, input) {
  const checks = [];
  const locationScore = scoreForCategory(fit.categories, /lokasyon|ulasim|location/);
  const experienceScore = scoreForCategory(fit.categories, /deneyim/);

  switch (key) {
    case "irrelevant_lawyer":
      checks.push({
        label: "Ilgisiz rolde deneyim puani sismemeli",
        ok: experienceScore === null || experienceScore < 40
      });
      checks.push({
        label: "Guclu yonlerde hukuk/avukat guclu avantaj gibi sunulmamali",
        ok: !/\bhukuk\b|\bavukat\b/.test(input.strengthsBlob)
      });
      break;
    case "same_city_far_district":
      checks.push({
        label: "Ayni il uzak ilce lokasyon puani ne cok dusuk ne de fazla iyimser olmamali",
        ok: locationScore === null || (locationScore >= 40 && locationScore <= 75)
      });
      break;
    case "same_city_near_district_strong":
    case "same_city_same_side_strong":
      checks.push({
        label: "Yakin veya makul commute hattinda lokasyon puani yuksek olmali",
        ok: locationScore === null || locationScore >= 75
      });
      break;
    case "same_city_far_district_no_signal":
      checks.push({
        label: "Uzak ilce ve ulasim sinyali belirsizse lokasyon puani orta bantta kalmali",
        ok: locationScore === null || (locationScore >= 35 && locationScore <= 65)
      });
      break;
    case "same_city_far_district_remote_only":
      checks.push({
        label: "Uzak ilce ve remote-only durumda lokasyon puani sert dusmeli",
        ok: locationScore === null || locationScore <= 35
      });
      break;
    case "same_city_near_district_low_role":
      checks.push({
        label: "Lokasyon avantajli olsa bile role-fit dusuk aday yukari tasinmamalı",
        ok: (locationScore === null || locationScore >= 75) && (experienceScore === null || experienceScore < 55)
      });
      break;
    case "same_city_far_district_low_role":
      checks.push({
        label: "Uzak ilce ve role-fit zayif adayda lokasyon puani orta-alt kalmali",
        ok: locationScore === null || locationScore <= 55
      });
      break;
    case "different_city_no_relocation":
    case "bursa_no_relocation":
      checks.push({
        label: "Farkli sehir ve tasinma yoksa lokasyon puani dusuk olmali",
        ok: locationScore === null || locationScore <= 35
      });
      break;
    case "remote_only_izmir":
      checks.push({
        label: "Remote-only hibrit rolde lokasyon puani dusmeli",
        ok: locationScore === null || locationScore <= 45
      });
      break;
    case "ankara_relocation_open":
    case "bursa_relocation_open":
      checks.push({
        label: "Tasinmaya acik aday tamamen cezalandirilmamali",
        ok: locationScore === null || locationScore >= 35
      });
      break;
    case "foreign_relocation_open_strong":
      checks.push({
        label: "Yurt disindan relocation acik aday tamamen sifirlanmamali",
        ok: locationScore === null || (locationScore >= 20 && locationScore <= 45)
      });
      break;
    case "foreign_remote_only_strong":
      checks.push({
        label: "Yurt disi ve remote-only adayda lokasyon puani cok dusuk olmali",
        ok: locationScore === null || locationScore <= 20
      });
      break;
    case "ecommerce_perf_cekmekoy":
      checks.push({
        label: "Guclu lokal adayda lokasyon puani yuksek olmali",
        ok: locationScore === null || locationScore >= 85
      });
      break;
    case "strong_local_mid":
      checks.push({
        label: "Guculu lokal adayda lokasyon puani yuksek olmali",
        ok: locationScore === null || locationScore >= 80
      });
      break;
    case "strong_local_senior":
      checks.push({
        label: "Ayni sehir yakin commute hattinda lokasyon puani makul yuksek olmali",
        ok: locationScore === null || locationScore >= 70
      });
      break;
    case "director_overqualified":
      checks.push({
        label: "Direktor profilde hands-on riski anilmali",
        ok: /hands-on|yonetim|direktor/.test(input.blob)
      });
      break;
    default:
      break;
  }

  return checks;
}

function buildMarkdownReport(summary) {
  const lines = [
    "# Analysis Smoke Report",
    "",
    `- Run stamp: ${summary.runStamp}`,
    `- API: ${summary.apiBaseUrl}`,
    `- Web: ${summary.webBaseUrl}`,
    `- Smoke user: ${summary.smokeUser.email}`,
    `- Tenant: ${summary.smokeUser.tenantId}`,
    `- Password: ${summary.smokeUser.password}`,
    `- Job: ${summary.job.title} (${summary.job.id})`,
    `- Job status: ${summary.job.status}`,
    "",
    "## Ozet",
    "",
    `- Toplam aday: ${summary.results.length}`,
    `- Heuristic pass: ${summary.aggregate.passCount}`,
    `- Heuristic warn: ${summary.aggregate.warnCount}`,
    `- Ortalama fit score: ${summary.aggregate.averageFitScore}`,
    `- Screening ADVANCE sayisi: ${summary.aggregate.advanceCount}`,
    `- Screening HOLD sayisi: ${summary.aggregate.holdCount}`,
    `- Screening REVIEW sayisi: ${summary.aggregate.reviewCount}`,
    "",
    "## Hizli Tablo",
    "",
    "| # | Senaryo | Fit | Confidence | Outcome | Heuristic | Ilk Risk |",
    "| --- | --- | ---: | ---: | --- | --- | --- |"
  ];

  summary.results.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | ${item.scenario.label} | ${item.fit.overallScore ?? "-"} | ${item.fit.confidence ?? "-"} | ${item.screening.recommendedOutcome ?? "-"} | ${item.heuristic.label} | ${escapeTable(firstLine([...item.fit.risks, ...item.screening.riskSignals, ...item.screening.flags]))} |`
    );
  });

  lines.push("", "## Detaylar", "");

  summary.results.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.scenario.label}`);
    lines.push("");
    lines.push(`- Candidate: ${item.candidate.fullName} (${item.candidate.email})`);
    lines.push(`- Expected fit band: ${item.scenario.expectedFitBand}`);
    lines.push(`- Heuristic: ${item.heuristic.label}`);
    lines.push(`- Fit: ${item.fit.overallScore ?? "-"} / confidence ${item.fit.confidence ?? "-"}`);
    lines.push(`- Weighted category average: ${item.fit.categoryWeightedAverage ?? "-"}`);
    lines.push(`- Overall consistency gap: ${item.fit.consistencyGap ?? "-"}`);
    lines.push(`- Screening outcome: ${item.screening.recommendedOutcome ?? "-"} / confidence ${item.screening.confidence ?? "-"}`);
    if (item.heuristic.scenarioChecks.length > 0) {
      lines.push("- Senaryo kontrolleri:");
      lines.push(toBulletList(item.heuristic.scenarioChecks.map((check) => `${check.ok ? "PASS" : "WARN"} - ${check.label}`)));
    }
    lines.push("- Fit strengths:");
    lines.push(toBulletList(listOrEmpty(item.fit.strengths)));
    lines.push("- Fit risks:");
    lines.push(toBulletList(listOrEmpty(item.fit.risks)));
    lines.push("- Fit missing information:");
    lines.push(toBulletList(listOrEmpty(item.fit.missingInformation)));
    lines.push("- Screening interpretation:");
    lines.push(toBulletList(listOrEmpty(item.screening.interpretation)));
    lines.push("- Screening flags:");
    lines.push(toBulletList(listOrEmpty(item.screening.flags)));
    lines.push("- Screening missing information:");
    lines.push(toBulletList(listOrEmpty(item.screening.missingInformation)));
    lines.push("");
  });

  return lines.join("\n");
}

function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function aggregateResults(results) {
  const fitScores = results
    .map((item) => item.fit.overallScore)
    .filter((value) => typeof value === "number");

  const averageFitScore = fitScores.length > 0
    ? Number((fitScores.reduce((acc, value) => acc + value, 0) / fitScores.length).toFixed(1))
    : null;

  return {
    passCount: results.filter((item) => item.heuristic.status === "pass").length,
    warnCount: results.filter((item) => item.heuristic.status !== "pass").length,
    averageFitScore,
    advanceCount: results.filter((item) => item.screening.recommendedOutcome === "ADVANCE").length,
    holdCount: results.filter((item) => item.screening.recommendedOutcome === "HOLD").length,
    reviewCount: results.filter((item) => item.screening.recommendedOutcome === "REVIEW").length
  };
}

async function main() {
  logStatus("INFO", "Analysis smoke started", `${API_BASE_URL} | ${WEB_BASE_URL}`);

  await request("API health", `${API_BASE_URL}/health`);
  await request("Web root", `${WEB_BASE_URL}/`);

  const smokeUser = await ensureSmokeUser();
  if (!smokeUser?.token || !smokeUser?.tenantId) {
    throw new Error("Smoke user auth information missing");
  }

  const smokeQuota = await ensureSmokeQuotaGrant(smokeUser.tenantId);
  if (smokeQuota.applied) {
    logStatus(
      "PASS",
      "Smoke quota grant ensured",
      smokeQuota.grants.map((item) => `${item.quotaKey}:+${item.quantity}`).join(" | ")
    );
  } else {
    logStatus("INFO", "Smoke quota grant skipped", smokeQuota.reason);
  }

  let job;
  let existingApplications = null;

  if (SMOKE_EXISTING_JOB_ID) {
    const existingContext = await loadExistingJobContext(
      smokeUser.token,
      smokeUser.tenantId,
      SMOKE_EXISTING_JOB_ID
    );
    job = existingContext.job;
    existingApplications = existingContext.applications;
    logStatus("PASS", "Existing smoke job loaded", `${job.id} | applications=${existingApplications.length}`);
  } else {
    job = await createMarketingJob(smokeUser.token, smokeUser.tenantId);
  }

  const results = [];
  const failures = [];

  for (const [index, scenario] of ACTIVE_SCENARIOS.entries()) {
    try {
      const expectedCandidateName = `Smoke ${String(index + 1).padStart(2, "0")} ${scenario.label}`;
      const existingApplication = existingApplications?.find(
        (item) => normalizeText(item?.candidate?.fullName ?? "") === normalizeText(expectedCandidateName)
      );
      const result = existingApplication
        ? await replayScenario(smokeUser.token, smokeUser.tenantId, job, scenario, index, existingApplication)
        : await processScenario(smokeUser.token, smokeUser.tenantId, job, scenario, index);
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logStatus("WARN", `Scenario failed: ${scenario.label}`, message);
      failures.push({
        scenario: scenario.key,
        label: scenario.label,
        error: message
      });
    }
  }

  const aggregate = aggregateResults(results);
  const summary = {
    runStamp: RUN_STAMP,
    apiBaseUrl: API_BASE_URL,
    webBaseUrl: WEB_BASE_URL,
    smokeUser: {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
      tenantId: smokeUser.tenantId
    },
    job: {
      id: job.id,
      title: job.title,
      status: job.status
    },
    aggregate,
    failures,
    results
  };

  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(ARTIFACT_JSON_PATH, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(ARTIFACT_MD_PATH, buildMarkdownReport(summary), "utf8");

  logStatus("PASS", "Artifacts written", `${ARTIFACT_JSON_PATH} | ${ARTIFACT_MD_PATH}`);

  if (failures.length > 0) {
    logStatus("WARN", "Analysis smoke completed with failures", `${failures.length} scenario(s) failed`);
    process.exitCode = 1;
    return;
  }

  logStatus("PASS", "Analysis smoke completed", `candidates=${results.length} avg_fit=${aggregate.averageFitScore ?? "-"}`);
}

main()
  .catch((error) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`FAIL Analysis smoke: ${detail}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
