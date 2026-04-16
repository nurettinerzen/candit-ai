import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject
} from "@nestjs/common";
import { AuditActorType, AuthSessionStatus, Prisma, Role, UserStatus } from "@prisma/client";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthService } from "../auth/auth.service";
import { BillingService } from "../billing/billing.service";

type MemberRoleInput = "manager" | "staff";
type EditableMemberRoleInput = "owner" | "manager" | "staff";

function toInvitationLink(baseUrl: string, token: string) {
  return `${baseUrl}/auth/invitations/accept?token=${encodeURIComponent(token)}`;
}

function asRole(role: EditableMemberRoleInput): Role {
  switch (role) {
    case "owner":
      return Role.OWNER;
    case "manager":
      return Role.MANAGER;
    case "staff":
    default:
      return Role.STAFF;
  }
}

function buildDeletedUserEmail(email: string, userId: string) {
  const [localPart, domainPart] = email.toLowerCase().trim().split("@");
  const safeLocal = (localPart || "deleted").replace(/[^a-z0-9._+-]/g, "") || "deleted";
  const safeDomain =
    (domainPart || "deleted.local").replace(/[^a-z0-9.-]/g, "") || "deleted.local";

  return `${safeLocal}+deleted-${userId.toLowerCase()}@${safeDomain}`;
}

function toApiRole(role: Role): "owner" | "manager" | "staff" {
  switch (role) {
    case Role.OWNER:
      return "owner";
    case Role.MANAGER:
      return "manager";
    case Role.STAFF:
    default:
      return "staff";
  }
}

@Injectable()
export class MembersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async list(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: [
        {
          role: "asc"
        },
        {
          createdAt: "asc"
        }
      ],
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        memberInvitations: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true
          }
        }
      }
    });

    return users.map((user) => {
      const latestInvitation = user.memberInvitations[0] ?? null;
      const hasPendingInvitation = Boolean(
        latestInvitation &&
          !latestInvitation.acceptedAt &&
          !latestInvitation.revokedAt &&
          latestInvitation.expiresAt.getTime() > Date.now()
      );

      return {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        role: toApiRole(user.role),
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        invitedAt: latestInvitation?.createdAt.toISOString() ?? null,
        pendingInvitationExpiresAt: hasPendingInvitation
          ? latestInvitation?.expiresAt.toISOString() ?? null
          : null,
        hasPendingInvitation,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString()
      };
    });
  }

  async inviteMember(input: {
    tenantId: string;
    actorUserId: string;
    fullName: string;
    email: string;
    role: MemberRoleInput;
    traceId?: string;
  }) {
    await this.billingService.assertCanInviteMember(input.tenantId);

    const email = input.email.toLowerCase().trim();
    const fullName = input.fullName.trim();

    if (!email || !fullName) {
      throw new BadRequestException("Ad soyad ve e-posta zorunludur.");
    }

    const existingUsers = await this.prisma.user.findMany({
      where: {
        email,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        deletedAt: true
      },
      take: 2
    });
    const existingUser = existingUsers.find((user) => user.tenantId === input.tenantId);
    const otherTenantUser = existingUsers.find((user) => user.tenantId !== input.tenantId);

    if (otherTenantUser) {
      throw new ConflictException("Bu e-posta adresi başka bir Candit hesabında kullanılıyor.");
    }

    if (existingUser?.deletedAt) {
      throw new ConflictException("Silinmiş kullanıcı için yeni davet oluşturulamaz.");
    }

    if (existingUser?.status === UserStatus.ACTIVE) {
      throw new ConflictException("Bu e-posta adresi ile aktif bir kullanıcı zaten bulunuyor.");
    }

    if (existingUser?.status === UserStatus.INVITED) {
      throw new ConflictException("Bu kullanıcı zaten davet edildi. Yeniden göndermek için tekrar davet et akışını kullanın.");
    }

    if (existingUser?.status === UserStatus.DISABLED) {
      throw new ConflictException("Bu kullanıcı pasif durumda. Yeniden etkinleştirme işlemini kullanın.");
    }

    const invitationToken = await this.authService.createInvitationToken();
    const role = asRole(input.role);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: input.tenantId,
          email,
          fullName,
          role,
          status: UserStatus.INVITED
        },
        select: {
          id: true,
          email: true,
          fullName: true
        }
      });

      const invitation = await tx.memberInvitation.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          invitedBy: input.actorUserId,
          email,
          role,
          tokenHash: invitationToken.tokenHash,
          expiresAt: invitationToken.expiresAt
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: AuditActorType.USER,
          action: "member.invited",
          entityType: "User",
          entityId: user.id,
          traceId: input.traceId,
          metadata: {
            email,
            role: toApiRole(role),
            invitationId: invitation.id
          } satisfies Prisma.InputJsonValue
        }
      });

      return {
        user,
        invitation
      };
    });

    const invitationUrl = toInvitationLink(this.runtimeConfig.publicWebBaseUrl, invitationToken.rawToken);

    await this.notificationsService.send({
      tenantId: input.tenantId,
      channel: "email",
      to: email,
      subject: "AI Interviewer davetiniz hazir",
      body: [
        `Merhaba ${fullName},`,
        "",
        "AI Interviewer hesabiniz olusturuldu.",
        "Davet linkine tiklayarak sifrenizi belirleyebilir ve oturumu baslatabilirsiniz."
      ].join("\n"),
      metadata: {
        primaryLink: invitationUrl,
        primaryCtaLabel: "Daveti Kabul Et"
      },
      templateKey: "member_invitation",
      eventType: "member_invitation",
      requestedBy: input.actorUserId,
      traceId: input.traceId
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
      role: toApiRole(role),
      status: UserStatus.INVITED,
      invitedAt: result.invitation.createdAt.toISOString(),
      expiresAt: result.invitation.expiresAt.toISOString(),
      invitationUrl: this.runtimeConfig.isProduction ? null : invitationUrl
    };
  }

  async resendInvitation(input: {
    tenantId: string;
    actorUserId: string;
    userId: string;
    traceId?: string;
  }) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        passwordHash: true
      }
    });

    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    if (user.role === Role.OWNER) {
      throw new ForbiddenException("Hesap sahibi için davet yeniden gönderilemez.");
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException("Aktif kullanıcıya davet yeniden gönderilemez.");
    }

    if (user.status === UserStatus.DISABLED && user.passwordHash) {
      throw new ConflictException("Pasif kullanıcı için önce hesabı etkinleştirin.");
    }

    const invitationToken = await this.authService.createInvitationToken();

    const invitation = await this.prisma.$transaction(async (tx) => {
      if (user.status === UserStatus.DISABLED && !user.passwordHash) {
        await tx.user.update({
          where: {
            id: user.id
          },
          data: {
            status: UserStatus.INVITED
          }
        });
      }

      await tx.memberInvitation.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: input.userId,
          acceptedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      const created = await tx.memberInvitation.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          invitedBy: input.actorUserId,
          email: user.email,
          role: user.role,
          tokenHash: invitationToken.tokenHash,
          expiresAt: invitationToken.expiresAt
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: AuditActorType.USER,
          action: "member.invitation_resent",
          entityType: "User",
          entityId: user.id,
          traceId: input.traceId,
          metadata: {
            email: user.email,
            role: toApiRole(user.role),
            invitationId: created.id
          } satisfies Prisma.InputJsonValue
        }
      });

      return created;
    });

    const invitationUrl = toInvitationLink(this.runtimeConfig.publicWebBaseUrl, invitationToken.rawToken);

    await this.notificationsService.send({
      tenantId: input.tenantId,
      channel: "email",
      to: user.email,
      subject: "AI Interviewer davetiniz yenilendi",
      body: [
        `Merhaba ${user.fullName},`,
        "",
        "Hesabiniz icin yeni bir davet linki olusturuldu.",
        "Linke tiklayarak sifrenizi belirleyebilirsiniz."
      ].join("\n"),
      metadata: {
        primaryLink: invitationUrl,
        primaryCtaLabel: "Daveti Kabul Et"
      },
      templateKey: "member_invitation",
      eventType: "member_invitation",
      requestedBy: input.actorUserId,
      traceId: input.traceId
    });

    return {
      userId: user.id,
      invitedAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      invitationUrl: this.runtimeConfig.isProduction ? null : invitationUrl
    };
  }

  async updateRole(input: {
    tenantId: string;
    actorUserId: string;
    userId: string;
    role: EditableMemberRoleInput;
    traceId?: string;
  }) {
    const nextRole = asRole(input.role);
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        role: true,
        fullName: true
      }
    });

    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    if (user.role === nextRole) {
      return {
        userId: user.id,
        role: toApiRole(user.role)
      };
    }

    if (nextRole === Role.OWNER) {
      const transfer = await this.transferOwnership({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        userId: input.userId,
        traceId: input.traceId
      });

      return {
        userId: user.id,
        role: "owner" as const,
        previousOwnerUserId: transfer.previousOwnerUserId,
        nextOwnerUserId: transfer.nextOwnerUserId
      };
    }

    if (user.role === Role.OWNER) {
      throw new ForbiddenException("Hesap sahibi rolü başka bir kullanıcı seçilmeden kaldırılamaz.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          role: nextRole
        }
      });

      await tx.memberInvitation.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: input.userId,
          acceptedAt: null,
          revokedAt: null
        },
        data: {
          role: nextRole
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: AuditActorType.USER,
          action: "member.role_changed",
          entityType: "User",
          entityId: user.id,
          traceId: input.traceId,
          metadata: {
            previousRole: toApiRole(user.role),
            nextRole: toApiRole(nextRole)
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return {
      userId: user.id,
      role: toApiRole(nextRole)
    };
  }

  async removeMember(input: {
    tenantId: string;
    actorUserId: string;
    userId: string;
    traceId?: string;
  }) {
    if (input.userId === input.actorUserId) {
      throw new ForbiddenException("Kendi hesabınızı bu ekrandan silemezsiniz.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        role: true,
        email: true,
        fullName: true
      }
    });

    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    if (user.role === Role.OWNER) {
      throw new ForbiddenException("Hesap sahibi silinemez. Önce sahipliği devredin.");
    }

    const now = new Date();
    const deletedEmail = buildDeletedUserEmail(user.email, user.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: {
          userId: user.id,
          status: AuthSessionStatus.ACTIVE
        },
        data: {
          status: AuthSessionStatus.REVOKED,
          revokedAt: now,
          revokedReason: "member_deleted"
        }
      });

      await tx.authRefreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedReason: "member_deleted"
        }
      });

      await tx.authActionToken.updateMany({
        where: {
          OR: [{ userId: user.id }, { email: user.email }],
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await tx.memberInvitation.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: user.id,
          acceptedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await tx.userIdentity.deleteMany({
        where: {
          userId: user.id
        }
      });

      await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          status: UserStatus.DISABLED,
          deletedAt: now,
          email: deletedEmail,
          passwordHash: null,
          passwordSetAt: null,
          emailVerifiedAt: null,
          avatarUrl: null,
          lastLoginAt: null
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: AuditActorType.USER,
          action: "member.deleted",
          entityType: "User",
          entityId: user.id,
          traceId: input.traceId,
          metadata: {
            deletedUserEmail: user.email,
            deletedUserName: user.fullName
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return {
      userId: user.id
    };
  }

  async updateStatus(input: {
    tenantId: string;
    actorUserId: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
    traceId?: string;
  }) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        role: true,
        status: true,
        passwordHash: true
      }
    });

    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    if (user.role === Role.OWNER && input.status === "DISABLED") {
      throw new ForbiddenException("Hesap sahibi pasiflestirilemez.");
    }

    if (input.userId === input.actorUserId && user.role === Role.OWNER && input.status === "DISABLED") {
      throw new ForbiddenException("Hesap sahibi kendini pasiflestiremez.");
    }

    if (input.status === "ACTIVE" && !user.passwordHash) {
      throw new ConflictException("Sifre belirlemeyen davetli kullanici dogrudan aktiflestirilemez.");
    }

    if (input.status === "ACTIVE" && user.status !== UserStatus.ACTIVE) {
      await this.billingService.assertCanInviteMember(input.tenantId);
    }

    if (user.status === input.status) {
      return {
        userId: user.id,
        status: user.status
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          status: input.status
        }
      });

      if (input.status === "DISABLED") {
        await tx.memberInvitation.updateMany({
          where: {
            tenantId: input.tenantId,
            userId: input.userId,
            acceptedAt: null,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: AuditActorType.USER,
          action: input.status === "DISABLED" ? "member.disabled" : "member.enabled",
          entityType: "User",
          entityId: user.id,
          traceId: input.traceId
        }
      });
    });

    return {
      userId: user.id,
      status: input.status
    };
  }

  async transferOwnership(input: {
    tenantId: string;
    actorUserId: string;
    userId: string;
    traceId?: string;
  }) {
    if (input.userId === input.actorUserId) {
      throw new BadRequestException("Hesap sahipligi ayni kullaniciya devredilemez.");
    }

    const [currentOwner, targetUser] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: input.actorUserId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: {
          id: true,
          role: true
        }
      }),
      this.prisma.user.findFirst({
        where: {
          id: input.userId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: {
          id: true,
          role: true,
          status: true,
          fullName: true
        }
      })
    ]);

    if (!currentOwner || currentOwner.role !== Role.OWNER) {
      throw new ForbiddenException("Sahiplik devri icin owner hesabiyla islem yapilmalidir.");
    }

    if (!targetUser) {
      throw new NotFoundException("Hedef kullanıcı bulunamadı.");
    }

    if (targetUser.status !== UserStatus.ACTIVE) {
      throw new ConflictException("Sahiplik sadece aktif kullaniciya devredilebilir.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: currentOwner.id
        },
        data: {
          role: Role.MANAGER
        }
      });

      await tx.user.update({
        where: {
          id: targetUser.id
        },
        data: {
          role: Role.OWNER
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: AuditActorType.USER,
          action: "member.ownership_transferred",
          entityType: "User",
          entityId: targetUser.id,
          traceId: input.traceId,
          metadata: {
            previousOwnerUserId: currentOwner.id,
            nextOwnerUserId: targetUser.id,
            nextOwnerName: targetUser.fullName
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return {
      previousOwnerUserId: currentOwner.id,
      nextOwnerUserId: targetUser.id
    };
  }
}
