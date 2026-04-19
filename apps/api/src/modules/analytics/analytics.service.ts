import { Injectable, Inject } from "@nestjs/common";
import {
  AiTaskStatus,
  AiTaskType,
  ApplicationStage,
  InterviewSessionStatus,
  JobStatus,
  Recommendation
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const SCREENING_TASK_TYPES: AiTaskType[] = [
  AiTaskType.APPLICANT_FIT_SCORING,
  AiTaskType.SCREENING_SUPPORT
];
const TERMINAL_AI_TASK_STATUSES: AiTaskStatus[] = [
  AiTaskStatus.SUCCEEDED,
  AiTaskStatus.FAILED,
  AiTaskStatus.CANCELLED,
  AiTaskStatus.NEEDS_REVIEW
];

const ESTIMATED_MANUAL_MINUTES = {
  screeningPerApplication: 8,
  interviewAnalysisPerSession: 18,
  schedulingPerSession: 10
};

function average(values: number[], fractionDigits = 2) {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(fractionDigits));
}

function median(values: number[], fractionDigits = 2) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const lowerMedian = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  const upperMedian = sorted[Math.floor(sorted.length / 2)] ?? lowerMedian;
  return Number((((lowerMedian + upperMedian) / 2)).toFixed(fractionDigits));
}

function percentage(part: number, total: number, fractionDigits = 1) {
  if (total <= 0) {
    return 0;
  }

  return Number(((part / total) * 100).toFixed(fractionDigits));
}

function nullablePercentage(part: number, total: number, fractionDigits = 1) {
  if (total <= 0) {
    return null;
  }

  return percentage(part, total, fractionDigits);
}

function diffInMinutes(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
}

function diffInDays(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function readHumanDecision(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const decision = (metadata as Record<string, unknown>).decision;
  return decision === "advance" || decision === "hold" || decision === "reject"
    ? decision
    : null;
}

function expectedHumanDecision(recommendation: Recommendation | null) {
  switch (recommendation) {
    case Recommendation.ADVANCE:
      return "advance";
    case Recommendation.HOLD:
      return "hold";
    default:
      return null;
  }
}

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

  async summary(tenantId: string) {
    const [
      publishedJobs,
      totalCandidates,
      applications,
      interviews,
      fitScores,
      reports,
      transcripts,
      aiTaskRuns,
      humanApprovals,
      funnel,
      timeToHire
    ] = await Promise.all([
      this.prisma.job.count({
        where: {
          tenantId,
          status: JobStatus.PUBLISHED
        }
      }),
      this.prisma.candidate.count({
        where: {
          tenantId
        }
      }),
      this.prisma.candidateApplication.findMany({
        where: {
          tenantId
        },
        select: {
          id: true,
          createdAt: true,
          currentStage: true,
          aiRecommendation: true
        }
      }),
      this.prisma.interviewSession.findMany({
        where: {
          tenantId
        },
        select: {
          id: true,
          applicationId: true,
          status: true,
          schedulingSource: true,
          scheduledAt: true,
          startedAt: true,
          endedAt: true,
          createdAt: true
        }
      }),
      this.prisma.applicantFitScore.findMany({
        where: {
          tenantId
        },
        select: {
          applicationId: true,
          overallScore: true,
          confidence: true,
          createdAt: true
        }
      }),
      this.prisma.aiReport.findMany({
        where: {
          tenantId
        },
        select: {
          applicationId: true,
          sessionId: true,
          confidence: true,
          createdAt: true
        }
      }),
      this.prisma.transcript.findMany({
        where: {
          tenantId,
          qualityScore: {
            not: null
          }
        },
        select: {
          qualityScore: true
        }
      }),
      this.prisma.aiTaskRun.findMany({
        where: {
          tenantId
        },
        select: {
          applicationId: true,
          sessionId: true,
          taskType: true,
          status: true,
          startedAt: true,
          completedAt: true,
          createdAt: true
        }
      }),
      this.prisma.humanApproval.findMany({
        where: {
          tenantId,
          actionType: "application.decision",
          entityType: "CandidateApplication"
        },
        orderBy: {
          approvedAt: "desc"
        },
        select: {
          entityId: true,
          metadata: true
        }
      }),
      this.funnel(tenantId),
      this.timeToHire(tenantId)
    ]);

    const applicationsById = new Map(
      applications.map((application) => [application.id, application])
    );
    const latestHumanDecisionByApplicationId = new Map<
      string,
      "advance" | "hold" | "reject" | null
    >();

    for (const approval of humanApprovals) {
      if (latestHumanDecisionByApplicationId.has(approval.entityId)) {
        continue;
      }

      latestHumanDecisionByApplicationId.set(
        approval.entityId,
        readHumanDecision(approval.metadata)
      );
    }

    const totalApplications = applications.length;
    const activePipelineApplications = applications.filter(
      (application) =>
        application.currentStage !== ApplicationStage.REJECTED &&
        application.currentStage !== ApplicationStage.HIRED
    ).length;
    const hiredApplications = applications.filter(
      (application) => application.currentStage === ApplicationStage.HIRED
    ).length;

    const interviewApplicationIds = new Set(interviews.map((session) => session.applicationId));
    const completedInterviews = interviews.filter(
      (session) => session.status === InterviewSessionStatus.COMPLETED
    );
    const noShowInterviews = interviews.filter(
      (session) => session.status === InterviewSessionStatus.NO_SHOW
    );
    const cancelledInterviews = interviews.filter(
      (session) => session.status === InterviewSessionStatus.CANCELLED
    );
    const failedInterviews = interviews.filter(
      (session) => session.status === InterviewSessionStatus.FAILED
    );
    const runningInterviews = interviews.filter(
      (session) => session.status === InterviewSessionStatus.RUNNING
    );
    const aiScheduledInterviews = interviews.filter(
      (session) =>
        Boolean(session.schedulingSource) && session.schedulingSource !== "manual_recruiter"
    );

    const interviewDurations = completedInterviews
      .map((session) => {
        if (!session.startedAt || !session.endedAt) {
          return null;
        }

        return diffInMinutes(session.startedAt, session.endedAt);
      })
      .filter((value): value is number => value !== null && value > 0);

    const fitScoresByApplication = new Map<
      string,
      {
        overallScore: number;
        confidence: number;
        createdAt: Date;
      }
    >();

    for (const fitScore of fitScores) {
      const existing = fitScoresByApplication.get(fitScore.applicationId);
      if (existing && existing.createdAt >= fitScore.createdAt) {
        continue;
      }

      fitScoresByApplication.set(fitScore.applicationId, {
        overallScore: Number(fitScore.overallScore),
        confidence: Number(fitScore.confidence),
        createdAt: fitScore.createdAt
      });
    }

    const latestFitScores = Array.from(fitScoresByApplication.values());
    const successfulScreeningTasks = aiTaskRuns.filter(
      (taskRun) =>
        taskRun.applicationId &&
        SCREENING_TASK_TYPES.includes(taskRun.taskType) &&
        taskRun.status === AiTaskStatus.SUCCEEDED
    );

    const screenedApplicationIds = new Set<string>([
      ...Array.from(fitScoresByApplication.keys()),
      ...successfulScreeningTasks
        .map((taskRun) => taskRun.applicationId)
        .filter((applicationId): applicationId is string => Boolean(applicationId))
    ]);

    const screeningTurnaroundMinutes = Array.from(screenedApplicationIds)
      .map((applicationId) => {
        const application = applicationsById.get(applicationId);
        if (!application) {
          return null;
        }

        const candidateMoments = [
          fitScoresByApplication.get(applicationId)?.createdAt ?? null,
          ...successfulScreeningTasks
            .filter((taskRun) => taskRun.applicationId === applicationId)
            .map((taskRun) => taskRun.completedAt ?? taskRun.createdAt)
        ].filter((value): value is Date => value instanceof Date);

        if (candidateMoments.length === 0) {
          return null;
        }

        const earliest = candidateMoments.sort((left, right) => left.getTime() - right.getTime())[0];
        if (!earliest) {
          return null;
        }

        return diffInMinutes(application.createdAt, earliest);
      })
      .filter((value): value is number => value !== null);

    const timeToInterviewDays = Array.from(interviewApplicationIds)
      .map((applicationId) => {
        const application = applicationsById.get(applicationId);
        if (!application) {
          return null;
        }

        const firstInterviewMoment = interviews
          .filter((session) => session.applicationId === applicationId)
          .map((session) => session.scheduledAt ?? session.createdAt)
          .sort((left, right) => left.getTime() - right.getTime())[0];

        if (!firstInterviewMoment) {
          return null;
        }

        return diffInDays(application.createdAt, firstInterviewMoment);
      })
      .filter((value): value is number => value !== null);

    const reportsBySession = new Map<
      string,
      {
        applicationId: string;
        sessionId: string;
        confidence: number;
        createdAt: Date;
      }
    >();

    for (const report of reports) {
      const existing = reportsBySession.get(report.sessionId);
      if (existing && existing.createdAt >= report.createdAt) {
        continue;
      }

      reportsBySession.set(report.sessionId, {
        applicationId: report.applicationId,
        sessionId: report.sessionId,
        confidence: Number(report.confidence),
        createdAt: report.createdAt
      });
    }

    const latestReports = Array.from(reportsBySession.values());

    const transcriptQualityAverage = average(
      transcripts
        .map((transcript) =>
          transcript.qualityScore === null ? null : Number(transcript.qualityScore)
        )
        .filter((value): value is number => value !== null),
      3
    );

    const reportConfidenceAverage = average(
      latestReports.map((report) => report.confidence),
      3
    );

    const terminalAiTasks = aiTaskRuns.filter((taskRun) =>
      TERMINAL_AI_TASK_STATUSES.includes(taskRun.status)
    );
    const successfulAiTaskCount = terminalAiTasks.filter(
      (taskRun) => taskRun.status === AiTaskStatus.SUCCEEDED
    ).length;

    const reportSessionIds = new Set(latestReports.map((report) => report.sessionId));
    const aiRecommendedApplications = applications.filter(
      (application) => application.aiRecommendation !== null
    );
    const humanReviewedApplications = aiRecommendedApplications.filter((application) =>
      latestHumanDecisionByApplicationId.get(application.id) !== null
    );
    const comparableRecommendations = humanReviewedApplications.filter((application) =>
      expectedHumanDecision(application.aiRecommendation) !== null
    );
    const agreedRecommendations = comparableRecommendations.filter((application) => {
      const expectedDecision = expectedHumanDecision(application.aiRecommendation);
      const actualDecision = latestHumanDecisionByApplicationId.get(application.id);
      return Boolean(expectedDecision) && expectedDecision === actualDecision;
    });
    const advanceRecommendations = humanReviewedApplications.filter(
      (application) => application.aiRecommendation === Recommendation.ADVANCE
    );
    const holdRecommendations = humanReviewedApplications.filter(
      (application) => application.aiRecommendation === Recommendation.HOLD
    );
    const acceptedAdvanceRecommendations = advanceRecommendations.filter(
      (application) => latestHumanDecisionByApplicationId.get(application.id) === "advance"
    );
    const acceptedHoldRecommendations = holdRecommendations.filter(
      (application) => latestHumanDecisionByApplicationId.get(application.id) === "hold"
    );
    const reviewRecommendations = aiRecommendedApplications.filter(
      (application) => application.aiRecommendation === Recommendation.REVIEW
    );
    const resolvedReviewRecommendations = reviewRecommendations.filter(
      (application) => latestHumanDecisionByApplicationId.get(application.id) !== null
    );

    const applied = funnel.find((item) => item.stage === ApplicationStage.APPLIED)?.count ?? 0;
    const screening = funnel.find((item) => item.stage === ApplicationStage.SCREENING)?.count ?? 0;
    const interview = funnel.find((item) => item.stage === ApplicationStage.INTERVIEW_SCHEDULED)?.count ?? 0;
    const review =
      (funnel.find((item) => item.stage === ApplicationStage.RECRUITER_REVIEW)?.count ?? 0) +
      (funnel.find((item) => item.stage === ApplicationStage.HIRING_MANAGER_REVIEW)?.count ?? 0);
    const offer = funnel.find((item) => item.stage === ApplicationStage.OFFER)?.count ?? 0;
    const rejected = funnel.find((item) => item.stage === ApplicationStage.REJECTED)?.count ?? 0;
    const hired = funnel.find((item) => item.stage === ApplicationStage.HIRED)?.count ?? 0;

    const estimatedScreeningHoursSaved = Number(
      (
        (screenedApplicationIds.size * ESTIMATED_MANUAL_MINUTES.screeningPerApplication) /
        60
      ).toFixed(1)
    );
    const estimatedInterviewHoursSaved = Number(
      (
        (latestReports.length * ESTIMATED_MANUAL_MINUTES.interviewAnalysisPerSession) /
        60
      ).toFixed(1)
    );
    const estimatedSchedulingHoursSaved = Number(
      (
        (aiScheduledInterviews.length * ESTIMATED_MANUAL_MINUTES.schedulingPerSession) /
        60
      ).toFixed(1)
    );

    return {
      generatedAt: new Date().toISOString(),
      overview: {
        publishedJobs,
        totalCandidates,
        totalApplications,
        activePipelineApplications,
        interviewedApplications: interviewApplicationIds.size,
        hiredApplications
      },
      pipeline: {
        funnel,
        conversion: {
          shortlistRate: percentage(screening + interview + review + offer + hired, totalApplications),
          interviewRate: percentage(interview + review + offer + hired, totalApplications),
          offerRate: percentage(offer + hired, totalApplications),
          hireRate: percentage(hired, totalApplications),
          rejectionRate: percentage(rejected, totalApplications)
        },
        velocity: {
          averageScreeningTurnaroundMinutes: average(screeningTurnaroundMinutes, 1),
          averageTimeToInterviewDays: average(timeToInterviewDays, 2),
          timeToHire
        }
      },
      interviews: {
        total: interviews.length,
        completed: completedInterviews.length,
        running: runningInterviews.length,
        cancelled: cancelledInterviews.length,
        noShow: noShowInterviews.length,
        failed: failedInterviews.length,
        aiScheduled: aiScheduledInterviews.length,
        completionRate: percentage(completedInterviews.length, interviews.length),
        noShowRate: percentage(noShowInterviews.length, interviews.length),
        aiSchedulingRate: percentage(aiScheduledInterviews.length, interviews.length),
        avgDurationMinutes: average(interviewDurations, 1),
        medianDurationMinutes: median(interviewDurations, 1)
      },
      ai: {
        screeningCoverageCount: screenedApplicationIds.size,
        screeningCoverageRate: percentage(screenedApplicationIds.size, totalApplications),
        fitScoreAverage: average(
          latestFitScores.map((fitScore) => fitScore.overallScore),
          1
        ),
        fitScoreConfidenceAverage: average(
          latestFitScores.map((fitScore) => fitScore.confidence),
          3
        ),
        reportCount: latestReports.length,
        reportCoverageRate: percentage(reportSessionIds.size, completedInterviews.length),
        reportConfidenceAverage,
        transcriptQualityAverage,
        aiTaskSuccessRate:
          terminalAiTasks.length > 0
            ? percentage(successfulAiTaskCount, terminalAiTasks.length)
            : null,
        calibration: {
          recommendedCount: aiRecommendedApplications.length,
          humanReviewedCount: humanReviewedApplications.length,
          humanDecisionCoverageRate: nullablePercentage(
            humanReviewedApplications.length,
            aiRecommendedApplications.length
          ),
          comparableDecisionCount: comparableRecommendations.length,
          agreementRate: nullablePercentage(
            agreedRecommendations.length,
            comparableRecommendations.length
          ),
          advanceAcceptanceRate: nullablePercentage(
            acceptedAdvanceRecommendations.length,
            advanceRecommendations.length
          ),
          holdAcceptanceRate: nullablePercentage(
            acceptedHoldRecommendations.length,
            holdRecommendations.length
          ),
          reviewRecommendationCount: reviewRecommendations.length,
          resolvedReviewRecommendationRate: nullablePercentage(
            resolvedReviewRecommendations.length,
            reviewRecommendations.length
          )
        },
        estimatedTimeSavedHours: {
          screening: estimatedScreeningHoursSaved,
          interviewAnalysis: estimatedInterviewHoursSaved,
          scheduling: estimatedSchedulingHoursSaved,
          total: Number(
            (
              estimatedScreeningHoursSaved +
              estimatedInterviewHoursSaved +
              estimatedSchedulingHoursSaved
            ).toFixed(1)
          )
        }
      },
      definitions: {
        timeToHire:
          "Başvuru oluşturulma tarihi ile adayın HIRED aşamasına geçtiği tarih arasındaki fark.",
        reportConfidence:
          "AI raporu üretildiğinde modelin kanıt kapsamına göre oluşturduğu güven skorunun ortalaması.",
        calibrationAgreement:
          "AI'nin ADVANCE veya HOLD önerisi verdiği ve insan kararının kaydedildiği dosyalarda yön uyum oranı.",
        humanDecisionCoverage:
          "AI önerisi olan başvurularda insan kararının da kaydedilmiş olma oranı.",
        timeSaved:
          "Tahmini kazanç; screening için 8 dk/başvuru, mülakat analizi için 18 dk/oturum ve planlama için 10 dk/oturum varsayımıyla hesaplanır."
      },
      workload: {
        applied,
        screening,
        interview,
        review,
        offer,
        hired,
        rejected
      }
    };
  }
}
