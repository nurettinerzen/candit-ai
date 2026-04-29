import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { TenantConfigService } from "./tenant-config.service";

class UpdateTenantProfileRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profileSummary?: string;
}

@Controller("tenant-config")
export class TenantConfigController {
  constructor(@Inject(TenantConfigService) private readonly tenantConfigService: TenantConfigService) {}

  @Get("runtime")
  @Permissions("tenant.manage")
  getRuntime(@CurrentTenant() tenantId: string) {
    return this.tenantConfigService.getRuntimeConfiguration(tenantId);
  }

  @Get("profile")
  @Permissions("user.manage")
  getProfile(@CurrentTenant() tenantId: string) {
    return this.tenantConfigService.getProfile(tenantId);
  }

  @Patch("profile")
  @Permissions("user.manage")
  updateProfile(
    @CurrentTenant() tenantId: string,
    @Body() body: UpdateTenantProfileRequest
  ) {
    return this.tenantConfigService.updateProfile(tenantId, body);
  }

  @Get("hiring-settings")
  @Permissions("user.manage")
  getHiringSettings(@CurrentTenant() tenantId: string) {
    return this.tenantConfigService.getHiringSettings(tenantId);
  }

  @Patch("hiring-settings")
  @Permissions("user.manage")
  updateHiringSettings(
    @CurrentTenant() tenantId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.tenantConfigService.updateHiringSettings(tenantId, body);
  }
}
