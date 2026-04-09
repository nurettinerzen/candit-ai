import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthGuard } from "./common/guards/auth.guard";
import { RbacGuard } from "./common/guards/rbac.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import { LoggingModule } from "./common/logging/logging.module";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";
import { RuntimeConfigModule } from "./config/runtime-config.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AiOrchestrationModule } from "./modules/ai-orchestration/ai-orchestration.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { AsyncJobsModule } from "./modules/async-jobs/async-jobs.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CandidatesModule } from "./modules/candidates/candidates.module";
import { FeatureFlagsModule } from "./modules/feature-flags/feature-flags.module";
import { HealthModule } from "./modules/health/health.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { InternalAdminModule } from "./modules/internal-admin/internal-admin.module";
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PublicIntakeModule } from "./modules/public-intake/public-intake.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { ReadModelsModule } from "./modules/read-models/read-models.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { MembersModule } from "./modules/members/members.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ScreeningModule } from "./modules/screening/screening.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { SourcingModule } from "./modules/sourcing/sourcing.module";
import { TenantConfigModule } from "./modules/tenant-config/tenant-config.module";
import { ElevenLabsModule } from "./modules/elevenlabs/elevenlabs.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"]
    }),
    RuntimeConfigModule,
    LoggingModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AiOrchestrationModule,
    CandidatesModule,
    JobsModule,
    ApplicationsModule,
    AsyncJobsModule,
    AuditModule,
    FeatureFlagsModule,
    AnalyticsModule,
    ScreeningModule,
    SchedulingModule,
    SourcingModule,
    ReportsModule,
    RecommendationsModule,
    MembersModule,
    BillingModule,
    InterviewsModule,
    IntegrationsModule,
    InternalAdminModule,
    NotificationsModule,
    PublicIntakeModule,
    ReadModelsModule,
    TenantConfigModule,
    ElevenLabsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
