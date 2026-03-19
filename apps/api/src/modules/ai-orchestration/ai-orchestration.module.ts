import { Module } from "@nestjs/common";
import { AsyncJobsModule } from "../async-jobs/async-jobs.module";
import { AuditModule } from "../audit/audit.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PolicyModule } from "../policy/policy.module";
import { AiOrchestrationController } from "./ai-orchestration.controller";
import { AiOrchestrationService } from "./ai-orchestration.service";
import { AiProviderRegistryService } from "./providers/ai-provider-registry.service";
import { NoopAiProviderService } from "./providers/noop-ai-provider.service";
import { OpenAiProviderService } from "./providers/openai-ai-provider.service";

@Module({
  imports: [
    AsyncJobsModule,
    FeatureFlagsModule,
    DomainEventsModule,
    AuditModule,
    PolicyModule
  ],
  controllers: [AiOrchestrationController],
  providers: [
    AiOrchestrationService,
    NoopAiProviderService,
    OpenAiProviderService,
    AiProviderRegistryService
  ],
  exports: [AiOrchestrationService, AiProviderRegistryService]
})
export class AiOrchestrationModule {}
