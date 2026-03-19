import {
  BadRequestException,
  Injectable,
  NotFoundException, Inject} from "@nestjs/common";
import { randomUUID } from "crypto";
import { AiTaskStatus, AiTaskType, Prisma } from "@prisma/client";
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
    return this.prisma.candidate.findMany({
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
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: CandidateInput) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedPhone = this.normalizePhone(input.phone);

    const existing = await this.findDuplicate(
      input.tenantId,
      normalizedEmail,
      normalizedPhone
    );
    if (existing) {
      await this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.createdBy,
        action: "candidate.deduplicated",
        entityType: "Candidate",
        entityId: existing.id,
        metadata: {
          fullName: input.fullName,
          email: normalizedEmail,
          phone: normalizedPhone
        }
      });

      return {
        deduplicated: true,
        candidate: existing
      };
    }

    const candidate = await this.prisma.candidate.create({
      data: {
        tenantId: input.tenantId,
        fullName: input.fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        source: input.source,
        locationText: input.locationText,
        yearsOfExperience:
          input.yearsOfExperience !== undefined
            ? new Prisma.Decimal(input.yearsOfExperience)
            : undefined,
        externalRef: input.externalRef,
        externalSource: input.externalSource
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

    return {
      deduplicated: false,
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

    const cvData = await this.loadCvData(tenantId, candidate.id);

    return {
      ...candidate,
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
      const document = await this.prisma.$transaction(async (tx) => {
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
          data: {
            id: documentId,
            tenantId: input.tenantId,
            candidateId: input.candidateId,
            storageKey: storageResult.storageKey,
            storageProvider: "local_fs",
            checksumSha256: storageResult.checksumSha256,
            originalName: input.file.originalName,
            mimeType: validated.mimeType,
            sizeBytes: storageResult.sizeBytes,
            uploadedBy: input.uploadedBy,
            isPrimary: true
          }
        });
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
