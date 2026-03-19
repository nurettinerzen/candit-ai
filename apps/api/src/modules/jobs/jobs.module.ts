import { Module } from "@nestjs/common";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { ApplicationsModule } from "../applications/applications.module";
import { AuditModule } from "../audit/audit.module";
import { CandidatesModule } from "../candidates/candidates.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { ApplicantInboxService } from "./applicant-inbox.service";

@Module({
  imports: [
    AuditModule,
    DomainEventsModule,
    AiOrchestrationModule,
    CandidatesModule,
    ApplicationsModule
  ],
  providers: [JobsService, ApplicantInboxService],
  controllers: [JobsController],
  exports: [JobsService, ApplicantInboxService]
})
export class JobsModule {}
