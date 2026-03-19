import { Injectable, Inject} from "@nestjs/common";
import { StructuredLoggerService } from "../../common/logging/structured-logger.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class DomainEventDispatcherService {
  constructor(
    @Inject(IntegrationsService) private readonly integrationsService: IntegrationsService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService
  ) {}

  async dispatch(event: {
    tenantId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    traceId?: string | null;
    payload: Record<string, unknown>;
  }) {
    await Promise.all([
      this.integrationsService.handleDomainEvent({
        tenantId: event.tenantId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        traceId: event.traceId ?? undefined,
        payload: event.payload
      }),
      this.notificationsService.handleDomainEvent({
        tenantId: event.tenantId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        traceId: event.traceId ?? undefined,
        payload: event.payload
      })
    ]);

    this.logger.info("domain_event.dispatch.succeeded", {
      tenantId: event.tenantId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      traceId: event.traceId ?? null
    });
  }
}
