import type { Role } from "@ai-interviewer/domain";

export type SessionAuthMode = "jwt" | "dev_header";

export interface RequestUser {
  userId: string;
  tenantId: string;
  roles: Role[];
  email?: string;
  fullName?: string;
  emailVerifiedAt?: Date | null;
  avatarUrl?: string | null;
  authMode: SessionAuthMode;
  sessionId?: string;
}
