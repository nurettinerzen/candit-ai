import type { Role } from "@ai-interviewer/domain";

export type SessionAuthMode = "jwt" | "dev_header";

export interface RequestUser {
  userId: string;
  tenantId: string;
  roles: Role[];
  email?: string;
  authMode: SessionAuthMode;
  sessionId?: string;
}
