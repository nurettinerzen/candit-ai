import { Module } from "@nestjs/common";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { AuditModule } from "../audit/audit.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { ScreeningController } from "./screening.controller";
import { ScreeningService } from "./screening.service";

@Module({
  imports: [AiOrchestrationModule, AuditModule, DomainEventsModule],
  controllers: [ScreeningController],
  providers: [ScreeningService],
  exports: [ScreeningService]
})
export class ScreeningModule {}
