import { Injectable } from "@nestjs/common";
import type {
  AiProviderClient,
  AiProviderTaskInput,
  AiProviderTaskResult
} from "./ai-provider.interface";

@Injectable()
export class NoopAiProviderService implements AiProviderClient {
  readonly key = "deterministic-fallback";

  async runTask(input: AiProviderTaskInput): Promise<AiProviderTaskResult> {
    return {
      output: {
        status: "fallback_output",
        taskRunId: input.taskRunId,
        taskType: input.taskType,
        marker: "generated-without-LLM",
        note: "OPENAI_API_KEY tanimli degil; deterministik fallback ciktisi kullanildi."
      },
      modelKey: "deterministic-fallback"
    };
  }
}
