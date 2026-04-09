"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiText } from "../../../components/site-language-provider";
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

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function resolveAnalyticsGateNotice(error: unknown) {
  const message = toErrorMessage(error, "");
  if (message.includes("Gelişmiş raporlama") && message.includes("Growth")) {
    return "Gelişmiş raporlama metrikleri mevcut planınızda kapalı. Growth planına geçtiğinizde burada görünecek.";
  }

  return null;
}

export default function RaporlarPage() {
  const { t } = useUiText();
  const [data, setData] = useState<ReportData>({
    overview: null,
    funnel: [],
    timeToHire: null,
    interviewQuality: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsNotices, setAnalyticsNotices] = useState<string[]>([]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    setAnalyticsNotices([]);

    try {
      const [overviewResult, funnelResult, timeToHireResult, interviewQualityResult] =
        await Promise.allSettled([
          apiClient.recruiterOverviewReadModel(),
          apiClient.analyticsFunnel(),
          apiClient.analyticsTimeToHire(),
          apiClient.analyticsInterviewQuality()
        ]);

      const nextData: ReportData = {
        overview: overviewResult.status === "fulfilled" ? overviewResult.value : null,
        funnel: funnelResult.status === "fulfilled" ? funnelResult.value : [],
        timeToHire: timeToHireResult.status === "fulfilled" ? timeToHireResult.value : null,
        interviewQuality:
          interviewQualityResult.status === "fulfilled" ? interviewQualityResult.value : null
      };
      const notices = new Set<string>();

      if (timeToHireResult.status === "rejected") {
        const notice = resolveAnalyticsGateNotice(timeToHireResult.reason);
        if (notice) {
          notices.add(notice);
        }
      }

      if (interviewQualityResult.status === "rejected") {
        const notice = resolveAnalyticsGateNotice(interviewQualityResult.reason);
        if (notice) {
          notices.add(notice);
        }
      }

      setData(nextData);
      setAnalyticsNotices(Array.from(notices));

      if (
        !nextData.overview &&
        nextData.funnel.length === 0 &&
        (overviewResult.status === "rejected" || funnelResult.status === "rejected")
      ) {
        const blockingReason =
          overviewResult.status === "rejected"
            ? overviewResult.reason
            : funnelResult.status === "rejected"
              ? funnelResult.reason
              : null;
        setError(
          toErrorMessage(blockingReason, t("Rapor verileri yüklenemedi."))
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Rapor verileri yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{t("Raporlar")}</h1>
          <p className="small" style={{ margin: 0 }}>
            {t("İşe alım süreçlerinizin performansını ve dönüşüm oranlarını takip edin.")}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadReports()}>
          {t("Yenile")}
        </button>
      </div>

      {loading ? (
        <section className="panel">
          <LoadingState message={t("Raporlar yükleniyor...")} />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadReports()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && (
        <>
          {analyticsNotices.length > 0 ? (
            <section className="panel" style={{ display: "grid", gap: 10 }}>
              {analyticsNotices.map((message) => (
                <div
                  key={message}
                  style={{
                    padding: "12px 16px",
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: 10,
                    color: "var(--warn, #f59e0b)",
                    fontSize: 14
                  }}
                >
                  {t(message)}
                </div>
              ))}
            </section>
          ) : null}

          {/* Genel Göstergeler */}
          {data.overview && (
            <div className="kpi-grid">
              <article className="kpi-card">
                <p className="small">{t("Aktif İlanlar")}</p>
                <p className="kpi-value">{data.overview.kpis.publishedJobs}</p>
              </article>
              <article className="kpi-card">
                <p className="small">{t("Toplam Başvuru")}</p>
                <p className="kpi-value">{data.overview.kpis.activeApplications}</p>
              </article>
              <article className="kpi-card">
                <p className="small">{t("İşe Alım Süresi (Ort.)")}</p>
                <p className="kpi-value">
                  {data.timeToHire?.avgDays != null ? t(`${data.timeToHire.avgDays} gün`) : "-"}
                </p>
              </article>
              <article className="kpi-card">
                <p className="small">{t("Değerlendirme Güveni")}</p>
                <p className="kpi-value">
                  {formatPercent(data.overview.kpis.avgReportConfidence, 0)}
                </p>
              </article>
            </div>
          )}

          {/* Dönüşüm Oranları */}
          <div className="mini-grid">
            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Aşama Dağılımı")}</h3>
              {data.funnel.length === 0 ? (
                <EmptyState message={t("Henüz yeterli veri bulunmuyor.")} />
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
              <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Dönüşüm Oranları")}</h3>
              {conversionStats ? (
                <ul className="plain-list">
                  <li className="list-row">
                    <span>{t("Ön eleme oranı")}</span>
                    <strong>{conversionStats.shortlistRate.toFixed(0)}%</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Mülakata geçiş oranı")}</span>
                    <strong>{conversionStats.interviewRate.toFixed(0)}%</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("İşe alım oranı")}</span>
                    <strong>{conversionStats.hireRate.toFixed(0)}%</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Reddedilen")}</span>
                    <strong>{conversionStats.rejected}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState message={t("Henüz yeterli veri bulunmuyor.")} />
              )}
            </section>
          </div>

          {/* Süreç Metrikleri */}
          <div className="mini-grid">
            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("İşe Alım Süresi")}</h3>
              {data.timeToHire ? (
                <ul className="plain-list">
                  <li className="list-row">
                    <span>{t("İşe alınan aday sayısı")}</span>
                    <strong>{data.timeToHire.hires}</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Ortalama süre")}</span>
                    <strong>{data.timeToHire.avgDays != null ? t(`${data.timeToHire.avgDays} gün`) : "-"}</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Medyan süre")}</span>
                    <strong>{data.timeToHire.medianDays != null ? t(`${data.timeToHire.medianDays} gün`) : "-"}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState
                  message={
                    analyticsNotices.length > 0
                      ? t("Bu metrik mevcut planınızda kapalı.")
                      : t("İşe alım süresi verisi henüz oluşmadı.")
                  }
                />
              )}
            </section>

            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Görüşme Kalitesi")}</h3>
              {data.interviewQuality ? (
                <ul className="plain-list">
                  <li className="list-row">
                    <span>{t("Transkript kalitesi (ort.)")}</span>
                    <strong>{formatPercent(data.interviewQuality.transcriptQualityAvg, 0)}</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Rapor güveni (ort.)")}</span>
                    <strong>{formatPercent(data.interviewQuality.reportConfidenceAvg, 0)}</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Transkript örneklemi")}</span>
                    <strong>{data.interviewQuality.transcriptSamples}</strong>
                  </li>
                  <li className="list-row">
                    <span>{t("Rapor örneklemi")}</span>
                    <strong>{data.interviewQuality.reportSamples}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState
                  message={
                    analyticsNotices.length > 0
                      ? t("Bu metrik mevcut planınızda kapalı.")
                      : t("Görüşme kalitesi verisi henüz oluşmadı.")
                  }
                />
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
