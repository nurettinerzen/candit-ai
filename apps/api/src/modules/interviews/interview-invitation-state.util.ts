export const AI_FIRST_INTERVIEW_INVITE_SOURCE = "recruiter_direct_ai_invite_v1";
export const AI_FIRST_INTERVIEW_VALIDITY_DAYS = Number(
  process.env.AI_FIRST_INTERVIEW_VALIDITY_DAYS ?? 5
);
export const AI_FIRST_INTERVIEW_REMINDER1_DELAY_DAYS = Number(
  process.env.AI_FIRST_INTERVIEW_REMINDER1_DELAY_DAYS ?? 2
);
export const AI_FIRST_INTERVIEW_REMINDER2_BEFORE_EXPIRY_DAYS = Number(
  process.env.AI_FIRST_INTERVIEW_REMINDER2_BEFORE_EXPIRY_DAYS ?? 1
);

export type InterviewInvitationState =
  | "INVITED"
  | "REMINDER_SENT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED";

type InvitationSessionLike = {
  mode: string;
  status: string;
  schedulingSource: string | null;
  invitationStatus: string | null;
  invitationIssuedAt: Date | null;
  invitationReminderCount?: number | null;
  invitationReminder1SentAt: Date | null;
  invitationReminder2SentAt: Date | null;
  candidateAccessExpiresAt: Date | null;
};

export function isAiFirstInterviewInvitation(
  session: InvitationSessionLike | null | undefined
): session is InvitationSessionLike {
  return (
    Boolean(session) &&
    session?.mode === "VOICE" &&
    session?.schedulingSource === AI_FIRST_INTERVIEW_INVITE_SOURCE
  );
}

export function deriveInterviewInvitationState(
  session: InvitationSessionLike | null | undefined
): {
  state: InterviewInvitationState;
  issuedAt: Date | null;
  expiresAt: Date | null;
  reminderCount: number;
  reminder1SentAt: Date | null;
  reminder2SentAt: Date | null;
  expired: boolean;
  resumeAllowed: boolean;
} | null {
  if (!isAiFirstInterviewInvitation(session)) {
    return null;
  }

  const activeSession = session;

  const now = Date.now();
  const expiresAt = activeSession.candidateAccessExpiresAt;
  const reminderCount =
    activeSession.invitationReminderCount ??
    [activeSession.invitationReminder1SentAt, activeSession.invitationReminder2SentAt].filter(Boolean)
      .length;
  const expired = Boolean(expiresAt && expiresAt.getTime() <= now);

  let state: InterviewInvitationState;

  if (
    activeSession.status === "COMPLETED" ||
    activeSession.invitationStatus === "COMPLETED"
  ) {
    state = "COMPLETED";
  } else if (
    activeSession.status === "RUNNING" ||
    activeSession.invitationStatus === "IN_PROGRESS"
  ) {
    state = "IN_PROGRESS";
  } else if (
    activeSession.status === "FAILED" ||
    activeSession.status === "CANCELLED" ||
    activeSession.invitationStatus === "FAILED"
  ) {
    state = "FAILED";
  } else if (
    activeSession.status === "NO_SHOW" ||
    activeSession.invitationStatus === "EXPIRED" ||
    expired
  ) {
    state = "EXPIRED";
  } else if (
    activeSession.invitationStatus === "REMINDER_SENT" ||
    activeSession.invitationReminder1SentAt ||
    activeSession.invitationReminder2SentAt
  ) {
    state = "REMINDER_SENT";
  } else {
    state = "INVITED";
  }

  return {
    state,
    issuedAt: activeSession.invitationIssuedAt,
    expiresAt,
    reminderCount,
    reminder1SentAt: activeSession.invitationReminder1SentAt,
    reminder2SentAt: activeSession.invitationReminder2SentAt,
    expired: state === "EXPIRED",
    resumeAllowed: state === "INVITED" || state === "REMINDER_SENT" || state === "IN_PROGRESS"
  };
}
