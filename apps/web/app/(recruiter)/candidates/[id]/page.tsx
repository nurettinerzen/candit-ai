"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { useUiText } from "../../../../components/site-language-provider";
import { ErrorState, LoadingState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import { getRecruiterStageMeta, formatDepartment } from "../../../../lib/constants";
import {
  applicationDetailHref,
  decodeRouteEntityId,
  pickCanonicalApplicationId
} from "../../../../lib/entity-routes";
import { formatDate } from "../../../../lib/format";
import type { CandidateWithApplications, Job } from "../../../../lib/types";

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readParsedSummary(profileJson: unknown) {
  const root = toRecord(profileJson);
  const normalizedSummary = toRecord(root.normalizedSummary);
  const extractedFacts = toRecord(root.extractedFacts);
  const contacts = toRecord(extractedFacts.contacts);

  return {
    shortSummary:
      typeof normalizedSummary.shortSummary === "string"
        ? normalizedSummary.shortSummary
        : "Özet bulunamadı.",
    coreWorkHistorySummary:
      typeof normalizedSummary.coreWorkHistorySummary === "string"
        ? normalizedSummary.coreWorkHistorySummary
        : "Deneyim özeti bulunamadı.",
    likelyFitSignals: toStringArray(normalizedSummary.likelyFitSignals),
    recruiterFollowUpTopics: toStringArray(normalizedSummary.recruiterFollowUpTopics),
    skills: toStringArray(extractedFacts.skills),
    languages: toStringArray(extractedFacts.languages),
    emails: toStringArray(contacts.emails),
    phones: toStringArray(contacts.phones),
    missingCriticalInformation: toStringArray(root.missingCriticalInformation),
    uncertaintyNotes: toStringArray(root.uncertaintyNotes)
  };
}

function cvStatusText(status: string | null | undefined): { text: string; color: string } {
  switch (status) {
    case "SUCCEEDED": return { text: "İncelendi", color: "var(--success, #22c55e)" };
    case "FAILED": return { text: "İncelenemedi", color: "var(--danger, #ef4444)" };
    case "RUNNING":
    case "QUEUED":
    case "PENDING": return { text: "İnceleniyor...", color: "var(--warn, #f59e0b)" };
    default: return { text: "Henüz incelenmedi", color: "var(--text-dim)" };
  }
}

export default function CandidateDetailPage() {
  const { t } = useUiText();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const candidateId = decodeRouteEntityId(params.id);
  const [candidate, setCandidate] = useState<CandidateWithApplications | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvUploadError, setCvUploadError] = useState("");
  const [cvUploadMessage, setCvUploadMessage] = useState("");
  const [triggeringParseForCvFileId, setTriggeringParseForCvFileId] = useState<string | null>(null);
  const [parseError, setParseError] = useState("");
  const [parseMessage, setParseMessage] = useState("");
  const [redirectingToApplication, setRedirectingToApplication] = useState(false);

  const loadCandidate = useCallback(async () => {
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const [candidateResult, jobsResult] = await Promise.allSettled([
        apiClient.getCandidate(candidateId),
        apiClient.listJobs()
      ]);
      if (candidateResult.status !== "fulfilled") {
        throw candidateResult.reason;
      }
      const candidatePayload = candidateResult.value;
      const canonicalApplicationId = pickCanonicalApplicationId(candidatePayload.applications);
      if (canonicalApplicationId) {
        setRedirectingToApplication(true);
        router.replace(applicationDetailHref(canonicalApplicationId));
        return;
      }
      setCandidate(candidatePayload);
      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value);
      } else {
        setJobs([]);
        setWarning(
          t("İlan listesi şu an yüklenemedi. Bu aday için yeni başvuru açma bölümü geçici olarak sınırlı olabilir.")
        );
      }
      setSelectedJobId("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Aday detayı yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }, [candidateId, router, t]);

  useEffect(() => {
    void loadCandidate();
  }, [loadCandidate]);

  const existingJobIds = useMemo(
    () => new Set(candidate?.applications.map((a) => a.jobId) ?? []),
    [candidate]
  );

  const availableJobs = useMemo(
    () => jobs.filter((job) => !existingJobIds.has(job.id)),
    [jobs, existingJobIds]
  );

  const parsedSummary = useMemo(
    () =>
      candidate?.latestParsedProfile
        ? readParsedSummary(candidate.latestParsedProfile.profileJson)
        : null,
    [candidate?.latestParsedProfile]
  );

  async function handleCreateApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplicationError("");
    if (!selectedJobId) {
      setApplicationError(t("Başvuru açmak için bir iş ilanı seçmelisiniz."));
      return;
    }
    setSubmittingApplication(true);
    try {
      const created = await apiClient.createApplication({ candidateId, jobId: selectedJobId });
      router.push(applicationDetailHref(created.id));
      router.refresh();
    } catch (submitError) {
      setApplicationError(submitError instanceof Error ? submitError.message : t("Başvuru oluşturulamadı."));
    } finally {
      setSubmittingApplication(false);
    }
  }

  function handleCvFileSelection(event: ChangeEvent<HTMLInputElement>) {
    setCvUploadError("");
    setCvUploadMessage("");
    setSelectedCvFile(event.target.files?.[0] ?? null);
  }

  async function handleTriggerParsing(cvFileId?: string) {
    setParseError("");
    setParseMessage("");
    setTriggeringParseForCvFileId(cvFileId ?? "latest");
    try {
      const response = await apiClient.triggerCandidateCvParsing(candidateId, { cvFileId });
      setParseMessage(response.idempotent ? t("Bu CV zaten inceleniyor.") : t("CV inceleniyor..."));
      await loadCandidate();
      let elapsed = 0;
      const pollInterval = setInterval(async () => {
        elapsed += 3000;
        try {
          const updated = await apiClient.getCandidate(candidateId);
          setCandidate(updated);
          const targetCv = updated.cvFiles.find((f) => f.id === (cvFileId ?? updated.primaryCvFileId));
          const status = targetCv?.latestParseTask?.status;
          if (status === "SUCCEEDED" || status === "FAILED" || elapsed >= 60000) {
            clearInterval(pollInterval);
            setParseMessage(
              status === "SUCCEEDED" ? t("CV incelemesi tamamlandı.")
                : status === "FAILED" ? t("CV incelemesi başarısız oldu.")
                : t("İnceleme devam ediyor, sayfayı yenileyerek kontrol edebilirsiniz.")
            );
          }
        } catch { clearInterval(pollInterval); }
      }, 3000);
    } catch (triggerError) {
      setParseError(triggerError instanceof Error ? triggerError.message : t("CV inceleme işlemi başlatılamadı."));
    } finally {
      setTriggeringParseForCvFileId(null);
    }
  }

  async function handleCvUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCvUploadError("");
    setCvUploadMessage("");
    if (!selectedCvFile) { setCvUploadError(t("Yüklemek için bir CV dosyası seçin.")); return; }
    setUploadingCv(true);
    try {
      const uploaded = await apiClient.uploadCandidateCv(candidateId, selectedCvFile);
      setCvUploadMessage(t(`${uploaded.originalName} yüklendi.`));
      setSelectedCvFile(null);
      await loadCandidate();
      void handleTriggerParsing(uploaded.id);
    } catch (uploadError) {
      setCvUploadError(uploadError instanceof Error ? uploadError.message : t("CV yüklenemedi."));
    } finally {
      setUploadingCv(false);
    }
  }

  if (loading || redirectingToApplication) {
    return <LoadingState message={t("Merkezi aday profiline yönlendiriliyor...")} />;
  }
  if (error) return <ErrorState error={error} actions={<button className="ghost-button" onClick={() => void loadCandidate()}>{t("Tekrar dene")}</button>} />;
  if (!candidate) return null;

  const hasCv = candidate.cvFiles.length > 0;
  const primaryCv = candidate.cvFiles.find((f) => f.isPrimary) ?? candidate.cvFiles[0];

  return (
    <div className="page-grid">
      {warning ? (
        <section
          className="panel"
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)"
          }}
        >
          <p className="small" style={{ margin: 0, color: "var(--warn, #f59e0b)" }}>
            {warning}
          </p>
        </section>
      ) : null}

      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/candidates" className="text-muted text-sm" style={{ textDecoration: "none" }}>
          ← Aday Havuzu
        </Link>
        <span className="text-muted text-sm"> / {candidate.fullName}</span>
      </div>

      {/* Two column layout */}
      <div className="detail-grid">

        {/* ═══ LEFT COLUMN ═══ */}
        <div>

          {/* Candidate Info Card */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <PageTitleWithGuide
                  as="h2"
                  guideKey="candidateDetail"
                  title={candidate.fullName}
                  style={{ fontSize: 22, fontWeight: 700 }}
                />
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                  {candidate.source ? `Kaynak: ${candidate.source}` : ""}
                  {candidate.source ? " · " : ""}
                  Kayıt: {formatDate(candidate.createdAt)}
                </p>
              </div>
              <button className="ghost-button" onClick={() => void loadCandidate()}>Yenile</button>
            </div>

            <div className="info-grid-3" style={{ borderTop: "1px solid var(--border)" }}>
              <InfoCell label={t("E-posta")} value={candidate.email ?? "—"} />
              <InfoCell label={t("Telefon")} value={candidate.phone ?? "—"} />
              <InfoCell label={t("CV Durumu")} value={hasCv ? t("Mevcut") : t("Yok")} success={hasCv} />
            </div>
          </section>

          {/* CV Eksik Uyarısı */}
          {!hasCv && (
            <div style={{
              padding: "12px 16px", borderRadius: 8, fontSize: 13, marginBottom: 16,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              color: "var(--warn, #f59e0b)",
            }}>
              Bu aday için henüz CV yüklenmemiştir. AI değerlendirmesi yapabilmek için sağ taraftan CV yükleyin.
            </div>
          )}

          {/* CV Özeti */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>CV Özeti</h3>
            <p className="small text-muted" style={{ marginBottom: 12 }}>AI tarafından çıkarılan özet bilgiler.</p>

            {!parsedSummary ? (
              <p className="text-sm text-muted">Henüz CV incelemesi yapılmadı.</p>
            ) : (
              <>
                <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 14 }}>{parsedSummary.shortSummary}</p>

                <div style={{ fontSize: 13, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 4 }}>
                    İş Deneyimi Özeti
                  </div>
                  <p style={{ lineHeight: 1.7 }}>{parsedSummary.coreWorkHistorySummary}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 6 }}>
                      Güçlü Yönler
                    </div>
                    {parsedSummary.likelyFitSignals.length === 0 ? (
                      <p className="text-sm text-muted">Belirtilmedi.</p>
                    ) : (
                      <ul style={{ paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
                        {parsedSummary.likelyFitSignals.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 6 }}>
                      Görüşmede Sorulması Gerekenler
                    </div>
                    {parsedSummary.recruiterFollowUpTopics.length === 0 ? (
                      <p className="text-sm text-muted">Belirtilmedi.</p>
                    ) : (
                      <ul style={{ paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
                        {parsedSummary.recruiterFollowUpTopics.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    )}
                  </div>
                </div>

                {parsedSummary.missingCriticalInformation.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 6 }}>
                      Eksik Bilgiler
                    </div>
                    <ul style={{ paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
                      {parsedSummary.missingCriticalInformation.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Başvurular */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Başvurular</h3>
            <p className="small text-muted" style={{ marginBottom: 12 }}>Bu adayın bağlı olduğu ilanlar.</p>

            {candidate.applications.length === 0 ? (
              <p className="text-sm text-muted">Henüz başvuru yok.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {candidate.applications.map((application) => {
                  const stageMeta = getRecruiterStageMeta(application.currentStage, application.humanDecision);
                  return (
                    <Link
                      key={application.id}
                      href={applicationDetailHref(application.id)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderRadius: 8, textDecoration: "none", color: "inherit",
                        background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{application.job.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                          {formatDate(application.stageUpdatedAt)}
                        </div>
                      </div>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 12, fontWeight: 600, color: stageMeta.color,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageMeta.color }} />
                        {stageMeta.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ═══ RIGHT COLUMN (Sticky) ═══ */}
        <div style={{ position: "sticky", top: 24 }}>

          {/* CV Dosyaları */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>CV Dosyaları</h3>
            <p className="small text-muted" style={{ marginBottom: 12 }}>Yüklenen özgeçmiş belgeleri.</p>

            {cvUploadError && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 8, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "var(--danger, #ef4444)" }}>
                {cvUploadError}
              </div>
            )}
            {cvUploadMessage && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 8, fontSize: 12, background: "rgba(34,197,94,0.1)", color: "var(--success, #22c55e)" }}>
                {cvUploadMessage}
              </div>
            )}
            {parseError && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 8, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "var(--danger, #ef4444)" }}>
                {parseError}
              </div>
            )}
            {parseMessage && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 8, fontSize: 12, background: "rgba(34,197,94,0.1)", color: "var(--success, #22c55e)" }}>
                {parseMessage}
              </div>
            )}

            {/* CV Listesi */}
            {candidate.cvFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {candidate.cvFiles.map((cvFile) => {
                  const taskStatus = cvFile.latestParseTask?.status ?? null;
                  const statusInfo = cvStatusText(taskStatus);
                  const isRunning = taskStatus === "PENDING" || taskStatus === "QUEUED" || taskStatus === "RUNNING";
                  const isFallback = cvFile.parsedProfile?.providerMode === "deterministic_fallback";
                  const extractionFailed = cvFile.parsedProfile?.extractionStatus === "FAILED";

                  return (
                    <div key={cvFile.id} style={{
                      padding: "12px 14px", borderRadius: 8,
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <strong style={{ fontSize: 13 }}>{cvFile.originalName}</strong>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusInfo.color }}>{statusInfo.text}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                        {(cvFile.sizeBytes / 1024).toFixed(0)} KB · {formatDate(cvFile.uploadedAt)}
                      </div>
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ fontSize: 12, padding: "4px 10px", width: "100%" }}
                        disabled={triggeringParseForCvFileId !== null || isRunning}
                        onClick={() => void handleTriggerParsing(cvFile.id)}
                      >
                        {triggeringParseForCvFileId === cvFile.id ? "Hazırlanıyor..."
                          : isRunning ? "İnceleniyor..."
                          : isFallback || extractionFailed ? "Tekrar İncele"
                          : taskStatus === "SUCCEEDED" ? "Yeniden İncele"
                          : "CV'yi İncele"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CV Yükleme */}
            <form onSubmit={handleCvUpload} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                className="input"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleCvFileSelection}
                style={{ fontSize: 12 }}
              />
              <button type="submit" className="button-link" style={{ fontSize: 12, padding: "8px 0" }} disabled={uploadingCv}>
                {uploadingCv ? "Yükleniyor..." : "CV Ekle"}
              </button>
            </form>
            <p className="text-sm text-muted" style={{ marginTop: 6, fontSize: 11 }}>
              {candidate.uploadPolicy.allowedExtensions.join(", ").toUpperCase()} · Maks {(candidate.uploadPolicy.maxSizeBytes / 1024 / 1024).toFixed(0)} MB
            </p>
          </section>

          {/* Adayı İlana Bağla */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Adayı İlana Bağla</h3>
            <p className="small text-muted" style={{ marginBottom: 12 }}>Yeni bir ilana başvuru oluşturun.</p>

            {applicationError && (
              <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 8, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "var(--danger, #ef4444)" }}>
                {applicationError}
              </div>
            )}

            {availableJobs.length === 0 ? (
              <p className="text-sm text-muted">
                {jobs.length === 0
                  ? "İlan listesi şu an erişilemedi."
                  : "Tüm aktif ilanlara zaten bağlı."}
              </p>
            ) : (
              <form onSubmit={handleCreateApplication} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <select
                  className="select"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  required
                  style={{ fontSize: 13, padding: "8px 12px" }}
                >
                  <option value="">İlan seçiniz</option>
                  {availableJobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
                <button type="submit" className="button-link" style={{ fontSize: 12, padding: "8px 0" }} disabled={submittingApplication}>
                  {submittingApplication ? "Oluşturuluyor..." : "Başvuru Aç"}
                </button>
              </form>
            )}
          </section>

          <Link
            href="/candidates"
            className="text-xs text-muted"
            style={{ textDecoration: "none", display: "inline-block", marginTop: 4 }}
          >
            ← Aday Havuzuna dön
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function InfoCell({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, wordBreak: "break-all",
        color: success ? "var(--success, #22c55e)" : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}
