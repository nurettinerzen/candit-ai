import { ForbiddenException, Injectable, Inject} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type HumanApprovalInput = {
  tenantId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  requestedBy: string;
  approvedBy: string;
  reasonCode?: string;
  aiTaskRunId?: string;
  recommendationId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class HumanApprovalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  assertRequesterMatchesApprover(requestedBy: string, approvedBy: string | undefined) {
    if (!approvedBy || approvedBy !== requestedBy) {
      throw new ForbiddenException(
        "Kritik kararlar insan onayi gerektirir. approvedBy oturum kullanicisi ile ayni olmalidir."
      );
    }
  }

  record(input: HumanApprovalInput) {
    this.assertRequesterMatchesApprover(input.requestedBy, input.approvedBy);

    return this.prisma.humanApproval.create({
      data: {
        tenantId: input.tenantId,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        requestedBy: input.requestedBy,
        approvedBy: input.approvedBy,
        reasonCode: input.reasonCode,
        aiTaskRunId: input.aiTaskRunId,
        recommendationId: input.recommendationId,
        metadata: input.metadata
      }
    });
  }
}
