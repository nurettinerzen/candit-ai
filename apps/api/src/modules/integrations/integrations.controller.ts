import { Body, Controller, Get, Param, Post, Req, Inject } from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import type { Request } from "express";
import type { IntegrationConnectionStatus, IntegrationProvider } from "@prisma/client";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { BillingService } from "../billing/billing.service";
import { IntegrationsService } from "./integrations.service";

const INTEGRATION_PROVIDERS = [
  "CALENDLY",
  "GOOGLE_CALENDAR",
  "MICROSOFT_CALENDAR",
  "ZOOM",
  "GOOGLE_MEET",
  "ATS_GENERIC"
] as const;

class IntegrationSyncBody {
  @IsIn(INTEGRATION_PROVIDERS)
  provider!: IntegrationProvider;

  @IsString()
  objectType!: string;

  @IsString()
  @IsOptional()
  cursor?: string;
}

class IntegrationWebhookBody {
  @IsString()
  eventKey!: string;

  @IsString()
  idempotencyKey!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

class UpsertConnectionBody {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsIn(["ACTIVE", "INACTIVE", "ERROR"])
  @IsOptional()
  status?: IntegrationConnectionStatus;

  @IsObject()
  config!: Record<string, unknown>;

  @IsObject()
  credentials!: Record<string, unknown>;
}

class UpsertCredentialBody {
  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  scope?: string;
}

@Controller("integrations")
export class IntegrationsController {
  constructor(
    @Inject(IntegrationsService) private readonly integrationsService: IntegrationsService,
    @Inject(BillingService) private readonly billingService: BillingService
  ) {}

  private async assertProviderAllowed(tenantId: string, provider: IntegrationProvider) {
    if (
      provider === "GOOGLE_CALENDAR" ||
      provider === "GOOGLE_MEET" ||
      provider === "CALENDLY" ||
      provider === "MICROSOFT_CALENDAR"
    ) {
      await this.billingService.assertFeatureEnabled(tenantId, "calendarIntegrations");
    }
  }

  @Get("providers")
  @Permissions("integration.manage")
  listProviders() {
    return this.integrationsService.listProviders();
  }

  @Get("connections")
  @Permissions("integration.manage")
  listConnections(@CurrentTenant() tenantId: string) {
    return this.integrationsService.listConnections(tenantId);
  }

  @Post("connections/:provider")
  @Permissions("integration.manage")
  async upsertConnection(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("provider") provider: IntegrationProvider,
    @Body() body: UpsertConnectionBody
  ) {
    await this.assertProviderAllowed(tenantId, provider);
    return this.integrationsService.upsertConnection({
      tenantId,
      provider,
      displayName: body.displayName,
      status: body.status,
      config: body.config,
      credentials: body.credentials,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("connections/:provider/credential")
  @Permissions("integration.manage")
  async upsertCredential(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("provider") provider: IntegrationProvider,
    @Body() body: UpsertCredentialBody
  ) {
    await this.assertProviderAllowed(tenantId, provider);
    return this.integrationsService.upsertConnectionCredential({
      tenantId,
      provider,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt: body.expiresAt,
      scope: body.scope,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("connections/:provider/credential/refresh")
  @Permissions("integration.manage")
  async refreshCredential(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("provider") provider: IntegrationProvider
  ) {
    await this.assertProviderAllowed(tenantId, provider);
    return this.integrationsService.refreshConnectionCredential({
      tenantId,
      provider,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("sync")
  @Permissions("integration.manage")
  runSync(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: IntegrationSyncBody
  ) {
    return this.integrationsService.runSync({
      tenantId,
      provider: body.provider,
      objectType: body.objectType,
      cursor: body.cursor,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("webhooks/:provider")
  @Permissions("integration.manage")
  ingestWebhook(
    @CurrentTenant() tenantId: string,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("provider") provider: IntegrationProvider,
    @Req() request: Request,
    @Body() body: IntegrationWebhookBody
  ) {
    return this.integrationsService.ingestWebhook({
      tenantId,
      provider,
      eventKey: body.eventKey,
      idempotencyKey: body.idempotencyKey,
      payload: body.payload,
      headers: request.headers,
      traceId: requestContext?.traceId
    });
  }
}
