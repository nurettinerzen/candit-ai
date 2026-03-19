import {
  Injectable,
  NotFoundException, Inject} from "@nestjs/common";
import { AiTaskStatus, AiTaskType, type AiTaskRun } from "@prisma/client";
import { AiOrchestrationService } from "../ai-orchestration/ai-orchestration.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { PrismaService } from "../../prisma/prisma.service";

export type TriggerScreeningInput = {
  tenantId: string;
  applicationId: string;
  requestedBy: string;
  traceId?: string;
  providerKey?: string;
};

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService
  ) {}

  async trigger(input: TriggerScreeningInput) {
    const application = await this.ensureApplicationExists(input.tenantId, input.applicationId);

    const activeRuns = await this.prisma.aiTaskRun.findMany({
      where: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        taskType: AiTaskType.SCREENING_SUPPORT,
        status: {
          in: [AiTaskStatus.PENDING, AiTaskStatus.QUEUED, AiTaskStatus.RUNNING]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    });

    const run = activeRuns[0];

    if (run) {

      return {
        idempotent: true,
        taskRun: {
          taskRunId: run.id,
          taskType: run.taskType,
          status: run.status,
          workflowJobId: run.workflowJobId,
          createdAt: run.createdAt.toISOString()
        }
      };
    }

    const latestCvFile = await this.prisma.cVFile.findFirst({
      where: {
        tenantId: input.tenantId,
        candidateId: application.candidateId
      },
      include: {
        parsedProfile: true
      },
      orderBy: [{ isPrimary: "desc" }, { uploadedAt: "desc" }]
    });

    const taskRun = await this.aiOrchestrationService.createTaskRun({
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      taskType: AiTaskType.SCREENING_SUPPORT,
      candidateId: application.candidateId,
      jobId: application.jobId,
      applicationId: application.id,
      providerKey: input.providerKey,
      traceId: input.traceId,
      input: {
        triggerSource: "manual_ui",
        triggerReasonCode: "screening_support_requested",
        cvFileId: latestCvFile?.id ?? null,
        cvParsedProfileId: latestCvFile?.parsedProfile?.id ?? null,
        hasCvParsedProfile: Boolean(latestCvFile?.parsedProfile),
        currentStage: application.currentStage
      }
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        action: "application.screening_support.requested",
        entityType: "CandidateApplication",
        entityId: input.applicationId,
        traceId: input.traceId,
        metadata: {
          taskRunId: taskRun.taskRunId,
          workflowJobId: taskRun.workflowJobId ?? null,
          hasCvParsedProfile: Boolean(latestCvFile?.parsedProfile),
          cvFileId: latestCvFile?.id ?? null
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: input.applicationId,
        eventType: "application.screening_support.requested",
        traceId: input.traceId,
        payload: {
          taskRunId: taskRun.taskRunId,
          candidateId: application.candidateId,
          jobId: application.jobId
        }
      })
    ]);

    return {
      idempotent: false,
      taskRun
    };
  }

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
        id: true,
        tenantId: true,
        candidateId: true,
        jobId: true,
        currentStage: true
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    return application;
  }
}
