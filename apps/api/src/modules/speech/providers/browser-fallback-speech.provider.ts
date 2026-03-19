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
export class BrowserFallbackSpeechProvider implements SttProvider, TtsProvider {
  readonly key = "browser_fallback";
  readonly isConfigured = true;

  async transcribe(_input: SpeechTranscriptionInput): Promise<SpeechTranscriptionResult> {
    return {
      providerKey: this.key,
      status: "failed",
      text: null,
      errorMessage: "Browser-native speech recognition must run client-side."
    };
  }

  async synthesize(_input: SpeechSynthesisInput): Promise<SpeechSynthesisResult> {
    return {
      providerKey: this.key,
      status: "failed",
      audioBase64: null,
      mimeType: null,
      errorMessage: "Browser speech synthesis is client-side; server audio was not generated."
    };
  }
}
