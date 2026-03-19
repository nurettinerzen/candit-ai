import type { ApplicationStage, JobStatus, Recommendation } from "./types";
import type { AiTaskType } from "./types";

export const JOB_STATUSES: JobStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export const APPLICATION_STAGES: ApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "RECRUITER_REVIEW",
  "HIRING_MANAGER_REVIEW",
  "OFFER",
  "REJECTED",
  "HIRED"
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: "Başvurdu",
  SCREENING: "Ön Değerlendirme",
  INTERVIEW_SCHEDULED: "Mülakat Planlandı",
  INTERVIEW_COMPLETED: "Mülakat Tamamlandı",
  RECRUITER_REVIEW: "İnceleme Bekliyor",
  HIRING_MANAGER_REVIEW: "Yönetici İncelemesi",
  OFFER: "Teklif Aşamasında",
  REJECTED: "Reddedildi",
  HIRED: "İşe Alındı"
};

export function getRecruiterStageMeta(
  stage: ApplicationStage,
  recommendation?: Recommendation | null
) {
  switch (stage) {
    case "APPLIED":
    case "SCREENING":
    case "INTERVIEW_COMPLETED":
      return {
        label: "Karar Bekliyor",
        color: "var(--warn, #f59e0b)"
      };
    case "RECRUITER_REVIEW":
      return recommendation === "HOLD"
        ? {
            label: "Bekletildi",
            color: "var(--text-secondary, #94a3b8)"
          }
        : {
            label: "Karar Bekliyor",
            color: "var(--warn, #f59e0b)"
          };
    case "INTERVIEW_SCHEDULED":
      return {
        label: "Mülakat Planlandı",
        color: "var(--info, #60a5fa)"
      };
    case "HIRING_MANAGER_REVIEW":
      return {
        label: "İlerletildi",
        color: "var(--success, #34d399)"
      };
    case "OFFER":
      return {
        label: "Teklife Geçti",
        color: "var(--accent-primary, #8b5cf6)"
      };
    case "REJECTED":
      return {
        label: "Reddedildi",
        color: "var(--danger, #f87171)"
      };
    case "HIRED":
      return {
        label: "İşe Alındı",
        color: "var(--success, #34d399)"
      };
    default:
      return {
        label: STAGE_LABELS[stage],
        color: "var(--text-secondary, #94a3b8)"
      };
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
