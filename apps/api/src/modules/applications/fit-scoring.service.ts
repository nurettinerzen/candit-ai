import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import {
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

    return {
      id: row.id,
      overallScore: normalizeFitScore(row.overallScore),
      confidence: normalizeConfidence(row.confidence),
      subScores: normalizeFitScoreSubScores(row.subScoresJson),
      strengths: normalizeFitWarnings(row.strengthsJson),
      risks: normalizeFitWarnings(row.risksJson),
      missingInfo: normalizeFitWarnings(row.missingInfoJson),
      reasoning: normalizeReasoning(row.reasoningJson),
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
