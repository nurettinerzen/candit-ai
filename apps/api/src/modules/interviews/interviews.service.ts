import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException, Inject} from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  ApplicationStage,
  AuditActorType,
  IntegrationConnectionStatus,
  IntegrationProvider,
  InterviewSessionStatus,
  TranscriptQualityStatus,
  type InterviewMode,
  type Prisma,
  type Speaker
} from "@prisma/client";
import { StructuredLoggerService } from "../../common/logging/structured-logger.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiOrchestrationService } from "../ai-orchestration/ai-orchestration.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { SpeechRuntimeService } from "../speech/speech-runtime.service";

const INTERVIEW_COMPLETION_REVIEW_PACK_FLAG =
  "ai.system_triggers.interview_completed.review_pack.enabled";

const MEETING_PROVIDERS = [
  IntegrationProvider.CALENDLY,
  IntegrationProvider.GOOGLE_MEET,
  IntegrationProvider.ZOOM,
  IntegrationProvider.GOOGLE_CALENDAR,
  IntegrationProvider.MICROSOFT_CALENDAR
] as const;

const INTERVIEW_SESSION_STALE_MINUTES = 45;
const ANSWER_TOO_SHORT_WORDS = 4;
const PUBLIC_SESSION_INCLUDE = {
  template: true,
  application: {
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true
        }
      },
      job: {
        select: {
          id: true,
          title: true,
          roleFamily: true
        }
      }
    }
  },
  transcript: {
    include: {
      segments: {
        orderBy: {
          startMs: "asc" as const
        },
        take: 300
      }
    }
  },
  turns: {
    orderBy: {
      sequenceNo: "asc" as const
    },
    take: 300
  }
} as const satisfies Prisma.InterviewSessionInclude;

type InterviewTemplateBlock = {
  key: string;
  questionKey: string;
  category: string;
  prompt: string;
  followUps: string[];
  maxFollowUps: number;
  minWords: number;
  required: boolean;
};

type NormalizedInterviewTemplate = {
  introPrompt: string;
  closingPrompt: string;
  blocks: InterviewTemplateBlock[];
};

type AnswerEvaluation = {
  isComplete: boolean;
  reason: string;
  quality: "high" | "medium" | "low";
};

function parseOptionalDate(raw?: string) {
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Tarih formati gecersiz.");
  }

  return parsed;
}

function toJsonValue(input?: Record<string, unknown>) {
  if (!input || Object.keys(input).length === 0) {
    return undefined;
  }

  return input as Prisma.InputJsonValue;
}

function sanitizeText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeText(item))
    .filter(Boolean);
}

function countWords(input: string) {
  const cleaned = sanitizeText(input);
  if (!cleaned) {
    return 0;
  }

  return cleaned.split(" ").filter(Boolean).length;
}

function nextSegmentWindow(lastEndMs: number | null) {
  const startMs = Math.max(0, (lastEndMs ?? 0) + 500);
  return {
    startMs,
    endMs: startMs + 6500
  };
}

function normalizeTranscriptText(input: string) {
  return input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseSpeakerFromLine(
  line: string,
  fallbackSpeaker: Speaker
): { speaker: Speaker; text: string } {
  const match = line.match(/^(AI|ADAY|CANDIDATE|RECRUITER|MULAKATCI|IK|SISTEM)\s*[:\-]\s*(.+)$/i);

  if (!match || !match[1] || !match[2]) {
    return {
      speaker: fallbackSpeaker,
      text: line
    };
  }

  const token = match[1].toUpperCase();
  const text = match[2].trim();

  if (token === "AI" || token === "SISTEM") {
    return { speaker: "AI", text };
  }

  if (token === "ADAY" || token === "CANDIDATE") {
    return { speaker: "CANDIDATE", text };
  }

  return { speaker: "RECRUITER", text };
}

type InterviewSessionRow = Prisma.InterviewSessionGetPayload<{
  include: {
    template: {
      select: {
        id: true;
        name: true;
        roleFamily: true;
        version: true;
        templateJson: true;
      };
    };
    transcript: {
      include: {
        segments: true;
      };
    };
    turns: {
      orderBy: {
        sequenceNo: "asc";
      };
      take: 80;
    };
  };
}>;

type PublicSessionRow = Prisma.InterviewSessionGetPayload<{
  include: typeof PUBLIC_SESSION_INCLUDE;
}>;

@Injectable()
export class InterviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService,
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(IntegrationsService) private readonly integrationsService: IntegrationsService,
    @Inject(SpeechRuntimeService) private readonly speechRuntimeService: SpeechRuntimeService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService
  ) {}

  async listSessions(
    tenantId: string,
    filters?: {
      applicationId?: string;
      status?: InterviewSessionStatus;
    }
  ) {
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        tenantId,
        ...(filters?.applicationId ? { applicationId: filters.applicationId } : {}),
        ...(filters?.status ? { status: filters.status } : {})
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            roleFamily: true,
            version: true,
            templateJson: true
          }
        },
        transcript: {
          include: {
            segments: {
              orderBy: {
                startMs: "asc"
              },
              take: 30
            }
          }
        },
        turns: {
          orderBy: {
            sequenceNo: "asc"
          },
          take: 80
        }
      },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      take: 100
    });

    return sessions.map((session) => this.toSessionView(session));
  }

  listByApplication(tenantId: string, applicationId: string) {
    return this.listSessions(tenantId, { applicationId });
  }

  async listTemplates(tenantId: string, roleFamily?: string) {
    const templates = await this.prisma.interviewTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(roleFamily ? { roleFamily } : {})
      },
      orderBy: [{ roleFamily: "asc" }, { version: "desc" }, { createdAt: "desc" }],
      take: 50
    });

    return templates.map((template) => {
      const normalized = (() => {
        try {
          return this.normalizeTemplate(template.templateJson);
        } catch {
          return {
            introPrompt: "",
            closingPrompt: "",
            blocks: []
          } satisfies NormalizedInterviewTemplate;
        }
      })();

      return {
        ...template,
        metadata: {
          blockCount: normalized.blocks.length,
          categories: Array.from(new Set(normalized.blocks.map((block) => block.category)))
        }
      };
    });
  }

  async listSchedulingProviders(tenantId: string) {
    const connections = await this.prisma.integrationConnection.findMany({
      where: {
        tenantId,
        status: IntegrationConnectionStatus.ACTIVE,
        provider: {
          in: [...MEETING_PROVIDERS]
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        configJson: true,
        updatedAt: true
      }
    });

    return {
      providers: connections.map((connection) => ({
        provider: connection.provider,
        connectionId: connection.id,
        displayName: connection.displayName,
        hasMeetingUrlTemplate: (() => {
          const config = connection.configJson as Record<string, unknown>;
          if (connection.provider === IntegrationProvider.CALENDLY) {
            return (
              typeof config.schedulingUrl === "string" ||
              typeof config.schedulingUrlTemplate === "string"
            );
          }

          return typeof config.baseMeetingUrl === "string";
        })(),
        updatedAt: connection.updatedAt
      })),
      fallback: {
        provider: null,
        source: "internal_fallback",
        label: "Dahili Meeting Link Fallback"
      }
    };
  }

  async getById(tenantId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        tenantId,
        id: sessionId
      },
      include: {
        template: true,
        application: {
          include: {
            candidate: true,
            job: true
          }
        },
        transcript: {
          include: {
            segments: {
              orderBy: {
                startMs: "asc"
              },
              take: 400
            }
          }
        },
        turns: {
          orderBy: {
            sequenceNo: "asc"
          },
          take: 300
        },
        aiReports: {
          orderBy: {
            createdAt: "desc"
          },
          take: 5,
          include: {
            evidenceLinks: {
              orderBy: {
                createdAt: "asc"
              },
              take: 20
            }
          }
        },
        recommendations: {
          orderBy: {
            createdAt: "desc"
          },
          take: 5
        },
        aiTaskRuns: {
          orderBy: {
            createdAt: "desc"
          },
          take: 20
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    return session;
  }

  async timeline(tenantId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        tenantId,
        id: sessionId
      },
      select: {
        id: true,
        transcript: {
          select: {
            id: true
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    const transcriptId = session.transcript?.id;

    const [audits, events] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
          OR: [
            {
              entityType: "InterviewSession",
              entityId: session.id
            },
            ...(transcriptId
              ? [
                  {
                    entityType: "Transcript",
                    entityId: transcriptId
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
              aggregateId: session.id
            },
            ...(transcriptId
              ? [
                  {
                    aggregateType: "Transcript",
                    aggregateId: transcriptId
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
    ]);

    return {
      sessionId: session.id,
      audits,
      events
    };
  }

  async schedule(input: {
    tenantId: string;
    applicationId: string;
    templateId?: string;
    mode: InterviewMode;
    scheduledAt?: string;
    interviewerName?: string;
    interviewerUserId?: string;
    interviewType?: string;
    schedulingSource?: string;
    scheduleNote?: string;
    modeContext?: Record<string, unknown>;
    notificationMetadata?: Record<string, unknown>;
    preferredProvider?: IntegrationProvider;
    requestedBy: string;
    traceId?: string;
  }) {
    const scheduledAt = parseOptionalDate(input.scheduledAt);

    if (!scheduledAt) {
      throw new BadRequestException("Interview planlama icin scheduledAt zorunludur.");
    }

    const [application, existingActiveSession] = await Promise.all([
      this.prisma.candidateApplication.findFirst({
        where: {
          id: input.applicationId,
          tenantId: input.tenantId
        },
        select: {
          id: true,
          currentStage: true,
          candidateId: true,
          jobId: true,
          candidate: {
            select: {
              fullName: true,
              email: true
            }
          },
          job: {
            select: {
              roleFamily: true,
              title: true
            }
          }
        }
      }),
      this.prisma.interviewSession.findFirst({
        where: {
          tenantId: input.tenantId,
          applicationId: input.applicationId,
          status: {
            in: [InterviewSessionStatus.SCHEDULED, InterviewSessionStatus.RUNNING]
          }
        },
        select: {
          id: true
        }
      })
    ]);

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    if (application.currentStage === ApplicationStage.REJECTED || application.currentStage === ApplicationStage.HIRED) {
      throw new BadRequestException("Reddedilen veya ise alinan basvuru icin interview planlanamaz.");
    }

    if (existingActiveSession) {
      throw new BadRequestException("Bu basvuru icin zaten aktif/schedule bir interview session mevcut.");
    }

    const template = await this.resolveTemplate({
      tenantId: input.tenantId,
      templateId: input.templateId,
      roleFamily: application.job.roleFamily
    });

    const candidateAccessToken = this.generateCandidateAccessToken();
    const candidateAccessExpiresAt = new Date(scheduledAt.getTime() + 72 * 60 * 60 * 1000);

    const session = await this.prisma.interviewSession.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        templateId: template.id,
        mode: input.mode,
        status: InterviewSessionStatus.SCHEDULED,
        scheduledBy: input.requestedBy,
        schedulingSource: input.schedulingSource ?? "manual_recruiter",
        scheduleNote: input.scheduleNote,
        interviewerName: input.interviewerName,
        interviewerUserId: input.interviewerUserId,
        interviewType: input.interviewType,
        modeContextJson: toJsonValue(input.modeContext),
        candidateAccessToken,
        candidateAccessExpiresAt,
        runtimeMode: "guided_voice_turn_v1",
        runtimeProviderMode: input.mode === "VOICE" ? "browser_native" : "external_meeting_mode",
        currentQuestionIndex: 0,
        currentFollowUpCount: 0,
        engineStateJson: {
          engineVersion: "voice_guided_v1",
          state: "scheduled"
        },
        rubricKey: `interview_template:${template.id}`,
        rubricVersion: template.version,
        scheduledAt
      }
    });

    const meetingContext =
      input.mode === "VOICE"
        ? {
            provider: null,
            connectionId: null,
            providerSource: "web_voice_session_v1",
            joinUrl: this.buildCandidateInterviewUrl(session.id, candidateAccessToken),
            externalRef: `voice-${session.id}`,
            calendarEventRef: null
          }
        : await this.integrationsService.resolveMeetingContext({
            tenantId: input.tenantId,
            sessionId: session.id,
            mode: input.mode,
            operation: "create",
            scheduledAt,
            preferredProvider: input.preferredProvider,
            candidateEmail: application.candidate.email,
            candidateName: application.candidate.fullName,
            interviewerName: input.interviewerName ?? null,
            title: `Interview - ${application.job.title}`,
            description:
              input.scheduleNote ?? `Interview session for application ${input.applicationId}`,
            timezone: "UTC",
            traceId: input.traceId
          });

    const updatedSession = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        meetingProvider: meetingContext.provider,
        meetingProviderSource: meetingContext.providerSource,
        meetingConnectionId: meetingContext.connectionId,
        meetingJoinUrl: meetingContext.joinUrl,
        meetingExternalRef: meetingContext.externalRef,
        meetingCalendarEventRef: meetingContext.calendarEventRef,
        sessionSummaryJson: {
          accessPath: input.mode === "VOICE" ? "candidate_public_web_link" : "meeting_link",
          candidateInterviewUrl:
            input.mode === "VOICE"
              ? this.buildCandidateInterviewUrl(session.id, candidateAccessToken)
              : null
        }
      }
    });

    await this.transitionApplicationStageIfNeeded({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      targetStage: ApplicationStage.INTERVIEW_SCHEDULED,
      changedBy: input.requestedBy,
      reasonCode: "interview_session_scheduled",
      traceId: input.traceId
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: updatedSession.id,
        eventType: "interview.session.scheduled",
        traceId: input.traceId,
        payload: {
          applicationId: input.applicationId,
          templateId: template.id,
          mode: updatedSession.mode,
          rubricKey: updatedSession.rubricKey,
          rubricVersion: updatedSession.rubricVersion,
          scheduledAt: updatedSession.scheduledAt?.toISOString() ?? null,
          meetingProvider: updatedSession.meetingProvider,
          meetingProviderSource: updatedSession.meetingProviderSource,
          meetingJoinUrl: updatedSession.meetingJoinUrl,
          notificationMetadata: toJsonValue(input.notificationMetadata) ?? null,
          requestedBy: input.requestedBy
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        actorType: AuditActorType.USER,
        action: "interview.session.scheduled",
        entityType: "InterviewSession",
        entityId: updatedSession.id,
        traceId: input.traceId,
        metadata: {
          applicationId: input.applicationId,
          templateId: template.id,
          mode: updatedSession.mode,
          scheduledAt: updatedSession.scheduledAt?.toISOString() ?? null,
          meetingProvider: updatedSession.meetingProvider,
          meetingProviderSource: updatedSession.meetingProviderSource,
          meetingConnectionId: updatedSession.meetingConnectionId,
          rubricKey: updatedSession.rubricKey,
          rubricVersion: updatedSession.rubricVersion
        }
      })
    ]);

    return this.getById(input.tenantId, updatedSession.id);
  }

  async reschedule(input: {
    tenantId: string;
    sessionId: string;
    scheduledAt: string;
    reasonCode?: string;
    schedulingSource?: string;
    scheduleNote?: string;
    modeContext?: Record<string, unknown>;
    preferredProvider?: IntegrationProvider;
    requestedBy: string;
    traceId?: string;
  }) {
    const scheduledAt = parseOptionalDate(input.scheduledAt);

    if (!scheduledAt) {
      throw new BadRequestException("Reschedule icin scheduledAt zorunludur.");
    }

    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        application: {
          select: {
            id: true,
            candidate: {
              select: {
                fullName: true,
                email: true
              }
            },
            job: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status === InterviewSessionStatus.COMPLETED || session.status === InterviewSessionStatus.CANCELLED) {
      throw new BadRequestException(`Session su durumda oldugu icin yeniden planlanamaz: ${session.status}`);
    }

    if (session.status === InterviewSessionStatus.RUNNING) {
      throw new BadRequestException("RUNNING durumundaki session yeniden planlanamaz.");
    }

    const existingToken = session.candidateAccessToken ?? this.generateCandidateAccessToken();
    const meetingContext =
      session.mode === "VOICE"
        ? {
            provider: null,
            connectionId: null,
            providerSource: "web_voice_session_v1",
            joinUrl: this.buildCandidateInterviewUrl(session.id, existingToken),
            externalRef: `voice-${session.id}`,
            calendarEventRef: null
          }
        : await this.integrationsService.resolveMeetingContext({
            tenantId: input.tenantId,
            sessionId: session.id,
            mode: session.mode,
            operation: "update",
            scheduledAt,
            preferredProvider: input.preferredProvider,
            existingExternalRef: session.meetingExternalRef,
            existingCalendarEventRef: session.meetingCalendarEventRef,
            candidateEmail: session.application.candidate.email,
            candidateName: session.application.candidate.fullName,
            interviewerName: session.interviewerName ?? null,
            title: `Interview - ${session.application.job.title}`,
            description:
              input.scheduleNote ?? session.scheduleNote ?? `Interview session ${session.id}`,
            timezone: "UTC",
            traceId: input.traceId
          });

    const updated = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        status: InterviewSessionStatus.SCHEDULED,
        schedulingSource: input.schedulingSource ?? session.schedulingSource,
        scheduledAt,
        scheduleNote: input.scheduleNote ?? session.scheduleNote,
        ...(input.modeContext ? { modeContextJson: toJsonValue(input.modeContext) } : {}),
        meetingProvider: meetingContext.provider,
        meetingProviderSource: meetingContext.providerSource,
        meetingConnectionId: meetingContext.connectionId,
        meetingJoinUrl: meetingContext.joinUrl,
        meetingExternalRef: meetingContext.externalRef,
        meetingCalendarEventRef: meetingContext.calendarEventRef,
        candidateAccessToken: existingToken,
        candidateAccessExpiresAt: new Date(scheduledAt.getTime() + 72 * 60 * 60 * 1000),
        rescheduleCount: {
          increment: 1
        },
        lastRescheduledAt: new Date(),
        lastRescheduledBy: input.requestedBy,
        lastRescheduleReasonCode: input.reasonCode ?? "manual_reschedule",
        endedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReasonCode: null
      }
    });

    await this.transitionApplicationStageIfNeeded({
      tenantId: input.tenantId,
      applicationId: session.application.id,
      targetStage: ApplicationStage.INTERVIEW_SCHEDULED,
      changedBy: input.requestedBy,
      reasonCode: "interview_session_rescheduled",
      traceId: input.traceId
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: updated.id,
        eventType: "interview.session.rescheduled",
        traceId: input.traceId,
        payload: {
          applicationId: updated.applicationId,
          previousScheduledAt: session.scheduledAt?.toISOString() ?? null,
          scheduledAt: updated.scheduledAt?.toISOString() ?? null,
          reasonCode: input.reasonCode ?? "manual_reschedule",
          rescheduleCount: updated.rescheduleCount,
          requestedBy: input.requestedBy,
          meetingProvider: updated.meetingProvider,
          meetingProviderSource: updated.meetingProviderSource,
          meetingJoinUrl: updated.meetingJoinUrl
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        actorType: AuditActorType.USER,
        action: "interview.session.rescheduled",
        entityType: "InterviewSession",
        entityId: updated.id,
        traceId: input.traceId,
        metadata: {
          applicationId: updated.applicationId,
          previousScheduledAt: session.scheduledAt?.toISOString() ?? null,
          scheduledAt: updated.scheduledAt?.toISOString() ?? null,
          reasonCode: input.reasonCode ?? "manual_reschedule",
          rescheduleCount: updated.rescheduleCount,
          meetingProvider: updated.meetingProvider,
          meetingProviderSource: updated.meetingProviderSource,
          meetingJoinUrl: updated.meetingJoinUrl
        }
      })
    ]);

    return this.getById(input.tenantId, updated.id);
  }

  async start(input: {
    tenantId: string;
    sessionId: string;
    startedBy: string;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status === InterviewSessionStatus.RUNNING) {
      return session;
    }

    if (session.status !== InterviewSessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Session su durumda oldugu icin baslatilamaz: ${session.status}`
      );
    }

    const started = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        status: InterviewSessionStatus.RUNNING,
        startedAt: session.startedAt ?? new Date(),
        endedAt: null
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: started.id,
        eventType: "interview.session.started",
        traceId: input.traceId,
        payload: {
          applicationId: started.applicationId,
          startedBy: input.startedBy,
          startedAt: started.startedAt?.toISOString() ?? null
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.startedBy,
        actorType: AuditActorType.USER,
        action: "interview.session.started",
        entityType: "InterviewSession",
        entityId: started.id,
        traceId: input.traceId,
        metadata: {
          applicationId: started.applicationId
        }
      })
    ]);

    return started;
  }

  async appendTranscriptSegment(input: {
    tenantId: string;
    sessionId: string;
    speaker: "AI" | "CANDIDATE" | "RECRUITER";
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
    sttModel?: string;
    language?: string;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        transcript: true
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status !== InterviewSessionStatus.RUNNING) {
      throw new BadRequestException("Transcript segmentleri sadece RUNNING session'a eklenebilir.");
    }

    if (input.endMs < input.startMs) {
      throw new BadRequestException("endMs, startMs degerinden kucuk olamaz.");
    }

    if (
      session.transcript &&
      (session.transcript.ownerType !== "INTERVIEW_SESSION" || session.transcript.ownerId !== session.id)
    ) {
      throw new BadRequestException("Transcript ownership kurali ihlal edildi.");
    }

    if (session.transcript?.finalizedAt || session.transcript?.retentionLocked) {
      throw new BadRequestException("Finalize edilmis transcript'e yeni segment eklenemez.");
    }

    const transcript =
      session.transcript ??
      (await this.prisma.transcript.create({
        data: {
          tenantId: input.tenantId,
          sessionId: session.id,
          ownerType: "INTERVIEW_SESSION",
          ownerId: session.id,
          language: input.language ?? "tr",
          sttModel: input.sttModel ?? "manual_transcript_entry",
          ingestionMethod: "stream_segments",
          ingestionStatus: "available",
          qualityStatus: TranscriptQualityStatus.DRAFT
        }
      }));

    if (!session.transcript) {
      await Promise.all([
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "Transcript",
          aggregateId: transcript.id,
          eventType: "interview.transcript.created",
          traceId: input.traceId,
          payload: {
            sessionId: session.id,
            ownerType: transcript.ownerType,
            ownerId: transcript.ownerId
          }
        }),
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorType: AuditActorType.SYSTEM,
          action: "interview.transcript.created",
          entityType: "Transcript",
          entityId: transcript.id,
          traceId: input.traceId,
          metadata: {
            sessionId: session.id,
            ownerType: transcript.ownerType,
            ownerId: transcript.ownerId
          }
        })
      ]);
    }

    const segment = await this.prisma.transcriptSegment.create({
      data: {
        tenantId: input.tenantId,
        transcriptId: transcript.id,
        speaker: input.speaker,
        startMs: input.startMs,
        endMs: input.endMs,
        text: input.text,
        confidence: input.confidence
      }
    });

    await this.prisma.transcript.update({
      where: {
        id: transcript.id
      },
      data: {
        ingestionMethod: "stream_segments",
        ingestionStatus: "available",
        lastIngestedAt: new Date(),
        qualityStatus: TranscriptQualityStatus.DRAFT,
        finalizedAt: null,
        qualityReviewedAt: null,
        qualityReviewedBy: null,
        reviewNotes: null,
        version: {
          increment: 1
        }
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Transcript",
        aggregateId: transcript.id,
        eventType: "interview.transcript.segment_appended",
        traceId: input.traceId,
        payload: {
          sessionId: session.id,
          segmentId: segment.id,
          speaker: segment.speaker,
          startMs: segment.startMs,
          endMs: segment.endMs
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.transcript.segment_appended",
        entityType: "Transcript",
        entityId: transcript.id,
        traceId: input.traceId,
        metadata: {
          sessionId: session.id,
          segmentId: segment.id,
          speaker: segment.speaker,
          startMs: segment.startMs,
          endMs: segment.endMs
        }
      })
    ]);

    return segment;
  }

  async importTranscript(input: {
    tenantId: string;
    sessionId: string;
    transcriptText: string;
    importedBy: string;
    defaultSpeaker?: Speaker;
    language?: string;
    sttModel?: string;
    replaceExisting?: boolean;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        transcript: {
          select: {
            id: true
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status === InterviewSessionStatus.CANCELLED) {
      throw new BadRequestException("Iptal edilen session'a transcript baglanamaz.");
    }

    const lines = normalizeTranscriptText(input.transcriptText);

    if (lines.length === 0) {
      throw new BadRequestException("Transcript metni bos olamaz.");
    }

    if (lines.length > 6000) {
      throw new BadRequestException("Transcript satir sayisi cok yuksek.");
    }

    const defaultSpeaker = input.defaultSpeaker ?? "CANDIDATE";

    const { transcriptId, created, segmentCount } = await this.prisma.$transaction(async (tx) => {
      const transcript =
        session.transcript ??
        (await tx.transcript.create({
          data: {
            tenantId: input.tenantId,
            sessionId: session.id,
            ownerType: "INTERVIEW_SESSION",
            ownerId: session.id,
            language: input.language ?? "tr",
            sttModel: input.sttModel ?? "manual_text_upload",
            ingestionMethod: "manual_text_upload",
            ingestionStatus: "available",
            qualityStatus: TranscriptQualityStatus.REVIEW_REQUIRED
          }
        }));

      if (input.replaceExisting === true) {
        await tx.transcriptSegment.deleteMany({
          where: {
            transcriptId: transcript.id
          }
        });
      }

      const segmentData = lines.map((line, index) => {
        const parsed = parseSpeakerFromLine(line, defaultSpeaker);
        const startMs = index * 8000;
        return {
          tenantId: input.tenantId,
          transcriptId: transcript.id,
          speaker: parsed.speaker,
          startMs,
          endMs: startMs + 7000,
          text: parsed.text,
          confidence: null
        };
      });

      await tx.transcriptSegment.createMany({
        data: segmentData
      });

      await tx.transcript.update({
        where: {
          id: transcript.id
        },
        data: {
          language: input.language ?? "tr",
          sttModel: input.sttModel ?? "manual_text_upload",
          ingestionMethod: "manual_text_upload",
          ingestionStatus: "available",
          lastIngestedAt: new Date(),
          qualityStatus: TranscriptQualityStatus.REVIEW_REQUIRED,
          finalizedAt: null,
          qualityReviewedAt: null,
          qualityReviewedBy: null,
          reviewNotes: null,
          version: {
            increment: 1
          }
        }
      });

      return {
        transcriptId: transcript.id,
        created: !session.transcript,
        segmentCount: segmentData.length
      };
    });

    if (created) {
      await Promise.all([
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "Transcript",
          aggregateId: transcriptId,
          eventType: "interview.transcript.created",
          traceId: input.traceId,
          payload: {
            sessionId: session.id,
            ownerType: "INTERVIEW_SESSION",
            ownerId: session.id,
            importedBy: input.importedBy
          }
        }),
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorUserId: input.importedBy,
          actorType: AuditActorType.USER,
          action: "interview.transcript.created",
          entityType: "Transcript",
          entityId: transcriptId,
          traceId: input.traceId,
          metadata: {
            sessionId: session.id
          }
        })
      ]);
    }

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Transcript",
        aggregateId: transcriptId,
        eventType: "interview.transcript.ingested",
        traceId: input.traceId,
        payload: {
          sessionId: session.id,
          segmentCount,
          ingestionMethod: "manual_text_upload",
          importedBy: input.importedBy,
          replaceExisting: input.replaceExisting === true
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.importedBy,
        actorType: AuditActorType.USER,
        action: "interview.transcript.ingested",
        entityType: "Transcript",
        entityId: transcriptId,
        traceId: input.traceId,
        metadata: {
          sessionId: session.id,
          segmentCount,
          ingestionMethod: "manual_text_upload",
          replaceExisting: input.replaceExisting === true
        }
      })
    ]);

    return this.getById(input.tenantId, input.sessionId);
  }

  async reviewTranscriptQuality(input: {
    tenantId: string;
    sessionId: string;
    reviewedBy: string;
    qualityStatus: "REVIEW_REQUIRED" | "VERIFIED";
    qualityScore?: number;
    reviewNotes?: string;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        transcript: {
          include: {
            segments: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (!session || !session.transcript) {
      throw new NotFoundException("Session transcript bulunamadi.");
    }

    if (input.qualityStatus === "VERIFIED" && (input.qualityScore ?? -1) < 0.7) {
      throw new BadRequestException("VERIFIED transcript icin qualityScore en az 0.7 olmalidir.");
    }

    if (input.qualityStatus === "VERIFIED" && session.transcript.segments.length < 2) {
      throw new BadRequestException("VERIFIED transcript icin en az 2 segment gereklidir.");
    }

    const transcript = await this.prisma.transcript.update({
      where: {
        id: session.transcript.id
      },
      data: {
        qualityStatus:
          input.qualityStatus === "VERIFIED"
            ? TranscriptQualityStatus.VERIFIED
            : TranscriptQualityStatus.REVIEW_REQUIRED,
        qualityScore: input.qualityScore,
        qualityReviewedAt: new Date(),
        qualityReviewedBy: input.reviewedBy,
        reviewNotes: input.reviewNotes?.trim() || null,
        finalizedAt: input.qualityStatus === "VERIFIED" ? new Date() : null
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Transcript",
        aggregateId: transcript.id,
        eventType: "interview.transcript.quality_reviewed",
        traceId: input.traceId,
        payload: {
          sessionId: session.id,
          qualityStatus: transcript.qualityStatus,
          qualityScore: transcript.qualityScore,
          reviewedBy: input.reviewedBy,
          reviewNotes: transcript.reviewNotes
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.reviewedBy,
        actorType: AuditActorType.USER,
        action: "interview.transcript.quality_reviewed",
        entityType: "Transcript",
        entityId: transcript.id,
        traceId: input.traceId,
        metadata: {
          sessionId: session.id,
          qualityStatus: transcript.qualityStatus,
          qualityScore: transcript.qualityScore,
          reviewNotes: transcript.reviewNotes
        }
      })
    ]);

    return transcript;
  }

  async cancel(input: {
    tenantId: string;
    sessionId: string;
    cancelledBy: string;
    reasonCode: string;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        application: {
          select: {
            id: true,
            currentStage: true
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status === InterviewSessionStatus.COMPLETED) {
      throw new BadRequestException("Tamamlanan session iptal edilemez.");
    }

    if (session.status === InterviewSessionStatus.CANCELLED) {
      return session;
    }

    const providerCancelResult = await this.integrationsService.cancelMeetingContext({
      tenantId: input.tenantId,
      sessionId: session.id,
      provider: session.meetingProvider,
      externalRef: session.meetingExternalRef,
      calendarEventRef: session.meetingCalendarEventRef,
      reasonCode: input.reasonCode,
      traceId: input.traceId
    });

    const cancelled = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        status: InterviewSessionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: input.cancelledBy,
        cancelReasonCode: input.reasonCode,
        endedAt: session.endedAt ?? new Date()
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: cancelled.id,
        eventType: "interview.session.cancelled",
        traceId: input.traceId,
        payload: {
          applicationId: cancelled.applicationId,
          cancelledBy: input.cancelledBy,
          reasonCode: input.reasonCode,
          providerCancelResult: JSON.parse(JSON.stringify(providerCancelResult))
        } as Prisma.InputJsonValue
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.cancelledBy,
        actorType: AuditActorType.USER,
        action: "interview.session.cancelled",
        entityType: "InterviewSession",
        entityId: cancelled.id,
        traceId: input.traceId,
        metadata: {
          applicationId: cancelled.applicationId,
          reasonCode: input.reasonCode,
          providerCancelResult: JSON.parse(JSON.stringify(providerCancelResult))
        } as Prisma.InputJsonValue
      })
    ]);

    await this.rollbackStageAfterCancellation({
      tenantId: input.tenantId,
      applicationId: cancelled.applicationId,
      cancelledBy: input.cancelledBy,
      traceId: input.traceId
    });

    return cancelled;
  }

  async complete(input: {
    tenantId: string;
    sessionId: string;
    completedBy: string;
    actorType?: AuditActorType;
    completionReasonCode?: string;
    triggerAiReviewPack?: boolean;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        application: {
          select: {
            id: true,
            candidateId: true,
            jobId: true
          }
        },
        transcript: {
          include: {
            segments: {
              select: {
                confidence: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status === InterviewSessionStatus.COMPLETED) {
      return session;
    }

    if (
      session.status === InterviewSessionStatus.CANCELLED ||
      session.status === InterviewSessionStatus.FAILED ||
      session.status === InterviewSessionStatus.NO_SHOW
    ) {
      throw new BadRequestException(`Session su durumda oldugu icin tamamlanamaz: ${session.status}`);
    }

    const completed = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        status: InterviewSessionStatus.COMPLETED,
        startedAt: session.startedAt ?? new Date(),
        endedAt: new Date(),
        abandonedAt: null,
        completedReasonCode: input.completionReasonCode ?? "session_completed",
        completionAutomationQueuedAt: new Date(),
        cancelledAt: null,
        cancelledBy: null,
        cancelReasonCode: null
      }
    });

    const transcriptQuality = await this.updateTranscriptQualityOnCompletion({
      tenantId: input.tenantId,
      transcriptId: session.transcript?.id,
      completedBy: input.completedBy,
      segments: session.transcript?.segments ?? []
    });

    await this.transitionApplicationStageIfNeeded({
      tenantId: input.tenantId,
      applicationId: completed.applicationId,
      targetStage: ApplicationStage.INTERVIEW_COMPLETED,
      changedBy: input.completedBy,
      reasonCode: "interview_session_completed",
      traceId: input.traceId
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: completed.id,
        eventType: "interview.session.completed",
        traceId: input.traceId,
        payload: {
          applicationId: completed.applicationId,
          completedBy: input.completedBy,
          completedAt: completed.endedAt?.toISOString() ?? null,
          completionReasonCode: completed.completedReasonCode,
          rubricKey: completed.rubricKey,
          rubricVersion: completed.rubricVersion,
          transcriptQualityStatus: transcriptQuality?.qualityStatus ?? null,
          transcriptQualityScore: transcriptQuality?.qualityScore ?? null
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.completedBy,
        actorType: input.actorType ?? AuditActorType.USER,
        action: "interview.session.completed",
        entityType: "InterviewSession",
        entityId: completed.id,
        traceId: input.traceId,
        metadata: {
          applicationId: completed.applicationId,
          completionReasonCode: completed.completedReasonCode,
          rubricKey: completed.rubricKey,
          rubricVersion: completed.rubricVersion,
          transcriptQualityStatus: transcriptQuality?.qualityStatus ?? null,
          transcriptQualityScore: transcriptQuality?.qualityScore ?? null
        }
      })
    ]);

    if (!session.transcript) {
      await this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.transcript.missing_on_completion",
        entityType: "InterviewSession",
        entityId: completed.id,
        traceId: input.traceId,
        metadata: {
          applicationId: completed.applicationId
        }
      });
    }

    void this.runPostCompletionAutomation({
      tenantId: input.tenantId,
      sessionId: completed.id,
      applicationId: completed.applicationId,
      candidateId: session.application.candidateId,
      jobId: session.application.jobId,
      requestedBy: input.completedBy,
      traceId: input.traceId,
      force: input.triggerAiReviewPack === true
    });

    return completed;
  }

  async getPublicSession(input: {
    sessionId: string;
    accessToken: string;
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });

    const ensured = await this.autoFailStaleSessionIfNeeded(session, input.traceId);
    return this.toPublicSessionView(ensured);
  }

  async startPublicSession(input: {
    sessionId: string;
    accessToken: string;
    capabilities?: {
      speechRecognition: boolean;
      speechSynthesis: boolean;
      locale?: string;
    };
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });

    if (
      session.status === InterviewSessionStatus.CANCELLED ||
      session.status === InterviewSessionStatus.FAILED
    ) {
      return this.toPublicSessionView(session);
    }

    if (session.status === InterviewSessionStatus.COMPLETED) {
      return this.toPublicSessionView(session);
    }

    const now = new Date();

    if (session.status === InterviewSessionStatus.SCHEDULED && session.scheduledAt) {
      const launchWindowMs = 5 * 60 * 1000;
      const scheduledTime = session.scheduledAt.getTime();

      if (scheduledTime - now.getTime() > launchWindowMs) {
        const plannedAt = new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Istanbul"
        }).format(session.scheduledAt);

        throw new BadRequestException(
          `Görüşme henüz başlamadı. Lütfen planlanan saatte tekrar deneyin: ${plannedAt} (UTC+3).`
        );
      }
    }

    const runtimeSelection = this.speechRuntimeService.resolveRuntimeSelection({
      speechRecognition: input.capabilities?.speechRecognition,
      speechSynthesis: input.capabilities?.speechSynthesis
    });
    const startedSession =
      session.status === InterviewSessionStatus.SCHEDULED
        ? await this.prisma.interviewSession.update({
            where: {
              id: session.id
            },
            data: {
              status: InterviewSessionStatus.RUNNING,
              startedAt: session.startedAt ?? now,
              lastCandidateActivityAt: now,
              voiceInputProvider: runtimeSelection.voiceInputProvider,
              voiceOutputProvider: runtimeSelection.voiceOutputProvider,
              candidateLocale: input.capabilities?.locale?.trim() || session.candidateLocale,
              runtimeProviderMode: runtimeSelection.runtimeProviderMode
            },
            include: PUBLIC_SESSION_INCLUDE
          })
        : await this.prisma.interviewSession.update({
            where: {
              id: session.id
            },
            data: {
              lastCandidateActivityAt: now,
              voiceInputProvider: session.voiceInputProvider ?? runtimeSelection.voiceInputProvider,
              voiceOutputProvider: session.voiceOutputProvider ?? runtimeSelection.voiceOutputProvider,
              runtimeProviderMode: session.runtimeProviderMode ?? runtimeSelection.runtimeProviderMode
            },
            include: PUBLIC_SESSION_INCLUDE
          });

    if (session.status === InterviewSessionStatus.SCHEDULED) {
      await Promise.all([
        this.domainEventsService.append({
          tenantId: startedSession.tenantId,
          aggregateType: "InterviewSession",
          aggregateId: startedSession.id,
          eventType: "interview.session.started",
          traceId: input.traceId,
          payload: {
            applicationId: startedSession.applicationId,
            startedBy: "candidate_public_link",
            startedAt: startedSession.startedAt?.toISOString() ?? null,
            runtimeProviderMode: startedSession.runtimeProviderMode,
            voiceInputProvider: startedSession.voiceInputProvider,
            voiceOutputProvider: startedSession.voiceOutputProvider
          }
        }),
        this.auditWriterService.write({
          tenantId: startedSession.tenantId,
          actorType: AuditActorType.SYSTEM,
          action: "interview.session.started",
          entityType: "InterviewSession",
          entityId: startedSession.id,
          traceId: input.traceId,
          metadata: {
            source: "candidate_public_link",
            runtimeProviderMode: startedSession.runtimeProviderMode,
            voiceInputProvider: startedSession.voiceInputProvider,
            voiceOutputProvider: startedSession.voiceOutputProvider
          }
        })
      ]);
    }

    const promptedSession = await this.ensurePromptForRunningSession(startedSession, input.traceId);
    return this.toPublicSessionView(promptedSession);
  }

  async submitPublicAnswer(input: {
    sessionId: string;
    accessToken: string;
    transcriptText: string;
    confidence?: number;
    speechLatencyMs?: number;
    speechDurationMs?: number;
    answerSource?: "voice_browser" | "manual_text" | "voice_provider";
    locale?: string;
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });
    const activeSession = await this.autoFailStaleSessionIfNeeded(session, input.traceId);

    if (activeSession.status === InterviewSessionStatus.COMPLETED) {
      return this.toPublicSessionView(activeSession);
    }

    if (activeSession.status !== InterviewSessionStatus.RUNNING) {
      throw new BadRequestException("Görüşme oturumu cevap almaya uygun durumda değil.");
    }

    const activeTurn = [...activeSession.turns]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .find((turn) => turn.completionStatus === "ASKED" && !turn.answerText);

    if (!activeTurn) {
      const prompted = await this.ensurePromptForRunningSession(activeSession, input.traceId);
      return this.toPublicSessionView(prompted);
    }

    const answerText = sanitizeText(input.transcriptText ?? "");
    if (!answerText) {
      throw new BadRequestException("Boş cevap gönderilemez.");
    }

    const transcript = await this.ensureRuntimeTranscript({
      tenantId: activeSession.tenantId,
      session: activeSession,
      sttModel: activeSession.voiceInputProvider ?? "browser_web_speech_api",
      language: input.locale ?? activeSession.candidateLocale ?? "tr-TR",
      traceId: input.traceId
    });

    const lastSegment = transcript.segments[transcript.segments.length - 1] ?? null;
    const window = nextSegmentWindow(lastSegment ? lastSegment.endMs : null);

    const answerSegment = await this.prisma.transcriptSegment.create({
      data: {
        tenantId: activeSession.tenantId,
        transcriptId: transcript.id,
        speaker: "CANDIDATE",
        startMs: window.startMs,
        endMs:
          input.speechDurationMs && input.speechDurationMs > 0
            ? window.startMs + input.speechDurationMs
            : window.endMs,
        text: answerText,
        confidence: input.confidence
      }
    });

    const normalized = this.normalizeTemplate(activeSession.template.templateJson);
    const block = normalized.blocks.find((item) => item.key === activeTurn.blockKey);
    const evaluation = this.evaluateAnswerQuality(answerText, block);

    await this.prisma.interviewTurn.update({
      where: {
        id: activeTurn.id
      },
      data: {
        answerText,
        answerConfidence: input.confidence,
        answerLatencyMs: input.speechLatencyMs,
        answerDurationMs: input.speechDurationMs,
        answerLanguage: input.locale ?? activeSession.candidateLocale ?? "tr-TR",
        answerSource: input.answerSource ?? "voice_browser",
        answerSubmittedAt: new Date(),
        completionStatus: "ANSWERED",
        transitionDecision: evaluation.isComplete ? "advance_candidate" : "follow_up_candidate",
        decisionReason: evaluation.reason,
        answerSegmentId: answerSegment.id
      }
    });

    await this.prisma.interviewSession.update({
      where: {
        id: activeSession.id
      },
      data: {
        lastCandidateActivityAt: new Date(),
        candidateLocale: input.locale ?? activeSession.candidateLocale ?? "tr-TR"
      }
    });

    await this.prisma.transcript.update({
      where: {
        id: transcript.id
      },
      data: {
        ingestionMethod: "stream_segments",
        ingestionStatus: "available",
        lastIngestedAt: new Date(),
        qualityStatus: TranscriptQualityStatus.DRAFT,
        finalizedAt: null,
        qualityReviewedAt: null,
        qualityReviewedBy: null,
        reviewNotes: null,
        version: {
          increment: 1
        }
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: activeSession.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: activeSession.id,
        eventType: "interview.session.answer_submitted",
        traceId: input.traceId,
        payload: {
          turnId: activeTurn.id,
          sequenceNo: activeTurn.sequenceNo,
          blockKey: activeTurn.blockKey,
          category: activeTurn.category,
          answerPreview: answerText.slice(0, 240),
          quality: evaluation.quality,
          decision: evaluation.isComplete ? "advance" : "follow_up"
        }
      }),
      this.auditWriterService.write({
        tenantId: activeSession.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.session.answer_submitted",
        entityType: "InterviewSession",
        entityId: activeSession.id,
        traceId: input.traceId,
        metadata: {
          turnId: activeTurn.id,
          sequenceNo: activeTurn.sequenceNo,
          blockKey: activeTurn.blockKey,
          category: activeTurn.category,
          quality: evaluation.quality,
          decision: evaluation.isComplete ? "advance" : "follow_up"
        }
      })
    ]);

    const refreshed = await this.prisma.interviewSession.findFirst({
      where: {
        id: activeSession.id
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    if (!refreshed) {
      throw new NotFoundException("Interview session bulunamadı.");
    }

    const next = await this.routeNextPromptAfterAnswer({
      session: refreshed,
      answeredTurn: activeTurn,
      evaluation,
      traceId: input.traceId
    });

    return this.toPublicSessionView(next);
  }

  async submitPublicAudioAnswer(input: {
    sessionId: string;
    accessToken: string;
    audioBase64: string;
    mimeType: string;
    locale?: string;
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });

    const transcription = await this.speechRuntimeService.transcribe({
      tenantId: session.tenantId,
      sessionId: session.id,
      audioBase64: input.audioBase64,
      mimeType: input.mimeType,
      locale: input.locale ?? session.candidateLocale,
      traceId: input.traceId
    });

    if (transcription.status !== "ok" || !transcription.text) {
      throw new BadRequestException(
        transcription.errorMessage ?? "Provider-based speech transcription failed."
      );
    }

    await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        runtimeProviderMode:
          transcription.providerKey === "openai_speech"
            ? "provider_backed_openai"
            : session.runtimeProviderMode,
        voiceInputProvider: transcription.providerKey
      }
    });

    return this.submitPublicAnswer({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      transcriptText: transcription.text,
      confidence: transcription.confidence ?? undefined,
      answerSource: "voice_provider",
      locale: input.locale,
      traceId: input.traceId
    });
  }

  async getPublicPromptAudio(input: {
    sessionId: string;
    accessToken: string;
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });

    if (session.status !== InterviewSessionStatus.RUNNING) {
      throw new BadRequestException("Sesli prompt almak icin session RUNNING olmali.");
    }

    const activeTurn = [...session.turns]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .find((turn) => turn.completionStatus === "ASKED" && !turn.answerText);

    if (!activeTurn) {
      return {
        status: "no_active_prompt",
        providerKey: session.voiceOutputProvider ?? "text_prompt_only",
        audioBase64: null,
        mimeType: null
      };
    }

    const synthesis = await this.speechRuntimeService.synthesize({
      tenantId: session.tenantId,
      sessionId: session.id,
      text: activeTurn.promptText,
      locale: session.candidateLocale,
      traceId: input.traceId
    });

    if (synthesis.status === "ok") {
      await this.prisma.interviewSession.update({
        where: {
          id: session.id
        },
        data: {
          runtimeProviderMode:
            synthesis.providerKey === "openai_speech"
              ? "provider_backed_openai"
              : session.runtimeProviderMode,
          voiceOutputProvider: synthesis.providerKey
        }
      });
    }

    return {
      status: synthesis.status,
      providerKey: synthesis.providerKey,
      audioBase64: synthesis.audioBase64,
      mimeType: synthesis.mimeType,
      errorMessage: synthesis.errorMessage ?? null
    };
  }

  async repeatPublicQuestion(input: {
    sessionId: string;
    accessToken: string;
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });

    if (session.status !== InterviewSessionStatus.RUNNING) {
      throw new BadRequestException("Soru tekrar işlemi için oturum RUNNING olmalıdır.");
    }

    const activeTurn = [...session.turns]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .find((turn) => turn.completionStatus === "ASKED" && !turn.answerText);

    if (!activeTurn) {
      throw new BadRequestException("Tekrar edilecek aktif soru bulunamadı.");
    }

    await this.appendAiPromptSegment({
      tenantId: session.tenantId,
      session,
      text: activeTurn.promptText
    });

    await this.prisma.interviewTurn.update({
      where: {
        id: activeTurn.id
      },
      data: {
        metadata: {
          repeatedAt: new Date().toISOString()
        }
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: session.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: session.id,
        eventType: "interview.session.question_repeated",
        traceId: input.traceId,
        payload: {
          turnId: activeTurn.id,
          sequenceNo: activeTurn.sequenceNo,
          blockKey: activeTurn.blockKey,
          category: activeTurn.category
        }
      }),
      this.auditWriterService.write({
        tenantId: session.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.session.question_repeated",
        entityType: "InterviewSession",
        entityId: session.id,
        traceId: input.traceId,
        metadata: {
          turnId: activeTurn.id,
          sequenceNo: activeTurn.sequenceNo,
          blockKey: activeTurn.blockKey
        }
      })
    ]);

    const refreshed = await this.prisma.interviewSession.findFirst({
      where: {
        id: session.id
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    if (!refreshed) {
      throw new NotFoundException("Interview session bulunamadı.");
    }

    return this.toPublicSessionView(refreshed);
  }

  async abandonPublicSession(input: {
    sessionId: string;
    accessToken: string;
    reasonCode?: string;
    traceId?: string;
  }) {
    const session = await this.resolvePublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      traceId: input.traceId
    });

    if (
      session.status === InterviewSessionStatus.CANCELLED ||
      session.status === InterviewSessionStatus.COMPLETED ||
      session.status === InterviewSessionStatus.FAILED
    ) {
      return this.toPublicSessionView(session);
    }

    const abandoned = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        status: InterviewSessionStatus.FAILED,
        abandonedAt: new Date(),
        endedAt: new Date(),
        completedReasonCode: input.reasonCode?.trim() || "candidate_abandoned",
        cancelReasonCode: null,
        cancelledAt: null,
        cancelledBy: null
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: abandoned.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: abandoned.id,
        eventType: "interview.session.abandoned",
        traceId: input.traceId,
        payload: {
          applicationId: abandoned.applicationId,
          reasonCode: abandoned.completedReasonCode
        }
      }),
      this.auditWriterService.write({
        tenantId: abandoned.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.session.abandoned",
        entityType: "InterviewSession",
        entityId: abandoned.id,
        traceId: input.traceId,
        metadata: {
          applicationId: abandoned.applicationId,
          reasonCode: abandoned.completedReasonCode
        }
      })
    ]);

    await this.transitionApplicationStageIfNeeded({
      tenantId: abandoned.tenantId,
      applicationId: abandoned.applicationId,
      targetStage: ApplicationStage.SCREENING,
      changedBy: "candidate_public_link",
      reasonCode: "interview_session_abandoned",
      traceId: input.traceId
    });

    return this.toPublicSessionView(abandoned);
  }

  async requestReviewPack(input: {
    tenantId: string;
    sessionId: string;
    requestedBy: string;
    traceId?: string;
    providerKey?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId
      },
      include: {
        application: {
          select: {
            id: true,
            candidateId: true,
            jobId: true
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Interview session bulunamadi.");
    }

    if (session.status !== InterviewSessionStatus.COMPLETED) {
      throw new BadRequestException("Review pack sadece COMPLETED session icin tetiklenebilir.");
    }

    const [reportTask, recommendationTask] = await Promise.all([
      this.aiOrchestrationService.createTaskRun({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        taskType: "REPORT_GENERATION",
        triggerSource: "manual",
        triggerReasonCode: "interview_review_pack_manual",
        traceId: input.traceId,
        candidateId: session.application.candidateId,
        jobId: session.application.jobId,
        applicationId: session.application.id,
        sessionId: session.id,
        providerKey: input.providerKey,
        input: {
          triggerSource: "manual",
          triggerReasonCode: "interview_review_pack_manual",
          requestedFrom: "interview_session"
        }
      }),
      this.aiOrchestrationService.createTaskRun({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        taskType: "RECOMMENDATION_GENERATION",
        triggerSource: "manual",
        triggerReasonCode: "interview_review_pack_manual",
        traceId: input.traceId,
        candidateId: session.application.candidateId,
        jobId: session.application.jobId,
        applicationId: session.application.id,
        sessionId: session.id,
        providerKey: input.providerKey,
        input: {
          triggerSource: "manual",
          triggerReasonCode: "interview_review_pack_manual",
          requestedFrom: "interview_session"
        }
      })
    ]);

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: session.id,
        eventType: "interview.review_pack.requested",
        traceId: input.traceId,
        payload: {
          applicationId: session.application.id,
          reportTaskRunId: reportTask.taskRunId,
          recommendationTaskRunId: recommendationTask.taskRunId,
          requestedBy: input.requestedBy
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        actorType: AuditActorType.USER,
        action: "interview.review_pack.requested",
        entityType: "InterviewSession",
        entityId: session.id,
        traceId: input.traceId,
        metadata: {
          applicationId: session.application.id,
          reportTaskRunId: reportTask.taskRunId,
          recommendationTaskRunId: recommendationTask.taskRunId
        }
      })
    ]);

    return {
      sessionId: session.id,
      applicationId: session.application.id,
      reportTask,
      recommendationTask
    };
  }

  private generateCandidateAccessToken() {
    return randomUUID().replace(/-/g, "");
  }

  private buildCandidateInterviewUrl(sessionId: string, token: string) {
    const base = this.runtimeConfig.publicWebBaseUrl;
    return `${base}/gorusme/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
  }

  private normalizeTemplate(raw: Prisma.JsonValue): NormalizedInterviewTemplate {
    const root = asObject(raw);
    const introPrompt =
      typeof root.introPrompt === "string" && root.introPrompt.trim().length > 0
        ? sanitizeText(root.introPrompt)
        : "Merhaba, ben şirketinizin ilk görüşme asistanıyım. Soruları tek tek soracağım.";
    const closingPrompt =
      typeof root.closingPrompt === "string" && root.closingPrompt.trim().length > 0
        ? sanitizeText(root.closingPrompt)
        : "Teşekkür ederim. Görüşme kaydınız recruiter ekibine iletilecek.";

    const blocksRaw = Array.isArray(root.blocks)
      ? root.blocks
      : Array.isArray(root.questions)
        ? (root.questions as unknown[])
        : [];

    const blocks = blocksRaw
      .map((item, index) => {
        const row = asObject(item);
        const prompt = sanitizeText(
          typeof row.prompt === "string"
            ? row.prompt
            : typeof row.text === "string"
              ? row.text
              : ""
        );

        if (!prompt) {
          return null;
        }

        const key =
          typeof row.key === "string" && row.key.trim().length > 0
            ? sanitizeText(row.key).toLowerCase().replace(/\s+/g, "_")
            : `block_${index + 1}`;

        const questionKey =
          typeof row.questionKey === "string" && row.questionKey.trim().length > 0
            ? sanitizeText(row.questionKey)
            : `question_${index + 1}`;

        const followUps = asStringArray(row.followUps);
        const parsedMaxFollowUps =
          typeof row.maxFollowUps === "number" && Number.isFinite(row.maxFollowUps)
            ? Math.floor(row.maxFollowUps)
            : followUps.length > 0
              ? followUps.length
              : 1;

        const parsedMinWords =
          typeof row.minWords === "number" && Number.isFinite(row.minWords)
            ? Math.max(2, Math.floor(row.minWords))
            : ANSWER_TOO_SHORT_WORDS;

        return {
          key,
          questionKey,
          category:
            typeof row.category === "string" && row.category.trim().length > 0
              ? sanitizeText(row.category)
              : "genel_uyum",
          prompt,
          followUps,
          maxFollowUps: Math.min(Math.max(parsedMaxFollowUps, 0), 2),
          minWords: parsedMinWords,
          required: row.required !== false && row.mandatory !== false
        } satisfies InterviewTemplateBlock;
      })
      .filter((item): item is InterviewTemplateBlock => Boolean(item));

    if (blocks.length === 0) {
      throw new BadRequestException("Interview template geçersiz: blok/soru bulunamadı.");
    }

    return {
      introPrompt,
      closingPrompt,
      blocks
    };
  }

  private evaluateAnswerQuality(answerText: string, block?: InterviewTemplateBlock): AnswerEvaluation {
    const wordCount = countWords(answerText);
    const lowered = answerText.toLocaleLowerCase("tr-TR");
    const minWords = block?.minWords ?? ANSWER_TOO_SHORT_WORDS;

    // ── Low-signal keyword detection ──
    const lowSignalKeywords = [
      "bilmiyorum",
      "emin değilim",
      "hatırlamıyorum",
      "fark etmez",
      "kararsızım",
      "belki",
      "yok"
    ];
    const hasLowSignal = lowSignalKeywords.some((token) => lowered.includes(token));

    // ── Deflection detection (avoidance patterns) ──
    const deflectionPatterns = [
      "geçelim",
      "sonra konuşalım",
      "söylemek istemiyorum",
      "önemli değil",
      "farketmez",
      "hepsi olur",
      "ne derseniz"
    ];
    const hasDeflection = deflectionPatterns.some((token) => lowered.includes(token));

    // ── Relevance signals (category-based) ──
    const categoryRelevanceKeywords: Record<string, string[]> = {
      recent_experience: ["iş", "çalıştım", "görev", "sorumluluk", "tecrübe", "deneyim", "yaptım", "pozisyon"],
      shift_availability: ["vardiya", "mesai", "saat", "gece", "hafta sonu", "müsait", "uygun", "çalışabilirim"],
      location_commute: ["ulaşım", "yol", "otobüs", "metro", "dakika", "yakın", "uzak", "araç", "servise"],
      motivation: ["istiyorum", "hedef", "gelişmek", "katkı", "seviyorum", "ilgili", "motivasyon", "kariyer"],
      communication: ["müşteri", "iletişim", "anlattım", "çözdüm", "konuştum", "dinledim", "yardım"]
    };

    const categoryKeywords = block?.category
      ? categoryRelevanceKeywords[block.category] ?? []
      : [];
    const relevanceHits = categoryKeywords.filter((kw) => lowered.includes(kw)).length;
    const hasRelevantContent = relevanceHits >= 2 || (categoryKeywords.length === 0 && wordCount >= minWords);

    // ── Depth signals (specific details) ──
    const depthSignals = [
      /\d+\s*(yıl|ay|saat|gün|kişi|adet)/i.test(answerText),      // numbers with context
      /örneğin|mesela|bir keresinde|geçen/i.test(answerText),        // specific examples
      /çünkü|nedeni|sebebi|sayesinde/i.test(answerText),             // reasoning
      answerText.includes(",") && wordCount > minWords               // complex sentences
    ];
    const depthScore = depthSignals.filter(Boolean).length;

    // ── Scoring logic ──
    if (wordCount < Math.max(2, minWords)) {
      return { isComplete: false, reason: "cevap_cok_kisa", quality: "low" };
    }

    if (hasDeflection) {
      return { isComplete: false, reason: "cevap_kacamak", quality: "low" };
    }

    if (hasLowSignal && wordCount < minWords + 3) {
      return { isComplete: false, reason: "cevap_belirsiz", quality: "low" };
    }

    if (hasLowSignal && !hasRelevantContent) {
      return { isComplete: true, reason: "cevap_zayif_ilgililik", quality: "low" };
    }

    if (wordCount < minWords + 2 && depthScore === 0) {
      return { isComplete: true, reason: "cevap_temel_duzey", quality: "medium" };
    }

    if (hasRelevantContent && depthScore >= 2 && wordCount >= minWords + 5) {
      return { isComplete: true, reason: "cevap_detayli_ve_ilgili", quality: "high" };
    }

    if (hasRelevantContent && wordCount >= minWords + 2) {
      return { isComplete: true, reason: "cevap_yeterli", quality: "high" };
    }

    return { isComplete: true, reason: "cevap_temel_duzey", quality: "medium" };
  }

  private async resolvePublicSession(input: {
    sessionId: string;
    accessToken: string;
    traceId?: string;
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.sessionId,
        candidateAccessToken: input.accessToken
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    if (!session) {
      throw new NotFoundException("Görüşme oturumu bulunamadı veya erişim bağlantısı geçersiz.");
    }

    if (
      session.candidateAccessExpiresAt &&
      session.candidateAccessExpiresAt.getTime() < Date.now()
    ) {
      throw new ForbiddenException("Görüşme bağlantısının süresi doldu.");
    }

    if (session.mode !== "VOICE") {
      throw new BadRequestException("Bu oturum web sesli görüşme modunda değil.");
    }

    return session;
  }

  private async autoFailStaleSessionIfNeeded(
    session: PublicSessionRow,
    traceId?: string
  ) {
    if (session.status !== InterviewSessionStatus.RUNNING) {
      return session;
    }

    const reference = session.lastCandidateActivityAt ?? session.startedAt ?? session.updatedAt;
    const staleMs = INTERVIEW_SESSION_STALE_MINUTES * 60 * 1000;

    if (!reference || Date.now() - reference.getTime() <= staleMs) {
      return session;
    }

    const timedOut = await this.prisma.interviewSession.update({
      where: {
        id: session.id
      },
      data: {
        status: InterviewSessionStatus.FAILED,
        endedAt: new Date(),
        abandonedAt: new Date(),
        completedReasonCode: "candidate_timeout"
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: timedOut.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: timedOut.id,
        eventType: "interview.session.timed_out",
        traceId,
        payload: {
          applicationId: timedOut.applicationId,
          thresholdMinutes: INTERVIEW_SESSION_STALE_MINUTES
        }
      }),
      this.auditWriterService.write({
        tenantId: timedOut.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.session.timed_out",
        entityType: "InterviewSession",
        entityId: timedOut.id,
        traceId,
        metadata: {
          applicationId: timedOut.applicationId,
          thresholdMinutes: INTERVIEW_SESSION_STALE_MINUTES
        }
      })
    ]);

    return timedOut;
  }

  private async ensureRuntimeTranscript(input: {
    tenantId: string;
    session: PublicSessionRow;
    sttModel: string;
    language: string;
    traceId?: string;
  }) {
    if (input.session.transcript) {
      return input.session.transcript;
    }

    const transcript = await this.prisma.transcript.create({
      data: {
        tenantId: input.tenantId,
        sessionId: input.session.id,
        ownerType: "INTERVIEW_SESSION",
        ownerId: input.session.id,
        language: input.language,
        sttModel: input.sttModel,
        ingestionMethod: "stream_segments",
        ingestionStatus: "available",
        qualityStatus: TranscriptQualityStatus.DRAFT
      },
      include: {
        segments: {
          orderBy: {
            startMs: "asc"
          },
          take: 300
        }
      }
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Transcript",
        aggregateId: transcript.id,
        eventType: "interview.transcript.created",
        traceId: input.traceId,
        payload: {
          sessionId: input.session.id,
          ownerType: transcript.ownerType,
          ownerId: transcript.ownerId,
          source: "voice_runtime"
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.transcript.created",
        entityType: "Transcript",
        entityId: transcript.id,
        traceId: input.traceId,
        metadata: {
          sessionId: input.session.id,
          source: "voice_runtime"
        }
      })
    ]);

    return transcript;
  }

  private async appendAiPromptSegment(input: {
    tenantId: string;
    session: PublicSessionRow;
    text: string;
  }) {
    const transcript = await this.ensureRuntimeTranscript({
      tenantId: input.tenantId,
      session: input.session,
      sttModel: input.session.voiceInputProvider ?? "browser_web_speech_api",
      language: input.session.candidateLocale ?? "tr-TR"
    });

    const lastSegment = transcript.segments[transcript.segments.length - 1] ?? null;
    const window = nextSegmentWindow(lastSegment ? lastSegment.endMs : null);

    return this.prisma.transcriptSegment.create({
      data: {
        tenantId: input.tenantId,
        transcriptId: transcript.id,
        speaker: "AI",
        startMs: window.startMs,
        endMs: window.endMs,
        text: sanitizeText(input.text),
        confidence: null
      }
    });
  }

  private async createTurnAndAskPrompt(input: {
    session: PublicSessionRow;
    block: InterviewTemplateBlock;
    kind: "PRIMARY" | "FOLLOW_UP";
    promptText: string;
    followUpDepth: number;
    traceId?: string;
  }) {
    const aiSegment = await this.appendAiPromptSegment({
      tenantId: input.session.tenantId,
      session: input.session,
      text: input.promptText
    });

    const nextSequence =
      input.session.turns.length > 0
        ? Math.max(...input.session.turns.map((turn) => turn.sequenceNo)) + 1
        : 1;

    const turn = await this.prisma.interviewTurn.create({
      data: {
        tenantId: input.session.tenantId,
        sessionId: input.session.id,
        sequenceNo: nextSequence,
        blockKey: input.block.key,
        questionKey: input.block.questionKey,
        category: input.block.category,
        kind: input.kind,
        promptText: sanitizeText(input.promptText),
        promptSegmentId: aiSegment.id,
        followUpDepth: input.followUpDepth,
        completionStatus: "ASKED"
      }
    });

    await this.prisma.interviewSession.update({
      where: {
        id: input.session.id
      },
      data: {
        currentQuestionKey: input.block.questionKey,
        currentQuestionIndex: this.indexOfBlock(
          this.normalizeTemplate(input.session.template.templateJson),
          input.block.key
        ),
        currentFollowUpCount: input.followUpDepth,
        lastCandidateActivityAt: new Date()
      }
    });

    const eventType =
      input.kind === "FOLLOW_UP"
        ? "interview.session.follow_up_asked"
        : "interview.session.question_asked";
    const action =
      input.kind === "FOLLOW_UP"
        ? "interview.session.follow_up_asked"
        : "interview.session.question_asked";

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.session.tenantId,
        aggregateType: "InterviewSession",
        aggregateId: input.session.id,
        eventType,
        traceId: input.traceId,
        payload: {
          turnId: turn.id,
          sequenceNo: turn.sequenceNo,
          blockKey: turn.blockKey,
          questionKey: turn.questionKey,
          category: turn.category,
          kind: turn.kind
        }
      }),
      this.auditWriterService.write({
        tenantId: input.session.tenantId,
        actorType: AuditActorType.SYSTEM,
        action,
        entityType: "InterviewSession",
        entityId: input.session.id,
        traceId: input.traceId,
        metadata: {
          turnId: turn.id,
          sequenceNo: turn.sequenceNo,
          blockKey: turn.blockKey,
          questionKey: turn.questionKey,
          category: turn.category,
          kind: turn.kind
        }
      })
    ]);

    return turn;
  }

  private indexOfBlock(template: NormalizedInterviewTemplate, blockKey: string) {
    const foundIndex = template.blocks.findIndex((item) => item.key === blockKey);
    return foundIndex >= 0 ? foundIndex : 0;
  }

  private pickFollowUpPrompt(block: InterviewTemplateBlock, followUpDepth: number) {
    if (block.followUps[followUpDepth]) {
      return block.followUps[followUpDepth];
    }

    switch (block.category) {
      case "shift_availability":
        return "Vardiya uygunluğunuzu daha net anlatabilir misiniz?";
      case "location_commute":
        return "Ulaşım tarafını biraz daha detaylandırır mısınız?";
      case "salary_expectation":
        return "Ücret beklentinizi aralık olarak paylaşabilir misiniz?";
      default:
        return "Bu yanıtı biraz daha açabilir misiniz?";
    }
  }

  private async ensurePromptForRunningSession(
    session: PublicSessionRow,
    traceId?: string
  ) {
    if (session.status !== InterviewSessionStatus.RUNNING) {
      return session;
    }

    const activeTurn = [...session.turns]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .find((turn) => turn.completionStatus === "ASKED" && !turn.answerText);
    if (activeTurn) {
      return session;
    }

    const template = this.normalizeTemplate(session.template.templateJson);
    const answeredBlocks = new Set(
      session.turns
        .filter((turn) => turn.completionStatus === "ANSWERED")
        .map((turn) => turn.blockKey)
    );

    const nextBlock = template.blocks.find((block) => !answeredBlocks.has(block.key));
    if (!nextBlock) {
      await this.appendAiPromptSegment({
        tenantId: session.tenantId,
        session,
        text: template.closingPrompt
      });

      await this.complete({
        tenantId: session.tenantId,
        sessionId: session.id,
        completedBy: "candidate_public_link",
        actorType: AuditActorType.SYSTEM,
        completionReasonCode: "candidate_completed",
        triggerAiReviewPack: true,
        traceId
      });

      const completed = await this.prisma.interviewSession.findFirst({
        where: { id: session.id },
        include: PUBLIC_SESSION_INCLUDE
      });

      if (!completed) {
        throw new NotFoundException("Interview session bulunamadı.");
      }

      return completed;
    }

    await this.createTurnAndAskPrompt({
      session,
      block: nextBlock,
      kind: "PRIMARY",
      promptText:
        session.turns.length === 0
          ? `${template.introPrompt} ${nextBlock.prompt}`.trim()
          : nextBlock.prompt,
      followUpDepth: 0,
      traceId
    });

    const refreshed = await this.prisma.interviewSession.findFirst({
      where: {
        id: session.id
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    if (!refreshed) {
      throw new NotFoundException("Interview session bulunamadı.");
    }

    return refreshed;
  }

  private async routeNextPromptAfterAnswer(input: {
    session: PublicSessionRow;
    answeredTurn: {
      id: string;
      sequenceNo: number;
      blockKey: string;
      questionKey: string;
      category: string;
      followUpDepth: number;
    };
    evaluation: AnswerEvaluation;
    traceId?: string;
  }) {
    const template = this.normalizeTemplate(input.session.template.templateJson);
    const currentBlock = template.blocks.find((item) => item.key === input.answeredTurn.blockKey);

    if (!currentBlock) {
      return this.ensurePromptForRunningSession(input.session, input.traceId);
    }

    const followUpDepth = input.answeredTurn.followUpDepth;
    const canAskFollowUp =
      !input.evaluation.isComplete && followUpDepth < (currentBlock.maxFollowUps ?? 0);

    if (canAskFollowUp) {
      await this.createTurnAndAskPrompt({
        session: input.session,
        block: currentBlock,
        kind: "FOLLOW_UP",
        promptText: this.pickFollowUpPrompt(currentBlock, followUpDepth),
        followUpDepth: followUpDepth + 1,
        traceId: input.traceId
      });
    }

    const refreshed = await this.prisma.interviewSession.findFirst({
      where: {
        id: input.session.id
      },
      include: PUBLIC_SESSION_INCLUDE
    });

    if (!refreshed) {
      throw new NotFoundException("Interview session bulunamadı.");
    }

    if (canAskFollowUp) {
      return refreshed;
    }

    return this.ensurePromptForRunningSession(refreshed, input.traceId);
  }

  private toPublicSessionView(
    session: PublicSessionRow
  ) {
    const template = (() => {
      try {
        return this.normalizeTemplate(session.template.templateJson);
      } catch {
        return {
          introPrompt: "",
          closingPrompt: "",
          blocks: []
        } satisfies NormalizedInterviewTemplate;
      }
    })();
    const orderedTurns = [...session.turns].sort((a, b) => a.sequenceNo - b.sequenceNo);
    const activeTurn = orderedTurns.find((turn) => turn.completionStatus === "ASKED" && !turn.answerText);
    const answeredBlocks = new Set(
      orderedTurns
        .filter((turn) => turn.completionStatus === "ANSWERED")
        .map((turn) => turn.blockKey)
    );

    const progressValue =
      template.blocks.length > 0 ? answeredBlocks.size / template.blocks.length : 0;

    return {
      sessionId: session.id,
      status: session.status,
      candidate: {
        id: session.application.candidate.id,
        fullName: session.application.candidate.fullName
      },
      job: {
        id: session.application.job.id,
        title: session.application.job.title,
        roleFamily: session.application.job.roleFamily
      },
      template: {
        id: session.template.id,
        name: session.template.name,
        version: session.template.version,
        roleFamily: session.template.roleFamily
      },
      runtime: {
        mode: session.runtimeMode,
        providerMode: session.runtimeProviderMode,
        voiceInputProvider: session.voiceInputProvider ?? "manual_text_fallback",
        voiceOutputProvider: session.voiceOutputProvider ?? "text_prompt_only",
        locale: session.candidateLocale,
        transparency: {
          sttPath: session.voiceInputProvider ?? "manual_text_fallback",
          ttsPath: session.voiceOutputProvider ?? "text_prompt_only",
          fallback: session.runtimeProviderMode === "manual_fallback"
        }
      },
      progress: {
        answeredBlocks: answeredBlocks.size,
        totalBlocks: template.blocks.length,
        ratio: Number(progressValue.toFixed(3)),
        currentQuestionKey: session.currentQuestionKey,
        currentQuestionIndex: session.currentQuestionIndex
      },
      activePrompt: activeTurn
        ? {
            turnId: activeTurn.id,
            sequenceNo: activeTurn.sequenceNo,
            blockKey: activeTurn.blockKey,
            questionKey: activeTurn.questionKey,
            category: activeTurn.category,
            kind: activeTurn.kind,
            text: activeTurn.promptText,
            followUpDepth: activeTurn.followUpDepth
          }
        : null,
      conversation: orderedTurns.map((turn) => ({
        id: turn.id,
        sequenceNo: turn.sequenceNo,
        blockKey: turn.blockKey,
        questionKey: turn.questionKey,
        category: turn.category,
        kind: turn.kind,
        promptText: turn.promptText,
        answerText: turn.answerText,
        completionStatus: turn.completionStatus,
        answerConfidence: turn.answerConfidence,
        followUpDepth: turn.followUpDepth,
        answerSource: turn.answerSource,
        answerSubmittedAt: turn.answerSubmittedAt
      })),
      transcript: session.transcript
        ? {
            id: session.transcript.id,
            qualityStatus: session.transcript.qualityStatus,
            segmentCount: session.transcript.segments.length,
            preview: session.transcript.segments.slice(-20).map((segment) => ({
              id: segment.id,
              speaker: segment.speaker,
              text: segment.text,
              startMs: segment.startMs,
              endMs: segment.endMs
            }))
          }
        : null,
      schedule: {
        scheduledAt: session.scheduledAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        abandonedAt: session.abandonedAt,
        completedReasonCode: session.completedReasonCode
      }
    };
  }

  private async updateTranscriptQualityOnCompletion(input: {
    tenantId: string;
    transcriptId?: string;
    completedBy: string;
    segments: Array<{ confidence: Prisma.Decimal | null }>;
  }) {
    if (!input.transcriptId) {
      return null;
    }

    const confidenceValues = input.segments
      .map((segment) => (segment.confidence === null ? null : Number(segment.confidence)))
      .filter((value): value is number => Number.isFinite(value));

    const qualityScore =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : null;

    const hasEnoughSegments = input.segments.length >= 5;
    const qualityStatus =
      hasEnoughSegments && qualityScore !== null && qualityScore >= 0.75
        ? TranscriptQualityStatus.VERIFIED
        : TranscriptQualityStatus.REVIEW_REQUIRED;

    const updated = await this.prisma.transcript.update({
      where: {
        id: input.transcriptId
      },
      data: {
        qualityStatus,
        qualityScore,
        qualityReviewedAt: qualityStatus === TranscriptQualityStatus.VERIFIED ? new Date() : null,
        qualityReviewedBy: qualityStatus === TranscriptQualityStatus.VERIFIED ? input.completedBy : null,
        finalizedAt: qualityStatus === TranscriptQualityStatus.VERIFIED ? new Date() : null,
        reviewNotes:
          qualityStatus === TranscriptQualityStatus.VERIFIED
            ? "Session tamamlanmasi sirasinda otomatik kalite kontrolu ile dogrulandi."
            : "Transcript kalite onayi icin manuel recruiter incelemesi gerekli.",
        version: {
          increment: 1
        }
      }
    });

    return {
      qualityStatus: updated.qualityStatus,
      qualityScore: updated.qualityScore
    };
  }

  private async runPostCompletionAutomation(input: {
    tenantId: string;
    sessionId: string;
    applicationId: string;
    candidateId: string;
    jobId: string;
    requestedBy: string;
    traceId?: string;
    force: boolean;
  }) {
    try {
      const enabled = input.force
        ? true
        : await this.featureFlagsService.isEnabled(
            input.tenantId,
            INTERVIEW_COMPLETION_REVIEW_PACK_FLAG,
            false
          );

      if (!enabled) {
        await this.prisma.interviewSession.update({
          where: {
            id: input.sessionId
          },
          data: {
            completionAutomationRunAt: new Date()
          }
        });

        return;
      }

      await this.requestReviewPack({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        requestedBy: input.requestedBy,
        traceId: input.traceId
      });

      await this.prisma.interviewSession.update({
        where: {
          id: input.sessionId
        },
        data: {
          completionAutomationRunAt: new Date()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "post_completion_automation_error";

      this.logger.warn("interview.post_completion_automation.failed", {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        applicationId: input.applicationId,
        traceId: input.traceId,
        error: message
      });

      await this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.SYSTEM,
        actorUserId: input.requestedBy,
        action: "interview.post_completion_automation.failed",
        entityType: "InterviewSession",
        entityId: input.sessionId,
        traceId: input.traceId,
        metadata: {
          applicationId: input.applicationId,
          reason: message
        }
      });
    }
  }

  private async resolveTemplate(input: {
    tenantId: string;
    templateId?: string;
    roleFamily: string;
  }) {
    if (input.templateId) {
      const byId = await this.prisma.interviewTemplate.findFirst({
        where: {
          id: input.templateId,
          tenantId: input.tenantId,
          isActive: true
        },
        select: {
          id: true,
          version: true
        }
      });

      if (!byId) {
        throw new NotFoundException("Interview template bulunamadi.");
      }

      return byId;
    }

    const byRole = await this.prisma.interviewTemplate.findFirst({
      where: {
        tenantId: input.tenantId,
        roleFamily: input.roleFamily,
        isActive: true
      },
      orderBy: {
        version: "desc"
      },
      select: {
        id: true,
        version: true
      }
    });

    if (byRole) {
      return byRole;
    }

    const anyActive = await this.prisma.interviewTemplate.findFirst({
      where: {
        tenantId: input.tenantId,
        isActive: true
      },
      orderBy: {
        version: "desc"
      },
      select: {
        id: true,
        version: true
      }
    });

    if (!anyActive) {
      throw new NotFoundException("Aktif interview template bulunamadi.");
    }

    return anyActive;
  }

  private async transitionApplicationStageIfNeeded(input: {
    tenantId: string;
    applicationId: string;
    targetStage: ApplicationStage;
    changedBy: string;
    reasonCode: string;
    traceId?: string;
  }) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: input.applicationId,
        tenantId: input.tenantId
      },
      select: {
        id: true,
        currentStage: true
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    if (application.currentStage === input.targetStage) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.candidateApplication.update({
        where: {
          id: application.id
        },
        data: {
          currentStage: input.targetStage,
          stageUpdatedAt: new Date()
        }
      });

      await tx.candidateStageHistory.create({
        data: {
          tenantId: input.tenantId,
          applicationId: application.id,
          fromStage: application.currentStage,
          toStage: input.targetStage,
          reasonCode: input.reasonCode,
          changedBy: input.changedBy
        }
      });
    });

    await Promise.all([
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: application.id,
        eventType: "application.stage_transitioned",
        traceId: input.traceId,
        payload: {
          fromStage: application.currentStage,
          toStage: input.targetStage,
          reasonCode: input.reasonCode,
          changedBy: input.changedBy
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.changedBy,
        actorType:
          input.changedBy.startsWith("candidate_") || input.changedBy === "candidate_public_link"
            ? AuditActorType.SYSTEM
            : AuditActorType.USER,
        action: "application.stage_transition",
        entityType: "CandidateApplication",
        entityId: application.id,
        traceId: input.traceId,
        metadata: {
          fromStage: application.currentStage,
          toStage: input.targetStage,
          reasonCode: input.reasonCode
        }
      })
    ]);
  }

  private async rollbackStageAfterCancellation(input: {
    tenantId: string;
    applicationId: string;
    cancelledBy: string;
    traceId?: string;
  }) {
    const [application, activeRemaining] = await Promise.all([
      this.prisma.candidateApplication.findFirst({
        where: {
          id: input.applicationId,
          tenantId: input.tenantId
        },
        select: {
          id: true,
          currentStage: true
        }
      }),
      this.prisma.interviewSession.count({
        where: {
          tenantId: input.tenantId,
          applicationId: input.applicationId,
          status: {
            in: [InterviewSessionStatus.SCHEDULED, InterviewSessionStatus.RUNNING]
          }
        }
      })
    ]);

    if (!application) {
      return;
    }

    if (application.currentStage !== ApplicationStage.INTERVIEW_SCHEDULED || activeRemaining > 0) {
      return;
    }

    await this.transitionApplicationStageIfNeeded({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      targetStage: ApplicationStage.SCREENING,
      changedBy: input.cancelledBy,
      reasonCode: "interview_session_cancelled",
      traceId: input.traceId
    });
  }

  private toSessionView(session: InterviewSessionRow) {
    const normalized = (() => {
      try {
        return this.normalizeTemplate(session.template.templateJson);
      } catch {
        return {
          introPrompt: "",
          closingPrompt: "",
          blocks: []
        } satisfies NormalizedInterviewTemplate;
      }
    })();
    const activeTurn = session.turns.find((turn) => turn.completionStatus === "ASKED" && !turn.answerText);
    const answeredBlocks = new Set(
      session.turns
        .filter((turn) => turn.completionStatus === "ANSWERED")
        .map((turn) => turn.blockKey)
    );

    return {
      id: session.id,
      tenantId: session.tenantId,
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
      schedulingSource: session.schedulingSource,
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
      candidateAccessToken:
        session.candidateAccessToken && session.status !== "COMPLETED"
          ? `${session.candidateAccessToken.slice(0, 5)}...`
          : null,
      candidateAccessExpiresAt: session.candidateAccessExpiresAt,
      candidateInterviewUrl:
        session.mode === "VOICE" && session.candidateAccessToken
          ? this.buildCandidateInterviewUrl(session.id, session.candidateAccessToken)
          : null,
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
        roleFamily: session.template.roleFamily,
        version: session.template.version
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
            segmentCount: session.transcript.segments.length,
            previewSegments: session.transcript.segments.slice(-12)
          }
        : null,
      turns: session.turns.map((turn) => ({
        id: turn.id,
        sequenceNo: turn.sequenceNo,
        blockKey: turn.blockKey,
        questionKey: turn.questionKey,
        category: turn.category,
        kind: turn.kind,
        promptText: turn.promptText,
        answerText: turn.answerText,
        answerConfidence: turn.answerConfidence,
        answerLatencyMs: turn.answerLatencyMs,
        answerDurationMs: turn.answerDurationMs,
        answerSource: turn.answerSource,
        answerSubmittedAt: turn.answerSubmittedAt,
        followUpDepth: turn.followUpDepth,
        completionStatus: turn.completionStatus,
        transitionDecision: turn.transitionDecision,
        decisionReason: turn.decisionReason
      })),
      activeTurn: activeTurn
        ? {
            id: activeTurn.id,
            sequenceNo: activeTurn.sequenceNo,
            blockKey: activeTurn.blockKey,
            questionKey: activeTurn.questionKey,
            category: activeTurn.category,
            promptText: activeTurn.promptText,
            kind: activeTurn.kind
          }
        : null,
      progress: {
        answeredBlocks: answeredBlocks.size,
        totalBlocks: normalized.blocks.length,
        ratio:
          normalized.blocks.length > 0
            ? Number((answeredBlocks.size / normalized.blocks.length).toFixed(3))
            : 0
      },
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }
}
