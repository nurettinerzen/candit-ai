"use client";

import type { Route } from "next";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSiteLanguage } from "../../../components/site-language-provider";
import { ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { getLocaleTag, translateUiText } from "../../../lib/i18n";
import { formatInterviewDeadline } from "../../../lib/interview-invitation";
import type { PublicInterviewSessionView } from "../../../lib/types";
import { ElevenLabsInterview } from "./elevenlabs-interview";

type SpeechRecognitionCtor = new () => SpeechRecognition;

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
      confidence: number;
    };
  }>;
};

type MicPermissionState = "unknown" | "requesting" | "granted" | "denied" | "unsupported";

type SpeakPromptOptions = {
  autoListen?: boolean;
};

type SessionCapabilityOverrides = {
  speechRecognition?: boolean;
  speechSynthesis?: boolean;
};

type StartListeningOptions = {
  assumePermissionGranted?: boolean;
};

type MediaRecorderCtor = typeof MediaRecorder;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

function useSpeechRecognitionSupport() {
  return typeof window !== "undefined"
    ? Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    : false;
}

function useSpeechSynthesisSupport() {
  return typeof window !== "undefined" ? "speechSynthesis" in window : false;
}

function supportsMediaRecorder() {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";
}

function chooseRecordingMimeType() {
  if (!supportsMediaRecorder()) {
    return "";
  }

  const recorderCtor = window.MediaRecorder as MediaRecorderCtor;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];

  return candidates.find((mimeType) => recorderCtor.isTypeSupported(mimeType)) ?? "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Ses kaydı dönüştürülemedi."));
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const payload = result.includes(",") ? result.split(",")[1] ?? "" : "";
      if (!payload) {
        reject(new Error("Ses kaydı boş döndü."));
        return;
      }
      resolve(payload);
    };
    reader.readAsDataURL(blob);
  });
}

export default function CandidateInterviewPage() {
  const { locale } = useSiteLanguage();
  const localeTag = getLocaleTag(locale);
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId;
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const internalModeEnabled = useMemo(
    () => searchParams.get("debug") === "1",
    [searchParams]
  );
  const roomMode = useMemo(() => searchParams.get("room") === "1", [searchParams]);

  const speechRecognitionSupported = useSpeechRecognitionSupport();
  const speechSynthesisSupported = useSpeechSynthesisSupport();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceAudioContextRef = useRef<AudioContext | null>(null);
  const silenceAnalyserRef = useRef<AnalyserNode | null>(null);
  const silenceSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceCheckFrameRef = useRef<number | null>(null);
  const providerSpeechDetectedRef = useRef(false);
  const providerLastSpeechAtRef = useRef<number | null>(null);
  const providerRecordingStartedAtRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);
  const listeningStartedAtRef = useRef<number | null>(null);
  const autoListenRef = useRef<() => void>(() => undefined);
  const activeTurnSpokenRef = useRef<string | null>(null);
  const completionAnnouncedRef = useRef(false);
  const noSpeechRetryRef = useRef(0);
  const speakingRef = useRef(false);
  const listeningRef = useRef(false);
  const recordingRef = useRef(false);
  const workingRef = useRef(false);

  const [view, setView] = useState<PublicInterviewSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [working, setWorking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermissionState>("unknown");
  const [speechError, setSpeechError] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualFallbackVisible, setManualFallbackVisible] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [supportToolsVisible, setSupportToolsVisible] = useState(false);

  const loadSession = useCallback(async () => {
    if (!token) {
      setError("Görüşme bağlantısı geçersiz. Lütfen linki kontrol edin.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiClient.getPublicInterviewSession(sessionId, token);
      setView(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Görüşme oturumu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (promptAudioRef.current) {
        promptAudioRef.current.pause();
        promptAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (
      micPermission === "unknown" &&
      (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia)
    ) {
      setMicPermission("unsupported");
    }
  }, [micPermission]);

  const providerBackedVoice = Boolean(
    view?.runtime.providerMode?.startsWith("provider_backed")
  );
  const audioRecordingSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    supportsMediaRecorder();

  const requestMicrophonePermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicPermission("unsupported");
      return false;
    }

    setMicPermission("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch {
      setMicPermission("denied");
      return false;
    }
  }, []);

  const stopPromptPlayback = useCallback(() => {
    if (promptAudioRef.current) {
      promptAudioRef.current.pause();
      promptAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
  }, []);

  const speakPrompt = useCallback(
    async (promptText: string, options?: SpeakPromptOptions) => {
      const text = promptText.trim();
      const shouldAutoListen = options?.autoListen !== false;

      if (!text || typeof window === "undefined") {
        return;
      }

      stopPromptPlayback();

      const onPromptFinished = () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (
          shouldAutoListen &&
          micPermission === "granted" &&
          (providerBackedVoice || speechRecognitionSupported)
        ) {
          setStatusNote("Sizi dinliyorum...");
          window.setTimeout(() => {
            autoListenRef.current();
          }, 0);
          return;
        }

        setStatusNote("Soruyu dinlediniz. Hazır olduğunuzda sesli yanıt verebilirsiniz.");
      };

      try {
        const promptAudio = await apiClient.getPublicInterviewPromptAudio(sessionId, token);
        if (promptAudio.status === "ok" && promptAudio.audioBase64 && promptAudio.mimeType) {
          const audio = new Audio(
            `data:${promptAudio.mimeType};base64,${promptAudio.audioBase64}`
          );
          promptAudioRef.current = audio;
          audio.onplay = () => {
            speakingRef.current = true;
            setSpeaking(true);
            setStatusNote("AI soruyu sesli iletiyor...");
          };
          audio.onended = () => {
            promptAudioRef.current = null;
            onPromptFinished();
          };
          audio.onerror = () => {
            promptAudioRef.current = null;
            speakingRef.current = false;
            setSpeaking(false);
            setSpeechError("Soru sesi oynatılamadı. Teknik sorun sürerse yazılı yanıt alanı açılabilir.");
          };
          await audio.play();
          return;
        }
      } catch {
        // Provider-backed prompt audio could fail locally; browser speech remains fallback.
      }

      if (!speechSynthesisSupported) {
        speakingRef.current = false;
        setSpeaking(false);
        if (shouldAutoListen && speechRecognitionSupported && micPermission === "granted") {
          setStatusNote("AI sorusu gösterildi. Yanıtınız için dinlemeye geçiliyor...");
          window.setTimeout(() => {
            autoListenRef.current();
          }, 0);
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = localeTag;
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        setStatusNote("AI soruyu sesli iletiyor...");
      };
      utterance.onend = onPromptFinished;
      utterance.onerror = () => {
        speakingRef.current = false;
        setSpeaking(false);

        if (shouldAutoListen && speechRecognitionSupported && micPermission === "granted") {
          window.setTimeout(() => {
            autoListenRef.current();
          }, 0);
          return;
        }

        setSpeechError("Soru sesi oynatılamadı. Teknik sorun sürerse yazılı yanıt alanı açılabilir.");
      };

      const voices = window.speechSynthesis.getVoices();
      const preferredPrefix = locale === "en" ? "en" : "tr";
      const preferredVoice = voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(preferredPrefix)
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    },
    [
      locale,
      localeTag,
      micPermission,
      providerBackedVoice,
      sessionId,
      speechRecognitionSupported,
      speechSynthesisSupported,
      stopPromptPlayback,
      token
    ]
  );

  const startSession = useCallback(async (overrides?: SessionCapabilityOverrides) => {
    if (!token) {
      return false;
    }

    setWorking(true);
    workingRef.current = true;
    setSpeechError("");

    try {
      const data = await apiClient.startPublicInterviewSession(sessionId, {
        token,
        capabilities: {
          speechRecognition:
            overrides?.speechRecognition ?? (speechRecognitionSupported && micPermission === "granted"),
          speechSynthesis: overrides?.speechSynthesis ?? speechSynthesisSupported,
          locale: localeTag
        }
      });

      setView(data);
      setJoined(true);
      setStatusNote("AI görüşmeyi otomatik yönetiyor.");
      return true;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Görüşme başlatılamadı.");
      return false;
    } finally {
      setWorking(false);
      workingRef.current = false;
    }
  }, [localeTag, micPermission, sessionId, speechRecognitionSupported, speechSynthesisSupported, token]);

  const joinAndStart = useCallback(async () => {
    if (!token || joining || working) {
      return;
    }

    setJoining(true);
    setSpeechError("");
    setError("");
    setStatusNote("");

    const micGranted = await requestMicrophonePermission();
    const started = await startSession({
      speechRecognition: speechRecognitionSupported && micGranted,
      speechSynthesis: speechSynthesisSupported
    });

    if (started && !micGranted && speechRecognitionSupported) {
      setSpeechError("Mikrofon izni verilmedi. Yazılı yanıt verebilirsiniz.");
    }

    setJoining(false);
  }, [
    joining,
    requestMicrophonePermission,
    speechRecognitionSupported,
    speechSynthesisSupported,
    startSession,
    token,
    working
  ]);

  const submitAnswer = useCallback(
    async (
      transcriptText: string,
      source: "voice_browser" | "manual_text",
      confidence?: number,
      durationMs?: number
    ) => {
      if (!token) {
        return;
      }

      const trimmed = transcriptText.trim();
      if (!trimmed) {
        setSpeechError("Boş cevap gönderilemez.");
        return;
      }

      setWorking(true);
      workingRef.current = true;
      setSpeechError("");
      setStatusNote("");

      try {
        const latencyMs =
          listeningStartedAtRef.current !== null ? Date.now() - listeningStartedAtRef.current : undefined;

        const updated = await apiClient.submitPublicInterviewAnswer(sessionId, {
          token,
          transcriptText: trimmed,
          answerSource: source,
          confidence,
          speechDurationMs: durationMs,
          speechLatencyMs: latencyMs,
          locale: localeTag
        });

        setView(updated);
        setManualAnswer("");
        setManualFallbackVisible(false);
        setStatusNote(
          updated.status === "RUNNING"
            ? "Yanıt kaydedildi. AI sıradaki adımı belirliyor..."
            : "Görüşme tamamlandı."
        );
      } catch (submitError) {
        setSpeechError(submitError instanceof Error ? submitError.message : "Cevap gönderilemedi.");
      } finally {
        setWorking(false);
        workingRef.current = false;
      }
    },
    [localeTag, sessionId, token]
  );

  const startListening = useCallback(async (options?: StartListeningOptions) => {
    if (
      workingRef.current ||
      speakingRef.current ||
      listeningRef.current ||
      !view ||
      view.status !== "RUNNING" ||
      !view.activePrompt
    ) {
      return;
    }

    const hasMicPermission =
      options?.assumePermissionGranted === true || micPermission === "granted";

    if (!speechRecognitionSupported || !hasMicPermission || typeof window === "undefined") {
      setSpeechError("Mikrofon kullanılamıyor. Yazılı yanıt verebilirsiniz.");
      return;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setSpeechError("Ses tanıma motoru kullanılamıyor.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new RecognitionCtor();
    recognition.lang = localeTag;
    recognition.interimResults = false;
    recognition.continuous = false;

    let transcriptCaptured = false;
    let errorCode: string | null = null;

    recognition.onresult = (event) => {
      const finalResult = Array.from(event.results)
        .map((item) => item[0])
        .find(Boolean);
      const transcript = finalResult?.transcript ?? "";

      if (!transcript.trim()) {
        return;
      }

      const confidence = finalResult?.confidence;
      const duration =
        listeningStartedAtRef.current !== null ? Date.now() - listeningStartedAtRef.current : undefined;

      transcriptCaptured = true;
      noSpeechRetryRef.current = 0;
      listeningRef.current = false;
      setListening(false);
      void submitAnswer(transcript, "voice_browser", confidence, duration);
    };

    recognition.onerror = (event) => {
      errorCode = event.error;
      listeningRef.current = false;
      setListening(false);

      if (event.error === "aborted") {
        return;
      }

      if (event.error === "no-speech" && noSpeechRetryRef.current < 1) {
        noSpeechRetryRef.current += 1;
        setStatusNote("Yanıt duyulamadı. Tekrar dinleniyor...");
        window.setTimeout(() => {
          void startListening();
        }, 350);
        return;
      }

      setSpeechError(`Ses tanıma hatası: ${event.error}`);
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);

      if (!transcriptCaptured && !errorCode) {
        setSpeechError("Yanıt algılanamadı. Yeniden konuşabilir veya yazılı yanıt verebilirsiniz.");
      }
    };

    recognitionRef.current = recognition;
    listeningStartedAtRef.current = Date.now();
    listeningRef.current = true;
    setListening(true);
    setStatusNote("Sizi dinliyorum...");

    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setSpeechError("Mikrofon başlatılamadı. Yazılı yanıt verebilirsiniz.");
    }
  }, [
    micPermission,
    speechRecognitionSupported,
    submitAnswer,
    localeTag,
    view
  ]);

  const stopProviderRecordingResources = useCallback(() => {
    if (typeof window !== "undefined" && silenceCheckFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceCheckFrameRef.current);
      silenceCheckFrameRef.current = null;
    }
    if (silenceSourceRef.current) {
      silenceSourceRef.current.disconnect();
      silenceSourceRef.current = null;
    }
    if (silenceAnalyserRef.current) {
      silenceAnalyserRef.current.disconnect();
      silenceAnalyserRef.current = null;
    }
    if (silenceAudioContextRef.current) {
      void silenceAudioContextRef.current.close();
      silenceAudioContextRef.current = null;
    }
    providerSpeechDetectedRef.current = false;
    providerLastSpeechAtRef.current = null;
    providerRecordingStartedAtRef.current = null;
    recordingRef.current = false;

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const submitRecordedAudio = useCallback(
    async (blob: Blob) => {
      if (!token) {
        return;
      }

      const mimeType = blob.type || "audio/webm";
      const audioBase64 = await blobToBase64(blob);

      setWorking(true);
      workingRef.current = true;
      setSpeechError("");
      setStatusNote("Yanıtınız çözülüyor ve AI sıradaki adımı hazırlıyor...");

      try {
        const updated = await apiClient.submitPublicInterviewAudioAnswer(sessionId, {
          token,
          audioBase64,
          mimeType,
          locale: localeTag
        });
        setView(updated);
        setStatusNote(
          updated.status === "RUNNING"
            ? "Yanıt kaydedildi. Sıradaki soru hazırlanıyor..."
            : "Görüşme tamamlandı."
        );
      } catch (submitError) {
        setSpeechError(
          submitError instanceof Error ? submitError.message : "Sesli yanıt gönderilemedi."
        );
      } finally {
        setWorking(false);
        workingRef.current = false;
      }
    },
    [localeTag, sessionId, token]
  );

  const startProviderRecording = useCallback(async () => {
    if (
      !view ||
      view.status !== "RUNNING" ||
      workingRef.current ||
      speakingRef.current ||
      listeningRef.current ||
      recordingRef.current
    ) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !supportsMediaRecorder()) {
      setSpeechError("Tarayıcı ses kaydını desteklemiyor. Gerekirse yazılı olarak devam edebilirsiniz.");
      return;
    }

    setSpeechError("");
    setStatusNote("Sizi dinliyorum...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      providerSpeechDetectedRef.current = false;
      providerLastSpeechAtRef.current = null;
      providerRecordingStartedAtRef.current = Date.now();
      setMicPermission("granted");

      const AudioContextCtor =
        typeof window !== "undefined"
          ? (window.AudioContext ??
              (window as typeof window & {
                webkitAudioContext?: typeof AudioContext;
              }).webkitAudioContext)
          : undefined;

      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        silenceAudioContextRef.current = audioContext;
        silenceSourceRef.current = source;
        silenceAnalyserRef.current = analyser;

        const data = new Uint8Array(analyser.fftSize);
        const silenceMsToSubmit = 1200;
        const maxRecordingMs = 45000;
        const minRecordWindowMs = 800;
        const speechThreshold = 0.045;

        const inspectAudio = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            return;
          }

          analyser.getByteTimeDomainData(data);

          let sumSquares = 0;
          for (const sample of data) {
            const normalized = (sample - 128) / 128;
            sumSquares += normalized * normalized;
          }

          const rms = Math.sqrt(sumSquares / data.length);
          const now = Date.now();

          if (rms >= speechThreshold) {
            providerSpeechDetectedRef.current = true;
            providerLastSpeechAtRef.current = now;
          }

          const startedAt = providerRecordingStartedAtRef.current ?? now;
          const elapsedMs = now - startedAt;
          const silenceDurationMs = providerLastSpeechAtRef.current
            ? now - providerLastSpeechAtRef.current
            : 0;

          if (elapsedMs >= maxRecordingMs) {
            setStatusNote("Yanıt süresi doldu. Gönderiliyor...");
            mediaRecorderRef.current.stop();
            return;
          }

          if (
            providerSpeechDetectedRef.current &&
            elapsedMs >= minRecordWindowMs &&
            silenceDurationMs >= silenceMsToSubmit
          ) {
            setStatusNote("Yanıtınız alındı. Gönderiliyor...");
            mediaRecorderRef.current.stop();
            return;
          }

          silenceCheckFrameRef.current = window.requestAnimationFrame(inspectAudio);
        };

        silenceCheckFrameRef.current = window.requestAnimationFrame(inspectAudio);
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        recordingRef.current = false;
        setRecording(false);
        stopProviderRecordingResources();
        setSpeechError("Ses kaydı sırasında teknik bir sorun oluştu.");
      };

      recorder.onstop = () => {
        const chunks = [...recordedChunksRef.current];
        recordedChunksRef.current = [];
        recordingRef.current = false;
        setRecording(false);
        stopProviderRecordingResources();

        if (chunks.length === 0) {
          setSpeechError("Ses kaydı alınamadı. Tekrar deneyebilirsiniz.");
          return;
        }

        const audioBlob = new Blob(chunks, {
          type: mimeType || recorder.mimeType || "audio/webm"
        });
        void submitRecordedAudio(audioBlob);
      };

      recorder.start();
      recordingRef.current = true;
      setRecording(true);
    } catch {
      setSpeechError("Mikrofon başlatılamadı. Gerekirse yazılı olarak devam edebilirsiniz.");
    }
  }, [
    stopProviderRecordingResources,
    submitRecordedAudio,
    view
  ]);

  const stopProviderRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    setStatusNote("Yanıtınız gönderiliyor...");
    mediaRecorderRef.current.stop();
  }, []);

  useEffect(() => {
    autoListenRef.current = () => {
      if (speechRecognitionSupported && micPermission === "granted") {
        void startListening({ assumePermissionGranted: true });
        return;
      }

      if (providerBackedVoice) {
        void startProviderRecording();
        return;
      }

      void startListening();
    };
  }, [micPermission, providerBackedVoice, speechRecognitionSupported, startListening, startProviderRecording]);

  const enableVoiceResponse = useCallback(async () => {
    if (!view || view.status !== "RUNNING") {
      return;
    }

    if (speechRecognitionSupported) {
      setSpeechError("");

      let micGranted = micPermission === "granted";
      if (!micGranted) {
        micGranted = await requestMicrophonePermission();
      }

      if (!micGranted) {
        setSpeechError("Mikrofon izni verilmedi. Yazılı yanıt verebilirsiniz.");
        return;
      }

      setJoined(true);
      setStatusNote("Sizi dinliyorum...");
      window.setTimeout(() => {
        void startListening({ assumePermissionGranted: true });
      }, 0);
      return;
    }

    if (providerBackedVoice) {
      if (recording) {
        stopProviderRecording();
      } else {
        await startProviderRecording();
      }
      return;
    }

    setSpeechError("");

    let micGranted = micPermission === "granted";
    if (!micGranted) {
      micGranted = await requestMicrophonePermission();
    }

    if (!micGranted) {
      setSpeechError("Mikrofon izni verilmedi. Yazılı yanıt verebilirsiniz.");
      return;
    }

    setJoined(true);
    setStatusNote("Sizi dinliyorum...");
    window.setTimeout(() => {
      void startListening({ assumePermissionGranted: true });
    }, 0);
  }, [
    micPermission,
    providerBackedVoice,
    recording,
    requestMicrophonePermission,
    speechRecognitionSupported,
    startListening,
    startProviderRecording,
    stopProviderRecording,
    view
  ]);

  useEffect(() => {
    if (!joined || !view || view.status !== "RUNNING" || !view.activePrompt) {
      return;
    }

    if (activeTurnSpokenRef.current === view.activePrompt.turnId) {
      return;
    }

    activeTurnSpokenRef.current = view.activePrompt.turnId;
    setSpeechError("");
    void speakPrompt(view.activePrompt.text, { autoListen: true });
  }, [joined, speakPrompt, view]);

  useEffect(() => {
    setManualFallbackVisible(false);
    setManualAnswer("");
  }, [view?.activePrompt?.turnId]);

  useEffect(() => {
    if (!joined || !view || view.status !== "COMPLETED" || completionAnnouncedRef.current) {
      return;
    }

    completionAnnouncedRef.current = true;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const closingText = [...(view.transcript?.preview ?? [])]
      .reverse()
      .find((segment) => segment.speaker === "AI")?.text;

    if (closingText) {
      void speakPrompt(closingText, { autoListen: false });
    }

    setStatusNote("Görüşme tamamlandı. Teşekkür ederiz.");
  }, [joined, speakPrompt, view]);

  const repeatQuestion = useCallback(async () => {
    if (!token) {
      return;
    }

    setWorking(true);
    setSpeechError("");

    try {
      const updated = await apiClient.repeatPublicInterviewQuestion(sessionId, token);
      setView(updated);
      if (updated.activePrompt) {
        activeTurnSpokenRef.current = null;
        void speakPrompt(updated.activePrompt.text, { autoListen: true });
      }
    } catch (repeatError) {
      setSpeechError(repeatError instanceof Error ? repeatError.message : "Soru tekrarlanamadı.");
    } finally {
      setWorking(false);
    }
  }, [sessionId, speakPrompt, token]);

  const abandonSession = useCallback(async () => {
    if (!token) {
      return;
    }

    setWorking(true);
    setSpeechError("");

    try {
      const updated = await apiClient.abandonPublicInterviewSession(sessionId, {
        token,
        reasonCode: "candidate_left"
      });
      setView(updated);
      setStatusNote("Görüşme sonlandırıldı.");
    } catch (abandonError) {
      setSpeechError(abandonError instanceof Error ? abandonError.message : "Oturum sonlandırılamadı.");
    } finally {
      setWorking(false);
    }
  }, [sessionId, token]);

  const isExpired = view?.invitation?.state === "EXPIRED" || view?.status === "NO_SHOW";
  const isCompleted = view?.status === "COMPLETED" || view?.invitation?.state === "COMPLETED";
  const isFailed = view?.status === "FAILED" || view?.status === "CANCELLED";
  const sessionInFinalState = Boolean(isCompleted || isFailed || isExpired);
  const progressPercent = view ? Math.round(view.progress.ratio * 100) : 0;
  const deadlineText = formatInterviewDeadline(view?.invitation?.expiresAt);
  const interviewSummaryTitle = view?.status === "RUNNING" ? "Görüşmeye Devam Et" : "Görüşme";
  const transcriptPreview = view?.transcript?.preview ?? [];
  const activePromptText = view?.activePrompt?.text ?? "";
  const candidateInitials = (view?.candidate.fullName || "A")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const useElevenLabsRoom = roomMode && !internalModeEnabled;
  const showPrepScreen = !roomMode;
  const showElevenLabsRoom = Boolean(useElevenLabsRoom && roomMode && view && !sessionInFinalState);
  const showRoomJoinScreen = Boolean(!useElevenLabsRoom && roomMode && view && !joined && !sessionInFinalState);
  const showRunningPanel = Boolean(!useElevenLabsRoom && roomMode && view?.status === "RUNNING" && joined);
  const roomHref = useMemo(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("room", "1");
    const query = nextParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);
  const prepHref = useMemo(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("room");
    const query = nextParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const micPermissionLabel = (() => {
    switch (micPermission) {
      case "requesting":
        return "Mikrofon izni isteniyor...";
      case "granted":
        return "İzin verildi";
      case "denied":
        return "İzin verilmedi";
      case "unsupported":
        return "Tarayıcı desteklemiyor";
      default:
        return "Henüz kontrol edilmedi";
    }
  })();
  const liveState = (() => {
    if (!view) {
      return {
        title: "Hazırlanıyor",
        detail: "Oturum verileri yükleniyor."
      };
    }

    if (joining) {
      return {
        title: "Bağlanıyor",
        detail: "Mikrofon ve görüşme oturumu hazırlanıyor."
      };
    }

    if (view.status === "COMPLETED") {
      return {
        title: "Tamamlandı",
        detail: "AI görüşmeyi kapattı."
      };
    }

    if (isExpired) {
      return {
        title: "Süre Doldu",
        detail: "Bu davet linkinin geçerlilik penceresi kapandı."
      };
    }

    if (view.status === "FAILED" || view.status === "CANCELLED") {
      return {
        title: "Sonlandı",
        detail: "Oturum tamamlanmadan sonlandı."
      };
    }

    if (recording) {
      return {
        title: "Dinleniyor",
        detail: "Yanıtınız alınıyor. Cevabınız bittiğinde kısa bir sessizlikten sonra otomatik gönderilir."
      };
    }

    if (working) {
      return {
        title: "Yanıt İşleniyor",
        detail: "AI yanıtınızı değerlendiriyor."
      };
    }

    if (speaking) {
      return {
        title: "AI Konuşuyor",
        detail: "Soruyu sesli olarak dinleyin."
      };
    }

    if (listening) {
      return {
        title: "Dinleniyor",
        detail: "Yanıtınız sesli olarak alınıyor."
      };
    }

    if (view.status === "RUNNING" && view.activePrompt) {
      return {
        title: "Yanıt Bekleniyor",
        detail: providerBackedVoice
          ? "Sesli yanıt kaydını başlatıp gönderin."
          : micPermission === "granted" && speechRecognitionSupported
            ? "Konuşmanız otomatik kaydedilecek."
            : "Mikrofon kullanılamıyorsa yazılı olarak devam edebilirsiniz."
      };
    }

    return {
      title: "Hazır",
      detail: "AI sıradaki soruyu hazırlıyor."
    };
  })();

  const canOfferManualFallback = Boolean(
    view?.status === "RUNNING" &&
    (micPermission === "denied" ||
      micPermission === "unsupported" ||
      speechError.trim().length > 0 ||
      (providerBackedVoice && !audioRecordingSupported))
  );
  const showPromptText = Boolean(internalModeEnabled);
  const showTechnicalControls = Boolean(
    internalModeEnabled ||
      supportToolsVisible ||
      manualFallbackVisible ||
      speechError.trim().length > 0 ||
      canOfferManualFallback
  );
  const assistantPresence = speaking
    ? "Konuşuyor"
    : working
      ? "Yanıtınızı değerlendiriyor"
      : view?.status === "RUNNING"
        ? "Hazır"
        : liveState.title;
  const candidatePresence = recording || listening
    ? "Konuşuyorsunuz"
    : working
      ? "Yanıtınız işleniyor"
      : micPermission === "granted"
        ? "Bağlı"
        : "Hazırlanıyor";
  const videoTileStyle: React.CSSProperties = {
    minHeight: 320,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(11,18,32,0.86)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px rgba(2,6,23,0.32)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 14
  };
  const roomPanelStyle: React.CSSProperties = {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,15,26,0.78)",
    boxShadow: "0 30px 80px rgba(2,6,23,0.38)",
    backdropFilter: "blur(24px)",
    overflow: "hidden"
  };

  const prepCardStyle: React.CSSProperties = {
    padding: "20px 24px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)"
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: roomMode
          ? "radial-gradient(ellipse at 20% 0%, rgba(80,70,229,0.14), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(13,148,136,0.08), transparent 50%), #07101e"
          : "radial-gradient(ellipse at 50% 0%, rgba(80,70,229,0.10), transparent 40%), #0a1120",
        padding: roomMode ? "24px 18px 40px" : "0",
        fontFamily: "var(--font-sans)",
        color: "#e2e8f0"
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: roomMode ? 1360 : 680,
          margin: "0 auto",
          padding: roomMode ? 0 : "48px 24px 64px"
        }}
      >
        {/* ──── PREP SCREEN HEADER ──── */}
        {showPrepScreen ? (
          <header style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ display: "inline-block", width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#5046e5,#7c3aed)", textAlign: "center", lineHeight: "36px", color: "#fff", fontWeight: 700, fontSize: 14 }}>C</span>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>Candit.ai</span>
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>
              {interviewSummaryTitle}
            </h1>
            <p style={{ margin: 0, color: "rgba(148,163,184,0.9)", fontSize: 15, maxWidth: 480, marginInline: "auto" }}>
              {translateUiText("AI destekli ön görüşmenize buradan katılabilirsiniz.", locale)}
            </p>
          </header>
        ) : (
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ display: "inline-block", width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#5046e5,#7c3aed)", textAlign: "center", lineHeight: "32px", color: "#fff", fontWeight: 700, fontSize: 12 }}>C</span>
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>Candit.ai</span>
                <span style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{translateUiText("Görüşme Odası", locale)}</span>
              </div>
              <h1 style={{ margin: "0 0 4px", fontSize: "clamp(1.5rem, 2.5vw, 2rem)", letterSpacing: "-0.5px" }}>
                {view?.job.title ? translateUiText(view.job.title, locale) : translateUiText("Görüşme", locale)}
              </h1>
              <p style={{ margin: 0, color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
                {view?.candidate.fullName}
              </p>
            </div>
            <button type="button" className="ghost-button" onClick={() => router.push(prepHref as Route)} style={{ whiteSpace: "nowrap" }}>
              {translateUiText("Hazırlık Ekranına Dön", locale)}
            </button>
          </header>
        )}

        {loading ? <LoadingState message={translateUiText("Görüşme oturumu hazırlanıyor...", locale)} /> : null}
        {!loading && error ? <ErrorState title={translateUiText("Oturum hatası", locale)} error={error} /> : null}

        {!loading && !error && view ? (
          <>
            {/* ──── PREP SCREEN ──── */}
            {showPrepScreen ? (
              <>
                {/* Main card */}
                <div style={{ ...prepCardStyle, padding: 0, overflow: "hidden" }}>
                  {/* Info grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ padding: "20px 24px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(148,163,184,0.6)" }}>{translateUiText("Aday", locale)}</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{view.candidate.fullName}</p>
                    </div>
                    <div style={{ padding: "20px 24px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(148,163,184,0.6)" }}>{translateUiText("Pozisyon", locale)}</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{view.job.title}</p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "20px 24px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(148,163,184,0.6)" }}>{translateUiText("Tahmini Süre", locale)}</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>15–20 dakika</p>
                    </div>
                    <div style={{ padding: "20px 24px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(148,163,184,0.6)" }}>{translateUiText("Durum", locale)}</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{liveState.title}</p>
                    </div>
                  </div>
                </div>

                {/* Deadline notice */}
                <div style={{
                  marginTop: 16,
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: isExpired ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(80,70,229,0.15)",
                  background: isExpired ? "rgba(239,68,68,0.06)" : "rgba(80,70,229,0.04)"
                }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: isExpired ? "#f87171" : "#a78bfa" }}>
                      {translateUiText("Son Geçerlilik", locale)}: {deadlineText}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
                    {translateUiText("Aynı linki geçerlilik süresi boyunca kullanabilirsiniz. Görüşme tamamlandığında bağlantı tekrar açılamaz.", locale)}
                  </p>
                </div>

                {/* Tips */}
                <div style={{ marginTop: 16, ...prepCardStyle }}>
                  <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{translateUiText("Görüşme öncesi öneriler", locale)}</p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[
                      translateUiText("Sessiz bir ortamda olduğunuzdan emin olun", locale),
                      translateUiText("Hoparlör ve mikrofonunuzun çalıştığını kontrol edin", locale),
                      translateUiText("Görüşmeyi tek seferde tamamlamayı planlayın", locale),
                      translateUiText("Sorular sesli gelir, doğal bir şekilde yanıt verin", locale)
                    ].map((tip) => (
                      <div key={tip} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(148,163,184,0.4)", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "rgba(148,163,184,0.9)" }}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                {!sessionInFinalState ? (
                  <div style={{ marginTop: 24, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => router.push(roomHref as Route)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 10,
                        padding: "16px 36px", fontSize: 16, fontWeight: 600,
                        background: "linear-gradient(135deg, #5046e5, #7c3aed)",
                        color: "#fff", border: "none", borderRadius: 14, cursor: "pointer",
                        boxShadow: "0 8px 32px rgba(80,70,229,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                        fontFamily: "inherit", letterSpacing: "-0.2px",
                        transition: "transform 0.15s, box-shadow 0.15s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(80,70,229,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(80,70,229,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
                    >
                      {view.status === "RUNNING" ? translateUiText("Görüşmeye Devam Et", locale) : translateUiText("Görüşmeyi Başlat", locale)}
                      <span style={{ fontSize: 18 }}>→</span>
                    </button>
                  </div>
                ) : null}

                {/* Final state cards */}
                {isExpired ? (
                  <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.05)" }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#f87171" }}>{translateUiText("Görüşme Davetinin Süresi Doldu", locale)}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
                      {translateUiText("Bu link artık kullanılamaz. Yeni bir görüşme daveti gerekirse işe alım ekibiyle iletişime geçilmelidir.", locale)}
                    </p>
                  </div>
                ) : null}

                {isFailed ? (
                  <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.05)" }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#f87171" }}>{translateUiText("Görüşme Sonlandı", locale)}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
                      {translateUiText("Oturum tamamlanmadan sonlandı. Gerekirse yeni bir görüşme bağlantısı için işe alım ekibiyle iletişime geçebilirsiniz.", locale)}
                    </p>
                  </div>
                ) : null}

                {isCompleted ? (
                  <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 14, border: "1px solid rgba(34,197,94,0.15)", background: "rgba(34,197,94,0.05)" }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#4ade80" }}>{translateUiText("Görüşme Tamamlandı", locale)}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
                      {translateUiText("Teşekkür ederiz. Görüşme sonuçlarınız değerlendirilecektir.", locale)}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}

            {roomMode ? (
              <section style={roomPanelStyle}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{translateUiText("Aday", locale)}</span>
                      <strong style={{ fontSize: 13 }}>{view.candidate.fullName}</strong>
                    </div>
                    <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{translateUiText("Pozisyon", locale)}</span>
                      <strong style={{ fontSize: 13 }}>{view.job.title}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(80,70,229,0.12)", fontSize: 12, fontWeight: 600, color: "#a78bfa" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />
                      {liveState.title}
                    </span>
                  </div>
                </div>

                {showElevenLabsRoom ? (
                  <div style={{ padding: 24 }}>
                    <ElevenLabsInterview
                      sessionId={sessionId}
                      token={token}
                      initialView={view}
                      onViewUpdate={setView}
                      autoStart
                    />
                  </div>
                ) : null}

                {showRoomJoinScreen ? (
                  <div style={{ padding: 24 }}>
                    <div
                      style={{
                        display: "grid",
                        gap: 18,
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
                      }}
                    >
                      <div style={videoTileStyle}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 12px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "#7c73fa",
                                boxShadow: "0 0 0 6px rgba(124,115,250,0.12)"
                              }}
                            />
                            Candit Asistan
                          </span>
                          <span className="small" style={{ color: "rgba(226,232,240,0.72)" }}>
                            Hazır
                          </span>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            borderRadius: 20,
                            display: "grid",
                            placeItems: "center",
                            background:
                              "radial-gradient(circle at top, rgba(124,115,250,0.24), rgba(15,23,42,0.92) 64%)"
                          }}
                        >
                          <div
                            style={{
                              width: 120,
                              height: 120,
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, rgba(124,115,250,0.95), rgba(79,70,229,0.72))",
                              display: "grid",
                              placeItems: "center",
                              color: "white",
                              fontSize: 34,
                              fontWeight: 800
                            }}
                          >
                            AI
                          </div>
                        </div>
                        <div className="small" style={{ color: "rgba(226,232,240,0.76)" }}>
                          Sorular sesli olarak gelir. Mikrofonu açtığınızda doğal akışla görüşme başlar.
                        </div>
                      </div>

                      <div
                        style={{
                          ...videoTileStyle,
                          background:
                            "linear-gradient(180deg, rgba(15,23,42,0.88), rgba(3,7,18,0.96))"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 12px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: micPermission === "granted" ? "#22c55e" : "#f59e0b",
                                  boxShadow:
                                    micPermission === "granted"
                                      ? "0 0 0 6px rgba(34,197,94,0.14)"
                                      : "0 0 0 6px rgba(245,158,11,0.12)"
                                }}
                              />
                            {view.candidate.fullName}
                          </span>
                          <span className="small" style={{ color: "rgba(226,232,240,0.72)" }}>
                            Hazır
                          </span>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            borderRadius: 20,
                            background:
                              "linear-gradient(180deg, rgba(20,184,166,0.18), rgba(15,23,42,0.92))",
                            display: "grid",
                            placeItems: "center"
                          }}
                        >
                          <div
                            style={{
                              width: 120,
                              height: 120,
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, rgba(16,185,129,0.94), rgba(13,148,136,0.76))",
                              display: "grid",
                              placeItems: "center",
                              color: "white",
                              fontSize: 32,
                              fontWeight: 800
                            }}
                          >
                            {candidateInitials}
                          </div>
                        </div>
                        <div className="small" style={{ color: "rgba(226,232,240,0.76)" }}>
                          Görüşme sesli olarak ilerler. Mikrofonunuz hazır olduğunda odaya katılabilirsiniz.
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        padding: "18px 20px",
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
                        }}
                        >
                        <div>
                          <p className="small" style={{ color: "rgba(226,232,240,0.64)" }}>Mikrofon erişimi</p>
                          <strong>{micPermissionLabel}</strong>
                        </div>
                        <div>
                          <p className="small" style={{ color: "rgba(226,232,240,0.64)" }}>Transcript</p>
                          <strong>Canlı olarak sağ panelde görünür</strong>
                        </div>
                      </div>

                      <div className="row-actions" style={{ marginTop: 18 }}>
                        <button
                          type="button"
                          className="button-link"
                          disabled={joining || working}
                          onClick={() => void joinAndStart()}
                        >
                          {joining || working
                            ? "Oda hazırlanıyor..."
                            : view.status === "RUNNING"
                              ? "Mikrofonu Aç ve Görüşmeye Devam Et"
                              : "Mikrofonu Aç ve Görüşmeyi Başlat"}
                        </button>
                      </div>

                      {statusNote ? (
                        <p className="small" style={{ color: "rgba(226,232,240,0.76)", marginBottom: 0 }}>
                          {statusNote}
                        </p>
                      ) : null}
                      {speechError ? <ErrorState title={translateUiText("Ses/yanıt hatası", locale)} error={speechError} /> : null}
                    </div>
                  </div>
                ) : null}

                {showRunningPanel ? (
                  <div style={{ padding: 24 }}>
                    <div
                      style={{
                        display: "grid",
                        gap: 18,
                        gridTemplateColumns: "minmax(0, 1.55fr) minmax(300px, 0.85fr)"
                      }}
                    >
                      <div style={{ display: "grid", gap: 18 }}>
                        <div
                          style={{
                            display: "grid",
                            gap: 18,
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
                          }}
                        >
                          <div
                            style={{
                              ...videoTileStyle,
                              minHeight: 380,
                              background:
                                "radial-gradient(circle at top, rgba(124,115,250,0.28), rgba(13,18,31,0.96) 58%)"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "8px 12px",
                                  borderRadius: 999,
                                  background: "rgba(255,255,255,0.08)",
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: speaking ? "#22c55e" : "#7c73fa",
                                    boxShadow: speaking
                                      ? "0 0 0 6px rgba(34,197,94,0.14)"
                                      : "0 0 0 6px rgba(124,115,250,0.12)"
                                  }}
                                />
                                Candit Asistan
                              </span>
                              <span className="small" style={{ color: "rgba(226,232,240,0.72)" }}>
                                {assistantPresence}
                              </span>
                            </div>

                            <div
                              style={{
                                flex: 1,
                                borderRadius: 20,
                                display: "grid",
                                placeItems: "center",
                                background:
                                  "radial-gradient(circle at top, rgba(124,115,250,0.24), rgba(15,23,42,0.92) 64%)"
                              }}
                            >
                              <div
                                style={{
                                  width: 132,
                                  height: 132,
                                  borderRadius: "50%",
                                  background:
                                    "linear-gradient(135deg, rgba(124,115,250,0.95), rgba(79,70,229,0.72))",
                                  display: "grid",
                                  placeItems: "center",
                                  color: "white",
                                  fontSize: 38,
                                  fontWeight: 800,
                                  boxShadow: speaking
                                    ? "0 0 0 18px rgba(124,115,250,0.12)"
                                    : "0 18px 40px rgba(79,70,229,0.28)"
                                }}
                              >
                                AI
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                {speaking ? "Soru soruluyor" : working ? "Yanıt değerlendiriliyor" : "Görüşme akıyor"}
                              </div>
                              <div className="small" style={{ color: "rgba(226,232,240,0.76)", marginBottom: 0 }}>
                                {liveState.detail}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              ...videoTileStyle,
                              minHeight: 380,
                              background:
                                "radial-gradient(circle at top, rgba(13,148,136,0.24), rgba(10,14,24,0.98) 62%)"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "8px 12px",
                                  borderRadius: 999,
                                  background: "rgba(255,255,255,0.08)",
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: recording || listening ? "#22c55e" : "#f59e0b",
                                    boxShadow:
                                      recording || listening
                                        ? "0 0 0 6px rgba(34,197,94,0.14)"
                                        : "0 0 0 6px rgba(245,158,11,0.12)"
                                  }}
                                />
                                {view.candidate.fullName}
                              </span>
                              <span className="small" style={{ color: "rgba(226,232,240,0.72)" }}>
                                {candidatePresence}
                              </span>
                            </div>

                            <div
                              style={{
                                flex: 1,
                                borderRadius: 20,
                                background:
                                  "linear-gradient(180deg, rgba(20,184,166,0.18), rgba(15,23,42,0.92))",
                                display: "grid",
                                placeItems: "center"
                              }}
                            >
                              <div
                                style={{
                                  width: 132,
                                  height: 132,
                                  borderRadius: "50%",
                                  background:
                                    "linear-gradient(135deg, rgba(16,185,129,0.94), rgba(13,148,136,0.76))",
                                  display: "grid",
                                  placeItems: "center",
                                  color: "white",
                                  fontSize: 36,
                                  fontWeight: 800,
                                  boxShadow:
                                    recording || listening
                                      ? "0 0 0 18px rgba(16,185,129,0.12)"
                                      : "0 18px 40px rgba(13,148,136,0.22)"
                                }}
                              >
                                {candidateInitials}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                {recording || listening ? "Konuşuyorsunuz" : "Hazır"}
                              </div>
                              <div className="small" style={{ color: "rgba(226,232,240,0.76)", marginBottom: 0 }}>
                                {recording || listening
                                  ? "Yanıtınız kısa bir sessizlikten sonra otomatik gönderilir."
                                  : "Mikrofonunuzla doğal akışta devam edebilirsiniz."}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 12,
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 18px",
                            borderRadius: 20,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)"
                          }}
                        >
                          <div style={{ minWidth: 220 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{liveState.title}</div>
                            <div className="small" style={{ color: "rgba(226,232,240,0.72)", marginBottom: 0 }}>
                              {statusNote || liveState.detail}
                            </div>
                          </div>
                          <div className="row-actions">
                            {recording ? (
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={working}
                                onClick={() => void enableVoiceResponse()}
                              >
                                Yanıtı Şimdi Gönder
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="danger-button"
                              disabled={working || view.status !== "RUNNING"}
                              onClick={() => void abandonSession()}
                            >
                              Görüşmeden Ayrıl
                            </button>
                          </div>
                        </div>
                      </div>

                      <aside
                        style={{
                          display: "grid",
                          gap: 14,
                          alignContent: "start"
                        }}
                      >
                        <section
                          style={{
                            padding: "18px 18px 16px",
                            borderRadius: 20,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 12
                            }}
                          >
                            <div>
                              <h3 style={{ margin: 0, fontSize: 18 }}>Canlı Transcript</h3>
                              <p className="small" style={{ margin: "4px 0 0", color: "rgba(226,232,240,0.66)" }}>
                                Konuşma akışı burada görünür.
                              </p>
                            </div>
                            <span
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                background: "rgba(59,130,246,0.16)",
                                color: "#bfdbfe"
                              }}
                            >
                              {transcriptPreview.length} segment
                            </span>
                          </div>

                          {showPromptText && activePromptText ? (
                            <div
                              style={{
                                marginBottom: 12,
                                padding: "12px 14px",
                                borderRadius: 14,
                                background: "rgba(59,130,246,0.08)",
                                border: "1px solid rgba(59,130,246,0.16)"
                              }}
                            >
                              <p className="small" style={{ marginTop: 0, color: "#bfdbfe" }}>Şu anki soru</p>
                              <p style={{ marginBottom: 0 }}>{activePromptText}</p>
                            </div>
                          ) : null}

                          <div style={{ display: "grid", gap: 10, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
                            {transcriptPreview.length === 0 ? (
                              <div
                                style={{
                                  padding: "16px 14px",
                                  borderRadius: 16,
                                  background: "rgba(255,255,255,0.03)",
                                  color: "rgba(226,232,240,0.72)"
                                }}
                              >
                                Transcript görüşme ilerledikçe burada akacaktır.
                              </div>
                            ) : (
                              transcriptPreview.map((segment) => (
                                <article
                                  key={segment.id}
                                  style={{
                                    padding: "12px 14px",
                                    borderRadius: 16,
                                    background:
                                      segment.speaker === "AI"
                                        ? "rgba(124,115,250,0.1)"
                                        : "rgba(15,118,110,0.12)",
                                    border:
                                      segment.speaker === "AI"
                                        ? "1px solid rgba(124,115,250,0.16)"
                                        : "1px solid rgba(15,118,110,0.18)"
                                  }}
                                >
                                  <p
                                    className="small"
                                    style={{
                                      marginTop: 0,
                                      marginBottom: 8,
                                      color:
                                        segment.speaker === "AI" ? "#c4b5fd" : "#99f6e4",
                                      fontWeight: 700
                                    }}
                                  >
                                    {segment.speaker === "AI" ? "Candit Asistan" : "Aday"}
                                  </p>
                                  <p style={{ margin: 0, lineHeight: 1.55 }}>{segment.text}</p>
                                </article>
                              ))
                            )}
                          </div>
                        </section>

                        <section
                          style={{
                            padding: "16px 18px",
                            borderRadius: 20,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 10
                            }}
                          >
                            <div>
                              <h4 style={{ margin: 0 }}>Oda Durumu</h4>
                              <p className="small" style={{ margin: "4px 0 0", color: "rgba(226,232,240,0.66)" }}>
                                Canlı görüşme için temel erişim durumu.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="ghost-button"
                              style={{ padding: "8px 12px" }}
                              onClick={() => setSupportToolsVisible((currentValue) => !currentValue)}
                            >
                              {showTechnicalControls ? "Yardımı Gizle" : "Teknik Yardım"}
                            </button>
                          </div>

                          <div style={{ display: "grid", gap: 8 }}>
                            <div className="small" style={{ color: "rgba(226,232,240,0.76)" }}>
                              Mikrofon: <strong style={{ color: "#fff" }}>{micPermissionLabel}</strong>
                            </div>
                          </div>

                          {showTechnicalControls ? (
                            <div
                              style={{
                                marginTop: 14,
                                paddingTop: 14,
                                borderTop: "1px solid rgba(255,255,255,0.08)"
                              }}
                            >
                              <div className="row-actions" style={{ marginBottom: 12 }}>
                                {!recording ? (
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    disabled={working || speaking || listening || !view.activePrompt}
                                    onClick={() => void enableVoiceResponse()}
                                  >
                                    Mikrofonu Yeniden Dene
                                  </button>
                                ) : null}
                                {canOfferManualFallback && !manualFallbackVisible ? (
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    disabled={working}
                                    onClick={() => setManualFallbackVisible(true)}
                                  >
                                    Yazılı Devam Et
                                  </button>
                                ) : null}
                              </div>

                              {manualFallbackVisible ? (
                                <div style={{ marginTop: 12 }}>
                                  <label className="field">
                                      <span className="field-label">{translateUiText("Yanıtınız", locale)}</span>
                                    <textarea
                                      className="input"
                                      rows={4}
                                      value={manualAnswer}
                                      onChange={(event) => setManualAnswer(event.target.value)}
                                      placeholder={translateUiText("Sadece teknik sorun yaşarsanız yanıtınızı buraya yazarak görüşmeyi tamamlayabilirsiniz.", locale)}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="button-link"
                                    disabled={working || manualAnswer.trim().length === 0}
                                    onClick={() => void submitAnswer(manualAnswer, "manual_text")}
                                  >
                                    {translateUiText("Yanıtı Gönder", locale)}
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    disabled={working}
                                    onClick={() => setManualFallbackVisible(false)}
                                    style={{ marginLeft: 8 }}
                                  >
                                    {translateUiText("Vazgeç", locale)}
                                  </button>
                                </div>
                              ) : null}

                              {speechError ? <ErrorState title={translateUiText("Ses/yanıt hatası", locale)} error={speechError} /> : null}
                            </div>
                          ) : null}
                        </section>
                      </aside>
                    </div>
                  </div>
                ) : null}

                {isExpired ? (
                  <div style={{ padding: 24 }}>
                    <section
                      style={{
                        padding: "18px 20px",
                        borderRadius: 20,
                        border: "1px solid rgba(248,113,113,0.24)",
                        background: "rgba(127,29,29,0.28)"
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Görüşme Davetinin Süresi Doldu</h3>
                      <p className="small" style={{ marginBottom: 0, color: "rgba(254,226,226,0.88)" }}>
                        Bu link {deadlineText} sonrasında kullanılamaz. Yeni bir görüşme daveti gerekirse recruiter ekibiyle iletişime geçilmelidir.
                      </p>
                    </section>
                  </div>
                ) : null}

                {isFailed ? (
                  <div style={{ padding: 24 }}>
                    <section
                      style={{
                        padding: "18px 20px",
                        borderRadius: 20,
                        border: "1px solid rgba(248,113,113,0.24)",
                        background: "rgba(127,29,29,0.28)"
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Görüşme Sonlandı</h3>
                      <p className="small" style={{ marginBottom: 0, color: "rgba(254,226,226,0.88)" }}>
                        Oturum tamamlanmadan sonlandı. Gerekirse yeni bir görüşme bağlantısı için recruiter ekibiyle iletişime geçebilirsiniz.
                      </p>
                    </section>
                  </div>
                ) : null}

                {isCompleted ? (
                  <div style={{ padding: 24 }}>
                    <section
                      style={{
                        padding: "20px 22px",
                        borderRadius: 20,
                        border: "1px solid rgba(74,222,128,0.24)",
                        background: "rgba(20,83,45,0.32)"
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Görüşme Tamamlandı</h3>
                      <p className="small" style={{ color: "rgba(220,252,231,0.86)" }}>
                        Teşekkür ederiz. Görüşme çıktılarınız recruiter tarafından incelenecek ve bu bağlantı tekrar kullanılamayacaktır.
                      </p>
                      {transcriptPreview.length > 0 ? (
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                          {transcriptPreview.slice(-4).map((segment) => (
                            <div
                              key={segment.id}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.06)"
                              }}
                            >
                              <p className="small" style={{ marginTop: 0, color: "rgba(220,252,231,0.68)" }}>
                                {segment.speaker === "AI" ? "Candit Asistan" : "Aday"}
                              </p>
                              <p style={{ marginBottom: 0 }}>{segment.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  </div>
                ) : null}
              </section>
            ) : null}

            {internalModeEnabled ? (
              <section className="panel" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Internal Fallback Kontrolleri</h3>
                <div className="row-actions">
                  <button
                    type="button"
                    className="button-link"
                    disabled={working || view.status === "COMPLETED" || view.status === "FAILED"}
                    onClick={() => void startSession()}
                  >
                    Görüşmeyi Başlat / Devam Et
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={working || !speechRecognitionSupported || view.status !== "RUNNING"}
                    onClick={() => void startListening()}
                  >
                    {listening ? "Dinleniyor..." : "Sesli Yanıtla"}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={working || view.status !== "RUNNING"}
                    onClick={() => void abandonSession()}
                  >
                    Oturumu Sonlandır
                  </button>
                </div>

                <div className="candidate-log" style={{ marginTop: 10 }}>
                  {view.conversation.length === 0 ? (
                    <p className="small">Henüz soru-cevap kaydı oluşmadı.</p>
                  ) : (
                    view.conversation.map((turn) => (
                      <article key={turn.id} className="candidate-turn">
                        <p className="small" style={{ marginTop: 0 }}>
                          #{turn.sequenceNo} · {turn.category} · {turn.kind}
                        </p>
                        <p style={{ marginTop: 0 }}>
                          <strong>AI:</strong> {turn.promptText}
                        </p>
                        <p style={{ marginBottom: 0 }}>
                          <strong>{translateUiText("Aday", locale)}:</strong> {turn.answerText ?? translateUiText("Yanıt bekleniyor...", locale)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
