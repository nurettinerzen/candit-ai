import { Injectable } from "@nestjs/common";
import type {
  AiProviderClient,
  AiProviderTaskInput,
  AiProviderTaskResult
} from "./ai-provider.interface";

@Injectable()
export class OpenAiProviderService implements AiProviderClient {
  readonly key = "openai";
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  private readonly baseUrl =
    (process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  private readonly defaultModelKey = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  private modelForTask(taskType: string) {
    const byTask = {
      CV_PARSING: process.env.OPENAI_MODEL_CV_PARSING?.trim(),
      SCREENING_SUPPORT: process.env.OPENAI_MODEL_SCREENING_SUPPORT?.trim(),
      REPORT_GENERATION: process.env.OPENAI_MODEL_REPORT_GENERATION?.trim(),
      RECOMMENDATION_GENERATION:
        process.env.OPENAI_MODEL_RECOMMENDATION_GENERATION?.trim(),
      TRANSCRIPT_SUMMARIZATION:
        process.env.OPENAI_MODEL_TRANSCRIPT_SUMMARIZATION?.trim(),
      INTERVIEW_ORCHESTRATION: process.env.OPENAI_MODEL_INTERVIEW_ORCHESTRATION?.trim()
    } as const;

    const selected = byTask[taskType as keyof typeof byTask];
    return selected && selected.length > 0 ? selected : this.defaultModelKey;
  }

  get isConfigured() {
    return this.apiKey.length > 0;
  }

  async runTask(input: AiProviderTaskInput): Promise<AiProviderTaskResult> {
    if (!this.isConfigured) {
      return {
        output: {
          status: "provider_not_configured",
          provider: this.key,
          marker: "generated-without-LLM",
          taskRunId: input.taskRunId,
          taskType: input.taskType
        },
        modelKey: "deterministic-fallback"
      };
    }

    const modelKey = this.modelForTask(input.taskType);

    const systemPrompt =
      typeof input.payload.systemPrompt === "string"
        ? input.payload.systemPrompt
        : "Yalnizca JSON dondur.";
    const userPrompt =
      typeof input.payload.userPrompt === "string"
        ? input.payload.userPrompt
        : JSON.stringify(input.payload);
    const schemaName =
      typeof input.payload.schemaName === "string"
        ? input.payload.schemaName
        : "ai_task_output";
    const schema =
      typeof input.payload.outputSchema === "object" && input.payload.outputSchema !== null
        ? input.payload.outputSchema
        : {
            type: "object",
            additionalProperties: true
          };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelKey,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("OpenAI yaniti JSON icerigi icermiyor.");
    }

    return {
      output: JSON.parse(content) as Record<string, unknown>,
      modelKey: payload.model ?? modelKey
    };
  }
}
