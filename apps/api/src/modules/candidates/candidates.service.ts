import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { AiTaskStatus, AiTaskType, ConsentContext, Prisma } from "@prisma/client";
import { AiOrchestrationService } from "../ai-orchestration/ai-orchestration.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { FileStorageService } from "../storage/file-storage.service";
import { PrismaService } from "../../prisma/prisma.service";

export type CandidateInput = {
  tenantId: string;
  createdBy?: string;
  fullName: string;
  phone?: string;
  email?: string;
  source?: string;
  locationText?: string;
  yearsOfExperience?: number;
  externalRef?: string;
  externalSource?: string;
  consentAccepted?: boolean;
  consentNoticeVersion?: string;
  consentPolicyVersion?: string;
};

export type CandidateImportInput = {
  tenantId: string;
  createdBy?: string;
  records: Array<{
    fullName: string;
    phone?: string;
    email?: string;
    source?: string;
    locationText?: string;
    yearsOfExperience?: number;
    externalRef?: string;
    externalSource?: string;
  }>;
};

export type UploadCandidateCvInput = {
  tenantId: string;
  candidateId: string;
  uploadedBy: string;
  traceId?: string;
  file: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    content: Buffer;
  };
};

export type TriggerCvParsingInput = {
  tenantId: string;
  candidateId: string;
  requestedBy: string;
  traceId?: string;
  cvFileId?: string;
  providerKey?: string;
  applicationId?: string;
  jobId?: string;
  triggerSource?: "manual" | "system";
  triggerReasonCode?: string;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readCvFileIdFromTaskRun(taskRun: {
  inputJson: Prisma.JsonValue;
  outputJson: Prisma.JsonValue | null;
}) {
  const input = toRecord(taskRun.inputJson);
  if (typeof input.cvFileId === "string" && input.cvFileId.trim().length > 0) {
    return input.cvFileId;
  }

  const output = toRecord(taskRun.outputJson);
  const additional = toRecord(output.additional);

  if (typeof additional.cvFileId === "string" && additional.cvFileId.trim().length > 0) {
    return additional.cvFileId;
  }

  return null;
}

function readHumanDecision(metadata: Prisma.JsonValue | null | undefined) {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const decision = record.decision;
  return decision === "advance" || decision === "hold" || decision === "reject"
    ? decision
    : null;
}

function isMissingCvFileBlobTableError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const meta = JSON.stringify(error.meta ?? {});
  return meta.includes("CVFileBlob") || error.message.includes("CVFileBlob");
}

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalDecimal(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return undefined;
  }

  return new Prisma.Decimal(value);
}

@Injectable()
export class CandidatesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService,
    @Inject(FileStorageService) private readonly fileStorageService: FileStorageService
  ) {}

  async list(tenantId: string, query?: string) {
    const rows = await this.prisma.candidate.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        _count: {
          select: { applications: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      source: row.source,
      createdAt: row.createdAt,
      applicationCount: row._count.applications
    }));
  }

  async create(input: CandidateInput) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedPhone = this.normalizePhone(input.phone);
    const normalizedSource = normalizeOptionalText(input.source);
    const normalizedLocationText = normalizeOptionalText(input.locationText);
    const normalizedExternalRef = normalizeOptionalText(input.externalRef);
    const normalizedExternalSource = normalizeOptionalText(input.externalSource);
    const normalizedYearsOfExperience = toOptionalDecimal(input.yearsOfExperience);

    const existing = await this.findDuplicate(
      input.tenantId,
      normalizedEmail,
      normalizedPhone
    );
    if (existing) {
      const enrichmentPatch: Prisma.CandidateUpdateInput = {};
      const enrichedFields: string[] = [];

      if (!normalizeOptionalText(existing.email) && normalizedEmail) {
        enrichmentPatch.email = normalizedEmail;
        enrichedFields.push("email");
      }

      if (!normalizeOptionalText(existing.phone) && normalizedPhone) {
        enrichmentPatch.phone = normalizedPhone;
        enrichedFields.push("phone");
      }

      if (!normalizeOptionalText(existing.source) && normalizedSource) {
        enrichmentPatch.source = normalizedSource;
        enrichedFields.push("source");
      }

      if (!normalizeOptionalText(existing.locationText) && normalizedLocationText) {
        enrichmentPatch.locationText = normalizedLocationText;
        enrichedFields.push("locationText");
      }

      if (existing.yearsOfExperience == null && normalizedYearsOfExperience) {
        enrichmentPatch.yearsOfExperience = normalizedYearsOfExperience;
        enrichedFields.push("yearsOfExperience");
      }

      if (!normalizeOptionalText(existing.externalRef) && normalizedExternalRef) {
        enrichmentPatch.externalRef = normalizedExternalRef;
        enrichedFields.push("externalRef");
      }

      if (!normalizeOptionalText(existing.externalSource) && normalizedExternalSource) {
        enrichmentPatch.externalSource = normalizedExternalSource;
        enrichedFields.push("externalSource");
      }

      const candidate =
        enrichedFields.length > 0
          ? await this.prisma.candidate.update({
              where: {
                id: existing.id
              },
              data: enrichmentPatch
            })
          : existing;

      await this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.createdBy,
        action: "candidate.deduplicated",
        entityType: "Candidate",
        entityId: existing.id,
        metadata: {
          fullName: input.fullName,
          email: normalizedEmail ?? null,
          phone: normalizedPhone ?? null,
          source: normalizedSource ?? null,
          externalSource: normalizedExternalSource ?? null,
          externalRef: normalizedExternalRef ?? null,
          enrichedFields
        }
      });

      await this.ensureDataProcessingConsent({
        tenantId: input.tenantId,
        candidateId: candidate.id,
        consentAccepted: input.consentAccepted,
        noticeVersion: input.consentNoticeVersion,
        policyVersion: input.consentPolicyVersion
      });

      return {
        deduplicated: true,
        enrichedFields,
        candidate
      };
    }

    const candidate = await this.prisma.candidate.create({
      data: {
        tenantId: input.tenantId,
        fullName: input.fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        source: normalizedSource,
        locationText: normalizedLocationText,
        yearsOfExperience: normalizedYearsOfExperience,
        externalRef: normalizedExternalRef,
        externalSource: normalizedExternalSource
      }
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.createdBy,
        action: "candidate.created",
        entityType: "Candidate",
        entityId: candidate.id,
        metadata: {
          fullName: candidate.fullName,
          source: candidate.source
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Candidate",
        aggregateId: candidate.id,
        eventType: "candidate.created",
        payload: {
          fullName: candidate.fullName,
          source: candidate.source,
          createdBy: input.createdBy
        }
      })
    ]);

    await this.ensureDataProcessingConsent({
      tenantId: input.tenantId,
      candidateId: candidate.id,
      consentAccepted: input.consentAccepted,
      noticeVersion: input.consentNoticeVersion,
      policyVersion: input.consentPolicyVersion
    });

    return {
      deduplicated: false,
      enrichedFields: [],
      candidate
    };
  }

  async getById(tenantId: string, id: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      },
      include: {
        applications: {
          include: {
            job: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!candidate) {
      throw new NotFoundException("Aday bulunamadi.");
    }

    const applicationIds = candidate.applications.map((application) => application.id);
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

    const cvData = await this.loadCvData(tenantId, candidate.id);

    return {
      ...candidate,
      applications: candidate.applications.map((application) => ({
        ...application,
        humanDecision: latestHumanDecisionByApplicationId.get(application.id) ?? null
      })),
      ...cvData
    };
  }

  async import(input: CandidateImportInput) {
    const results = [];

    for (const record of input.records) {
      const result = await this.create({
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        fullName: record.fullName,
        phone: record.phone,
        email: record.email,
        source: record.source,
        locationText: record.locationText,
        yearsOfExperience: record.yearsOfExperience,
        externalRef: record.externalRef,
        externalSource: record.externalSource
      });

      results.push(result);
    }

    const deduplicatedCount = results.filter((result) => result.deduplicated).length;

    return {
      total: results.length,
      created: results.length - deduplicatedCount,
      deduplicated: deduplicatedCount,
      items: results
    };
  }

  async uploadCvFile(input: UploadCandidateCvInput) {
    await this.assertCandidate(input.tenantId, input.candidateId);
    const validated = this.fileStorageService.validateCvUpload({
      originalName: input.file.originalName,
      mimeType: input.file.mimeType,
      sizeBytes: input.file.sizeBytes
    });

    const documentId = randomUUID();
    const storageResult = await this.fileStorageService.storeCandidateCv({
      tenantId: input.tenantId,
      candidateId: input.candidateId,
      documentId,
      originalName: input.file.originalName,
      mimeType: validated.mimeType,
      content: input.file.content
    });

    try {
      const document = await this.persistCvFileRecord({
        tenantId: input.tenantId,
        candidateId: input.candidateId,
        documentId,
        storageKey: storageResult.storageKey,
        checksumSha256: storageResult.checksumSha256,
        originalName: input.file.originalName,
        mimeType: validated.mimeType,
        sizeBytes: storageResult.sizeBytes,
        uploadedBy: input.uploadedBy,
        content: input.file.content
      });

      await Promise.all([
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorUserId: input.uploadedBy,
          action: "candidate.cv.uploaded",
          entityType: "CVFile",
          entityId: document.id,
          traceId: input.traceId,
          metadata: {
            candidateId: input.candidateId,
            originalName: document.originalName,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            storageProvider: document.storageProvider,
            isPrimary: document.isPrimary
          }
        }),
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "CVFile",
          aggregateId: document.id,
          eventType: "candidate.cv.uploaded",
          traceId: input.traceId,
          payload: {
            candidateId: input.candidateId,
            originalName: document.originalName,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            uploadedBy: input.uploadedBy
          }
        })
      ]);

      return document;
    } catch (error) {
      await this.fileStorageService.remove(storageResult.storageKey);
      throw error;
    }
  }

  private async persistCvFileRecord(input: {
    tenantId: string;
    candidateId: string;
    documentId: string;
    storageKey: string;
    checksumSha256: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    content: Buffer;
  }) {
    const baseData = {
      id: input.documentId,
      tenantId: input.tenantId,
      candidateId: input.candidateId,
      storageKey: input.storageKey,
      storageProvider: "local_fs" as const,
      checksumSha256: input.checksumSha256,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: input.uploadedBy,
      isPrimary: true
    };

    const runTransaction = async (withBlob: boolean) =>
      this.prisma.$transaction(async (tx) => {
        await tx.cVFile.updateMany({
          where: {
            tenantId: input.tenantId,
            candidateId: input.candidateId,
            isPrimary: true
          },
          data: {
            isPrimary: false
          }
        });

        return tx.cVFile.create({
          data: withBlob
            ? {
                ...baseData,
                blob: {
                  create: {
                    tenantId: input.tenantId,
                    contentBytes: new Uint8Array(input.content)
                  }
                }
              }
            : baseData
        });
      });

    try {
      return await runTransaction(true);
    } catch (error) {
      if (!isMissingCvFileBlobTableError(error)) {
        throw error;
      }

      return runTransaction(false);
    }
  }

  async listCvFiles(tenantId: string, candidateId: string) {
    await this.assertCandidate(tenantId, candidateId);
    return this.loadCvData(tenantId, candidateId);
  }

  async getCvFileById(tenantId: string, candidateId: string, cvFileId: string) {
    await this.assertCandidate(tenantId, candidateId);

    const document = await this.prisma.cVFile.findFirst({
      where: {
        id: cvFileId,
        tenantId,
        candidateId
      },
      include: {
        parsedProfile: true
      }
    });

    if (!document) {
      throw new NotFoundException("CV dokumani bulunamadi.");
    }

    const parseRuns = await this.prisma.aiTaskRun.findMany({
      where: {
        tenantId,
        candidateId,
        taskType: AiTaskType.CV_PARSING
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    const latestParseTask = parseRuns.find((taskRun) => readCvFileIdFromTaskRun(taskRun) === cvFileId) ?? null;

    return {
      ...document,
      latestParseTask
    };
  }

  async triggerCvParsing(input: TriggerCvParsingInput) {
    await this.assertCandidate(input.tenantId, input.candidateId);

    const targetCv = await this.resolveTargetCvFile(
      input.tenantId,
      input.candidateId,
      input.cvFileId
    );

    const activeRuns = await this.prisma.aiTaskRun.findMany({
      where: {
        tenantId: input.tenantId,
        candidateId: input.candidateId,
        taskType: AiTaskType.CV_PARSING,
        status: {
          in: [AiTaskStatus.PENDING, AiTaskStatus.QUEUED, AiTaskStatus.RUNNING]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    });

    const existing = activeRuns.find(
      (taskRun) => readCvFileIdFromTaskRun(taskRun) === targetCv.id
    );

    if (existing) {
      return {
        idempotent: true,
        cvFileId: targetCv.id,
        taskRun: {
          taskRunId: existing.id,
          taskType: existing.taskType,
          status: existing.status,
          workflowJobId: existing.workflowJobId,
          createdAt: existing.createdAt.toISOString()
        }
      };
    }

    const taskRun = await this.aiOrchestrationService.createTaskRun({
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      taskType: AiTaskType.CV_PARSING,
      candidateId: input.candidateId,
      applicationId: input.applicationId,
      jobId: input.jobId,
      providerKey: input.providerKey,
      triggerSource: input.triggerSource ?? "manual",
      triggerReasonCode:
        input.triggerReasonCode ?? "candidate_cv_parsing_requested",
      traceId: input.traceId,
      input: {
        triggerSource: input.triggerSource === "system" ? "system" : "manual_ui",
        triggerReasonCode:
          input.triggerReasonCode ?? "candidate_cv_parsing_requested",
        cvFileId: targetCv.id,
        cvStorageKey: targetCv.storageKey,
        cvMimeType: targetCv.mimeType,
        cvOriginalName: targetCv.originalName
      }
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        action: "candidate.cv.parsing.requested",
        entityType: "CVFile",
        entityId: targetCv.id,
        traceId: input.traceId,
        metadata: {
          candidateId: input.candidateId,
          cvFileId: targetCv.id,
          taskRunId: taskRun.taskRunId,
          workflowJobId: taskRun.workflowJobId ?? null
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CVFile",
        aggregateId: targetCv.id,
        eventType: "candidate.cv.parsing.requested",
        traceId: input.traceId,
        payload: {
          candidateId: input.candidateId,
          cvFileId: targetCv.id,
          taskRunId: taskRun.taskRunId
        }
      })
    ]);

    return {
      idempotent: false,
      cvFileId: targetCv.id,
      taskRun
    };
  }

  async latestCvParsing(tenantId: string, candidateId: string, cvFileId?: string) {
    await this.assertCandidate(tenantId, candidateId);

    const parseRuns = await this.prisma.aiTaskRun.findMany({
      where: {
        tenantId,
        candidateId,
        taskType: AiTaskType.CV_PARSING
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    const selectedRun =
      parseRuns.find((taskRun) =>
        cvFileId ? readCvFileIdFromTaskRun(taskRun) === cvFileId : true
      ) ?? null;

    const resolvedCvFileId =
      cvFileId ?? (selectedRun ? readCvFileIdFromTaskRun(selectedRun) : null);

    const parsedProfile = resolvedCvFileId
      ? await this.prisma.cVParsedProfile.findFirst({
          where: {
            tenantId,
            cvFileId: resolvedCvFileId
          }
        })
      : null;

    return {
      candidateId,
      cvFileId: resolvedCvFileId,
      taskRun: selectedRun,
      parsedProfile
    };
  }

  private normalizeEmail(email?: string) {
    return email ? email.trim().toLowerCase() : undefined;
  }

  private normalizePhone(phone?: string) {
    if (!phone) {
      return undefined;
    }

    const digits = phone.replace(/\D/g, "");
    return digits.length > 0 ? digits : undefined;
  }

  private async ensureDataProcessingConsent(input: {
    tenantId: string;
    candidateId: string;
    consentAccepted?: boolean;
    noticeVersion?: string;
    policyVersion?: string;
  }) {
    if (!input.consentAccepted) {
      return;
    }

    const noticeVersion =
      normalizeOptionalText(input.noticeVersion) ?? "kvkk_data_processing_tr_v1_2026_04";
    const policyVersion = normalizeOptionalText(input.policyVersion) ?? "policy_v1";

    const latestConsent = await this.prisma.consentRecord.findFirst({
      where: {
        tenantId: input.tenantId,
        candidateId: input.candidateId,
        context: ConsentContext.DATA_PROCESSING
      },
      orderBy: {
        capturedAt: "desc"
      },
      select: {
        id: true,
        consentGiven: true,
        noticeVersion: true,
        policyVersion: true,
        withdrawnAt: true
      }
    });

    if (
      latestConsent &&
      latestConsent.consentGiven &&
      !latestConsent.withdrawnAt &&
      latestConsent.noticeVersion === noticeVersion &&
      (latestConsent.policyVersion ?? null) === policyVersion
    ) {
      return;
    }

    await this.prisma.consentRecord.create({
      data: {
        tenantId: input.tenantId,
        candidateId: input.candidateId,
        context: ConsentContext.DATA_PROCESSING,
        consentGiven: true,
        noticeVersion,
        policyVersion
      }
    });
  }

  private findDuplicate(tenantId: string, email?: string, phone?: string) {
    if (!email && !phone) {
      return null;
    }

    return this.prisma.candidate.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])]
      }
    });
  }

  private async assertCandidate(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        tenantId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!candidate) {
      throw new NotFoundException("Aday bulunamadi.");
    }
  }

  private async loadCvData(tenantId: string, candidateId: string) {
    const [cvFiles, parseRuns] = await Promise.all([
      this.prisma.cVFile.findMany({
        where: {
          tenantId,
          candidateId
        },
        include: {
          parsedProfile: true
        },
        orderBy: {
          uploadedAt: "desc"
        }
      }),
      this.prisma.aiTaskRun.findMany({
        where: {
          tenantId,
          candidateId,
          taskType: AiTaskType.CV_PARSING
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 50
      })
    ]);

    const latestParseByCvId = new Map<string, (typeof parseRuns)[number]>();

    for (const taskRun of parseRuns) {
      const cvFileId = readCvFileIdFromTaskRun(taskRun);

      if (!cvFileId || latestParseByCvId.has(cvFileId)) {
        continue;
      }

      latestParseByCvId.set(cvFileId, taskRun);
    }

    const enrichedFiles = cvFiles.map((file, index) => ({
      ...file,
      latestParseTask: latestParseByCvId.get(file.id) ?? null,
      isLatest: index === 0
    }));
    const latestParsedProfile =
      enrichedFiles.find((file) => Boolean(file.parsedProfile))?.parsedProfile ?? null;
    const latestParsingTask = parseRuns[0] ?? null;

    return {
      cvFiles: enrichedFiles,
      latestCvFileId: enrichedFiles[0]?.id ?? null,
      primaryCvFileId:
        enrichedFiles.find((file) => file.isPrimary)?.id ??
        enrichedFiles[0]?.id ??
        null,
      latestParsingTask,
      latestParsedProfile,
      uploadPolicy: this.fileStorageService.getCvUploadPolicy()
    };
  }

  private async resolveTargetCvFile(tenantId: string, candidateId: string, cvFileId?: string) {
    if (cvFileId) {
      const document = await this.prisma.cVFile.findFirst({
        where: {
          id: cvFileId,
          tenantId,
          candidateId
        }
      });

      if (!document) {
        throw new NotFoundException("Secilen CV dokumani bulunamadi.");
      }

      return document;
    }

    const latestOrPrimary = await this.prisma.cVFile.findFirst({
      where: {
        tenantId,
        candidateId
      },
      orderBy: [{ isPrimary: "desc" }, { uploadedAt: "desc" }]
    });

    if (!latestOrPrimary) {
      throw new BadRequestException(
        "CV parsing baslatmak icin once bir CV dosyasi yuklenmelidir."
      );
    }

    return latestOrPrimary;
  }
}
