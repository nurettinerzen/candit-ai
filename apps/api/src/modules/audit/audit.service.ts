import { Injectable, Inject} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(tenantId: string, entityType?: string, entityId?: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.min(limit, 200)
    });
  }
}
