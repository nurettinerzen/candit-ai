import type { ApplicationStage, HumanDecision, JobStatus } from "./types";
import type { AiTaskType } from "./types";

export const JOB_STATUSES: JobStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export const APPLICATION_STAGES: ApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "RECRUITER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "REJECTED"
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: "Başvuru Geldi",
  SCREENING: "AI Ön Eleme",
  INTERVIEW_SCHEDULED: "AI Mülakat",
  INTERVIEW_COMPLETED: "Değerlendirme Hazır",
  RECRUITER_REVIEW: "Ön Eleme Tamamlandı",
  HIRING_MANAGER_REVIEW: "İK Mülakatı",
  OFFER: "Teklif",
  REJECTED: "Reddedildi",
  HIRED: "İşe Alındı"
};

/* ── Pipeline stage display ── */

export type PipelineStage =
  | "APPLIED"          // Başvuru Geldi
  | "SCREENING"        // AI Ön Eleme (otomatik)
  | "RECRUITER_REVIEW" // Ön Eleme Tamamlandı (recruiter karar verir)
  | "AI_INTERVIEW"     // AI Mülakat (otomatik)
  | "EVALUATION_READY" // Değerlendirme Hazır (recruiter inceler)
  | "REJECTED";        // Reddedildi

export const PIPELINE_STAGE_META: Record<string, { label: string; color: string }> = {
  APPLIED: {
    label: "Başvuru Geldi",
    color: "var(--text-secondary, #94a3b8)"
  },
  SCREENING: {
    label: "AI Ön Eleme",
    color: "var(--info, #60a5fa)"
  },
  RECRUITER_REVIEW: {
    label: "Ön Eleme Tamamlandı",
    color: "var(--warn, #f59e0b)"
  },
  INTERVIEW_SCHEDULED: {
    label: "AI Mülakat",
    color: "var(--info, #60a5fa)"
  },
  INTERVIEW_COMPLETED: {
    label: "Değerlendirme Hazır",
    color: "var(--success, #22c55e)"
  },
  REJECTED: {
    label: "Reddedildi",
    color: "var(--danger, #f87171)"
  },
  // Legacy stages — kept for backward compatibility
  HIRING_MANAGER_REVIEW: {
    label: "İK Mülakatı",
    color: "var(--accent-primary, #8b5cf6)"
  },
  OFFER: {
    label: "Teklif",
    color: "var(--accent-primary, #8b5cf6)"
  },
  HIRED: {
    label: "İşe Alındı",
    color: "var(--success, #34d399)"
  }
};

export const PIPELINE_STAGE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "APPLIED", label: "Başvuru Geldi" },
  { value: "SCREENING", label: "AI Ön Eleme" },
  { value: "RECRUITER_REVIEW", label: "Ön Eleme Tamamlandı" },
  { value: "INTERVIEW_SCHEDULED", label: "AI Mülakat" },
  { value: "INTERVIEW_COMPLETED", label: "Değerlendirme Hazır" },
  { value: "REJECTED", label: "Reddedildi" }
];

// Legacy aliases — kept for backward compatibility
export type RecruiterStatus = string;
export const RECRUITER_STATUS_FILTERS = PIPELINE_STAGE_FILTERS;

export function getStageMeta(stage: ApplicationStage): { label: string; color: string } {
  return PIPELINE_STAGE_META[stage] ?? { label: stage, color: "var(--text-secondary)" };
}

/** @deprecated — use getStageMeta instead */
export function getRecruiterStatus(
  stage: ApplicationStage,
  _humanDecision?: HumanDecision | null
): string {
  return stage;
}

/** @deprecated — use getStageMeta instead */
export function getRecruiterStageMeta(
  stage: ApplicationStage,
  _humanDecision?: HumanDecision | null
) {
  return getStageMeta(stage);
}

/**
 * Returns available actions for a given stage.
 * Only 2 decision points exist in the pipeline:
 * 1. RECRUITER_REVIEW → Mülakata Davet Et / Reddet
 * 2. INTERVIEW_COMPLETED → Reddet (recruiter just reviews the report)
 * All other stages allow early rejection only via APPLIED/SCREENING.
 */
export type StageAction = {
  key: string;
  label: string;
  icon: string;
  color: string;
};

/**
 * Pipeline aksiyon butonları (aşamaya göre dinamik).
 *
 * "Mülakata Davet Et" → AI mülakat davetini tetikler.
 * "Reddet" → Adayı reddeder.
 */
export function getStageActions(stage: ApplicationStage): StageAction[] {
  switch (stage) {
    case "APPLIED":
    case "SCREENING":
    case "RECRUITER_REVIEW":
      return [
        { key: "invite_interview", label: "Mülakata Davet Et", icon: "📅", color: "var(--info, #60a5fa)" },
        { key: "reject", label: "Reddet", icon: "✕", color: "var(--danger, #ef4444)" }
      ];
    case "INTERVIEW_COMPLETED":
      return [
        { key: "reject", label: "Reddet", icon: "✕", color: "var(--danger, #ef4444)" }
      ];
    case "INTERVIEW_SCHEDULED":
      return [
        { key: "reject", label: "Reddet", icon: "✕", color: "var(--danger, #ef4444)" }
      ];
    default:
      return [];
  }
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi"
};

export const DECISION_LABELS: Record<"advance" | "hold" | "reject", string> = {
  advance: "Yönetici İncelemesine Geçir",
  hold: "Beklet",
  reject: "Reddet"
};

export const AI_TASK_TYPE_LABELS: Record<AiTaskType, string> = {
  CV_PARSING: "CV Çözümleme",
  JOB_REQUIREMENT_INTERPRETATION: "İş Gereksinim Yorumu",
  CANDIDATE_FIT_ASSISTANCE: "Aday Uyum Desteği",
  SCREENING_SUPPORT: "Ön Eleme Desteği",
  INTERVIEW_PREPARATION: "Mülakat Hazırlık Desteği",
  INTERVIEW_ORCHESTRATION: "Mülakat Orkestrasyonu (Planlanan)",
  TRANSCRIPT_SUMMARIZATION: "Transkript Özetleme (Planlanan)",
  REPORT_GENERATION: "Rapor Üretimi",
  RECOMMENDATION_GENERATION: "Öneri Üretimi",
  APPLICANT_FIT_SCORING: "Aday Uyum Skorlama"
};

export const AI_TASK_TYPES: AiTaskType[] = [
  "CV_PARSING",
  "JOB_REQUIREMENT_INTERPRETATION",
  "CANDIDATE_FIT_ASSISTANCE",
  "SCREENING_SUPPORT",
  "INTERVIEW_PREPARATION",
  "INTERVIEW_ORCHESTRATION",
  "TRANSCRIPT_SUMMARIZATION",
  "REPORT_GENERATION",
  "RECOMMENDATION_GENERATION",
  "APPLICANT_FIT_SCORING"
];

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuel",
  csv_import: "CSV İçe Aktarma",
  kariyer_net: "Kariyer.net",
  linkedin: "LinkedIn",
  eleman_net: "Eleman.net",
  referral: "Referans",
  walk_in: "Doğrudan Başvuru",
  email: "E-posta",
  phone: "Telefon",
  agency: "Ajans",
  other: "Diğer"
};

export const FIT_SCORE_LABELS: Record<string, string> = {
  experienceFit: "Deneyim Uyumu",
  locationFit: "Lokasyon Uyumu",
  shiftFit: "Vardiya Uyumu",
  roleFit: "Rol Uyumu"
};

const DEPARTMENT_LABELS: Record<string, string> = {
  warehouse: "Depo / Lojistik",
  retail: "Mağaza / Perakende",
  call_center: "Çağrı Merkezi",
  customer_support: "Müşteri Destek",
  entry_support: "Destek / Giriş Seviyesi",
  operations: "Operasyon",
  operation: "Operasyon",
  logistics: "Lojistik",
  logistic: "Lojistik",
  sales: "Satış",
  hr: "İnsan Kaynakları",
  human_resources: "İnsan Kaynakları",
  general: "Genel",
  genel: "Genel"
};

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
    .join(" ");
}

export function formatDepartment(value: string | null | undefined) {
  if (!value?.trim()) {
    return "—";
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLocaleLowerCase("tr-TR").replace(/[\s-]+/g, "_");
  const mapped = DEPARTMENT_LABELS[normalized];

  if (mapped) {
    return mapped;
  }

  if (/^[a-z0-9_]+$/i.test(trimmed)) {
    return toTitleCase(trimmed.replace(/_/g, " "));
  }

  return trimmed;
}
