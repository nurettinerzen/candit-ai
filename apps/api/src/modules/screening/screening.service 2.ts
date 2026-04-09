import { Injectable, NotFoundException } from "@nestjs/common";
import { AiTaskType, type AiTaskRun } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ScreeningService {
  constructor(private readonly prisma: PrismaService) {}

  async listByApplication(tenantId: string, applicationId: string, limit = 20) {
    await this.ensureApplicationExists(tenantId, applicationId);

    return this.prisma.aiTaskRun.findMany({
      where: {
        tenantId,
        applicationId,
        taskType: AiTaskType.SCREENING_SUPPORT
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.min(limit, 100)
    });
  }

  async latestByApplication(tenantId: string, applicationId: string): Promise<AiTaskRun | null> {
    await this.ensureApplicationExists(tenantId, applicationId);

    return this.prisma.aiTaskRun.findFirst({
      where: {
        tenantId,
        applicationId,
        taskType: AiTaskType.SCREENING_SUPPORT
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  private async ensureApplicationExists(tenantId: string, applicationId: string) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: applicationId,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }
  }
}
