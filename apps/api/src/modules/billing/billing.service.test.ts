import assert from "node:assert/strict";
import test from "node:test";
import {
  BillingAccountStatus,
  BillingPlanChangeKind,
  BillingPlanKey,
  BillingQuotaKey
} from "@prisma/client";
import { BILLING_PLAN_CATALOG, FREE_TRIAL_DEFINITION } from "./billing-catalog";
import { BillingService } from "./billing.service";

function createService(overrides?: {
  prisma?: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
}) {
  const prisma = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(prisma),
    billingCheckoutSession: {
      findMany: async () => [],
      create: async () => ({})
    },
    tenantBillingSubscription: {
      findFirst: async () => null,
      findUnique: async () => null,
      findMany: async () => [],
      create: async (args: any) => ({ id: "sub_created", ...args.data }),
      update: async (args: any) => ({ id: args.where.id, ...args.data }),
      updateMany: async () => ({ count: 0 })
    },
    tenantBillingAccount: {
      update: async (args: any) => ({ id: args.where.id ?? "acc_1", ...args.data }),
      findUniqueOrThrow: async () => {
        throw new Error("tenantBillingAccount.findUniqueOrThrow not mocked");
      }
    },
    user: {
      count: async () => 1
    },
    billingUsageEvent: {
      aggregate: async () => ({ _sum: { quantity: 0 } }),
      create: async () => ({})
    },
    billingQuotaGrant: {
      findMany: async () => [],
      create: async () => ({})
    },
    ...overrides?.prisma
  };

  const runtimeConfig = {
    stripeBillingConfig: {
      apiKeyConfigured: false,
      planPriceIds: {
        FLEX: "",
        STARTER: "",
        GROWTH: "",
        ENTERPRISE: ""
      }
    },
    providerReadiness: {
      billing: {
        ready: false
      }
    },
    isProduction: false,
    isInternalBillingAdmin: () => false,
    ...overrides?.runtimeConfig
  };

  const notifications = {
    send: async () => ({ sent: true })
  };

  return new BillingService(prisma as never, runtimeConfig as never, notifications as never);
}

function createResolvedState(overrides?: Record<string, unknown>) {
  const plan = BILLING_PLAN_CATALOG.STARTER;
  const currentPeriodStart = new Date("2026-04-01T00:00:00.000Z");
  const currentPeriodEnd = new Date("2026-05-01T00:00:00.000Z");

  return {
    account: {
      id: "acc_1",
      tenantId: "ten_1",
      billingEmail: "owner@example.com",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPlanKey: BillingPlanKey.STARTER,
      status: BillingAccountStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
      features: plan.features,
      snapshot: {
        seatsIncluded: plan.seatsIncluded,
        activeJobsIncluded: plan.activeJobsIncluded,
        candidateProcessingIncluded: plan.candidateProcessingIncluded,
        aiInterviewsIncluded: plan.aiInterviewsIncluded
      },
      pendingChange: null,
      scheduledCancellation: null
    },
    subscription: {
      id: "sub_1",
      planKey: BillingPlanKey.STARTER,
      status: BillingAccountStatus.ACTIVE,
      stripeSubscriptionId: null,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
      seatsIncluded: plan.seatsIncluded,
      activeJobsIncluded: plan.activeJobsIncluded,
      candidateProcessingIncluded: plan.candidateProcessingIncluded,
      aiInterviewsIncluded: plan.aiInterviewsIncluded,
      features: plan.features
    },
    trial: {
      isActive: false,
      isExpired: false,
      isEligible: true,
      blockReason: null,
      startedAt: null,
      endsAt: null,
      daysRemaining: 0,
      config: FREE_TRIAL_DEFINITION
    },
    addOnTotals: {
      [BillingQuotaKey.SEATS]: 0,
      [BillingQuotaKey.ACTIVE_JOBS]: 0,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 0,
      [BillingQuotaKey.AI_INTERVIEWS]: 0
    },
    usage: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 0,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 0,
      [BillingQuotaKey.AI_INTERVIEWS]: 0
    },
    limits: {
      [BillingQuotaKey.SEATS]: plan.seatsIncluded,
      [BillingQuotaKey.ACTIVE_JOBS]: plan.activeJobsIncluded,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: plan.candidateProcessingIncluded,
      [BillingQuotaKey.AI_INTERVIEWS]: plan.aiInterviewsIncluded
    },
    access: {
      isAllowed: true,
      blockReason: null
    },
    ...overrides
  };
}

function startOfCurrentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

test("getOverview surfaces quota warnings and scheduled change notices", async () => {
  const service = createService();
  const state = createResolvedState({
    usage: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 2,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 80,
      [BillingQuotaKey.AI_INTERVIEWS]: 3
    },
    limits: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 2,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 100,
      [BillingQuotaKey.AI_INTERVIEWS]: 15
    },
    account: {
      ...createResolvedState().account,
      pendingChange: {
        planKey: BillingPlanKey.FLEX,
        kind: BillingPlanChangeKind.FLEX_TRANSITION,
        effectiveAt: new Date("2026-05-01T00:00:00.000Z"),
        requestedAt: new Date("2026-04-15T00:00:00.000Z"),
        requestedBy: "usr_1"
      }
    }
  });

  (service as any).resolveBillingState = async () => state;

  const overview = await service.getOverview("ten_1");

  assert.ok(overview.warnings.includes("İlan kredisi limiti doldu."));
  assert.ok(
    overview.warnings.includes("Aday değerlendirme kredisi kullanımınız %80 seviyesine ulaştı.")
  );
  assert.ok(overview.account.pendingChange);
});

test("assertQuota rejects when the requested delta exceeds the current limit", async () => {
  const service = createService();
  const state = createResolvedState({
    usage: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 2,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 0,
      [BillingQuotaKey.AI_INTERVIEWS]: 0
    },
    limits: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 2,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 100,
      [BillingQuotaKey.AI_INTERVIEWS]: 15
    }
  });

  (service as any).resolveBillingState = async () => state;

  await assert.rejects(
    () => (service as any).assertQuota("ten_1", BillingQuotaKey.ACTIVE_JOBS, 1),
    /ilan kredisi limiti doldu/
  );
});

test("assertFeatureEnabled blocks access for past due accounts", async () => {
  const service = createService();
  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      status: BillingAccountStatus.PAST_DUE
    },
    access: {
      isAllowed: false,
      blockReason:
        "Ödemeniz başarısız görünüyor. Yeni işlem başlatmadan önce faturalandırma durumunuzu güncelleyin."
    }
  });

  (service as any).resolveBillingState = async () => state;

  await assert.rejects(
    () => service.assertFeatureEnabled("ten_1", "advancedReporting"),
    /Ödemeniz başarısız görünüyor/
  );
});

test("resolveBillingState rolls FLEX accounts to the active calendar month window", async () => {
  const service = createService({
    prisma: {
      tenantBillingSubscription: {
        findFirst: async () => ({
          id: "sub_flex",
          planKey: BillingPlanKey.FLEX,
          status: BillingAccountStatus.ACTIVE,
          stripeSubscriptionId: null,
          periodStart: new Date("2026-03-01T00:00:00.000Z"),
          periodEnd: new Date("2026-04-01T00:00:00.000Z"),
          seatsIncluded: 1,
          activeJobsIncluded: 0,
          candidateProcessingIncluded: 0,
          aiInterviewsIncluded: 0,
          featuresJson: BILLING_PLAN_CATALOG.FLEX.features,
          metadataJson: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z")
        })
      }
    }
  });

  (service as any).ensureBillingAccount = async () => ({
    id: "acc_flex",
    tenantId: "ten_flex",
    billingEmail: "flex@example.com",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPlanKey: BillingPlanKey.FLEX,
    status: BillingAccountStatus.ACTIVE,
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    lastReconciledAt: new Date("2026-04-15T00:00:00.000Z"),
    pendingPlanKey: null,
    pendingChangeKind: null,
    pendingChangeEffectiveAt: null,
    pendingChangeRequestedAt: null,
    pendingChangeRequestedBy: null,
    pendingChangeMetadataJson: null,
    featuresJson: BILLING_PLAN_CATALOG.FLEX.features,
    planSnapshotJson: {
      seatsIncluded: 1,
      activeJobsIncluded: 0,
      candidateProcessingIncluded: 0,
      aiInterviewsIncluded: 0
    }
  });

  const now = new Date();
  const state = await (service as any).resolveBillingState("ten_flex");

  assert.equal(
    state.account.currentPeriodStart.toISOString(),
    startOfCurrentMonth(now).toISOString()
  );
  assert.equal(
    state.account.currentPeriodEnd.toISOString(),
    startOfNextMonth(now).toISOString()
  );
});

test("ensureBillingAccount starts the first company trial for an owner email", async () => {
  const createdAccounts: any[] = [];
  const createdSubscriptions: any[] = [];
  const trialClaims: any[] = [];
  const service = createService({
    prisma: {
      tenantBillingAccount: {
        findUnique: async () => null,
        findFirst: async () => null,
        create: async (args: any) => {
          createdAccounts.push(args.data);
          return {
            id: "acc_first",
            ...args.data
          };
        }
      },
      tenantBillingSubscription: {
        create: async (args: any) => {
          createdSubscriptions.push(args.data);
          return {
            id: "sub_first",
            ...args.data
          };
        }
      },
      billingTrialClaim: {
        findUnique: async () => null,
        upsert: async (args: any) => {
          trialClaims.push(args);
          return {
            id: "claim_first",
            ...args.create
          };
        }
      },
      user: {
        findFirst: async (args: any) =>
          args.where.tenantId === "ten_first"
            ? {
                id: "usr_first",
                email: "owner@example.com"
              }
            : null
      }
    }
  });

  const account = await (service as any).ensureBillingAccount("ten_first");

  assert.equal(account.status, BillingAccountStatus.TRIALING);
  assert.equal(createdAccounts[0].tenantId, "ten_first");
  assert.equal(createdAccounts[0].billingEmail, "owner@example.com");
  assert.equal(createdSubscriptions[0].seatsIncluded, FREE_TRIAL_DEFINITION.seatsIncluded);
  assert.equal(createdSubscriptions[0].activeJobsIncluded, FREE_TRIAL_DEFINITION.activeJobsIncluded);
  assert.equal(trialClaims.length, 1);
  assert.equal(trialClaims[0].create.firstTenantId, "ten_first");
});

test("ensureBillingAccount keeps additional companies on a separate paid billing boundary", async () => {
  const createdAccounts: any[] = [];
  const createdSubscriptions: any[] = [];
  const trialClaims: any[] = [];
  const service = createService({
    prisma: {
      tenantBillingAccount: {
        findUnique: async () => null,
        create: async (args: any) => {
          createdAccounts.push(args.data);
          return {
            id: "acc_second",
            ...args.data
          };
        }
      },
      tenantBillingSubscription: {
        create: async (args: any) => {
          createdSubscriptions.push(args.data);
          return {
            id: "sub_second",
            ...args.data
          };
        }
      },
      billingTrialClaim: {
        findUnique: async () => ({
          id: "claim_first",
          normalizedEmail: "owner@example.com",
          firstTenantId: "ten_first"
        }),
        upsert: async (args: any) => {
          trialClaims.push(args);
          return args.create;
        }
      },
      user: {
        findFirst: async () => ({
          id: "usr_second",
          email: "owner@example.com"
        })
      }
    }
  });

  const account = await (service as any).ensureBillingAccount("ten_second");

  assert.equal(account.status, BillingAccountStatus.INCOMPLETE);
  assert.equal(createdAccounts[0].tenantId, "ten_second");
  assert.equal(createdAccounts[0].billingEmail, "owner@example.com");
  assert.equal(createdSubscriptions[0].seatsIncluded, 0);
  assert.equal(createdSubscriptions[0].activeJobsIncluded, 0);
  assert.equal(createdSubscriptions[0].candidateProcessingIncluded, 0);
  assert.equal(createdSubscriptions[0].aiInterviewsIncluded, 0);
  assert.equal(createdSubscriptions[0].metadataJson.bootstrap, "trial_ineligible");
  assert.match(
    String(createdSubscriptions[0].metadataJson.trialBlockedReason),
    /ücretsiz denemeyi daha önce kullandı/i
  );
  assert.equal(trialClaims.length, 0);
});

test("createPlanCheckoutSession schedules downgrades for the end of the current period", async () => {
  const updates: any[] = [];
  const service = createService({
    prisma: {
      tenantBillingAccount: {
        update: async (args: any) => {
          updates.push(args);
          return {
            id: "acc_growth",
            ...args.data
          };
        }
      }
    }
  });
  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      id: "acc_growth",
      currentPlanKey: BillingPlanKey.GROWTH,
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z")
    },
    subscription: {
      ...createResolvedState().subscription,
      planKey: BillingPlanKey.GROWTH
    }
  });

  (service as any).resolveBillingState = async () => state;

  const result = await service.createPlanCheckoutSession({
    tenantId: "ten_1",
    requestedBy: "usr_1",
    planKey: "STARTER"
  });

  assert.equal(result.flow, "scheduled");
  assert.equal(updates[0].data.pendingPlanKey, BillingPlanKey.STARTER);
  assert.equal(updates[0].data.pendingChangeKind, BillingPlanChangeKind.DOWNGRADE);
});

test("createPlanCheckoutSession activates recurring plans locally in development when Stripe is not ready", async () => {
  const service = createService();
  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      currentPlanKey: BillingPlanKey.FLEX
    },
    subscription: {
      ...createResolvedState().subscription,
      planKey: BillingPlanKey.FLEX,
      seatsIncluded: 1,
      activeJobsIncluded: 0,
      candidateProcessingIncluded: 0,
      aiInterviewsIncluded: 0,
      features: BILLING_PLAN_CATALOG.FLEX.features
    }
  });

  (service as any).resolveBillingState = async () => state;
  (service as any).activateLocalRecurringPlan = async () => ({
    checkoutUrl: null,
    sessionId: "local:test",
    flow: "local_activation"
  });

  const result = await service.createPlanCheckoutSession({
    tenantId: "ten_1",
    requestedBy: "usr_1",
    planKey: "GROWTH"
  });

  assert.equal(result.flow, "local_activation");
  assert.equal(result.sessionId, "local:test");
});

test("createPlanCheckoutSession upgrades managed Stripe subscriptions immediately with proration", async () => {
  const upsertCalls: any[] = [];
  const stripeUpdateCalls: any[] = [];
  const service = createService({
    runtimeConfig: {
      providerReadiness: {
        billing: {
          ready: true
        }
      },
      stripeBillingConfig: {
        apiKeyConfigured: true,
        planPriceIds: {
          FLEX: "",
          STARTER: "price_starter",
          GROWTH: "price_growth",
          ENTERPRISE: ""
        }
      }
    }
  });

  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      stripeSubscriptionId: "sub_stripe",
      stripeCustomerId: "cus_1"
    },
    subscription: {
      ...createResolvedState().subscription,
      stripeSubscriptionId: "sub_stripe"
    }
  });

  (service as any).resolveBillingState = async () => state;
  (service as any).clearManagedStripePlanChange = async () => ({
    id: "sub_stripe",
    items: {
      data: [
        {
          id: "si_1",
          current_period_start: 1_712_016_000,
          current_period_end: 1_714_608_000
        }
      ]
    },
    metadata: {}
  });
  (service as any).upsertSubscriptionFromStripe = async (input: any) => {
    upsertCalls.push(input);
  };
  (service as any).getStripeClient = () => ({
    subscriptions: {
      update: async (_subscriptionId: string, payload: any) => {
        stripeUpdateCalls.push(payload);
        return {
          id: "sub_stripe",
          status: "active",
          customer: "cus_1",
          items: {
            data: [
              {
                id: "si_1",
                current_period_start: 1_712_016_000,
                current_period_end: 1_714_608_000,
                price: {
                  id: "price_growth"
                }
              }
            ]
          },
          metadata: payload.metadata
        };
      }
    }
  });

  const result = await service.createPlanCheckoutSession({
    tenantId: "ten_1",
    requestedBy: "usr_1",
    planKey: "GROWTH"
  });

  assert.equal(result.flow, "subscription_updated");
  assert.equal(stripeUpdateCalls[0].proration_behavior, "always_invoice");
  assert.equal(stripeUpdateCalls[0].billing_cycle_anchor, "unchanged");
  assert.equal(stripeUpdateCalls[0].items[0].price, "price_growth");
  assert.equal(upsertCalls[0].stripeSubscription.id, "sub_stripe");
});

test("createPlanCheckoutSession schedules managed Stripe downgrades for period end", async () => {
  const updates: any[] = [];
  const scheduleCreateCalls: any[] = [];
  const scheduleUpdateCalls: any[] = [];
  const service = createService({
    prisma: {
      tenantBillingAccount: {
        update: async (args: any) => {
          updates.push(args);
          return {
            id: "acc_growth",
            ...args.data
          };
        }
      }
    },
    runtimeConfig: {
      providerReadiness: {
        billing: {
          ready: true
        }
      },
      stripeBillingConfig: {
        apiKeyConfigured: true,
        planPriceIds: {
          FLEX: "",
          STARTER: "price_starter",
          GROWTH: "price_growth",
          ENTERPRISE: ""
        }
      }
    }
  });

  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      id: "acc_growth",
      currentPlanKey: BillingPlanKey.GROWTH,
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      stripeSubscriptionId: "sub_stripe",
      stripeCustomerId: "cus_1"
    },
    subscription: {
      ...createResolvedState().subscription,
      planKey: BillingPlanKey.GROWTH,
      stripeSubscriptionId: "sub_stripe"
    }
  });

  (service as any).resolveBillingState = async () => state;
  (service as any).clearManagedStripePlanChange = async () => ({
    id: "sub_stripe",
    items: {
      data: [
        {
          current_period_start: 1_712_016_000,
          current_period_end: 1_714_608_000,
          price: {
            id: "price_growth"
          },
          quantity: 1
        }
      ]
    }
  });
  (service as any).getStripeClient = () => ({
    subscriptionSchedules: {
      create: async (payload: any) => {
        scheduleCreateCalls.push(payload);
        return { id: "sub_sched_1" };
      },
      update: async (_scheduleId: string, payload: any) => {
        scheduleUpdateCalls.push(payload);
        return {};
      }
    }
  });

  const result = await service.createPlanCheckoutSession({
    tenantId: "ten_1",
    requestedBy: "usr_1",
    planKey: "STARTER"
  });

  assert.equal(result.flow, "scheduled");
  assert.equal(scheduleCreateCalls[0].from_subscription, "sub_stripe");
  assert.equal(scheduleUpdateCalls[0].phases[1].items[0].price, "price_starter");
  assert.equal(updates[0].data.pendingPlanKey, BillingPlanKey.STARTER);
  assert.equal(updates[0].data.pendingChangeMetadataJson.scheduleId, "sub_sched_1");
});

test("createPlanCheckoutSession schedules managed Flex transitions by canceling at period end", async () => {
  const updates: any[] = [];
  const stripeUpdateCalls: any[] = [];
  const service = createService({
    prisma: {
      tenantBillingAccount: {
        update: async (args: any) => {
          updates.push(args);
          return {
            id: "acc_starter",
            ...args.data
          };
        }
      }
    },
    runtimeConfig: {
      providerReadiness: {
        billing: {
          ready: true
        }
      },
      stripeBillingConfig: {
        apiKeyConfigured: true,
        planPriceIds: {
          FLEX: "",
          STARTER: "price_starter",
          GROWTH: "price_growth",
          ENTERPRISE: ""
        }
      }
    }
  });

  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      id: "acc_starter",
      currentPlanKey: BillingPlanKey.STARTER,
      stripeSubscriptionId: "sub_stripe",
      stripeCustomerId: "cus_1"
    },
    subscription: {
      ...createResolvedState().subscription,
      stripeSubscriptionId: "sub_stripe"
    }
  });

  (service as any).resolveBillingState = async () => state;
  (service as any).clearManagedStripePlanChange = async () => ({
    id: "sub_stripe",
    items: {
      data: [
        {
          current_period_start: 1_712_016_000,
          current_period_end: 1_714_608_000,
          price: {
            id: "price_starter"
          },
          quantity: 1
        }
      ]
    }
  });
  (service as any).getStripeClient = () => ({
    subscriptions: {
      update: async (_subscriptionId: string, payload: any) => {
        stripeUpdateCalls.push(payload);
        return {};
      }
    }
  });

  const result = await service.createPlanCheckoutSession({
    tenantId: "ten_1",
    requestedBy: "usr_1",
    planKey: "FLEX"
  });

  assert.equal(result.flow, "scheduled");
  assert.equal(stripeUpdateCalls[0].cancel_at_period_end, true);
  assert.equal(updates[0].data.pendingPlanKey, BillingPlanKey.FLEX);
  assert.equal(
    updates[0].data.pendingChangeMetadataJson.stripeMode,
    "cancel_at_period_end"
  );
});

test("getOverview surfaces scheduled cancellation state", async () => {
  const service = createService();
  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      stripeSubscriptionId: "sub_stripe",
      scheduledCancellation: {
        effectiveAt: new Date("2026-05-01T00:00:00.000Z"),
        requestedAt: new Date("2026-04-15T10:00:00.000Z"),
        requestedBy: "usr_1",
        canResume: true
      }
    }
  });

  (service as any).resolveBillingState = async () => state;

  const overview = await service.getOverview("ten_1");

  assert.equal(
    overview.account.scheduledCancellation?.effectiveAt,
    "2026-05-01T00:00:00.000Z"
  );
  assert.equal(
    overview.account.scheduledCancellation?.requestedAt,
    "2026-04-15T10:00:00.000Z"
  );
  assert.equal(overview.account.scheduledCancellation?.requestedBy, "usr_1");
  assert.equal(overview.account.scheduledCancellation?.canResume, true);
});

test("scheduleSubscriptionCancellation marks Stripe subscription to cancel at period end", async () => {
  const stripeUpdateCalls: any[] = [];
  const upsertCalls: any[] = [];
  const service = createService({
    runtimeConfig: {
      providerReadiness: {
        billing: {
          ready: true
        }
      }
    }
  });

  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      stripeSubscriptionId: "sub_stripe",
      stripeCustomerId: "cus_1"
    },
    subscription: {
      ...createResolvedState().subscription,
      stripeSubscriptionId: "sub_stripe"
    }
  });

  (service as any).resolveBillingState = async () => state;
  (service as any).upsertSubscriptionFromStripe = async (input: any) => {
    upsertCalls.push(input);
  };
  (service as any).getStripeClient = () => ({
    subscriptions: {
      retrieve: async () => ({
        id: "sub_stripe",
        metadata: {
          planKey: BillingPlanKey.STARTER
        }
      }),
      update: async (_subscriptionId: string, payload: any) => {
        stripeUpdateCalls.push(payload);
        return {
          id: "sub_stripe",
          status: "active",
          cancel_at_period_end: true,
          customer: "cus_1",
          items: {
            data: [
              {
                id: "si_1",
                current_period_start: 1_712_016_000,
                current_period_end: 1_714_608_000,
                price: {
                  id: "price_starter"
                }
              }
            ]
          },
          metadata: payload.metadata
        };
      }
    }
  });

  const result = await service.scheduleSubscriptionCancellation({
    tenantId: "ten_1",
    requestedBy: "usr_cancel"
  });

  assert.equal(result.flow, "scheduled_cancellation");
  assert.equal(stripeUpdateCalls[0].cancel_at_period_end, true);
  assert.equal(
    stripeUpdateCalls[0].metadata.scheduledCancellationRequestedBy,
    "usr_cancel"
  );
  assert.equal(upsertCalls[0].stripeSubscription.cancel_at_period_end, true);
});

test("resumeScheduledCancellation clears period-end cancellation", async () => {
  const stripeUpdateCalls: any[] = [];
  const upsertCalls: any[] = [];
  const service = createService({
    runtimeConfig: {
      providerReadiness: {
        billing: {
          ready: true
        }
      }
    }
  });

  const state = createResolvedState({
    account: {
      ...createResolvedState().account,
      stripeSubscriptionId: "sub_stripe",
      stripeCustomerId: "cus_1",
      scheduledCancellation: {
        effectiveAt: new Date("2026-05-01T00:00:00.000Z"),
        requestedAt: new Date("2026-04-15T10:00:00.000Z"),
        requestedBy: "usr_1",
        canResume: true
      }
    },
    subscription: {
      ...createResolvedState().subscription,
      stripeSubscriptionId: "sub_stripe"
    }
  });

  (service as any).resolveBillingState = async () => state;
  (service as any).upsertSubscriptionFromStripe = async (input: any) => {
    upsertCalls.push(input);
  };
  (service as any).getStripeClient = () => ({
    subscriptions: {
      update: async (_subscriptionId: string, payload: any) => {
        stripeUpdateCalls.push(payload);
        return {
          id: "sub_stripe",
          status: "active",
          cancel_at_period_end: false,
          customer: "cus_1",
          items: {
            data: [
              {
                id: "si_1",
                current_period_start: 1_712_016_000,
                current_period_end: 1_714_608_000,
                price: {
                  id: "price_starter"
                }
              }
            ]
          },
          metadata: {
            planKey: BillingPlanKey.STARTER
          }
        };
      }
    }
  });

  const result = await service.resumeScheduledCancellation({
    tenantId: "ten_1"
  });

  assert.equal(result.flow, "subscription_updated");
  assert.equal(stripeUpdateCalls[0].cancel_at_period_end, false);
  assert.equal(upsertCalls[0].stripeSubscription.cancel_at_period_end, false);
});

test("assertQuota respects stacked add-on balances above included limits", async () => {
  const service = createService();
  const state = createResolvedState({
    usage: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 5,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 0,
      [BillingQuotaKey.AI_INTERVIEWS]: 0
    },
    limits: {
      [BillingQuotaKey.SEATS]: 1,
      [BillingQuotaKey.ACTIVE_JOBS]: 6,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 100,
      [BillingQuotaKey.AI_INTERVIEWS]: 15
    },
    addOnTotals: {
      [BillingQuotaKey.SEATS]: 0,
      [BillingQuotaKey.ACTIVE_JOBS]: 4,
      [BillingQuotaKey.CANDIDATE_PROCESSING]: 0,
      [BillingQuotaKey.AI_INTERVIEWS]: 0
    }
  });

  (service as any).resolveBillingState = async () => state;

  await assert.doesNotReject(
    () => (service as any).assertQuota("ten_1", BillingQuotaKey.ACTIVE_JOBS, 1)
  );
  await assert.rejects(
    () => (service as any).assertQuota("ten_1", BillingQuotaKey.ACTIVE_JOBS, 2),
    /ilan kredisi limiti doldu/
  );
});

test("consumeAddOnGrantBalance drains stacked grants in chronological order", async () => {
  const grantUpdates: Array<{ id: string; increment: number }> = [];
  const service = createService();

  await (service as any).consumeAddOnGrantBalance({
    db: {
      billingQuotaGrant: {
        findMany: async () => [
          {
            id: "grant_1",
            tenantId: "ten_1",
            accountId: "acc_1",
            quotaKey: BillingQuotaKey.ACTIVE_JOBS,
            quantity: 1,
            consumedQuantity: 0,
            source: "ADDON",
            expiresAt: new Date("2026-04-20T00:00:00.000Z"),
            createdAt: new Date("2026-04-10T00:00:00.000Z")
          },
          {
            id: "grant_2",
            tenantId: "ten_1",
            accountId: "acc_1",
            quotaKey: BillingQuotaKey.ACTIVE_JOBS,
            quantity: 3,
            consumedQuantity: 0,
            source: "ADDON",
            expiresAt: new Date("2026-04-25T00:00:00.000Z"),
            createdAt: new Date("2026-04-11T00:00:00.000Z")
          }
        ],
        update: async (args: any) => {
          grantUpdates.push({
            id: args.where.id,
            increment: args.data.consumedQuantity.increment
          });
          return {};
        }
      }
    },
    tenantId: "ten_1",
    accountId: "acc_1",
    quotaKey: BillingQuotaKey.ACTIVE_JOBS,
    quantity: 4
  });

  assert.deepEqual(grantUpdates, [
    { id: "grant_1", increment: 1 },
    { id: "grant_2", increment: 3 }
  ]);
});

test("reconcileOpenCheckoutSessions completes locally open Stripe checkouts", async () => {
  const completedSessions: any[] = [];
  const service = createService({
    prisma: {
      billingCheckoutSession: {
        findMany: async () => [
          {
            stripeCheckoutSessionId: "cs_open_1"
          }
        ]
      }
    },
    runtimeConfig: {
      providerReadiness: {
        billing: {
          ready: true
        }
      }
    }
  });

  (service as any).handleCheckoutSessionCompleted = async (session: any) => {
    completedSessions.push(session);
  };
  (service as any).getStripeClient = () => ({
    checkout: {
      sessions: {
        retrieve: async () => ({
          id: "cs_open_1",
          status: "complete"
        })
      }
    }
  });

  const reconciled = await (service as any).reconcileOpenCheckoutSessions("ten_1");

  assert.equal(reconciled, true);
  assert.equal(completedSessions[0].id, "cs_open_1");
});
