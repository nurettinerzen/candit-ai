import { Controller, Get , Inject} from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { TenantConfigService } from "./tenant-config.service";

@Controller("tenant-config")
export class TenantConfigController {
  constructor(@Inject(TenantConfigService) private readonly tenantConfigService: TenantConfigService) {}

  @Get("runtime")
  @Permissions("tenant.manage")
  getRuntime(@CurrentTenant() tenantId: string) {
    return this.tenantConfigService.getRuntimeConfiguration(tenantId);
  }
}
