import { Module } from "@nestjs/common";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { AuditModule } from "../audit/audit.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { StorageModule } from "../storage/storage.module";
import { CandidatesController } from "./candidates.controller";
import { CandidatesService } from "./candidates.service";

@Module({
  imports: [AuditModule, DomainEventsModule, AiOrchestrationModule, StorageModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService]
})
export class CandidatesModule {}
