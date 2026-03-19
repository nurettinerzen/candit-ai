import { Inject, Injectable } from "@nestjs/common";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import type {
  SpeechSynthesisInput,
  SpeechTranscriptionInput
} from "./contracts/speech-provider.interface";
import { BrowserFallbackSpeechProvider } from "./providers/browser-fallback-speech.provider";
import { OpenAiSpeechProvider } from "./providers/openai-speech.provider";

export type SpeechRuntimeSelection = {
  runtimeProviderMode: string;
  voiceInputProvider: string;
  voiceOutputProvider: string;
};

@Injectable()
export class SpeechRuntimeService {
  constructor(
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(BrowserFallbackSpeechProvider)
    private readonly browserFallbackProvider: BrowserFallbackSpeechProvider,
    @Inject(OpenAiSpeechProvider) private readonly openAiProvider: OpenAiSpeechProvider
  ) {}

  resolveRuntimeSelection(input?: {
    speechRecognition?: boolean;
    speechSynthesis?: boolean;
  }): SpeechRuntimeSelection {
    const speechConfig = this.runtimeConfig.speechRuntimeConfig;
    const preferOpenAi =
      speechConfig.preferredSttProvider === "openai" ||
      speechConfig.preferredTtsProvider === "openai";
    const openAiReady = this.openAiProvider.isConfigured;

    if (preferOpenAi && openAiReady) {
      return {
        runtimeProviderMode: "provider_backed_openai",
        voiceInputProvider:
          input?.speechRecognition === false ? "manual_text_fallback" : this.openAiProvider.key,
        voiceOutputProvider:
          input?.speechSynthesis === false ? "text_prompt_only" : this.openAiProvider.key
      };
    }

    if (input?.speechRecognition && input?.speechSynthesis) {
      return {
        runtimeProviderMode: "browser_native",
        voiceInputProvider: "browser_web_speech_api",
        voiceOutputProvider: "browser_speech_synthesis"
      };
    }

    return {
      runtimeProviderMode: "manual_fallback",
      voiceInputProvider: input?.speechRecognition ? "browser_web_speech_api" : "manual_text_fallback",
      voiceOutputProvider: input?.speechSynthesis ? "browser_speech_synthesis" : "text_prompt_only"
    };
  }

  async transcribe(input: SpeechTranscriptionInput) {
    if (!this.openAiProvider.isConfigured) {
      return this.browserFallbackProvider.transcribe(input);
    }

    return this.openAiProvider.transcribe(input);
  }

  async synthesize(input: SpeechSynthesisInput) {
    if (!this.openAiProvider.isConfigured) {
      return this.browserFallbackProvider.synthesize(input);
    }

    return this.openAiProvider.synthesize(input);
  }

  getProviderStatus() {
    return {
      preferred: this.runtimeConfig.speechRuntimeConfig,
      providers: [
        {
          key: this.browserFallbackProvider.key,
          configured: true,
          mode: "fallback"
        },
        {
          key: this.openAiProvider.key,
          configured: this.openAiProvider.isConfigured,
          mode: "provider",
          reason: this.openAiProvider.isConfigured ? null : "OPENAI_API_KEY missing"
        }
      ]
    };
  }
}
