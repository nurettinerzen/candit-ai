import { Injectable, NotFoundException, Inject} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RecommendationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listByApplication(tenantId: string, applicationId: string, limit = 10) {
    await this.ensureApplicationExists(tenantId, applicationId);

    return this.prisma.applicationRecommendation.findMany({
      where: {
        tenantId,
        applicationId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.min(limit, 50)
    });
  }

  async latestByApplication(tenantId: string, applicationId: string) {
    await this.ensureApplicationExists(tenantId, applicationId);

    return this.prisma.applicationRecommendation.findFirst({
      where: {
        tenantId,
        applicationId
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getById(tenantId: string, recommendationId: string) {
    const recommendation = await this.prisma.applicationRecommendation.findFirst({
      where: {
        tenantId,
        id: recommendationId
      },
      include: {
        approvals: {
          orderBy: {
            approvedAt: "desc"
          },
          take: 20
        }
      }
    });

    if (!recommendation) {
      throw new NotFoundException("Oneri bulunamadi.");
    }

    return recommendation;
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
