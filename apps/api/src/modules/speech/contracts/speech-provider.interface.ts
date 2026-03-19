export type SpeechTranscriptionInput = {
  tenantId: string;
  sessionId: string;
  audioBase64: string;
  mimeType: string;
  locale?: string;
  traceId?: string;
};

export type SpeechTranscriptionResult = {
  providerKey: string;
  status: "ok" | "not_configured" | "failed";
  text: string | null;
  confidence?: number | null;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export type SpeechSynthesisInput = {
  tenantId: string;
  sessionId: string;
  text: string;
  locale?: string;
  traceId?: string;
};

export type SpeechSynthesisResult = {
  providerKey: string;
  status: "ok" | "not_configured" | "failed";
  audioBase64: string | null;
  mimeType: string | null;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export interface SttProvider {
  readonly key: string;
  readonly isConfigured: boolean;
  transcribe(input: SpeechTranscriptionInput): Promise<SpeechTranscriptionResult>;
}

export interface TtsProvider {
  readonly key: string;
  readonly isConfigured: boolean;
  synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult>;
}
