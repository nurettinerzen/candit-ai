import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { ApplicationStage, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApplicationsService } from "../applications/applications.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { CandidatesService } from "../candidates/candidates.service";

function deriveCandidateNameFromFilename(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "");
  const normalized = base
    .replace(/[_\-]+/g, " ")
    .replace(/\b(cv|resume|ozgecmis|özgeçmiş|curriculum vitae)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length >= 2) {
    return normalized;
  }

  return "Yeni Aday";
}

@Injectable()
export class ApplicantInboxService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(CandidatesService) private readonly candidatesService: CandidatesService,
    @Inject(ApplicationsService) private readonly applicationsService: ApplicationsService
  ) {}

  async getJobInbox(tenantId: string, jobId: string, filters?: {
    stage?: ApplicationStage;
    source?: string;
    minFitScore?: number;
    sortBy?: "fit_score" | "date" | "name";
  }) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
      include: { requirements: true }
    });

    if (!job) throw new NotFoundException("İş ilanı bulunamadı.");

    const where: Prisma.CandidateApplicationWhereInput = {
      tenantId,
      jobId,
      ...(filters?.stage ? { currentStage: filters.stage } : {})
    };

    const applications = await this.prisma.candidateApplication.findMany({
      where,
      include: {
        candidate: true,
        fitScores: { orderBy: { createdAt: "desc" }, take: 1 },
        recruiterNotes: { select: { id: true } },
        interviewSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, mode: true, scheduledAt: true }
        },
        aiTaskRuns: {
          where: { taskType: "SCREENING_SUPPORT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true }
        },
        schedulingWorkflows: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, state: true, status: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Collect CV status per candidate
    const candidateIds = [...new Set(applications.map(a => a.candidateId))];
    const cvFiles = await this.prisma.cVFile.findMany({
      where: { tenantId, candidateId: { in: candidateIds } },
      include: { parsedProfile: { select: { id: true } } },
      orderBy: { uploadedAt: "desc" }
    });
    const cvMap = new Map<string, { hasCv: boolean; isParsed: boolean; cvFileId: string | null }>();
    for (const cf of cvFiles) {
      if (!cvMap.has(cf.candidateId)) {
        cvMap.set(cf.candidateId, {
          hasCv: true,
          isParsed: !!cf.parsedProfile,
          cvFileId: cf.id
        });
      }
    }

    let applicants = applications.map(app => {
      const latestFit = app.fitScores[0] ?? null;
      const latestScreening = app.aiTaskRuns[0] ?? null;
      const latestInterview = app.interviewSessions[0] ?? null;
      const latestScheduling = app.schedulingWorkflows[0] ?? null;
      const cv = cvMap.get(app.candidateId) ?? { hasCv: false, isParsed: false, cvFileId: null };

      return {
        applicationId: app.id,
        candidateId: app.candidateId,
        fullName: app.candidate.fullName,
        email: app.candidate.email,
        phone: app.candidate.phone,
        locationText: app.candidate.locationText,
        source: app.candidate.source,
        externalRef: app.candidate.externalRef,
        yearsOfExperience: app.candidate.yearsOfExperience ? Number(app.candidate.yearsOfExperience) : null,
        stage: app.currentStage,
        stageUpdatedAt: app.stageUpdatedAt.toISOString(),
        createdAt: app.createdAt.toISOString(),
        fitScore: latestFit ? {
          overallScore: Number(latestFit.overallScore),
          confidence: Number(latestFit.confidence),
          subScores: latestFit.subScoresJson as Record<string, unknown>,
          strengths: (latestFit.strengthsJson ?? []) as string[],
          risks: (latestFit.risksJson ?? []) as string[],
          missingInfo: (latestFit.missingInfoJson ?? []) as string[]
        } : null,
        screening: latestScreening ? {
          status: latestScreening.status,
          taskRunId: latestScreening.id,
          createdAt: latestScreening.createdAt.toISOString()
        } : null,
        interview: latestInterview ? {
          sessionId: latestInterview.id,
          status: latestInterview.status,
          mode: latestInterview.mode,
          scheduledAt: latestInterview.scheduledAt?.toISOString() ?? null
        } : null,
        cvStatus: cv,
        scheduling: latestScheduling ? {
          workflowId: latestScheduling.id,
          state: latestScheduling.state,
          status: latestScheduling.status
        } : null,
        recruiterDecision: app.aiRecommendation ?? null,
        noteCount: app.recruiterNotes.length
      };
    });

    // Filter by source
    if (filters?.source) {
      applicants = applicants.filter(a => a.source === filters.source);
    }

    // Filter by min fit score
    if (filters?.minFitScore !== undefined) {
      applicants = applicants.filter(a =>
        a.fitScore && a.fitScore.overallScore >= filters.minFitScore!
      );
    }

    // Sort
    if (filters?.sortBy === "fit_score") {
      applicants.sort((a, b) => (b.fitScore?.overallScore ?? -1) - (a.fitScore?.overallScore ?? -1));
    } else if (filters?.sortBy === "name") {
      applicants.sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
    }
    // default: by date (already sorted by createdAt desc)

    // Stats
    const stageCount: Record<string, number> = {};
    const sourceCount: Record<string, number> = {};
    let scoredTotal = 0;
    let scoreSum = 0;
    let unscoredCount = 0;

    for (const a of applicants) {
      stageCount[a.stage] = (stageCount[a.stage] ?? 0) + 1;
      const src = a.source ?? "unknown";
      sourceCount[src] = (sourceCount[src] ?? 0) + 1;
      if (a.fitScore) {
        scoredTotal++;
        scoreSum += a.fitScore.overallScore;
      } else {
        unscoredCount++;
      }
    }

    return {
      job: {
        id: job.id,
        title: job.title,
        roleFamily: job.roleFamily,
        status: job.status,
        locationText: job.locationText,
        shiftType: job.shiftType,
        salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
        salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
        jdText: job.jdText,
        requirements: job.requirements,
        createdAt: job.createdAt.toISOString()
      },
      stats: {
        totalApplicants: applicants.length,
        byStage: stageCount,
        bySource: sourceCount,
        avgFitScore: scoredTotal > 0 ? Math.round((scoreSum / scoredTotal) * 100) : null,
        scoredCount: scoredTotal,
        unscoredCount
      },
      applicants
    };
  }

  async bulkImport(input: {
    tenantId: string;
    jobId: string;
    candidates: Array<{
      fullName: string;
      phone?: string;
      email?: string;
      locationText?: string;
      yearsOfExperience?: number;
      externalRef?: string;
    }>;
    source: string;
    externalSource?: string;
    createdBy: string;
  }) {
    const job = await this.prisma.job.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId }
    });
    if (!job) throw new NotFoundException("İş ilanı bulunamadı.");

    const results: Array<{ candidateId: string; applicationId: string; deduplicated: boolean }> = [];
    let importedCount = 0;
    let deduplicatedCount = 0;

    for (const rec of input.candidates) {
      const candidateResult = await this.candidatesService.create({
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        fullName: rec.fullName,
        phone: rec.phone,
        email: rec.email,
        source: input.source,
        locationText: rec.locationText,
        yearsOfExperience: rec.yearsOfExperience,
        externalRef: rec.externalRef,
        externalSource: input.externalSource
      });
      const candidate = candidateResult.candidate;
      const deduplicated = candidateResult.deduplicated;

      if (deduplicated) {
        deduplicatedCount++;
      } else {
        importedCount++;
      }

      const existingApp = await this.prisma.candidateApplication.findFirst({
        where: { tenantId: input.tenantId, candidateId: candidate.id, jobId: input.jobId }
      });

      if (existingApp) {
        results.push({ candidateId: candidate.id, applicationId: existingApp.id, deduplicated: true });
        continue;
      }

      const application = await this.applicationsService.create({
        tenantId: input.tenantId,
        candidateId: candidate.id,
        jobId: input.jobId,
        createdBy: input.createdBy
      });

      results.push({ candidateId: candidate.id, applicationId: application.id, deduplicated });
    }

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorUserId: input.createdBy,
      action: "applicant_inbox.bulk_import",
      entityType: "Job",
      entityId: input.jobId,
      metadata: {
        source: input.source,
        imported: importedCount,
        deduplicated: deduplicatedCount,
        total: input.candidates.length
      }
    });

    return { imported: importedCount, deduplicated: deduplicatedCount, applications: results };
  }

  async bulkUploadCvFiles(input: {
    tenantId: string;
    jobId: string;
    files: Array<{
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      content: Buffer;
    }>;
    source: string;
    externalSource?: string;
    createdBy: string;
    traceId?: string;
  }) {
    const job = await this.prisma.job.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId }
    });

    if (!job) {
      throw new NotFoundException("İş ilanı bulunamadı.");
    }

    const items: Array<{
      originalName: string;
      candidateId?: string;
      applicationId?: string;
      cvFileId?: string;
      taskRunId?: string;
      status: "queued" | "error";
      error?: string;
    }> = [];

    let importedCount = 0;
    let queuedCount = 0;

    for (const file of input.files) {
      try {
        const candidateResult = await this.candidatesService.create({
          tenantId: input.tenantId,
          createdBy: input.createdBy,
          fullName: deriveCandidateNameFromFilename(file.originalName),
          source: input.source,
          externalSource: input.externalSource,
          externalRef: file.originalName
        });

        if (!candidateResult.deduplicated) {
          importedCount++;
        }

        const cvFile = await this.candidatesService.uploadCvFile({
          tenantId: input.tenantId,
          candidateId: candidateResult.candidate.id,
          uploadedBy: input.createdBy,
          traceId: input.traceId,
          file
        });

        const existingApp = await this.prisma.candidateApplication.findFirst({
          where: {
            tenantId: input.tenantId,
            candidateId: candidateResult.candidate.id,
            jobId: input.jobId
          }
        });

        const application =
          existingApp ??
          (await this.applicationsService.create({
            tenantId: input.tenantId,
            candidateId: candidateResult.candidate.id,
            jobId: input.jobId,
            createdBy: input.createdBy,
            traceId: input.traceId,
            suppressAutomation: true
          }));

        const parse = await this.candidatesService.triggerCvParsing({
          tenantId: input.tenantId,
          candidateId: candidateResult.candidate.id,
          requestedBy: input.createdBy,
          traceId: input.traceId,
          cvFileId: cvFile.id,
          applicationId: application.id,
          jobId: input.jobId,
          triggerSource: "system",
          triggerReasonCode: "job_bulk_cv_upload"
        });

        queuedCount++;
        items.push({
          originalName: file.originalName,
          candidateId: candidateResult.candidate.id,
          applicationId: application.id,
          cvFileId: cvFile.id,
          taskRunId: parse.taskRun.taskRunId,
          status: "queued"
        });
      } catch (error) {
        items.push({
          originalName: file.originalName,
          status: "error",
          error: error instanceof Error ? error.message : "Dosya işlenemedi."
        });
      }
    }

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorUserId: input.createdBy,
      action: "applicant_inbox.bulk_cv_upload",
      entityType: "Job",
      entityId: input.jobId,
      traceId: input.traceId,
      metadata: {
        source: input.source,
        externalSource: input.externalSource ?? null,
        imported: importedCount,
        queued: queuedCount,
        total: input.files.length
      }
    });

    return {
      imported: importedCount,
      queued: queuedCount,
      total: input.files.length,
      items
    };
  }
}
