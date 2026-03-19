import { Injectable, NotFoundException, Inject} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listByApplication(tenantId: string, applicationId: string, limit = 10) {
    await this.ensureApplicationExists(tenantId, applicationId);

    return this.prisma.aiReport.findMany({
      where: {
        tenantId,
        applicationId
      },
      include: {
        evidenceLinks: {
          orderBy: {
            createdAt: "asc"
          },
          take: 30
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.min(limit, 50)
    });
  }

  async getById(tenantId: string, reportId: string) {
    const report = await this.prisma.aiReport.findFirst({
      where: {
        tenantId,
        id: reportId
      },
      include: {
        evidenceLinks: {
          orderBy: {
            createdAt: "asc"
          },
          take: 50
        },
        scores: {
          orderBy: {
            createdAt: "asc"
          },
          take: 50
        }
      }
    });

    if (!report) {
      throw new NotFoundException("AI raporu bulunamadi.");
    }

    return report;
  }

  async assertReportBelongsToApplication(tenantId: string, applicationId: string, reportId: string) {
    if (reportId.startsWith("manual_")) {
      return;
    }

    const report = await this.prisma.aiReport.findFirst({
      where: {
        tenantId,
        id: reportId,
        applicationId
      },
      select: {
        id: true
      }
    });

    if (!report) {
      throw new NotFoundException(
        "aiReportId ayni tenant/application baglaminda gecerli bir rapora isaret etmelidir."
      );
    }
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
