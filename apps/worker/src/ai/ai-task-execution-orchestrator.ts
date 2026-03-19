import {
  AiTaskStatus,
  AuditActorType,
  type Prisma,
  PrismaClient,
  type AiTaskRun
} from "@prisma/client";
import { AiTaskPolicyService } from "./policy/ai-task-policy.service.js";
import { StructuredAiProvider } from "./providers/structured-ai-provider.js";
import { TaskProcessingError } from "./task-processing-error.js";
import {
  asJsonObject,
  isSupportedWorkflowType,
  toRecord,
  WORKFLOW_TO_TASK_TYPE,
  type TaskExecutionResult
} from "./types.js";
import { CvParsingTaskService } from "./tasks/cv-parsing-task.service.js";
import { RecommendationGenerationTaskService } from "./tasks/recommendation-generation-task.service.js";
import { ReportGenerationTaskService } from "./tasks/report-generation-task.service.js";
import { ApplicantFitScoringTaskService } from "./tasks/applicant-fit-scoring-task.service.js";
import { ScreeningSupportTaskService } from "./tasks/screening-support-task.service.js";

export type WorkerPayload = {
  workflowJobId: string;
  tenantId: string;
  type: string;
  payload: Record<string, unknown>;
};

export class AiTaskExecutionOrchestrator {
  private readonly policy = new AiTaskPolicyService();
  private readonly provider = new StructuredAiProvider();
  private readonly cvParsingService: CvParsingTaskService;
  private readonly screeningSupportService: ScreeningSupportTaskService;
  private readonly reportGenerationService: ReportGenerationTaskService;
  private readonly recommendationGenerationService: RecommendationGenerationTaskService;
  private readonly fitScoringService: ApplicantFitScoringTaskService;

  constructor(private readonly prisma: PrismaClient) {
    this.cvParsingService = new CvParsingTaskService(prisma, this.policy, this.provider);
    this.screeningSupportService = new ScreeningSupportTaskService(
      prisma,
      this.policy,
      this.provider
    );
    this.reportGenerationService = new ReportGenerationTaskService(prisma, this.policy, this.provider);
    this.recommendationGenerationService = new RecommendationGenerationTaskService(
      prisma,
      this.policy,
      this.provider
    );
    this.fitScoringService = new ApplicantFitScoringTaskService(prisma, this.policy, this.provider);
  }

  async execute(payload: WorkerPayload, traceId?: string) {
    if (!isSupportedWorkflowType(payload.type)) {
      return {
        status: "unsupported_for_ai_execution",
        workflowJobId: payload.workflowJobId,
        type: payload.type
      };
    }

    const taskRunId = this.extractTaskRunId(payload.payload);
    const expectedTaskType = WORKFLOW_TO_TASK_TYPE[payload.type];

    const taskRun = await this.prisma.aiTaskRun.findFirst({
      where: {
        id: taskRunId,
        tenantId: payload.tenantId
      }
    });

    if (!taskRun) {
      throw new TaskProcessingError("TASK_RUN_NOT_FOUND", "AiTaskRun bulunamadi.", false, {
        taskRunId,
        workflowJobId: payload.workflowJobId
      });
    }

    if (taskRun.taskType !== expectedTaskType) {
      throw new TaskProcessingError(
        "TASK_TYPE_MISMATCH",
        "Workflow job tipi ile AiTaskRun taskType uyusmuyor.",
        false,
        {
          workflowType: payload.type,
          taskRunType: taskRun.taskType,
          expectedTaskType
        }
      );
    }

    const startedAt = new Date();

    await this.prisma.aiTaskRun.update({
      where: {
        id: taskRun.id
      },
      data: {
        status: AiTaskStatus.RUNNING,
        startedAt,
        completedAt: null,
        errorMessage: null
      }
    });

    await this.writeAudit({
      tenantId: payload.tenantId,
      traceId,
      action: "ai.task_run.started",
      entityId: taskRun.id,
      metadata: {
        taskType: taskRun.taskType,
        workflowJobId: payload.workflowJobId,
        triggerSource: this.readTriggerSource(taskRun)
      }
    });

    await this.appendEvent({
      tenantId: payload.tenantId,
      traceId,
      aggregateType: "AiTaskRun",
      aggregateId: taskRun.id,
      eventType: "ai.task_run.started",
      payload: {
        taskType: taskRun.taskType,
        workflowJobId: payload.workflowJobId,
        startedAt: startedAt.toISOString()
      }
    });

    await this.appendTaskLifecycleRecords({
      phase: "started",
      tenantId: payload.tenantId,
      traceId,
      taskRun,
      workflowJobId: payload.workflowJobId
    });

    try {
      const result = await this.executeByTaskType(taskRun, payload, traceId);

      const completedAt = new Date();
      await this.prisma.aiTaskRun.update({
        where: {
          id: taskRun.id
        },
        data: {
          status: AiTaskStatus.SUCCEEDED,
          completedAt,
          outputJson: result.outputJson,
          uncertaintyJson: result.uncertaintyJson,
          guardrailFlags: result.guardrailFlags,
          providerKey: result.providerKey,
          modelKey: result.modelKey,
          promptVersion: result.promptVersion,
          policyVersion: result.policyVersion,
          errorMessage: null,
          ...(result.artifacts?.reportId ? { aiReportId: result.artifacts.reportId } : {})
        }
      });

      await this.writeAudit({
        tenantId: payload.tenantId,
        traceId,
        action: "ai.task_run.succeeded",
        entityId: taskRun.id,
        metadata: {
          taskType: taskRun.taskType,
          workflowJobId: payload.workflowJobId,
          providerMode: result.providerMode,
          providerKey: result.providerKey,
          modelKey: result.modelKey,
          artifacts: result.artifacts ?? {}
        }
      });

      await this.appendEvent({
        tenantId: payload.tenantId,
        traceId,
        aggregateType: "AiTaskRun",
        aggregateId: taskRun.id,
        eventType: "ai.task_run.succeeded",
        payload: {
          taskType: taskRun.taskType,
          workflowJobId: payload.workflowJobId,
          providerMode: result.providerMode,
          artifacts: result.artifacts ?? {},
          completedAt: completedAt.toISOString()
        }
      });

      await this.appendTaskLifecycleRecords({
        phase: "succeeded",
        tenantId: payload.tenantId,
        traceId,
        taskRun,
        workflowJobId: payload.workflowJobId,
        result
      });

      await this.appendArtifactEvents({
        tenantId: payload.tenantId,
        traceId,
        taskRun,
        result
      });

      return {
        status: "succeeded",
        taskRunId: taskRun.id,
        workflowJobId: payload.workflowJobId,
        taskType: taskRun.taskType,
        artifacts: result.artifacts ?? {}
      };
    } catch (error) {
      const processed = this.normalizeError(error, taskRun, payload.workflowJobId);
      const completedAt = new Date();

      await this.prisma.aiTaskRun.update({
        where: {
          id: taskRun.id
        },
        data: {
          status: AiTaskStatus.FAILED,
          completedAt,
          errorMessage: processed.error.message,
          outputJson: processed.output,
          uncertaintyJson: asJsonObject({
            level: "yuksek",
            reasons: [processed.error.message],
            recoverable: processed.error.recoverable
          }),
          guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(taskRun.taskType))
        }
      });

      await this.writeAudit({
        tenantId: payload.tenantId,
        traceId,
        action: "ai.task_run.failed",
        entityId: taskRun.id,
        metadata: {
          taskType: taskRun.taskType,
          workflowJobId: payload.workflowJobId,
          error: processed.error
        }
      });

      await this.appendEvent({
        tenantId: payload.tenantId,
        traceId,
        aggregateType: "AiTaskRun",
        aggregateId: taskRun.id,
        eventType: "ai.task_run.failed",
        payload: {
          taskType: taskRun.taskType,
          workflowJobId: payload.workflowJobId,
          error: processed.error,
          completedAt: completedAt.toISOString()
        }
      });

      await this.appendTaskLifecycleRecords({
        phase: "failed",
        tenantId: payload.tenantId,
        traceId,
        taskRun,
        workflowJobId: payload.workflowJobId,
        failure: {
          ...processed.error,
          details: processed.error.details ?? {}
        }
      });

      throw error;
    }
  }

  private async executeByTaskType(
    taskRun: AiTaskRun,
    payload: WorkerPayload,
    traceId?: string
  ): Promise<TaskExecutionResult> {
    const context = {
      taskRun,
      tenantId: payload.tenantId,
      workflowJobId: payload.workflowJobId,
      traceId
    };

    switch (taskRun.taskType) {
      case "CV_PARSING":
        return this.cvParsingService.execute(context);
      case "SCREENING_SUPPORT":
        return this.screeningSupportService.execute(context);
      case "REPORT_GENERATION":
        return this.reportGenerationService.execute(context);
      case "RECOMMENDATION_GENERATION":
        return this.recommendationGenerationService.execute(context);
      case "APPLICANT_FIT_SCORING":
        return this.fitScoringService.execute(context);
      default:
        throw new TaskProcessingError(
          "TASK_TYPE_NOT_IMPLEMENTED",
          `Task type desteklenmiyor: ${taskRun.taskType}`,
          false,
          {
            taskType: taskRun.taskType
          }
        );
    }
  }

  private extractTaskRunId(payload: Record<string, unknown>) {
    const value = payload.taskRunId;

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TaskProcessingError(
        "TASK_RUN_ID_MISSING",
        "Worker payload icinde taskRunId bulunamadi.",
        false,
        {
          payloadKeys: Object.keys(payload)
        }
      );
    }

    return value;
  }

  private normalizeError(error: unknown, taskRun: AiTaskRun, workflowJobId: string) {
    if (error instanceof TaskProcessingError) {
      return {
        error: {
          code: error.code,
          message: error.message,
          recoverable: error.recoverable,
          details: error.details
        },
        output: asJsonObject({
          schemaVersion: "ai_task_error.v1",
          status: "failed",
          taskType: taskRun.taskType,
          workflowJobId,
          error: {
            code: error.code,
            message: error.message,
            recoverable: error.recoverable,
            details: error.details
          },
          safety: {
            autoDecisionApplied: false,
            autoRejectAllowed: false,
            recruiterReviewRequired: true
          }
        })
      };
    }

    const message = error instanceof Error ? error.message : "Bilinmeyen worker hatasi";

    return {
      error: {
        code: "UNEXPECTED_ERROR",
        message,
        recoverable: true,
        details: {}
      },
      output: asJsonObject({
        schemaVersion: "ai_task_error.v1",
        status: "failed",
        taskType: taskRun.taskType,
        workflowJobId,
        error: {
          code: "UNEXPECTED_ERROR",
          message,
          recoverable: true,
          details: {}
        },
        safety: {
          autoDecisionApplied: false,
          autoRejectAllowed: false,
          recruiterReviewRequired: true
        }
      })
    };
  }

  private async writeAudit(input: {
    tenantId: string;
    traceId?: string;
    action: string;
    entityType?: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: input.action,
        entityType: input.entityType ?? "AiTaskRun",
        entityId: input.entityId,
        traceId: input.traceId,
        metadata: input.metadata as Prisma.InputJsonValue
      }
    });
  }

  private async appendEvent(input: {
    tenantId: string;
    traceId?: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) {
    await this.prisma.domainEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        traceId: input.traceId,
        payload: input.payload as Prisma.InputJsonValue
      }
    });
  }

  private async appendArtifactEvents(input: {
    tenantId: string;
    traceId?: string;
    taskRun: AiTaskRun;
    result: TaskExecutionResult;
  }) {
    if (input.result.artifacts?.cvParsedProfileId) {
      await this.appendEvent({
        tenantId: input.tenantId,
        traceId: input.traceId,
        aggregateType: "CVParsedProfile",
        aggregateId: input.result.artifacts.cvParsedProfileId,
        eventType: "candidate.cv_profile.parsed",
        payload: {
          taskRunId: input.taskRun.id,
          candidateId: input.taskRun.candidateId
        }
      });
    }

    if (input.result.artifacts?.reportId) {
      await this.appendEvent({
        tenantId: input.tenantId,
        traceId: input.traceId,
        aggregateType: "AiReport",
        aggregateId: input.result.artifacts.reportId,
        eventType: "ai.report.generated",
        payload: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId,
          sessionId: input.taskRun.sessionId
        }
      });
    }

    if (input.result.artifacts?.recommendationId) {
      await this.appendEvent({
        tenantId: input.tenantId,
        traceId: input.traceId,
        aggregateType: "ApplicationRecommendation",
        aggregateId: input.result.artifacts.recommendationId,
        eventType: "application.recommendation.generated",
        payload: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId,
          requiresHumanApproval: true
        }
      });
    }

    if (input.result.artifacts?.fitScoreId) {
      await this.appendEvent({
        tenantId: input.tenantId,
        traceId: input.traceId,
        aggregateType: "ApplicantFitScore",
        aggregateId: input.result.artifacts.fitScoreId,
        eventType: "application.fit_score.generated",
        payload: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId
        }
      });
    }
  }

  private readTriggerSource(taskRun: AiTaskRun) {
    const inputJson = toRecord(taskRun.inputJson);
    return typeof inputJson.triggerSource === "string" ? inputJson.triggerSource : "manual";
  }

  private async appendTaskLifecycleRecords(input: {
    phase: "started" | "succeeded" | "failed";
    tenantId: string;
    traceId?: string;
    taskRun: AiTaskRun;
    workflowJobId: string;
    result?: TaskExecutionResult;
    failure?: {
      code: string;
      message: string;
      recoverable: boolean;
      details: Record<string, unknown>;
    };
  }) {
    if (input.taskRun.taskType === "CV_PARSING") {
      const inputJson = toRecord(input.taskRun.inputJson);
      const outputJson = toRecord(input.result?.outputJson);
      const additional = toRecord(outputJson.additional);
      const cvFileId =
        typeof inputJson.cvFileId === "string"
          ? inputJson.cvFileId
          : typeof additional.cvFileId === "string"
            ? additional.cvFileId
            : null;

      const action = `candidate.cv.parsing.${input.phase}`;
      const eventType = `candidate.cv.parsing.${input.phase}`;

      await this.writeAudit({
        tenantId: input.tenantId,
        traceId: input.traceId,
        action,
        entityType: cvFileId ? "CVFile" : "AiTaskRun",
        entityId: cvFileId ?? input.taskRun.id,
        metadata: {
          taskRunId: input.taskRun.id,
          workflowJobId: input.workflowJobId,
          candidateId: input.taskRun.candidateId,
          cvFileId,
          ...(input.result
            ? {
                providerMode: input.result.providerMode,
                providerKey: input.result.providerKey
              }
            : {}),
          ...(input.failure ? { error: input.failure } : {})
        }
      });

      await this.appendEvent({
        tenantId: input.tenantId,
        traceId: input.traceId,
        aggregateType: cvFileId ? "CVFile" : "Candidate",
        aggregateId: cvFileId ?? (input.taskRun.candidateId ?? input.taskRun.id),
        eventType,
        payload: {
          taskRunId: input.taskRun.id,
          candidateId: input.taskRun.candidateId,
          cvFileId,
          workflowJobId: input.workflowJobId,
          ...(input.failure ? { error: input.failure } : {})
        }
      });
    }

    if (input.taskRun.taskType === "SCREENING_SUPPORT") {
      const action = `application.screening_support.${input.phase}`;
      const eventType = `application.screening_support.${input.phase}`;

      await this.writeAudit({
        tenantId: input.tenantId,
        traceId: input.traceId,
        action,
        entityType: input.taskRun.applicationId ? "CandidateApplication" : "AiTaskRun",
        entityId: input.taskRun.applicationId ?? input.taskRun.id,
        metadata: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId,
          candidateId: input.taskRun.candidateId,
          workflowJobId: input.workflowJobId,
          ...(input.result
            ? {
                providerMode: input.result.providerMode,
                providerKey: input.result.providerKey
              }
            : {}),
          ...(input.failure ? { error: input.failure } : {})
        }
      });

      if (input.taskRun.applicationId) {
        await this.appendEvent({
          tenantId: input.tenantId,
          traceId: input.traceId,
          aggregateType: "CandidateApplication",
          aggregateId: input.taskRun.applicationId,
          eventType,
          payload: {
            taskRunId: input.taskRun.id,
            applicationId: input.taskRun.applicationId,
            workflowJobId: input.workflowJobId,
            ...(input.failure ? { error: input.failure } : {})
          }
        });
      }
    }

    if (input.taskRun.taskType === "REPORT_GENERATION") {
      const normalizedPhase =
        input.phase === "succeeded" ? "generated" : input.phase === "failed" ? "failed" : "started";
      const action = `application.report.${normalizedPhase}`;
      const eventType = `application.report.${normalizedPhase}`;

      await this.writeAudit({
        tenantId: input.tenantId,
        traceId: input.traceId,
        action,
        entityType: input.taskRun.applicationId ? "CandidateApplication" : "AiTaskRun",
        entityId: input.taskRun.applicationId ?? input.taskRun.id,
        metadata: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId,
          sessionId: input.taskRun.sessionId,
          workflowJobId: input.workflowJobId,
          ...(input.result
            ? {
                providerMode: input.result.providerMode,
                providerKey: input.result.providerKey,
                reportId: input.result.artifacts?.reportId ?? null
              }
            : {}),
          ...(input.failure ? { error: input.failure } : {})
        }
      });

      if (input.taskRun.applicationId) {
        await this.appendEvent({
          tenantId: input.tenantId,
          traceId: input.traceId,
          aggregateType: "CandidateApplication",
          aggregateId: input.taskRun.applicationId,
          eventType,
          payload: {
            taskRunId: input.taskRun.id,
            applicationId: input.taskRun.applicationId,
            sessionId: input.taskRun.sessionId,
            workflowJobId: input.workflowJobId,
            ...(input.result ? { reportId: input.result.artifacts?.reportId ?? null } : {}),
            ...(input.failure ? { error: input.failure } : {})
          }
        });
      }
    }

    if (input.taskRun.taskType === "RECOMMENDATION_GENERATION") {
      const normalizedPhase =
        input.phase === "succeeded" ? "generated" : input.phase === "failed" ? "failed" : "started";
      const action = `application.recommendation.${normalizedPhase}`;
      const eventType = `application.recommendation.${normalizedPhase}`;

      await this.writeAudit({
        tenantId: input.tenantId,
        traceId: input.traceId,
        action,
        entityType: input.taskRun.applicationId ? "CandidateApplication" : "AiTaskRun",
        entityId: input.taskRun.applicationId ?? input.taskRun.id,
        metadata: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId,
          sessionId: input.taskRun.sessionId,
          workflowJobId: input.workflowJobId,
          ...(input.result
            ? {
                providerMode: input.result.providerMode,
                providerKey: input.result.providerKey,
                recommendationId: input.result.artifacts?.recommendationId ?? null
              }
            : {}),
          ...(input.failure ? { error: input.failure } : {})
        }
      });

      if (input.taskRun.applicationId) {
        await this.appendEvent({
          tenantId: input.tenantId,
          traceId: input.traceId,
          aggregateType: "CandidateApplication",
          aggregateId: input.taskRun.applicationId,
          eventType,
          payload: {
            taskRunId: input.taskRun.id,
            applicationId: input.taskRun.applicationId,
            sessionId: input.taskRun.sessionId,
            workflowJobId: input.workflowJobId,
            ...(input.result
              ? { recommendationId: input.result.artifacts?.recommendationId ?? null }
              : {}),
            ...(input.failure ? { error: input.failure } : {})
          }
        });
      }
    }

    if (input.taskRun.taskType === "APPLICANT_FIT_SCORING") {
      const normalizedPhase =
        input.phase === "succeeded" ? "scored" : input.phase === "failed" ? "failed" : "started";
      const action = `application.fit_scoring.${normalizedPhase}`;
      const eventType = `application.fit_scoring.${normalizedPhase}`;

      await this.writeAudit({
        tenantId: input.tenantId,
        traceId: input.traceId,
        action,
        entityType: input.taskRun.applicationId ? "CandidateApplication" : "AiTaskRun",
        entityId: input.taskRun.applicationId ?? input.taskRun.id,
        metadata: {
          taskRunId: input.taskRun.id,
          applicationId: input.taskRun.applicationId,
          candidateId: input.taskRun.candidateId,
          workflowJobId: input.workflowJobId,
          ...(input.result
            ? {
                providerMode: input.result.providerMode,
                providerKey: input.result.providerKey,
                fitScoreId: input.result.artifacts?.fitScoreId ?? null
              }
            : {}),
          ...(input.failure ? { error: input.failure } : {})
        }
      });

      if (input.taskRun.applicationId) {
        await this.appendEvent({
          tenantId: input.tenantId,
          traceId: input.traceId,
          aggregateType: "CandidateApplication",
          aggregateId: input.taskRun.applicationId,
          eventType,
          payload: {
            taskRunId: input.taskRun.id,
            applicationId: input.taskRun.applicationId,
            candidateId: input.taskRun.candidateId,
            workflowJobId: input.workflowJobId,
            ...(input.result ? { fitScoreId: input.result.artifacts?.fitScoreId ?? null } : {}),
            ...(input.failure ? { error: input.failure } : {})
          }
        });
      }
    }
  }
}
