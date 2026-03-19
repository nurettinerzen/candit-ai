import { Injectable, Inject} from "@nestjs/common";
import { ApplicationStage } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async funnel(tenantId: string) {
    const grouped = await this.prisma.candidateApplication.groupBy({
      by: ["currentStage"],
      where: { tenantId },
      _count: {
        _all: true
      }
    });

    return grouped
      .map((item) => ({
        stage: item.currentStage,
        count: item._count._all
      }))
      .sort((a, b) => a.stage.localeCompare(b.stage));
  }

  async timeToHire(tenantId: string) {
    const hires = await this.prisma.candidateStageHistory.findMany({
      where: {
        tenantId,
        toStage: ApplicationStage.HIRED
      },
      include: {
        application: {
          select: {
            createdAt: true
          }
        }
      }
    });

    if (hires.length === 0) {
      return {
        hires: 0,
        avgDays: null,
        medianDays: null
      };
    }

    const days = hires
      .map((item) =>
        (item.changedAt.getTime() - item.application.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      .sort((a, b) => a - b);

    const avgDays = days.reduce((sum, day) => sum + day, 0) / days.length;
    const lowerMedian = days[Math.floor((days.length - 1) / 2)] ?? 0;
    const upperMedian = days[Math.floor(days.length / 2)] ?? lowerMedian;
    const medianDays = (lowerMedian + upperMedian) / 2;

    return {
      hires: hires.length,
      avgDays: Number(avgDays.toFixed(2)),
      medianDays: Number(medianDays.toFixed(2))
    };
  }

  async interviewQuality(tenantId: string) {
    const [transcripts, reports] = await Promise.all([
      this.prisma.transcript.findMany({
        where: {
          tenantId,
          qualityScore: { not: null }
        },
        select: {
          qualityScore: true
        }
      }),
      this.prisma.aiReport.findMany({
        where: {
          tenantId
        },
        select: {
          confidence: true
        }
      })
    ]);

    const transcriptScores = transcripts
      .map((item) => item.qualityScore)
      .filter((score): score is NonNullable<typeof score> => score !== null)
      .map((score) => Number(score));

    const reportConfidences = reports.map((item) => Number(item.confidence));

    const transcriptAvg =
      transcriptScores.length > 0
        ? transcriptScores.reduce((sum, value) => sum + value, 0) / transcriptScores.length
        : null;

    const reportAvg =
      reportConfidences.length > 0
        ? reportConfidences.reduce((sum, value) => sum + value, 0) / reportConfidences.length
        : null;

    return {
      transcriptSamples: transcriptScores.length,
      reportSamples: reportConfidences.length,
      transcriptQualityAvg: transcriptAvg === null ? null : Number(transcriptAvg.toFixed(3)),
      reportConfidenceAvg: reportAvg === null ? null : Number(reportAvg.toFixed(3))
    };
  }
}
