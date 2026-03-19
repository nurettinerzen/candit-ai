import { Injectable, NotFoundException, Inject} from "@nestjs/common";
import { ApplicationStage } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ApplicationQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string, stage?: ApplicationStage, jobId?: string) {
    const applications = await this.prisma.candidateApplication.findMany({
      where: {
        tenantId,
        ...(stage ? { currentStage: stage } : {}),
        ...(jobId ? { jobId } : {})
      },
      include: {
        candidate: true,
        job: true,
        aiTaskRuns: {
          where: {
            taskType: {
              in: [
                "CV_PARSING",
                "SCREENING_SUPPORT",
                "REPORT_GENERATION",
                "RECOMMENDATION_GENERATION"
              ]
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const [latestReportsByApplication, latestRecommendationsByApplication] = await Promise.all([
      this.groupLatestReports(tenantId, applications.map((item) => item.id)),
      this.groupLatestRecommendations(tenantId, applications.map((item) => item.id))
    ]);

    return applications.map((application) => ({
      ...application,
      aiReports: latestReportsByApplication[application.id] ?? [],
      recommendations: latestRecommendationsByApplication[application.id] ?? []
    }));
  }

  async getById(tenantId: string, id: string) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        candidate: {
          include: {
            cvFiles: {
              orderBy: {
                uploadedAt: "desc"
              },
              take: 1
            }
          }
        },
        job: true,
        aiTaskRuns: {
          where: {
            taskType: {
              in: [
                "CV_PARSING",
                "SCREENING_SUPPORT",
                "REPORT_GENERATION",
                "RECOMMENDATION_GENERATION"
              ]
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 20,
          include: {
            recommendations: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1
            }
          }
        },
        stageHistory: {
          orderBy: {
            changedAt: "desc"
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    const [reports, recommendations, screeningRuns] = await Promise.all([
      this.prisma.aiReport.findMany({
        where: {
          tenantId,
          applicationId: id
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
        take: 5
      }),
      this.prisma.applicationRecommendation.findMany({
        where: {
          tenantId,
          applicationId: id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }),
      this.prisma.aiTaskRun.findMany({
        where: {
          tenantId,
          applicationId: id,
          taskType: "SCREENING_SUPPORT"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      })
    ]);

    const recommendationIds = recommendations.map((item) => item.id);
    const aiTaskRunIds = application.aiTaskRuns.map((item) => item.id);

    const humanApprovals = await this.prisma.humanApproval.findMany({
      where: {
        tenantId,
        OR: [
          {
            entityType: "CandidateApplication",
            entityId: application.id
          },
          ...(recommendationIds.length > 0
            ? [
                {
                  recommendationId: {
                    in: recommendationIds
                  }
                }
              ]
            : []),
          ...(aiTaskRunIds.length > 0
            ? [
                {
                  aiTaskRunId: {
                    in: aiTaskRunIds
                  }
                }
              ]
            : [])
        ]
      },
      orderBy: {
        approvedAt: "desc"
      },
      take: 30
    });

    return {
      ...application,
      aiReports: reports,
      recommendations,
      screeningRuns,
      humanApprovals
    };
  }

  private async groupLatestReports(tenantId: string, applicationIds: string[]) {
    if (applicationIds.length === 0) {
      return {} as Record<string, unknown[]>;
    }

    const reports = await this.prisma.aiReport.findMany({
      where: {
        tenantId,
        applicationId: {
          in: applicationIds
        }
      },
      include: {
        evidenceLinks: {
          orderBy: {
            createdAt: "asc"
          },
          take: 10
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return reports.reduce<Record<string, typeof reports>>((acc, report) => {
      const existing = acc[report.applicationId] ?? [];
      if (existing.length > 0) {
        return acc;
      }

      acc[report.applicationId] = [report];
      return acc;
    }, {});
  }

  private async groupLatestRecommendations(tenantId: string, applicationIds: string[]) {
    if (applicationIds.length === 0) {
      return {} as Record<string, unknown[]>;
    }

    const recommendations = await this.prisma.applicationRecommendation.findMany({
      where: {
        tenantId,
        applicationId: {
          in: applicationIds
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return recommendations.reduce<Record<string, typeof recommendations>>((acc, recommendation) => {
      const existing = acc[recommendation.applicationId] ?? [];
      if (existing.length > 0) {
        return acc;
      }

      acc[recommendation.applicationId] = [recommendation];
      return acc;
    }, {});
  }
}
