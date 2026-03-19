import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy, Inject} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Queue } from "bullmq";
import type { Prisma } from "@prisma/client";
import { StructuredLoggerService } from "../../common/logging/structured-logger.service";
import { PrismaService } from "../../prisma/prisma.service";

export const ASYNC_JOB_TYPES = [
  "cv_parse",
  "job_requirement_interpretation",
  "candidate_fit_assistance",
  "screening_support",
  "interview_preparation",
  "interview_orchestration",
  "transcript_summarization",
  "report_generation",
  "recommendation_generation",
  "applicant_fit_scoring",
  "webhook_retry"
] as const;

export type AsyncJobType = (typeof ASYNC_JOB_TYPES)[number];

const ASYNC_JOB_POLICIES: Record<AsyncJobType, { maxAttempts: number }> = {
  cv_parse: { maxAttempts: 3 },
  job_requirement_interpretation: { maxAttempts: 3 },
  candidate_fit_assistance: { maxAttempts: 3 },
  screening_support: { maxAttempts: 4 },
  interview_preparation: { maxAttempts: 3 },
  interview_orchestration: { maxAttempts: 4 },
  transcript_summarization: { maxAttempts: 3 },
  report_generation: { maxAttempts: 4 },
  recommendation_generation: { maxAttempts: 4 },
  applicant_fit_scoring: { maxAttempts: 3 },
  webhook_retry: { maxAttempts: 5 }
};

@Injectable()
export class AsyncJobsService implements OnModuleDestroy {
  private readonly queueName = "ai-interviewer-jobs";
  private readonly redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  private readonly queue = new Queue(this.queueName, {
    connection: {
      host: this.redisUrl.hostname,
      port: Number(this.redisUrl.port || 6379),
      username: this.redisUrl.username || undefined,
      password: this.redisUrl.password || undefined,
      maxRetriesPerRequest: null
    }
  });

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService
  ) {}

  async create(
    tenantId: string,
    input: {
      type: AsyncJobType;
      payload: Record<string, unknown>;
      traceId?: string;
    }
  ) {
    const policy = ASYNC_JOB_POLICIES[input.type];
    const traceId = input.traceId ?? randomUUID();

    const workflowJob = await this.prisma.workflowJob.create({
      data: {
        tenantId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        traceId,
        maxAttempts: policy.maxAttempts
      }
    });

    try {
      await this.queue.add(
        workflowJob.type,
        {
          workflowJobId: workflowJob.id,
          tenantId,
          type: workflowJob.type,
          payload: workflowJob.payload as Record<string, unknown>
        },
        {
          jobId: workflowJob.id,
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 100
        }
      );
    } catch (error) {
      await this.prisma.workflowJob.update({
        where: { id: workflowJob.id },
        data: {
          status: "FAILED"
        }
      });

      throw new InternalServerErrorException(
        `Async job kuyruga eklenemedi: ${(error as Error).message}`
      );
    }

    this.logger.info("async_job.created", {
      tenantId,
      workflowJobId: workflowJob.id,
      type: workflowJob.type,
      traceId,
      maxAttempts: workflowJob.maxAttempts
    });

    return {
      jobId: workflowJob.id,
      status: workflowJob.status.toLowerCase(),
      acceptedAt: workflowJob.createdAt.toISOString(),
      traceId
    };
  }

  async getById(tenantId: string, id: string) {
    const job = await this.prisma.workflowJob.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        retries: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundException("Async job bulunamadi.");
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      runAfter: job.runAfter,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      retries: job.retries
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
