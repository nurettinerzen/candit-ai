import type {
  ApplicationStage,
  ContactSuppressionStatus,
  HumanDecision,
  InterviewInvitationView,
  InterviewSessionStatus,
  JobStatus,
  ProspectFitLabel,
  QuickActionType,
  SourcingProspectStage,
  TalentSourceKind
} from "./types";
import type { AiTaskType } from "./types";
import {
  shouldOfferInterviewReinvite,
  shouldOfferInterviewReminder
} from "./interview-invitation";

export const JOB_STATUSES: JobStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export const APPLICATION_STAGES: ApplicationStage[] = [
  "APPLIED",
  "TALENT_POOL",
  "SHORTLISTED",
  "SCREENING",
  "RECRUITER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "REJECTED"
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: "Başvuru Geldi",
  TALENT_POOL: "Aday Havuzu",
  SHORTLISTED: "Kısa Liste",
  SCREENING: "AI Ön Eleme",
  INTERVIEW_SCHEDULED: "AI Mülakat",
  INTERVIEW_COMPLETED: "Değerlendirme Hazır",
  RECRUITER_REVIEW: "Ön Eleme Tamamlandı",
  HIRING_MANAGER_REVIEW: "Menajer İncelemesi",
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
  TALENT_POOL: {
    label: "Aday Havuzu",
    color: "var(--text-secondary, #94a3b8)"
  },
  SHORTLISTED: {
    label: "Kısa Liste",
    color: "var(--primary, #7c73fa)"
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
    label: "Menajer İncelemesi",
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
  { value: "TALENT_POOL", label: "Aday Havuzu" },
  { value: "SHORTLISTED", label: "Kısa Liste" },
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
  humanDecision?: HumanDecision | null
): string {
  if (stage === "TALENT_POOL" || humanDecision === "hold") {
    return "ON_HOLD";
  }

  if (stage === "INTERVIEW_COMPLETED" && !humanDecision) {
    return "DECISION_PENDING";
  }

  return stage;
}

/** @deprecated — use getStageMeta instead */
export function getRecruiterStageMeta(
  stage: ApplicationStage,
  _humanDecision?: HumanDecision | null
) {
  return getStageMeta(stage);
}

export type StageAction = {
  key: QuickActionType;
  label: string;
  icon: string;
  color: string;
};

type StageActionContext = {
  interview?: {
    status?: InterviewSessionStatus | string | null;
    invitation?: InterviewInvitationView | null;
  } | null;
};

const INVITE_INTERVIEW_ACTION: StageAction = {
  key: "invite_interview",
  label: "Mülakata Davet Et",
  icon: "📅",
  color: "var(--info, #60a5fa)"
};

const REINVITE_INTERVIEW_ACTION: StageAction = {
  key: "reinvite_interview",
  label: "Tekrar Davet Et",
  icon: "↺",
  color: "var(--info, #60a5fa)"
};

const SEND_REMINDER_ACTION: StageAction = {
  key: "send_reminder",
  label: "Hatırlatma Gönder",
  icon: "✉️",
  color: "var(--warn, #f59e0b)"
};

const REJECT_ACTION: StageAction = {
  key: "reject",
  label: "Reddet",
  icon: "✕",
  color: "var(--danger, #ef4444)"
};

const MOVE_TO_POOL_ACTION: StageAction = {
  key: "move_to_pool",
  label: "Havuza Al",
  icon: "○",
  color: "var(--text-secondary, #94a3b8)"
};

const MOVE_TO_SHORTLIST_ACTION: StageAction = {
  key: "move_to_shortlist",
  label: "Kısa Listeye Al",
  icon: "+",
  color: "var(--primary, #7c73fa)"
};

/**
 * Returns available actions for a given stage.
 * Recruiter review points:
 * 1. RECRUITER_REVIEW → Mülakata Davet Et / Reddet
 * 2. INTERVIEW_SCHEDULED → Aktif davette Hatırlatma, düşen davette Tekrar Davet Et
 * 3. INTERVIEW_COMPLETED → Reddet (recruiter just reviews the report)
 */
export function getAvailableStageActions(
  stage: ApplicationStage,
  context: StageActionContext = {}
): StageAction[] {
  switch (stage) {
    case "APPLIED":
      return [MOVE_TO_SHORTLIST_ACTION, MOVE_TO_POOL_ACTION, INVITE_INTERVIEW_ACTION, REJECT_ACTION];
    case "TALENT_POOL":
      return [MOVE_TO_SHORTLIST_ACTION, INVITE_INTERVIEW_ACTION, REJECT_ACTION];
    case "SHORTLISTED":
      return [MOVE_TO_POOL_ACTION, INVITE_INTERVIEW_ACTION, REJECT_ACTION];
    case "SCREENING":
      return [MOVE_TO_SHORTLIST_ACTION, MOVE_TO_POOL_ACTION, INVITE_INTERVIEW_ACTION, REJECT_ACTION];
    case "RECRUITER_REVIEW":
      return [MOVE_TO_SHORTLIST_ACTION, MOVE_TO_POOL_ACTION, INVITE_INTERVIEW_ACTION, REJECT_ACTION];
    case "INTERVIEW_COMPLETED":
      return [MOVE_TO_POOL_ACTION, REJECT_ACTION];
    case "INTERVIEW_SCHEDULED": {
      const invitation = context.interview?.invitation ?? null;
      const status = context.interview?.status ?? null;

      if (!context.interview || shouldOfferInterviewReinvite(invitation, status)) {
        return [REINVITE_INTERVIEW_ACTION, REJECT_ACTION];
      }

      if (shouldOfferInterviewReminder(invitation, status)) {
        return [SEND_REMINDER_ACTION, REJECT_ACTION];
      }

      return [REJECT_ACTION];
    }
    default:
      return [];
  }
}

export function getStageActions(stage: ApplicationStage): StageAction[] {
  return getAvailableStageActions(stage);
}

export function isInterviewInviteAction(action: QuickActionType) {
  return action === "invite_interview" || action === "reinvite_interview";
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi"
};

export const DECISION_LABELS: Record<"advance" | "hold" | "reject", string> = {
  advance: "Menajer İncelemesine Gecir",
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
  recruiter_import: "Recruiter Import",
  public_profile_url: "Public Profile URL",
  agency_upload: "Ajans Yüklemesi",
  job_board_export: "Job Board Export",
  public_web_discovery: "Public Web Discovery",
  kariyer_portali: "Kariyer Portalı",
  kariyer_net: "Kariyer.net",
  linkedin: "LinkedIn",
  eleman_net: "Eleman.net",
  referral: "Referans",
  walk_in: "Doğrudan Başvuru",
  email: "E-posta",
  phone: "Telefon",
  agency: "Ajans",
  other: "Diğer",
  internal_rediscovery: "İç Havuz Rediscovery",
  public_professional: "Kamuya Açık Profesyonel Profil"
};

export const TALENT_SOURCE_LABELS: Record<TalentSourceKind, string> = {
  INTERNAL_CANDIDATE: "İç Aday Havuzu",
  PUBLIC_PROFESSIONAL: "Kamuya Açık Profesyonel",
  RECRUITER_IMPORT: "Recruiter Import",
  REFERRAL: "Referans",
  OTHER: "Diğer"
};

export const SUPPRESSION_LABELS: Record<ContactSuppressionStatus, string> = {
  ALLOWED: "İletişime Açık",
  DO_NOT_CONTACT: "Do Not Contact",
  OPTED_OUT: "Opt-out",
  NEEDS_REVIEW: "İzin Kontrolü Gerekli"
};

export const PROSPECT_FIT_LABELS: Record<ProspectFitLabel, string> = {
  STRONG_MATCH: "Güçlü Uyum",
  GOOD_MATCH: "İyi Uyum",
  PARTIAL_MATCH: "Kısmi Uyum",
  WEAK_MATCH: "Zayıf Uyum",
  UNKNOWN: "Belirsiz"
};

export const PROSPECT_FIT_TONES: Record<ProspectFitLabel, string> = {
  STRONG_MATCH: "var(--success, #22c55e)",
  GOOD_MATCH: "var(--primary, #5046e5)",
  PARTIAL_MATCH: "var(--warn, #f59e0b)",
  WEAK_MATCH: "var(--risk, #ef4444)",
  UNKNOWN: "var(--text-secondary, #64748b)"
};

export const SOURCING_STAGE_META: Record<SourcingProspectStage, { label: string; color: string }> = {
  NEW: { label: "Yeni", color: "var(--text-secondary, #64748b)" },
  NEEDS_REVIEW: { label: "İnceleme Bekliyor", color: "var(--warn, #f59e0b)" },
  GOOD_FIT: { label: "İyi Uyum", color: "var(--success, #22c55e)" },
  SAVED: { label: "Kaydedildi", color: "var(--primary, #5046e5)" },
  CONTACTED: { label: "İletişime Geçildi", color: "var(--info, #3b82f6)" },
  REPLIED: { label: "Yanıtladı", color: "var(--success, #10b981)" },
  CONVERTED: { label: "Akışa Alındı", color: "var(--accent, #2563eb)" },
  REJECTED: { label: "Uygun Değil", color: "var(--risk, #ef4444)" },
  ARCHIVED: { label: "Arşiv", color: "var(--text-dim, #94a3b8)" }
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
