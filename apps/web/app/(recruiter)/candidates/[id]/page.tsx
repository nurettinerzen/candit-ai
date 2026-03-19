"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorState, LoadingState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import { getRecruiterStageMeta } from "../../../../lib/constants";
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

function cvStatusLabel(status: string | null | undefined): { text: string; className: string } {
  switch (status) {
    case "SUCCEEDED":
      return { text: "İncelendi", className: "badge success" };
    case "FAILED":
      return { text: "İncelenemedi", className: "badge danger" };
    case "RUNNING":
      return { text: "İnceleniyor…", className: "badge warn" };
    case "QUEUED":
      return { text: "Sırada", className: "badge warn" };
    case "PENDING":
      return { text: "Bekliyor", className: "badge warn" };
    default:
      return { text: "Henüz incelenmedi", className: "badge" };
  }
}

function confidenceBadge(confidence: string | number | null | undefined) {
  const val = typeof confidence === "string" ? parseFloat(confidence) : (confidence ?? 0);
  if (val >= 0.8) return <span className="badge success">Yüksek güven</span>;
  if (val >= 0.5) return <span className="badge warn">Orta güven</span>;
  return <span className="badge danger">Düşük güven</span>;
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const candidateId = params.id;
  const [candidate, setCandidate] = useState<CandidateWithApplications | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvUploadError, setCvUploadError] = useState("");
  const [cvUploadMessage, setCvUploadMessage] = useState("");
  const [triggeringParseForCvFileId, setTriggeringParseForCvFileId] = useState<string | null>(null);
  const [parseError, setParseError] = useState("");
  const [parseMessage, setParseMessage] = useState("");

  const loadCandidate = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [candidatePayload, jobRows] = await Promise.all([
        apiClient.getCandidate(candidateId),
        apiClient.listJobs()
      ]);
      setCandidate(candidatePayload);
      setJobs(jobRows);
      setSelectedJobId("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Aday detayı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void loadCandidate();
  }, [loadCandidate]);

  const existingJobIds = useMemo(
    () => new Set(candidate?.applications.map((application) => application.jobId) ?? []),
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
      setApplicationError("Başvuru açmak için bir iş ilanı seçmelisiniz.");
      return;
    }

    setSubmittingApplication(true);
    try {
      const created = await apiClient.createApplication({
        candidateId,
        jobId: selectedJobId
      });
      router.push(`/applications/${created.id}`);
      router.refresh();
    } catch (submitError) {
      setApplicationError(
        submitError instanceof Error ? submitError.message : "Başvuru oluşturulamadı."
      );
    } finally {
      setSubmittingApplication(false);
    }
  }

  function handleCvFileSelection(event: ChangeEvent<HTMLInputElement>) {
    setCvUploadError("");
    setCvUploadMessage("");
    const file = event.target.files?.[0] ?? null;
    setSelectedCvFile(file);
  }

  async function handleTriggerParsing(cvFileId?: string) {
    setParseError("");
    setParseMessage("");
    setTriggeringParseForCvFileId(cvFileId ?? "latest");

    try {
      const response = await apiClient.triggerCandidateCvParsing(candidateId, {
        cvFileId
      });

      setParseMessage(
        response.idempotent
          ? "Bu CV zaten inceleniyor."
          : "CV inceleniyor, lütfen bekleyin..."
      );
      await loadCandidate();

      // Poll for completion — check every 3s, stop after 60s
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
              status === "SUCCEEDED"
                ? "CV incelemesi tamamlandı."
                : status === "FAILED"
                  ? "CV incelemesi başarısız oldu."
                  : "İnceleme devam ediyor, sayfayı yenileyerek kontrol edebilirsiniz."
            );
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 3000);
    } catch (triggerError) {
      setParseError(
        triggerError instanceof Error
          ? triggerError.message
          : "CV inceleme işlemi başlatılamadı."
      );
    } finally {
      setTriggeringParseForCvFileId(null);
    }
  }

  async function handleCvUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCvUploadError("");
    setCvUploadMessage("");

    if (!selectedCvFile) {
      setCvUploadError("Yüklemek için bir CV dosyası seçin.");
      return;
    }

    setUploadingCv(true);
    try {
      const uploaded = await apiClient.uploadCandidateCv(candidateId, selectedCvFile);
      setCvUploadMessage(`${uploaded.originalName} yüklendi. Sistem CV'yi inceliyor...`);
      setSelectedCvFile(null);
      await loadCandidate();
      // Auto-trigger parse after upload
      void handleTriggerParsing(uploaded.id);
    } catch (uploadError) {
      setCvUploadError(uploadError instanceof Error ? uploadError.message : "CV yüklenemedi.");
    } finally {
      setUploadingCv(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ marginBottom: 4 }}>Aday Profili</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Aday bilgileri, CV belgeleri ve bağlı başvurular.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadCandidate()}>
            Yenile
          </button>
          <Link href="/candidates" className="ghost-button">
            Aday Havuzu
          </Link>
        </div>
      </div>

      {loading ? <LoadingState message="Aday detayı yükleniyor..." /> : null}
      {!loading && error ? (
        <ErrorState
          error={error}
          actions={
            <button type="button" className="ghost-button" onClick={() => void loadCandidate()}>
              Tekrar dene
            </button>
          }
        />
      ) : null}
      {!loading && !error && candidate ? (
        <>
          <div className="details-grid">
            <div>
              <p className="small">Ad Soyad</p>
              <strong>{candidate.fullName}</strong>
            </div>
            <div>
              <p className="small">E-posta</p>
              <strong>{candidate.email ?? "-"}</strong>
            </div>
            <div>
              <p className="small">Telefon</p>
              <strong>{candidate.phone ?? "-"}</strong>
            </div>
            <div>
              <p className="small">Kaynak</p>
              <strong>{candidate.source ?? "-"}</strong>
            </div>
            <div>
              <p className="small">Kayıt Tarihi</p>
              <strong>{formatDate(candidate.createdAt)}</strong>
            </div>
          </div>
          <details style={{ marginTop: 8 }}>
            <summary className="small" style={{ cursor: "pointer", color: "var(--text-muted)" }}>Teknik Bilgi</summary>
            <p className="small" style={{ margin: "4px 0 0" }}>Aday ID: <code>{candidate.id}</code></p>
          </details>

          {candidate.cvFiles.length === 0 && (
            <div className="alert-box" style={{ marginTop: 16 }}>
              <strong>⚠ CV Eksik:</strong> Bu aday için henüz CV yüklenmemiştir.
              AI değerlendirmesi yapabilmek için aşağıdan CV yüklemeniz gerekir.
            </div>
          )}

          <section className="panel nested-panel" style={{ marginTop: 16, ...(candidate.cvFiles.length === 0 ? { borderLeft: "3px solid var(--color-warning, #f59e0b)" } : {}) }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>CV Belgeleri</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  AI sadece destekleyici çıkarım üretir. Nihai karar recruiter tarafındadır.
                </p>
              </div>
            </div>

            {cvUploadError ? <ErrorState title="CV yükleme hatası" error={cvUploadError} /> : null}
            {cvUploadMessage ? <p className="small">{cvUploadMessage}</p> : null}
            <form className="inline-grid create-application-grid" onSubmit={handleCvUpload}>
              <input
                className="input"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleCvFileSelection}
              />
              <button type="submit" className="button-link" disabled={uploadingCv}>
                {uploadingCv ? "Yükleniyor..." : "CV Ekle"}
              </button>
            </form>
            <p className="small" style={{ marginBottom: 0 }}>
              Desteklenen formatlar:{" "}
              {candidate.uploadPolicy.allowedExtensions.join(", ").toUpperCase()} - Maksimum{" "}
              {(candidate.uploadPolicy.maxSizeBytes / 1024 / 1024).toFixed(1)} MB
            </p>

            {parseError ? <ErrorState title="CV inceleme hatası" error={parseError} /> : null}
            {parseMessage ? <p className="small">{parseMessage}</p> : null}

            {candidate.cvFiles.length === 0 ? (
              <p className="small" style={{ marginTop: 12 }}>
                Bu aday için henüz CV dosyası yüklenmedi.
              </p>
            ) : (
              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Dosya</th>
                    <th>Yükleme</th>
                    <th>CV Durumu</th>
                    <th>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {candidate.cvFiles.map((cvFile) => {
                    const taskStatus = cvFile.latestParseTask?.status ?? null;
                    const statusInfo = cvStatusLabel(taskStatus);
                    const isRunning = taskStatus === "PENDING" || taskStatus === "QUEUED" || taskStatus === "RUNNING";
                    const providerMode = cvFile.parsedProfile?.providerMode;
                    const isFallback = providerMode === "deterministic_fallback";
                    const extractionFailed = cvFile.parsedProfile?.extractionStatus === "FAILED";

                    return (
                      <tr key={cvFile.id}>
                        <td>
                          <strong>{cvFile.originalName}</strong>
                          <p className="small" style={{ margin: "6px 0 0" }}>
                            {cvFile.mimeType} | {(cvFile.sizeBytes / 1024).toFixed(1)} KB
                          </p>
                          <p className="small" style={{ margin: "4px 0 0" }}>
                            {cvFile.isPrimary ? (
                              <span className="badge">Birincil</span>
                            ) : null}{" "}
                            {cvFile.isLatest ? <span className="badge">En yeni</span> : null}
                          </p>
                        </td>
                        <td>
                          <p style={{ margin: 0 }}>{formatDate(cvFile.uploadedAt)}</p>
                          <p className="small" style={{ margin: "4px 0 0" }}>
                            Yükleyen: {cvFile.uploadedBy}
                          </p>
                        </td>
                        <td>
                          <span className={statusInfo.className}>{statusInfo.text}</span>

                          {cvFile.parsedProfile ? (
                            <>
                              <p className="small" style={{ margin: "6px 0 0" }}>
                                {confidenceBadge(cvFile.parsedProfile.parseConfidence)}
                              </p>
                              {extractionFailed ? (
                                <p className="small" style={{ margin: "4px 0 0" }}>
                                  <span className="badge danger">Metin okunamadı</span>
                                </p>
                              ) : null}
                              {cvFile.parsedProfile.requiresManualReview ? (
                                <p className="small" style={{ margin: "4px 0 0", color: "var(--color-warning)" }}>
                                  ⚠ Bu CV&apos;nin içeriğini doğrudan kontrol etmenizi öneriyoruz.
                                </p>
                              ) : null}
                            </>
                          ) : !isRunning ? (
                            <p className="small" style={{ margin: "6px 0 0" }}>
                              Henüz incelenmedi
                            </p>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={triggeringParseForCvFileId !== null || isRunning}
                            onClick={() => void handleTriggerParsing(cvFile.id)}
                          >
                            {triggeringParseForCvFileId === cvFile.id
                              ? "Hazırlanıyor..."
                              : isRunning
                                ? "İnceleniyor..."
                                : isFallback || extractionFailed
                                  ? "Tekrar İncele"
                                  : taskStatus === "SUCCEEDED"
                                    ? "Yeniden İncele"
                                    : "CV'yi İncele"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>CV Özeti</h3>
            {!candidate.latestParsedProfile || !parsedSummary ? (
              <p className="small">Bu aday için henüz CV incelemesi yapılmadı.</p>
            ) : (
              <>
                <div className="details-grid">
                  <div>
                    <p className="small">İnceleme Güveni</p>
                    {confidenceBadge(candidate.latestParsedProfile.parseConfidence)}
                  </div>
                  <div>
                    <p className="small">Oluşturulma</p>
                    <strong>{formatDate(candidate.latestParsedProfile.createdAt)}</strong>
                  </div>
                </div>
                <p style={{ marginTop: 10 }}>{parsedSummary.shortSummary}</p>
                <p className="small section-label">İş Deneyimi Özeti</p>
                <p style={{ marginTop: 0 }}>{parsedSummary.coreWorkHistorySummary}</p>
                <div className="mini-grid">
                  <div>
                    <p className="small section-label">Güçlü Yönler</p>
                    {parsedSummary.likelyFitSignals.length === 0 ? (
                      <p className="small">Belirtilmedi.</p>
                    ) : (
                      <ul className="plain-list">
                        {parsedSummary.likelyFitSignals.map((item, index) => (
                          <li key={`fit-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="small section-label">Görüşmede Sorulması Gerekenler</p>
                    {parsedSummary.recruiterFollowUpTopics.length === 0 ? (
                      <p className="small">Belirtilmedi.</p>
                    ) : (
                      <ul className="plain-list">
                        {parsedSummary.recruiterFollowUpTopics.map((item, index) => (
                          <li key={`followup-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p className="small section-label">Eksik Bilgiler</p>
                {parsedSummary.missingCriticalInformation.length === 0 ? (
                  <p className="small">Eksik bilgi işaretlenmedi.</p>
                ) : (
                  <ul className="plain-list">
                    {parsedSummary.missingCriticalInformation.map((item, index) => (
                      <li key={`missing-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
                <details className="history-item" style={{ marginTop: 8 }}>
                  <summary>Teknik Detay (JSON)</summary>
                  <pre className="code-block">
                    {JSON.stringify(candidate.latestParsedProfile.profileJson, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </section>

          <div className="panel nested-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Adayı İlana Bağla</h3>
            {applicationError ? <ErrorState title="Başvuru hatası" error={applicationError} /> : null}
            <form className="inline-grid create-application-grid" onSubmit={handleCreateApplication}>
              <select
                className="select"
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                required
              >
                <option value="">İlan seçiniz</option>
                {availableJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
              <button type="submit" className="button-link" disabled={submittingApplication}>
                {submittingApplication ? "Oluşturuluyor..." : "Başvuru Aç"}
              </button>
            </form>
            {availableJobs.length === 0 ? (
              <p className="small" style={{ marginBottom: 0 }}>
                Aday tüm aktif ilanlara zaten bağlanmış.
              </p>
            ) : null}
          </div>

          <h3>Başvurular</h3>
          {candidate.applications.length === 0 ? (
            <p className="small">Bu aday için henüz başvuru yok.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Başvuru</th>
                  <th>İlan</th>
                  <th>Aşama</th>
                  <th>Son Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {candidate.applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <Link href={`/applications/${application.id}`}>{application.id}</Link>
                    </td>
                    <td>
                      <Link href={`/jobs/${application.jobId}`}>{application.job.title}</Link>
                    </td>
                    <td>
                      {(() => {
                        const stageMeta = getRecruiterStageMeta(
                          application.currentStage,
                          application.aiRecommendation
                        );

                        return (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          color: stageMeta.color,
                          fontWeight: 600
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: stageMeta.color
                          }}
                        />
                        {stageMeta.label}
                      </span>
                        );
                      })()}
                    </td>
                    <td>{formatDate(application.stageUpdatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}
