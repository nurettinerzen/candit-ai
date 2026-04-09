import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import {
  PlatformIncidentCategory,
  PlatformIncidentSeverity,
  PlatformIncidentStatus,
  Prisma,
  SecurityEventSeverity
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type SecurityEventInput = {
  tenantId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  source: string;
  code: string;
  message: string;
  severity?: SecurityEventSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue | null;
};

type PlatformIncidentInput = {
  tenantId?: string | null;
  category: PlatformIncidentCategory;
  severity?: PlatformIncidentSeverity;
  source: string;
  code: string;
  message: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue | null;
};

function normalizeText(value: string, maxLength = 500) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeOptionalText(value: string | null | undefined, maxLength = 500) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function toNullableJsonValue(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? Prisma.JsonNull : value;
}

function hashIpAddress(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value, 120);
  if (!normalized) {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
}

export function createIncidentKey(input: {
  tenantId?: string | null;
  category: PlatformIncidentCategory;
  source: string;
  code: string;
  message: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.tenantId ?? "platform",
        input.category,
        normalizeText(input.source, 120),
        normalizeText(input.code, 120),
        normalizeText(input.message, 500)
      ].join("|")
    )
    .digest("hex");
}

function toIncidentSeverity(severity: SecurityEventSeverity) {
  return severity === SecurityEventSeverity.CRITICAL
    ? PlatformIncidentSeverity.CRITICAL
    : PlatformIncidentSeverity.WARNING;
}

@Injectable()
export class SecurityEventsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordSecurityEvent(input: SecurityEventInput) {
    const occurredAt = input.occurredAt ?? new Date();
    const severity = input.severity ?? SecurityEventSeverity.WARNING;

    await this.prisma.$transaction(async (tx) => {
      await tx.securityEvent.create({
        data: {
          tenantId: input.tenantId ?? null,
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          source: normalizeText(input.source, 120),
          code: normalizeText(input.code, 120),
          message: normalizeText(input.message, 500),
          severity,
          ipAddressHash: hashIpAddress(input.ipAddress),
          userAgent: normalizeOptionalText(input.userAgent, 500),
          occurredAt,
          ...(input.metadata === undefined ? {} : { metadata: toNullableJsonValue(input.metadata) })
        }
      });

      await this.recordPlatformIncidentTx(tx, {
        tenantId: input.tenantId ?? null,
        category: PlatformIncidentCategory.SECURITY,
        severity: toIncidentSeverity(severity),
        source: input.source,
        code: input.code,
        message: input.message,
        occurredAt,
        metadata: input.metadata
      });
    });
  }

  async recordPlatformIncident(input: PlatformIncidentInput) {
    await this.prisma.$transaction(async (tx) => {
      await this.recordPlatformIncidentTx(tx, input);
    });
  }

  private async recordPlatformIncidentTx(
    tx: Prisma.TransactionClient,
    input: PlatformIncidentInput
  ) {
    const occurredAt = input.occurredAt ?? new Date();
    const severity = input.severity ?? PlatformIncidentSeverity.WARNING;
    const incidentKey = createIncidentKey({
      tenantId: input.tenantId ?? null,
      category: input.category,
      source: input.source,
      code: input.code,
      message: input.message
    });

    const existing = await tx.platformIncident.findUnique({
      where: {
        incidentKey
      },
      select: {
        severity: true
      }
    });

    const nextSeverity =
      existing?.severity === PlatformIncidentSeverity.CRITICAL ||
      severity === PlatformIncidentSeverity.CRITICAL
        ? PlatformIncidentSeverity.CRITICAL
        : PlatformIncidentSeverity.WARNING;

    await tx.platformIncident.upsert({
      where: {
        incidentKey
      },
      create: {
        incidentKey,
        tenantId: input.tenantId ?? null,
        category: input.category,
        severity: nextSeverity,
        source: normalizeText(input.source, 120),
        code: normalizeText(input.code, 120),
        message: normalizeText(input.message, 500),
        status: PlatformIncidentStatus.OPEN,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
        ...(input.metadata === undefined ? {} : { metadata: toNullableJsonValue(input.metadata) })
      },
      update: {
        severity: nextSeverity,
        status: PlatformIncidentStatus.OPEN,
        lastSeenAt: occurredAt,
        resolvedAt: null,
        repeatCount: {
          increment: 1
        },
        ...(input.metadata === undefined ? {} : { metadata: toNullableJsonValue(input.metadata) })
      }
    });
  }
}
