import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BillingAccountStatus,
  BillingAddonKey,
  BillingCheckoutStatus,
  BillingCheckoutType,
  BillingGrantSource,
  BillingPlanChangeKind,
  BillingPlanKey,
  BillingQuotaKey,
  Prisma,
  TenantBillingAccount
} from "@prisma/client";
import StripeConstructor from "stripe";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  BILLING_ADDON_ROLLOVER_DAYS,
  BILLING_ADDON_CATALOG,
  BILLING_PLAN_CATALOG,
  buildPlanSnapshot,
  buildTrialSnapshot,
  FREE_TRIAL_DEFINITION,
  type BillingAddonDefinition,
  type BillingFeatureKey,
  type BillingPlanDefinition,
  type BillingTrialDefinition
} from "./billing-catalog";

type ResolvedBillingState = {
  account: {
    id: string;
    tenantId: string;
    billingEmail: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPlanKey: BillingPlanKey;
    status: BillingAccountStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    features: Record<BillingFeatureKey, boolean>;
    snapshot: {
      seatsIncluded: number;
      activeJobsIncluded: number;
      candidateProcessingIncluded: number;
      aiInterviewsIncluded: number;
    };
    pendingChange: {
      planKey: BillingPlanKey;
      kind: BillingPlanChangeKind;
      effectiveAt: Date;
      requestedAt: Date | null;
      requestedBy: string | null;
    } | null;
    scheduledCancellation: {
      effectiveAt: Date;
      requestedAt: Date | null;
      requestedBy: string | null;
      canResume: boolean;
    } | null;
  };
  subscription: {
    id: string;
    planKey: BillingPlanKey;
    status: BillingAccountStatus;
    stripeSubscriptionId: string | null;
    periodStart: Date;
    periodEnd: Date;
    seatsIncluded: number;
    activeJobsIncluded: number;
    candidateProcessingIncluded: number;
    aiInterviewsIncluded: number;
    features: Record<BillingFeatureKey, boolean>;
  };
  trial: {
    isActive: boolean;
    isExpired: boolean;
    isEligible: boolean;
    blockReason: string | null;
    startedAt: Date | null;
    endsAt: Date | null;
    daysRemaining: number;
    config: BillingTrialDefinition;
  };
  addOnTotals: Record<BillingQuotaKey, number>;
  usage: Record<BillingQuotaKey, number>;
  limits: Record<BillingQuotaKey, number>;
  access: {
    isAllowed: boolean;
    blockReason: string | null;
  };
};

function startOfCurrentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function parseOptionalDate(value: unknown) {
  if (!(typeof value === "string" || value instanceof Date)) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsUtc(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function normalizeTrialEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const [localPart = "", rawDomain = ""] = trimmed.split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  const localWithoutPlus = localPart.split("+")[0] ?? localPart;
  const normalizedLocal =
    domain === "gmail.com" ? localWithoutPlus.replace(/\./g, "") : localWithoutPlus;

  return `${normalizedLocal}@${domain}`;
}

function extractEmailDomain(email: string) {
  const normalized = normalizeTrialEmail(email);
  return normalized.split("@")[1] ?? null;
}

function diffDaysCeil(from: Date, to: Date) {
  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function planOrder(planKey: BillingPlanKey) {
  switch (planKey) {
    case BillingPlanKey.FLEX:
      return 0;
    case BillingPlanKey.STARTER:
      return 1;
    case BillingPlanKey.GROWTH:
      return 2;
    case BillingPlanKey.ENTERPRISE:
      return 3;
    default:
      return 0;
  }
}

function planChangeKindFor(currentPlanKey: BillingPlanKey, targetPlanKey: BillingPlanKey) {
  if (targetPlanKey === BillingPlanKey.FLEX) {
    return BillingPlanChangeKind.FLEX_TRANSITION;
  }

  return planOrder(targetPlanKey) > planOrder(currentPlanKey)
    ? BillingPlanChangeKind.UPGRADE
    : BillingPlanChangeKind.DOWNGRADE;
}

function isDowngradePlanChange(currentPlanKey: BillingPlanKey, targetPlanKey: BillingPlanKey) {
  return planOrder(targetPlanKey) < planOrder(currentPlanKey);
}

function quotaLimitForDisplay(input: {
  used: number;
  included: number;
  addOnRemaining: number;
}) {
  const remainingIncluded = Math.max(0, input.included - input.used);
  return input.used + remainingIncluded + input.addOnRemaining;
}

const DISABLED_TRIAL_FEATURES: BillingPlanDefinition["features"] = {
  advancedReporting: false,
  calendarIntegrations: false,
  brandedCandidateExperience: false,
  customIntegrations: false
};

const REPEAT_TRIAL_BLOCK_REASON =
  "Bu e-posta adresi ücretsiz denemeyi daha önce kullandı. Devam etmek için ücretli planla başlayın veya ekip davetiyle giriş yapın.";

function buildBlockedTrialSnapshot(input: {
  normalizedEmail: string;
  blockReason: string;
}) {
  return {
    seatsIncluded: 0,
    activeJobsIncluded: 0,
    candidateProcessingIncluded: 0,
    aiInterviewsIncluded: 0,
    supportLabel: FREE_TRIAL_DEFINITION.supportLabel,
    trialEligible: false,
    trialBlockedReason: input.blockReason,
    trialNormalizedEmail: input.normalizedEmail
  };
}

type StripeClient = any;
type StripeCheckoutSession = any;
type StripeSubscription = any;
type StripeInvoice = any;
type StripeEvent = any;
type StripeLineItem = any;

function toJsonValue(value: Record<string, unknown> | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function accountStatusFromStripe(status: string | null | undefined): BillingAccountStatus {
  switch (status) {
    case "trialing":
      return BillingAccountStatus.TRIALING;
    case "active":
      return BillingAccountStatus.ACTIVE;
    case "past_due":
      return BillingAccountStatus.PAST_DUE;
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return BillingAccountStatus.INCOMPLETE;
    case "canceled":
    case "unpaid":
      return BillingAccountStatus.CANCELED;
    default:
      return BillingAccountStatus.ACTIVE;
  }
}

function buildFeatureSnapshot(value: unknown, fallback: BillingPlanDefinition["features"]) {
  const record = asRecord(value);

  return {
    advancedReporting: asBoolean(record.advancedReporting, fallback.advancedReporting),
    calendarIntegrations: asBoolean(record.calendarIntegrations, fallback.calendarIntegrations),
    brandedCandidateExperience: asBoolean(
      record.brandedCandidateExperience,
      fallback.brandedCandidateExperience
    ),
    customIntegrations: asBoolean(record.customIntegrations, fallback.customIntegrations)
  };
}

function serializeScheduledCancellation(input: {
  effectiveAt: Date;
  requestedAt: Date | null;
  requestedBy: string | null;
}) {
  return {
    effectiveAt: input.effectiveAt.toISOString(),
    requestedAt: input.requestedAt?.toISOString() ?? null,
    requestedBy: input.requestedBy ?? null
  };
}

function parseScheduledCancellation(value: unknown) {
  const record = asRecord(value);
  const effectiveAt = parseOptionalDate(record.effectiveAt);
  if (!effectiveAt) {
    return null;
  }

  return {
    effectiveAt,
    requestedAt: parseOptionalDate(record.requestedAt),
    requestedBy: asString(record.requestedBy)
  };
}

function quotaLabel(key: BillingQuotaKey) {
  switch (key) {
    case BillingQuotaKey.SEATS:
      return "Kullanıcı";
    case BillingQuotaKey.ACTIVE_JOBS:
      return "İlan kredisi";
    case BillingQuotaKey.CANDIDATE_PROCESSING:
      return "Aday değerlendirme kredisi";
    case BillingQuotaKey.AI_INTERVIEWS:
      return "AI mülakat kredisi";
    default:
      return key;
  }
}

function resolveStripeSubscriptionPeriodBounds(subscription: StripeSubscription) {
  const primaryItem = subscription.items?.data?.[0];
  const periodStartTimestamp =
    asTimestamp(primaryItem?.current_period_start) ??
    asTimestamp(subscription.current_period_start) ??
    asTimestamp(subscription.billing_cycle_anchor) ??
    asTimestamp(subscription.start_date) ??
    asTimestamp(subscription.created);
  const periodEndTimestamp =
    asTimestamp(primaryItem?.current_period_end) ??
    asTimestamp(subscription.current_period_end) ??
    asTimestamp(subscription.trial_end);

  if (periodStartTimestamp === null || periodEndTimestamp === null) {
    throw new BadRequestException("Stripe abonelik dönem bilgisi okunamadı.");
  }

  return {
    periodStartTimestamp,
    periodEndTimestamp,
    periodStart: new Date(periodStartTimestamp * 1000),
    periodEnd: new Date(periodEndTimestamp * 1000)
  };
}

@Injectable()
export class BillingService {
  private stripeClient: StripeClient | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  async getOverview(tenantId: string, viewerEmail?: string) {
    const state = await this.resolveBillingState(tenantId);
    const isInternalBillingAdmin = this.runtimeConfig.isInternalBillingAdmin(viewerEmail);
    const hasTrialContext =
      state.trial.isActive || state.trial.isExpired || !state.trial.isEligible;
    const currentPlan =
      hasTrialContext
        ? {
            ...BILLING_PLAN_CATALOG.STARTER,
            label: FREE_TRIAL_DEFINITION.label,
            description: FREE_TRIAL_DEFINITION.description,
            monthlyAmountCents: FREE_TRIAL_DEFINITION.monthlyAmountCents,
            seatsIncluded: state.account.snapshot.seatsIncluded,
            activeJobsIncluded: state.account.snapshot.activeJobsIncluded,
            candidateProcessingIncluded: state.account.snapshot.candidateProcessingIncluded,
            aiInterviewsIncluded: state.account.snapshot.aiInterviewsIncluded,
            features: state.account.features,
            supportLabel: FREE_TRIAL_DEFINITION.supportLabel
          }
        : {
            ...BILLING_PLAN_CATALOG[state.subscription.planKey],
            ...state.account.snapshot
          };
    const quotas = (
      [
        BillingQuotaKey.SEATS,
        BillingQuotaKey.ACTIVE_JOBS,
        BillingQuotaKey.CANDIDATE_PROCESSING,
        BillingQuotaKey.AI_INTERVIEWS
      ] as const
    ).map((quotaKey) => {
      const used = state.usage[quotaKey] ?? 0;
      const included = this.includedForQuota(state.subscription, quotaKey);
      const addOn = state.addOnTotals[quotaKey] ?? 0;
      const limit = state.limits[quotaKey] ?? included + addOn;
      const remaining = Math.max(0, limit - used);
      const utilization = limit > 0 ? clampPercent((used / limit) * 100) : 0;

      return {
        key: quotaKey,
        label: quotaLabel(quotaKey),
        included,
        addOn,
        limit,
        used,
        remaining,
        utilizationPercent: utilization,
        warningState:
          used >= limit ? "exceeded" : utilization >= 80 ? "warning" : "healthy"
      };
    });

    const quotaWarnings =
      state.trial.isExpired || !state.trial.isEligible
        ? []
        : quotas
            .filter((quota) => quota.warningState !== "healthy")
            .map((quota) =>
              quota.warningState === "exceeded"
                ? `${quota.label} limiti doldu.`
                : `${quota.label} kullanımınız %${quota.utilizationPercent} seviyesine ulaştı.`
            );
    const warnings = [...quotaWarnings];

    if (state.trial.isExpired) {
      warnings.unshift(
        "Ücretsiz deneme süreniz sona erdi. Yeni işlem başlatmak için ücretli plana geçin."
      );
    } else if (!state.trial.isEligible && state.trial.blockReason) {
      warnings.unshift(state.trial.blockReason);
    } else if (state.trial.isActive) {
      warnings.unshift(
        `Ücretsiz denemeniz aktif. ${state.trial.daysRemaining} gün içinde planınızı yükseltmeden de sistemi deneyebilirsiniz.`
      );
    }

    if (!state.access.isAllowed && state.access.blockReason) {
      warnings.unshift(state.access.blockReason);
    }

    if (state.account.pendingChange) {
      const pendingPlan = BILLING_PLAN_CATALOG[state.account.pendingChange.planKey];
      const pendingLabel =
        state.account.pendingChange.kind === BillingPlanChangeKind.UPGRADE
          ? `${pendingPlan.label} planına geçiş hazırlanıyor.`
          : `${pendingPlan.label} planına geçiş ${state.account.pendingChange.effectiveAt.toISOString().slice(0, 10)} tarihinde uygulanacak.`;
      warnings.push(pendingLabel);
    }

    const recentCheckouts = isInternalBillingAdmin
      ? await this.prisma.billingCheckoutSession.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            checkoutType: true,
            status: true,
            planKey: true,
            addOnKey: true,
            label: true,
            checkoutUrl: true,
            billingEmail: true,
            amountCents: true,
            currency: true,
            createdAt: true,
            completedAt: true
          }
        })
      : [];

    return {
      stripeReady: this.runtimeConfig.providerReadiness.billing.ready,
      viewer: {
        isInternalBillingAdmin
      },
      account: {
        tenantId: state.account.tenantId,
        billingEmail: state.account.billingEmail,
        stripeCustomerId: state.account.stripeCustomerId,
        stripeSubscriptionId: state.account.stripeSubscriptionId,
        currentPlanKey: state.account.currentPlanKey,
        status: state.account.status,
        currentPeriodStart: state.account.currentPeriodStart.toISOString(),
        currentPeriodEnd: state.account.currentPeriodEnd.toISOString(),
        features: state.account.features,
        pendingChange: state.account.pendingChange
          ? {
              planKey: state.account.pendingChange.planKey,
              kind: state.account.pendingChange.kind,
              effectiveAt: state.account.pendingChange.effectiveAt.toISOString(),
              requestedAt: state.account.pendingChange.requestedAt?.toISOString() ?? null,
              requestedBy: state.account.pendingChange.requestedBy
            }
          : null,
        scheduledCancellation: state.account.scheduledCancellation
          ? {
              effectiveAt: state.account.scheduledCancellation.effectiveAt.toISOString(),
              requestedAt:
                state.account.scheduledCancellation.requestedAt?.toISOString() ?? null,
              requestedBy: state.account.scheduledCancellation.requestedBy,
              canResume: state.account.scheduledCancellation.canResume
            }
          : null
      },
      currentPlan,
      trial: {
        isActive: state.trial.isActive,
        isExpired: state.trial.isExpired,
        isEligible: state.trial.isEligible,
        blockReason: state.trial.blockReason,
        startedAt: state.trial.startedAt?.toISOString() ?? null,
        endsAt: state.trial.endsAt?.toISOString() ?? null,
        daysRemaining: state.trial.daysRemaining
      },
      usage: {
        currentPeriodStart: state.account.currentPeriodStart.toISOString(),
        currentPeriodEnd: state.account.currentPeriodEnd.toISOString(),
        quotas
      },
      planCatalog: Object.values(BILLING_PLAN_CATALOG),
      addOnCatalog: Object.values(BILLING_ADDON_CATALOG),
      warnings,
      access: state.access,
      recentCheckouts: recentCheckouts.map((session) => ({
        ...session,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null
      }))
    };
  }

  async assertCanInviteMember(tenantId: string) {
    await this.assertQuota(tenantId, BillingQuotaKey.SEATS, 1);
  }

  async assertCanPublishJob(tenantId: string, options?: { jobId?: string }) {
    if (options?.jobId) {
      const state = await this.resolveBillingState(tenantId);
      this.assertBillingAccessAvailable(state);
      const periodKey = state.account.currentPeriodStart.toISOString().slice(0, 10);
      const existingUsage = await this.prisma.billingUsageEvent.findUnique({
        where: {
          uniqueKey: `job_credit:${options.jobId}:${periodKey}`
        },
        select: {
          id: true
        }
      });

      if (existingUsage) {
        return;
      }
    }

    await this.assertQuota(tenantId, BillingQuotaKey.ACTIVE_JOBS, 1);
  }

  async assertCanProcessCandidate(tenantId: string) {
    await this.assertQuota(tenantId, BillingQuotaKey.CANDIDATE_PROCESSING, 1);
  }

  async assertCanCreateAiInterview(tenantId: string) {
    await this.assertQuota(tenantId, BillingQuotaKey.AI_INTERVIEWS, 1);
  }

  async assertFeatureEnabled(tenantId: string, featureKey: BillingFeatureKey) {
    const state = await this.resolveBillingState(tenantId);
    this.assertBillingAccessAvailable(state);

    if (state.account.features[featureKey]) {
      return;
    }

    const messageByFeature: Record<BillingFeatureKey, string> = {
      advancedReporting:
        "Gelişmiş raporlama Growth ve üzeri planlarda kullanılabilir.",
      calendarIntegrations:
        "Google Calendar / Meet entegrasyonları Growth ve üzeri planlarda kullanılabilir.",
      brandedCandidateExperience:
        "Branded candidate experience sadece Enterprise planda açılır.",
      customIntegrations:
        "Özel entegrasyonlar sadece Enterprise planda açılır."
    };

    throw new BadRequestException(messageByFeature[featureKey]);
  }

  async recordCandidateProcessingUsage(tenantId: string, applicationId: string) {
    await this.recordUsageEvent({
      tenantId,
      quotaKey: BillingQuotaKey.CANDIDATE_PROCESSING,
      entityType: "CandidateApplication",
      entityId: applicationId,
      uniqueKey: `candidate_processing:${applicationId}`
    });
  }

  async recordJobCreditUsage(tenantId: string, jobId: string) {
    const state = await this.resolveBillingState(tenantId);
    const periodKey = state.account.currentPeriodStart.toISOString().slice(0, 10);

    await this.recordUsageEvent({
      tenantId,
      quotaKey: BillingQuotaKey.ACTIVE_JOBS,
      entityType: "Job",
      entityId: jobId,
      uniqueKey: `job_credit:${jobId}:${periodKey}`
    });
  }

  async recordAiInterviewUsage(tenantId: string, sessionId: string) {
    await this.recordUsageEvent({
      tenantId,
      quotaKey: BillingQuotaKey.AI_INTERVIEWS,
      entityType: "InterviewSession",
      entityId: sessionId,
      uniqueKey: `ai_interview:${sessionId}`
    });
  }

  async createPlanCheckoutSession(input: {
    tenantId: string;
    requestedBy: string;
    planKey: "FLEX" | "STARTER" | "GROWTH";
    billingEmail?: string;
  }) {
    const plan = BILLING_PLAN_CATALOG[input.planKey];
    const state = await this.resolveBillingState(input.tenantId);

    if (state.account.currentPlanKey === input.planKey) {
      if (
        state.account.status === BillingAccountStatus.ACTIVE &&
        !state.account.pendingChange
      ) {
        return {
          checkoutUrl: null,
          sessionId: `plan:${state.account.id}:current`,
          flow: "unchanged"
        };
      }

      if (state.account.pendingChange) {
        return this.cancelPendingPlanChange({
          state,
          requestedBy: input.requestedBy,
          billingEmail: input.billingEmail
        });
      }
    }

    if (plan.billingModel === "prepaid") {
      return this.activateFlexPlan({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        billingEmail: input.billingEmail
      });
    }

    if (isDowngradePlanChange(state.account.currentPlanKey, input.planKey)) {
      if (
        state.account.stripeSubscriptionId &&
        this.runtimeConfig.providerReadiness.billing.ready
      ) {
        const metadata = await this.scheduleManagedStripePlanChange({
          state,
          requestedBy: input.requestedBy,
          targetPlanKey: input.planKey,
          billingEmail: input.billingEmail
        });

        return this.schedulePlanChange({
          tenantId: input.tenantId,
          requestedBy: input.requestedBy,
          targetPlanKey: input.planKey,
          billingEmail: input.billingEmail,
          metadata
        });
      }

      return this.schedulePlanChange({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        targetPlanKey: input.planKey,
        billingEmail: input.billingEmail
      });
    }

    if (
      !this.runtimeConfig.providerReadiness.billing.ready &&
      !this.runtimeConfig.isProduction
    ) {
      return this.activateLocalRecurringPlan({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        planKey: input.planKey as Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">,
        billingEmail: input.billingEmail
      });
    }

    if (state.account.stripeSubscriptionId) {
      return this.updateManagedStripePlanNow({
        state,
        requestedBy: input.requestedBy,
        planKey: input.planKey as Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">,
        billingEmail: input.billingEmail
      });
    }

    const stripe = this.getStripeClient();
    const customer = await this.findOrCreateStripeCustomer(
      state.account.stripeCustomerId,
      input.tenantId,
      input.billingEmail ?? state.account.billingEmail ?? undefined
    );
    const urls = this.buildCheckoutUrls();
    const lineItem = this.buildPlanLineItem(plan);
    const metadata = this.buildPlanSubscriptionMetadata({
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      planKey: input.planKey as Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">,
      billingEmail: input.billingEmail ?? state.account.billingEmail
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      client_reference_id: input.tenantId,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      allow_promotion_codes: true,
      line_items: [lineItem],
      metadata,
      subscription_data: {
        metadata
      }
    });

    await this.prisma.billingCheckoutSession.create({
      data: {
        tenantId: input.tenantId,
        accountId: state.account.id,
        checkoutType: BillingCheckoutType.PLAN_SUBSCRIPTION,
        status: BillingCheckoutStatus.OPEN,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: customer.id,
        planKey: input.planKey,
        label: `${plan.label} aboneliği`,
        billingEmail: input.billingEmail ?? state.account.billingEmail ?? null,
        checkoutUrl: session.url ?? null,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        amountCents: plan.monthlyAmountCents,
        currency: plan.currency,
        payloadJson: {
          metadata,
          plan
        },
        createdBy: input.requestedBy,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
      }
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      flow: "stripe_checkout"
    };
  }

  async scheduleSubscriptionCancellation(input: {
    tenantId: string;
    requestedBy: string;
  }) {
    let state = await this.resolveBillingState(input.tenantId);

    if (!state.account.stripeSubscriptionId || state.account.currentPlanKey === BillingPlanKey.FLEX) {
      throw new BadRequestException("Dönem sonunda iptal edilebilecek aktif bir abonelik bulunamadı.");
    }

    if (state.account.scheduledCancellation) {
      return {
        checkoutUrl: null,
        sessionId: `cancel:${state.account.id}:scheduled`,
        flow: "scheduled_cancellation"
      };
    }

    if (state.account.pendingChange) {
      await this.cancelPendingPlanChange({
        state,
        requestedBy: input.requestedBy,
        billingEmail: state.account.billingEmail ?? undefined
      });
      state = await this.resolveBillingState(input.tenantId);
    }

    const now = new Date();
    const stripe = this.getStripeClient();
    const currentSubscription = await stripe.subscriptions.retrieve(
      state.account.stripeSubscriptionId
    );
    const updatedSubscription = await stripe.subscriptions.update(
      state.account.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
        metadata: {
          ...asRecord(currentSubscription.metadata),
          scheduledCancellationRequestedAt: now.toISOString(),
          scheduledCancellationRequestedBy: input.requestedBy
        }
      }
    );

    await this.upsertSubscriptionFromStripe({
      tenantId: state.account.tenantId,
      accountId: state.account.id,
      stripeSubscription: updatedSubscription,
      metadata: asRecord(updatedSubscription.metadata),
      fallbackPlanKey: state.account.currentPlanKey
    });

    return {
      checkoutUrl: null,
      sessionId: updatedSubscription.id,
      flow: "scheduled_cancellation"
    };
  }

  async resumeScheduledCancellation(input: {
    tenantId: string;
  }) {
    const state = await this.resolveBillingState(input.tenantId);

    if (!state.account.stripeSubscriptionId || !state.account.scheduledCancellation) {
      return {
        checkoutUrl: null,
        sessionId: `cancel:${state.account.id}:unchanged`,
        flow: "unchanged"
      };
    }

    const updatedSubscription = await this.getStripeClient().subscriptions.update(
      state.account.stripeSubscriptionId,
      {
        cancel_at_period_end: false
      }
    );

    await this.upsertSubscriptionFromStripe({
      tenantId: state.account.tenantId,
      accountId: state.account.id,
      stripeSubscription: updatedSubscription,
      metadata: asRecord(updatedSubscription.metadata),
      fallbackPlanKey: state.account.currentPlanKey
    });

    return {
      checkoutUrl: null,
      sessionId: updatedSubscription.id,
      flow: "subscription_updated"
    };
  }

  private async activateLocalRecurringPlan(input: {
    tenantId: string;
    requestedBy: string;
    planKey: Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">;
    billingEmail?: string;
  }) {
    const plan = BILLING_PLAN_CATALOG[input.planKey];
    const state = await this.resolveBillingState(input.tenantId);
    const now = new Date();
    const periodStart = now;
    const periodEnd = addMonthsUtc(periodStart, 1);

    await this.prisma.$transaction(async (tx) => {
      await this.appendSubscriptionSnapshot(tx, {
        accountId: state.account.id,
        tenantId: input.tenantId,
        planKey: input.planKey,
        status: BillingAccountStatus.ACTIVE,
        billingEmail: input.billingEmail ?? state.account.billingEmail,
        periodStart,
        periodEnd,
        seatsIncluded: plan.seatsIncluded,
        activeJobsIncluded: plan.activeJobsIncluded,
        candidateProcessingIncluded: plan.candidateProcessingIncluded,
        aiInterviewsIncluded: plan.aiInterviewsIncluded,
        features: plan.features,
        stripeSubscriptionId: null,
        stripeCustomerId: state.account.stripeCustomerId,
        metadata: {
          source: "local_recurring_activation"
        },
        createdBy: input.requestedBy
      });

      await tx.tenantBillingAccount.update({
        where: {
          id: state.account.id
        },
        data: {
          billingEmail: input.billingEmail ?? state.account.billingEmail,
          currentPlanKey: input.planKey,
          status: BillingAccountStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: null,
          featuresJson: plan.features,
          planSnapshotJson: buildPlanSnapshot(plan),
          pendingPlanKey: null,
          pendingChangeKind: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
          pendingChangeRequestedBy: null,
          pendingChangeMetadataJson: Prisma.DbNull
        }
      });

      await tx.billingCheckoutSession.create({
        data: {
          tenantId: input.tenantId,
          accountId: state.account.id,
          checkoutType: BillingCheckoutType.PLAN_SUBSCRIPTION,
          status: BillingCheckoutStatus.COMPLETED,
          planKey: input.planKey,
          label: `${plan.label} planı`,
          billingEmail: input.billingEmail ?? state.account.billingEmail,
          amountCents: plan.monthlyAmountCents,
          currency: plan.currency,
          payloadJson: {
            localActivation: true,
            planKey: input.planKey
          },
          createdBy: input.requestedBy,
          completedAt: now
        }
      });
    });

    return {
      checkoutUrl: null,
      sessionId: `local:${state.account.id}:${now.getTime()}`,
      flow: "local_activation"
    };
  }

  private async activateFlexPlan(input: {
    tenantId: string;
    requestedBy: string;
    billingEmail?: string;
  }) {
    const state = await this.resolveBillingState(input.tenantId);

    if (
      state.account.currentPlanKey === BillingPlanKey.FLEX &&
      state.account.status === BillingAccountStatus.ACTIVE &&
      !state.account.pendingChange
    ) {
      return {
        checkoutUrl: null,
        sessionId: `flex:${state.account.id}:current`,
        flow: "unchanged"
      };
    }

    if (
      state.account.currentPlanKey !== BillingPlanKey.FLEX &&
      state.account.status === BillingAccountStatus.ACTIVE
    ) {
      if (
        state.account.stripeSubscriptionId &&
        this.runtimeConfig.providerReadiness.billing.ready
      ) {
        const metadata = await this.scheduleManagedStripePlanChange({
          state,
          requestedBy: input.requestedBy,
          targetPlanKey: BillingPlanKey.FLEX,
          billingEmail: input.billingEmail
        });

        return this.schedulePlanChange({
          tenantId: input.tenantId,
          requestedBy: input.requestedBy,
          targetPlanKey: BillingPlanKey.FLEX,
          billingEmail: input.billingEmail,
          metadata
        });
      }

      return this.schedulePlanChange({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        targetPlanKey: BillingPlanKey.FLEX,
        billingEmail: input.billingEmail
      });
    }

    const plan = BILLING_PLAN_CATALOG.FLEX;
    const now = new Date();
    const periodStart = startOfCurrentMonth(now);
    const periodEnd = startOfNextMonth(now);

    await this.prisma.$transaction(async (tx) => {
      await this.appendSubscriptionSnapshot(tx, {
        tenantId: input.tenantId,
        accountId: state.account.id,
        planKey: BillingPlanKey.FLEX,
        status: BillingAccountStatus.ACTIVE,
        billingEmail: input.billingEmail ?? state.account.billingEmail,
        periodStart,
        periodEnd,
        seatsIncluded: plan.seatsIncluded,
        activeJobsIncluded: plan.activeJobsIncluded,
        candidateProcessingIncluded: plan.candidateProcessingIncluded,
        aiInterviewsIncluded: plan.aiInterviewsIncluded,
        features: plan.features,
        stripeSubscriptionId: null,
        stripeCustomerId: state.account.stripeCustomerId,
        metadata: {
          source: "flex_activation"
        },
        createdBy: input.requestedBy
      });

      await tx.tenantBillingAccount.update({
        where: { id: state.account.id },
        data: {
          billingEmail: input.billingEmail ?? state.account.billingEmail,
          currentPlanKey: BillingPlanKey.FLEX,
          status: BillingAccountStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: null,
          featuresJson: plan.features,
          planSnapshotJson: buildPlanSnapshot(plan),
          pendingPlanKey: null,
          pendingChangeKind: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
          pendingChangeRequestedBy: null,
          pendingChangeMetadataJson: Prisma.DbNull
        }
      });

      await tx.billingCheckoutSession.create({
        data: {
          tenantId: input.tenantId,
          accountId: state.account.id,
          checkoutType: BillingCheckoutType.PLAN_SUBSCRIPTION,
          status: BillingCheckoutStatus.COMPLETED,
          planKey: BillingPlanKey.FLEX,
          label: "Flex planı",
          billingEmail: input.billingEmail ?? state.account.billingEmail,
          amountCents: 0,
          currency: plan.currency,
          payloadJson: {
            localActivation: true,
            planKey: BillingPlanKey.FLEX
          },
          createdBy: input.requestedBy,
          completedAt: now
        }
      });
    });

    return {
      checkoutUrl: null,
      sessionId: `flex:${state.account.id}:${now.getTime()}`,
      flow: "local_activation"
    };
  }

  private async schedulePlanChange(input: {
    tenantId: string;
    requestedBy: string;
    targetPlanKey: BillingPlanKey;
    billingEmail?: string;
    metadata?: Record<string, unknown>;
  }) {
    const state = await this.resolveBillingState(input.tenantId);
    const now = new Date();
    const effectiveAt = state.account.currentPeriodEnd;
    const changeKind = planChangeKindFor(state.account.currentPlanKey, input.targetPlanKey);

    await this.prisma.tenantBillingAccount.update({
      where: {
        id: state.account.id
      },
      data: {
        billingEmail: input.billingEmail ?? state.account.billingEmail,
        pendingPlanKey: input.targetPlanKey,
        pendingChangeKind: changeKind,
        pendingChangeEffectiveAt: effectiveAt,
        pendingChangeRequestedAt: now,
        pendingChangeRequestedBy: input.requestedBy,
        pendingChangeMetadataJson: {
          source: "self_serve_plan_change",
          currentPlanKey: state.account.currentPlanKey,
          ...(input.metadata ?? {})
        }
      }
    });

    return {
      checkoutUrl: null,
      sessionId: `scheduled:${state.account.id}:${effectiveAt.getTime()}`,
      flow: "scheduled"
    };
  }

  private async cancelPendingPlanChange(input: {
    state: ResolvedBillingState;
    requestedBy: string;
    billingEmail?: string;
  }) {
    if (
      input.state.account.stripeSubscriptionId &&
      this.runtimeConfig.providerReadiness.billing.ready
    ) {
      const subscription = await this.clearManagedStripePlanChange(
        input.state.account.stripeSubscriptionId
      );

      await this.upsertSubscriptionFromStripe({
        tenantId: input.state.account.tenantId,
        accountId: input.state.account.id,
        stripeSubscription: subscription,
        metadata: asRecord(subscription.metadata),
        fallbackPlanKey: input.state.account.currentPlanKey
      });
    }

    await this.prisma.tenantBillingAccount.update({
      where: {
        id: input.state.account.id
      },
      data: {
        billingEmail: input.billingEmail ?? input.state.account.billingEmail,
        pendingPlanKey: null,
        pendingChangeKind: null,
        pendingChangeEffectiveAt: null,
        pendingChangeRequestedAt: null,
        pendingChangeRequestedBy: null,
        pendingChangeMetadataJson: Prisma.DbNull
      }
    });

    return {
      checkoutUrl: null,
      sessionId: `plan:${input.state.account.id}:pending-cleared`,
      flow: "subscription_updated"
    };
  }

  private async updateManagedStripePlanNow(input: {
    state: ResolvedBillingState;
    requestedBy: string;
    planKey: Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">;
    billingEmail?: string;
  }) {
    const stripeSubscriptionId = input.state.account.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      throw new BadRequestException("Stripe abonelik kaydı bulunamadı.");
    }

    const subscription = await this.clearManagedStripePlanChange(stripeSubscriptionId);
    const item = subscription.items?.data?.[0];

    if (!item?.id) {
      throw new BadRequestException("Stripe abonelik kalemi bulunamadı.");
    }

    const priceId = this.getManagedPlanPriceId(input.planKey);
    const metadata = this.buildPlanSubscriptionMetadata({
      tenantId: input.state.account.tenantId,
      requestedBy: input.requestedBy,
      planKey: input.planKey,
      billingEmail: input.billingEmail ?? input.state.account.billingEmail
    });

    const updatedSubscription = await this.getStripeClient().subscriptions.update(
      stripeSubscriptionId,
      {
        billing_cycle_anchor: "unchanged",
        cancel_at_period_end: false,
        proration_behavior: "always_invoice",
        payment_behavior: "allow_incomplete",
        items: [
          {
            id: item.id,
            price: priceId,
            quantity: 1
          }
        ],
        metadata
      }
    );

    await this.upsertSubscriptionFromStripe({
      tenantId: input.state.account.tenantId,
      accountId: input.state.account.id,
      stripeSubscription: updatedSubscription,
      metadata: asRecord(updatedSubscription.metadata),
      fallbackPlanKey: input.planKey
    });

    await this.prisma.tenantBillingAccount.update({
      where: {
        id: input.state.account.id
      },
      data: {
        billingEmail: input.billingEmail ?? input.state.account.billingEmail,
        pendingPlanKey: null,
        pendingChangeKind: null,
        pendingChangeEffectiveAt: null,
        pendingChangeRequestedAt: null,
        pendingChangeRequestedBy: null,
        pendingChangeMetadataJson: Prisma.DbNull
      }
    });

    return {
      checkoutUrl: null,
      sessionId: updatedSubscription.id,
      flow: "subscription_updated"
    };
  }

  private async scheduleManagedStripePlanChange(input: {
    state: ResolvedBillingState;
    requestedBy: string;
    targetPlanKey: BillingPlanKey;
    billingEmail?: string;
  }) {
    const stripeSubscriptionId = input.state.account.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      throw new BadRequestException("Stripe abonelik kaydı bulunamadı.");
    }

    const subscription = await this.clearManagedStripePlanChange(stripeSubscriptionId);
    const currentItem = subscription.items?.data?.[0];

    if (!currentItem) {
      throw new BadRequestException("Stripe abonelik kalemi bulunamadı.");
    }

    const { periodStartTimestamp, periodEndTimestamp, periodEnd } =
      resolveStripeSubscriptionPeriodBounds(subscription);
    const effectiveAt = periodEnd;

    if (input.targetPlanKey === BillingPlanKey.FLEX) {
      await this.getStripeClient().subscriptions.update(subscription.id, {
        cancel_at_period_end: true
      });

      return {
        stripeMode: "cancel_at_period_end",
        stripeSubscriptionId: subscription.id,
        effectiveAt: effectiveAt.toISOString()
      };
    }

    const targetPriceId = this.getManagedPlanPriceId(
      input.targetPlanKey as Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">
    );
    const currentPlanKey = input.state.account.currentPlanKey as Exclude<
      BillingPlanKey,
      "FLEX" | "ENTERPRISE"
    >;
    const currentMetadata = this.buildPlanSubscriptionMetadata({
      tenantId: input.state.account.tenantId,
      requestedBy: input.requestedBy,
      planKey: currentPlanKey,
      billingEmail: input.billingEmail ?? input.state.account.billingEmail
    });
    const targetMetadata = this.buildPlanSubscriptionMetadata({
      tenantId: input.state.account.tenantId,
      requestedBy: input.requestedBy,
      planKey: input.targetPlanKey as Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">,
      billingEmail: input.billingEmail ?? input.state.account.billingEmail
    });

    const schedule = await this.getStripeClient().subscriptionSchedules.create({
      from_subscription: subscription.id
    });

    await this.getStripeClient().subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          start_date: periodStartTimestamp,
          end_date: periodEndTimestamp,
          items: [
            {
              price: currentItem.price?.id ?? this.getManagedPlanPriceId(currentPlanKey),
              quantity: currentItem.quantity ?? 1
            }
          ],
          metadata: currentMetadata
        },
        {
          start_date: periodEndTimestamp,
          duration: {
            interval: "month",
            interval_count: 1
          },
          items: [
            {
              price: targetPriceId,
              quantity: 1
            }
          ],
          metadata: targetMetadata
        }
      ]
    });

    return {
      stripeMode: "subscription_schedule",
      scheduleId: schedule.id,
      stripeSubscriptionId: subscription.id,
      targetStripePriceId: targetPriceId,
      effectiveAt: effectiveAt.toISOString()
    };
  }

  private async clearManagedStripePlanChange(stripeSubscriptionId: string) {
    const stripe = this.getStripeClient();
    let subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const scheduleId =
      typeof subscription.schedule === "string"
        ? subscription.schedule
        : subscription.schedule?.id ?? null;

    if (scheduleId) {
      await stripe.subscriptionSchedules.release(scheduleId);
      subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    }

    if (subscription.cancel_at_period_end) {
      subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: false
      });
    }

    return subscription;
  }

  private async appendSubscriptionSnapshot(
    tx: Prisma.TransactionClient | PrismaService,
    input: {
      tenantId: string;
      accountId: string;
      planKey: BillingPlanKey;
      status: BillingAccountStatus;
      billingEmail: string | null;
      periodStart: Date;
      periodEnd: Date;
      seatsIncluded: number;
      activeJobsIncluded: number;
      candidateProcessingIncluded: number;
      aiInterviewsIncluded: number;
      features: Record<BillingFeatureKey, boolean>;
      stripeSubscriptionId: string | null;
      stripeCustomerId: string | null;
      stripePriceId?: string | null;
      metadata?: Record<string, unknown>;
      createdBy?: string | null;
    }
  ) {
    const latest = await tx.tenantBillingSubscription.findFirst({
      where: {
        accountId: input.accountId
      },
      orderBy: [{ createdAt: "desc" }]
    });

    const isSameSnapshot =
      latest &&
      latest.planKey === input.planKey &&
      latest.status === input.status &&
      latest.periodStart.getTime() === input.periodStart.getTime() &&
      latest.periodEnd.getTime() === input.periodEnd.getTime() &&
      latest.stripeSubscriptionId === input.stripeSubscriptionId &&
      latest.seatsIncluded === input.seatsIncluded &&
      latest.activeJobsIncluded === input.activeJobsIncluded &&
      latest.candidateProcessingIncluded === input.candidateProcessingIncluded &&
      latest.aiInterviewsIncluded === input.aiInterviewsIncluded;

    if (isSameSnapshot) {
      return tx.tenantBillingSubscription.update({
        where: {
          id: latest.id
        },
        data: {
          billingEmail: input.billingEmail,
          stripePriceId: input.stripePriceId ?? null,
          stripeCustomerId: input.stripeCustomerId,
          featuresJson: input.features,
          metadataJson: toJsonValue(input.metadata),
          canceledAt: input.status === BillingAccountStatus.CANCELED ? new Date() : null
        }
      });
    }

    if (
      latest &&
      latest.canceledAt === null &&
      latest.status !== BillingAccountStatus.CANCELED &&
      (
        latest.status !== input.status ||
        latest.planKey !== input.planKey ||
        latest.periodStart.getTime() !== input.periodStart.getTime() ||
        latest.periodEnd.getTime() !== input.periodEnd.getTime()
      )
    ) {
      await tx.tenantBillingSubscription.update({
        where: {
          id: latest.id
        },
        data: {
          canceledAt: new Date(),
          status: BillingAccountStatus.CANCELED
        }
      });
    }

    return tx.tenantBillingSubscription.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        planKey: input.planKey,
        status: input.status,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId ?? null,
        stripeCheckoutSessionId: null,
        stripeCustomerId: input.stripeCustomerId,
        billingEmail: input.billingEmail,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        seatsIncluded: input.seatsIncluded,
        activeJobsIncluded: input.activeJobsIncluded,
        candidateProcessingIncluded: input.candidateProcessingIncluded,
        aiInterviewsIncluded: input.aiInterviewsIncluded,
        featuresJson: input.features,
        metadataJson: toJsonValue(input.metadata),
        createdBy: input.createdBy,
        canceledAt: input.status === BillingAccountStatus.CANCELED ? new Date() : null
      }
    });
  }

  async createAddOnCheckoutSession(input: {
    tenantId: string;
    requestedBy: string;
    addOnKey: BillingAddonKey;
    billingEmail?: string;
  }) {
    const addOn = BILLING_ADDON_CATALOG[input.addOnKey];
    const state = await this.resolveBillingState(input.tenantId);

    if (
      !this.runtimeConfig.providerReadiness.billing.ready &&
      !this.runtimeConfig.isProduction
    ) {
      return this.grantLocalAddOn({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        addOnKey: input.addOnKey,
        billingEmail: input.billingEmail ?? state.account.billingEmail
      });
    }

    const stripe = this.getStripeClient();
    const customer = await this.findOrCreateStripeCustomer(
      state.account.stripeCustomerId,
      input.tenantId,
      input.billingEmail ?? state.account.billingEmail ?? undefined
    );
    const urls = this.buildCheckoutUrls();
    const metadata = {
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      checkoutType: BillingCheckoutType.ADDON_PURCHASE,
      addOnKey: input.addOnKey,
      quotaKey: addOn.quotaKey ?? "",
      quantity: addOn.quantity ? String(addOn.quantity) : "",
      currentPeriodEnd: state.account.currentPeriodEnd.toISOString()
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customer.id,
      client_reference_id: input.tenantId,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      allow_promotion_codes: true,
      line_items: [
        this.buildAddOnLineItem(addOn)
      ],
      metadata
    });

    await this.prisma.billingCheckoutSession.create({
      data: {
        tenantId: input.tenantId,
        accountId: state.account.id,
        checkoutType: BillingCheckoutType.ADDON_PURCHASE,
        status: BillingCheckoutStatus.OPEN,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: customer.id,
        addOnKey: input.addOnKey as BillingAddonKey,
        label: addOn.label,
        billingEmail: input.billingEmail ?? state.account.billingEmail ?? null,
        checkoutUrl: session.url ?? null,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        amountCents: addOn.amountCents,
        currency: addOn.currency,
        payloadJson: {
          metadata,
          addOn
        },
        createdBy: input.requestedBy,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
      }
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      flow: "stripe_checkout"
    };
  }

  private async grantLocalAddOn(input: {
    tenantId: string;
    requestedBy: string;
    addOnKey: BillingAddonKey;
    billingEmail?: string | null;
  }) {
    const addOn = BILLING_ADDON_CATALOG[input.addOnKey];
    const state = await this.resolveBillingState(input.tenantId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (addOn.quotaKey && addOn.quantity) {
        await tx.billingQuotaGrant.create({
          data: {
            tenantId: input.tenantId,
            accountId: state.account.id,
            quotaKey: addOn.quotaKey as BillingQuotaKey,
            source: BillingGrantSource.ADDON,
            label: addOn.label,
            quantity: addOn.quantity,
            expiresAt: addDaysUtc(now, BILLING_ADDON_ROLLOVER_DAYS),
            createdBy: input.requestedBy,
            metadataJson: {
              source: "local_addon_activation",
              addOnKey: input.addOnKey
            }
          }
        });
      }

      await tx.billingCheckoutSession.create({
        data: {
          tenantId: input.tenantId,
          accountId: state.account.id,
          checkoutType: BillingCheckoutType.ADDON_PURCHASE,
          status: BillingCheckoutStatus.COMPLETED,
          addOnKey: input.addOnKey,
          label: addOn.label,
          billingEmail: input.billingEmail ?? null,
          amountCents: addOn.amountCents,
          currency: addOn.currency,
          payloadJson: {
            localActivation: true,
            addOnKey: input.addOnKey
          },
          createdBy: input.requestedBy,
          completedAt: now
        }
      });
    });

    return {
      checkoutUrl: null,
      sessionId: `addon:${state.account.id}:${now.getTime()}`,
      flow: "local_activation"
    };
  }

  async createEnterpriseOfferCheckoutSession(input: {
    tenantId: string;
    requestedBy: string;
    requestedByEmail?: string;
    billingEmail: string;
    monthlyAmountCents: number;
    seatsIncluded: number;
    activeJobsIncluded: number;
    candidateProcessingIncluded: number;
    aiInterviewsIncluded: number;
    features: Record<BillingFeatureKey, boolean>;
    note?: string;
  }) {
    this.assertInternalBillingAdmin(input.requestedByEmail);

    if (input.monthlyAmountCents <= 0) {
      throw new BadRequestException("Aylık ücret 0'dan büyük olmalıdır.");
    }

    const state = await this.resolveBillingState(input.tenantId);
    const stripe = this.getStripeClient();
    const customer = await this.findOrCreateStripeCustomer(
      state.account.stripeCustomerId,
      input.tenantId,
      input.billingEmail
    );
    const urls = this.buildCheckoutUrls();
    const metadata = {
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      checkoutType: BillingCheckoutType.ENTERPRISE_OFFER,
      planKey: BillingPlanKey.ENTERPRISE,
      seatsIncluded: String(input.seatsIncluded),
      activeJobsIncluded: String(input.activeJobsIncluded),
      candidateProcessingIncluded: String(input.candidateProcessingIncluded),
      aiInterviewsIncluded: String(input.aiInterviewsIncluded),
      featuresJson: JSON.stringify(input.features),
      note: input.note ?? ""
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      client_reference_id: input.tenantId,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.monthlyAmountCents,
            recurring: {
              interval: "month"
            },
            product_data: {
              name: "Candit Enterprise",
              description: "Özel limitler ve özel onboarding ile enterprise plan."
            }
          }
        }
      ],
      metadata,
      subscription_data: {
        metadata
      }
    });

    await this.prisma.billingCheckoutSession.create({
      data: {
        tenantId: input.tenantId,
        accountId: state.account.id,
        checkoutType: BillingCheckoutType.ENTERPRISE_OFFER,
        status: BillingCheckoutStatus.OPEN,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: customer.id,
        planKey: BillingPlanKey.ENTERPRISE,
        label: "Enterprise teklif",
        billingEmail: input.billingEmail,
        checkoutUrl: session.url ?? null,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        amountCents: input.monthlyAmountCents,
        currency: "usd",
        payloadJson: {
          metadata
        },
        createdBy: input.requestedBy,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
      }
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.id
    };
  }

  async createCustomerPortalSession(input: { tenantId: string }) {
    const state = await this.resolveBillingState(input.tenantId);
    if (!state.account.stripeCustomerId) {
      throw new BadRequestException("Henüz Stripe müşteri kaydı bulunamadı.");
    }

    const stripe = this.getStripeClient();
    const stripeConfig = this.runtimeConfig.stripeBillingConfig;
    const portal = await stripe.billingPortal.sessions.create({
      customer: state.account.stripeCustomerId,
      ...(stripeConfig.portalConfigurationId
        ? {
            configuration: stripeConfig.portalConfigurationId
          }
        : {}),
      return_url: `${this.runtimeConfig.publicWebBaseUrl}/subscription`
    });

    return {
      portalUrl: portal.url
    };
  }

  async sendCheckoutLink(input: {
    tenantId: string;
    checkoutSessionId: string;
    email: string;
    requestedBy: string;
    requestedByEmail?: string;
  }) {
    this.assertInternalBillingAdmin(input.requestedByEmail);

    const checkout = await this.prisma.billingCheckoutSession.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.checkoutSessionId
      }
    });

    if (!checkout?.checkoutUrl) {
      throw new NotFoundException("Ödeme linki bulunamadı.");
    }

    await this.notificationsService.send({
      tenantId: input.tenantId,
      channel: "email",
      to: input.email,
      subject: "Candit plan / ödeme linkiniz hazır",
      body: [
        "Merhaba,",
        "",
        "Plan veya add-on ödeme linkiniz hazır.",
        "Aşağıdaki bağlantıdan ödeme sürecini tamamlayabilirsiniz."
      ].join("\n"),
      metadata: {
        primaryLink: checkout.checkoutUrl,
        primaryCtaLabel: "Ödeme Bağlantısını Aç"
      },
      templateKey: "billing_checkout_link",
      eventType: "billing_checkout_link",
      requestedBy: input.requestedBy
    });

    return {
      sent: true,
      email: input.email
    };
  }

  private assertInternalBillingAdmin(email?: string | null) {
    if (this.runtimeConfig.isInternalBillingAdmin(email)) {
      return;
    }

    throw new ForbiddenException(
      "Bu işlem yalnızca iç yönetim ekibi için açıktır."
    );
  }

  async handleStripeWebhook(signature: string | undefined, rawBody: Buffer | string) {
    const stripe = this.getStripeClient();
    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));

    let event: StripeEvent;
    if (this.runtimeConfig.stripeBillingConfig.webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.runtimeConfig.stripeBillingConfig.webhookSecret
      );
    } else {
      if (this.runtimeConfig.isProduction) {
        throw new BadRequestException("Stripe webhook imzası doğrulanamadı.");
      }

      event = JSON.parse(payload.toString("utf8")) as StripeEvent;
    }

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSession);
        break;
      case "checkout.session.expired":
        await this.handleCheckoutSessionExpired(event.data.object as StripeCheckoutSession);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.handleSubscriptionUpdated(event.data.object as StripeSubscription);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data.object as StripeInvoice);
        break;
      default:
        break;
    }

    return { received: true, eventType: event.type };
  }

  private async handleCheckoutSessionCompleted(session: StripeCheckoutSession) {
    const local = session.id
      ? await this.prisma.billingCheckoutSession.findUnique({
          where: {
            stripeCheckoutSessionId: session.id
          }
        })
      : null;

    if (local?.status === BillingCheckoutStatus.COMPLETED) {
      return;
    }

    const metadata = asRecord(session.metadata);
    const tenantId = asString(metadata.tenantId);
    if (!tenantId) {
      return;
    }

    const account = await this.ensureBillingAccount(tenantId);
    const checkoutType = asString(metadata.checkoutType);

    if (
      checkoutType === BillingCheckoutType.ADDON_PURCHASE &&
      asString(metadata.addOnKey)
    ) {
      const addOnKey = asString(metadata.addOnKey) as BillingAddonKey;
      const addOn = BILLING_ADDON_CATALOG[addOnKey];

      if (addOn?.quotaKey && addOn.quantity) {
        const existingGrant = await this.prisma.billingQuotaGrant.findFirst({
          where: {
            tenantId,
            accountId: account.id,
            metadataJson: {
              path: ["checkoutSessionId"],
              equals: session.id
            }
          }
        });

        if (!existingGrant) {
          await this.prisma.billingQuotaGrant.create({
            data: {
              tenantId,
              accountId: account.id,
              quotaKey: addOn.quotaKey as BillingQuotaKey,
              source: BillingGrantSource.ADDON,
              label: addOn.label,
              quantity: addOn.quantity,
              expiresAt: addDaysUtc(new Date(), BILLING_ADDON_ROLLOVER_DAYS),
              createdBy: asString(metadata.requestedBy),
              metadataJson: {
                checkoutSessionId: session.id,
                addOnKey
              }
            }
          });
        }
      }
    }

    if (
      (checkoutType === BillingCheckoutType.PLAN_SUBSCRIPTION ||
        checkoutType === BillingCheckoutType.ENTERPRISE_OFFER) &&
      typeof session.subscription === "string"
    ) {
      const subscription = await this.getStripeClient().subscriptions.retrieve(session.subscription);
      await this.upsertSubscriptionFromStripe({
        tenantId,
        accountId: account.id,
        stripeSubscription: subscription,
        metadata: asRecord(subscription.metadata ?? session.metadata)
      });
    }

    await this.prisma.billingCheckoutSession.upsert({
      where: {
        stripeCheckoutSessionId: session.id
      },
      update: {
        tenantId,
        accountId: account.id,
        status: BillingCheckoutStatus.COMPLETED,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
        checkoutUrl: session.url ?? local?.checkoutUrl ?? null,
        completedAt: new Date()
      },
      create: {
        tenantId,
        accountId: account.id,
        checkoutType:
          checkoutType === BillingCheckoutType.ENTERPRISE_OFFER
            ? BillingCheckoutType.ENTERPRISE_OFFER
            : checkoutType === BillingCheckoutType.ADDON_PURCHASE
              ? BillingCheckoutType.ADDON_PURCHASE
              : BillingCheckoutType.PLAN_SUBSCRIPTION,
        status: BillingCheckoutStatus.COMPLETED,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
        planKey: this.safePlanKey(asString(metadata.planKey)),
        addOnKey: this.safeAddonKey(asString(metadata.addOnKey)),
        label: local?.label ?? null,
        billingEmail:
          session.customer_details?.email ?? local?.billingEmail ?? null,
        checkoutUrl: session.url ?? null,
        successUrl: local?.successUrl ?? null,
        cancelUrl: local?.cancelUrl ?? null,
        amountCents: local?.amountCents ?? null,
        currency: local?.currency ?? "usd",
        payloadJson: toJsonValue(metadata),
        createdBy: asString(metadata.requestedBy),
        completedAt: new Date()
      }
    });
  }

  private async handleCheckoutSessionExpired(session: StripeCheckoutSession) {
    if (!session.id) {
      return;
    }

    await this.prisma.billingCheckoutSession.updateMany({
      where: {
        stripeCheckoutSessionId: session.id
      },
      data: {
        status: BillingCheckoutStatus.EXPIRED,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : new Date()
      }
    });
  }

  private async handleSubscriptionUpdated(subscription: StripeSubscription) {
    const existingAccount = await this.prisma.tenantBillingAccount.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscription.id },
          typeof subscription.customer === "string"
            ? { stripeCustomerId: subscription.customer }
            : undefined
        ].filter(Boolean) as Prisma.TenantBillingAccountWhereInput[]
      }
    });

    if (!existingAccount) {
      return;
    }

    const existingSub = await this.prisma.tenantBillingSubscription.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscription.id },
          { accountId: existingAccount.id }
        ]
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    await this.upsertSubscriptionFromStripe({
      tenantId: existingAccount.tenantId,
      accountId: existingAccount.id,
      stripeSubscription: subscription,
      metadata: asRecord(subscription.metadata),
      fallbackPlanKey: existingSub?.planKey ?? existingAccount.currentPlanKey
    });

    const syncedAccount = await this.loadBillingAccountById(existingAccount.id);
    if (
      syncedAccount.pendingPlanKey &&
      syncedAccount.pendingChangeEffectiveAt &&
      syncedAccount.pendingChangeEffectiveAt.getTime() <= Date.now() &&
      !syncedAccount.stripeSubscriptionId
    ) {
      await this.applyPendingPlanChange(existingAccount.id);
    }
  }

  private async handleInvoicePaymentFailed(invoice: StripeInvoice) {
    const subscriptionId =
      typeof invoice.subscription === "string" ? invoice.subscription : null;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : null;

    if (!subscriptionId && !customerId) {
      return;
    }

    await this.prisma.tenantBillingAccount.updateMany({
      where: {
        OR: [
          subscriptionId ? { stripeSubscriptionId: subscriptionId } : undefined,
          customerId ? { stripeCustomerId: customerId } : undefined
        ].filter(Boolean) as Prisma.TenantBillingAccountWhereInput[]
      },
      data: {
        status: BillingAccountStatus.PAST_DUE
      }
    });
  }

  private async upsertSubscriptionFromStripe(input: {
    tenantId: string;
    accountId: string;
    stripeSubscription: StripeSubscription;
    metadata: Record<string, unknown>;
    fallbackPlanKey?: BillingPlanKey;
  }) {
    const currentPriceId = input.stripeSubscription.items.data[0]?.price?.id ?? null;
    const planKey =
      this.safePlanKey(asString(input.metadata.planKey)) ??
      this.planKeyFromPriceId(currentPriceId) ??
      input.fallbackPlanKey ??
      BillingPlanKey.ENTERPRISE;
    const catalogPlan = BILLING_PLAN_CATALOG[planKey];
    const features = buildFeatureSnapshot(input.metadata.featuresJson, catalogPlan.features);
    const seatsIncluded = asNumber(input.metadata.seatsIncluded, catalogPlan.seatsIncluded);
    const activeJobsIncluded = asNumber(
      input.metadata.activeJobsIncluded,
      catalogPlan.activeJobsIncluded
    );
    const candidateProcessingIncluded = asNumber(
      input.metadata.candidateProcessingIncluded,
      catalogPlan.candidateProcessingIncluded
    );
    const aiInterviewsIncluded = asNumber(
      input.metadata.aiInterviewsIncluded,
      catalogPlan.aiInterviewsIncluded
    );
    const { periodStart, periodEnd } =
      resolveStripeSubscriptionPeriodBounds(input.stripeSubscription);
    const status = accountStatusFromStripe(input.stripeSubscription.status);

    await this.prisma.$transaction(async (tx) => {
      const currentAccount = await tx.tenantBillingAccount.findUniqueOrThrow({
        where: { id: input.accountId }
      });

      await this.appendSubscriptionSnapshot(tx, {
        tenantId: input.tenantId,
        accountId: input.accountId,
        planKey,
        status,
        stripeSubscriptionId: input.stripeSubscription.id,
        stripePriceId: currentPriceId,
        stripeCustomerId:
          typeof input.stripeSubscription.customer === "string"
            ? input.stripeSubscription.customer
            : null,
        billingEmail: asString(input.metadata.billingEmail),
        periodStart,
        periodEnd,
        seatsIncluded,
        activeJobsIncluded,
        candidateProcessingIncluded,
        aiInterviewsIncluded,
        features,
        metadata: input.metadata,
        createdBy: asString(input.metadata.requestedBy)
      });

      const metadataPendingPlanKey = this.safePlanKey(
        asString(asRecord(input.metadata.pendingChange).planKey)
      );
      const pendingPlanKey =
        metadataPendingPlanKey && metadataPendingPlanKey !== planKey
          ? metadataPendingPlanKey
          : currentAccount.pendingPlanKey && currentAccount.pendingPlanKey !== planKey
            ? currentAccount.pendingPlanKey
            : null;
      const existingScheduledCancellation = parseScheduledCancellation(
        asRecord(currentAccount.pendingChangeMetadataJson).scheduledCancellation
      );
      const scheduledCancellation =
        input.stripeSubscription.cancel_at_period_end && !pendingPlanKey
          ? {
              effectiveAt: periodEnd,
              requestedAt:
                parseOptionalDate(input.metadata.scheduledCancellationRequestedAt) ??
                existingScheduledCancellation?.requestedAt ??
                new Date(),
              requestedBy:
                asString(input.metadata.scheduledCancellationRequestedBy) ??
                existingScheduledCancellation?.requestedBy ??
                null
            }
          : null;

      await tx.tenantBillingAccount.update({
        where: { id: input.accountId },
        data: {
          stripeCustomerId:
            typeof input.stripeSubscription.customer === "string"
              ? input.stripeSubscription.customer
              : undefined,
          stripeSubscriptionId:
            status === BillingAccountStatus.CANCELED ? null : input.stripeSubscription.id,
          currentPlanKey: planKey,
          status,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          featuresJson: features,
          planSnapshotJson: {
            seatsIncluded,
            activeJobsIncluded,
            candidateProcessingIncluded,
            aiInterviewsIncluded
          },
          pendingPlanKey,
          pendingChangeKind: pendingPlanKey ? planChangeKindFor(planKey, pendingPlanKey) : null,
          pendingChangeEffectiveAt:
            pendingPlanKey
              ? currentAccount.pendingChangeEffectiveAt ?? periodEnd
              : null,
          pendingChangeRequestedAt:
            pendingPlanKey
              ? currentAccount.pendingChangeRequestedAt ?? new Date()
              : null,
          pendingChangeRequestedBy:
            pendingPlanKey
              ? currentAccount.pendingChangeRequestedBy ?? asString(input.metadata.requestedBy)
              : null,
          pendingChangeMetadataJson:
            pendingPlanKey
              ? toJsonValue({
                  source: "stripe_subscription_metadata",
                  planKey: pendingPlanKey,
                  previousMetadata: currentAccount.pendingChangeMetadataJson ?? null
                })
              : scheduledCancellation
                ? toJsonValue({
                    source: "stripe_subscription_cancellation",
                    scheduledCancellation: serializeScheduledCancellation(
                      scheduledCancellation
                    )
                  })
                : Prisma.DbNull
        }
      });
    });
  }

  private async assertQuota(tenantId: string, quotaKey: BillingQuotaKey, delta: number) {
    const state = await this.resolveBillingState(tenantId);
    this.assertBillingAccessAvailable(state);
    const used = state.usage[quotaKey] ?? 0;
    const limit = state.limits[quotaKey] ?? 0;

    if (used + delta <= limit) {
      return;
    }

    const planLabel = state.trial.isActive
      ? FREE_TRIAL_DEFINITION.label
      : BILLING_PLAN_CATALOG[state.account.currentPlanKey].label;
    const messageByQuota: Record<BillingQuotaKey, string> = {
      [BillingQuotaKey.SEATS]: `${planLabel} planınızdaki ekip erişim limiti doldu. Yeni kullanıcı daveti için plan yükseltin.`,
      [BillingQuotaKey.ACTIVE_JOBS]: `${planLabel} planınızdaki ilan kredisi limiti doldu. Yeni ilan yayımlamak için ek ilan kredisi alın veya planınızı yükseltin.`,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: `${planLabel} planınızdaki aday değerlendirme kredisi doldu. Ek kredi alın veya planınızı yükseltin.`,
      [BillingQuotaKey.AI_INTERVIEWS]: `${planLabel} planınızdaki AI mülakat kredisi doldu. Ek kredi alın veya planınızı yükseltin.`
    };

    throw new BadRequestException(messageByQuota[quotaKey]);
  }

  private assertBillingAccessAvailable(state: ResolvedBillingState) {
    if (state.access.isAllowed) {
      return;
    }

    throw new BadRequestException(
      state.access.blockReason ?? "Abonelik durumunuz yeni işlem başlatmaya uygun değil."
    );
  }

  private async recordUsageEvent(input: {
    tenantId: string;
    quotaKey: BillingQuotaKey;
    entityType: string;
    entityId: string;
    uniqueKey: string;
  }) {
    const state = await this.resolveBillingState(input.tenantId);
    this.assertBillingAccessAvailable(state);
    const used = state.usage[input.quotaKey] ?? 0;
    const included = this.includedForQuota(state.subscription, input.quotaKey);
    const addOnConsumptionDelta =
      Math.max(0, used + 1 - included) - Math.max(0, used - included);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.billingUsageEvent.create({
          data: {
            tenantId: input.tenantId,
            accountId: state.account.id,
            quotaKey: input.quotaKey,
            entityType: input.entityType,
            entityId: input.entityId,
            uniqueKey: input.uniqueKey,
            periodStart: state.account.currentPeriodStart,
            periodEnd: state.account.currentPeriodEnd
          }
        });

        if (addOnConsumptionDelta > 0) {
          await this.consumeAddOnGrantBalance({
            db: tx,
            tenantId: input.tenantId,
            accountId: state.account.id,
            quotaKey: input.quotaKey,
            quantity: addOnConsumptionDelta
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }

      throw error;
    }
  }

  private async consumeAddOnGrantBalance(input: {
    db: Prisma.TransactionClient | PrismaService;
    tenantId: string;
    accountId: string;
    quotaKey: BillingQuotaKey;
    quantity: number;
  }) {
    let remainingToConsume = input.quantity;

    const grants = await input.db.billingQuotaGrant.findMany({
      where: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        quotaKey: input.quotaKey,
        source: {
          in: [BillingGrantSource.ADDON, BillingGrantSource.MANUAL]
        },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]
      },
      orderBy: [{ createdAt: "asc" }]
    });

    grants.sort((left, right) => {
      if (left.expiresAt && right.expiresAt) {
        return left.expiresAt.getTime() - right.expiresAt.getTime();
      }

      if (left.expiresAt) {
        return -1;
      }

      if (right.expiresAt) {
        return 1;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });

    for (const grant of grants) {
      const remainingGrantBalance = Math.max(0, grant.quantity - grant.consumedQuantity);
      if (remainingGrantBalance <= 0) {
        continue;
      }

      const consumeNow = Math.min(remainingGrantBalance, remainingToConsume);
      if (consumeNow <= 0) {
        continue;
      }

      await input.db.billingQuotaGrant.update({
        where: { id: grant.id },
        data: {
          consumedQuantity: {
            increment: consumeNow
          }
        }
      });

      remainingToConsume -= consumeNow;
      if (remainingToConsume === 0) {
        return;
      }
    }

    if (remainingToConsume > 0) {
      throw new BadRequestException("Ek paket bakiyesi bulunamadi.");
    }
  }

  private buildBillingAccess(state: {
    status: BillingAccountStatus;
    trial: ResolvedBillingState["trial"];
  }) {
    if (state.trial.isExpired) {
      return {
        isAllowed: false,
        blockReason:
          "Ücretsiz deneme süreniz sona erdi. Yeni işlem başlatmak için ücretli plana geçin."
      };
    }

    if (!state.trial.isEligible && state.trial.blockReason) {
      return {
        isAllowed: false,
        blockReason: state.trial.blockReason
      };
    }

    if (state.status === BillingAccountStatus.PAST_DUE) {
      return {
        isAllowed: false,
        blockReason:
          "Ödemeniz başarısız görünüyor. Yeni işlem başlatmadan önce faturalandırma durumunuzu güncelleyin."
      };
    }

    if (state.status === BillingAccountStatus.INCOMPLETE) {
      return {
        isAllowed: false,
        blockReason:
          "Abonelik etkinleştirme süreci henüz tamamlanmadı. Devam etmek için ödeme kurulumunu tamamlayın."
      };
    }

    if (state.status === BillingAccountStatus.CANCELED) {
      return {
        isAllowed: false,
        blockReason:
          "Aboneliğiniz sona erdi. Yeni işlem başlatmak için bir plan seçin."
      };
    }

    return {
      isAllowed: true,
      blockReason: null
    };
  }

  private async loadBillingAccountById(accountId: string) {
    return this.prisma.tenantBillingAccount.findUniqueOrThrow({
      where: {
        id: accountId
      }
    });
  }

  private async applyPendingPlanChange(accountId: string) {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.tenantBillingAccount.findUniqueOrThrow({
        where: {
          id: accountId
        }
      });

      if (
        !account.pendingPlanKey ||
        !account.pendingChangeKind ||
        !account.pendingChangeEffectiveAt ||
        account.pendingChangeEffectiveAt.getTime() > now.getTime()
      ) {
        return;
      }

      const targetPlan = BILLING_PLAN_CATALOG[account.pendingPlanKey];
      const effectiveAt = account.pendingChangeEffectiveAt;
      const periodStart =
        account.pendingPlanKey === BillingPlanKey.FLEX ? startOfCurrentMonth(now) : effectiveAt;
      const periodEnd =
        account.pendingPlanKey === BillingPlanKey.FLEX
          ? startOfNextMonth(now)
          : addMonthsUtc(effectiveAt, 1);
      const nextStripeSubscriptionId =
        account.pendingPlanKey === BillingPlanKey.FLEX ? null : account.stripeSubscriptionId;

      await this.appendSubscriptionSnapshot(tx, {
        tenantId: account.tenantId,
        accountId: account.id,
        planKey: account.pendingPlanKey,
        status: BillingAccountStatus.ACTIVE,
        billingEmail: account.billingEmail,
        periodStart,
        periodEnd,
        seatsIncluded: targetPlan.seatsIncluded,
        activeJobsIncluded: targetPlan.activeJobsIncluded,
        candidateProcessingIncluded: targetPlan.candidateProcessingIncluded,
        aiInterviewsIncluded: targetPlan.aiInterviewsIncluded,
        features: targetPlan.features,
        stripeSubscriptionId: nextStripeSubscriptionId,
        stripeCustomerId: account.stripeCustomerId,
        metadata: {
          source: "pending_plan_change",
          previousPlanKey: account.currentPlanKey,
          effectiveAt: effectiveAt.toISOString()
        },
        createdBy: account.pendingChangeRequestedBy
      });

      await tx.tenantBillingAccount.update({
        where: {
          id: account.id
        },
        data: {
          currentPlanKey: account.pendingPlanKey,
          status: BillingAccountStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: nextStripeSubscriptionId,
          featuresJson: targetPlan.features,
          planSnapshotJson: buildPlanSnapshot(targetPlan),
          pendingPlanKey: null,
          pendingChangeKind: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
          pendingChangeRequestedBy: null,
          pendingChangeMetadataJson: Prisma.DbNull,
          lastReconciledAt: now
        }
      });
    });

    return this.loadBillingAccountById(accountId);
  }

  private async rollLocalRecurringPeriod(accountId: string) {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.tenantBillingAccount.findUniqueOrThrow({
        where: {
          id: accountId
        }
      });

      if (
        account.currentPlanKey === BillingPlanKey.FLEX ||
        account.status !== BillingAccountStatus.ACTIVE ||
        account.stripeSubscriptionId ||
        !account.currentPeriodEnd ||
        account.currentPeriodEnd.getTime() > now.getTime()
      ) {
        return;
      }

      const snapshot = asRecord(account.planSnapshotJson);
      const plan = BILLING_PLAN_CATALOG[account.currentPlanKey];
      let periodStart = account.currentPeriodStart ?? account.currentPeriodEnd;
      let periodEnd = account.currentPeriodEnd;

      while (periodEnd.getTime() <= now.getTime()) {
        periodStart = periodEnd;
        periodEnd = addMonthsUtc(periodEnd, 1);
      }

      await this.appendSubscriptionSnapshot(tx, {
        tenantId: account.tenantId,
        accountId: account.id,
        planKey: account.currentPlanKey,
        status: BillingAccountStatus.ACTIVE,
        billingEmail: account.billingEmail,
        periodStart,
        periodEnd,
        seatsIncluded: asNumber(snapshot.seatsIncluded, plan.seatsIncluded),
        activeJobsIncluded: asNumber(snapshot.activeJobsIncluded, plan.activeJobsIncluded),
        candidateProcessingIncluded: asNumber(
          snapshot.candidateProcessingIncluded,
          plan.candidateProcessingIncluded
        ),
        aiInterviewsIncluded: asNumber(snapshot.aiInterviewsIncluded, plan.aiInterviewsIncluded),
        features: buildFeatureSnapshot(account.featuresJson, plan.features),
        stripeSubscriptionId: null,
        stripeCustomerId: account.stripeCustomerId,
        metadata: {
          source: "local_period_rollover"
        },
        createdBy: "system:billing.reconcile"
      });

      await tx.tenantBillingAccount.update({
        where: {
          id: account.id
        },
        data: {
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          lastReconciledAt: now
        }
      });
    });

    return this.loadBillingAccountById(accountId);
  }

  private async reconcileBillingAccount(account: TenantBillingAccount) {
    let nextAccount = account;
    const now = new Date();

    if (
      nextAccount.pendingPlanKey &&
      nextAccount.pendingChangeEffectiveAt &&
      nextAccount.pendingChangeEffectiveAt.getTime() <= now.getTime() &&
      !nextAccount.stripeSubscriptionId
    ) {
      nextAccount = await this.applyPendingPlanChange(nextAccount.id);
    }

    if (
      nextAccount.currentPlanKey !== BillingPlanKey.FLEX &&
      nextAccount.status === BillingAccountStatus.ACTIVE &&
      nextAccount.currentPeriodEnd &&
      nextAccount.currentPeriodEnd.getTime() <= now.getTime() &&
      !nextAccount.stripeSubscriptionId
    ) {
      nextAccount = await this.rollLocalRecurringPeriod(nextAccount.id);
    }

    const needsStripeSync =
      Boolean(nextAccount.stripeSubscriptionId && this.runtimeConfig.providerReadiness.billing.ready) &&
      (
        (nextAccount.currentPeriodEnd &&
          nextAccount.currentPeriodEnd.getTime() <= now.getTime()) ||
        nextAccount.status === BillingAccountStatus.PAST_DUE ||
        nextAccount.status === BillingAccountStatus.INCOMPLETE
      );

    if (needsStripeSync && nextAccount.stripeSubscriptionId) {
      try {
        const subscription = await this.getStripeClient().subscriptions.retrieve(
          nextAccount.stripeSubscriptionId
        );
        await this.upsertSubscriptionFromStripe({
          tenantId: nextAccount.tenantId,
          accountId: nextAccount.id,
          stripeSubscription: subscription,
          metadata: asRecord(subscription.metadata)
        });
        nextAccount = await this.loadBillingAccountById(nextAccount.id);
      } catch (error) {
        if (
          error instanceof Error &&
          /No such subscription/i.test(error.message)
        ) {
          await this.prisma.tenantBillingAccount.update({
            where: {
              id: nextAccount.id
            },
            data: {
              status: BillingAccountStatus.CANCELED,
              stripeSubscriptionId: null,
              lastReconciledAt: now
            }
          });
          nextAccount = await this.loadBillingAccountById(nextAccount.id);
        } else {
          throw error;
        }
      }
    } else if (nextAccount.lastReconciledAt === null) {
      nextAccount = await this.prisma.tenantBillingAccount.update({
        where: {
          id: nextAccount.id
        },
        data: {
          lastReconciledAt: now
        }
      });
    }

    return nextAccount;
  }

  private async reconcileOpenCheckoutSessions(tenantId: string) {
    if (!this.runtimeConfig.providerReadiness.billing.ready) {
      return false;
    }

    const openCheckouts = await this.prisma.billingCheckoutSession.findMany({
      where: {
        tenantId,
        status: BillingCheckoutStatus.OPEN,
        stripeCheckoutSessionId: {
          not: null
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    });

    if (openCheckouts.length === 0) {
      return false;
    }

    const stripe = this.getStripeClient();
    let reconciled = false;

    for (const checkout of openCheckouts) {
      if (!checkout.stripeCheckoutSessionId) {
        continue;
      }

      const session = await stripe.checkout.sessions.retrieve(checkout.stripeCheckoutSessionId);

      if (session.status === "complete") {
        await this.handleCheckoutSessionCompleted(session);
        reconciled = true;
        continue;
      }

      if (session.status === "expired") {
        await this.handleCheckoutSessionExpired(session);
        reconciled = true;
      }
    }

    return reconciled;
  }

  private async resolveBillingState(tenantId: string): Promise<ResolvedBillingState> {
    let baseAccount = await this.ensureBillingAccount(tenantId);
    const reconciledCheckout = await this.reconcileOpenCheckoutSessions(tenantId);
    if (reconciledCheckout) {
      baseAccount = await this.ensureBillingAccount(tenantId);
    }
    const account = await this.reconcileBillingAccount(baseAccount);
    const subscription =
      (await this.prisma.tenantBillingSubscription.findFirst({
        where: {
          tenantId,
          accountId: account.id,
          status: {
            in: [
              BillingAccountStatus.TRIALING,
              BillingAccountStatus.ACTIVE,
              BillingAccountStatus.PAST_DUE,
              BillingAccountStatus.INCOMPLETE
            ]
          }
        },
        orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
      })) ??
      (await this.prisma.tenantBillingSubscription.findFirst({
        where: {
          tenantId,
          accountId: account.id
        },
        orderBy: [{ createdAt: "desc" }]
      })) ??
      (await this.ensureDefaultSubscription(account));

    const fallbackPlan = BILLING_PLAN_CATALOG[subscription.planKey];
    const features = buildFeatureSnapshot(account.featuresJson, fallbackPlan.features);
    const snapshot = asRecord(account.planSnapshotJson);
    const subscriptionMetadata = asRecord(subscription.metadataJson);
    const rawCurrentPeriodStart = account.currentPeriodStart ?? subscription.periodStart;
    const rawCurrentPeriodEnd = account.currentPeriodEnd ?? subscription.periodEnd;
    const now = new Date();
    const isFlexAccount =
      account.currentPlanKey === BillingPlanKey.FLEX &&
      account.status !== BillingAccountStatus.TRIALING;
    const flexPeriodStart = startOfCurrentMonth(now);
    const flexPeriodEnd = startOfNextMonth(now);
    const trialStartedAtBase =
      account.status === BillingAccountStatus.TRIALING
        ? rawCurrentPeriodStart
        : parseOptionalDate(snapshot.trialStartedAt) ??
          parseOptionalDate(subscriptionMetadata.trialStartedAt);
    const configuredTrialEndsAt = trialStartedAtBase
      ? addDaysUtc(trialStartedAtBase, FREE_TRIAL_DEFINITION.durationDays)
      : null;
    const trialEndsAt =
      account.status === BillingAccountStatus.TRIALING
        ? configuredTrialEndsAt ?? rawCurrentPeriodEnd
        : parseOptionalDate(snapshot.trialEndsAt) ??
          parseOptionalDate(subscriptionMetadata.trialEndsAt);
    const currentPeriodStart = isFlexAccount ? flexPeriodStart : rawCurrentPeriodStart;
    const currentPeriodEnd =
      account.status === BillingAccountStatus.TRIALING && trialEndsAt
        ? trialEndsAt
        : isFlexAccount
          ? flexPeriodEnd
          : rawCurrentPeriodEnd;
    const trialStartedAt = trialStartedAtBase;
    const trialBlockReason =
      asString(snapshot.trialBlockedReason) ??
      asString(subscriptionMetadata.trialBlockedReason);
    const trialIsEligible = trialBlockReason
      ? false
      : asBoolean(snapshot.trialEligible, asBoolean(subscriptionMetadata.trialEligible, true));
    const trialIsExpired = Boolean(
      account.status === BillingAccountStatus.TRIALING &&
        trialEndsAt &&
        trialEndsAt.getTime() <= now.getTime()
    );
    const trialIsActive = Boolean(
      account.status === BillingAccountStatus.TRIALING &&
        trialIsEligible &&
        trialEndsAt &&
        trialEndsAt.getTime() > now.getTime()
    );
    const daysRemaining =
      trialIsActive && trialEndsAt ? diffDaysCeil(now, trialEndsAt) : 0;
    const pendingChangeMetadata = asRecord(account.pendingChangeMetadataJson);
    const pendingChange =
      account.pendingPlanKey &&
      account.pendingChangeKind &&
      account.pendingChangeEffectiveAt
        ? {
            planKey: account.pendingPlanKey,
            kind: account.pendingChangeKind,
            effectiveAt: account.pendingChangeEffectiveAt,
            requestedAt: account.pendingChangeRequestedAt ?? null,
            requestedBy: account.pendingChangeRequestedBy ?? null
          }
        : null;
    const scheduledCancellationBase =
      !pendingChange && account.stripeSubscriptionId
        ? parseScheduledCancellation(pendingChangeMetadata.scheduledCancellation)
        : null;
    const scheduledCancellation = scheduledCancellationBase
      ? {
          ...scheduledCancellationBase,
          canResume: true
        }
      : null;

    const [seatsUsed, jobCreditsAgg, candidateProcessingAgg, aiInterviewsAgg, grants] =
      await Promise.all([
        this.prisma.user.count({
          where: {
            tenantId,
            deletedAt: null,
            status: {
              in: ["ACTIVE", "INVITED"]
            }
          }
        }),
        this.prisma.billingUsageEvent.aggregate({
          where: {
            tenantId,
            quotaKey: BillingQuotaKey.ACTIVE_JOBS,
            occurredAt: {
              gte: currentPeriodStart,
              lt: currentPeriodEnd
            }
          },
          _sum: {
            quantity: true
          }
        }),
        this.prisma.billingUsageEvent.aggregate({
          where: {
            tenantId,
            quotaKey: BillingQuotaKey.CANDIDATE_PROCESSING,
            occurredAt: {
              gte: currentPeriodStart,
              lt: currentPeriodEnd
            }
          },
          _sum: {
            quantity: true
          }
        }),
        this.prisma.billingUsageEvent.aggregate({
          where: {
            tenantId,
            quotaKey: BillingQuotaKey.AI_INTERVIEWS,
            occurredAt: {
              gte: currentPeriodStart,
              lt: currentPeriodEnd
            }
          },
          _sum: {
            quantity: true
          }
        }),
        this.prisma.billingQuotaGrant.findMany({
          where: {
            tenantId,
            accountId: account.id,
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]
          },
          orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }]
        })
      ]);

    const addOnTotals: Record<BillingQuotaKey, number> = {
      [BillingQuotaKey.SEATS]: 0,
      [BillingQuotaKey.ACTIVE_JOBS]: 0,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 0,
      [BillingQuotaKey.AI_INTERVIEWS]: 0
    };

    for (const grant of grants) {
      addOnTotals[grant.quotaKey] += Math.max(0, grant.quantity - grant.consumedQuantity);
    }

    const usage: Record<BillingQuotaKey, number> = {
      [BillingQuotaKey.SEATS]: seatsUsed,
      [BillingQuotaKey.ACTIVE_JOBS]: jobCreditsAgg._sum.quantity ?? 0,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: candidateProcessingAgg._sum.quantity ?? 0,
      [BillingQuotaKey.AI_INTERVIEWS]: aiInterviewsAgg._sum.quantity ?? 0
    };

    const limits: Record<BillingQuotaKey, number> = {
      [BillingQuotaKey.SEATS]: quotaLimitForDisplay({
        used: usage[BillingQuotaKey.SEATS],
        included: asNumber(snapshot.seatsIncluded, subscription.seatsIncluded),
        addOnRemaining: addOnTotals[BillingQuotaKey.SEATS]
      }),
      [BillingQuotaKey.ACTIVE_JOBS]: quotaLimitForDisplay({
        used: usage[BillingQuotaKey.ACTIVE_JOBS],
        included: asNumber(snapshot.activeJobsIncluded, subscription.activeJobsIncluded),
        addOnRemaining: addOnTotals[BillingQuotaKey.ACTIVE_JOBS]
      }),
      [BillingQuotaKey.CANDIDATE_PROCESSING]: quotaLimitForDisplay({
        used: usage[BillingQuotaKey.CANDIDATE_PROCESSING],
        included: asNumber(
          snapshot.candidateProcessingIncluded,
          subscription.candidateProcessingIncluded
        ),
        addOnRemaining: addOnTotals[BillingQuotaKey.CANDIDATE_PROCESSING]
      }),
      [BillingQuotaKey.AI_INTERVIEWS]: quotaLimitForDisplay({
        used: usage[BillingQuotaKey.AI_INTERVIEWS],
        included: asNumber(snapshot.aiInterviewsIncluded, subscription.aiInterviewsIncluded),
        addOnRemaining: addOnTotals[BillingQuotaKey.AI_INTERVIEWS]
      })
    };
    const trial = {
      isActive: trialIsActive,
      isExpired: trialIsExpired,
      isEligible: trialIsEligible,
      blockReason: trialBlockReason,
      startedAt: trialStartedAt,
      endsAt: trialEndsAt,
      daysRemaining,
      config: FREE_TRIAL_DEFINITION
    };
    const access = this.buildBillingAccess({
      status: account.status,
      trial
    });

    return {
      account: {
        id: account.id,
        tenantId: account.tenantId,
        billingEmail: account.billingEmail,
        stripeCustomerId: account.stripeCustomerId,
        stripeSubscriptionId: account.stripeSubscriptionId,
        currentPlanKey: account.currentPlanKey,
        status: account.status,
        currentPeriodStart,
        currentPeriodEnd,
        features,
        snapshot: {
          seatsIncluded: asNumber(snapshot.seatsIncluded, subscription.seatsIncluded),
          activeJobsIncluded: asNumber(
            snapshot.activeJobsIncluded,
            subscription.activeJobsIncluded
          ),
          candidateProcessingIncluded: asNumber(
            snapshot.candidateProcessingIncluded,
            subscription.candidateProcessingIncluded
          ),
          aiInterviewsIncluded: asNumber(
            snapshot.aiInterviewsIncluded,
            subscription.aiInterviewsIncluded
          )
        },
        pendingChange,
        scheduledCancellation
      },
      subscription: {
        id: subscription.id,
        planKey: subscription.planKey,
        status: subscription.status,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        periodStart: subscription.periodStart,
        periodEnd: subscription.periodEnd,
        seatsIncluded: subscription.seatsIncluded,
        activeJobsIncluded: subscription.activeJobsIncluded,
        candidateProcessingIncluded: subscription.candidateProcessingIncluded,
        aiInterviewsIncluded: subscription.aiInterviewsIncluded,
        features: buildFeatureSnapshot(subscription.featuresJson, fallbackPlan.features)
      },
      trial,
      addOnTotals,
      usage,
      limits,
      access
    };
  }

  private includedForQuota(
    subscription: ResolvedBillingState["subscription"],
    quotaKey: BillingQuotaKey
  ) {
    switch (quotaKey) {
      case BillingQuotaKey.SEATS:
        return subscription.seatsIncluded;
      case BillingQuotaKey.ACTIVE_JOBS:
        return subscription.activeJobsIncluded;
      case BillingQuotaKey.CANDIDATE_PROCESSING:
        return subscription.candidateProcessingIncluded;
      case BillingQuotaKey.AI_INTERVIEWS:
        return subscription.aiInterviewsIncluded;
      default:
        return 0;
    }
  }

  private async ensureBillingAccount(tenantId: string): Promise<TenantBillingAccount> {
    const existing = await this.prisma.tenantBillingAccount.findUnique({
      where: { tenantId }
    });

    if (existing) {
      await this.backfillTrialClaim(existing.tenantId, existing.billingEmail);
      return existing;
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        role: "OWNER"
      },
      select: {
        id: true,
        email: true
      }
    });

    const now = new Date();
    const currentPeriodStart = now;
    const currentPeriodEnd = addDaysUtc(now, FREE_TRIAL_DEFINITION.durationDays);
    const ownerEmail = owner?.email?.trim() ?? null;
    const trialEligibility = ownerEmail
      ? await this.resolveTrialEligibility({ tenantId, ownerEmail })
      : {
          isEligible: true,
          normalizedEmail: null,
          blockReason: null
        };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const snapshot = trialEligibility.isEligible
          ? {
              ...buildTrialSnapshot(),
              trialEligible: true,
              trialNormalizedEmail: trialEligibility.normalizedEmail,
              trialStartedAt: currentPeriodStart.toISOString(),
              trialEndsAt: currentPeriodEnd.toISOString()
            }
          : buildBlockedTrialSnapshot({
              normalizedEmail: trialEligibility.normalizedEmail ?? "unknown",
              blockReason:
                trialEligibility.blockReason ?? REPEAT_TRIAL_BLOCK_REASON
            });

        const features = trialEligibility.isEligible
          ? FREE_TRIAL_DEFINITION.features
          : DISABLED_TRIAL_FEATURES;
        const accountStatus = trialEligibility.isEligible
          ? BillingAccountStatus.TRIALING
          : BillingAccountStatus.INCOMPLETE;
        const subscriptionStatus = accountStatus;
        const subscriptionPeriodStart = trialEligibility.isEligible
          ? currentPeriodStart
          : now;
        const subscriptionPeriodEnd = trialEligibility.isEligible
          ? currentPeriodEnd
          : now;

        const account = await tx.tenantBillingAccount.create({
          data: {
            tenantId,
            billingEmail: ownerEmail,
            currentPlanKey: BillingPlanKey.STARTER,
            status: accountStatus,
            currentPeriodStart: subscriptionPeriodStart,
            currentPeriodEnd: subscriptionPeriodEnd,
            featuresJson: features,
            planSnapshotJson: snapshot
          }
        });

        await tx.tenantBillingSubscription.create({
          data: {
            tenantId,
            accountId: account.id,
            planKey: BillingPlanKey.STARTER,
            status: subscriptionStatus,
            billingEmail: ownerEmail,
            periodStart: subscriptionPeriodStart,
            periodEnd: subscriptionPeriodEnd,
            seatsIncluded: asNumber(snapshot.seatsIncluded, 0),
            activeJobsIncluded: asNumber(snapshot.activeJobsIncluded, 0),
            candidateProcessingIncluded: asNumber(
              snapshot.candidateProcessingIncluded,
              0
            ),
            aiInterviewsIncluded: asNumber(snapshot.aiInterviewsIncluded, 0),
            featuresJson: features,
            metadataJson: {
              bootstrap: trialEligibility.isEligible ? "free_trial" : "trial_ineligible",
              trialEligible: trialEligibility.isEligible,
              trialNormalizedEmail: trialEligibility.normalizedEmail,
              trialStartedAt: trialEligibility.isEligible
                ? currentPeriodStart.toISOString()
                : null,
              trialEndsAt: trialEligibility.isEligible
                ? currentPeriodEnd.toISOString()
                : null,
              trialBlockedReason: trialEligibility.blockReason
            },
            createdBy: "system:billing.bootstrap"
          }
        });

        if (trialEligibility.isEligible && trialEligibility.normalizedEmail) {
          await tx.billingTrialClaim.upsert({
            where: {
              normalizedEmail: trialEligibility.normalizedEmail
            },
            update: {
              lastSeenAt: new Date()
            },
            create: {
              normalizedEmail: trialEligibility.normalizedEmail,
              emailDomain: extractEmailDomain(ownerEmail ?? trialEligibility.normalizedEmail),
              firstTenantId: tenantId,
              firstUserId: owner?.id ?? null,
              metadataJson: {
                source: "free_trial_bootstrap"
              }
            }
          });
        }

        return account;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const concurrent = await this.prisma.tenantBillingAccount.findUnique({
          where: { tenantId }
        });

        if (concurrent) {
          return concurrent;
        }

        return this.ensureBillingAccount(tenantId);
      }

      throw error;
    }
  }

  private async ensureDefaultSubscription(account: {
    id: string;
    tenantId: string;
    billingEmail: string | null;
    currentPlanKey: BillingPlanKey;
    status: BillingAccountStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    featuresJson: Prisma.JsonValue | null;
    planSnapshotJson: Prisma.JsonValue | null;
  }) {
    const plan = BILLING_PLAN_CATALOG[account.currentPlanKey];
    const periodStart = account.currentPeriodStart ?? startOfCurrentMonth();
    const periodEnd = account.currentPeriodEnd ?? startOfNextMonth();
    const snapshot = asRecord(account.planSnapshotJson);
    const features = buildFeatureSnapshot(account.featuresJson, plan.features);

    return this.prisma.tenantBillingSubscription.create({
      data: {
        tenantId: account.tenantId,
        accountId: account.id,
        planKey: account.currentPlanKey,
        status: account.status,
        billingEmail: account.billingEmail,
        periodStart,
        periodEnd,
        seatsIncluded: asNumber(snapshot.seatsIncluded, plan.seatsIncluded),
        activeJobsIncluded: asNumber(snapshot.activeJobsIncluded, plan.activeJobsIncluded),
        candidateProcessingIncluded: asNumber(
          snapshot.candidateProcessingIncluded,
          plan.candidateProcessingIncluded
        ),
        aiInterviewsIncluded: asNumber(
          snapshot.aiInterviewsIncluded,
          plan.aiInterviewsIncluded
        ),
        featuresJson: features,
        metadataJson: {
          bootstrap:
            account.status === BillingAccountStatus.TRIALING
              ? "trial_subscription_backfill"
              : "default_subscription_backfill",
          trialEligible: asBoolean(snapshot.trialEligible, true),
          trialBlockedReason: asString(snapshot.trialBlockedReason),
          trialStartedAt: parseOptionalDate(snapshot.trialStartedAt)?.toISOString() ?? null,
          trialEndsAt: parseOptionalDate(snapshot.trialEndsAt)?.toISOString() ?? null
        },
        createdBy: "system:billing.backfill"
      }
    });
  }

  private async backfillTrialClaim(tenantId: string, billingEmail: string | null) {
    if (!billingEmail) {
      return;
    }

    const normalizedEmail = normalizeTrialEmail(billingEmail);
    const existingClaim = await this.prisma.billingTrialClaim.findUnique({
      where: {
        normalizedEmail
      },
      select: {
        id: true
      }
    });

    if (existingClaim) {
      return;
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        role: "OWNER"
      },
      select: {
        id: true
      }
    });

    try {
      await this.prisma.billingTrialClaim.create({
        data: {
          normalizedEmail,
          emailDomain: extractEmailDomain(billingEmail),
          firstTenantId: tenantId,
          firstUserId: owner?.id ?? null,
          metadataJson: {
            source: "billing_account_backfill"
          }
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }

      throw error;
    }
  }

  private async resolveTrialEligibility(input: {
    tenantId: string;
    ownerEmail: string;
  }) {
    const normalizedEmail = normalizeTrialEmail(input.ownerEmail);
    const existingClaim = await this.prisma.billingTrialClaim.findUnique({
      where: {
        normalizedEmail
      }
    });

    if (existingClaim && existingClaim.firstTenantId !== input.tenantId) {
      return {
        isEligible: false,
        normalizedEmail,
        blockReason: REPEAT_TRIAL_BLOCK_REASON
      };
    }

    const [legacyBillingAccount, legacyOwner] = await Promise.all([
      this.prisma.tenantBillingAccount.findFirst({
        where: {
          tenantId: {
            not: input.tenantId
          },
          billingEmail: {
            equals: input.ownerEmail,
            mode: "insensitive"
          }
        },
        select: {
          tenantId: true
        }
      }),
      this.prisma.user.findFirst({
        where: {
          tenantId: {
            not: input.tenantId
          },
          deletedAt: null,
          role: "OWNER",
          email: {
            equals: input.ownerEmail,
            mode: "insensitive"
          }
        },
        select: {
          tenantId: true
        }
      })
    ]);

    if (legacyBillingAccount || legacyOwner) {
      return {
        isEligible: false,
        normalizedEmail,
        blockReason: REPEAT_TRIAL_BLOCK_REASON
      };
    }

    return {
      isEligible: true,
      normalizedEmail,
      blockReason: null
    };
  }

  private buildCheckoutUrls() {
    const base = this.runtimeConfig.publicWebBaseUrl.replace(/\/+$/, "");
    return {
      successUrl: `${base}/subscription?billing=success`,
      cancelUrl: `${base}/subscription?billing=cancel`
    };
  }

  private buildPlanLineItem(
    plan: BillingPlanDefinition
  ): StripeLineItem {
    const priceId = this.runtimeConfig.stripeBillingConfig.planPriceIds[plan.key];

    if (priceId) {
      return {
        price: priceId,
        quantity: 1
      };
    }

    if (!plan.monthlyAmountCents) {
      throw new BadRequestException("Custom enterprise plan için özel teklif akışını kullanın.");
    }

    return {
      quantity: 1,
      price_data: {
        currency: plan.currency,
        unit_amount: plan.monthlyAmountCents,
        recurring: {
          interval: "month"
        },
        product_data: {
          name: `Candit ${plan.label}`,
          description: plan.description
        }
      }
    };
  }

  private buildAddOnLineItem(
    addOn: BillingAddonDefinition
  ): StripeLineItem {
    const priceId = this.runtimeConfig.stripeBillingConfig.addOnPriceIds[addOn.key];

    if (priceId) {
      return {
        price: priceId,
        quantity: 1
      };
    }

    return {
      quantity: 1,
      price_data: {
        currency: addOn.currency,
        unit_amount: addOn.amountCents,
        product_data: {
          name: addOn.label,
          description: addOn.description
        }
      }
    };
  }

  private async findOrCreateStripeCustomer(
    existingCustomerId: string | null,
    tenantId: string,
    preferredEmail?: string
  ) {
    const stripe = this.getStripeClient();

    if (existingCustomerId) {
      return stripe.customers.retrieve(existingCustomerId).then((customer: any) => {
        if (customer.deleted) {
          throw new BadRequestException("Stripe müşteri kaydı silinmiş görünüyor.");
        }
        return customer;
      });
    }

    const [tenant, owner] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
      }),
      this.prisma.user.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          role: "OWNER"
        },
        select: {
          email: true,
          fullName: true
        }
      })
    ]);

    const customer = await stripe.customers.create({
      email: preferredEmail ?? owner?.email ?? undefined,
      name: tenant?.name ?? owner?.fullName ?? "Candit customer",
      metadata: {
        tenantId
      }
    });

    await this.prisma.tenantBillingAccount.update({
      where: { tenantId },
      data: {
        stripeCustomerId: customer.id,
        billingEmail: preferredEmail ?? owner?.email ?? undefined
      }
    });

    return customer;
  }

  private planKeyFromPriceId(priceId: string | null) {
    if (!priceId) {
      return null;
    }

    const entries = Object.entries(this.runtimeConfig.stripeBillingConfig.planPriceIds);
    const matched = entries.find(([, configuredPriceId]) => configuredPriceId === priceId);

    return matched ? (matched[0] as BillingPlanKey) : null;
  }

  private getManagedPlanPriceId(planKey: Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">) {
    const priceId = this.runtimeConfig.stripeBillingConfig.planPriceIds[planKey];

    if (!priceId) {
      throw new BadRequestException(
        `${planKey} planı için Stripe price id yapılandırması eksik.`
      );
    }

    return priceId;
  }

  private buildPlanSubscriptionMetadata(input: {
    tenantId: string;
    requestedBy: string;
    planKey: Exclude<BillingPlanKey, "FLEX" | "ENTERPRISE">;
    billingEmail?: string | null;
  }) {
    const plan = BILLING_PLAN_CATALOG[input.planKey];

    return {
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      checkoutType: BillingCheckoutType.PLAN_SUBSCRIPTION,
      planKey: input.planKey,
      billingEmail: input.billingEmail ?? "",
      seatsIncluded: String(plan.seatsIncluded),
      activeJobsIncluded: String(plan.activeJobsIncluded),
      candidateProcessingIncluded: String(plan.candidateProcessingIncluded),
      aiInterviewsIncluded: String(plan.aiInterviewsIncluded),
      featuresJson: JSON.stringify(plan.features)
    };
  }

  private safePlanKey(value: string | null) {
    if (!value) {
      return null;
    }

    return value in BILLING_PLAN_CATALOG ? (value as BillingPlanKey) : null;
  }

  private safeAddonKey(value: string | null) {
    if (!value) {
      return null;
    }

    return value in BILLING_ADDON_CATALOG ? (value as BillingAddonKey) : null;
  }

  private getStripeClient() {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const config = this.runtimeConfig.stripeBillingConfig;
    if (!config.apiKey) {
      throw new BadRequestException(
        "Stripe yapılandırması eksik. STRIPE_SECRET_KEY ayarını tamamlayın."
      );
    }

    const StripeSdk = StripeConstructor as unknown as new (
      apiKey: string,
      config: { apiVersion: string }
    ) => StripeClient;

    this.stripeClient = new StripeSdk(config.apiKey, {
      apiVersion: "2026-02-25.clover"
    });

    return this.stripeClient;
  }
}
