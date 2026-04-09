"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StageChip } from "../../../../components/stage-chip";
import { ErrorState, LoadingState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import { formatDate } from "../../../../lib/format";
import type { CandidateWithApplications, Job } from "../../../../lib/types";

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
      setError(loadError instanceof Error ? loadError.message : "Aday detayi yuklenemedi.");
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

  async function handleCreateApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplicationError("");

    if (!selectedJobId) {
      setApplicationError("Basvuru acmak icin bir is ilani secmelisiniz.");
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
        submitError instanceof Error ? submitError.message : "Basvuru olusturulamadi."
      );
    } finally {
      setSubmittingApplication(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ marginBottom: 4 }}>Aday Profili</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Aday bilgileri, bagli basvurular ve bu aday icin hizli basvuru olusturma.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadCandidate()}>
            Yenile
          </button>
          <Link href="/candidates" className="ghost-button">
            Aday listesi
          </Link>
        </div>
      </div>

      {loading ? <LoadingState message="Aday detayi yukleniyor..." /> : null}
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
              <p className="small">Aday ID</p>
              <code>{candidate.id}</code>
            </div>
            <div>
              <p className="small">Kayit Tarihi</p>
              <strong>{formatDate(candidate.createdAt)}</strong>
            </div>
          </div>

          <div className="panel nested-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Adayi Ilana Bagla</h3>
            {applicationError ? <ErrorState title="Basvuru hatasi" error={applicationError} /> : null}
            <form className="inline-grid create-application-grid" onSubmit={handleCreateApplication}>
              <select
                className="select"
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                required
              >
                <option value="">Ilan seciniz</option>
                {availableJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
              <button type="submit" className="button-link" disabled={submittingApplication}>
                {submittingApplication ? "Olusturuluyor..." : "Basvuru Ac"}
              </button>
            </form>
            {availableJobs.length === 0 ? (
              <p className="small" style={{ marginBottom: 0 }}>
                Aday tum aktif ilanlara zaten baglanmis.
              </p>
            ) : null}
          </div>

          <h3>Basvurular</h3>
          {candidate.applications.length === 0 ? (
            <p className="small">Bu aday icin henuz basvuru yok.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Basvuru</th>
                  <th>Ilan</th>
                  <th>Stage</th>
                  <th>Stage Guncelleme</th>
                </tr>
              </thead>
              <tbody>
                {candidate.applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <Link href={`/applications/${application.id}`}>{application.id}</Link>
                    </td>
                    <td>{application.job.title}</td>
                    <td>
                      <StageChip stage={application.currentStage} />
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
