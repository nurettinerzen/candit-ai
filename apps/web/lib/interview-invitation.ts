import type {
  InterviewInvitationState,
  InterviewInvitationView,
  InterviewSessionStatus
} from "./types";

type InvitationMeta = {
  label: string;
  detail: string;
  tone: "neutral" | "info" | "warn" | "success" | "danger";
};

const STATE_META: Record<InterviewInvitationState, InvitationMeta> = {
  INVITED: {
    label: "Görüşme Bekleniyor",
    detail: "Davet gönderildi.",
    tone: "info"
  },
  REMINDER_SENT: {
    label: "Hatırlatma Gönderildi",
    detail: "Adayın aynı linkle görüşmeye başlaması bekleniyor.",
    tone: "warn"
  },
  IN_PROGRESS: {
    label: "Görüşme Devam Ediyor",
    detail: "Aday AI ön görüşmede.",
    tone: "warn"
  },
  COMPLETED: {
    label: "Görüşme Tamamlandı",
    detail: "Değerlendirme çıktıları hazır.",
    tone: "success"
  },
  EXPIRED: {
    label: "Süresi Doldu",
    detail: "Link geçerlilik penceresi kapandı.",
    tone: "danger"
  },
  FAILED: {
    label: "Başarısız / Yarıda Kaldı",
    detail: "Oturum tamamlanmadan sonlandı.",
    tone: "danger"
  }
};

export function getInterviewInvitationMeta(
  invitation: InterviewInvitationView | null | undefined,
  status?: InterviewSessionStatus | string | null
): InvitationMeta {
  if (invitation) {
    return STATE_META[invitation.state];
  }

  switch (status) {
    case "COMPLETED":
      return STATE_META.COMPLETED;
    case "RUNNING":
      return STATE_META.IN_PROGRESS;
    case "FAILED":
    case "CANCELLED":
      return STATE_META.FAILED;
    case "NO_SHOW":
      return STATE_META.EXPIRED;
    case "SCHEDULED":
      return STATE_META.INVITED;
    default:
      return {
        label: "Hazır Değil",
        detail: "Henüz interview daveti oluşturulmadı.",
        tone: "neutral"
      };
  }
}

export function shouldOfferInterviewReinvite(
  invitation: InterviewInvitationView | null | undefined,
  status?: InterviewSessionStatus | string | null
) {
  if (invitation?.state === "EXPIRED" || invitation?.state === "FAILED") {
    return true;
  }

  return status === "FAILED" || status === "CANCELLED" || status === "NO_SHOW";
}

export function shouldOfferInterviewReminder(
  invitation: InterviewInvitationView | null | undefined,
  status?: InterviewSessionStatus | string | null
) {
  if (invitation) {
    return invitation.resumeAllowed;
  }

  return status === "SCHEDULED" || status === "RUNNING";
}

export function formatInterviewDeadline(value: string | null | undefined) {
  if (!value) {
    return "Belirtilmedi";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("tr-TR");
}
