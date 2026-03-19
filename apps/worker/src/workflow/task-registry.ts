import { AiTaskExecutionOrchestrator, type WorkerPayload } from "../ai/ai-task-execution-orchestrator.js";
import { isSupportedWorkflowType } from "../ai/types.js";

export type TaskDefinition = {
  type: string;
  owner: "ai_orchestration" | "integration" | "platform";
  retryProfile: "default" | "aggressive";
  execute: (payload: WorkerPayload, traceId: string) => Promise<unknown>;
};

function simulateWork(payload: WorkerPayload) {
  switch (payload.type) {
    case "cv_parse":
      return {
        status: "queued_for_parse",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "job_requirement_interpretation":
      return {
        status: "queued_for_job_requirement_interpretation",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "candidate_fit_assistance":
      return {
        status: "queued_for_candidate_fit_assistance",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "screening_support":
      return {
        status: "queued_for_screening_support",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "interview_preparation":
      return {
        status: "queued_for_interview_preparation",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "interview_orchestration":
      return {
        status: "queued_for_interview_orchestration",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "transcript_summarization":
      return {
        status: "queued_for_transcript_summarization",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "report_generation":
      return {
        status: "queued_for_report",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "recommendation_generation":
      return {
        status: "queued_for_recommendation",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    case "webhook_retry":
      return {
        status: "queued_for_retry",
        tenantId: payload.tenantId,
        workflowJobId: payload.workflowJobId
      };
    default:
      throw new Error(`Unsupported job type: ${String(payload.type)}`);
  }
}

export function createTaskRegistry(orchestrator: AiTaskExecutionOrchestrator) {
  const registry = new Map<string, TaskDefinition>();

  const allTypes = [
    "cv_parse",
    "job_requirement_interpretation",
    "candidate_fit_assistance",
    "screening_support",
    "interview_preparation",
    "interview_orchestration",
    "transcript_summarization",
    "report_generation",
    "recommendation_generation",
    "webhook_retry"
  ];

  for (const type of allTypes) {
    registry.set(type, {
      type,
      owner: type === "webhook_retry" ? "integration" : "ai_orchestration",
      retryProfile: type === "webhook_retry" ? "aggressive" : "default",
      execute: async (payload, traceId) => {
        if (isSupportedWorkflowType(payload.type)) {
          return orchestrator.execute(payload, traceId);
        }

        return simulateWork(payload);
      }
    });
  }

  return {
    get(type: string) {
      return registry.get(type);
    },
    list() {
      return Array.from(registry.values());
    }
  };
}
