import { Inject, Injectable } from "@nestjs/common";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import type {
  SpeechSynthesisInput,
  SpeechTranscriptionInput
} from "./contracts/speech-provider.interface";
import { BrowserFallbackSpeechProvider } from "./providers/browser-fallback-speech.provider";
import { ElevenLabsSpeechProvider } from "./providers/elevenlabs-speech.provider";
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
    @Inject(OpenAiSpeechProvider) private readonly openAiProvider: OpenAiSpeechProvider,
    @Inject(ElevenLabsSpeechProvider)
    private readonly elevenLabsProvider: ElevenLabsSpeechProvider
  ) {}

  resolveRuntimeSelection(input?: {
    speechRecognition?: boolean;
    speechSynthesis?: boolean;
  }): SpeechRuntimeSelection {
    const speechConfig = this.runtimeConfig.speechRuntimeConfig;
    const sttProvider =
      input?.speechRecognition === false
        ? null
        : this.resolvePreferredSttProvider(speechConfig.preferredSttProvider);
    const ttsProvider =
      input?.speechSynthesis === false
        ? null
        : this.resolvePreferredTtsProvider(speechConfig.preferredTtsProvider);

    if (!sttProvider && !ttsProvider && input?.speechRecognition && input?.speechSynthesis) {
      return {
        runtimeProviderMode: "browser_native",
        voiceInputProvider: "browser_web_speech_api",
        voiceOutputProvider: "browser_speech_synthesis"
      };
    }

    if (sttProvider || ttsProvider) {
      const voiceInputProvider =
        input?.speechRecognition === false
          ? "manual_text_fallback"
          : sttProvider?.key ?? "browser_web_speech_api";
      const voiceOutputProvider =
        input?.speechSynthesis === false ? "text_prompt_only" : ttsProvider?.key ?? "text_prompt_only";

      return {
        runtimeProviderMode: this.composeRuntimeProviderMode(
          sttProvider?.key ?? null,
          ttsProvider?.key ?? null
        ),
        voiceInputProvider,
        voiceOutputProvider
      };
    }

    return {
      runtimeProviderMode: "manual_fallback",
      voiceInputProvider: input?.speechRecognition ? "browser_web_speech_api" : "manual_text_fallback",
      voiceOutputProvider: input?.speechSynthesis ? "browser_speech_synthesis" : "text_prompt_only"
    };
  }

  async transcribe(input: SpeechTranscriptionInput) {
    const provider = this.resolvePreferredSttProvider(
      this.runtimeConfig.speechRuntimeConfig.preferredSttProvider
    );
    if (!provider) {
      return this.browserFallbackProvider.transcribe(input);
    }

    return provider.transcribe(input);
  }

  async synthesize(input: SpeechSynthesisInput) {
    const provider = this.resolvePreferredTtsProvider(
      this.runtimeConfig.speechRuntimeConfig.preferredTtsProvider
    );
    if (!provider) {
      return this.browserFallbackProvider.synthesize(input);
    }

    return provider.synthesize(input);
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
        },
        {
          key: this.elevenLabsProvider.key,
          configured: this.elevenLabsProvider.isConfigured,
          mode: "provider",
          reason: this.elevenLabsProvider.isConfigured ? null : "ELEVENLABS_API_KEY missing"
        }
      ]
    };
  }

  private resolvePreferredSttProvider(preferred: string) {
    const orderedProviders =
      preferred === "elevenlabs"
        ? [this.elevenLabsProvider, this.openAiProvider]
        : preferred === "openai"
          ? [this.openAiProvider, this.elevenLabsProvider]
          : [this.openAiProvider, this.elevenLabsProvider];

    return orderedProviders.find((provider) => provider.isConfigured) ?? null;
  }

  private resolvePreferredTtsProvider(preferred: string) {
    const orderedProviders =
      preferred === "elevenlabs"
        ? [this.elevenLabsProvider, this.openAiProvider]
        : preferred === "openai"
          ? [this.openAiProvider, this.elevenLabsProvider]
          : [this.openAiProvider, this.elevenLabsProvider];

    return orderedProviders.find((provider) => provider.isConfigured) ?? null;
  }

  private composeRuntimeProviderMode(sttProviderKey: string | null, ttsProviderKey: string | null) {
    const providerKeys = [sttProviderKey, ttsProviderKey].filter(
      (value): value is string => Boolean(value)
    );
    const uniqueKeys = [...new Set(providerKeys)];

    if (uniqueKeys.length === 1) {
      const [providerKey] = uniqueKeys;
      if (providerKey) {
        return this.providerModeKey(providerKey);
      }
    }

    if (uniqueKeys.length > 1) {
      return `provider_backed_mixed:${uniqueKeys.join("+")}`;
    }

    return "manual_fallback";
  }

  private providerModeKey(providerKey: string) {
    if (providerKey === this.openAiProvider.key) {
      return "provider_backed_openai";
    }

    if (providerKey === this.elevenLabsProvider.key) {
      return "provider_backed_elevenlabs";
    }

    return `provider_backed_${providerKey}`;
  }
}
