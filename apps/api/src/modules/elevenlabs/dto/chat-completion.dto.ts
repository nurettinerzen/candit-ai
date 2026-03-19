/**
 * OpenAI-compatible Chat Completion request/response DTOs.
 * ElevenLabs Conversational AI sends requests in this format
 * when configured with a Custom LLM backend.
 */

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequestDto {
  model?: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Parsed session metadata extracted from the system message.
 * Embedded as [SESSION_META:sessionId=...,token=...] in the system prompt.
 */
export interface SessionMeta {
  sessionId: string;
  token: string;
}
