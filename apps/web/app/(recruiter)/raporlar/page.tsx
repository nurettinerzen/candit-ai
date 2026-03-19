"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StageChip } from "../../../components/stage-chip";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { formatPercent } from "../../../lib/format";
import type {
  AnalyticsFunnelRow,
  AnalyticsInterviewQuality,
  AnalyticsTimeToHire,
  RecruiterOverviewReadModel
} from "../../../lib/types";

type ReportData = {
  overview: RecruiterOverviewReadModel | null;
  funnel: AnalyticsFunnelRow[];
  timeToHire: AnalyticsTimeToHire | null;
  interviewQuality: AnalyticsInterviewQuality | null;
};

export default function RaporlarPage() {
  const [data, setData] = useState<ReportData>({
    overview: null,
    funnel: [],
    timeToHire: null,
    interviewQuality: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [overview, funnel, timeToHire, interviewQuality] = await Promise.all([
        apiClient.recruiterOverviewReadModel().catch(() => null),
        apiClient.analyticsFunnel().catch(() => []),
        apiClient.analyticsTimeToHire().catch(() => null),
        apiClient.analyticsInterviewQuality().catch(() => null)
      ]);
      setData({ overview, funnel, timeToHire, interviewQuality });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Rapor verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const conversionStats = useMemo(() => {
    if (data.funnel.length === 0) return null;
    const applied = data.funnel.find((r) => r.stage === "APPLIED")?.count ?? 0;
    const screening = data.funnel.find((r) => r.stage === "SCREENING")?.count ?? 0;
    const interview = data.funnel.find((r) => r.stage === "INTERVIEW_SCHEDULED")?.count ?? 0;
    const review = data.funnel.find((r) => r.stage === "RECRUITER_REVIEW")?.count ?? 0;
    const offer = data.funnel.find((r) => r.stage === "OFFER")?.count ?? 0;
    const hired = data.funnel.find((r) => r.stage === "HIRED")?.count ?? 0;
    const rejected = data.funnel.find((r) => r.stage === "REJECTED")?.count ?? 0;
    const total = data.funnel.reduce((sum, r) => sum + r.count, 0);

    return {
      total,
      applied,
      screening,
      interview,
      review,
      offer,
      hired,
      rejected,
      shortlistRate: total > 0 ? ((screening + interview + review + offer + hired) / total * 100) : 0,
      interviewRate: total > 0 ? ((interview + review + offer + hired) / total * 100) : 0,
      hireRate: total > 0 ? (hired / total * 100) : 0
    };
  }, [data.funnel]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Raporlar</h1>
          <p className="small" style={{ margin: 0 }}>
            İşe alım süreçlerinizin performansını ve dönüşüm oranlarını takip edin.
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadReports()}>
          Yenile
        </button>
      </div>

      {loading ? (
        <section className="panel">
          <LoadingState message="Raporlar yükleniyor..." />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadReports()}>
                Tekrar dene
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && (
        <>
          {/* Genel Göstergeler */}
          {data.overview && (
            <div className="kpi-grid">
              <article className="kpi-card">
                <p className="small">Aktif İlanlar</p>
                <p className="kpi-value">{data.overview.kpis.publishedJobs}</p>
              </article>
              <article className="kpi-card">
                <p className="small">Toplam Başvuru</p>
                <p className="kpi-value">{data.overview.kpis.activeApplications}</p>
              </article>
              <article className="kpi-card">
                <p className="small">İşe Alım Süresi (Ort.)</p>
                <p className="kpi-value">
                  {data.timeToHire?.avgDays != null ? `${data.timeToHire.avgDays} gün` : "-"}
                </p>
              </article>
              <article className="kpi-card">
                <p className="small">Değerlendirme Güveni</p>
                <p className="kpi-value">
                  {formatPercent(data.overview.kpis.avgReportConfidence, 0)}
                </p>
              </article>
            </div>
          )}

          {/* Dönüşüm Oranları */}
          <div className="mini-grid">
            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Aşama Dağılımı</h3>
              {data.funnel.length === 0 ? (
                <EmptyState message="Henüz yeterli veri bulunmuyor." />
              ) : (
                <ul className="plain-list">
                  {data.funnel.map((item) => (
                    <li key={item.stage} className="list-row">
                      <StageChip stage={item.stage} />
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Dönüşüm Oranları</h3>
              {conversionStats ? (
                <ul className="plain-list">
                  <li className="list-row">
                    <span>Ön eleme oranı</span>
                    <strong>{conversionStats.shortlistRate.toFixed(0)}%</strong>
                  </li>
                  <li className="list-row">
                    <span>Mülakata geçiş oranı</span>
                    <strong>{conversionStats.interviewRate.toFixed(0)}%</strong>
                  </li>
                  <li className="list-row">
                    <span>İşe alım oranı</span>
                    <strong>{conversionStats.hireRate.toFixed(0)}%</strong>
                  </li>
                  <li className="list-row">
                    <span>Reddedilen</span>
                    <strong>{conversionStats.rejected}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState message="Henüz yeterli veri bulunmuyor." />
              )}
            </section>
          </div>

          {/* Süreç Metrikleri */}
          <div className="mini-grid">
            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>İşe Alım Süresi</h3>
              {data.timeToHire ? (
                <ul className="plain-list">
                  <li className="list-row">
                    <span>İşe alınan aday sayısı</span>
                    <strong>{data.timeToHire.hires}</strong>
                  </li>
                  <li className="list-row">
                    <span>Ortalama süre</span>
                    <strong>{data.timeToHire.avgDays != null ? `${data.timeToHire.avgDays} gün` : "-"}</strong>
                  </li>
                  <li className="list-row">
                    <span>Medyan süre</span>
                    <strong>{data.timeToHire.medianDays != null ? `${data.timeToHire.medianDays} gün` : "-"}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState message="İşe alım süresi verisi henüz oluşmadı." />
              )}
            </section>

            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Görüşme Kalitesi</h3>
              {data.interviewQuality ? (
                <ul className="plain-list">
                  <li className="list-row">
                    <span>Transkript kalitesi (ort.)</span>
                    <strong>{formatPercent(data.interviewQuality.transcriptQualityAvg, 0)}</strong>
                  </li>
                  <li className="list-row">
                    <span>Rapor güveni (ort.)</span>
                    <strong>{formatPercent(data.interviewQuality.reportConfidenceAvg, 0)}</strong>
                  </li>
                  <li className="list-row">
                    <span>Transkript örneklemi</span>
                    <strong>{data.interviewQuality.transcriptSamples}</strong>
                  </li>
                  <li className="list-row">
                    <span>Rapor örneklemi</span>
                    <strong>{data.interviewQuality.reportSamples}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState message="Görüşme kalitesi verisi henüz oluşmadı." />
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
