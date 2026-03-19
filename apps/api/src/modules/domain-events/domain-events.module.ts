import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DomainEventDispatcherService } from "./domain-event-dispatcher.service";
import { DomainEventOutboxConsumerService } from "./domain-event-outbox-consumer.service";
import { DomainEventsService } from "./domain-events.service";

@Module({
  imports: [IntegrationsModule, NotificationsModule],
  providers: [DomainEventsService, DomainEventDispatcherService, DomainEventOutboxConsumerService],
  exports: [DomainEventsService]
})
export class DomainEventsModule {}
