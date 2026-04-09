export type AuthSessionMode = "jwt" | "hybrid" | "dev_header";
export type SessionAuthMode = "jwt" | "jwt_cookie" | "dev_header";

export type WebAuthSession = {
  tenantId: string;
  userId: string;
  roles: string;
  userLabel: string;
  authMode: SessionAuthMode;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  email?: string;
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
};
