"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { formatDate } from "../../../lib/format";
import type { Candidate } from "../../../lib/types";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCandidates = useCallback(async (search?: string) => {
    setLoading(true);
    setError("");

    try {
      const rows = await apiClient.listCandidates(search);
      setCandidates(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Aday listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Aday Havuzu</h1>
          <p className="small" style={{ margin: 0 }}>
            Tüm adaylarınızın genel listesi. Geçmiş başvuruları, ilişkili ilanları ve aday geçmişini buradan görüntüleyin.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadCandidates(query)}>
            Yenile
          </button>
          <Link href="/candidates/new" className="button-link">
            Yeni Aday Ekle
          </Link>
        </div>
      </div>

      {/* KPI bar */}
      {!loading && !error && (
        <div className="inbox-stats">
          <div className="inbox-stat">
            <span className="inbox-stat-value">{candidates.length}</span>
            <span className="inbox-stat-label">Toplam Aday</span>
          </div>
        </div>
      )}

      {/* Search */}
      <section className="panel">
        <form
          className="inline-grid search-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void loadCandidates(query);
          }}
        >
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad, e-posta veya telefon ile arayın..."
          />
          <button type="submit" className="ghost-button">
            Ara
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setQuery("");
              void loadCandidates();
            }}
          >
            Temizle
          </button>
        </form>

        {loading ? <LoadingState message="Adaylar yükleniyor..." /> : null}
        {!loading && error ? (
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadCandidates(query)}>
                Tekrar dene
              </button>
            }
          />
        ) : null}
        {!loading && !error && candidates.length === 0 ? (
          <EmptyState message="Arama kriterlerine uygun aday bulunamadı." />
        ) : null}
        {!loading && !error && candidates.length > 0 ? (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Aday</th>
                  <th>E-posta</th>
                  <th>Telefon</th>
                  <th>Kaynak</th>
                  <th>Başvuru Sayısı</th>
                  <th>Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      <Link href={`/candidates/${candidate.id}`} style={{ fontWeight: 500 }}>
                        {candidate.fullName}
                      </Link>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{candidate.email ?? "-"}</td>
                    <td>{candidate.phone ?? "-"}</td>
                    <td>
                      {candidate.source ? (
                        <span className="badge">{candidate.source}</span>
                      ) : "-"}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>
                      {candidate.applicationCount ?? 0}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{formatDate(candidate.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
