import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AiProviderClient } from "./ai-provider.interface";
import { NoopAiProviderService } from "./noop-ai-provider.service";
import { OpenAiProviderService } from "./openai-ai-provider.service";

@Injectable()
export class AiProviderRegistryService {
  private readonly providers: Map<string, AiProviderClient>;
  private readonly fallbackProvider: NoopAiProviderService;
  private readonly openAiProvider?: OpenAiProviderService;

  constructor(
    @Inject(NoopAiProviderService) fallbackProvider: NoopAiProviderService,
    @Optional() @Inject(OpenAiProviderService) openAiProvider?: OpenAiProviderService
  ) {
    this.fallbackProvider = fallbackProvider;
    this.openAiProvider = openAiProvider;
    this.providers = new Map<string, AiProviderClient>([[fallbackProvider.key, fallbackProvider]]);

    if (openAiProvider?.isConfigured) {
      this.providers.set(openAiProvider.key, openAiProvider);
    }
  }

  getProvider(key?: string): AiProviderClient {
    if (!key) {
      if (this.openAiProvider?.isConfigured) {
        return this.openAiProvider;
      }

      return this.fallbackProvider;
    }

    return this.providers.get(key) ?? this.fallbackProvider;
  }

  listProviderKeys() {
    return [...this.providers.keys()];
  }

  listProviderStatuses() {
    return [
      {
        key: this.fallbackProvider.key,
        configured: true,
        mode: "fallback" as const,
        active: !this.openAiProvider?.isConfigured
      },
      {
        key: this.openAiProvider?.key ?? "openai",
        configured: Boolean(this.openAiProvider?.isConfigured),
        mode: "provider" as const,
        active: Boolean(this.openAiProvider?.isConfigured),
        reason: this.openAiProvider?.isConfigured
          ? null
          : "OPENAI_API_KEY missing or empty"
      }
    ];
  }

  resolveDefaultProviderKey() {
    return this.openAiProvider?.isConfigured ? this.openAiProvider.key : this.fallbackProvider.key;
  }
}
