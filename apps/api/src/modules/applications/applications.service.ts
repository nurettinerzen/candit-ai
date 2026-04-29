import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException, Inject} from "@nestjs/common";
import {
  ApplicationStage,
  AuditActorType,
  Prisma,
  Recommendation
} from "@prisma/client";
import { AuditWriterService } from "../audit/audit-writer.service";
import { BillingService } from "../billing/billing.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { HumanApprovalService } from "../policy/human-approval.service";
import { ReportsService } from "../reports/reports.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ApplicationAutomationService } from "./application-automation.service";
import { ApplicationQueryService } from "./application-query.service";

type CreateApplicationInput = {
  tenantId: string;
  candidateId: string;
  jobId: string;
  createdBy?: string;
  traceId?: string;
  suppressAutomation?: boolean;
};

type StageTransitionInput = {
  tenantId: string;
  applicationId: string;
  toStage: ApplicationStage;
  reasonCode: string;
  changedBy: string;
  traceId?: string;
};

type DecisionInput = {
  tenantId: string;
  applicationId: string;
  aiReportId: string;
  reasonCode: string;
  decision: "advance" | "hold" | "reject";
  changedBy: string;
  humanApprovedBy: string;
  traceId?: string;
};

type BulkDeleteApplicationsInput = {
  tenantId: string;
  applicationIds: string[];
  deletedBy: string;
};

type ReferenceCheckResponseInput = {
  question: string;
  answer: string;
};

type CreateReferenceCheckInput = {
  tenantId: string;
  applicationId: string;
  createdBy: string;
  referenceName: string;
  companyName?: string;
  relationship?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: string;
  openEndedResponses?: ReferenceCheckResponseInput[];
  closedEndedResponses?: ReferenceCheckResponseInput[];
  summaryText?: string;
};

type UpdateReferenceCheckInput = CreateReferenceCheckInput & {
  referenceCheckId: string;
};

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(HumanApprovalService) private readonly humanApprovalService: HumanApprovalService,
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(ApplicationQueryService) private readonly applicationQueryService: ApplicationQueryService,
    @Inject(ApplicationAutomationService) private readonly applicationAutomationService: ApplicationAutomationService
  ) {}

  list(tenantId: string, stage?: ApplicationStage, jobId?: string) {
    return this.applicationQueryService.list(tenantId, stage, jobId);
  }

  getById(tenantId: string, id: string) {
    return this.applicationQueryService.getById(tenantId, id);
  }

  async listReferenceChecks(tenantId: string, applicationId: string) {
    await this.assertJobActionable(tenantId, applicationId);

    return this.prisma.referenceCheck.findMany({
      where: {
        tenantId,
        applicationId
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async assertJobActionable(tenantId: string, applicationId: string) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: applicationId,
        tenantId
      },
      include: {
        job: {
          select: {
            status: true
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    if (application.job.status === "ARCHIVED") {
      throw new BadRequestException("Arşivli ilanda aşama değiştirilemez.");
    }

    return application;
  }

  async create(input: CreateApplicationInput) {
    await this.billingService.assertCanProcessCandidate(input.tenantId);

    const [candidate, job] = await Promise.all([
      this.prisma.candidate.findFirst({
        where: { id: input.candidateId, tenantId: input.tenantId, deletedAt: null }
      }),
      this.prisma.job.findFirst({
        where: { id: input.jobId, tenantId: input.tenantId, archivedAt: null }
      })
    ]);

    if (!candidate) {
      throw new NotFoundException("Aday bulunamadi.");
    }

    if (!job) {
      throw new NotFoundException("Job bulunamadi.");
    }

    try {
      const application = await this.prisma.$transaction(async (tx) => {
        const created = await tx.candidateApplication.create({
          data: {
            tenantId: input.tenantId,
            candidateId: input.candidateId,
            jobId: input.jobId,
            currentStage: ApplicationStage.APPLIED,
            stageUpdatedAt: new Date(),
            humanDecisionRequired: true
          }
        });

        await tx.candidateStageHistory.create({
          data: {
            tenantId: input.tenantId,
            applicationId: created.id,
            fromStage: null,
            toStage: ApplicationStage.APPLIED,
            reasonCode: "application_created",
            changedBy: input.createdBy ?? "system:application.created"
          }
        });

        return created;
      });

      await Promise.all([
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "CandidateApplication",
          aggregateId: application.id,
          eventType: "application.created",
          traceId: input.traceId,
          payload: {
            candidateId: input.candidateId,
            jobId: input.jobId,
            createdBy: input.createdBy
          }
        }),
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorUserId: input.createdBy,
          action: "application.created",
          entityType: "CandidateApplication",
          entityId: application.id,
          traceId: input.traceId,
          metadata: {
            candidateId: input.candidateId,
            jobId: input.jobId,
            createdBy: input.createdBy
          }
        })
      ]);

      if (!input.suppressAutomation) {
        await this.applicationAutomationService.onApplicationCreated({
          tenantId: input.tenantId,
          applicationId: application.id,
          candidateId: input.candidateId,
          jobId: input.jobId,
          requestedBy: input.createdBy ?? "system:application.created",
          traceId: input.traceId
        });
      }

      await this.billingService.recordCandidateProcessingUsage(
        input.tenantId,
        application.id
      );

      return application;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Aday bu job icin zaten basvuru yapmis.");
      }

      throw error;
    }
  }

  async stageTransition(input: StageTransitionInput) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: input.applicationId,
        tenantId: input.tenantId
      },
      include: {
        job: {
          select: {
            status: true
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    if (application.currentStage === input.toStage) {
      throw new BadRequestException("Basvuru zaten secilen stage durumunda.");
    }

    if (application.job.status === "ARCHIVED") {
      throw new BadRequestException("Arşivli ilanda aşama değiştirilemez.");
    }

    if (!input.reasonCode || input.reasonCode.trim().length === 0) {
      throw new BadRequestException("Stage degisimi icin reasonCode zorunludur.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.candidateApplication.update({
        where: { id: input.applicationId },
        data: {
          currentStage: input.toStage,
          stageUpdatedAt: new Date()
        }
      });

      await tx.candidateStageHistory.create({
        data: {
          tenantId: input.tenantId,
          applicationId: application.id,
          fromStage: application.currentStage,
          toStage: input.toStage,
          reasonCode: input.reasonCode.trim(),
          changedBy: input.changedBy
        }
      });

      const audit = await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.changedBy,
          actorType: AuditActorType.USER,
          action: "application.stage_transition",
          entityType: "CandidateApplication",
          entityId: application.id,
          traceId: input.traceId,
          metadata: {
            fromStage: application.currentStage,
            toStage: input.toStage,
            reasonCode: input.reasonCode.trim()
          }
        }
      });

      return {
        application: updated,
        auditId: audit.id
      };
    });

    await this.domainEventsService.append({
      tenantId: input.tenantId,
      aggregateType: "CandidateApplication",
      aggregateId: result.application.id,
      eventType: "application.stage_transitioned",
      traceId: input.traceId,
      payload: {
        fromStage: application.currentStage,
        toStage: input.toStage,
        reasonCode: input.reasonCode.trim(),
        changedBy: input.changedBy
      }
    });

    await this.applicationAutomationService.onStageTransition({
      tenantId: input.tenantId,
      applicationId: result.application.id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      fromStage: application.currentStage,
      toStage: result.application.currentStage,
      changedBy: input.changedBy,
      traceId: input.traceId
    });

    return {
      applicationId: result.application.id,
      fromStage: application.currentStage,
      toStage: result.application.currentStage,
      changedAt: result.application.stageUpdatedAt,
      auditId: result.auditId
    };
  }

  async decision(input: DecisionInput) {
    this.humanApprovalService.assertRequesterMatchesApprover(
      input.changedBy,
      input.humanApprovedBy
    );

    await this.reportsService.assertReportBelongsToApplication(
      input.tenantId,
      input.applicationId,
      input.aiReportId
    );

    const decisionStage = this.mapDecisionToStage(input.decision);
    const recommendation = this.mapDecisionToRecommendation(input.decision);

    const result = await this.stageTransition({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      toStage: decisionStage,
      reasonCode: input.reasonCode,
      changedBy: input.changedBy,
      traceId: input.traceId
    });

    await this.prisma.candidateApplication.update({
      where: { id: input.applicationId },
      data: {
        aiRecommendation: recommendation,
        humanDecisionRequired: true
      }
    });

    await this.humanApprovalService.record({
      tenantId: input.tenantId,
      actionType: "application.decision",
      entityType: "CandidateApplication",
      entityId: input.applicationId,
      requestedBy: input.changedBy,
      approvedBy: input.humanApprovedBy,
      reasonCode: input.reasonCode,
      metadata: {
        decision: input.decision,
        aiReportId: input.aiReportId,
        reasonCode: input.reasonCode
      }
    });

    const [audit] = await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.changedBy,
        action: "application.decision",
        entityType: "CandidateApplication",
        entityId: input.applicationId,
        traceId: input.traceId,
        metadata: {
          decision: input.decision,
          aiReportId: input.aiReportId,
          reasonCode: input.reasonCode
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: input.applicationId,
        eventType: "application.decision_recorded",
        traceId: input.traceId,
        payload: {
          decision: input.decision,
          aiReportId: input.aiReportId,
          reasonCode: input.reasonCode,
          approvedBy: input.humanApprovedBy
        }
      })
    ]);

    return {
      applicationId: result.applicationId,
      status: decisionStage.toLowerCase(),
      changedBy: input.changedBy,
      changedAt: new Date().toISOString(),
      auditId: audit.id
    };
  }

  async deleteMany(input: BulkDeleteApplicationsInput) {
    const applicationIds = [...new Set(input.applicationIds.map((item) => item.trim()).filter(Boolean))];
    if (applicationIds.length === 0) {
      throw new NotFoundException("Silinecek basvuru bulunamadi.");
    }

    const applications = await this.prisma.candidateApplication.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: applicationIds }
      },
      select: {
        id: true,
        candidateId: true,
        jobId: true,
        currentStage: true,
        candidate: {
          select: {
            fullName: true
          }
        },
        job: {
          select: {
            title: true
          }
        }
      }
    });

    if (applications.length !== applicationIds.length) {
      throw new NotFoundException("Secilen basvurulardan biri bulunamadi.");
    }

    await this.prisma.candidateApplication.deleteMany({
      where: {
        tenantId: input.tenantId,
        id: { in: applicationIds }
      }
    });

    await Promise.all(
      applications.flatMap((application) => [
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorUserId: input.deletedBy,
          action: "application.deleted",
          entityType: "CandidateApplication",
          entityId: application.id,
          metadata: {
            candidateId: application.candidateId,
            candidateName: application.candidate.fullName,
            jobId: application.jobId,
            jobTitle: application.job.title,
            stage: application.currentStage
          }
        }),
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "CandidateApplication",
          aggregateId: application.id,
          eventType: "application.deleted",
          payload: {
            deletedBy: input.deletedBy,
            candidateId: application.candidateId,
            candidateName: application.candidate.fullName,
            jobId: application.jobId,
            jobTitle: application.job.title,
            stage: application.currentStage
          }
        })
      ])
    );

    return {
      deletedCount: applications.length,
      deletedIds: applications.map((application) => application.id)
    };
  }

  async createReferenceCheck(input: CreateReferenceCheckInput) {
    const application = await this.assertJobActionable(input.tenantId, input.applicationId);
    const normalized = this.normalizeReferenceCheckInput(input);

    const referenceCheck = await this.prisma.referenceCheck.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        referenceName: normalized.referenceName,
        companyName: normalized.companyName,
        relationship: normalized.relationship,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        status: normalized.status,
        openEndedResponsesJson: normalized.openEndedResponses as Prisma.InputJsonValue,
        closedEndedResponsesJson: normalized.closedEndedResponses as Prisma.InputJsonValue,
        summaryText: normalized.summaryText,
        createdBy: input.createdBy,
        completedAt: normalized.status === "COMPLETED" ? new Date() : null
      }
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.createdBy,
        action: "application.reference_check.created",
        entityType: "ReferenceCheck",
        entityId: referenceCheck.id,
        metadata: {
          applicationId: input.applicationId,
          candidateId: application.candidateId,
          jobId: application.jobId,
          status: referenceCheck.status,
          referenceName: referenceCheck.referenceName
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: input.applicationId,
        eventType: "application.reference_check.created",
        payload: {
          referenceCheckId: referenceCheck.id,
          status: referenceCheck.status,
          referenceName: referenceCheck.referenceName,
          createdBy: input.createdBy
        }
      })
    ]);

    return referenceCheck;
  }

  async updateReferenceCheck(input: UpdateReferenceCheckInput) {
    await this.assertJobActionable(input.tenantId, input.applicationId);
    const normalized = this.normalizeReferenceCheckInput(input);

    const existing = await this.prisma.referenceCheck.findFirst({
      where: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        id: input.referenceCheckId
      }
    });

    if (!existing) {
      throw new NotFoundException("Referans araştırması bulunamadı.");
    }

    const referenceCheck = await this.prisma.referenceCheck.update({
      where: {
        id: existing.id
      },
      data: {
        referenceName: normalized.referenceName,
        companyName: normalized.companyName,
        relationship: normalized.relationship,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        status: normalized.status,
        openEndedResponsesJson: normalized.openEndedResponses as Prisma.InputJsonValue,
        closedEndedResponsesJson: normalized.closedEndedResponses as Prisma.InputJsonValue,
        summaryText: normalized.summaryText,
        completedAt:
          normalized.status === "COMPLETED"
            ? existing.completedAt ?? new Date()
            : null
      }
    });

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorUserId: input.createdBy,
      action: "application.reference_check.updated",
      entityType: "ReferenceCheck",
      entityId: referenceCheck.id,
      metadata: {
        applicationId: input.applicationId,
        status: referenceCheck.status,
        referenceName: referenceCheck.referenceName
      }
    });

    return referenceCheck;
  }

  private mapDecisionToStage(decision: "advance" | "hold" | "reject") {
    switch (decision) {
      case "advance":
        return ApplicationStage.HIRING_MANAGER_REVIEW;
      case "hold":
        return ApplicationStage.RECRUITER_REVIEW;
      case "reject":
        return ApplicationStage.REJECTED;
      default:
        return ApplicationStage.RECRUITER_REVIEW;
    }
  }

  private mapDecisionToRecommendation(decision: "advance" | "hold" | "reject") {
    switch (decision) {
      case "advance":
        return Recommendation.ADVANCE;
      case "hold":
        return Recommendation.HOLD;
      case "reject":
        return Recommendation.REVIEW;
      default:
        return Recommendation.REVIEW;
    }
  }

  private normalizeReferenceCheckInput(
    input:
      | CreateReferenceCheckInput
      | UpdateReferenceCheckInput
  ) {
    const referenceName = input.referenceName.trim();
    if (referenceName.length < 2) {
      throw new BadRequestException("Referans adı en az 2 karakter olmalıdır.");
    }

    const normalizeResponseList = (value: ReferenceCheckResponseInput[] | undefined) =>
      (value ?? [])
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim()
        }))
        .filter((item) => item.question.length > 0 || item.answer.length > 0);

    return {
      referenceName,
      companyName: input.companyName?.trim() || null,
      relationship: input.relationship?.trim() || null,
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      contactPhone: input.contactPhone?.trim() || null,
      status: input.status?.trim().toUpperCase() || "DRAFT",
      openEndedResponses: normalizeResponseList(input.openEndedResponses),
      closedEndedResponses: normalizeResponseList(input.closedEndedResponses),
      summaryText: input.summaryText?.trim() || null
    };
  }
}
