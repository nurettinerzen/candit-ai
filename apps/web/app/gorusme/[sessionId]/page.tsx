"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSiteLanguage } from "../../../components/site-language-provider";
import { ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { getLocaleTag } from "../../../lib/i18n";
import type { PublicInterviewSessionView } from "../../../lib/types";
import { ElevenLabsInterview } from "./elevenlabs-interview";

const ELEVENLABS_ENABLED = process.env.NEXT_PUBLIC_ELEVENLABS_ENABLED === "true";

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

export default function CandidateInterviewPage() {
  const { locale } = useSiteLanguage();
  const localeTag = getLocaleTag(locale);
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId;
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const internalModeEnabled = useMemo(
    () => searchParams.get("debug") === "1",
    [searchParams]
  );

  const speechRecognitionSupported = useSpeechRecognitionSupport();
  const speechSynthesisSupported = useSpeechSynthesisSupport();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningStartedAtRef = useRef<number | null>(null);
  const autoListenRef = useRef<() => void>(() => undefined);
  const activeTurnSpokenRef = useRef<string | null>(null);
  const completionAnnouncedRef = useRef(false);
  const noSpeechRetryRef = useRef(0);

  const [view, setView] = useState<PublicInterviewSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [working, setWorking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermissionState>("unknown");
  const [speechError, setSpeechError] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [statusNote, setStatusNote] = useState("");

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
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!speechRecognitionSupported && micPermission === "unknown") {
      setMicPermission("unsupported");
    }
  }, [micPermission, speechRecognitionSupported]);

  const requestMicrophonePermission = useCallback(async () => {
    if (!speechRecognitionSupported) {
      setMicPermission("unsupported");
      return false;
    }

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
  }, [speechRecognitionSupported]);

  const speakPrompt = useCallback(
    (promptText: string, options?: SpeakPromptOptions) => {
      const text = promptText.trim();
      const shouldAutoListen = options?.autoListen !== false;

      if (!text || typeof window === "undefined") {
        return;
      }

      if (!speechSynthesisSupported) {
        setSpeaking(false);
        if (shouldAutoListen && speechRecognitionSupported && micPermission === "granted") {
          setStatusNote("AI sorusu gösterildi. Yanıtınız için dinlemeye geçiliyor...");
          autoListenRef.current();
        }
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = localeTag;
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => {
        setSpeaking(true);
        setStatusNote("AI soruyu sesli iletiyor...");
      };
      utterance.onend = () => {
        setSpeaking(false);
        if (shouldAutoListen && speechRecognitionSupported && micPermission === "granted") {
          setStatusNote("Sizi dinliyorum...");
          autoListenRef.current();
        }
      };
      utterance.onerror = () => {
        setSpeaking(false);

        if (shouldAutoListen && speechRecognitionSupported && micPermission === "granted") {
          autoListenRef.current();
          return;
        }

        setSpeechError("Soru sesi oynatılamadı. Yazılı yanıt verebilirsiniz.");
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
    [locale, localeTag, micPermission, speechRecognitionSupported, speechSynthesisSupported]
  );

  const startSession = useCallback(async (overrides?: SessionCapabilityOverrides) => {
    if (!token) {
      return false;
    }

    setWorking(true);
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
        setStatusNote(
          updated.status === "RUNNING"
            ? "Yanıt kaydedildi. AI sıradaki adımı belirliyor..."
            : "Görüşme tamamlandı."
        );
      } catch (submitError) {
        setSpeechError(submitError instanceof Error ? submitError.message : "Cevap gönderilemedi.");
      } finally {
        setWorking(false);
      }
    },
    [localeTag, sessionId, token]
  );

  const startListening = useCallback(async () => {
    if (
      working ||
      speaking ||
      listening ||
      !view ||
      view.status !== "RUNNING" ||
      !view.activePrompt
    ) {
      return;
    }

    if (
      !speechRecognitionSupported ||
      micPermission !== "granted" ||
      typeof window === "undefined"
    ) {
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
      setListening(false);
      void submitAnswer(transcript, "voice_browser", confidence, duration);
    };

    recognition.onerror = (event) => {
      errorCode = event.error;
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
      setListening(false);

      if (!transcriptCaptured && !errorCode) {
        setSpeechError("Yanıt algılanamadı. Yeniden konuşabilir veya yazılı yanıt verebilirsiniz.");
      }
    };

    recognitionRef.current = recognition;
    listeningStartedAtRef.current = Date.now();
    setListening(true);
    setStatusNote("Sizi dinliyorum...");

    try {
      recognition.start();
    } catch {
      setListening(false);
      setSpeechError("Mikrofon başlatılamadı. Yazılı yanıt verebilirsiniz.");
    }
  }, [
    listening,
    micPermission,
    speaking,
    speechRecognitionSupported,
    submitAnswer,
    localeTag,
    view,
    working
  ]);

  useEffect(() => {
    autoListenRef.current = () => {
      void startListening();
    };
  }, [startListening]);

  useEffect(() => {
    if (!joined || !view || view.status !== "RUNNING" || !view.activePrompt) {
      return;
    }

    if (activeTurnSpokenRef.current === view.activePrompt.turnId) {
      return;
    }

    activeTurnSpokenRef.current = view.activePrompt.turnId;
    setSpeechError("");
    speakPrompt(view.activePrompt.text);
  }, [joined, speakPrompt, view]);

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
      speakPrompt(closingText, { autoListen: false });
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
        speakPrompt(updated.activePrompt.text);
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

  const sessionInFinalState =
    view?.status === "COMPLETED" || view?.status === "FAILED" || view?.status === "CANCELLED";
  const needsJoinScreen = Boolean(view && !joined && !sessionInFinalState);
  const progressPercent = view ? Math.round(view.progress.ratio * 100) : 0;

  const micPermissionLabel = (() => {
    switch (micPermission) {
      case "requesting":
        return "Mikrofon izni isteniyor...";
      case "granted":
        return "Mikrofon hazır";
      case "denied":
        return "Mikrofon izni verilmedi";
      case "unsupported":
        return "Tarayıcı sesli tanımayı desteklemiyor";
      default:
        return "Mikrofon kontrol edilmedi";
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

    if (view.status === "FAILED" || view.status === "CANCELLED") {
      return {
        title: "Sonlandı",
        detail: "Oturum aktif değil."
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
        detail:
          micPermission === "granted" && speechRecognitionSupported
            ? "Konuşmanız otomatik kaydedilecek."
            : "Mikrofon kullanılamıyorsa yazılı yanıt verebilirsiniz."
      };
    }

    return {
      title: "Hazır",
      detail: "AI sıradaki soruyu hazırlıyor."
    };
  })();

  const showManualFallback =
    joined &&
    view?.status === "RUNNING" &&
    (micPermission !== "granted" || !speechRecognitionSupported || speechError.length > 0);

  return (
    <main>
      <section className="candidate-shell">
        <header className="candidate-header">
          <p className="eyebrow">AI Interviewer</p>
          <h1 style={{ margin: "8px 0 6px" }}>Ön Görüşme</h1>
          <p className="small" style={{ marginTop: 0 }}>
            Sorular Türkçe olarak tek tek sorulur. Yaklaşık 15-20 dakika sürecektir. Nihai kararı her zaman insan verir.
          </p>
        </header>

        {loading ? <LoadingState message="Görüşme oturumu hazırlanıyor..." /> : null}
        {!loading && error ? <ErrorState title="Oturum hatası" error={error} /> : null}

        {!loading && !error && view ? (
          <>
            <section className="panel">
              <div className="details-grid">
                <div>
                  <p className="small">Aday</p>
                  <strong>{view.candidate.fullName}</strong>
                </div>
                <div>
                  <p className="small">Pozisyon</p>
                  <strong>{view.job.title}</strong>
                </div>
                <div>
                  <p className="small">Durum</p>
                  <strong>{liveState.title}</strong>
                </div>
                <div>
                  <p className="small">Mikrofon</p>
                  <strong>{micPermissionLabel}</strong>
                </div>
              </div>

              <div className="progress-wrap" style={{ marginTop: 14 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="small" style={{ marginBottom: 0 }}>
                  İlerleme: {view.progress.answeredBlocks}/{view.progress.totalBlocks}
                </p>
              </div>
            </section>

            {ELEVENLABS_ENABLED && !sessionInFinalState ? (
              <ElevenLabsInterview
                sessionId={sessionId}
                token={token}
                initialView={view}
                onViewUpdate={setView}
              />
            ) : null}

            {!ELEVENLABS_ENABLED && needsJoinScreen ? (
              <section className="panel">
                <h3 style={{ marginTop: 0 }}>Görüşmeye Katıl</h3>
                <p className="small" style={{ marginTop: 0 }}>
                  Katıldıktan sonra AI otomatik karşılama yapar, soruları sırayla sesli sorar ve görüşmeyi
                  kendi akışıyla tamamlar.
                </p>
                <p className="small">Tarayıcı izin adımı dışında tur kontrolü sizden istenmez.</p>
                <div style={{ marginTop: 12, padding: "12px 16px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", marginBottom: 12 }}>
                  <p className="small" style={{ margin: 0, fontWeight: 600, color: "#1e40af" }}>Ne Beklenmeli?</p>
                  <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 20, color: "#1e40af" }}>
                    <li>AI size sırayla sorular soracaktır.</li>
                    <li>Her soruyu sesli veya yazılı olarak cevaplayabilirsiniz.</li>
                    <li>Görüşme yaklaşık 15-20 dakika sürecektir.</li>
                    <li>Nihai kararı her zaman insan verir.</li>
                  </ul>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="button-link"
                    disabled={joining || working}
                    onClick={() => void joinAndStart()}
                  >
                    {joining || working ? "Hazırlanıyor..." : "Mikrofonu Aç ve Görüşmeye Katıl"}
                  </button>
                </div>
                {statusNote ? <p className="small">{statusNote}</p> : null}
                {speechError ? <ErrorState title="Ses/yanıt hatası" error={speechError} /> : null}
              </section>
            ) : null}

            {!ELEVENLABS_ENABLED && joined && view.status === "RUNNING" ? (
              <section className="panel" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Canlı Görüşme</h3>
                <p className="small" style={{ marginTop: 0 }}>
                  {liveState.detail}
                </p>
                {view.activePrompt ? (
                  <article className="candidate-turn">
                    <p className="small" style={{ marginTop: 0 }}>
                      Soru #{view.activePrompt.sequenceNo} · {view.activePrompt.category}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>AI:</strong> {view.activePrompt.text}
                    </p>
                  </article>
                ) : (
                  <p className="small">AI bir sonraki soruyu hazırlıyor...</p>
                )}

                {showManualFallback ? (
                  <div style={{ marginTop: 12 }}>
                    <label className="field">
                      <span className="field-label">Yazılı Yanıt</span>
                      <textarea
                        className="input"
                        rows={4}
                        value={manualAnswer}
                        onChange={(event) => setManualAnswer(event.target.value)}
                        placeholder="Yanıtınızı buraya yazabilirsiniz."
                      />
                    </label>
                    <button
                      type="button"
                      className="button-link"
                      disabled={working || manualAnswer.trim().length === 0}
                      onClick={() => void submitAnswer(manualAnswer, "manual_text")}
                    >
                      Yanıtı Gönder
                    </button>
                  </div>
                ) : null}

                {statusNote ? <p className="small">{statusNote}</p> : null}
                {speechError ? <ErrorState title="Ses/yanıt hatası" error={speechError} /> : null}
              </section>
            ) : null}

            {view.status === "FAILED" || view.status === "CANCELLED" ? (
              <section className="panel" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Görüşme Sonlandı</h3>
                <p className="small" style={{ marginBottom: 0 }}>
                  Oturum aktif değil. Gerekirse yeni bir görüşme bağlantısı için recruiter ekibiyle
                  iletişime geçebilirsiniz.
                </p>
              </section>
            ) : null}

            {view.status === "COMPLETED" ? (
              <section className="panel" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Görüşme Tamamlandı</h3>
                <p className="small" style={{ marginBottom: 0 }}>
                  Teşekkür ederiz. Görüşme çıktılarınız recruiter tarafından incelenecek ve sonraki adım
                  insan onayıyla belirlenecektir.
                </p>
                <div style={{ marginTop: 16, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #86efac" }}>
                  <p className="small" style={{ margin: 0, fontWeight: 600, color: "#166534" }}>Sonraki Adımlar</p>
                  <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 20, color: "#166534" }}>
                    <li>Görüşme kayıtlarınız recruiter ekibi tarafından incelenecektir.</li>
                    <li>Sonuç hakkında en kısa sürede bilgilendirileceksiniz.</li>
                    <li>Sorularınız için recruiter ekibiyle iletişime geçebilirsiniz.</li>
                  </ul>
                </div>
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
                    disabled={
                      working ||
                      !view.activePrompt ||
                      view.status !== "RUNNING" ||
                      (!speechRecognitionSupported && !speechSynthesisSupported)
                    }
                    onClick={() => void repeatQuestion()}
                  >
                    Soruyu Tekrar Et
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
                          <strong>Aday:</strong> {turn.answerText ?? "Yanıt bekleniyor..."}
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
