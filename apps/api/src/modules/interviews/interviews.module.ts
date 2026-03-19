import { Module } from "@nestjs/common";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { AuditModule } from "../audit/audit.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { SpeechModule } from "../speech/speech.module";
import { InterviewLauncherService } from "./interview-launcher.service";
import { InterviewsController } from "./interviews.controller";
import { InterviewsService } from "./interviews.service";

@Module({
  imports: [
    AiOrchestrationModule,
    AuditModule,
    DomainEventsModule,
    FeatureFlagsModule,
    IntegrationsModule,
    SpeechModule
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewLauncherService],
  exports: [InterviewsService, InterviewLauncherService]
})
export class InterviewsModule {}
