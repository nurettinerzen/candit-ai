import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IntegrationIdentityMapperService } from "./integration-identity-mapper.service";
import { GoogleOAuthController } from "./google-oauth.controller";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";

@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController, GoogleOAuthController],
  providers: [IntegrationsService, IntegrationIdentityMapperService],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
