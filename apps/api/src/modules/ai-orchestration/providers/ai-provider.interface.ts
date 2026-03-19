import type { AiTaskType } from "@prisma/client";

export type AiProviderTaskInput = {
  taskRunId: string;
  tenantId: string;
  taskType: AiTaskType;
  payload: Record<string, unknown>;
  locale: "tr";
};

export type AiProviderTaskResult = {
  output: Record<string, unknown>;
  confidence?: number;
  uncertainty?: Record<string, unknown>;
  modelKey?: string;
};

export interface AiProviderClient {
  key: string;
  runTask(input: AiProviderTaskInput): Promise<AiProviderTaskResult>;
}
