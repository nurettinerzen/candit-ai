#!/usr/bin/env node

import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AuditActorType,
  BillingAccountStatus,
  BillingGrantSource,
  BillingPlanKey,
  BillingQuotaKey,
  PrismaClient,
  Role,
  UserStatus
} from "@prisma/client";
import { BILLING_PLAN_CATALOG, buildPlanSnapshot } from "../apps/api/src/modules/billing/billing-catalog";
import {
  DEFAULT_PILOT_WORKSPACE_NAME,
  ensurePilotWorkspaceAndAiDefaults
} from "../apps/api/src/modules/internal-admin/pilot-provisioning-defaults";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "..");
const ARTIFACT_DIR = path.join(WORKSPACE_ROOT, "artifacts", "pilot");
const DEFAULT_WEB_BASE_URL = (process.env.PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);

type ParsedArgs = Record<string, string | boolean>;

function parseArgs(argv: string[]) {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!current.startsWith("--")) {
      continue;
    }

    const token = current.slice(2);
    const [key, inlineValue] = token.split("=", 2);

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function usage() {
  return [
    "Usage:",
    "  corepack pnpm pilot:provision --company-name \"Acme Lojistik\" --owner-name \"Ayse Yilmaz\" --owner-email owner@acme.com",
    "",
    "Common options:",
    "  --billing-email billing@company.com",
    "  --plan ENTERPRISE|GROWTH|STARTER|FLEX",
    "  --seats 3 --active-jobs 10 --candidate-processing 500 --ai-interviews 100",
    "  --grant-seats 2 --grant-active-jobs 5 --grant-candidate-processing 200 --grant-ai-interviews 50",
    "  --tenant-id ten_acme",
    "  --website https://company.com",
    "  --locale tr-TR --timezone Europe/Istanbul",
    "  --reset-owner",
    "  --dry-run",
    "",
    "Behavior:",
    `  - Creates or updates the tenant, owner, billing snapshot, default workspace (${DEFAULT_PILOT_WORKSPACE_NAME}),`,
    "    and AI prompt/rubric defaults.",
    "  - For new owners it issues an activation link automatically.",
    "  - For existing owners it keeps current access unless --reset-owner is passed.",
    "  - Writes a JSON and Markdown handoff artifact under artifacts/pilot/."
  ].join("\n");
}

function readString(args: ParsedArgs, key: string, fallback = "") {
  const value = args[key];
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function readOptionalString(args: ParsedArgs, key: string) {
  const value = readString(args, key);
  return value.length > 0 ? value : null;
}

function readBoolean(args: ParsedArgs, key: string, fallback = false) {
  const value = args[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readInteger(args: ParsedArgs, key: string, fallback: number) {
  const raw = readString(args, key);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function readOptionalInteger(args: ParsedArgs, key: string) {
  const raw = readString(args, key);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveOrZero(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
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

function startOfCurrentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function buildStamp() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0")
  ].join("");
}

async function resolveTenantId(prisma: PrismaClient, explicitTenantId: string | null, companyName: string) {
  if (explicitTenantId) {
    return explicitTenantId;
  }

  const base = normalizeSlugPart(companyName) || "pilot";
  const direct = `ten_${base}`;
  const existing = await prisma.tenant.findUnique({
    where: {
      id: direct
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    return direct;
  }

  let suffix = 2;
  while (suffix < 10_000) {
    const candidate = `${direct}_${suffix}`;
    const collision = await prisma.tenant.findUnique({
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

  throw new Error("Benzersiz tenant ID uretilemedi.");
}

async function resolveActorUser(prisma: PrismaClient, actorEmail: string) {
  return prisma.user.findFirst({
    where: {
      email: actorEmail.toLowerCase(),
      deletedAt: null
    },
    select: {
      id: true,
      email: true,
      fullName: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

async function hasTenantWebsiteUrlColumn(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND LOWER(table_name) = LOWER('Tenant')
        AND LOWER(column_name) = LOWER('websiteUrl')
    ) AS "exists"
  `;

  return rows[0]?.exists === true;
}

async function writeArtifacts(tenantId: string, stamp: string, payload: Record<string, unknown>) {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const jsonPath = path.join(ARTIFACT_DIR, `pilot-provision-${tenantId}-${stamp}.json`);
  const markdownPath = path.join(ARTIFACT_DIR, `pilot-provision-${tenantId}-${stamp}.md`);
  const activationUrl =
    typeof payload.activationUrl === "string" ? payload.activationUrl : "not-generated";
  const quotas = payload.quotas as Record<string, unknown>;
  const owner = payload.owner as Record<string, unknown>;

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(
    markdownPath,
    [
      `# Pilot Handoff - ${tenantId}`,
      "",
      `- Tenant ID: ${tenantId}`,
      `- Company: ${String(payload.companyName ?? "")}`,
      `- Plan: ${String(payload.planKey ?? "")}`,
      `- Owner: ${String(owner?.fullName ?? "")} <${String(owner?.email ?? "")}>`,
      `- Billing: ${String(payload.billingEmail ?? "")}`,
      `- Workspace: ${String(payload.workspaceName ?? "")}`,
      `- Activation URL: ${activationUrl}`,
      "",
      "## Quotas",
      `- Seats: ${String(quotas?.seatsIncluded ?? "")}`,
      `- Active jobs: ${String(quotas?.activeJobsIncluded ?? "")}`,
      `- Candidate processing: ${String(quotas?.candidateProcessingIncluded ?? "")}`,
      `- AI interviews: ${String(quotas?.aiInterviewsIncluded ?? "")}`,
      "",
      "## Next steps",
      "- Owner activation URL'yi paylas.",
      "- Ilk recruiter login sonrasi tenant profilini ve ilk job'u kontrol et.",
      "- Invite, screening, report ve recommendation akislarini staging smoke ile dogrula."
    ].join("\n"),
    "utf8"
  );

  return {
    jsonPath,
    markdownPath
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (readBoolean(args, "help") || readBoolean(args, "h")) {
    console.log(usage());
    return;
  }

  const companyName = readString(args, "company-name");
  const ownerFullName = readString(args, "owner-name");
  const ownerEmail = readString(args, "owner-email").toLowerCase();

  if (!companyName || !ownerFullName || !ownerEmail) {
    console.error(usage());
    throw new Error("--company-name, --owner-name ve --owner-email zorunludur.");
  }

  const planKeyRaw = (readString(args, "plan", BillingPlanKey.ENTERPRISE) ||
    BillingPlanKey.ENTERPRISE) as BillingPlanKey;
  if (!(planKeyRaw in BILLING_PLAN_CATALOG)) {
    throw new Error(`Gecersiz plan anahtari: ${planKeyRaw}`);
  }

  const planKey = planKeyRaw;
  const planDefinition = BILLING_PLAN_CATALOG[planKey];
  const planSnapshot = buildPlanSnapshot(planDefinition);
  const billingEmail = readString(args, "billing-email", ownerEmail).toLowerCase();
  const actorEmail = readString(args, "actor-email", "info@candit.ai").toLowerCase();
  const websiteUrl = readOptionalString(args, "website");
  const locale = readString(args, "locale", "tr-TR");
  const timezone = readString(args, "timezone", "Europe/Istanbul");
  const monthlyAmountCents = readOptionalInteger(args, "monthly-amount-cents");
  const dryRun = readBoolean(args, "dry-run");
  const forceOwnerReset = readBoolean(args, "reset-owner");
  const currency = readString(args, "currency", "try");
  const invitationTtlHours = positiveOrZero(
    readInteger(args, "invitation-ttl-hours", Number(process.env.AUTH_INVITATION_TTL_HOURS ?? "72"))
  );

  const seatsIncluded = positiveOrZero(
    readInteger(args, "seats", Math.max(planSnapshot.seatsIncluded, 3))
  );
  const activeJobsIncluded = positiveOrZero(
    readInteger(args, "active-jobs", Math.max(planSnapshot.activeJobsIncluded, 10))
  );
  const candidateProcessingIncluded = positiveOrZero(
    readInteger(
      args,
      "candidate-processing",
      Math.max(planSnapshot.candidateProcessingIncluded, 500)
    )
  );
  const aiInterviewsIncluded = positiveOrZero(
    readInteger(args, "ai-interviews", Math.max(planSnapshot.aiInterviewsIncluded, 100))
  );

  const features = {
    advancedReporting: readBoolean(
      args,
      "advanced-reporting",
      planSnapshot.features.advancedReporting
    ),
    calendarIntegrations: readBoolean(
      args,
      "calendar-integrations",
      planSnapshot.features.calendarIntegrations
    ),
    brandedCandidateExperience: readBoolean(
      args,
      "branded-candidate-experience",
      planSnapshot.features.brandedCandidateExperience
    ),
    customIntegrations: readBoolean(
      args,
      "custom-integrations",
      planSnapshot.features.customIntegrations
    )
  };

  const grants = {
    seats: positiveOrZero(readInteger(args, "grant-seats", 0)),
    activeJobs: positiveOrZero(readInteger(args, "grant-active-jobs", 0)),
    candidateProcessing: positiveOrZero(readInteger(args, "grant-candidate-processing", 0)),
    aiInterviews: positiveOrZero(readInteger(args, "grant-ai-interviews", 0))
  };

  const prisma = new PrismaClient();
  const stamp = buildStamp();

  try {
    const tenantId = await resolveTenantId(prisma, readOptionalString(args, "tenant-id"), companyName);
    const actorUser = await resolveActorUser(prisma, actorEmail);
    const existingOwner = await prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ role: Role.OWNER }, { email: ownerEmail }]
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        lastLoginAt: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const shouldIssueActivationLink = !existingOwner || forceOwnerReset || !existingOwner.passwordHash;
    if (shouldIssueActivationLink && !actorUser) {
      throw new Error(
        `Activation link icin inviter kullanicisi bulunamadi. --actor-email ile gecerli bir ic ekip hesabi verin.`
      );
    }

    const summary = {
      mode: dryRun ? "dry-run" : "apply",
      tenantId,
      companyName,
      owner: {
        fullName: ownerFullName,
        email: ownerEmail,
        resetRequested: shouldIssueActivationLink
      },
      billingEmail,
      workspaceName: DEFAULT_PILOT_WORKSPACE_NAME,
      locale,
      timezone,
      websiteUrl,
      planKey,
      monthlyAmountCents,
      currency,
      quotas: {
        seatsIncluded,
        activeJobsIncluded,
        candidateProcessingIncluded,
        aiInterviewsIncluded
      },
      manualGrants: grants,
      features
    };

    if (dryRun) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const tenantHasWebsiteUrl = await hasTenantWebsiteUrlColumn(prisma);
    const now = new Date();
    const periodStart = startOfCurrentMonth(now);
    const periodEnd = startOfNextMonth(now);
    let activationUrl: string | null = null;

    const result = await prisma.$transaction(async (tx) => {
      if (tenantHasWebsiteUrl) {
        await tx.$executeRaw`
          INSERT INTO "Tenant" ("id", "name", "websiteUrl", "locale", "timezone", "status", "updatedAt")
          VALUES (${tenantId}, ${companyName}, ${websiteUrl}, ${locale}, ${timezone}, 'ACTIVE', ${now})
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "websiteUrl" = EXCLUDED."websiteUrl",
            "locale" = EXCLUDED."locale",
            "timezone" = EXCLUDED."timezone",
            "status" = EXCLUDED."status",
            "updatedAt" = EXCLUDED."updatedAt"
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO "Tenant" ("id", "name", "locale", "timezone", "status", "updatedAt")
          VALUES (${tenantId}, ${companyName}, ${locale}, ${timezone}, 'ACTIVE', ${now})
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "locale" = EXCLUDED."locale",
            "timezone" = EXCLUDED."timezone",
            "status" = EXCLUDED."status",
            "updatedAt" = EXCLUDED."updatedAt"
        `;
      }

      const tenant = {
        id: tenantId,
        name: companyName
      };

      await ensurePilotWorkspaceAndAiDefaults(tx, tenant.id);

      const ownerRecord = existingOwner
        ? await tx.user.update({
            where: {
              id: existingOwner.id
            },
            data: {
              email: ownerEmail,
              fullName: ownerFullName,
              role: Role.OWNER,
              status: shouldIssueActivationLink ? UserStatus.INVITED : UserStatus.ACTIVE
            }
          })
        : await tx.user.create({
            data: {
              tenantId: tenant.id,
              email: ownerEmail,
              fullName: ownerFullName,
              role: Role.OWNER,
              status: shouldIssueActivationLink ? UserStatus.INVITED : UserStatus.ACTIVE
            }
          });

      const accountSnapshot = {
        ...buildPlanSnapshot(planDefinition),
        seatsIncluded,
        activeJobsIncluded,
        candidateProcessingIncluded,
        aiInterviewsIncluded,
        monthlyAmountCents,
        pilotProvisioning: true
      };

      const account = await tx.tenantBillingAccount.upsert({
        where: {
          tenantId: tenant.id
        },
        update: {
          billingEmail,
          currentPlanKey: planKey,
          status: BillingAccountStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          pendingPlanKey: null,
          pendingChangeKind: null,
          pendingChangeEffectiveAt: null,
          pendingChangeRequestedAt: null,
          pendingChangeRequestedBy: null,
          pendingChangeMetadataJson: null,
          lastReconciledAt: now,
          currency,
          featuresJson: features,
          planSnapshotJson: accountSnapshot
        },
        create: {
          tenantId: tenant.id,
          billingEmail,
          currentPlanKey: planKey,
          status: BillingAccountStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          lastReconciledAt: now,
          currency,
          featuresJson: features,
          planSnapshotJson: accountSnapshot
        }
      });

      await tx.tenantBillingSubscription.updateMany({
        where: {
          tenantId: tenant.id,
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

      const subscription = await tx.tenantBillingSubscription.create({
        data: {
          tenantId: tenant.id,
          accountId: account.id,
          planKey,
          status: BillingAccountStatus.ACTIVE,
          billingEmail,
          periodStart,
          periodEnd,
          seatsIncluded,
          activeJobsIncluded,
          candidateProcessingIncluded,
          aiInterviewsIncluded,
          featuresJson: features,
          metadataJson: {
            pilotProvisioning: true,
            monthlyAmountCents
          },
          createdBy: actorUser?.id ?? null
        }
      });

      const manualGrantRows = [
        {
          quotaKey: BillingQuotaKey.SEATS,
          quantity: grants.seats,
          label: "Pilot seats grant"
        },
        {
          quotaKey: BillingQuotaKey.ACTIVE_JOBS,
          quantity: grants.activeJobs,
          label: "Pilot active jobs grant"
        },
        {
          quotaKey: BillingQuotaKey.CANDIDATE_PROCESSING,
          quantity: grants.candidateProcessing,
          label: "Pilot candidate processing grant"
        },
        {
          quotaKey: BillingQuotaKey.AI_INTERVIEWS,
          quantity: grants.aiInterviews,
          label: "Pilot AI interviews grant"
        }
      ].filter((grant) => grant.quantity > 0);

      for (const grant of manualGrantRows) {
        const existingGrant = await tx.billingQuotaGrant.findFirst({
          where: {
            tenantId: tenant.id,
            accountId: account.id,
            quotaKey: grant.quotaKey,
            source: BillingGrantSource.MANUAL,
            label: grant.label,
            quantity: grant.quantity
          }
        });

        if (!existingGrant) {
          await tx.billingQuotaGrant.create({
            data: {
              tenantId: tenant.id,
              accountId: account.id,
              subscriptionId: subscription.id,
              quotaKey: grant.quotaKey,
              source: BillingGrantSource.MANUAL,
              label: grant.label,
              quantity: grant.quantity,
              createdBy: actorUser?.id ?? null,
              metadataJson: {
                pilotProvisioning: true
              }
            }
          });
        }
      }

      if (shouldIssueActivationLink && actorUser) {
        const rawToken = randomBytes(48).toString("base64url");
        const tokenHash = hashToken(rawToken);
        const expiresAt = addHours(now, invitationTtlHours || 72);

        await tx.memberInvitation.updateMany({
          where: {
            tenantId: tenant.id,
            userId: ownerRecord.id,
            acceptedAt: null,
            revokedAt: null
          },
          data: {
            revokedAt: now
          }
        });

        await tx.user.update({
          where: {
            id: ownerRecord.id
          },
          data: {
            status: UserStatus.INVITED,
            passwordHash: null,
            passwordSetAt: null
          }
        });

        await tx.memberInvitation.create({
          data: {
            tenantId: tenant.id,
            userId: ownerRecord.id,
            invitedBy: actorUser.id,
            email: ownerRecord.email,
            role: Role.OWNER,
            tokenHash,
            expiresAt
          }
        });

        activationUrl = `${DEFAULT_WEB_BASE_URL}/auth/invitations/accept?token=${encodeURIComponent(rawToken)}`;

        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId: actorUser.id,
            actorType: AuditActorType.USER,
            action: "pilot.owner_activation_link_issued",
            entityType: "User",
            entityId: ownerRecord.id,
            metadata: {
              ownerEmail: ownerRecord.email,
              expiresAt: expiresAt.toISOString()
            }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: actorUser?.id ?? null,
          actorType: actorUser ? AuditActorType.USER : AuditActorType.SYSTEM,
          action: "pilot.provisioning.completed",
          entityType: "Tenant",
          entityId: tenant.id,
          metadata: {
            planKey,
            billingEmail,
            quotas: {
              seatsIncluded,
              activeJobsIncluded,
              candidateProcessingIncluded,
              aiInterviewsIncluded
            },
            manualGrants: grants
          }
        }
      });

      return {
        tenantId: tenant.id,
        companyName: tenant.name,
        owner: {
          userId: ownerRecord.id,
          fullName: ownerRecord.fullName,
          email: ownerRecord.email
        }
      };
    });

    const artifactPayload = {
      ...summary,
      activationUrl,
      owner: result.owner,
      actor: actorUser
        ? {
            userId: actorUser.id,
            email: actorUser.email,
            fullName: actorUser.fullName
          }
        : null
    };

    const artifacts = await writeArtifacts(result.tenantId, stamp, artifactPayload);

    console.log(
      JSON.stringify(
        {
          ...artifactPayload,
          artifacts
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
