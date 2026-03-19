import { TaskProcessingError } from "../ai/task-processing-error.js";

export type RetryClassification = {
  code: string;
  category: "validation" | "dependency" | "transient" | "unexpected";
  recoverable: boolean;
  message: string;
  details: Record<string, unknown>;
};

function inferCategory(code: string): RetryClassification["category"] {
  if (code.includes("NOT_FOUND") || code.includes("MISSING") || code.includes("INVALID") || code.includes("MISMATCH")) {
    return "validation";
  }

  if (code.includes("PROVIDER") || code.includes("LLM")) {
    return "dependency";
  }

  if (code.includes("TIMEOUT") || code.includes("RATE_LIMIT") || code.includes("NETWORK")) {
    return "transient";
  }

  return "unexpected";
}

export function classifyError(error: unknown): RetryClassification {
  if (error instanceof TaskProcessingError) {
    const code = error.code || "TASK_PROCESSING_ERROR";
    return {
      code,
      category: inferCategory(code),
      recoverable: error.recoverable,
      message: error.message,
      details: error.details ?? {}
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    category: "unexpected",
    recoverable: true,
    message: error instanceof Error ? error.message : "unknown_worker_error",
    details: {}
  };
}

export function computeBackoffMs(attempt: number) {
  const safeAttempt = Math.max(attempt, 1);
  const backoffMs = 30_000 * 2 ** (safeAttempt - 1);
  return Math.min(backoffMs, 15 * 60_000);
}
