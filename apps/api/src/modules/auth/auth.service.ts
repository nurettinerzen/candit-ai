import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Role as AppRole } from "@ai-interviewer/domain";
import {
  AuditActorType,
  AuthActionTokenType,
  AuthProvider,
  AuthSessionStatus,
  SecurityEventSeverity,
  UserStatus,
  type Prisma,
  type Role as PrismaRole
} from "@prisma/client";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SecurityEventsService } from "../security-events/security-events.service";
import { FileStorageService } from "../storage/file-storage.service";
import {
  PASSWORD_POLICY_ERROR_MESSAGE,
  hashPassword,
  isPasswordPolicySatisfied,
  verifyPassword
} from "./password";

type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  roles: AppRole[];
  email: string;
  fullName: string;
  sid: string;
  tokenType: "access";
};

type ResolvedAccessTokenPayload = Omit<AccessTokenPayload, "tokenType"> & {
  emailVerifiedAt: Date | null;
  avatarUrl: string | null;
};

type SessionClientMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type AuthUserRecord = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: PrismaRole;
  status: UserStatus;
  deletedAt: Date | null;
  passwordHash?: string | null;
  emailVerifiedAt?: Date | null;
  avatarUrl?: string | null;
};

type PublicAuthUser = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  roles: AppRole[];
  emailVerifiedAt: string | null;
  avatarUrl: string | null;
};

type GoogleIdentityProfile = {
  subject: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl?: string | null;
};

type ActionTokenRecord = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  email: string;
  type: AuthActionTokenType;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  payloadJson: Prisma.JsonValue | null;
  user: {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: PrismaRole;
    status: UserStatus;
    deletedAt: Date | null;
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
    avatarUrl: string | null;
  } | null;
};

type InvitationRecord = {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  role: PrismaRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  user: {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    status: UserStatus;
    deletedAt: Date | null;
  };
  tenant: {
    id: string;
    name: string;
  };
};

type EmailVerificationFlowState = {
  enabled: boolean;
  required: boolean;
  deliveryEnabled: boolean;
};

type EmailVerificationDispatchResult = EmailVerificationFlowState & {
  ok: boolean;
  expiresAt?: string;
  previewUrl: string | null;
};

const REFRESH_TOKEN_ROTATED_REASON = "rotated";
const EMAIL_VERIFICATION_LABEL = "Email adresini dogrula";
const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";
const AUTH_EMAIL_VERIFICATION_REQUIRED_FLAG = "auth.email_verification.required";
const AUTH_EMAIL_VERIFICATION_SEND_EMAIL_FLAG = "auth.email_verification.send_email";
const PASSWORD_RESET_LABEL = "Sifremi sifirla";
const DELETE_ACCOUNT_CONFIRMATION_TR = "hesabimi sil";
const DELETE_ACCOUNT_CONFIRMATION_EN = "delete my account";

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function isExpired(date: Date) {
  return date.getTime() <= Date.now();
}

function normalizeSlugPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeDeleteAccountConfirmation(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(SecurityEventsService)
    private readonly securityEventsService: SecurityEventsService,
    @Inject(FileStorageService)
    private readonly fileStorageService: FileStorageService
  ) {}

  async login(
    input: { email: string; password: string },
    meta: SessionClientMeta = {}
  ) {
    const normalizedEmail = normalizeEmailAddress(input.email);
    const user = await this.findUniqueUserByEmail(
      normalizedEmail,
      "Kullanıcı bulunamadı.",
      "Bu e-posta birden fazla hesapta kayıtlı. Lütfen destek ekibiyle iletişime geçin."
    ).catch(async (error) => {
      if (error instanceof UnauthorizedException) {
        await this.reportSecurityEvent({
          source: "auth.login",
          code: "auth.login.user_not_found",
          message: "Taninmayan kullanici ile giris denemesi engellendi.",
          severity: SecurityEventSeverity.WARNING,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: {
            email: normalizedEmail
          }
        });
      }

      throw error;
    });

    if (!user || user.deletedAt) {
      await this.reportSecurityEvent({
        source: "auth.login",
        code: "auth.login.user_not_found",
        message: "Taninmayan kullanici ile giris denemesi engellendi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          email: normalizedEmail
        }
      });
      throw new UnauthorizedException("Kullanıcı bulunamadı.");
    }

    if (user.status === UserStatus.INVITED || !user.passwordHash) {
      await this.reportSecurityEvent({
        tenantId: user.tenantId,
        userId: user.id,
        source: "auth.login",
        code: "auth.login.invitation_incomplete",
        message: "Davet kabul etmeden giris denemesi engellendi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          email: user.email
        }
      });
      throw new ForbiddenException("Davet kabul edilmeden giriş yapılamaz.");
    }

    if (user.status === UserStatus.DISABLED) {
      await this.reportSecurityEvent({
        tenantId: user.tenantId,
        userId: user.id,
        source: "auth.login",
        code: "auth.login.disabled_user",
        message: "Pasif kullanici ile giris denemesi engellendi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          email: user.email
        }
      });
      throw new ForbiddenException("Kullanıcı pasif durumda.");
    }

    const passwordMatches = await verifyPassword(user.passwordHash, input.password);

    if (!passwordMatches) {
      await this.reportSecurityEvent({
        tenantId: user.tenantId,
        userId: user.id,
        source: "auth.login",
        code: "auth.login.invalid_password",
        message: "Hatali sifre ile giris denemesi algilandi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          email: user.email
        }
      });
      throw new UnauthorizedException("E-posta veya sifre hatali.");
    }

    const emailVerificationState = await this.resolveEmailVerificationState();

    if (emailVerificationState.required && !user.emailVerifiedAt) {
      await this.reportSecurityEvent({
        tenantId: user.tenantId,
        userId: user.id,
        source: "auth.login",
        code: "auth.login.email_verification_required",
        message: "E-posta dogrulamasi tamamlanmadan giris denemesi reddedildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          email: user.email
        }
      });

      const emailVerification = await this.sendEmailVerificationForUser(
        user,
        emailVerificationState
      ).catch(
        (): EmailVerificationDispatchResult => ({
          ok: false,
          ...emailVerificationState,
          previewUrl: null
        })
      );

      throw new ForbiddenException({
        message: emailVerificationState.deliveryEnabled
          ? "E-posta adresinizi doğrulamadan giriş yapamazsınız. Gelen kutunuzu kontrol edin."
          : "E-posta doğrulaması gerekiyor. Doğrulama bağlantısını açtıktan sonra tekrar giriş yapın.",
        code: EMAIL_VERIFICATION_REQUIRED_CODE,
        emailVerification
      });
    }

    return this.issueSessionForUser(user, meta);
  }

  async signup(
    input: { companyName: string; fullName: string; email: string; password: string },
    meta: SessionClientMeta = {}
  ) {
    const companyName = input.companyName.trim();
    const fullName = input.fullName.trim();
    const email = normalizeEmailAddress(input.email);

    if (!companyName || !fullName) {
      throw new BadRequestException("Sirket adi ve ad soyad zorunludur.");
    }

    if (!isPasswordPolicySatisfied(input.password)) {
      throw new BadRequestException(PASSWORD_POLICY_ERROR_MESSAGE);
    }

    await this.assertEmailAvailableForNewAccount(email);

    const tenantId = await this.generateTenantId(companyName);
    const passwordHash = await hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: companyName
        },
        select: {
          id: true
        }
      });

      await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: "Ana Calisma Alani"
        }
      });

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          fullName,
          role: "OWNER",
          status: UserStatus.ACTIVE,
          passwordHash,
          passwordSetAt: new Date()
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          deletedAt: true,
          passwordHash: true,
          emailVerifiedAt: true,
          avatarUrl: true
        }
      });
    });
    const emailVerificationState = await this.resolveEmailVerificationState();
    const emailVerification = await this.sendEmailVerificationForUser(
      user,
      emailVerificationState
    ).catch(
      (): EmailVerificationDispatchResult => ({
        ok: false,
        ...emailVerificationState,
        previewUrl: null
      })
    );

    if (emailVerificationState.required) {
      return {
        user: this.toPublicUser(user),
        session: null,
        emailVerification
      };
    }

    const result = await this.issueSessionForUser(user, meta);

    return {
      ...result,
      emailVerification
    };
  }

  async resolveInvitation(rawToken: string) {
    const invitation = await this.findInvitationByRawToken(rawToken);

    if (!invitation) {
      throw new NotFoundException("Davet bulunamadi veya gecersiz.");
    }

    return {
      invitation: {
        tenantId: invitation.tenant.id,
        tenantName: invitation.tenant.name,
        email: invitation.email,
        fullName: invitation.user.fullName,
        role: this.toAppRole(invitation.role),
        expiresAt: invitation.expiresAt.toISOString(),
        status: this.resolveInvitationStatus(invitation)
      }
    };
  }

  async acceptInvitation(
    input: { token: string; password: string; fullName?: string },
    meta: SessionClientMeta = {}
  ) {
    const invitation = await this.findInvitationByRawToken(input.token);

    if (!invitation) {
      throw new NotFoundException("Davet bulunamadi veya gecersiz.");
    }

    this.assertInvitationAcceptable(invitation);

    if (invitation.user.deletedAt) {
      throw new ForbiddenException("Silinmis kullanici daveti kabul edemez.");
    }

    if (invitation.user.status === UserStatus.DISABLED) {
      throw new ForbiddenException("Pasif kullanici daveti kabul edemez.");
    }

    if (!isPasswordPolicySatisfied(input.password)) {
      throw new BadRequestException(PASSWORD_POLICY_ERROR_MESSAGE);
    }

    const now = new Date();
    const normalizedFullName = input.fullName?.trim() || invitation.user.fullName;
    const passwordHash = await hashPassword(input.password);
    const sessionExpiresAt = addDays(now, this.runtimeConfig.sessionTtlDays);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.memberInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: now
        }
      });

      await tx.memberInvitation.updateMany({
        where: {
          tenantId: invitation.tenantId,
          userId: invitation.userId,
          id: {
            not: invitation.id
          },
          acceptedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      const user = await tx.user.update({
        where: {
          id: invitation.userId
        },
        data: {
          fullName: normalizedFullName,
          role: invitation.role,
          status: UserStatus.ACTIVE,
          passwordHash,
          passwordSetAt: now,
          emailVerifiedAt: now,
          lastLoginAt: now
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          deletedAt: true,
          emailVerifiedAt: true,
          avatarUrl: true
        }
      });

      const session = await tx.authSession.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          status: AuthSessionStatus.ACTIVE,
          authMode: "jwt",
          expiresAt: sessionExpiresAt,
          lastSeenAt: now,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        }
      });

      const refreshToken = await this.createRefreshTokenRecord(tx, {
        sessionId: session.id,
        tenantId: user.tenantId,
        userId: user.id
      });

      return {
        user,
        session,
        refreshToken
      };
    });

    const accessToken = await this.signAccessToken({
      sub: result.user.id,
      tenantId: result.user.tenantId,
      roles: this.toAppRoles(result.user.role),
      email: result.user.email,
      fullName: result.user.fullName,
      sid: result.session.id,
      tokenType: "access"
    });

    return {
      accessToken,
      refreshToken: result.refreshToken.rawToken,
      user: this.toPublicUser(result.user),
      session: {
        id: result.session.id,
        authMode: "jwt",
        expiresAt: result.session.expiresAt.toISOString()
      }
    };
  }

  async refresh(refreshToken: string, meta: SessionClientMeta = {}) {
    if (!refreshToken || refreshToken.trim().length < 20) {
      await this.reportSecurityEvent({
        source: "auth.refresh",
        code: "auth.refresh.malformed_token",
        message: "Gecersiz formatta refresh token yenileme denemesi reddedildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      throw new UnauthorizedException("Refresh token zorunludur.");
    }

    const tokenHash = this.hashToken(refreshToken.trim());

    const tokenRecord = await this.prisma.authRefreshToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        session: true,
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            deletedAt: true,
            emailVerifiedAt: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!tokenRecord) {
      await this.reportSecurityEvent({
        source: "auth.refresh",
        code: "auth.refresh.token_not_found",
        message: "Eslesmeyen refresh token yenileme denemesi reddedildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      throw new UnauthorizedException("Refresh token gecersiz veya suresi dolmus.");
    }

    if (tokenRecord.replacedByTokenId) {
      await this.reportSecurityEvent({
        tenantId: tokenRecord.tenantId,
        userId: tokenRecord.userId,
        sessionId: tokenRecord.sessionId,
        source: "auth.refresh",
        code: "auth.refresh.reuse_detected",
        message: "Refresh token tekrar kullanimi tespit edildi.",
        severity: SecurityEventSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      await this.revokeSession(tokenRecord.sessionId, "refresh_token_reuse_detected");
      throw new UnauthorizedException("Refresh token tekrar kullanimi tespit edildi.");
    }

    if (tokenRecord.revokedAt || isExpired(tokenRecord.expiresAt)) {
      await this.reportSecurityEvent({
        tenantId: tokenRecord.tenantId,
        userId: tokenRecord.userId,
        sessionId: tokenRecord.sessionId,
        source: "auth.refresh",
        code: "auth.refresh.expired_or_revoked",
        message: "Suresi dolmus veya iptal edilmis refresh token kullanildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      throw new UnauthorizedException("Refresh token gecersiz veya suresi dolmus.");
    }

    const session = tokenRecord.session;

    if (
      session.status !== AuthSessionStatus.ACTIVE ||
      Boolean(session.revokedAt) ||
      isExpired(session.expiresAt)
    ) {
      if (isExpired(session.expiresAt) && session.status !== AuthSessionStatus.EXPIRED) {
        await this.prisma.authSession.update({
          where: { id: session.id },
          data: {
            status: AuthSessionStatus.EXPIRED
          }
        });
      }

      await this.reportSecurityEvent({
        tenantId: session.tenantId,
        userId: session.userId,
        sessionId: session.id,
        source: "auth.refresh",
        code: "auth.refresh.invalid_session",
        message: "Aktif olmayan oturum icin refresh denemesi reddedildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      throw new UnauthorizedException("Kullanici oturumu gecersiz.");
    }

    if (tokenRecord.user.deletedAt || tokenRecord.user.status !== UserStatus.ACTIVE) {
      await this.reportSecurityEvent({
        tenantId: tokenRecord.user.tenantId,
        userId: tokenRecord.user.id,
        sessionId: session.id,
        source: "auth.refresh",
        code: "auth.refresh.user_inactive",
        message: "Pasif veya silinmis kullanici icin refresh denemesi tespit edildi.",
        severity: SecurityEventSeverity.CRITICAL,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          userStatus: tokenRecord.user.status
        }
      });
      await this.revokeSession(session.id, "user_disabled_or_deleted");
      throw new UnauthorizedException("Kullanici oturumu gecersiz.");
    }

    if (
      !tokenRecord.user.emailVerifiedAt &&
      (await this.isEmailVerificationRequired())
    ) {
      throw new ForbiddenException(
        "E-posta adresinizi doğrulamadan oturum yenileyemezsiniz."
      );
    }

    const roles = this.toAppRoles(tokenRecord.user.role);

    const rotatedToken = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.authRefreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          lastUsedAt: now,
          revokedAt: now,
          revokedReason: REFRESH_TOKEN_ROTATED_REASON
        }
      });

      const nextRefresh = await this.createRefreshTokenRecord(tx, {
        sessionId: session.id,
        tenantId: session.tenantId,
        userId: session.userId,
        parentTokenId: tokenRecord.id
      });

      await tx.authRefreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          replacedByTokenId: nextRefresh.id
        }
      });

      await tx.authSession.update({
        where: {
          id: session.id
        },
        data: {
          lastSeenAt: now,
          ipAddress: meta.ipAddress ?? session.ipAddress,
          userAgent: meta.userAgent ?? session.userAgent
        }
      });

      return nextRefresh;
    });

    return {
      accessToken: await this.signAccessToken({
        sub: tokenRecord.user.id,
        tenantId: tokenRecord.user.tenantId,
        roles,
        email: tokenRecord.user.email,
        fullName: tokenRecord.user.fullName,
        sid: session.id,
        tokenType: "access"
      }),
      refreshToken: rotatedToken.rawToken,
      session: {
        id: session.id,
        authMode: "jwt",
        expiresAt: session.expiresAt.toISOString()
      }
    };
  }

  async verifyAccessToken(accessToken: string): Promise<ResolvedAccessTokenPayload> {
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
    } catch {
      throw new UnauthorizedException("Access token gecersiz veya suresi dolmus.");
    }

    if (payload.tokenType !== "access") {
      throw new UnauthorizedException("Gecersiz access token.");
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        tenantId: payload.tenantId,
        userId: payload.sub,
        status: AuthSessionStatus.ACTIVE,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        user: {
          select: {
            status: true,
            deletedAt: true,
            role: true,
            email: true,
            fullName: true,
            emailVerifiedAt: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException("Oturum gecersiz veya sonlandirilmis.");
    }

    if (session.user.deletedAt || session.user.status !== UserStatus.ACTIVE) {
      await this.revokeSession(payload.sid, "user_disabled_or_deleted");
      throw new UnauthorizedException("Kullanici oturumu gecersiz.");
    }

    if (
      !session.user.emailVerifiedAt &&
      (await this.isEmailVerificationRequired())
    ) {
      throw new ForbiddenException(
        "E-posta adresinizi doğrulamadan bu alana erişemezsiniz."
      );
    }

    void this.prisma.authSession
      .update({
        where: {
          id: payload.sid
        },
        data: {
          lastSeenAt: new Date()
        }
      })
      .catch(() => undefined);

    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      roles: this.toAppRoles(session.user.role),
      email: session.user.email,
      fullName: session.user.fullName,
      sid: payload.sid,
      emailVerifiedAt: session.user.emailVerifiedAt,
      avatarUrl: session.user.avatarUrl
    };
  }

  async logout(input: {
    sessionId?: string;
    refreshToken?: string;
    reason?: string;
  }) {
    if (input.refreshToken) {
      const tokenHash = this.hashToken(input.refreshToken);
      const tokenRecord = await this.prisma.authRefreshToken.findUnique({
        where: {
          tokenHash
        },
        select: {
          sessionId: true
        }
      });

      if (tokenRecord) {
        await this.revokeSession(tokenRecord.sessionId, input.reason ?? "logout");
        return;
      }
    }

    if (input.sessionId) {
      await this.revokeSession(input.sessionId, input.reason ?? "logout");
    }
  }

  async createInvitationToken() {
    const rawToken = randomBytes(48).toString("base64url");
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      expiresAt: addHours(new Date(), this.runtimeConfig.invitationTtlHours)
    };
  }

  async requestPasswordReset(input: { email: string }) {
    const normalizedEmail = normalizeEmailAddress(input.email);

    try {
      const users = await this.findUsersByEmail(normalizedEmail);

      if (users.length > 1) {
        await this.reportSecurityEvent({
          source: "auth.password.reset",
          code: "auth.password.reset.ambiguous_email",
          message: "Birden fazla hesaba ait e-posta icin sifre sifirlama talebi reddedildi.",
          severity: SecurityEventSeverity.WARNING,
          metadata: {
            email: normalizedEmail
          }
        });

        throw new BadRequestException(
          "Bu e-posta birden fazla hesapta kayıtlı. Şifre yenileme için destek ekibiyle iletişime geçin."
        );
      }

      const [user] = users;

      if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE || !user.passwordHash) {
        return {
          ok: true
        };
      }

      const token = await this.createActionToken({
        tenantId: user.tenantId,
        userId: user.id,
        email: user.email,
        type: AuthActionTokenType.PASSWORD_RESET,
        expiresAt: addHours(new Date(), this.runtimeConfig.passwordResetTtlHours)
      });

      const resetUrl = this.toWebUrl(`/auth/reset-password?token=${encodeURIComponent(token.rawToken)}`);

      await this.notificationsService.send({
        tenantId: user.tenantId,
        channel: "email",
        to: user.email,
        subject: "Candit.ai sifre sifirlama baglantisi",
        body: [
          `Merhaba ${user.fullName},`,
          "",
          "Sifrenizi yenilemek icin asagidaki baglantiyi kullanabilirsiniz.",
          "Bu baglanti sinirli bir sure boyunca gecerlidir."
        ].join("\n"),
        metadata: {
          primaryLink: resetUrl,
          primaryCtaLabel: PASSWORD_RESET_LABEL
        },
        templateKey: "auth_password_reset",
        eventType: "auth.password_reset_requested",
        requestedBy: user.id
      });

      await this.writeAuditLog({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "auth.password.reset_requested",
        entityType: "User",
        entityId: user.id,
        metadata: {
          email: user.email,
          expiresAt: token.expiresAt.toISOString()
        }
      });

      return {
        ok: true,
        expiresAt: token.expiresAt.toISOString(),
        previewUrl: this.runtimeConfig.isProduction ? null : resetUrl
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        ok: true
      };
    }
  }

  async resolvePasswordReset(rawToken: string) {
    const token = await this.findActionTokenByRawToken(rawToken, AuthActionTokenType.PASSWORD_RESET);

    if (!token) {
      throw new NotFoundException("Sifre sifirlama baglantisi bulunamadi veya gecersiz.");
    }

    return {
      reset: {
        email: token.email,
        fullName: token.user?.fullName ?? "",
        expiresAt: token.expiresAt.toISOString(),
        status: this.resolveActionTokenStatus(token)
      }
    };
  }

  async resetPassword(
    input: { token: string; password: string },
    meta: SessionClientMeta = {}
  ) {
    const token = await this.findActionTokenByRawToken(input.token, AuthActionTokenType.PASSWORD_RESET);

    if (!token || !token.user) {
      await this.reportSecurityEvent({
        source: "auth.password.reset",
        code: "auth.password.reset.token_not_found",
        message: "Gecersiz veya bulunamayan sifre sifirlama tokeni kullanildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      throw new NotFoundException("Sifre sifirlama baglantisi bulunamadi veya gecersiz.");
    }

    try {
      this.assertActionTokenUsable(token, "Bu sifre sifirlama baglantisinin suresi doldu.");
    } catch (error) {
      await this.reportSecurityEvent({
        tenantId: token.user.tenantId,
        userId: token.user.id,
        source: "auth.password.reset",
        code: "auth.password.reset.token_unusable",
        message:
          error instanceof Error
            ? error.message
            : "Sifre sifirlama tokeni kullanilamaz durumda bulundu.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          tokenId: token.id
        }
      });
      throw error;
    }

    if (token.user.deletedAt || token.user.status !== UserStatus.ACTIVE) {
      await this.reportSecurityEvent({
        tenantId: token.user.tenantId,
        userId: token.user.id,
        source: "auth.password.reset",
        code: "auth.password.reset.user_inactive",
        message: "Pasif veya silinmis kullanici icin sifre sifirlama talebi reddedildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          userStatus: token.user.status
        }
      });
      throw new ForbiddenException("Bu kullanici sifre sifirlama islemi yapamaz.");
    }

    if (!isPasswordPolicySatisfied(input.password)) {
      throw new BadRequestException(PASSWORD_POLICY_ERROR_MESSAGE);
    }

    const now = new Date();
    const passwordHash = await hashPassword(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: token.user!.id
        },
        data: {
          passwordHash,
          passwordSetAt: now,
          emailVerifiedAt: token.user!.emailVerifiedAt ?? now,
          lastLoginAt: now
        }
      });

      await tx.authActionToken.update({
        where: {
          id: token.id
        },
        data: {
          consumedAt: now
        }
      });

      await tx.authActionToken.updateMany({
        where: {
          userId: token.user!.id,
          type: AuthActionTokenType.PASSWORD_RESET,
          consumedAt: null,
          revokedAt: null,
          id: {
            not: token.id
          }
        },
        data: {
          revokedAt: now
        }
      });

      const revokedSessions = await tx.authSession.updateMany({
        where: {
          userId: token.user!.id,
          status: AuthSessionStatus.ACTIVE
        },
        data: {
          status: AuthSessionStatus.REVOKED,
          revokedAt: now,
          revokedReason: "password_reset"
        }
      });

      const revokedRefreshTokens = await tx.authRefreshToken.updateMany({
        where: {
          userId: token.user!.id,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedReason: "password_reset"
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: token.user!.tenantId,
          actorUserId: token.user!.id,
          actorType: AuditActorType.USER,
          action: "auth.password.reset_completed",
          entityType: "User",
          entityId: token.user!.id,
          metadata: {
            tokenId: token.id,
            revokedSessionCount: revokedSessions.count,
            revokedRefreshTokenCount: revokedRefreshTokens.count
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return this.issueSessionForUserId(token.user.id, meta);
  }

  async changePassword(
    input: {
      userId: string;
      tenantId: string;
      sessionId?: string;
      currentPassword: string;
      newPassword: string;
    },
    meta: SessionClientMeta = {}
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        avatarUrl: true
      }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException("Kullanici bulunamadi.");
    }

    if (!user.passwordHash) {
      throw new ForbiddenException("Bu hesap icin sifre degistirme kullanilamiyor.");
    }

    const currentPasswordMatches = await verifyPassword(
      user.passwordHash,
      input.currentPassword
    );

    if (!currentPasswordMatches) {
      await this.reportSecurityEvent({
        tenantId: user.tenantId,
        userId: user.id,
        sessionId: input.sessionId,
        source: "auth.password.change",
        code: "auth.password.change.invalid_current_password",
        message: "Hatali mevcut sifre ile parola degistirme denemesi reddedildi.",
        severity: SecurityEventSeverity.WARNING,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      });
      throw new UnauthorizedException("Mevcut sifreniz hatali.");
    }

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException("Yeni sifre mevcut sifreyle ayni olamaz.");
    }

    if (!isPasswordPolicySatisfied(input.newPassword)) {
      throw new BadRequestException(PASSWORD_POLICY_ERROR_MESSAGE);
    }

    const now = new Date();
    const passwordHash = await hashPassword(input.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          passwordHash,
          passwordSetAt: now,
          emailVerifiedAt: user.emailVerifiedAt ?? now
        }
      });

      await tx.authActionToken.updateMany({
        where: {
          userId: user.id,
          type: AuthActionTokenType.PASSWORD_RESET,
          consumedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      const revokedSessions = await tx.authSession.updateMany({
        where: {
          userId: user.id,
          status: AuthSessionStatus.ACTIVE
        },
        data: {
          status: AuthSessionStatus.REVOKED,
          revokedAt: now,
          revokedReason: "password_changed"
        }
      });

      const revokedRefreshTokens = await tx.authRefreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedReason: "password_changed"
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          actorType: AuditActorType.USER,
          action: "auth.password.changed",
          entityType: "User",
          entityId: user.id,
          metadata: {
            sessionId: input.sessionId ?? null,
            revokedSessionCount: revokedSessions.count,
            revokedRefreshTokenCount: revokedRefreshTokens.count
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return this.issueSessionForUserId(user.id, meta);
  }

  async deleteCurrentAccount(
    input: {
      userId: string;
      tenantId: string;
      roles: AppRole[];
      currentPassword: string;
      confirmationText: string;
      actorEmail?: string;
    },
    _meta: SessionClientMeta = {}
  ) {
    if (!input.roles.includes("owner")) {
      throw new ForbiddenException("Tum hesabi yalnizca hesap sahibi silebilir.");
    }

    const normalizedConfirmation = normalizeDeleteAccountConfirmation(input.confirmationText);
    if (
      normalizedConfirmation !== DELETE_ACCOUNT_CONFIRMATION_TR &&
      normalizedConfirmation !== DELETE_ACCOUNT_CONFIRMATION_EN
    ) {
      throw new BadRequestException("Onay metni eslesmiyor.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        avatarUrl: true
      }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException("Kullanici bulunamadi.");
    }

    if (!user.passwordHash) {
      throw new ForbiddenException("Bu hesap icin parola dogrulamasi yapilamadi.");
    }

    const passwordMatches = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!passwordMatches) {
      throw new UnauthorizedException("Mevcut sifreniz hatali.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.delete({
        where: {
          id: input.tenantId
        }
      });

      await tx.screeningTemplate.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.interviewTemplate.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.featureFlagOverride.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.integrationSyncState.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.webhookEvent.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.workflowJob.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.deadLetterJob.deleteMany({
        where: {
          tenantId: input.tenantId
        }
      });

      await tx.billingTrialClaim.deleteMany({
        where: {
          OR: [
            {
              firstTenantId: input.tenantId
            },
            {
              firstUserId: user.id
            }
          ]
        }
      });
    });

    await this.fileStorageService.removeTenantArtifacts(input.tenantId);
  }

  async sendEmailVerification(input: { userId: string; tenantId: string }) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        avatarUrl: true
      }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException("Kullanici bulunamadi.");
    }

    return this.sendEmailVerificationForUser(user);
  }

  async confirmEmailVerification(rawToken: string) {
    const token = await this.findActionTokenByRawToken(rawToken, AuthActionTokenType.EMAIL_VERIFICATION);

    if (!token || !token.user) {
      throw new NotFoundException("Dogrulama baglantisi bulunamadi veya gecersiz.");
    }

    this.assertActionTokenUsable(token, "Bu dogrulama baglantisinin suresi doldu.");

    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.authActionToken.update({
        where: {
          id: token.id
        },
        data: {
          consumedAt: now
        }
      });

      await tx.authActionToken.updateMany({
        where: {
          userId: token.user!.id,
          type: AuthActionTokenType.EMAIL_VERIFICATION,
          consumedAt: null,
          revokedAt: null,
          id: {
            not: token.id
          }
        },
        data: {
          revokedAt: now
        }
      });

      return tx.user.update({
        where: {
          id: token.user!.id
        },
        data: {
          emailVerifiedAt: now
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          deletedAt: true,
          passwordHash: true,
          emailVerifiedAt: true,
          avatarUrl: true
        }
      });
    });

    return {
      ok: true,
      user: this.toPublicUser(user)
    };
  }

  async createOauthRelayToken(input: { userId: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        avatarUrl: true
      }
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("OAuth oturumu olusturulamadi.");
    }

    return this.createActionToken({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      type: AuthActionTokenType.OAUTH_LOGIN_RELAY,
      expiresAt: addHours(new Date(), this.runtimeConfig.oauthRelayTtlHours)
    });
  }

  async exchangeOauthRelay(rawToken: string, meta: SessionClientMeta = {}) {
    const token = await this.findActionTokenByRawToken(rawToken, AuthActionTokenType.OAUTH_LOGIN_RELAY);

    if (!token || !token.user) {
      throw new UnauthorizedException("OAuth oturumu bulunamadi veya gecersiz.");
    }

    this.assertActionTokenUsable(token, "OAuth oturumu gecersiz veya suresi dolmus.");

    await this.prisma.authActionToken.update({
      where: {
        id: token.id
      },
      data: {
        consumedAt: new Date()
      }
    });

    return this.issueSessionForUserId(token.user.id, meta);
  }

  async resolveGoogleAuth(input: {
    intent: "login" | "signup";
    companyName?: string;
    profile: GoogleIdentityProfile;
  }) {
    if (!input.profile.emailVerified) {
      throw new ForbiddenException("Google hesabi dogrulanmamis e-posta dondurdu.");
    }

    const normalizedEmail = normalizeEmailAddress(input.profile.email);

    const resolvedTenantId = await this.resolveTenantIdForOauthEmail(
      normalizedEmail,
      input.intent
    );

    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: AuthProvider.GOOGLE,
          providerSubject: input.profile.subject
        }
      },
      select: {
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            deletedAt: true,
            passwordHash: true,
            emailVerifiedAt: true,
            avatarUrl: true
          }
        }
      }
    });

    if (existingIdentity?.user && !existingIdentity.user.deletedAt) {
      return this.syncGoogleIdentity(existingIdentity.user, input.profile);
    }

    if (resolvedTenantId) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: resolvedTenantId,
            email: normalizedEmail
          }
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          deletedAt: true,
          passwordHash: true,
          emailVerifiedAt: true,
          avatarUrl: true
        }
      });

      if (existingUser) {
        if (input.intent === "signup" && existingUser.status === UserStatus.ACTIVE) {
          throw new BadRequestException(
            "Bu e-posta icin zaten bir hesap var. Lutfen giris yap ekranini kullanin."
          );
        }

        return this.linkGoogleIdentityToUser(existingUser, input.profile);
      }
    }

    if (input.intent === "login") {
      throw new NotFoundException("Bu e-posta icin bir hesap bulunamadi. Lutfen once uye olun.");
    }

    return this.provisionGoogleSignup({
      email: normalizedEmail,
      fullName: input.profile.fullName,
      avatarUrl: input.profile.avatarUrl ?? null,
      providerSubject: input.profile.subject,
      companyName: input.companyName?.trim()
    });
  }

  async issueSessionForUserId(userId: string, meta: SessionClientMeta = {}) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        avatarUrl: true
      }
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Kullanici oturumu olusturulamadi.");
    }

    return this.issueSessionForUser(user, meta);
  }

  private async issueSessionForUser(user: AuthUserRecord, meta: SessionClientMeta) {
    if (!user.emailVerifiedAt && (await this.isEmailVerificationRequired())) {
      throw new ForbiddenException("E-posta adresinizi doğrulamadan oturum açılamaz.");
    }

    const now = new Date();
    const sessionExpiresAt = addDays(now, this.runtimeConfig.sessionTtlDays);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          lastLoginAt: now
        }
      });

      const session = await tx.authSession.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          status: AuthSessionStatus.ACTIVE,
          authMode: "jwt",
          expiresAt: sessionExpiresAt,
          lastSeenAt: now,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        }
      });

      const refreshToken = await this.createRefreshTokenRecord(tx, {
        sessionId: session.id,
        tenantId: user.tenantId,
        userId: user.id
      });

      return {
        session,
        refreshToken
      };
    });

    const roles = this.toAppRoles(user.role);
    const accessToken = await this.signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      roles,
      email: user.email,
      fullName: user.fullName,
      sid: result.session.id,
      tokenType: "access"
    });

    return {
      accessToken,
      refreshToken: result.refreshToken.rawToken,
      user: this.toPublicUser({
        ...user,
        role: user.role
      }),
      session: {
        id: result.session.id,
        authMode: "jwt",
        expiresAt: result.session.expiresAt.toISOString()
      }
    };
  }

  private async findInvitationByRawToken(rawToken: string): Promise<InvitationRecord | null> {
    const normalizedToken = rawToken?.trim();

    if (!normalizedToken) {
      throw new BadRequestException("Davet tokeni zorunludur.");
    }

    return this.prisma.memberInvitation.findUnique({
      where: {
        tokenHash: this.hashToken(normalizedToken)
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            fullName: true,
            status: true,
            deletedAt: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  private resolveInvitationStatus(invitation: InvitationRecord) {
    if (invitation.acceptedAt) {
      return "accepted";
    }

    if (invitation.revokedAt) {
      return "revoked";
    }

    if (isExpired(invitation.expiresAt)) {
      return "expired";
    }

    return "pending";
  }

  private assertInvitationAcceptable(invitation: InvitationRecord) {
    const status = this.resolveInvitationStatus(invitation);

    if (status === "accepted") {
      throw new GoneException("Bu davet daha once kullanildi.");
    }

    if (status === "revoked") {
      throw new GoneException("Bu davet iptal edildi.");
    }

    if (status === "expired") {
      throw new GoneException("Bu davetin suresi doldu.");
    }
  }

  private async sendEmailVerificationForUser(
    user: AuthUserRecord,
    state?: EmailVerificationFlowState
  ): Promise<EmailVerificationDispatchResult> {
    const emailVerificationState = state ?? (await this.resolveEmailVerificationState());

    if (user.emailVerifiedAt) {
      return {
        ok: true,
        ...emailVerificationState,
        previewUrl: null
      };
    }

    if (!emailVerificationState.enabled) {
      return {
        ok: true,
        ...emailVerificationState,
        previewUrl: null
      };
    }

    const token = await this.createActionToken({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      type: AuthActionTokenType.EMAIL_VERIFICATION,
      expiresAt: addHours(new Date(), this.runtimeConfig.emailVerificationTtlHours)
    });

    const verificationUrl = this.toWebUrl(
      `/auth/verify-email?token=${encodeURIComponent(token.rawToken)}`
    );

    if (emailVerificationState.deliveryEnabled) {
      await this.notificationsService.send({
        tenantId: user.tenantId,
        channel: "email",
        to: user.email,
        subject: "Candit.ai e-posta dogrulama baglantisi",
        body: [
          `Merhaba ${user.fullName},`,
          "",
          "Hesabinizin e-posta adresini dogrulamak icin asagidaki baglantiyi kullanabilirsiniz."
        ].join("\n"),
        metadata: {
          primaryLink: verificationUrl,
          primaryCtaLabel: EMAIL_VERIFICATION_LABEL
        },
        templateKey: "auth_email_verification",
        eventType: "auth.email_verification_requested",
        requestedBy: user.id
      });
    }

    return {
      ok: true,
      ...emailVerificationState,
      expiresAt: token.expiresAt.toISOString(),
      previewUrl: this.runtimeConfig.isProduction ? null : verificationUrl
    };
  }

  private async resolveEmailVerificationState(): Promise<EmailVerificationFlowState> {
    const [required, deliveryEnabled] = await Promise.all([
      this.featureFlagsService.isGlobalEnabled(
        AUTH_EMAIL_VERIFICATION_REQUIRED_FLAG,
        false
      ),
      this.featureFlagsService.isGlobalEnabled(
        AUTH_EMAIL_VERIFICATION_SEND_EMAIL_FLAG,
        false
      )
    ]);

    return {
      enabled: required || deliveryEnabled,
      required,
      deliveryEnabled
    };
  }

  private async isEmailVerificationRequired() {
    return this.featureFlagsService.isGlobalEnabled(AUTH_EMAIL_VERIFICATION_REQUIRED_FLAG, false);
  }

  private async createActionToken(input: {
    tenantId?: string;
    userId?: string;
    email: string;
    type: AuthActionTokenType;
    expiresAt: Date;
    payloadJson?: Prisma.InputJsonValue;
  }) {
    const rawToken = randomBytes(48).toString("base64url");
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.$transaction(async (tx) => {
      await tx.authActionToken.updateMany({
        where: {
          type: input.type,
          email: input.email,
          userId: input.userId ?? undefined,
          consumedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      await tx.authActionToken.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          email: input.email,
          type: input.type,
          tokenHash,
          payloadJson: input.payloadJson,
          expiresAt: input.expiresAt
        }
      });
    });

    return {
      rawToken,
      expiresAt: input.expiresAt
    };
  }

  private async findActionTokenByRawToken(
    rawToken: string,
    type: AuthActionTokenType
  ): Promise<ActionTokenRecord | null> {
    const normalizedToken = rawToken?.trim();

    if (!normalizedToken) {
      throw new BadRequestException("Token zorunludur.");
    }

    return this.prisma.authActionToken.findUnique({
      where: {
        tokenHash: this.hashToken(normalizedToken)
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        email: true,
        type: true,
        expiresAt: true,
        consumedAt: true,
        revokedAt: true,
        payloadJson: true,
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            deletedAt: true,
            passwordHash: true,
            emailVerifiedAt: true,
            avatarUrl: true
          }
        }
      }
    }).then((token) => {
      if (!token || token.type !== type) {
        return null;
      }

      return token;
    });
  }

  private resolveActionTokenStatus(token: ActionTokenRecord) {
    if (token.consumedAt) {
      return "used";
    }

    if (token.revokedAt) {
      return "revoked";
    }

    if (isExpired(token.expiresAt)) {
      return "expired";
    }

    return "pending";
  }

  private assertActionTokenUsable(token: ActionTokenRecord, expiredMessage: string) {
    const status = this.resolveActionTokenStatus(token);

    if (status === "used") {
      throw new GoneException("Bu baglanti daha once kullanildi.");
    }

    if (status === "revoked") {
      throw new GoneException("Bu baglanti iptal edildi.");
    }

    if (status === "expired") {
      throw new GoneException(expiredMessage);
    }
  }

  private async resolveTenantIdForOauthEmail(
    email: string,
    intent: "login" | "signup"
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        email,
        deletedAt: null
      },
      select: {
        tenantId: true
      },
      distinct: ["tenantId"],
      take: 2
    });

    if (users.length === 1) {
      return users[0]?.tenantId;
    }

    if (users.length > 1) {
      throw new BadRequestException(
        "Bu Google hesabı birden fazla hesaba bağlı. Lütfen destek ekibiyle iletişime geçin."
      );
    }

    if (intent === "login") {
      return undefined;
    }

    return undefined;
  }

  private async syncGoogleIdentity(user: AuthUserRecord, profile: GoogleIdentityProfile) {
    return this.linkGoogleIdentityToUser(user, profile);
  }

  private async linkGoogleIdentityToUser(user: AuthUserRecord, profile: GoogleIdentityProfile) {
    if (user.deletedAt) {
      throw new NotFoundException("Kullanici bulunamadi.");
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException("Bu kullanici pasif durumda.");
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (user.status === UserStatus.INVITED) {
        const latestInvitation = await tx.memberInvitation.findFirst({
          where: {
            userId: user.id,
            tenantId: user.tenantId,
            acceptedAt: null,
            revokedAt: null
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true
          }
        });

        if (latestInvitation) {
          await tx.memberInvitation.update({
            where: {
              id: latestInvitation.id
            },
            data: {
              acceptedAt: now
            }
          });
        }

        await tx.memberInvitation.updateMany({
          where: {
            userId: user.id,
            tenantId: user.tenantId,
            acceptedAt: null,
            revokedAt: null,
            ...(latestInvitation
              ? {
                  id: {
                    not: latestInvitation.id
                  }
                }
              : {})
          },
          data: {
            revokedAt: now
          }
        });
      }

      const updatedUser = await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          status: UserStatus.ACTIVE,
          fullName: profile.fullName || user.fullName,
          avatarUrl: profile.avatarUrl ?? user.avatarUrl ?? null,
          emailVerifiedAt: now
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          deletedAt: true,
          passwordHash: true,
          emailVerifiedAt: true,
          avatarUrl: true
        }
      });

      await tx.userIdentity.upsert({
        where: {
          userId_provider: {
            userId: user.id,
            provider: AuthProvider.GOOGLE
          }
        },
        update: {
          providerSubject: profile.subject,
          email: profile.email,
          displayName: profile.fullName,
          avatarUrl: profile.avatarUrl ?? null
        },
        create: {
          tenantId: user.tenantId,
          userId: user.id,
          provider: AuthProvider.GOOGLE,
          providerSubject: profile.subject,
          email: profile.email,
          displayName: profile.fullName,
          avatarUrl: profile.avatarUrl ?? null
        }
      });

      return updatedUser;
    });
  }

  private async provisionGoogleSignup(input: {
    email: string;
    fullName: string;
    avatarUrl: string | null;
    providerSubject: string;
    companyName?: string;
  }) {
    await this.assertEmailAvailableForNewAccount(input.email);

    const fallbackCompanyName =
      input.companyName && input.companyName.length >= 2
        ? input.companyName
        : `${input.fullName.split(" ")[0] || input.email.split("@")[0] || "Yeni"} Workspace`;
    const tenantId = await this.generateTenantId(fallbackCompanyName);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: fallbackCompanyName
        },
        select: {
          id: true
        }
      });

      await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: "Ana Calisma Alani"
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          fullName: input.fullName,
          role: "OWNER",
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
          avatarUrl: input.avatarUrl
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          deletedAt: true,
          passwordHash: true,
          emailVerifiedAt: true,
          avatarUrl: true
        }
      });

      await tx.userIdentity.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          provider: AuthProvider.GOOGLE,
          providerSubject: input.providerSubject,
          email: input.email,
          displayName: input.fullName,
          avatarUrl: input.avatarUrl
        }
      });

      return user;
    });
  }

  private toWebUrl(pathname: string) {
    const base = this.runtimeConfig.publicWebBaseUrl.replace(/\/+$/, "");
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${base}${path}`;
  }

  private toPublicUser(user: AuthUserRecord): PublicAuthUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      roles: this.toAppRoles(user.role),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      avatarUrl: user.avatarUrl ?? null
    };
  }

  private async reportSecurityEvent(input: {
    tenantId?: string | null;
    userId?: string | null;
    sessionId?: string | null;
    source: string;
    code: string;
    message: string;
    severity?: SecurityEventSeverity;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    try {
      await this.securityEventsService.recordSecurityEvent(input);
    } catch {
      // Security telemetry should never break the primary auth flow.
    }
  }

  private async writeAuditLog(input: {
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId ?? null,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata })
      }
    });
  }

  private async revokeSession(sessionId: string, reason: string) {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: {
          id: sessionId,
          status: AuthSessionStatus.ACTIVE
        },
        data: {
          status: AuthSessionStatus.REVOKED,
          revokedAt: now,
          revokedReason: reason
        }
      }),
      this.prisma.authRefreshToken.updateMany({
        where: {
          sessionId,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedReason: reason
        }
      })
    ]);
  }

  private async signAccessToken(payload: AccessTokenPayload) {
    const jwtSecret = this.configService.get<string>("JWT_SECRET");

    if (!jwtSecret || jwtSecret === "change-me") {
      throw new Error("JWT_SECRET ayari guvenli bir deger ile set edilmelidir.");
    }

    return this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: this.runtimeConfig.accessTokenTtlMinutes * 60
    });
  }

  private async createRefreshTokenRecord(
    tx: Prisma.TransactionClient | PrismaService,
    input: {
      sessionId: string;
      tenantId: string;
      userId: string;
      parentTokenId?: string;
    }
  ) {
    const rawToken = randomBytes(48).toString("base64url");
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = addDays(new Date(), this.runtimeConfig.refreshTokenTtlDays);

    const token = await tx.authRefreshToken.create({
      data: {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: hashedToken,
        parentTokenId: input.parentTokenId,
        expiresAt
      }
    });

    return {
      id: token.id,
      rawToken,
      expiresAt
    };
  }

  private hashToken(rawToken: string) {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  private async findUsersByEmail(email: string) {
    return this.prisma.user.findMany({
      where: {
        email,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        avatarUrl: true
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 2
    });
  }

  private async findUniqueUserByEmail(
    email: string,
    notFoundMessage: string,
    ambiguousMessage: string
  ) {
    const users = await this.findUsersByEmail(email);

    if (users.length === 0) {
      throw new UnauthorizedException(notFoundMessage);
    }

    if (users.length > 1) {
      throw new BadRequestException(ambiguousMessage);
    }

    return users[0]!;
  }

  private async assertEmailAvailableForNewAccount(email: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (existingUser) {
      throw new ConflictException(
        "Bu e-posta adresiyle zaten bir hesap var. Lütfen giriş yapın."
      );
    }
  }

  private async generateTenantId(companyName: string) {
    const base = normalizeSlugPart(companyName).slice(0, 24) || "tenant";

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
      const candidate = `ten_${base}${suffix}`;

      const existing = await this.prisma.tenant.findUnique({
        where: {
          id: candidate
        },
        select: {
          id: true
        }
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException("Tenant kimligi olusturulamadi. Lutfen farkli bir sirket adi deneyin.");
  }

  private toAppRoles(role: PrismaRole): AppRole[] {
    return [this.toAppRole(role)];
  }

  private toAppRole(role: PrismaRole): AppRole {
    switch (role) {
      case "OWNER":
        return "owner";
      case "MANAGER":
        return "manager";
      case "STAFF":
        return "staff";
      default:
        return "staff";
    }
  }
}
