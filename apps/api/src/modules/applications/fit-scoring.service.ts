import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import {
  deriveFitAssessmentConfidence,
  normalizeConfidence,
  normalizeFitScore,
  normalizeFitScoreSubScores,
  normalizeFitWarnings,
  normalizeReasoning
} from "./fit-score-read-model.util";

@Injectable()
export class FitScoringService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService
  ) {}

  async getLatest(tenantId: string, applicationId: string) {
    const row = await this.prisma.applicantFitScore.findFirst({
      where: { tenantId, applicationId },
      orderBy: { createdAt: "desc" }
    });

    if (!row) return null;

    const reasoningRecord = row.reasoningJson && typeof row.reasoningJson === "object" && !Array.isArray(row.reasoningJson)
      ? (row.reasoningJson as Record<string, unknown>)
      : null;

    return {
      id: row.id,
      overallScore: normalizeFitScore(row.overallScore),
      confidence: deriveFitAssessmentConfidence({
        confidence: row.confidence,
        subScores: row.subScoresJson,
        missingInfo: row.missingInfoJson,
        reasoning: row.reasoningJson
      }),
      subScores: normalizeFitScoreSubScores(row.subScoresJson),
      strengths: normalizeFitWarnings(row.strengthsJson),
      risks: normalizeFitWarnings(row.risksJson),
      missingInfo: normalizeFitWarnings(row.missingInfoJson),
      reasoning: normalizeReasoning(row.reasoningJson),
      calibration: {
        fitBand: typeof reasoningRecord?.fitBand === "string" ? reasoningRecord.fitBand : null,
        interviewReadiness:
          typeof reasoningRecord?.interviewReadiness === "string" ? reasoningRecord.interviewReadiness : null,
        fitBandReasoning:
          typeof reasoningRecord?.fitBandReasoning === "string" ? reasoningRecord.fitBandReasoning : null
      },
      createdAt: row.createdAt.toISOString()
    };
  }

  async save(input: {
    tenantId: string;
    applicationId: string;
    aiTaskRunId?: string;
    overallScore: number;
    confidence: number;
    subScores: Record<string, unknown>;
    strengths?: string[];
    risks?: string[];
    missingInfo?: string[];
    reasoning?: string;
    modelKey?: string;
    promptVersion?: string;
  }) {
    const score = await this.prisma.applicantFitScore.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        aiTaskRunId: input.aiTaskRunId,
        overallScore: new Prisma.Decimal(input.overallScore),
        confidence: new Prisma.Decimal(input.confidence),
        subScoresJson: input.subScores as Prisma.InputJsonValue,
        strengthsJson: (input.strengths ?? []) as Prisma.InputJsonValue,
        risksJson: (input.risks ?? []) as Prisma.InputJsonValue,
        missingInfoJson: (input.missingInfo ?? []) as Prisma.InputJsonValue,
        reasoningJson: input.reasoning as unknown as Prisma.InputJsonValue,
        modelKey: input.modelKey,
        promptVersion: input.promptVersion
      }
    });

    return score;
  }
}
