import { Body, Controller, Get, Param, Patch , Inject} from "@nestjs/common";
import { IsDefined, IsIn, IsOptional, IsString } from "class-validator";
import type { Prisma } from "@prisma/client";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { FeatureFlagsService } from "./feature-flags.service";

const FLAG_TYPES = ["BOOLEAN", "MULTIVARIATE", "KILL_SWITCH"] as const;
type FlagType = (typeof FLAG_TYPES)[number];

class UpdateFeatureFlagBody {
  @IsIn(FLAG_TYPES)
  @IsOptional()
  type?: FlagType;

  @IsDefined()
  value!: Prisma.InputJsonValue;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller("feature-flags")
export class FeatureFlagsController {
  constructor(@Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @Permissions("ai.config.update")
  list(@CurrentTenant() tenantId: string) {
    return this.featureFlagsService.list(tenantId);
  }

  @Patch(":key")
  @Permissions("ai.config.update")
  update(
    @CurrentTenant() tenantId: string,
    @Param("key") key: string,
    @Body() body: UpdateFeatureFlagBody
  ) {
    return this.featureFlagsService.update(tenantId, key, {
      type: body.type,
      value: body.value,
      description: body.description
    });
  }
}
