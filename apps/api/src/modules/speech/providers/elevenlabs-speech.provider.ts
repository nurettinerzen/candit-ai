import { Injectable, Logger } from "@nestjs/common";
import type {
  SpeechSynthesisInput,
  SpeechSynthesisResult,
  SpeechTranscriptionInput,
  SpeechTranscriptionResult,
  SttProvider,
  TtsProvider
} from "../contracts/speech-provider.interface";

type CachedTtsConfig = {
  voiceId: string;
  modelId: string;
};

@Injectable()
export class ElevenLabsSpeechProvider implements SttProvider, TtsProvider {
  readonly key = "elevenlabs_speech";

  private readonly logger = new Logger(ElevenLabsSpeechProvider.name);
  private readonly apiKey = process.env.ELEVENLABS_API_KEY?.trim() || "";
  private readonly baseUrl =
    (process.env.ELEVENLABS_API_BASE_URL?.trim() || "https://api.elevenlabs.io/v1").replace(
      /\/+$/,
      ""
    );
  private readonly agentId = process.env.ELEVENLABS_AGENT_ID?.trim() || "";
  private readonly sttModel = process.env.ELEVENLABS_STT_MODEL_ID?.trim() || "scribe_v2";
  private readonly configuredVoiceId = process.env.ELEVENLABS_TTS_VOICE_ID?.trim() || "";
  private readonly configuredTtsModel =
    process.env.ELEVENLABS_TTS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  readonly isConfigured = this.apiKey.length > 0;

  private cachedTtsConfigPromise: Promise<CachedTtsConfig | null> | null = null;

  async transcribe(input: SpeechTranscriptionInput): Promise<SpeechTranscriptionResult> {
    if (!this.isConfigured) {
      return {
        providerKey: this.key,
        status: "not_configured",
        text: null,
        errorMessage: "ELEVENLABS_API_KEY missing"
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
    form.append("model_id", this.sttModel);

    if (input.locale?.trim()) {
      form.append("language_code", input.locale.slice(0, 2).toLowerCase());
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey
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
        errorMessage: `elevenlabs_stt_http_${response.status}:${body.slice(0, 180)}`
      };
    }

    const payload = (await response.json()) as {
      text?: string;
      language_code?: string;
      language_probability?: number;
    };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";

    if (!text) {
      return {
        providerKey: this.key,
        status: "failed",
        text: null,
        errorMessage: "elevenlabs_stt_empty_text"
      };
    }

    return {
      providerKey: this.key,
      status: "ok",
      text,
      metadata: {
        language: payload.language_code ?? null,
        languageProbability: payload.language_probability ?? null,
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
        errorMessage: "ELEVENLABS_API_KEY missing"
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

    const ttsConfig = await this.resolveTtsConfig();
    if (!ttsConfig) {
      return {
        providerKey: this.key,
        status: "not_configured",
        audioBase64: null,
        mimeType: null,
        errorMessage: "ELEVENLABS_TTS voice is not configured"
      };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/text-to-speech/${ttsConfig.voiceId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "audio/mpeg",
          "xi-api-key": this.apiKey
        },
        body: JSON.stringify({
          text: normalizedText.slice(0, 4000),
          model_id: ttsConfig.modelId,
          output_format: "mp3_44100_128"
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
        errorMessage: `elevenlabs_tts_http_${response.status}:${body.slice(0, 180)}`
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
        errorMessage: "elevenlabs_tts_empty_audio"
      };
    }

    return {
      providerKey: this.key,
      status: "ok",
      audioBase64: base64,
      mimeType: "audio/mpeg",
      metadata: {
        model: ttsConfig.modelId,
        voiceId: ttsConfig.voiceId
      }
    };
  }

  private async resolveTtsConfig(): Promise<CachedTtsConfig | null> {
    if (this.configuredVoiceId) {
      return {
        voiceId: this.configuredVoiceId,
        modelId: this.configuredTtsModel
      };
    }

    if (!this.agentId) {
      return null;
    }

    if (!this.cachedTtsConfigPromise) {
      this.cachedTtsConfigPromise = this.fetchAgentTtsConfig();
    }

    return this.cachedTtsConfigPromise;
  }

  private async fetchAgentTtsConfig(): Promise<CachedTtsConfig | null> {
    try {
      const response = await fetch(`${this.baseUrl}/convai/agents/${this.agentId}`, {
        headers: {
          "xi-api-key": this.apiKey,
          accept: "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `ElevenLabs agent voice config fetch failed: ${response.status} ${body.slice(0, 180)}`
        );
        return null;
      }

      const payload = (await response.json()) as {
        conversation_config?: {
          tts?: {
            voice_id?: string;
          };
        };
      };
      const voiceId = payload.conversation_config?.tts?.voice_id?.trim();

      if (!voiceId) {
        this.logger.warn("ElevenLabs agent config does not include a TTS voice_id.");
        return null;
      }

      return {
        voiceId,
        modelId: this.configuredTtsModel
      };
    } catch (error) {
      this.logger.warn(
        `ElevenLabs agent voice config fetch threw: ${
          error instanceof Error ? error.message : "unknown_error"
        }`
      );
      return null;
    }
  }
}
