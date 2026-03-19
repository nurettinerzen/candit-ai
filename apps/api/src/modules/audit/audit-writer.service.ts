import { Injectable, Inject} from "@nestjs/common";
import { AuditActorType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type CreateAuditEntryInput = {
  tenantId: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorType?: AuditActorType;
  actorUserId?: string;
  traceId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditWriterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  write(input: CreateAuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorType: input.actorType ?? AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        traceId: input.traceId,
        metadata: input.metadata
      }
    });
  }
}
