import { Module } from "@nestjs/common";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { AuditModule } from "../audit/audit.module";
import { BillingModule } from "../billing/billing.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { SpeechModule } from "../speech/speech.module";
import { InterviewInvitationMonitorService } from "./interview-invitation-monitor.service";
import { InterviewLauncherService } from "./interview-launcher.service";
import { InterviewsController } from "./interviews.controller";
import { InterviewsService } from "./interviews.service";

@Module({
  imports: [
    AiOrchestrationModule,
    AuditModule,
    BillingModule,
    DomainEventsModule,
    FeatureFlagsModule,
    IntegrationsModule,
    SpeechModule
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewLauncherService, InterviewInvitationMonitorService],
  exports: [InterviewsService, InterviewLauncherService]
})
export class InterviewsModule {}
