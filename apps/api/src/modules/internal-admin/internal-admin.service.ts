import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AiTaskStatus,
  BillingAccountStatus,
  BillingGrantSource,
  BillingPlanKey,
  BillingQuotaKey,
  IntegrationConnectionStatus,
  NotificationDeliveryStatus,
  PlatformIncidentStatus,
  Prisma,
  PublicLeadStatus,
  Role,
  TenantStatus,
  UserStatus
} from "@prisma/client";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { BILLING_PLAN_CATALOG, buildPlanSnapshot } from "../billing/billing-catalog";
import { BillingService } from "../billing/billing.service";
import { NotificationsService } from "../notifications/notifications.service";

type AdminAlertCategory = "APPLICATION" | "SECURITY" | "ASSISTANT" | "OPERATIONS";
type AdminAlertSeverity = "critical" | "warning";

type AccountFilters = {
  query?: string;
  planKey?: BillingPlanKey | "ALL";
  status?: TenantStatus | "ALL";
};

type RedAlertFilters = {
  windowDays: number;
  category?: AdminAlertCategory | "ALL";
  severity?: AdminAlertSeverity | "ALL";
};

type PublicLeadFilters = {
  query?: string;
  status?: PublicLeadStatus | "ALL";
};

type PlanOverrideInput = {
  tenantId: string;
  actorUserId: string;
  actorEmail?: string;
  billingEmail?: string;
  planKey: BillingPlanKey;
  status: BillingAccountStatus;
  monthlyAmountCents?: number | null;
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: {
    advancedReporting: boolean;
    calendarIntegrations: boolean;
    brandedCandidateExperience: boolean;
    customIntegrations: boolean;
  };
  note?: string;
};

type EnterpriseCustomerInput = {
  actorUserId: string;
  actorEmail?: string;
  companyName: string;
  ownerFullName: string;
  ownerEmail: string;
  billingEmail: string;
  monthlyAmountCents: number;
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: {
    advancedReporting: boolean;
    calendarIntegrations: boolean;
    brandedCandidateExperience: boolean;
    customIntegrations: boolean;
  };
  note?: string;
};

type PlatformAlertItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  category: AdminAlertCategory;
  severity: AdminAlertSeverity;
  source: string;
  message: string;
  repeats: number;
  lastSeenAt: string;
  status: "OPEN";
};

function startOfCurrentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function formatPlanLabel(planKey: BillingPlanKey) {
  return BILLING_PLAN_CATALOG[planKey].label;
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

function quotaLabel(key: BillingQuotaKey) {
  switch (key) {
    case BillingQuotaKey.SEATS:
      return "Kullanıcı";
    case BillingQuotaKey.ACTIVE_JOBS:
      return "Aktif ilan";
    case BillingQuotaKey.CANDIDATE_PROCESSING:
      return "Aday işleme";
    case BillingQuotaKey.AI_INTERVIEWS:
      return "AI mülakat";
    default:
      return key;
  }
}

function positiveOrZero(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

@Injectable()
export class InternalAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  private assertInternalAdmin(email?: string | null) {
    if (this.runtimeConfig.isInternalAdmin(email)) {
      return;
    }

    throw new ForbiddenException("Bu alan yalnızca iç yönetim ekibi için açıktır.");
  }

  async getDashboard(viewerEmail?: string | null) {
    this.assertInternalAdmin(viewerEmail);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      todayCandidateProcessing,
      todayAiInterviews,
      planRows,
      redAlertSnapshot,
      enterpriseTenants,
      openLeadInbox
    ] = await Promise.all([
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          status: {
            not: TenantStatus.DELETED
          }
        }
      }),
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          status: TenantStatus.ACTIVE
        }
      }),
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          status: TenantStatus.SUSPENDED
        }
      }),
      this.prisma.billingUsageEvent.aggregate({
        where: {
          quotaKey: BillingQuotaKey.CANDIDATE_PROCESSING,
          occurredAt: {
            gte: since
          }
        },
        _sum: {
          quantity: true
        }
      }),
      this.prisma.billingUsageEvent.aggregate({
        where: {
          quotaKey: BillingQuotaKey.AI_INTERVIEWS,
          occurredAt: {
            gte: since
          }
        },
        _sum: {
          quantity: true
        }
      }),
      this.prisma.tenantBillingAccount.groupBy({
        by: ["currentPlanKey"],
        _count: {
          _all: true
        }
      }),
      this.getRedAlertSnapshot({
        windowDays: 7,
        category: "ALL",
        severity: "ALL"
      }),
      this.prisma.tenantBillingAccount.count({
        where: {
          currentPlanKey: BillingPlanKey.ENTERPRISE
        }
      }),
      this.prisma.publicLeadSubmission.count({
        where: {
          status: {
            in: [PublicLeadStatus.NEW, PublicLeadStatus.REVIEWING]
          }
        }
      })
    ]);

    const distribution = Object.values(BillingPlanKey).map((planKey) => ({
      key: planKey,
      label: formatPlanLabel(planKey),
      count: planRows.find((row) => row.currentPlanKey === planKey)?._count._all ?? 0
    }));

    return {
      summary: {
        totalCustomers: totalTenants,
        activeCustomers: activeTenants,
        suspendedCustomers: suspendedTenants,
        todayCandidateProcessing: todayCandidateProcessing._sum.quantity ?? 0,
        todayAiInterviews: todayAiInterviews._sum.quantity ?? 0,
        openAlerts: redAlertSnapshot.items.length,
        enterpriseCustomers: enterpriseTenants,
        openLeadInbox
      },
      planDistribution: distribution,
      quickLinks: {
        customers: totalTenants,
        redAlerts: redAlertSnapshot.items.length,
        enterprise: enterpriseTenants,
        leads: openLeadInbox
      }
    };
  }

  async getRedAlerts(filters: RedAlertFilters, viewerEmail?: string | null) {
    this.assertInternalAdmin(viewerEmail);
    return this.getRedAlertSnapshot(filters);
  }

  async listPublicLeads(filters: PublicLeadFilters, viewerEmail?: string | null) {
    this.assertInternalAdmin(viewerEmail);

    const query = filters.query?.trim();
    const where: Prisma.PublicLeadSubmissionWhereInput = {
      ...(filters.status && filters.status !== "ALL"
        ? {
            status: filters.status
          }
        : {}),
      ...(query
        ? {
            OR: [
              {
                fullName: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                email: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                company: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                message: {
                  contains: query,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const [rows, total, newCount, reviewingCount, contactedCount, archivedCount] =
      await Promise.all([
        this.prisma.publicLeadSubmission.findMany({
          where,
          orderBy: {
            lastSubmittedAt: "desc"
          },
          take: 200
        }),
        this.prisma.publicLeadSubmission.count({
          where
        }),
        this.prisma.publicLeadSubmission.count({
          where: {
            ...where,
            status: PublicLeadStatus.NEW
          }
        }),
        this.prisma.publicLeadSubmission.count({
          where: {
            ...where,
            status: PublicLeadStatus.REVIEWING
          }
        }),
        this.prisma.publicLeadSubmission.count({
          where: {
            ...where,
            status: PublicLeadStatus.CONTACTED
          }
        }),
        this.prisma.publicLeadSubmission.count({
          where: {
            ...where,
            status: PublicLeadStatus.ARCHIVED
          }
        })
      ]);

    return {
      filters: {
        query: query ?? "",
        status: filters.status ?? "ALL"
      },
      summary: {
        total,
        new: newCount,
        reviewing: reviewingCount,
        contacted: contactedCount,
        archived: archivedCount
      },
      rows
    };
  }

  async updatePublicLeadStatus(input: {
    leadId: string;
    actorEmail?: string | null;
    status: PublicLeadStatus;
  }) {
    this.assertInternalAdmin(input.actorEmail);

    const existingLead = await this.prisma.publicLeadSubmission.findUnique({
      where: {
        id: input.leadId
      }
    });

    if (!existingLead) {
      throw new NotFoundException("Lead kaydı bulunamadı.");
    }

    return this.prisma.publicLeadSubmission.update({
      where: {
        id: input.leadId
      },
      data: {
        status: input.status
      }
    });
  }

  private async getRedAlertSnapshot(filters: RedAlertFilters) {
    const since = new Date(Date.now() - filters.windowDays * 24 * 60 * 60 * 1000);

    const [
      storedIncidents,
      notificationFailures,
      aiFailures,
      billingAlerts,
      integrationAlerts
    ] = await Promise.all([
      this.prisma.platformIncident.findMany({
        where: {
          status: PlatformIncidentStatus.OPEN,
          lastSeenAt: {
            gte: since
          }
        },
        orderBy: {
          lastSeenAt: "desc"
        },
        select: {
          id: true,
          tenantId: true,
          category: true,
          severity: true,
          source: true,
          code: true,
          message: true,
          repeatCount: true,
          lastSeenAt: true
        }
      }),
      this.prisma.notificationDelivery.groupBy({
        by: ["tenantId", "providerKey", "templateKey", "errorMessage"],
        where: {
          status: NotificationDeliveryStatus.FAILED,
          failedAt: {
            gte: since
          }
        },
        _count: {
          _all: true
        },
        _max: {
          failedAt: true
        }
      }),
      this.prisma.aiTaskRun.groupBy({
        by: ["tenantId", "taskType", "providerKey", "errorMessage"],
        where: {
          status: {
            in: [AiTaskStatus.FAILED, AiTaskStatus.NEEDS_REVIEW]
          },
          createdAt: {
            gte: since
          }
        },
        _count: {
          _all: true
        },
        _max: {
          createdAt: true
        }
      }),
      this.prisma.tenantBillingAccount.findMany({
        where: {
          status: {
            in: [BillingAccountStatus.PAST_DUE, BillingAccountStatus.INCOMPLETE]
          }
        },
        select: {
          tenantId: true,
          status: true,
          updatedAt: true
        }
      }),
      this.prisma.integrationConnection.findMany({
        where: {
          status: {
            not: IntegrationConnectionStatus.ACTIVE
          }
        },
        select: {
          tenantId: true,
          provider: true,
          status: true,
          lastError: true,
          updatedAt: true
        }
      })
    ]);

    const tenantIds = Array.from(
      new Set([
        ...storedIncidents.map((row) => row.tenantId).filter((value): value is string => Boolean(value)),
        ...notificationFailures.map((row) => row.tenantId),
        ...aiFailures.map((row) => row.tenantId),
        ...billingAlerts.map((row) => row.tenantId),
        ...integrationAlerts.map((row) => row.tenantId)
      ])
    );

    const tenants = tenantIds.length
      ? await this.prisma.tenant.findMany({
          where: {
            id: {
              in: tenantIds
            }
          },
          select: {
            id: true,
            name: true
          }
        })
      : [];

    const tenantNameMap = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    const items: PlatformAlertItem[] = [];

    for (const row of storedIncidents) {
      const tenantId = row.tenantId ?? "platform";

      items.push({
        id: row.id,
        tenantId,
        tenantName: row.tenantId ? tenantNameMap.get(row.tenantId) ?? row.tenantId : "Platform",
        category: row.category,
        severity: row.severity === "CRITICAL" ? "critical" : "warning",
        source: row.source,
        message: row.message,
        repeats: row.repeatCount,
        lastSeenAt: row.lastSeenAt.toISOString(),
        status: "OPEN"
      });
    }

    for (const row of notificationFailures) {
      items.push({
        id: `notification:${row.tenantId}:${row.providerKey ?? "unknown"}:${row.templateKey ?? "generic"}:${row.errorMessage ?? "failed"}`,
        tenantId: row.tenantId,
        tenantName: tenantNameMap.get(row.tenantId) ?? row.tenantId,
        category: "APPLICATION",
        severity: row._count._all >= 3 ? "critical" : "warning",
        source: row.providerKey ?? row.templateKey ?? "E-posta teslimatı",
        message: row.errorMessage ?? "Bildirim teslimatı başarısız oldu.",
        repeats: row._count._all,
        lastSeenAt: (row._max.failedAt ?? since).toISOString(),
        status: "OPEN"
      });
    }

    for (const row of aiFailures) {
      items.push({
        id: `ai:${row.tenantId}:${row.taskType}:${row.providerKey ?? "model"}:${row.errorMessage ?? "issue"}`,
        tenantId: row.tenantId,
        tenantName: tenantNameMap.get(row.tenantId) ?? row.tenantId,
        category: "ASSISTANT",
        severity: row.taskType === "INTERVIEW_ORCHESTRATION" ? "critical" : "warning",
        source: row.providerKey ?? row.taskType,
        message: row.errorMessage ?? `${row.taskType} görevinde kalite uyarısı oluştu.`,
        repeats: row._count._all,
        lastSeenAt: (row._max.createdAt ?? since).toISOString(),
        status: "OPEN"
      });
    }

    for (const row of billingAlerts) {
      items.push({
        id: `billing:${row.tenantId}:${row.status}`,
        tenantId: row.tenantId,
        tenantName: tenantNameMap.get(row.tenantId) ?? row.tenantId,
        category: "OPERATIONS",
        severity: row.status === BillingAccountStatus.PAST_DUE ? "critical" : "warning",
        source: "Abonelik",
        message:
          row.status === BillingAccountStatus.PAST_DUE
            ? "Abonelik ödemesi gecikti."
            : "Abonelik kurulumu tamamlanmadı.",
        repeats: 1,
        lastSeenAt: row.updatedAt.toISOString(),
        status: "OPEN"
      });
    }

    for (const row of integrationAlerts) {
      items.push({
        id: `integration:${row.tenantId}:${row.provider}:${row.status}`,
        tenantId: row.tenantId,
        tenantName: tenantNameMap.get(row.tenantId) ?? row.tenantId,
        category: "OPERATIONS",
        severity: row.status === IntegrationConnectionStatus.ERROR ? "critical" : "warning",
        source: row.provider,
        message: row.lastError ?? `${row.provider} bağlantısı aktif değil.`,
        repeats: 1,
        lastSeenAt: row.updatedAt.toISOString(),
        status: "OPEN"
      });
    }

    const filteredItems = items
      .filter((item) => (filters.category && filters.category !== "ALL" ? item.category === filters.category : true))
      .filter((item) => (filters.severity && filters.severity !== "ALL" ? item.severity === filters.severity : true))
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

    const categories: Array<{ key: AdminAlertCategory; label: string; detail: string }> = [
      {
        key: "APPLICATION",
        label: "Uygulama hataları",
        detail: "Webhook, teslimat ve uygulama kaynaklı sorunlar"
      },
      {
        key: "SECURITY",
        label: "Güvenlik olayları",
        detail: "Oturum güvenliği ve şüpheli erişim sinyalleri"
      },
      {
        key: "ASSISTANT",
        label: "Asistan kalitesi",
        detail: "AI görevlerinde hata veya kalite düşüşü"
      },
      {
        key: "OPERATIONS",
        label: "Operasyon olayları",
        detail: "Abonelik, entegrasyon ve operasyon akışı sinyalleri"
      }
    ];

    return {
      filters: {
        windowDays: filters.windowDays,
        category: filters.category ?? "ALL",
        severity: filters.severity ?? "ALL"
      },
      summary: categories.map((category) => ({
        key: category.key,
        label: category.label,
        detail: category.detail,
        count: filteredItems.filter((item) => item.category === category.key).reduce((total, item) => total + item.repeats, 0)
      })),
      items: filteredItems
    };
  }

  async listAccounts(filters: AccountFilters, viewerEmail?: string | null) {
    this.assertInternalAdmin(viewerEmail);

    const query = filters.query?.trim();
    const tenants = await this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        status: filters.status && filters.status !== "ALL" ? filters.status : undefined,
        billingAccount:
          filters.planKey && filters.planKey !== "ALL"
            ? {
                currentPlanKey: filters.planKey
              }
            : undefined,
        OR: query
          ? [
              {
                name: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                users: {
                  some: {
                    deletedAt: null,
                    OR: [
                      {
                        fullName: {
                          contains: query,
                          mode: "insensitive"
                        }
                      },
                      {
                        email: {
                          contains: query,
                          mode: "insensitive"
                        }
                      }
                    ]
                  }
                }
              }
            ]
          : undefined
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        billingAccount: {
          select: {
            billingEmail: true,
            currentPlanKey: true,
            status: true
          }
        },
        users: {
          where: {
            deletedAt: null,
            role: Role.OWNER
          },
          take: 1,
          orderBy: {
            createdAt: "asc"
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    const rows = await Promise.all(
      tenants.map(async (tenant) => {
        const [billing, jobCount, candidateCount, applicationCount, interviewCount] = await Promise.all([
          this.billingService.getOverview(tenant.id, viewerEmail ?? undefined),
          this.prisma.job.count({
            where: {
              tenantId: tenant.id,
              archivedAt: null
            }
          }),
          this.prisma.candidate.count({
            where: {
              tenantId: tenant.id,
              deletedAt: null
            }
          }),
          this.prisma.candidateApplication.count({
            where: {
              tenantId: tenant.id
            }
          }),
          this.prisma.interviewSession.count({
            where: {
              tenantId: tenant.id
            }
          })
        ]);

        const owner = tenant.users[0] ?? null;

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantStatus: tenant.status,
          createdAt: tenant.createdAt.toISOString(),
          owner: owner
            ? {
                userId: owner.id,
                fullName: owner.fullName,
                email: owner.email,
                status: owner.status,
                lastLoginAt: owner.lastLoginAt?.toISOString() ?? null
              }
            : null,
          billing: {
            billingEmail: billing.account.billingEmail,
            currentPlanKey: billing.account.currentPlanKey,
            status: billing.account.status,
            currentPeriodEnd: billing.account.currentPeriodEnd,
            trial: {
              isActive: billing.trial.isActive,
              isExpired: billing.trial.isExpired,
              startedAt: billing.trial.startedAt,
              endsAt: billing.trial.endsAt,
              daysRemaining: billing.trial.daysRemaining
            }
          },
          usage: {
            seats: billing.usage.quotas.find((quota) => quota.key === "SEATS") ?? null,
            activeJobs: billing.usage.quotas.find((quota) => quota.key === "ACTIVE_JOBS") ?? null,
            candidateProcessing:
              billing.usage.quotas.find((quota) => quota.key === "CANDIDATE_PROCESSING") ?? null,
            aiInterviews:
              billing.usage.quotas.find((quota) => quota.key === "AI_INTERVIEWS") ?? null
          },
          counts: {
            jobs: jobCount,
            candidates: candidateCount,
            applications: applicationCount,
            interviews: interviewCount
          }
        };
      })
    );

    return {
      summary: {
        total: rows.length,
        active: rows.filter((row) => row.tenantStatus === TenantStatus.ACTIVE).length,
        suspended: rows.filter((row) => row.tenantStatus === TenantStatus.SUSPENDED).length,
        starter: rows.filter((row) => row.billing.currentPlanKey === BillingPlanKey.STARTER).length,
        growth: rows.filter((row) => row.billing.currentPlanKey === BillingPlanKey.GROWTH).length,
        enterprise: rows.filter((row) => row.billing.currentPlanKey === BillingPlanKey.ENTERPRISE).length,
        trialActive: rows.filter((row) => row.billing.trial.isActive).length,
        trialExpired: rows.filter((row) => row.billing.trial.isExpired).length,
        billingRisk: rows.filter((row) =>
          [
            BillingAccountStatus.PAST_DUE,
            BillingAccountStatus.INCOMPLETE,
            BillingAccountStatus.CANCELED
          ].includes(row.billing.status as BillingAccountStatus)
        ).length
      },
      rows
    };
  }

  async getAccountDetail(tenantId: string, viewerEmail?: string | null) {
    this.assertInternalAdmin(viewerEmail);

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: {
        id: true,
        name: true,
        locale: true,
        timezone: true,
        status: true,
        createdAt: true,
        users: {
          where: {
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
            lastLoginAt: true,
            createdAt: true
          }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundException("Müşteri hesabı bulunamadı.");
    }

    const owner = tenant.users.find((user) => user.role === Role.OWNER) ?? null;
    const billing = await this.billingService.getOverview(tenantId, viewerEmail ?? undefined);

    const [jobs, candidates, applications, interviews, recentNotifications, recentCheckouts] =
      await Promise.all([
        this.prisma.job.findMany({
          where: {
            tenantId,
            archivedAt: null
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true
          }
        }),
        this.prisma.candidate.count({
          where: {
            tenantId,
            deletedAt: null
          }
        }),
        this.prisma.candidateApplication.count({
          where: {
            tenantId
          }
        }),
        this.prisma.interviewSession.count({
          where: {
            tenantId
          }
        }),
        this.prisma.notificationDelivery.findMany({
          where: {
            tenantId
          },
          orderBy: {
            queuedAt: "desc"
          },
          take: 5,
          select: {
            id: true,
            channel: true,
            subject: true,
            toAddress: true,
            status: true,
            queuedAt: true,
            errorMessage: true
          }
        }),
        this.prisma.billingCheckoutSession.findMany({
          where: {
            tenantId
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 5,
          select: {
            id: true,
            checkoutType: true,
            status: true,
            label: true,
            billingEmail: true,
            checkoutUrl: true,
            amountCents: true,
            currency: true,
            createdAt: true
          }
        })
      ]);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        locale: tenant.locale,
        timezone: tenant.timezone,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString()
      },
      owner: owner
        ? {
            userId: owner.id,
            fullName: owner.fullName,
            email: owner.email,
            status: owner.status,
            lastLoginAt: owner.lastLoginAt?.toISOString() ?? null
          }
        : null,
      members: tenant.users.map((user) => ({
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString()
      })),
      billing,
      activity: {
        candidateCount: candidates,
        applicationCount: applications,
        interviewCount: interviews,
        recentJobs: jobs.map((job) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          createdAt: job.createdAt.toISOString()
        })),
        recentNotifications: recentNotifications.map((row) => ({
          ...row,
          queuedAt: row.queuedAt.toISOString()
        })),
        recentCheckouts: recentCheckouts.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString()
        }))
      }
    };
  }

  async updateAccountStatus(input: {
    tenantId: string;
    actorUserId: string;
    actorEmail?: string;
    status: TenantStatus;
  }) {
    this.assertInternalAdmin(input.actorEmail);

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: input.tenantId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!tenant) {
      throw new NotFoundException("Müşteri hesabı bulunamadı.");
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: {
          id: input.tenantId
        },
        data: {
          status: input.status
        }
      });

      if (input.status === TenantStatus.SUSPENDED || input.status === TenantStatus.DELETED) {
        await tx.authSession.updateMany({
          where: {
            tenantId: input.tenantId,
            status: "ACTIVE"
          },
          data: {
            status: "REVOKED",
            revokedAt: now,
            revokedReason: input.status === TenantStatus.DELETED ? "tenant_deleted_by_internal_admin" : "tenant_suspended_by_internal_admin"
          }
        });

        await tx.authRefreshToken.updateMany({
          where: {
            tenantId: input.tenantId,
            revokedAt: null
          },
          data: {
            revokedAt: now,
            revokedReason: input.status === TenantStatus.DELETED ? "tenant_deleted_by_internal_admin" : "tenant_suspended_by_internal_admin"
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: "USER",
          action: "tenant.status_updated",
          entityType: "Tenant",
          entityId: input.tenantId,
          metadata: {
            previousStatus: tenant.status,
            nextStatus: input.status
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return {
      ok: true,
      status: input.status
    };
  }

  async updateAccountPlan(input: PlanOverrideInput) {
    this.assertInternalAdmin(input.actorEmail);
    await this.prisma.tenant.findUniqueOrThrow({
      where: {
        id: input.tenantId
      },
      select: {
        id: true
      }
    });

    await this.billingService.getOverview(input.tenantId, input.actorEmail);
    await this.applyPlanOverride(input);

    return this.getAccountDetail(input.tenantId, input.actorEmail);
  }

  private async applyPlanOverride(input: PlanOverrideInput) {
    const now = new Date();
    const periodStart = startOfCurrentMonth(now);
    const periodEnd = startOfNextMonth(now);

    return this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.tenantBillingAccount.findUnique({
        where: {
          tenantId: input.tenantId
        }
      });

      const snapshot = {
        ...buildPlanSnapshot(BILLING_PLAN_CATALOG[input.planKey]),
        seatsIncluded: input.seatsIncluded,
        activeJobsIncluded: input.activeJobsIncluded,
        candidateProcessingIncluded: input.candidateProcessingIncluded,
        aiInterviewsIncluded: input.aiInterviewsIncluded,
        monthlyAmountCents: input.monthlyAmountCents ?? null,
        note: input.note ?? null
      };

      const account = existingAccount
        ? await tx.tenantBillingAccount.update({
            where: {
              tenantId: input.tenantId
            },
            data: {
              billingEmail: input.billingEmail ?? existingAccount.billingEmail,
              currentPlanKey: input.planKey,
              status: input.status,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              stripeSubscriptionId: null,
              lastCheckoutSessionId: null,
              featuresJson: input.features,
              planSnapshotJson: snapshot
            }
          })
        : await tx.tenantBillingAccount.create({
            data: {
              tenantId: input.tenantId,
              billingEmail: input.billingEmail ?? null,
              currentPlanKey: input.planKey,
              status: input.status,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              featuresJson: input.features,
              planSnapshotJson: snapshot
            }
          });

      await tx.tenantBillingSubscription.updateMany({
        where: {
          tenantId: input.tenantId,
          canceledAt: null,
          status: {
            in: [
              BillingAccountStatus.TRIALING,
              BillingAccountStatus.ACTIVE,
              BillingAccountStatus.PAST_DUE,
              BillingAccountStatus.INCOMPLETE
            ]
          }
        },
        data: {
          status: BillingAccountStatus.CANCELED,
          canceledAt: now
        }
      });

      await tx.tenantBillingSubscription.create({
        data: {
          tenantId: input.tenantId,
          accountId: account.id,
          planKey: input.planKey,
          status: input.status,
          billingEmail: input.billingEmail ?? account.billingEmail,
          periodStart,
          periodEnd,
          seatsIncluded: input.seatsIncluded,
          activeJobsIncluded: input.activeJobsIncluded,
          candidateProcessingIncluded: input.candidateProcessingIncluded,
          aiInterviewsIncluded: input.aiInterviewsIncluded,
          featuresJson: input.features,
          metadataJson: {
            internalOverride: true,
            monthlyAmountCents: input.monthlyAmountCents ?? null,
            note: input.note ?? null
          } satisfies Prisma.InputJsonValue,
          createdBy: input.actorUserId
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: "USER",
          action: "billing.plan_override",
          entityType: "TenantBillingAccount",
          entityId: account.id,
          metadata: {
            planKey: input.planKey,
            status: input.status,
            seatsIncluded: input.seatsIncluded,
            activeJobsIncluded: input.activeJobsIncluded,
            candidateProcessingIncluded: input.candidateProcessingIncluded,
            aiInterviewsIncluded: input.aiInterviewsIncluded,
            monthlyAmountCents: input.monthlyAmountCents ?? null
          } satisfies Prisma.InputJsonValue
        }
      });
    });
  }

  async createQuotaGrant(input: {
    tenantId: string;
    actorUserId: string;
    actorEmail?: string;
    label?: string;
    seats?: number;
    activeJobs?: number;
    candidateProcessing?: number;
    aiInterviews?: number;
  }) {
    this.assertInternalAdmin(input.actorEmail);
    await this.billingService.getOverview(input.tenantId, input.actorEmail);

    const account = await this.prisma.tenantBillingAccount.findUnique({
      where: {
        tenantId: input.tenantId
      }
    });

    if (!account) {
      throw new NotFoundException("Abonelik hesabı bulunamadı.");
    }

    const grants = [
      {
        key: BillingQuotaKey.SEATS,
        quantity: positiveOrZero(input.seats)
      },
      {
        key: BillingQuotaKey.ACTIVE_JOBS,
        quantity: positiveOrZero(input.activeJobs)
      },
      {
        key: BillingQuotaKey.CANDIDATE_PROCESSING,
        quantity: positiveOrZero(input.candidateProcessing)
      },
      {
        key: BillingQuotaKey.AI_INTERVIEWS,
        quantity: positiveOrZero(input.aiInterviews)
      }
    ].filter((grant) => grant.quantity > 0);

    if (grants.length === 0) {
      throw new BadRequestException("En az bir kota artışı girilmelidir.");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const grant of grants) {
        await tx.billingQuotaGrant.create({
          data: {
            tenantId: input.tenantId,
            accountId: account.id,
            quotaKey: grant.key,
            source: BillingGrantSource.MANUAL,
            label: input.label?.trim() || `${quotaLabel(grant.key)} manuel artırımı`,
            quantity: grant.quantity,
            createdBy: input.actorUserId,
            metadataJson: {
              internalAdmin: true
            } satisfies Prisma.InputJsonValue
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: "USER",
          action: "billing.manual_quota_grant",
          entityType: "TenantBillingAccount",
          entityId: account.id,
          metadata: {
            label: input.label?.trim() || null,
            grants
          } satisfies Prisma.InputJsonValue
        }
      });
    });

    return this.getAccountDetail(input.tenantId, input.actorEmail);
  }

  async sendOwnerResetInvite(input: {
    tenantId: string;
    actorUserId: string;
    actorEmail?: string;
  }) {
    this.assertInternalAdmin(input.actorEmail);

    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId: input.tenantId,
        role: Role.OWNER,
        deletedAt: null
      },
      select: {
        id: true,
        fullName: true,
        email: true
      }
    });

    if (!owner) {
      throw new NotFoundException("Hesap sahibi bulunamadı.");
    }

    const invitationToken = await this.authService.createInvitationToken();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.memberInvitation.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: owner.id,
          acceptedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await tx.user.update({
        where: {
          id: owner.id
        },
        data: {
          status: UserStatus.INVITED,
          passwordHash: null,
          passwordSetAt: null
        }
      });

      await tx.memberInvitation.create({
        data: {
          tenantId: input.tenantId,
          userId: owner.id,
          invitedBy: input.actorUserId,
          email: owner.email,
          role: Role.OWNER,
          tokenHash: invitationToken.tokenHash,
          expiresAt: invitationToken.expiresAt
        }
      });

      await tx.authSession.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: owner.id,
          status: "ACTIVE"
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokedReason: "owner_password_reset_by_internal_admin"
        }
      });

      await tx.authRefreshToken.updateMany({
        where: {
          tenantId: input.tenantId,
          userId: owner.id,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedReason: "owner_password_reset_by_internal_admin"
        }
      });
    });

    const invitationUrl = `${this.runtimeConfig.publicWebBaseUrl}/auth/invitations/accept?token=${encodeURIComponent(invitationToken.rawToken)}`;

    await this.notificationsService.send({
      tenantId: input.tenantId,
      channel: "email",
      to: owner.email,
      subject: "Candit yönetici erişim linkiniz hazır",
      body: [
        `Merhaba ${owner.fullName},`,
        "",
        "İç yönetim ekibi hesabınız için yeni bir şifre belirleme bağlantısı oluşturdu.",
        "Aşağıdaki bağlantıdan şifrenizi belirleyip tekrar giriş yapabilirsiniz."
      ].join("\n"),
      metadata: {
        primaryLink: invitationUrl,
        primaryCtaLabel: "Şifreyi Belirle"
      },
      templateKey: "internal_admin_password_reset",
      eventType: "internal_admin_password_reset",
      requestedBy: input.actorUserId
    });

    return {
      sent: true,
      email: owner.email
    };
  }

  async listEnterpriseAccounts(filters: Omit<AccountFilters, "planKey">, viewerEmail?: string | null) {
    return this.listAccounts(
      {
        ...filters,
        planKey: BillingPlanKey.ENTERPRISE
      },
      viewerEmail
    );
  }

  async createEnterpriseCustomer(input: EnterpriseCustomerInput) {
    this.assertInternalAdmin(input.actorEmail);

    if (input.monthlyAmountCents <= 0) {
      throw new BadRequestException("Aylık fiyat 0'dan büyük olmalıdır.");
    }

    const tenantId = await this.generateTenantId(input.companyName);
    const normalizedOwnerEmail = input.ownerEmail.trim().toLowerCase();
    const normalizedBillingEmail = input.billingEmail.trim().toLowerCase();
    const companyName = input.companyName.trim();
    const ownerFullName = input.ownerFullName.trim();

    const tenant = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
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
          tenantId: createdTenant.id,
          name: "Ana Çalışma Alanı"
        }
      });

      await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          email: normalizedOwnerEmail,
          fullName: ownerFullName,
          role: Role.OWNER,
          status: UserStatus.INVITED
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: createdTenant.id,
          actorUserId: input.actorUserId,
          actorType: "USER",
          action: "internal_admin.enterprise_customer_created",
          entityType: "Tenant",
          entityId: createdTenant.id,
          metadata: {
            ownerEmail: normalizedOwnerEmail,
            billingEmail: normalizedBillingEmail
          } satisfies Prisma.InputJsonValue
        }
      });

      return createdTenant;
    });

    await this.applyPlanOverride({
      tenantId: tenant.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      billingEmail: normalizedBillingEmail,
      planKey: BillingPlanKey.ENTERPRISE,
      status: BillingAccountStatus.INCOMPLETE,
      monthlyAmountCents: input.monthlyAmountCents,
      seatsIncluded: input.seatsIncluded,
      activeJobsIncluded: input.activeJobsIncluded,
      candidateProcessingIncluded: input.candidateProcessingIncluded,
      aiInterviewsIncluded: input.aiInterviewsIncluded,
      features: input.features,
      note: input.note
    });

    let checkoutUrl: string | null = null;
    let sessionId: string | null = null;
    let linkSent = false;

    if (this.runtimeConfig.stripeBillingConfig.apiKeyConfigured) {
      const checkout = await this.billingService.createEnterpriseOfferCheckoutSession({
        tenantId: tenant.id,
        requestedBy: input.actorUserId,
        requestedByEmail: input.actorEmail,
        billingEmail: normalizedBillingEmail,
        monthlyAmountCents: input.monthlyAmountCents,
        seatsIncluded: input.seatsIncluded,
        activeJobsIncluded: input.activeJobsIncluded,
        candidateProcessingIncluded: input.candidateProcessingIncluded,
        aiInterviewsIncluded: input.aiInterviewsIncluded,
        features: input.features,
        note: input.note
      });

      checkoutUrl = checkout.checkoutUrl ?? null;
      sessionId = checkout.sessionId ?? null;

      if (sessionId) {
        await this.billingService.sendCheckoutLink({
          tenantId: tenant.id,
          checkoutSessionId: sessionId,
          email: normalizedBillingEmail,
          requestedBy: input.actorUserId,
          requestedByEmail: input.actorEmail
        });
        linkSent = true;
      }
    }

    return {
      tenantId: tenant.id,
      checkoutUrl,
      sessionId,
      linkSent,
      stripeReady: this.runtimeConfig.stripeBillingConfig.apiKeyConfigured
    };
  }

  private async generateTenantId(companyName: string) {
    const base = normalizeSlugPart(companyName) || "tenant";
    const direct = `ten_${base}`;
    const exists = await this.prisma.tenant.findUnique({
      where: {
        id: direct
      },
      select: {
        id: true
      }
    });

    if (!exists) {
      return direct;
    }

    let suffix = 2;
    while (suffix < 10_000) {
      const candidate = `${direct}_${suffix}`;
      const collision = await this.prisma.tenant.findUnique({
        where: {
          id: candidate
        },
        select: {
          id: true
        }
      });

      if (!collision) {
        return candidate;
      }

      suffix += 1;
    }

    throw new BadRequestException("Yeni müşteri kaydı için benzersiz tenant ID üretilemedi.");
  }
}
