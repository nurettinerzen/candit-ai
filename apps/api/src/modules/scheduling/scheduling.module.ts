import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { InterviewsModule } from "../interviews/interviews.module";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";

@Module({
  imports: [AuditModule, DomainEventsModule, IntegrationsModule, InterviewsModule],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService]
})
export class SchedulingModule {}
