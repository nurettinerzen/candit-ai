"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { publicSchedulingApi, type PublicSchedulingWorkflow, type PublicSlotBookResult } from "../../../lib/api/public-client";

type ViewState = "loading" | "slot_selection" | "confirming" | "confirmed" | "already_booked" | "error";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function groupSlotsByDate(slots: Array<{ slotId: string; start: string; end: string }>) {
  const groups: Record<string, typeof slots> = {};
  for (const slot of slots) {
    const dateKey = new Date(slot.start).toISOString().split("T")[0]!;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(slot);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

/* ── Step indicator ─────────────────────────────────────── */

const STEPS = [
  { num: 1, label: "Randevu Seçin" },
  { num: 2, label: "Onaylayın" },
  { num: 3, label: "Görüşmeye Katılın" },
] as const;

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="step-bar">
      {STEPS.map((s, i) => (
        <div key={s.num} className={`step-item ${s.num === current ? "active" : ""} ${s.num < current ? "done" : ""}`}>
          <span className="step-num">{s.num}</span>
          <span className="step-label">{s.label}</span>
          {i < STEPS.length - 1 && <span className="step-arrow">&rarr;</span>}
        </div>
      ))}

      <style>{`
        .step-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex-wrap: wrap;
          margin: 20px 0 8px;
        }
        .step-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--muted);
        }
        .step-item.active { color: var(--primary); font-weight: 600; }
        .step-item.done   { color: var(--success, #16a34a); }
        .step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
          border: 1.5px solid var(--border);
          background: var(--surface);
        }
        .step-item.active .step-num {
          background: var(--primary);
          color: #fff;
          border-color: var(--primary);
        }
        .step-item.done .step-num {
          background: var(--success, #16a34a);
          color: #fff;
          border-color: var(--success, #16a34a);
        }
        .step-label { white-space: nowrap; }
        .step-arrow { margin: 0 4px; color: var(--border-strong); }
      `}</style>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */

export default function RandevuPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workflowId = params.workflowId as string;
  const token = searchParams.get("token") ?? "";

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [workflow, setWorkflow] = useState<PublicSchedulingWorkflow | null>(null);
  const [bookResult, setBookResult] = useState<PublicSlotBookResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!workflowId || !token) {
      setErrorMsg("Geçersiz link. Lütfen e-postadaki linki kontrol ediniz.");
      setViewState("error");
      return;
    }

    publicSchedulingApi.getWorkflow(workflowId, token)
      .then((data) => {
        setWorkflow(data);
        if (data.state === "BOOKED" || data.status === "COMPLETED") {
          setViewState("already_booked");
        } else if (data.state === "CANCELLED" || data.status === "CANCELLED") {
          setErrorMsg("Bu görüşme randevusu iptal edilmiştir.");
          setViewState("error");
        } else {
          setViewState("slot_selection");
        }
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Bir hata oluştu.");
        setViewState("error");
      });
  }, [workflowId, token]);

  const handleConfirm = useCallback(async () => {
    if (!selectedSlotId || submitting) return;
    setSubmitting(true);
    setViewState("confirming");

    try {
      const result = await publicSchedulingApi.selectSlot(workflowId, token, selectedSlotId);
      setBookResult(result);
      setViewState("confirmed");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Randevu oluşturulamadı.");
      setViewState("error");
    } finally {
      setSubmitting(false);
    }
  }, [selectedSlotId, submitting, workflowId, token]);

  const jobTitle = workflow?.application?.jobTitle;
  const candidateName = workflow?.application?.candidateName;

  const currentStep: 1 | 2 | 3 =
    viewState === "confirmed" || viewState === "already_booked"
      ? 3
      : viewState === "confirming"
        ? 2
        : 1;

  return (
    <main>
      <section className="candidate-shell" style={{ maxWidth: 640 }}>
        {/* ── Header ───────────────────────────────────── */}
        <header className="candidate-header">
          <p className="eyebrow">Merhaba{candidateName ? `, ${candidateName}` : ""}!</p>
          <h1 style={{ margin: "8px 0 6px" }}>Görüşme Randevusu</h1>

          {jobTitle && (
            <p className="small" style={{ marginTop: 0 }}>
              Sizi <strong>{jobTitle}</strong> pozisyonu için ön görüşmeye davet ediyoruz.
            </p>
          )}

          <StepIndicator current={currentStep} />
        </header>

        {/* ── Loading ──────────────────────────────────── */}
        {viewState === "loading" && (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p className="small">Yükleniyor...</p>
          </div>
        )}

        {/* ── Error ────────────────────────────────────── */}
        {viewState === "error" && (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ color: "var(--danger, #c0392b)", fontWeight: 500 }}>{errorMsg}</p>
          </div>
        )}

        {/* ── Already booked ───────────────────────────── */}
        {viewState === "already_booked" && workflow && (
          <div className="panel" style={{ textAlign: "center", padding: "32px 24px" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Randevunuz oluşturulmuş</h2>

            {workflow.selectedSlot && (
              <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
                {formatDate(String(workflow.selectedSlot.start))}<br />
                {formatTime(String(workflow.selectedSlot.start))} &ndash; {formatTime(String(workflow.selectedSlot.end))}
              </p>
            )}

            {Boolean(workflow.bookingResult?.joinUrl) && (
              <a
                href={String(workflow.bookingResult!.joinUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="button-link"
                style={{ marginTop: 16 }}
              >
                Görüşmeye Katıl
              </a>
            )}

            {/* Next-steps box */}
            <div className="panel" style={{ marginTop: 24, textAlign: "left", background: "var(--surface-muted)" }}>
              <div className="section-head">
                <div>
                  <h3>Sonraki Adımlar</h3>
                  <p className="small" style={{ margin: 0 }}>
                    Görüşme zamanı geldiğinde yukarıdaki linkten katılabilirsiniz.
                    Bir sorun olursa recruiter ekibiyle iletişime geçebilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Slot selection ───────────────────────────── */}
        {viewState === "slot_selection" && workflow && (
          <>
            {/* What-to-expect info */}
            <div className="panel" style={{ background: "var(--surface-muted)" }}>
              <p className="small" style={{ margin: 0 }}>
                Bu görüşme yaklaşık 15-20 dakika sürecek bir AI destekli ön görüşmedir.
                Sorular Türkçe olarak sesli sorulur. Nihai kararı her zaman insan verir.
              </p>
            </div>

            {/* Slots panel */}
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Uygun Saat Seçiniz</h3>
                  <p className="small" style={{ margin: 0 }}>
                    Aşağıdaki saatlerden size en uygun olanı seçin.
                  </p>
                </div>
              </div>

              {groupSlotsByDate(workflow.proposedSlots).map(([dateKey, slots]) => (
                <div key={dateKey} style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                    {formatDate(slots[0]!.start)}
                  </h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {slots.map((slot) => {
                      const selected = selectedSlotId === slot.slotId;
                      return (
                        <button
                          key={slot.slotId}
                          onClick={() => setSelectedSlotId(slot.slotId)}
                          className={selected ? "button-link" : "ghost-button"}
                          style={{ padding: "8px 18px", fontSize: 14 }}
                        >
                          {formatTime(slot.start)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {selectedSlotId && (
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="button-link"
                    style={{ padding: "12px 40px", fontSize: 15 }}
                  >
                    {submitting ? "Oluşturuluyor..." : "Randevuyu Onayla"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Confirming ───────────────────────────────── */}
        {viewState === "confirming" && (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p className="small">Randevunuz oluşturuluyor...</p>
          </div>
        )}

        {/* ── Confirmed ────────────────────────────────── */}
        {viewState === "confirmed" && bookResult && (
          <div className="panel" style={{ textAlign: "center", padding: "32px 24px" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Randevunuz oluşturuldu!</h2>

            {bookResult.selectedSlot && (
              <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
                {formatDate(String(bookResult.selectedSlot.start))}<br />
                {formatTime(String(bookResult.selectedSlot.start))} &ndash; {formatTime(String(bookResult.selectedSlot.end))}
              </p>
            )}

            {Boolean(bookResult.bookingResult?.joinUrl) && (
              <a
                href={String(bookResult.bookingResult.joinUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="button-link"
                style={{ marginTop: 16 }}
              >
                Görüşmeye Katıl
              </a>
            )}

            {/* Next-steps box */}
            <div className="panel" style={{ marginTop: 24, textAlign: "left", background: "var(--surface-muted)" }}>
              <div className="section-head">
                <div>
                  <h3>Sonraki Adımlar</h3>
                  <p className="small" style={{ margin: 0 }}>
                    Görüşme davetiniz e-posta adresinize de gönderilecektir.
                    Görüşme zamanı geldiğinde yukarıdaki linkten katılabilirsiniz.
                    Bir sorun olursa recruiter ekibiyle iletişime geçebilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
