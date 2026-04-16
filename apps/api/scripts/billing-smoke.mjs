import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const envPath = path.resolve(process.cwd(), "../../.env");
const rootEnv = fs.readFileSync(envPath, "utf8");

function envValue(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rootEnv.match(new RegExp(`^${escaped}="([^"]*)"`, "m"));
  return match ? match[1] : "";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(name, data) {
  process.stdout.write(`\n### ${name}\n`);
  if (data !== undefined) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  }
}

const stripeSecretKey = envValue("STRIPE_SECRET_KEY");
const stripeWebhookSecret = envValue("STRIPE_WEBHOOK_SECRET");
const starterPriceId = envValue("STRIPE_PRICE_STARTER_MONTHLY");
const growthPriceId = envValue("STRIPE_PRICE_GROWTH_MONTHLY");
const apiBaseUrl =
  process.env.BILLING_SMOKE_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:4000/v1";

assert(stripeSecretKey, "STRIPE_SECRET_KEY missing in root .env");
assert(stripeWebhookSecret, "STRIPE_WEBHOOK_SECRET missing in root .env");
assert(starterPriceId, "STRIPE_PRICE_STARTER_MONTHLY missing in root .env");
assert(growthPriceId, "STRIPE_PRICE_GROWTH_MONTHLY missing in root .env");

const stripe = new Stripe(stripeSecretKey);

async function api(pathname, input = {}) {
  const { method = "GET", body, token, tenantId } = input;
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`${method} ${pathname} -> ${response.status}: ${text}`);
  }

  return payload;
}

async function sendWebhook(event) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: stripeWebhookSecret
  });
  const response = await fetch(`${apiBaseUrl}/billing/webhooks/stripe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature
    },
    body: payload
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`webhook ${event.type} -> ${response.status}: ${text}`);
  }

  return text;
}

async function signup(email, fullName) {
  return api("/auth/signup", {
    method: "POST",
    body: {
      companyName: `${fullName} ${Date.now()}`,
      fullName,
      email,
      password: "Launch123!"
    }
  });
}

async function login(email) {
  return api("/auth/login", {
    method: "POST",
    body: {
      email,
      password: "Launch123!"
    }
  });
}

async function authenticateInternalAdmin() {
  try {
    return await signup("info@candit.ai", "Candit Super Admin");
  } catch (error) {
    try {
      return await login("info@candit.ai");
    } catch {
      throw error;
    }
  }
}

function findQuota(overview, quotaKey) {
  const quota = overview.usage.quotas.find((item) => item.key === quotaKey);
  assert(quota, `Quota ${quotaKey} missing from overview`);
  return quota;
}

async function expectApiError(pathname, input, pattern) {
  try {
    await api(pathname, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `Unexpected error for ${pathname}: ${message}`);
    return message;
  }

  throw new Error(`Expected ${pathname} to fail`);
}

async function createPublishedJob({ token, tenantId, index }) {
  return api("/jobs", {
    method: "POST",
    token,
    tenantId,
    body: {
      title: `Billing Smoke Job ${index}`,
      roleFamily: "Operations",
      status: "PUBLISHED",
      locationText: "Remote",
      requirements: [
        {
          key: "communication",
          value: "Strong communication",
          required: true
        }
      ]
    }
  });
}

async function createCandidate({ token, tenantId, email, fullName }) {
  return api("/candidates", {
    method: "POST",
    token,
    tenantId,
    body: {
      fullName,
      email,
      source: "billing_smoke"
    }
  });
}

async function createApplication({ token, tenantId, candidateId, jobId }) {
  return api("/applications", {
    method: "POST",
    token,
    tenantId,
    body: {
      candidateId,
      jobId
    }
  });
}

async function scheduleVoiceInterview({ token, tenantId, applicationId, scheduledAt }) {
  return api("/interviews/sessions", {
    method: "POST",
    token,
    tenantId,
    body: {
      applicationId,
      mode: "VOICE",
      scheduledAt
    }
  });
}

async function getBillingAccount(tenantId) {
  return prisma.tenantBillingAccount.findUniqueOrThrow({
    where: { tenantId }
  });
}

async function ensureDefaultPaymentMethod(customerId) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card"
  });
  const existing = paymentMethods.data[0];
  const paymentMethodId =
    existing?.id ??
    (await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId })).id;

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  });

  return paymentMethodId;
}

async function createSubscriptionForCheckoutSession(session, priceId) {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  assert(customerId, "Checkout session customer missing");

  const paymentMethodId = await ensureDefaultPaymentMethod(customerId);
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: {
      ...session.metadata,
      billingEmail:
        session.customer_details?.email ??
        session.customer_email ??
        session.metadata?.billingEmail ??
        ""
    },
    default_payment_method: paymentMethodId,
    payment_behavior: "error_if_incomplete",
    expand: ["latest_invoice.payment_intent"]
  });
}

async function completePlanCheckout({ sessionId, email, eventId, priceId }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const subscription = await createSubscriptionForCheckoutSession(session, priceId);

  await sendWebhook({
    id: eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        ...session,
        subscription: subscription.id,
        customer_details: {
          ...(session.customer_details || {}),
          email
        }
      }
    }
  });

  return subscription;
}

async function completeAddOnCheckout({ sessionId, email, eventId }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  await sendWebhook({
    id: eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        ...session,
        customer_details: {
          ...(session.customer_details || {}),
          email
        }
      }
    }
  });
}

async function main() {
  const stamp = Date.now();
  const smokeEmail = `billing-smoke-${stamp}@example.com`;

  const auth = await signup(smokeEmail, "Billing Smoke");
  const token = auth.accessToken;
  const tenantId = auth.user.tenantId;
  logStep("tenant.created", { tenantId, email: smokeEmail, apiBaseUrl });

  const flexActivation = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "FLEX",
      billingEmail: smokeEmail
    }
  });
  logStep("flex.activated", flexActivation);
  assert(flexActivation.flow === "local_activation", "Flex should activate locally");

  let overview = await api("/billing/overview", { token, tenantId });
  let account = await getBillingAccount(tenantId);
  logStep("flex.state", {
    currentPlanKey: overview.account.currentPlanKey,
    status: overview.account.status,
    quotas: overview.usage.quotas
  });
  assert(overview.account.currentPlanKey === "FLEX", "Flex should be active");
  assert(overview.account.status === "ACTIVE", "Flex should stay active");
  assert(findQuota(overview, "ACTIVE_JOBS").included === 0, "Flex should include 0 active jobs");
  assert(
    findQuota(overview, "CANDIDATE_PROCESSING").included === 0,
    "Flex should include 0 candidate processing"
  );
  assert(
    findQuota(overview, "AI_INTERVIEWS").included === 0,
    "Flex should include 0 AI interviews"
  );

  const jobLimitMessageBeforeAddOns = await expectApiError(
    "/jobs",
    {
      method: "POST",
      token,
      tenantId,
      body: {
        title: "Billing Smoke Blocked Job",
        roleFamily: "Operations",
        status: "PUBLISHED",
        locationText: "Remote",
        requirements: [
          {
            key: "communication",
            value: "Strong communication",
            required: true
          }
        ]
      }
    },
    /ilan kredisi limiti doldu/i
  );
  logStep("flex.job.limit.blocked", { message: jobLimitMessageBeforeAddOns });

  for (const addOnKey of ["JOB_CREDIT_PACK_1", "JOB_CREDIT_PACK_3"]) {
    const addOnCheckout = await api("/billing/checkout/addon", {
      method: "POST",
      token,
      tenantId,
      body: {
        addOnKey,
        billingEmail: smokeEmail
      }
    });

    await completeAddOnCheckout({
      sessionId: addOnCheckout.sessionId,
      email: smokeEmail,
      eventId: `evt_smoke_${stamp}_${addOnKey.toLowerCase()}`
    });
  }

  overview = await api("/billing/overview", { token, tenantId });
  const stackedJobsQuota = findQuota(overview, "ACTIVE_JOBS");
  logStep("flex.job.addons.stacked", { activeJobs: stackedJobsQuota });
  assert(stackedJobsQuota.addOn === 4, "1 + 3 job packs should stack to 4 credits");
  assert(stackedJobsQuota.limit === 4, "Flex job limit should match stacked add-ons");

  const publishedJobs = [];
  for (let index = 1; index <= 4; index += 1) {
    const job = await createPublishedJob({ token, tenantId, index });
    publishedJobs.push(job);
  }
  const jobLimitMessageAfterUsage = await expectApiError(
    "/jobs",
    {
      method: "POST",
      token,
      tenantId,
      body: {
        title: "Billing Smoke Job 5",
        roleFamily: "Operations",
        status: "PUBLISHED",
        locationText: "Remote",
        requirements: [
          {
            key: "communication",
            value: "Strong communication",
            required: true
          }
        ]
      }
    },
    /ilan kredisi limiti doldu/i
  );
  overview = await api("/billing/overview", { token, tenantId });
  logStep("flex.job.limit.after-usage", {
    activeJobs: findQuota(overview, "ACTIVE_JOBS"),
    blockedMessage: jobLimitMessageAfterUsage
  });

  const candidateResult = await createCandidate({
    token,
    tenantId,
    email: `candidate-${stamp}@example.com`,
    fullName: "Billing Smoke Candidate"
  });
  const candidateId = candidateResult.candidate.id;
  const blockedApplicationMessage = await expectApiError(
    "/applications",
    {
      method: "POST",
      token,
      tenantId,
      body: {
        candidateId,
        jobId: publishedJobs[0].id
      }
    },
    /aday değerlendirme kredisi doldu/i
  );
  logStep("flex.candidate-processing.limit.blocked", {
    message: blockedApplicationMessage
  });

  for (const addOnKey of [
    "CANDIDATE_PROCESSING_PACK_50",
    "CANDIDATE_PROCESSING_PACK_100",
    "INTERVIEW_PACK_10",
    "INTERVIEW_PACK_25"
  ]) {
    const addOnCheckout = await api("/billing/checkout/addon", {
      method: "POST",
      token,
      tenantId,
      body: {
        addOnKey,
        billingEmail: smokeEmail
      }
    });

    await completeAddOnCheckout({
      sessionId: addOnCheckout.sessionId,
      email: smokeEmail,
      eventId: `evt_smoke_${stamp}_${addOnKey.toLowerCase()}`
    });
  }

  overview = await api("/billing/overview", { token, tenantId });
  logStep("flex.non-job.addons.stacked", {
    candidateProcessing: findQuota(overview, "CANDIDATE_PROCESSING"),
    aiInterviews: findQuota(overview, "AI_INTERVIEWS")
  });
  assert(
    findQuota(overview, "CANDIDATE_PROCESSING").addOn === 150,
    "50 + 100 candidate packs should stack to 150 credits"
  );
  assert(
    findQuota(overview, "AI_INTERVIEWS").addOn === 35,
    "10 + 25 interview packs should stack to 35 credits"
  );

  const application = await createApplication({
    token,
    tenantId,
    candidateId,
    jobId: publishedJobs[0].id
  });
  overview = await api("/billing/overview", { token, tenantId });
  logStep("flex.candidate-processing.after-usage", {
    applicationId: application.id,
    candidateProcessing: findQuota(overview, "CANDIDATE_PROCESSING")
  });
  assert(
    findQuota(overview, "CANDIDATE_PROCESSING").used === 1,
    "Candidate processing usage should increment after application creation"
  );

  const voiceInterview = await scheduleVoiceInterview({
    token,
    tenantId,
    applicationId: application.id,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  overview = await api("/billing/overview", { token, tenantId });
  logStep("flex.ai-interview.after-usage", {
    interviewSessionId: voiceInterview.id,
    aiInterviews: findQuota(overview, "AI_INTERVIEWS")
  });
  assert(
    findQuota(overview, "AI_INTERVIEWS").used === 1,
    "AI interview usage should increment after scheduling a voice session"
  );

  const starterCheckout = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "STARTER",
      billingEmail: smokeEmail
    }
  });
  logStep("starter.checkout.created", starterCheckout);
  assert(starterCheckout.flow === "stripe_checkout", "Starter checkout should open Stripe");

  await completePlanCheckout({
    sessionId: starterCheckout.sessionId,
    email: smokeEmail,
    eventId: `evt_smoke_${stamp}_starter_checkout`,
    priceId: starterPriceId
  });

  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  logStep("starter.activated", {
    currentPlanKey: overview.account.currentPlanKey,
    status: overview.account.status,
    stripeSubscriptionId: account.stripeSubscriptionId
  });
  assert(overview.account.currentPlanKey === "STARTER", "Starter should activate");
  assert(overview.account.status === "ACTIVE", "Starter should be active");
  assert(account.stripeSubscriptionId, "Stripe subscription id should be stored after activation");

  const growthUpgrade = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "GROWTH",
      billingEmail: smokeEmail
    }
  });
  logStep("growth.upgrade", growthUpgrade);
  assert(growthUpgrade.flow === "subscription_updated", "Growth upgrade should be immediate");

  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  const upgradedSubscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
  const latestInvoiceId =
    typeof upgradedSubscription.latest_invoice === "string"
      ? upgradedSubscription.latest_invoice
      : upgradedSubscription.latest_invoice?.id;
  let prorationSummary = null;
  if (latestInvoiceId) {
    const invoice = await stripe.invoices.retrieve(latestInvoiceId, {
      expand: ["lines.data.price"]
    });
    prorationSummary = {
      invoiceId: invoice.id,
      status: invoice.status,
      total: invoice.total,
      hasProrationLine: invoice.lines.data.some((line) => line.proration === true)
    };
  }

  logStep("growth.activated", {
    currentPlanKey: overview.account.currentPlanKey,
    status: overview.account.status,
    stripePriceId: upgradedSubscription.items.data[0]?.price?.id,
    cancelAtPeriodEnd: upgradedSubscription.cancel_at_period_end,
    prorationSummary
  });
  assert(overview.account.currentPlanKey === "GROWTH", "Growth should be active");
  assert(
    upgradedSubscription.items.data[0]?.price?.id === growthPriceId,
    "Stripe subscription should switch to growth price"
  );

  const addOnCheckout = await api("/billing/checkout/addon", {
    method: "POST",
    token,
    tenantId,
    body: {
      addOnKey: "JOB_CREDIT_PACK_1",
      billingEmail: smokeEmail
    }
  });

  await completeAddOnCheckout({
    sessionId: addOnCheckout.sessionId,
    email: smokeEmail,
    eventId: `evt_smoke_${stamp}_addon_checkout`
  });

  overview = await api("/billing/overview", { token, tenantId });
  const jobsQuota = overview.usage.quotas.find((quota) => quota.key === "ACTIVE_JOBS");
  logStep("addon.granted", { activeJobs: jobsQuota });
  assert((jobsQuota?.addOn || 0) >= 1, "Job add-on should increase balance");

  const starterDowngrade = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "STARTER",
      billingEmail: smokeEmail
    }
  });
  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  let subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
  logStep("starter.downgrade.scheduled", {
    response: starterDowngrade,
    pendingChange: overview.account.pendingChange,
    stripeSchedule: subscription.schedule
  });
  assert(starterDowngrade.flow === "scheduled", "Starter downgrade should be scheduled");
  assert(
    overview.account.pendingChange?.planKey === "STARTER",
    "Pending downgrade should target STARTER"
  );
  assert(Boolean(subscription.schedule), "Stripe schedule should exist for downgrade");

  const clearDowngrade = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "GROWTH",
      billingEmail: smokeEmail
    }
  });
  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
  logStep("starter.downgrade.cleared", {
    response: clearDowngrade,
    pendingChange: overview.account.pendingChange,
    stripeSchedule: subscription.schedule,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });
  assert(
    clearDowngrade.flow === "subscription_updated",
    "Re-selecting current plan should clear pending change"
  );
  assert(overview.account.pendingChange === null, "Pending change should be cleared");
  assert(!subscription.schedule, "Stripe schedule should be released");

  const flexTransition = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "FLEX",
      billingEmail: smokeEmail
    }
  });
  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
  logStep("flex.transition.scheduled", {
    response: flexTransition,
    pendingChange: overview.account.pendingChange,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });
  assert(flexTransition.flow === "scheduled", "Flex transition should be scheduled");
  assert(overview.account.pendingChange?.planKey === "FLEX", "Pending change should target FLEX");
  assert(
    subscription.cancel_at_period_end === true,
    "Stripe subscription should cancel at period end for FLEX"
  );

  await prisma.tenantBillingAccount.update({
    where: { tenantId },
    data: {
      pendingChangeEffectiveAt: new Date(Date.now() - 1_000)
    }
  });
  const canceledSubscription = await stripe.subscriptions.cancel(subscription.id);
  await sendWebhook({
    id: `evt_smoke_${stamp}_subscription_deleted`,
    object: "event",
    type: "customer.subscription.deleted",
    data: {
      object: canceledSubscription
    }
  });

  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  logStep("flex.transition.applied", {
    currentPlanKey: overview.account.currentPlanKey,
    status: overview.account.status,
    pendingChange: overview.account.pendingChange,
    stripeSubscriptionId: account.stripeSubscriptionId
  });
  assert(overview.account.currentPlanKey === "FLEX", "Account should fall back to FLEX");
  assert(overview.account.status === "ACTIVE", "Flex fallback should be active");
  assert(account.stripeSubscriptionId === null, "Flex fallback should clear Stripe subscription");

  const starterReturn = await api("/billing/checkout/plan", {
    method: "POST",
    token,
    tenantId,
    body: {
      planKey: "STARTER",
      billingEmail: smokeEmail
    }
  });
  await completePlanCheckout({
    sessionId: starterReturn.sessionId,
    email: smokeEmail,
    eventId: `evt_smoke_${stamp}_starter_return`,
    priceId: starterPriceId
  });

  overview = await api("/billing/overview", { token, tenantId });
  account = await getBillingAccount(tenantId);
  logStep("starter.returned", {
    currentPlanKey: overview.account.currentPlanKey,
    status: overview.account.status,
    stripeSubscriptionId: account.stripeSubscriptionId
  });
  assert(overview.account.currentPlanKey === "STARTER", "Starter should reactivate from FLEX");

  const scheduledCancellation = await api("/billing/subscription/cancel", {
    method: "POST",
    token,
    tenantId,
    body: {}
  });
  const overviewAfterCancel = await api("/billing/overview", { token, tenantId });

  const resumedCancellation = await api("/billing/subscription/resume", {
    method: "POST",
    token,
    tenantId,
    body: {}
  });
  const overviewAfterResume = await api("/billing/overview", { token, tenantId });

  logStep("cancel.resume.behavior", {
    scheduleResponse: scheduledCancellation,
    afterCancelSchedule: {
      currentPlanKey: overviewAfterCancel.account.currentPlanKey,
      status: overviewAfterCancel.account.status,
      pendingChange: overviewAfterCancel.account.pendingChange,
      scheduledCancellation: overviewAfterCancel.account.scheduledCancellation
    },
    resumeResponse: resumedCancellation,
    afterCancelRevert: {
      currentPlanKey: overviewAfterResume.account.currentPlanKey,
      status: overviewAfterResume.account.status,
      pendingChange: overviewAfterResume.account.pendingChange,
      scheduledCancellation: overviewAfterResume.account.scheduledCancellation
    }
  });
  assert(
    overviewAfterCancel.account.scheduledCancellation,
    "Scheduled cancellation state should be visible in billing overview"
  );
  assert(
    overviewAfterResume.account.scheduledCancellation === null,
    "Resuming cancellation should clear the scheduled cancellation state"
  );

  const internalAuth = await authenticateInternalAdmin();
  const enterpriseQuote = await api("/billing/checkout/enterprise", {
    method: "POST",
    token: internalAuth.accessToken,
    tenantId: internalAuth.user.tenantId,
    body: {
      billingEmail: "info@candit.ai",
      monthlyAmountCents: 499_900,
      seatsIncluded: 10,
      activeJobsIncluded: 25,
      candidateProcessingIncluded: 500,
      aiInterviewsIncluded: 100,
      advancedReporting: true,
      calendarIntegrations: false,
      brandedCandidateExperience: false,
      customIntegrations: true,
      note: "billing smoke enterprise quote"
    }
  });

  logStep("enterprise.quote.checkout.created", enterpriseQuote);
  assert(enterpriseQuote.sessionId, "Enterprise quote flow should return a checkout session");
  assert(enterpriseQuote.checkoutUrl, "Enterprise quote flow should return a checkout URL");

  process.stdout.write("\nSMOKE_RESULT=PASS\n");
}

main()
  .catch((error) => {
    process.stderr.write(`\nSMOKE_RESULT=FAIL\n${error.stack ?? error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
