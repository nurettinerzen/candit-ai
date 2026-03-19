import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DomainEventsService } from "./domain-events.service";
import { DomainEventDispatcherService } from "./domain-event-dispatcher.service";
import { StructuredLoggerService } from "../../common/logging/structured-logger.service";

function toPayloadObject(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {} as Record<string, unknown>;
  }

  return payload as Record<string, unknown>;
}

@Injectable()
export class DomainEventOutboxConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = `api-outbox-${randomUUID()}`;
  private readonly pollMs = Number(process.env.DOMAIN_EVENT_OUTBOX_POLL_MS ?? 1500);
  private readonly batchSize = Number(process.env.DOMAIN_EVENT_OUTBOX_BATCH_SIZE ?? 40);
  private readonly maxAttempts = Number(process.env.DOMAIN_EVENT_OUTBOX_MAX_ATTEMPTS ?? 6);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(DomainEventDispatcherService)
    @Inject(DomainEventDispatcherService) private readonly dispatcher: DomainEventDispatcherService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollMs);

    void this.tick();

    this.logger.info("domain_event.outbox.consumer.started", {
      workerId: this.workerId,
      pollMs: this.pollMs,
      batchSize: this.batchSize,
      maxAttempts: this.maxAttempts
    });
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.domainEventsService.recoverStaleProcessing();
      const pending = await this.domainEventsService.listDispatchable(this.batchSize);

      for (const candidate of pending) {
        const claimed = await this.domainEventsService.claimForDispatch(candidate.id, this.workerId);

        if (!claimed) {
          continue;
        }

        try {
          await this.dispatcher.dispatch({
            tenantId: claimed.tenantId,
            aggregateType: claimed.aggregateType,
            aggregateId: claimed.aggregateId,
            eventType: claimed.eventType,
            traceId: claimed.traceId,
            payload: {
              ...toPayloadObject(claimed.payload),
              domainEventId: claimed.id
            }
          });

          await this.domainEventsService.markPublished(claimed.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";

          await this.domainEventsService.markFailedOrRetry(claimed, message, this.maxAttempts);

          this.logger.warn("domain_event.outbox.dispatch_failed", {
            id: claimed.id,
            tenantId: claimed.tenantId,
            eventType: claimed.eventType,
            aggregateType: claimed.aggregateType,
            aggregateId: claimed.aggregateId,
            attempts: claimed.attempts,
            traceId: claimed.traceId,
            error: message
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
