import { Injectable } from "@nestjs/common";
import type {
  SpeechSynthesisInput,
  SpeechSynthesisResult,
  SpeechTranscriptionInput,
  SpeechTranscriptionResult,
  SttProvider,
  TtsProvider
} from "../contracts/speech-provider.interface";

@Injectable()
export class OpenAiSpeechProvider implements SttProvider, TtsProvider {
  readonly key = "openai_speech";
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  private readonly baseUrl =
    (process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  private readonly sttModel = process.env.OPENAI_STT_MODEL?.trim() || "gpt-4o-mini-transcribe";
  private readonly ttsModel = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  private readonly ttsVoice = process.env.OPENAI_TTS_VOICE?.trim() || "alloy";
  readonly isConfigured = this.apiKey.length > 0;

  async transcribe(input: SpeechTranscriptionInput): Promise<SpeechTranscriptionResult> {
    if (!this.isConfigured) {
      return {
        providerKey: this.key,
        status: "not_configured",
        text: null,
        errorMessage: "OPENAI_API_KEY missing"
      };
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(input.audioBase64, "base64");
    } catch {
      return {
        providerKey: this.key,
        status: "failed",
        text: null,
        errorMessage: "audio_base64_invalid"
      };
    }

    if (audioBuffer.byteLength === 0) {
      return {
        providerKey: this.key,
        status: "failed",
        text: null,
        errorMessage: "audio_payload_empty"
      };
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: input.mimeType || "audio/webm" }),
      "candidate-audio.webm"
    );
    form.append("model", this.sttModel);
    form.append("response_format", "verbose_json");

    if (input.locale?.trim()) {
      form.append("language", input.locale.slice(0, 2));
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`
        },
        body: form
      });
    } catch (error) {
      return {
        providerKey: this.key,
        status: "failed",
        text: null,
        errorMessage: error instanceof Error ? error.message : "stt_network_error"
      };
    }

    if (!response.ok) {
      const body = await response.text();
      return {
        providerKey: this.key,
        status: "failed",
        text: null,
        errorMessage: `openai_stt_http_${response.status}:${body.slice(0, 180)}`
      };
    }

    const payload = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
    };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";

    if (!text) {
      return {
        providerKey: this.key,
        status: "failed",
        text: null,
        errorMessage: "openai_stt_empty_text"
      };
    }

    return {
      providerKey: this.key,
      status: "ok",
      text,
      metadata: {
        language: payload.language ?? null,
        duration: payload.duration ?? null,
        model: this.sttModel
      }
    };
  }

  async synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult> {
    if (!this.isConfigured) {
      return {
        providerKey: this.key,
        status: "not_configured",
        audioBase64: null,
        mimeType: null,
        errorMessage: "OPENAI_API_KEY missing"
      };
    }

    const normalizedText = input.text.trim();
    if (!normalizedText) {
      return {
        providerKey: this.key,
        status: "failed",
        audioBase64: null,
        mimeType: null,
        errorMessage: "tts_text_empty"
      };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.ttsModel,
          voice: this.ttsVoice,
          input: normalizedText.slice(0, 4000),
          format: "mp3"
        })
      });
    } catch (error) {
      return {
        providerKey: this.key,
        status: "failed",
        audioBase64: null,
        mimeType: null,
        errorMessage: error instanceof Error ? error.message : "tts_network_error"
      };
    }

    if (!response.ok) {
      const body = await response.text();
      return {
        providerKey: this.key,
        status: "failed",
        audioBase64: null,
        mimeType: null,
        errorMessage: `openai_tts_http_${response.status}:${body.slice(0, 180)}`
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    if (!base64) {
      return {
        providerKey: this.key,
        status: "failed",
        audioBase64: null,
        mimeType: null,
        errorMessage: "openai_tts_empty_audio"
      };
    }

    return {
      providerKey: this.key,
      status: "ok",
      audioBase64: base64,
      mimeType: "audio/mpeg",
      metadata: {
        model: this.ttsModel,
        voice: this.ttsVoice
      }
    };
  }
}
