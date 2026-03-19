import { Inject, Injectable } from "@nestjs/common";
import { DomainEventStatus, Prisma, type DomainEvent } from "@prisma/client";
import { StructuredLoggerService } from "../../common/logging/structured-logger.service";
import { PrismaService } from "../../prisma/prisma.service";

export type AppendDomainEventInput = {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  traceId?: string;
  payload: Prisma.InputJsonValue;
};

function backoffMs(attempt: number) {
  const base = 5_000;
  const max = 5 * 60 * 1_000;
  const computed = base * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(max, computed);
}

@Injectable()
export class DomainEventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService
  ) {}

  async append(input: AppendDomainEventInput) {
    const event = await this.prisma.domainEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        traceId: input.traceId,
        payload: input.payload,
        status: DomainEventStatus.PENDING,
        availableAt: new Date()
      }
    });

    this.logger.info("domain_event.outbox.appended", {
      id: event.id,
      tenantId: event.tenantId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      traceId: event.traceId
    });

    return event;
  }

  async recoverStaleProcessing(staleMs = 60_000) {
    const staleBefore = new Date(Date.now() - staleMs);

    const recovered = await this.prisma.domainEvent.updateMany({
      where: {
        status: DomainEventStatus.PROCESSING,
        lockedAt: {
          lt: staleBefore
        }
      },
      data: {
        status: DomainEventStatus.PENDING,
        lockedAt: null,
        lockedBy: null,
        availableAt: new Date()
      }
    });

    if (recovered.count > 0) {
      this.logger.warn("domain_event.outbox.stale_recovered", {
        count: recovered.count,
        staleBefore: staleBefore.toISOString()
      });
    }
  }

  listDispatchable(limit = 100) {
    return this.prisma.domainEvent.findMany({
      where: {
        status: DomainEventStatus.PENDING,
        availableAt: {
          lte: new Date()
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: Math.min(limit, 500)
    });
  }

  async claimForDispatch(id: string, workerId: string) {
    const now = new Date();

    const claimed = await this.prisma.domainEvent.updateMany({
      where: {
        id,
        status: DomainEventStatus.PENDING,
        availableAt: {
          lte: now
        }
      },
      data: {
        status: DomainEventStatus.PROCESSING,
        lockedAt: now,
        lockedBy: workerId,
        lastAttemptAt: now,
        attempts: {
          increment: 1
        }
      }
    });

    if (claimed.count === 0) {
      return null;
    }

    return this.prisma.domainEvent.findUnique({
      where: { id }
    });
  }

  markPublished(id: string) {
    const now = new Date();

    return this.prisma.domainEvent.updateMany({
      where: {
        id,
        status: DomainEventStatus.PROCESSING
      },
      data: {
        status: DomainEventStatus.PUBLISHED,
        publishedAt: now,
        processedAt: now,
        errorMessage: null,
        lockedAt: null,
        lockedBy: null
      }
    });
  }

  async markFailedOrRetry(event: Pick<DomainEvent, "id" | "attempts">, errorMessage: string, maxAttempts = 6) {
    const normalizedError = errorMessage.trim().slice(0, 1000);

    if (event.attempts >= maxAttempts) {
      const now = new Date();

      await this.prisma.domainEvent.updateMany({
        where: {
          id: event.id,
          status: DomainEventStatus.PROCESSING
        },
        data: {
          status: DomainEventStatus.FAILED,
          errorMessage: normalizedError,
          processedAt: now,
          lockedAt: null,
          lockedBy: null
        }
      });

      return;
    }

    const nextRetryAt = new Date(Date.now() + backoffMs(event.attempts));

    await this.prisma.domainEvent.updateMany({
      where: {
        id: event.id,
        status: DomainEventStatus.PROCESSING
      },
      data: {
        status: DomainEventStatus.PENDING,
        errorMessage: normalizedError,
        availableAt: nextRetryAt,
        lockedAt: null,
        lockedBy: null
      }
    });
  }
}
