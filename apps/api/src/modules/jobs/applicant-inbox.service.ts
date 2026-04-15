import { BadRequestException, Injectable, NotFoundException, Inject } from "@nestjs/common";
import { ApplicationStage, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApplicationsService } from "../applications/applications.service";
import {
  deriveFitAssessmentConfidence,
  normalizeConfidence,
  normalizeFitScore,
  normalizeFitScoreSubScores,
  normalizeFitWarnings
} from "../applications/fit-score-read-model.util";
import { AuditWriterService } from "../audit/audit-writer.service";
import { CandidatesService } from "../candidates/candidates.service";
import { deriveInterviewInvitationState } from "../interviews/interview-invitation-state.util";

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

function hasSuccessfulScreening(status: string | null | undefined) {
  return status === "SUCCEEDED";
}

function hasActiveScreening(status: string | null | undefined) {
  return status === "PENDING" || status === "QUEUED" || status === "RUNNING";
}

function deriveEffectiveStage(input: {
  currentStage: ApplicationStage;
  hasFitScore: boolean;
  hasAiRecommendation: boolean;
  screeningStatus: string | null | undefined;
}) {
  switch (input.currentStage) {
    case ApplicationStage.RECRUITER_REVIEW:
    case ApplicationStage.INTERVIEW_SCHEDULED:
    case ApplicationStage.INTERVIEW_COMPLETED:
    case ApplicationStage.HIRING_MANAGER_REVIEW:
    case ApplicationStage.OFFER:
    case ApplicationStage.REJECTED:
    case ApplicationStage.HIRED:
      return input.currentStage;
    case ApplicationStage.APPLIED:
    case ApplicationStage.SCREENING: {
      if (input.hasFitScore || input.hasAiRecommendation || hasSuccessfulScreening(input.screeningStatus)) {
        return ApplicationStage.RECRUITER_REVIEW;
      }

      if (hasActiveScreening(input.screeningStatus)) {
        return ApplicationStage.SCREENING;
      }

      return input.currentStage;
    }
    default:
      return input.currentStage;
  }
}

function deriveEffectiveStageUpdatedAt(input: {
  currentStage: ApplicationStage;
  effectiveStage: ApplicationStage;
  stageUpdatedAt: Date;
  fitCreatedAt?: Date | null;
  screeningCreatedAt?: Date | null;
}) {
  if (input.currentStage === input.effectiveStage) {
    return input.stageUpdatedAt;
  }

  const timestamps = [
    input.stageUpdatedAt.getTime(),
    input.fitCreatedAt?.getTime() ?? 0,
    input.screeningCreatedAt?.getTime() ?? 0
  ];

  return new Date(Math.max(...timestamps));
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
    sortBy?: "fit_score" | "date" | "name" | "fitScore_desc" | "fitScore_asc" | "appliedAt_desc" | "appliedAt_asc" | "name_asc" | "name_desc";
  }) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
      include: { requirements: true }
    });

    if (!job) throw new NotFoundException("İş ilanı bulunamadı.");

    const where: Prisma.CandidateApplicationWhereInput = {
      tenantId,
      jobId
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
            meetingJoinUrl: true
          }
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

    const applicationIds = applications.map((application) => application.id);
    const approvals = applicationIds.length > 0
      ? await this.prisma.humanApproval.findMany({
          where: {
            tenantId,
            actionType: "application.decision",
            entityType: "CandidateApplication",
            entityId: { in: applicationIds }
          },
          orderBy: { approvedAt: "desc" }
        })
      : [];
    const latestHumanDecisionByApplicationId = new Map<string, "advance" | "hold" | "reject" | null>();
    for (const approval of approvals) {
      if (latestHumanDecisionByApplicationId.has(approval.entityId)) {
        continue;
      }
      latestHumanDecisionByApplicationId.set(approval.entityId, readHumanDecision(approval.metadata));
    }

    const sourcingAttachments = applicationIds.length > 0
      ? await this.prisma.sourcingProjectProspect.findMany({
          where: {
            tenantId,
            attachedApplicationId: { in: applicationIds }
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
      : [];

    const sourcingByApplicationId = new Map<string, {
      projectId: string;
      projectName: string;
      prospectId: string;
      stage: string;
      primarySourceLabel: string | null;
      sourceLabels: string[];
      latestOutreach: {
        status: string | null;
        subject: string | null;
        sentAt: string | null;
        repliedAt: string | null;
        reviewNote: string | null;
        error: string | null;
      } | null;
    }>();

    for (const prospect of sourcingAttachments) {
      if (!prospect.attachedApplicationId || sourcingByApplicationId.has(prospect.attachedApplicationId)) {
        continue;
      }

      const latestOutreach = prospect.outreachMessages[0] ?? null;

      sourcingByApplicationId.set(prospect.attachedApplicationId, {
        projectId: prospect.project.id,
        projectName: prospect.project.name,
        prospectId: prospect.id,
        stage: prospect.stage,
        primarySourceLabel: prospect.talentProfile.primarySourceLabel ?? null,
        sourceLabels: [...new Set(
          prospect.talentProfile.sourceRecords
            .map((record) => record.providerLabel?.trim())
            .filter((label): label is string => Boolean(label))
        )],
        latestOutreach: latestOutreach
          ? {
              status: latestOutreach.status,
              subject: latestOutreach.subject,
              sentAt: latestOutreach.sentAt?.toISOString() ?? null,
              repliedAt: latestOutreach.repliedAt?.toISOString() ?? null,
              reviewNote: latestOutreach.reviewNote ?? null,
              error: latestOutreach.sendError ?? null
            }
          : null
      });
    }

    const sourcingProject = await this.prisma.sourcingProject.findFirst({
      where: {
        tenantId,
        jobId,
        archivedAt: null
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        prospects: {
          select: {
            stage: true,
            attachedApplicationId: true,
            talentProfile: {
              select: {
                suppressionStatus: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
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
      const invitation = deriveInterviewInvitationState(latestInterview);
      const effectiveStage = deriveEffectiveStage({
        currentStage: app.currentStage,
        hasFitScore: Boolean(latestFit),
        hasAiRecommendation: Boolean(app.aiRecommendation),
        screeningStatus: latestScreening?.status
      });
      const effectiveStageUpdatedAt = deriveEffectiveStageUpdatedAt({
        currentStage: app.currentStage,
        effectiveStage,
        stageUpdatedAt: app.stageUpdatedAt,
        fitCreatedAt: latestFit?.createdAt ?? null,
        screeningCreatedAt: latestScreening?.createdAt ?? null
      });

      return {
        applicationId: app.id,
        candidateId: app.candidateId,
        fullName: app.candidate.fullName,
        email: app.candidate.email,
        phone: app.candidate.phone,
        locationText: app.candidate.locationText,
        source: app.candidate.source,
        externalSource: app.candidate.externalSource,
        externalRef: app.candidate.externalRef,
        yearsOfExperience: app.candidate.yearsOfExperience ? Number(app.candidate.yearsOfExperience) : null,
        stage: effectiveStage,
        stageUpdatedAt: effectiveStageUpdatedAt.toISOString(),
        createdAt: app.createdAt.toISOString(),
        aiRecommendation: app.aiRecommendation ?? null,
        fitScore: latestFit ? {
          overallScore: normalizeFitScore(latestFit.overallScore),
          confidence: deriveFitAssessmentConfidence({
            confidence: latestFit.confidence,
            subScores: latestFit.subScoresJson,
            missingInfo: latestFit.missingInfoJson,
            reasoning: latestFit.reasoningJson
          }),
          subScores: normalizeFitScoreSubScores(latestFit.subScoresJson),
          strengths: normalizeFitWarnings(latestFit.strengthsJson),
          risks: normalizeFitWarnings(latestFit.risksJson),
          missingInfo: normalizeFitWarnings(latestFit.missingInfoJson)
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
          scheduledAt: latestInterview.scheduledAt?.toISOString() ?? null,
          candidateInterviewUrl: latestInterview.meetingJoinUrl ?? null,
          invitation
        } : null,
        cvStatus: cv,
        scheduling: latestScheduling ? {
          workflowId: latestScheduling.id,
          state: latestScheduling.state,
          status: latestScheduling.status
        } : null,
        humanDecision: latestHumanDecisionByApplicationId.get(app.id) ?? null,
        noteCount: app.recruiterNotes.length,
        sourcing: sourcingByApplicationId.get(app.id)
          ? {
              projectId: sourcingByApplicationId.get(app.id)!.projectId,
              projectName: sourcingByApplicationId.get(app.id)!.projectName,
              prospectId: sourcingByApplicationId.get(app.id)!.prospectId,
              stage: sourcingByApplicationId.get(app.id)!.stage,
              primarySourceLabel: sourcingByApplicationId.get(app.id)!.primarySourceLabel,
              sourceLabels: sourcingByApplicationId.get(app.id)!.sourceLabels,
              latestOutreach: sourcingByApplicationId.get(app.id)!.latestOutreach
            }
          : null
      };
    });

    if (filters?.stage) {
      applicants = applicants.filter((applicant) => applicant.stage === filters.stage);
    }

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
    if (filters?.sortBy === "fit_score" || filters?.sortBy === "fitScore_desc") {
      applicants.sort((a, b) => (b.fitScore?.overallScore ?? -1) - (a.fitScore?.overallScore ?? -1));
    } else if (filters?.sortBy === "fitScore_asc") {
      applicants.sort((a, b) => (a.fitScore?.overallScore ?? 101) - (b.fitScore?.overallScore ?? 101));
    } else if (filters?.sortBy === "name" || filters?.sortBy === "name_asc") {
      applicants.sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
    } else if (filters?.sortBy === "name_desc") {
      applicants.sort((a, b) => b.fullName.localeCompare(a.fullName, "tr"));
    } else if (filters?.sortBy === "appliedAt_asc") {
      applicants.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

    const sourcedApplicants = applicants.filter((applicant) => Boolean(applicant.sourcing)).length;
    const readyForInterviewInvite = applicants.filter((applicant) => {
      if (!applicant.email || applicant.interview) {
        return false;
      }

      return (
        applicant.stage === ApplicationStage.APPLIED ||
        applicant.stage === ApplicationStage.SCREENING ||
        applicant.stage === ApplicationStage.RECRUITER_REVIEW
      );
    }).length;
    const activeInterviewInvites = applicants.filter((applicant) => {
      const invitationState = applicant.interview?.invitation?.state;
      return invitationState === "INVITED" || invitationState === "REMINDER_SENT" || invitationState === "IN_PROGRESS";
    }).length;
    const outreachAwaitingReply = applicants.filter((applicant) => applicant.sourcing?.latestOutreach?.status === "SENT").length;

    const sourcingProjectMetrics = sourcingProject
      ? sourcingProject.prospects.reduce(
          (acc, prospect) => {
            acc.totalProspects += 1;
            acc.attachedApplicants += prospect.attachedApplicationId ? 1 : 0;
            acc.blocked += prospect.talentProfile.suppressionStatus !== "ALLOWED" ? 1 : 0;

            if (prospect.stage === "NEEDS_REVIEW") acc.needsReview += 1;
            if (prospect.stage === "GOOD_FIT") acc.goodFit += 1;
            if (prospect.stage === "CONTACTED") acc.contacted += 1;
            if (prospect.stage === "REPLIED") acc.replied += 1;
            if (prospect.stage === "CONVERTED") acc.converted += 1;
            return acc;
          },
          {
            totalProspects: 0,
            needsReview: 0,
            goodFit: 0,
            contacted: 0,
            replied: 0,
            converted: 0,
            blocked: 0,
            attachedApplicants: 0
          }
        )
      : null;

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
        aiDraftText: job.aiDraftText,
        requirements: job.requirements,
        createdAt: job.createdAt.toISOString()
      },
      stats: {
        totalApplicants: applicants.length,
        byStage: stageCount,
        bySource: sourceCount,
        avgFitScore: scoredTotal > 0 ? Math.round(scoreSum / scoredTotal) : null,
        scoredCount: scoredTotal,
        unscoredCount
      },
      commandCenter: {
        sourcingProject: sourcingProject && sourcingProjectMetrics
          ? {
              id: sourcingProject.id,
              name: sourcingProject.name,
              updatedAt: sourcingProject.updatedAt.toISOString(),
              metrics: sourcingProjectMetrics
            }
          : null,
        sourcedApplicants,
        readyForInterviewInvite,
        activeInterviewInvites,
        outreachAwaitingReply
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
    if (job.status === "ARCHIVED") {
      throw new BadRequestException("Arşivli ilana yeni aday veya CV eklenemez.");
    }

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

    if (job.status === "ARCHIVED") {
      throw new BadRequestException("Arşivli ilana yeni aday veya CV eklenemez.");
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
