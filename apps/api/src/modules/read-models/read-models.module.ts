import { Module } from "@nestjs/common";
import { RuntimeConfigModule } from "../../config/runtime-config.module";
import { AiOrchestrationModule } from "../ai-orchestration/ai-orchestration.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuditModule } from "../audit/audit.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { InterviewsModule } from "../interviews/interviews.module";
import { RecommendationsModule } from "../recommendations/recommendations.module";
import { ReportsModule } from "../reports/reports.module";
import { ScreeningModule } from "../screening/screening.module";
import { SpeechModule } from "../speech/speech.module";
import { ReadModelsController } from "./read-models.controller";
import { ReadModelsService } from "./read-models.service";

@Module({
  imports: [
    AnalyticsModule,
    FeatureFlagsModule,
    AiOrchestrationModule,
    ScreeningModule,
    ReportsModule,
    RecommendationsModule,
    InterviewsModule,
    IntegrationsModule,
    SpeechModule,
    RuntimeConfigModule,
    AuditModule
  ],
  controllers: [ReadModelsController],
  providers: [ReadModelsService]
})
export class ReadModelsModule {}
