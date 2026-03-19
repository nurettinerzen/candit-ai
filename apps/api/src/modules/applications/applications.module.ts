import { Module } from "@nestjs/common";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { AuditModule } from "../audit/audit.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { InterviewsModule } from "../interviews/interviews.module";
import { PolicyModule } from "../policy/policy.module";
import { ReportsModule } from "../reports/reports.module";
import { ApplicationAutomationService } from "./application-automation.service";
import { ApplicationQueryService } from "./application-query.service";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";
import { FitScoringService } from "./fit-scoring.service";
import { RecruiterNotesService } from "./recruiter-notes.service";

@Module({
  imports: [
    AuditModule,
    DomainEventsModule,
    PolicyModule,
    AiOrchestrationModule,
    FeatureFlagsModule,
    InterviewsModule,
    ReportsModule
  ],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationQueryService,
    ApplicationAutomationService,
    FitScoringService,
    RecruiterNotesService
  ],
  exports: [
    ApplicationsService,
    ApplicationAutomationService,
    ApplicationQueryService,
    FitScoringService,
    RecruiterNotesService
  ]
})
export class ApplicationsModule {}
