import { Module } from "@nestjs/common";
import { RuntimeConfigModule } from "../../config/runtime-config.module";
import { BrowserFallbackSpeechProvider } from "./providers/browser-fallback-speech.provider";
import { ElevenLabsSpeechProvider } from "./providers/elevenlabs-speech.provider";
import { OpenAiSpeechProvider } from "./providers/openai-speech.provider";
import { SpeechRuntimeService } from "./speech-runtime.service";

@Module({
  imports: [RuntimeConfigModule],
  providers: [
    SpeechRuntimeService,
    BrowserFallbackSpeechProvider,
    OpenAiSpeechProvider,
    ElevenLabsSpeechProvider
  ],
  exports: [SpeechRuntimeService]
})
export class SpeechModule {}
