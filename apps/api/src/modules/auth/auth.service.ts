import {
  ForbiddenException,
  Injectable,
  UnauthorizedException, Inject} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Role as AppRole } from "@ai-interviewer/domain";
import {
  AuthSessionStatus,
  type Prisma,
  type Role as PrismaRole
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";

type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  roles: AppRole[];
  email: string;
  sid: string;
  tokenType: "access";
};

type SessionClientMeta = {
  ipAddress?: string;
  userAgent?: string;
};

const REFRESH_TOKEN_ROTATED_REASON = "rotated";

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isExpired(date: Date) {
  return date.getTime() <= Date.now();
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async login(
    input: { email: string; password: string; tenantId: string },
    meta: SessionClientMeta = {}
  ) {
    if (!this.runtimeConfig.allowDemoCredentialLogin) {
      throw new ForbiddenException("Bu ortamda demo credential login kapali.");
    }

    const devPassword = this.configService.get<string>("DEV_LOGIN_PASSWORD") ?? "demo12345";

    if (input.password !== devPassword) {
      throw new UnauthorizedException("E-posta veya sifre hatali.");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: input.tenantId,
          email: input.email.toLowerCase().trim()
        }
      },
      include: {
        roleBindings: {
          select: { role: true }
        }
      }
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException("Kullanıcı bulunamadı.");
    }

    if (user.status === "DISABLED") {
      throw new ForbiddenException("Kullanici pasif durumda.");
    }

    const roles = user.roleBindings.map((binding) => this.toAppRole(binding.role));

    if (roles.length === 0) {
      throw new ForbiddenException("Kullanıcıya atanmış rol bulunamadı.");
    }

    const now = new Date();
    const sessionExpiresAt = addDays(now, this.runtimeConfig.sessionTtlDays);

    const session = await this.prisma.authSession.create({
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

    const refreshToken = await this.issueRefreshToken({
      sessionId: session.id,
      tenantId: user.tenantId,
      userId: user.id
    });

    const accessToken = await this.signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      roles,
      email: user.email,
      sid: session.id,
      tokenType: "access"
    });

    return {
      accessToken,
      refreshToken: refreshToken.rawToken,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles,
        fullName: user.fullName
      },
      session: {
        id: session.id,
        authMode: "jwt",
        expiresAt: session.expiresAt.toISOString()
      }
    };
  }

  async refresh(refreshToken: string, meta: SessionClientMeta = {}) {
    if (!refreshToken || refreshToken.trim().length < 20) {
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
          include: {
            roleBindings: {
              select: { role: true }
            }
          }
        }
      }
    });

    if (!tokenRecord) {
      throw new UnauthorizedException("Refresh token gecersiz veya suresi dolmus.");
    }

    if (tokenRecord.replacedByTokenId) {
      await this.revokeSession(tokenRecord.sessionId, "refresh_token_reuse_detected");
      throw new UnauthorizedException("Refresh token tekrar kullanimi tespit edildi.");
    }

    if (tokenRecord.revokedAt || isExpired(tokenRecord.expiresAt)) {
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

      throw new UnauthorizedException("Kullanici oturumu gecersiz.");
    }

    if (tokenRecord.user.deletedAt || tokenRecord.user.status === "DISABLED") {
      await this.revokeSession(session.id, "user_disabled_or_deleted");
      throw new UnauthorizedException("Kullanici oturumu gecersiz.");
    }

    const roles = tokenRecord.user.roleBindings.map((binding) => this.toAppRole(binding.role));

    if (roles.length === 0) {
      throw new ForbiddenException("Kullanıcıya atanmış rol bulunamadı.");
    }

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

  async verifyAccessToken(accessToken: string): Promise<Omit<AccessTokenPayload, "tokenType">> {
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
            deletedAt: true
          }
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException("Oturum gecersiz veya sonlandirilmis.");
    }

    if (session.user.deletedAt || session.user.status === "DISABLED") {
      await this.revokeSession(payload.sid, "user_disabled_or_deleted");
      throw new UnauthorizedException("Kullanici oturumu gecersiz.");
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
      roles: payload.roles,
      email: payload.email,
      sid: payload.sid
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

  private async issueRefreshToken(input: {
    sessionId: string;
    tenantId: string;
    userId: string;
  }) {
    return this.createRefreshTokenRecord(this.prisma, input);
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

  private toAppRole(role: PrismaRole): AppRole {
    switch (role) {
      case "ADMIN":
        return "admin";
      case "RECRUITER":
        return "recruiter";
      case "HIRING_MANAGER":
        return "hiring_manager";
      case "CANDIDATE":
        return "candidate";
      case "AGENCY_RECRUITER":
        return "agency_recruiter";
      default:
        return "candidate";
    }
  }
}
