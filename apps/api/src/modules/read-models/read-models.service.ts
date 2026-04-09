import { Injectable, NotFoundException, Inject} from "@nestjs/common";
import { AiTaskType, type ApplicationStage } from "@prisma/client";
import { AiOrchestrationService } from "../ai-orchestration/ai-orchestration.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { AuditService } from "../audit/audit.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { deriveInterviewInvitationState } from "../interviews/interview-invitation-state.util";
import { InterviewsService } from "../interviews/interviews.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { RecommendationsService } from "../recommendations/recommendations.service";
import { ReportsService } from "../reports/reports.service";
import { ScreeningService } from "../screening/screening.service";
import { SpeechRuntimeService } from "../speech/speech-runtime.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";

const AI_SUPPORT_FLAG_KEYS = [
  "ai.cv_parsing.enabled",
  "ai.applicant_fit_scoring.enabled",
  "ai.screening_support.enabled",
  "ai.report_generation.enabled",
  "ai.recommendation_generation.enabled",
  "ai.system_triggers.application_created.screening_support.enabled",
  "ai.system_triggers.stage_review_pack.enabled",
  "ai.system_triggers.interview_completed.review_pack.enabled",
  "ai.auto_reject.enabled"
] as const;

function readHumanDecision(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const decision = (metadata as Record<string, unknown>).decision;
  return decision === "advance" || decision === "hold" || decision === "reject"
    ? decision
    : null;
}

@Injectable()
export class ReadModelsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService,
    @Inject(ScreeningService) private readonly screeningService: ScreeningService,
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(RecommendationsService) private readonly recommendationsService: RecommendationsService,
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService,
    @Inject(IntegrationsService) private readonly integrationsService: IntegrationsService,
    @Inject(SpeechRuntimeService) private readonly speechRuntimeService: SpeechRuntimeService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  async recruiterOverview(tenantId: string) {
    const [
      jobs,
      candidateCount,
      applications,
      funnel,
      timeToHire,
      interviewQuality
    ] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          tenantId,
          archivedAt: null
        },
        select: {
          id: true,
          status: true
        }
      }),
      this.prisma.candidate.count({
        where: {
          tenantId,
          deletedAt: null
        }
      }),
      this.prisma.candidateApplication.findMany({
        where: {
          tenantId
        },
        include: {
          candidate: {
            select: {
              fullName: true
            }
          },
          job: {
            select: {
              title: true
            }
          },
          aiReports: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            select: {
              id: true
            }
          },
          recommendations: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            select: {
              id: true
            }
          },
          aiTaskRuns: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            where: {
              taskType: {
              in: [
                  AiTaskType.CV_PARSING,
                  AiTaskType.APPLICANT_FIT_SCORING,
                  AiTaskType.SCREENING_SUPPORT,
                  AiTaskType.REPORT_GENERATION,
                  AiTaskType.RECOMMENDATION_GENERATION
                ]
              }
            },
            select: {
              id: true,
              status: true,
              taskType: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100
      }),
      this.analyticsService.funnel(tenantId),
      this.analyticsService.timeToHire(tenantId),
      this.analyticsService.interviewQuality(tenantId)
    ]);

    return {
      kpis: {
        publishedJobs: jobs.filter((job) => job.status === "PUBLISHED").length,
        totalCandidates: candidateCount,
        activeApplications: applications.length,
        avgReportConfidence: interviewQuality.reportConfidenceAvg
      },
      pipeline: funnel,
      metrics: {
        timeToHire,
        interviewQuality
      },
      scenarios: applications.slice(0, 30).map((application) => {
        const hasReport = application.aiReports.length > 0;
        const hasRecommendation = application.recommendations.length > 0;
        const latestTask = application.aiTaskRuns[0] ?? null;

        return {
          applicationId: application.id,
          candidateName: application.candidate.fullName,
          jobTitle: application.job.title,
          stage: application.currentStage,
          aiState: {
            hasReport,
            hasRecommendation,
            latestTaskType: latestTask?.taskType ?? null,
            latestTaskStatus: latestTask?.status ?? null,
            label:
              hasReport && hasRecommendation
                ? "report_and_recommendation_ready"
                : latestTask
                  ? "ai_task_activity_present"
                  : "ai_not_executed"
          }
        };
      })
    };
  }

  async recruiterApplications(
    tenantId: string,
    filters?: {
      stage?: ApplicationStage;
      jobId?: string;
    }
  ) {
    const applications = await this.prisma.candidateApplication.findMany({
      where: {
        tenantId,
        ...(filters?.stage ? { currentStage: filters.stage } : {}),
        ...(filters?.jobId ? { jobId: filters.jobId } : {})
      },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        job: {
          select: {
            id: true,
            title: true,
            status: true
          }
        },
        aiReports: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            confidence: true,
            createdAt: true
          }
        },
        recommendations: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            recommendation: true,
            confidence: true,
            createdAt: true
          }
        },
        aiTaskRuns: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          where: {
            taskType: {
              in: [
                AiTaskType.CV_PARSING,
                AiTaskType.APPLICANT_FIT_SCORING,
                AiTaskType.SCREENING_SUPPORT,
                AiTaskType.REPORT_GENERATION,
                AiTaskType.RECOMMENDATION_GENERATION
              ]
            }
          },
          select: {
            id: true,
            taskType: true,
            status: true,
            createdAt: true
          }
        },
        interviewSessions: {
          orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            mode: true,
            scheduledAt: true,
            schedulingSource: true,
            invitationStatus: true,
            invitationIssuedAt: true,
            invitationReminderCount: true,
            invitationReminder1SentAt: true,
            invitationReminder2SentAt: true,
            candidateAccessExpiresAt: true,
            meetingProvider: true,
            meetingProviderSource: true,
            runtimeProviderMode: true,
            voiceInputProvider: true,
            voiceOutputProvider: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 200
    });

    const applicationIds = applications.map((application) => application.id);
    const approvals = applicationIds.length > 0
      ? await this.prisma.humanApproval.findMany({
          where: {
            tenantId,
            actionType: "application.decision",
            entityType: "CandidateApplication",
            entityId: { in: applicationIds }
          },
          orderBy: {
            approvedAt: "desc"
          }
        })
      : [];
    const latestHumanDecisionByApplicationId = new Map<string, "advance" | "hold" | "reject" | null>();
    for (const approval of approvals) {
      if (latestHumanDecisionByApplicationId.has(approval.entityId)) {
        continue;
      }
      latestHumanDecisionByApplicationId.set(approval.entityId, readHumanDecision(approval.metadata));
    }

    return {
      total: applications.length,
      items: applications.map((application) => {
        const report = application.aiReports[0] ?? null;
        const recommendation = application.recommendations[0] ?? null;
        const latestTask = application.aiTaskRuns[0] ?? null;
        const latestInterview = application.interviewSessions[0] ?? null;
        const invitation = deriveInterviewInvitationState(latestInterview);

        return {
          id: application.id,
          stage: application.currentStage,
          aiRecommendation: application.aiRecommendation,
          humanDecision: latestHumanDecisionByApplicationId.get(application.id) ?? null,
          stageUpdatedAt: application.stageUpdatedAt,
          createdAt: application.createdAt,
          humanDecisionRequired: application.humanDecisionRequired,
          candidate: application.candidate,
          job: application.job,
          ai: {
            hasReport: Boolean(report),
            reportId: report?.id ?? null,
            reportConfidence: report?.confidence ?? null,
            latestRecommendation: recommendation,
            latestTask
          },
          interview: latestInterview
            ? {
                id: latestInterview.id,
                status: latestInterview.status,
                mode: latestInterview.mode,
                scheduledAt: latestInterview.scheduledAt,
                schedulingSource: latestInterview.schedulingSource,
                invitation,
                meetingProvider: latestInterview.meetingProvider,
                meetingProviderSource: latestInterview.meetingProviderSource,
                runtimeProviderMode: latestInterview.runtimeProviderMode,
                voiceInputProvider: latestInterview.voiceInputProvider,
                voiceOutputProvider: latestInterview.voiceOutputProvider
              }
            : null
        };
      })
    };
  }

  async applicationDetail(tenantId: string, applicationId: string) {
    const baseApplication = await this.prisma.candidateApplication.findFirst({
      where: {
        id: applicationId,
        tenantId
      },
      include: {
        candidate: {
          include: {
            cvFiles: {
              include: {
                parsedProfile: true
              },
              orderBy: {
                uploadedAt: "desc"
              },
              take: 3
            }
          }
        },
        job: true,
        stageHistory: {
          orderBy: {
            changedAt: "desc"
          }
        }
      }
    });

    if (!baseApplication) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    const [screeningRuns, reports, recommendations, interviewSessions, aiTaskRuns, auditLogs, sourcingAttachment] =
      await Promise.all([
        this.screeningService.listByApplication(tenantId, applicationId, 10),
        this.reportsService.listByApplication(tenantId, applicationId, 10),
        this.recommendationsService.listByApplication(tenantId, applicationId, 10),
        this.interviewsService.listByApplication(tenantId, applicationId),
        this.prisma.aiTaskRun.findMany({
          where: {
            tenantId,
            applicationId
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 30
        }),
        this.auditService.list(tenantId, "CandidateApplication", applicationId, 100),
        this.prisma.sourcingProjectProspect.findFirst({
          where: {
            tenantId,
            attachedApplicationId: applicationId
          },
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            },
            talentProfile: {
              select: {
                primarySourceLabel: true,
                sourceRecords: {
                  orderBy: { createdAt: "desc" },
                  take: 3,
                  select: {
                    providerLabel: true
                  }
                }
              }
            },
            outreachMessages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
                subject: true,
                sentAt: true,
                repliedAt: true,
                reviewNote: true,
                sendError: true
              }
            }
          },
          orderBy: { updatedAt: "desc" }
        })
      ]);

    const sessionIds = interviewSessions.map((session) => session.id);
    const transcriptIds = interviewSessions
      .map((session) => session.transcript?.id ?? null)
      .filter((value): value is string => Boolean(value));

    const [interviewAuditLogs, interviewDomainEvents] =
      sessionIds.length > 0
        ? await Promise.all([
            this.prisma.auditLog.findMany({
              where: {
                tenantId,
                OR: [
                  {
                    entityType: "InterviewSession",
                    entityId: {
                      in: sessionIds
                    }
                  },
                  ...(transcriptIds.length > 0
                    ? [
                        {
                          entityType: "Transcript",
                          entityId: {
                            in: transcriptIds
                          }
                        }
                      ]
                    : [])
                ]
              },
              orderBy: {
                createdAt: "desc"
              },
              take: 120
            }),
            this.prisma.domainEvent.findMany({
              where: {
                tenantId,
                OR: [
                  {
                    aggregateType: "InterviewSession",
                    aggregateId: {
                      in: sessionIds
                    }
                  },
                  ...(transcriptIds.length > 0
                    ? [
                        {
                          aggregateType: "Transcript",
                          aggregateId: {
                            in: transcriptIds
                          }
                        }
                      ]
                    : [])
                ]
              },
              orderBy: {
                createdAt: "desc"
              },
              take: 120
            })
          ])
        : [[], []];

    const recommendationIds = recommendations.map((item) => item.id);
    const aiTaskRunIds = aiTaskRuns.map((item) => item.id);

    const humanApprovals = await this.prisma.humanApproval.findMany({
      where: {
        tenantId,
        OR: [
          {
            entityType: "CandidateApplication",
            entityId: baseApplication.id
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
      take: 40
    });
    const latestHumanDecision =
      humanApprovals
        .map((approval) => readHumanDecision(approval.metadata))
        .find((decision) => decision !== null) ?? null;

    const mappedSessions = interviewSessions.map((session) => ({
      id: session.id,
      applicationId: session.applicationId,
      templateId: session.templateId,
      status: session.status,
      mode: session.mode,
      scheduledAt: session.scheduledAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      cancelledAt: session.cancelledAt,
      cancelReasonCode: session.cancelReasonCode,
      scheduleNote: session.scheduleNote,
      scheduledBy: session.scheduledBy,
      interviewerName: session.interviewerName,
      interviewerUserId: session.interviewerUserId,
      interviewType: session.interviewType,
      modeContextJson: session.modeContextJson,
      meetingProvider: session.meetingProvider,
      meetingProviderSource: session.meetingProviderSource,
      meetingConnectionId: session.meetingConnectionId,
      meetingJoinUrl: session.meetingJoinUrl,
      meetingExternalRef: session.meetingExternalRef,
      meetingCalendarEventRef: session.meetingCalendarEventRef,
      candidateAccessToken: session.candidateAccessToken,
      candidateAccessExpiresAt: session.candidateAccessExpiresAt,
      candidateInterviewUrl: session.candidateInterviewUrl,
      invitation: session.invitation,
      candidateLocale: session.candidateLocale,
      runtimeMode: session.runtimeMode,
      runtimeProviderMode: session.runtimeProviderMode,
      voiceInputProvider: session.voiceInputProvider,
      voiceOutputProvider: session.voiceOutputProvider,
      currentQuestionIndex: session.currentQuestionIndex,
      currentFollowUpCount: session.currentFollowUpCount,
      currentQuestionKey: session.currentQuestionKey,
      completedReasonCode: session.completedReasonCode,
      abandonedAt: session.abandonedAt,
      rescheduleCount: session.rescheduleCount,
      lastRescheduledAt: session.lastRescheduledAt,
      lastRescheduledBy: session.lastRescheduledBy,
      lastRescheduleReasonCode: session.lastRescheduleReasonCode,
      rubricKey: session.rubricKey,
      rubricVersion: session.rubricVersion,
      template: {
        id: session.template.id,
        name: session.template.name,
        version: session.template.version,
        roleFamily: session.template.roleFamily
      },
      transcript: session.transcript
        ? {
            id: session.transcript.id,
            qualityStatus: session.transcript.qualityStatus,
            qualityScore: session.transcript.qualityScore,
            qualityReviewedAt: session.transcript.qualityReviewedAt,
            qualityReviewedBy: session.transcript.qualityReviewedBy,
            finalizedAt: session.transcript.finalizedAt,
            ownerType: session.transcript.ownerType,
            ownerId: session.transcript.ownerId,
            ingestionMethod: session.transcript.ingestionMethod,
            ingestionStatus: session.transcript.ingestionStatus,
            reviewNotes: session.transcript.reviewNotes,
            lastIngestedAt: session.transcript.lastIngestedAt,
            segmentCount: session.transcript.segmentCount,
            previewSegments: session.transcript.previewSegments
          }
        : null,
      turns: session.turns,
      activeTurn: session.activeTurn,
      progress: session.progress,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }));

    const latestInterview = mappedSessions[0] ?? null;
    const fitScoreRuns = aiTaskRuns.filter((taskRun) => taskRun.taskType === AiTaskType.APPLICANT_FIT_SCORING);

    return {
      summary: {
        id: baseApplication.id,
        stage: baseApplication.currentStage,
        stageUpdatedAt: baseApplication.stageUpdatedAt,
        createdAt: baseApplication.createdAt,
        aiRecommendation: baseApplication.aiRecommendation,
        humanDecision: latestHumanDecision,
        humanDecisionRequired: baseApplication.humanDecisionRequired
      },
      candidate: {
        id: baseApplication.candidate.id,
        fullName: baseApplication.candidate.fullName,
        phone: baseApplication.candidate.phone,
        email: baseApplication.candidate.email,
        source: baseApplication.candidate.source,
        externalSource: baseApplication.candidate.externalSource,
        externalRef: baseApplication.candidate.externalRef,
        sourcing: sourcingAttachment
          ? {
              projectId: sourcingAttachment.project.id,
              projectName: sourcingAttachment.project.name,
              prospectId: sourcingAttachment.id,
              stage: sourcingAttachment.stage,
              primarySourceLabel: sourcingAttachment.talentProfile.primarySourceLabel ?? null,
              sourceLabels: [...new Set(
                sourcingAttachment.talentProfile.sourceRecords
                  .map((record) => record.providerLabel?.trim())
                  .filter((label): label is string => Boolean(label))
              )],
              latestOutreach: sourcingAttachment.outreachMessages[0]
                ? {
                    status: sourcingAttachment.outreachMessages[0].status,
                    subject: sourcingAttachment.outreachMessages[0].subject,
                    sentAt: sourcingAttachment.outreachMessages[0].sentAt?.toISOString() ?? null,
                    repliedAt: sourcingAttachment.outreachMessages[0].repliedAt?.toISOString() ?? null,
                    reviewNote: sourcingAttachment.outreachMessages[0].reviewNote ?? null,
                    error: sourcingAttachment.outreachMessages[0].sendError ?? null
                  }
                : null
            }
          : null,
        cvFiles: baseApplication.candidate.cvFiles ?? []
      },
      job: {
        id: baseApplication.job.id,
        title: baseApplication.job.title,
        roleFamily: baseApplication.job.roleFamily,
        status: baseApplication.job.status
      },
      artifacts: {
        screeningRuns,
        latestScreeningRun: screeningRuns[0] ?? null,
        fitScoreRuns,
        latestFitScoreRun: fitScoreRuns[0] ?? null,
        reports,
        recommendations,
        taskRuns: aiTaskRuns
      },
      interview: {
        latestSession: latestInterview,
        sessions: mappedSessions,
        timeline: {
          auditLogs: interviewAuditLogs,
          domainEvents: interviewDomainEvents
        }
      },
      governance: {
        auditLogs,
        humanApprovals
      },
      timeline: {
        stageHistory: baseApplication.stageHistory,
        humanApprovals
      }
    };
  }

  async aiSupportCenter(tenantId: string) {
    const [flags, taskRuns, providerStatus, integrationConnections, extractionProfiles] =
      await Promise.all([
      this.featureFlagsService.list(tenantId),
      this.prisma.aiTaskRun.findMany({
        where: {
          tenantId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 50,
        select: {
          id: true,
          taskType: true,
          status: true,
          providerKey: true,
          errorMessage: true,
          applicationId: true,
          candidateId: true,
          jobId: true,
          createdAt: true
        }
      }),
      this.aiOrchestrationService.getProviderStatus(),
      this.integrationsService.listConnections(tenantId),
      this.prisma.cVParsedProfile.findMany({
        where: {
          tenantId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        select: {
          extractionStatus: true,
          extractionMethod: true,
          providerMode: true,
          providerKey: true,
          modelKey: true,
          createdAt: true
        }
      })
    ]);

    const selectedFlags = AI_SUPPORT_FLAG_KEYS.map((key) => flags.find((flag) => flag.key === key)).filter(
      Boolean
    );
    const extractionStats = extractionProfiles.reduce(
      (acc, profile) => {
        const statusKey = profile.extractionStatus;
        acc.byStatus[statusKey] = (acc.byStatus[statusKey] ?? 0) + 1;
        const methodKey = profile.extractionMethod;
        acc.byMethod[methodKey] = (acc.byMethod[methodKey] ?? 0) + 1;
        return acc;
      },
      {
        byStatus: {} as Record<string, number>,
        byMethod: {} as Record<string, number>
      }
    );

    return {
      providers: providerStatus.providers.map((item) => item.key),
      providerStatus,
      flags: selectedFlags,
      speech: this.speechRuntimeService.getProviderStatus(),
      integrations: integrationConnections,
      extraction: extractionStats,
      taskRuns: taskRuns.map((run) => ({
        id: run.id,
        taskType: run.taskType,
        status: run.status,
        providerKey: run.providerKey,
        errorMessage: run.errorMessage,
        scope: run.applicationId
          ? `application:${run.applicationId}`
          : run.candidateId
            ? `candidate:${run.candidateId}`
            : run.jobId
              ? `job:${run.jobId}`
              : "-",
        createdAt: run.createdAt
      }))
    };
  }

  async providerHealthDashboard(tenantId: string) {
    const [connections, providerStatus, speechStatus, startupValidation] = await Promise.all([
      this.integrationsService.listConnections(tenantId),
      this.aiOrchestrationService.getProviderStatus(),
      this.speechRuntimeService.getProviderStatus(),
      Promise.resolve(this.runtimeConfig.validateAtStartup())
    ]);

    const runtimeProviders = Object.entries(startupValidation.providers).map(([key, val]) => ({
      key,
      ready: val.ready,
      reason: val.mode === "fallback" ? "fallback" : null
    }));

    const connectionWarnings = connections.flatMap((conn) => {
      switch (conn.effectiveStatus) {
        case "unsupported_provider":
          return [`${conn.provider} launch icin henuz desteklenmiyor.`];
        case "missing_config":
          return [`${conn.provider} baglantisi icin zorunlu konfigurasyon eksik.`];
        case "needs_auth":
          return [`${conn.provider} baglantisi yetkilendirme bekliyor.`];
        case "missing_credentials":
          return [`${conn.provider} baglantisi kimlik bilgisi bekliyor.`];
        default:
          return [];
      }
    });

    const integrations = connections.map((conn) => ({
      provider: conn.provider,
      status:
        conn.status === "ERROR"
          ? "ERROR"
          : conn.status === "INACTIVE"
            ? "INACTIVE"
            : conn.effectiveStatus === "configured"
              ? "ACTIVE"
              : "DEGRADED",
      displayName: conn.displayName,
      lastError: conn.lastError ?? conn.credentialLastError ?? null
    }));

    return {
      overall: startupValidation.healthy ? "healthy" : "degraded",
      warnings: Array.from(new Set([...startupValidation.warnings, ...connectionWarnings])),
      ai: {
        providers: providerStatus.providers.map((p) => ({ key: p.key, available: p.active })),
        activeProvider: providerStatus.providers.find((p) => p.active)?.key ?? null
      },
      speech: speechStatus,
      integrations,
      runtimeProviders
    };
  }

  async infrastructureReadiness(tenantId: string) {
    const [aiSupport, integrations, latestSessions, schedulingWorkflows, notificationStats] = await Promise.all([
      this.aiSupportCenter(tenantId),
      this.integrationsService.listConnections(tenantId),
      this.prisma.interviewSession.findMany({
        where: {
          tenantId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 40,
        select: {
          id: true,
          runtimeProviderMode: true,
          voiceInputProvider: true,
          voiceOutputProvider: true,
          schedulingSource: true,
          meetingProvider: true,
          meetingProviderSource: true,
          mode: true,
          status: true,
          updatedAt: true
        }
      }),
      this.prisma.schedulingWorkflow.groupBy({
        by: ["state"],
        where: { tenantId },
        _count: { id: true }
      }).catch(() => [] as Array<{ state: string; _count: { id: number } }>),
      this.prisma.notificationDelivery.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { id: true }
      }).catch(() => [] as Array<{ status: string; _count: { id: number } }>)
    ]);

    const startupValidation = this.runtimeConfig.validateAtStartup();

    const schedulingStats = schedulingWorkflows.reduce(
      (acc, row) => {
        acc[row.state] = row._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    const notificationDeliveryStats = notificationStats.reduce(
      (acc, row) => {
        acc[row.status] = row._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      runtime: this.runtimeConfig.providerReadiness,
      startupHealth: {
        healthy: startupValidation.healthy,
        warnings: startupValidation.warnings,
        providers: startupValidation.providers
      },
      ai: aiSupport.providerStatus,
      cvExtraction: aiSupport.extraction,
      speech: aiSupport.speech,
      integrations,
      scheduling: {
        workflowsByState: schedulingStats,
        totalWorkflows: Object.values(schedulingStats).reduce((a, b) => a + b, 0)
      },
      notifications: {
        deliveriesByStatus: notificationDeliveryStats,
        totalDeliveries: Object.values(notificationDeliveryStats).reduce((a, b) => a + b, 0)
      },
      sessions: latestSessions
    };
  }
}
