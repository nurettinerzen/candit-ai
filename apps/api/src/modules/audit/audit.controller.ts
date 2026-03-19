import { Controller, Get, Query , Inject} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AuditService } from "./audit.service";

class AuditQuery {
  @IsOptional()
  entityType?: string;

  @IsOptional()
  entityId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

@Controller("audit-logs")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @Permissions("audit.read")
  list(@CurrentTenant() tenantId: string, @Query() query: AuditQuery) {
    return this.auditService.list(tenantId, query.entityType, query.entityId, query.limit);
  }
}
