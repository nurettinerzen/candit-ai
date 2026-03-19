import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient, WorkflowStatus, type Prisma } from "@prisma/client";
import { Job, Worker } from "bullmq";
import { AiTaskExecutionOrchestrator, type WorkerPayload } from "./ai/ai-task-execution-orchestrator.js";
import { classifyError, computeBackoffMs } from "./workflow/retry-policy.js";
import { createTaskRegistry } from "./workflow/task-registry.js";
import { WorkerLogger } from "./workflow/worker-logger.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new URL(redisUrl);
const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: redis.password || undefined,
  maxRetriesPerRequest: null
};

const queueName = "ai-interviewer-jobs";
const prisma = new PrismaClient();
const aiTaskExecutionOrchestrator = new AiTaskExecutionOrchestrator(prisma);
const registry = createTaskRegistry(aiTaskExecutionOrchestrator);
const logger = new WorkerLogger();

async function resolveTraceId(workflowJobId: string, existingTraceId: string | null) {
  if (existingTraceId && existingTraceId.trim().length > 0) {
    return existingTraceId;
  }

  const generated = randomUUID();
  await prisma.workflowJob.update({
    where: {
      id: workflowJobId
    },
    data: {
      traceId: generated
    }
  });

  return generated;
}

async function maybeSkipAlreadySucceededTask(payload: WorkerPayload, traceId: string) {
  const taskRunId = payload.payload?.taskRunId;

  if (typeof taskRunId !== "string" || taskRunId.trim().length === 0) {
    return null;
  }

  const taskRun = await prisma.aiTaskRun.findFirst({
    where: {
      id: taskRunId,
      tenantId: payload.tenantId
    },
    select: {
      id: true,
      status: true,
      completedAt: true
    }
  });

  if (!taskRun || taskRun.status !== "SUCCEEDED") {
    return null;
  }

  logger.info("worker.task.idempotent_skip", {
    workflowJobId: payload.workflowJobId,
    taskRunId: taskRun.id,
    traceId
  });

  return {
    status: "already_succeeded",
    taskRunId: taskRun.id,
    completedAt: taskRun.completedAt?.toISOString() ?? null
  };
}

async function handleJob(job: Job<WorkerPayload>) {
  const workflowJobId = job.data.workflowJobId;

  const current = await prisma.workflowJob.findUnique({
    where: {
      id: workflowJobId
    }
  });

  if (!current) {
    throw new Error(`WorkflowJob bulunamadi: ${workflowJobId}`);
  }

  const traceId = await resolveTraceId(workflowJobId, current.traceId);

  if (current.status === WorkflowStatus.SUCCEEDED || current.status === WorkflowStatus.DEAD_LETTERED) {
    logger.warn("worker.job.skipped_terminal_status", {
      workflowJobId,
      status: current.status,
      traceId
    });

    return {
      status: "skipped_terminal_status",
      workflowJobId,
      currentStatus: current.status
    };
  }

  const taskDefinition = registry.get(job.data.type);
  if (!taskDefinition) {
    throw new Error(`Task registry kaydi bulunamadi: ${job.data.type}`);
  }

  const running = await prisma.workflowJob.update({
    where: {
      id: workflowJobId
    },
    data: {
      status: WorkflowStatus.RUNNING,
      attempts: {
        increment: 1
      },
      runAfter: null
    }
  });

  const attempt = running.attempts;

  logger.info("worker.job.started", {
    workflowJobId,
    tenantId: job.data.tenantId,
    type: job.data.type,
    owner: taskDefinition.owner,
    attempt,
    maxAttempts: running.maxAttempts,
    traceId
  });

  try {
    const alreadySucceeded = await maybeSkipAlreadySucceededTask(job.data, traceId);
    const result = alreadySucceeded ?? (await taskDefinition.execute(job.data, traceId));

    await prisma.workflowJob.update({
      where: {
        id: workflowJobId
      },
      data: {
        status: WorkflowStatus.SUCCEEDED,
        runAfter: null
      }
    });

    logger.info("worker.job.succeeded", {
      workflowJobId,
      tenantId: job.data.tenantId,
      type: job.data.type,
      attempt,
      traceId
    });

    return result;
  } catch (error) {
    const classification = classifyError(error);

    await prisma.workflowRetry.create({
      data: {
        tenantId: job.data.tenantId,
        workflowJobId,
        attempt,
        errorMessage: JSON.stringify({
          code: classification.code,
          category: classification.category,
          recoverable: classification.recoverable,
          message: classification.message,
          details: classification.details,
          traceId
        })
      }
    });

    const shouldDeadLetter = attempt >= running.maxAttempts || !classification.recoverable;

    if (shouldDeadLetter) {
      await prisma.$transaction([
        prisma.workflowJob.update({
          where: { id: workflowJobId },
          data: {
            status: WorkflowStatus.DEAD_LETTERED
          }
        }),
        prisma.deadLetterJob.create({
          data: {
            tenantId: job.data.tenantId,
            originalJobId: workflowJobId,
            type: job.data.type,
            payload: {
              jobPayload: job.data.payload,
              classification,
              traceId
            } as Prisma.InputJsonValue,
            reason: `${classification.code}:${classification.message}`
          }
        })
      ]);

      logger.error("worker.job.dead_lettered", {
        workflowJobId,
        tenantId: job.data.tenantId,
        type: job.data.type,
        attempt,
        maxAttempts: running.maxAttempts,
        traceId,
        classification
      });
    } else {
      const runAfter = new Date(Date.now() + computeBackoffMs(attempt));

      await prisma.workflowJob.update({
        where: {
          id: workflowJobId
        },
        data: {
          status: WorkflowStatus.FAILED,
          runAfter
        }
      });

      logger.warn("worker.job.retry_scheduled", {
        workflowJobId,
        tenantId: job.data.tenantId,
        type: job.data.type,
        attempt,
        nextRunAfter: runAfter.toISOString(),
        traceId,
        classification
      });
    }

    throw error;
  }
}

const worker = new Worker<WorkerPayload>(queueName, handleJob, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4)
});

worker.on("completed", (job) => {
  logger.info("worker.bullmq.completed", {
    jobId: job.id
  });
});

worker.on("failed", (job, error) => {
  logger.error("worker.bullmq.failed", {
    jobId: job?.id,
    message: error.message
  });
});

logger.info("worker.started", {
  queueName,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
  supportedTasks: registry.list().map((task) => ({
    type: task.type,
    owner: task.owner,
    retryProfile: task.retryProfile
  }))
});

async function shutdown() {
  await Promise.allSettled([worker.close(), prisma.$disconnect()]);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
