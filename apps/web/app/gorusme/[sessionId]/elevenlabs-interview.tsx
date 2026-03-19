"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@11labs/client";
import type { Mode, Status } from "@11labs/client";
import { apiClient } from "../../../lib/api-client";
import type { PublicInterviewSessionView } from "../../../lib/types";

type ElevenLabsInterviewProps = {
  sessionId: string;
  token: string;
  initialView: PublicInterviewSessionView;
  onViewUpdate: (view: PublicInterviewSessionView) => void;
};

type ConversationMessage = {
  source: "ai" | "user";
  message: string;
  timestamp: number;
};

/**
 * ElevenLabs Conversational AI interview component.
 * Replaces browser Web Speech API with ElevenLabs WebRTC for real-time
 * AI voice interview experience with natural Turkish speech.
 */
export function ElevenLabsInterview({
  sessionId,
  token,
  initialView,
  onViewUpdate
}: ElevenLabsInterviewProps) {
  const conversationRef = useRef<Conversation | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<Status>("disconnected");
  const [mode, setMode] = useState<Mode>("listening");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Poll session progress periodically
  useEffect(() => {
    if (status !== "connected" || sessionComplete) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const updated = await apiClient.getPublicInterviewSession(sessionId, token);
        onViewUpdate(updated);

        if (
          updated.status === "COMPLETED" ||
          updated.status === "FAILED" ||
          updated.status === "CANCELLED"
        ) {
          setSessionComplete(true);
        }
      } catch {
        // Silent failure for polling
      }
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sessionId, token, status, sessionComplete, onViewUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        void conversationRef.current.endSession();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startConversation = useCallback(async () => {
    if (connecting || status === "connected") return;

    setConnecting(true);
    setError("");

    try {
      // 1. Get signed URL from our backend
      const { signedUrl } = await apiClient.initElevenLabsConversation(sessionId, token);

      // 2. Start ElevenLabs conversation via WebSocket with signed URL
      const conversation = await Conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            language: "tr"
          }
        },
        onConnect: ({ conversationId: convId }) => {
          setConversationId(convId);
          setStatus("connected");
          setConnecting(false);
        },
        onDisconnect: (details) => {
          setStatus("disconnected");

          if (details.reason === "error") {
            setError(`Baglanti kesildi: ${details.message}`);
          } else if (details.reason === "agent") {
            setSessionComplete(true);
          }
        },
        onError: (message) => {
          setError(message);
        },
        onModeChange: ({ mode: newMode }) => {
          setMode(newMode);
        },
        onMessage: ({ message, source }) => {
          setMessages((prev) => [
            ...prev,
            {
              source,
              message,
              timestamp: Date.now()
            }
          ]);

          // Check for session complete marker
          if (source === "ai" && message.includes("[SESSION_COMPLETE]")) {
            setSessionComplete(true);
          }
        },
        onStatusChange: ({ status: newStatus }) => {
          setStatus(newStatus);
        }
      });

      conversationRef.current = conversation;
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "ElevenLabs bağlantısı kurulamadı."
      );
      setConnecting(false);
    }
  }, [connecting, sessionId, status, token]);

  const endConversation = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }

    // Also abandon the interview session
    try {
      const updated = await apiClient.abandonPublicInterviewSession(sessionId, {
        token,
        reasonCode: "candidate_left"
      });
      onViewUpdate(updated);
    } catch {
      // Best effort
    }
  }, [sessionId, token, onViewUpdate]);

  const progressPercent = initialView
    ? Math.round(initialView.progress.ratio * 100)
    : 0;

  const modeLabel = (() => {
    if (sessionComplete) return "Görüşme Tamamlandı";
    if (connecting) return "Bağlanılıyor...";
    if (status !== "connected") return "Bağlantı Bekleniyor";
    if (mode === "speaking") return "AI Konuşuyor";
    if (mode === "listening") return "Sizi Dinliyor";
    return "Hazır";
  })();

  const modeColor = (() => {
    if (sessionComplete) return "#10b981";
    if (mode === "speaking") return "#6366f1";
    if (mode === "listening") return "#ef4444";
    return "#9ca3af";
  })();

  return (
    <>
      {/* Connection / Live State */}
      <section className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: modeColor,
              animation:
                status === "connected" && !sessionComplete
                  ? "pulse 2s infinite"
                  : "none"
            }}
          />
          <h3 style={{ margin: 0 }}>{modeLabel}</h3>
        </div>

        {status !== "connected" && !sessionComplete ? (
          <div>
            <p className="small" style={{ marginTop: 0 }}>
              ElevenLabs AI ile gerçek zamanlı sesli görüşme başlatmak için aşağıdaki butona basın.
              Mikrofon izni gerekecektir.
            </p>
            <button
              type="button"
              className="button-link"
              disabled={connecting}
              onClick={() => void startConversation()}
            >
              {connecting ? "Bağlanılıyor..." : "Sesli Görüşmeyi Başlat"}
            </button>
          </div>
        ) : null}

        {status === "connected" && !sessionComplete ? (
          <div>
            <p className="small" style={{ marginTop: 0 }}>
              {mode === "speaking"
                ? "AI soruyu sesli olarak soruyor. Dinleyin..."
                : "Soruyu cevaplamak için konuşun. AI sizi dinliyor."}
            </p>

            {/* Audio Visualizer Placeholder */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 48,
                background: "var(--surface-1, #f9fafb)",
                borderRadius: 8,
                marginBottom: 12
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  alignItems: "center",
                  height: 32
                }}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={`bar-${i}`}
                    style={{
                      width: 4,
                      height: mode === "speaking" ? `${12 + (i % 3) * 8}px` : "4px",
                      backgroundColor: modeColor,
                      borderRadius: 2,
                      transition: "height 0.3s ease",
                      animation:
                        status === "connected" && !sessionComplete
                          ? `audioBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`
                          : "none"
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="danger-button"
              onClick={() => void endConversation()}
            >
              Görüşmeyi Sonlandır
            </button>
          </div>
        ) : null}

        {sessionComplete ? (
          <p className="small" style={{ marginTop: 0 }}>
            Görüşme tamamlandı. Teşekkür ederiz. Sonuçlarınız recruiter ekibine iletilecektir.
          </p>
        ) : null}

        {error ? (
          <p style={{ color: "var(--danger, #ef4444)", marginTop: 8 }}>{error}</p>
        ) : null}
      </section>

      {/* Progress Bar */}
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="small" style={{ marginBottom: 0 }}>
            İlerleme: {initialView.progress.answeredBlocks}/{initialView.progress.totalBlocks}
          </p>
        </div>
      </section>

      {/* Conversation Transcript */}
      {messages.length > 0 ? (
        <section className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Görüşme Akışı</h3>
          <div
            className="candidate-log"
            style={{ maxHeight: 400, overflowY: "auto" }}
          >
            {messages.map((msg, idx) => (
              <article
                key={`msg-${idx}-${msg.timestamp}`}
                className="candidate-turn"
              >
                <p style={{ margin: 0 }}>
                  <strong>{msg.source === "ai" ? "AI:" : "Aday:"}</strong>{" "}
                  {msg.message.replace("[SESSION_COMPLETE]", "").trim()}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Connection Info */}
      {conversationId ? (
        <section className="panel" style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: 0 }}>
            Motor: ElevenLabs Conversational AI | Baglanti: {conversationId.slice(0, 8)}...
          </p>
        </section>
      ) : null}

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes audioBar {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </>
  );
}
