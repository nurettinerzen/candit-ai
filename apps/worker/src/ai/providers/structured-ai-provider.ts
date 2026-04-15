import { TaskProcessingError } from "../task-processing-error.js";
import type { ProviderExecutionMode, SupportedAiTaskType } from "../types.js";

type OpenAiResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
};

export type StructuredGenerationInput = {
  taskType: SupportedAiTaskType;
  schemaName: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  preferProviderKey?: string | null;
};

export type StructuredGenerationResult = {
  mode: ProviderExecutionMode;
  providerKey: string;
  modelKey?: string;
  promptVersion: string;
  output?: Record<string, unknown>;
};

export class StructuredAiProvider {
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  private readonly baseUrl =
    (process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  private readonly defaultModelKey = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  constructor() {
    const masked = this.apiKey
      ? `${this.apiKey.slice(0, 8)}...${this.apiKey.slice(-4)} (${this.apiKey.length} chars)`
      : "NOT SET";
    console.log(`[StructuredAiProvider] OpenAI key: ${masked}, model: ${this.defaultModelKey}`);
  }

  private resolveModelKey(taskType: SupportedAiTaskType) {
    const byTask = {
      CV_PARSING: process.env.OPENAI_MODEL_CV_PARSING?.trim(),
      SCREENING_SUPPORT: process.env.OPENAI_MODEL_SCREENING_SUPPORT?.trim(),
      REPORT_GENERATION: process.env.OPENAI_MODEL_REPORT_GENERATION?.trim(),
      RECOMMENDATION_GENERATION:
        process.env.OPENAI_MODEL_RECOMMENDATION_GENERATION?.trim(),
      APPLICANT_FIT_SCORING: process.env.OPENAI_MODEL_APPLICANT_FIT_SCORING?.trim()
    }[taskType];

    return byTask && byTask.length > 0 ? byTask : this.defaultModelKey;
  }

  async generate(input: StructuredGenerationInput): Promise<StructuredGenerationResult> {
    const requestedProvider = input.preferProviderKey?.trim().toLowerCase();
    const forceFallback = requestedProvider === "deterministic-fallback";
    const modelKey = this.resolveModelKey(input.taskType);

    if (!this.apiKey || forceFallback) {
      return {
        mode: "deterministic_fallback",
        providerKey: "deterministic-fallback",
        promptVersion: input.promptVersion
      };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelKey,
        seed: 42,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: input.systemPrompt
          },
          {
            role: "user",
            content: input.userPrompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: input.schemaName,
            strict: true,
            schema: input.schema
          }
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new TaskProcessingError(
        "LLM_PROVIDER_ERROR",
        `OpenAI istegi basarisiz (${response.status}).`,
        true,
        {
          status: response.status,
          body: errorBody.slice(0, 800),
          taskType: input.taskType
        }
      );
    }

    const payload = (await response.json()) as OpenAiResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new TaskProcessingError(
        "LLM_OUTPUT_EMPTY",
        "OpenAI yanitinda parse edilebilir JSON content bulunamadi.",
        true,
        {
          taskType: input.taskType
        }
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new TaskProcessingError(
        "LLM_OUTPUT_INVALID_JSON",
        "OpenAI yaniti gecerli JSON degil.",
        true,
        {
          raw: content.slice(0, 800),
          taskType: input.taskType
        }
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TaskProcessingError(
        "LLM_OUTPUT_INVALID_SHAPE",
        "OpenAI ciktisi obje tipinde degil.",
        true,
        {
          taskType: input.taskType
        }
      );
    }

    return {
      mode: "llm_openai",
      providerKey: "openai",
      modelKey: payload.model ?? modelKey,
      promptVersion: input.promptVersion,
      output: parsed as Record<string, unknown>
    };
  }
}
