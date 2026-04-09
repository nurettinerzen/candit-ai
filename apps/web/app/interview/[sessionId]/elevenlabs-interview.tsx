"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@11labs/client";
import type { Mode, Status } from "@11labs/client";
import { apiClient } from "../../../lib/api-client";
import { getActiveSiteLocale, translateUiText } from "../../../lib/i18n";
import type { PublicInterviewSessionView } from "../../../lib/types";

type ElevenLabsInterviewProps = {
  sessionId: string;
  token: string;
  initialView: PublicInterviewSessionView;
  onViewUpdate: (view: PublicInterviewSessionView) => void;
  autoStart?: boolean;
};

type ConversationMessage = {
  source: "ai" | "user";
  message: string;
  timestamp: number;
};

function sanitizeTranscriptMessage(input: string) {
  return input
    .replace(/\[SESSION_COMPLETE\]/g, "")
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeConversationMessage(source: ConversationMessage["source"], input: string) {
  const cleaned = sanitizeTranscriptMessage(input);
  if (source !== "ai") {
    return cleaned;
  }

  return cleaned
    .replace(/^(anlıyorum|anliyorum|anladım|anladim|evet|tabii|tamam|peki|elbette)[,!.:\-\s]+/iu, "")
    .trim();
}

function buildTranscriptSegments(
  messages: ConversationMessage[],
  pendingAiMessage: string
): Array<{
  speaker: "AI" | "CANDIDATE" | "RECRUITER";
  text: string;
}> {
  const segments = [...messages];
  const trailingAi = sanitizeConversationMessage("ai", pendingAiMessage);

  if (trailingAi) {
    const last = segments[segments.length - 1];
    if (!(last?.source === "ai" && last.message === trailingAi)) {
      segments.push({
        source: "ai",
        message: trailingAi,
        timestamp: Date.now()
      });
    }
  }

  return segments
    .map((message) => ({
      speaker: (message.source === "ai" ? "AI" : "CANDIDATE") as "AI" | "CANDIDATE",
      text: sanitizeConversationMessage(message.source, message.message)
    }))
    .filter((segment) => segment.text.length > 0);
}

/**
 * ElevenLabs Conversational AI interview component.
 * Replaces browser Web Speech API with ElevenLabs WebRTC for real-time
 * AI voice interview experience with natural Turkish speech.
 */
export function ElevenLabsInterview({
  sessionId,
  token,
  initialView,
  onViewUpdate,
  autoStart = false
}: ElevenLabsInterviewProps) {
  const locale = getActiveSiteLocale();
  const conversationRef = useRef<Conversation | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiRevealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAiMessageRef = useRef("");
  const startingRef = useRef(false);
  const disposedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const startAttemptRef = useRef(0);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const completionRequestedRef = useRef(false);

  const [status, setStatus] = useState<Status>("disconnected");
  const [mode, setMode] = useState<Mode>("listening");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentAiMessage, setCurrentAiMessage] = useState("");
  const [visibleAiMessage, setVisibleAiMessage] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    currentAiMessageRef.current = currentAiMessage;
  }, [currentAiMessage]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (
      initialView.status === "COMPLETED" ||
      initialView.status === "FAILED" ||
      initialView.status === "CANCELLED" ||
      initialView.status === "NO_SHOW" ||
      initialView.invitation?.state === "COMPLETED" ||
      initialView.invitation?.state === "EXPIRED"
    ) {
      setSessionComplete(true);
    }
  }, [initialView.invitation?.state, initialView.status]);

  const finalizeConversation = useCallback(async () => {
    if (completionRequestedRef.current) {
      return;
    }

    completionRequestedRef.current = true;

    try {
      const updated = await apiClient.completePublicInterviewSession(sessionId, {
        token,
        transcriptSegments: buildTranscriptSegments(messagesRef.current, currentAiMessageRef.current),
        locale: initialView.runtime.locale || "tr-TR",
        sttModel: "elevenlabs_conversational_ai",
        completionReasonCode: "candidate_completed"
      });

      onViewUpdate(updated);
      setSessionComplete(
        updated.status === "COMPLETED" || updated.invitation?.state === "COMPLETED"
      );
    } catch (finalizeError) {
      completionRequestedRef.current = false;
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Görüşme tamamlandı ancak sonuç kaydedilemedi."
      );
    }
  }, [initialView.runtime.locale, onViewUpdate, sessionId, token]);

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
          updated.status === "CANCELLED" ||
          updated.status === "NO_SHOW"
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
    disposedRef.current = false;

    return () => {
      disposedRef.current = true;
      startingRef.current = false;
      if (conversationRef.current) {
        void conversationRef.current.endSession();
        conversationRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (aiRevealTimerRef.current) {
        clearInterval(aiRevealTimerRef.current);
        aiRevealTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (aiRevealTimerRef.current) {
      clearInterval(aiRevealTimerRef.current);
      aiRevealTimerRef.current = null;
    }

    const target = currentAiMessage.trim();
    if (!target) {
      setVisibleAiMessage("");
      return;
    }

    const tokens = target.split(/(\s+)/);
    let index = 0;
    setVisibleAiMessage("");

    aiRevealTimerRef.current = setInterval(() => {
      index += 1;
      const nextValue = tokens.slice(0, index).join("").trimStart();
      setVisibleAiMessage(nextValue);

      if (index >= tokens.length) {
        if (aiRevealTimerRef.current) {
          clearInterval(aiRevealTimerRef.current);
          aiRevealTimerRef.current = null;
        }
      }
    }, 65);

    return () => {
      if (aiRevealTimerRef.current) {
        clearInterval(aiRevealTimerRef.current);
        aiRevealTimerRef.current = null;
      }
    };
  }, [currentAiMessage]);

  const startConversation = useCallback(async () => {
    if (startingRef.current || conversationRef.current || connecting || status === "connected") {
      return;
    }

    startingRef.current = true;
    setConnecting(true);
    setError("");
    const attemptId = startAttemptRef.current + 1;
    startAttemptRef.current = attemptId;

    try {
      // 1. Get signed URL from our backend
      const { signedUrl, dynamicVariables, contextualUpdate } = await apiClient.initElevenLabsConversation(
        sessionId,
        token
      );

      if (disposedRef.current || startAttemptRef.current !== attemptId) {
        startingRef.current = false;
        setConnecting(false);
        return;
      }

      // 2. Start ElevenLabs conversation via WebSocket with signed URL
      const conversation = await Conversation.startSession({
        signedUrl,
        dynamicVariables,
        onConnect: ({ conversationId: convId }) => {
          startingRef.current = false;
          setConversationId(convId);
          setStatus("connected");
          setConnecting(false);
        },
        onDisconnect: (details) => {
          conversationRef.current = null;
          startingRef.current = false;
          setStatus("disconnected");

          if (details.reason === "error") {
            setError(`Baglanti kesildi: ${details.message}`);
          } else if (details.reason === "agent") {
            setSessionComplete(true);
            void finalizeConversation();
          }
        },
        onError: (message) => {
          setError(message);
        },
        onDebug: (debugInfo) => {
          if (
            debugInfo &&
            typeof debugInfo === "object" &&
            "type" in debugInfo &&
            debugInfo.type === "tentative_agent_response" &&
            "response" in debugInfo &&
            typeof debugInfo.response === "string"
          ) {
            setCurrentAiMessage(sanitizeTranscriptMessage(debugInfo.response));
          }
        },
        onModeChange: ({ mode: newMode }) => {
          setMode(newMode);
          if (newMode === "listening" && currentAiMessageRef.current.trim()) {
            setMessages((prev) => {
              const sanitized = sanitizeConversationMessage("ai", currentAiMessageRef.current);
              const last = prev[prev.length - 1];
              if (last?.source === "ai" && last.message === sanitized) {
                return prev;
              }

              return [
                ...prev,
                {
                  source: "ai",
                  message: sanitized,
                  timestamp: Date.now()
                }
              ];
            });
            setCurrentAiMessage("");
          }
        },
        onMessage: ({ message, source }) => {
          const sanitized = sanitizeConversationMessage(source, message);
          if (!sanitized) {
            return;
          }

          if (source === "ai") {
            setCurrentAiMessage(sanitized);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                source,
                message: sanitized,
                timestamp: Date.now()
              }
            ]);
          }

          // Check for session complete marker
          if (source === "ai" && message.includes("[SESSION_COMPLETE]")) {
            setSessionComplete(true);
            void finalizeConversation();
          }
        },
        onStatusChange: ({ status: newStatus }) => {
          setStatus(newStatus);
        }
      });

      if (disposedRef.current || startAttemptRef.current !== attemptId) {
        await conversation.endSession();
        startingRef.current = false;
        setConnecting(false);
        return;
      }

      if (contextualUpdate.trim().length > 0) {
        conversation.sendContextualUpdate(contextualUpdate);
      }

      conversationRef.current = conversation;
    } catch (startError) {
      startingRef.current = false;
      setError(
        startError instanceof Error
          ? startError.message
          : "ElevenLabs bağlantısı kurulamadı."
      );
      setConnecting(false);
    }
  }, [connecting, finalizeConversation, sessionId, status, token]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || connecting || status === "connected" || sessionComplete) {
      return;
    }

    autoStartedRef.current = true;
    void startConversation();
  }, [autoStart, connecting, sessionComplete, startConversation, status]);

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

  const cardStyle: React.CSSProperties = {
    marginTop: 16,
    padding: "24px 28px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(12px)"
  };

  return (
    <>
      {/* Connection / Live State */}
      <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: modeColor,
              boxShadow: `0 0 0 4px ${modeColor}20`,
              animation:
                status === "connected" && !sessionComplete
                  ? "pulse 2s infinite"
                  : "none"
            }}
          />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{modeLabel}</h3>
        </div>

        {status !== "connected" && !sessionComplete ? (
          <div>
            <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
              Sesli görüşmeyi başlatmak için aşağıdaki butona basın. Mikrofon izni gerekecektir.
            </p>
            <button
              type="button"
              disabled={connecting}
              onClick={() => void startConversation()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "14px 32px", fontSize: 15, fontWeight: 600,
                background: "linear-gradient(135deg, #5046e5, #7c3aed)",
                color: "#fff", border: "none", borderRadius: 12, cursor: connecting ? "wait" : "pointer",
                boxShadow: "0 6px 24px rgba(80,70,229,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                fontFamily: "inherit", opacity: connecting ? 0.7 : 1,
                transition: "transform 0.15s, box-shadow 0.15s"
              }}
            >
              {connecting ? "Bağlanılıyor..." : "Sesli Görüşmeyi Başlat"}
            </button>
          </div>
        ) : null}

        {status === "connected" && !sessionComplete ? (
          <div>
            <p style={{ marginTop: 0, marginBottom: 14, fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.5 }}>
              {mode === "speaking"
                ? "AI soruyu sesli olarak soruyor. Lütfen dinleyin..."
                : "Soruyu cevaplamak için konuşun. AI sizi dinliyor."}
            </p>

            {/* Audio Visualizer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 56,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.05)",
                marginBottom: 8
              }}
            >
              <div style={{ display: "flex", gap: 4, alignItems: "center", height: 36 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={`bar-${i}`}
                    style={{
                      width: 4,
                      height: mode === "speaking" ? `${10 + (i % 4) * 6}px` : "4px",
                      backgroundColor: modeColor,
                      borderRadius: 2,
                      transition: "height 0.3s ease",
                      animation:
                        status === "connected" && !sessionComplete
                          ? `audioBar 0.8s ease-in-out ${i * 0.08}s infinite alternate`
                          : "none"
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {sessionComplete ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(148,163,184,0.8)" }}>
              Görüşme tamamlandı. Teşekkür ederiz.
            </p>
          </div>
        ) : null}

        {error ? (
          <p style={{ color: "#f87171", marginTop: 12, fontSize: 13, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>{error}</p>
        ) : null}
      </section>

      {/* Progress removed — parent page already shows progress */}

      {/* Conversation Transcript */}
      {messages.length > 0 || visibleAiMessage ? (
        <section style={{ ...cardStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Görüşme Akışı</h3>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(80,70,229,0.12)", color: "#a78bfa", fontWeight: 600 }}>
              {messages.length} mesaj
            </span>
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto", display: "grid", gap: 8, paddingRight: 4 }}>
            {messages.map((msg, idx) => (
              <div
                key={`msg-${idx}-${msg.timestamp}`}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  background: msg.source === "ai" ? "rgba(80,70,229,0.08)" : "rgba(13,148,136,0.08)",
                  border: msg.source === "ai" ? "1px solid rgba(80,70,229,0.12)" : "1px solid rgba(13,148,136,0.12)"
                }}
              >
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: msg.source === "ai" ? "#a78bfa" : "#5eead4", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {msg.source === "ai" ? "Candit Asistan" : "Siz"}
                </p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "rgba(226,232,240,0.9)" }}>
                  {msg.message.replace("[SESSION_COMPLETE]", "").trim()}
                </p>
              </div>
            ))}
            {visibleAiMessage ? (
              <div style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(80,70,229,0.06)", border: "1px solid rgba(80,70,229,0.08)", opacity: 0.75 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>{translateUiText("Candit Asistan", locale)}</p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "rgba(226,232,240,0.9)" }}>{visibleAiMessage}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Connection info removed — technical detail not needed for candidates */}

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
