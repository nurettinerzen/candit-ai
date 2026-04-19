"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InfoHint, PageTitleWithGuide } from "../../../components/page-guide";
import { useUiText } from "../../../components/site-language-provider";
import { StageChip } from "../../../components/stage-chip";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { formatPercent } from "../../../lib/format";
import type { AnalyticsSummary } from "../../../lib/types";

function resolveLocaleTag(locale: string) {
  return locale === "en" ? "en-US" : "tr-TR";
}

function formatMetricNumber(
  locale: string,
  value: number | null | undefined,
  maxFractionDigits = 1
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  const fractionDigits = Number.isInteger(value) ? 0 : maxFractionDigits;

  return new Intl.NumberFormat(resolveLocaleTag(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

function formatPercentLabel(
  locale: string,
  value: number | null | undefined,
  fractionDigits = 0
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${formatMetricNumber(locale, value, fractionDigits)}%`;
}

function formatDurationLabel(
  locale: string,
  value: number | null | undefined,
  unit: { tr: string; en: string },
  maxFractionDigits = 1
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${formatMetricNumber(locale, value, maxFractionDigits)} ${locale === "en" ? unit.en : unit.tr}`;
}

function formatHourLabel(locale: string, value: number | null | undefined) {
  return formatDurationLabel(locale, value, { tr: "saat", en: "hr" });
}

function formatMinuteLabel(locale: string, value: number | null | undefined) {
  return formatDurationLabel(locale, value, { tr: "dk", en: "min" });
}

function formatDayLabel(locale: string, value: number | null | undefined) {
  return formatDurationLabel(locale, value, { tr: "gün", en: "days" });
}

function MetricTile(props: {
  label: string;
  value: string;
  info?: string;
}) {
  return (
    <div className="reports-metric-tile">
      <div className="reports-metric-header">
        <span className="reports-metric-label">{props.label}</span>
        {props.info ? <InfoHint label={props.label} content={props.info} /> : null}
      </div>
      <strong className="reports-metric-value">{props.value}</strong>
    </div>
  );
}

function DetailRow(props: {
  label: string;
  value: string;
  info?: string;
}) {
  return (
    <li className="list-row reports-detail-row">
      <div className="reports-detail-label">
        <span>{props.label}</span>
        {props.info ? <InfoHint label={props.label} content={props.info} /> : null}
      </div>
      <strong>{props.value}</strong>
    </li>
  );
}

export default function RaporlarPage() {
  const { t, locale } = useUiText();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const summary = await apiClient.analyticsSummary();
      setData(summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Rapor verileri yüklenemedi."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const executiveHighlights = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        title: t("Ön değerlendirme hazır"),
        value: formatPercentLabel(locale, data.ai.screeningCoverageRate, 0),
        info: t("Screening veya fit score üretilen başvuruların oranı.")
      },
      {
        title: t("İlk mülakata geçiş"),
        value: formatDayLabel(locale, data.pipeline.velocity.averageTimeToInterviewDays),
        info: t("Başvuru ile ilk mülakat planı arasındaki ortalama süre.")
      },
      {
        title: t("Mülakat tamamlanma oranı"),
        value: formatPercentLabel(locale, data.interviews.completionRate, 0),
        info: t("Planlanan oturumların ne kadarının tamamlandığını gösterir.")
      },
      {
        title: t("AI görev başarı oranı"),
        value:
          data.ai.aiTaskSuccessRate === null
            ? "-"
            : formatPercentLabel(locale, data.ai.aiTaskSuccessRate, 0),
        info: t("Terminal AI görevlerinde başarı oranı.")
      }
    ];
  }, [data, locale, t]);

  const aiImpactHighlights = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        title: t("Screening kazanımı"),
        value: formatHourLabel(locale, data.ai.estimatedTimeSavedHours.screening),
        info: `${formatMetricNumber(locale, data.ai.screeningCoverageCount, 0)} ${t("başvuruda AI ön değerlendirme üretildi.")}`
      },
      {
        title: t("Mülakat analizi kazanımı"),
        value: formatHourLabel(locale, data.ai.estimatedTimeSavedHours.interviewAnalysis),
        info: `${formatMetricNumber(locale, data.ai.reportCount, 0)} ${t("oturum için rapor veya analiz çıkışı mevcut.")}`
      },
      {
        title: t("Planlama kazanımı"),
        value: formatHourLabel(locale, data.ai.estimatedTimeSavedHours.scheduling),
        info: `${formatMetricNumber(locale, data.interviews.aiScheduled, 0)} ${t("oturum AI destekli veya otomasyonla planlanmış.")}`
      },
      {
        title: t("Toplam tahmini kazanç"),
        value: formatHourLabel(locale, data.ai.estimatedTimeSavedHours.total),
        info: t(data.definitions.timeSaved)
      }
    ];
  }, [data, locale, t]);

  const calibrationHighlights = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        title: t("İnsan kararı kapsamı"),
        value: formatPercentLabel(locale, data.ai.calibration.humanDecisionCoverageRate, 0),
        info: t(data.definitions.humanDecisionCoverage)
      },
      {
        title: t("AI yön uyumu"),
        value: formatPercentLabel(locale, data.ai.calibration.agreementRate, 0),
        info: t(data.definitions.calibrationAgreement)
      },
      {
        title: t("Advance kabul oranı"),
        value: formatPercentLabel(locale, data.ai.calibration.advanceAcceptanceRate, 0),
        info: t("AI'nin ADVANCE önerisi verdiği ve insan kararının kaydedildiği dosyalarda recruiter'ın ilerletme kararı verme oranı.")
      },
      {
        title: t("Review çözümleme oranı"),
        value: formatPercentLabel(locale, data.ai.calibration.resolvedReviewRecommendationRate, 0),
        info: t("AI'nin REVIEW önerisi verdiği dosyalarda recruiter kararının kaydedilme oranı.")
      }
    ];
  }, [data, locale, t]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <PageTitleWithGuide
            guideKey="reports"
            title={t("Raporlar")}
            subtitle={t("İK ekibinin günlük operasyonu ve üst yönetim raporlaması için kritik KPI'ları tek ekranda izleyin.")}
            subtitleClassName="small"
            style={{ margin: 0, fontSize: 22, fontWeight: 700 }}
          />
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

      {!loading && !error && data ? (
        <>
          <div className="kpi-grid">
            <article className="kpi-card">
              <p className="reports-kpi-label">{t("Aktif ilanlar")}</p>
              <p className="kpi-value">{formatMetricNumber(locale, data.overview.publishedJobs, 0)}</p>
            </article>
            <article className="kpi-card">
              <p className="reports-kpi-label">{t("Toplam başvuru")}</p>
              <p className="kpi-value">{formatMetricNumber(locale, data.overview.totalApplications, 0)}</p>
            </article>
            <article className="kpi-card">
              <p className="reports-kpi-label">{t("Mülakat yapılan aday")}</p>
              <p className="kpi-value">{formatMetricNumber(locale, data.overview.interviewedApplications, 0)}</p>
            </article>
            <article className="kpi-card">
              <p className="reports-kpi-label">{t("Tahmini zaman kazancı")}</p>
              <p className="kpi-value">{formatHourLabel(locale, data.ai.estimatedTimeSavedHours.total)}</p>
            </article>
          </div>

          <div className="reports-panel-grid">
            <section className="panel reports-panel">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Yönetici özeti")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("Yönetime sunulacak temel sinyalleri özetler.")}
                  </p>
                </div>
              </div>

              <div className="reports-metric-grid">
                {executiveHighlights.map((item) => (
                  <MetricTile key={item.title} label={item.title} value={item.value} info={item.info} />
                ))}
              </div>
            </section>

            <section className="panel reports-panel">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("AI katkısı ve karşılaştırma")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("Sistemin manuel iş yüküne göre yarattığı tahmini kazanımı gösterir.")}
                  </p>
                </div>
              </div>

              <div className="reports-metric-grid">
                {aiImpactHighlights.map((item) => (
                  <MetricTile key={item.title} label={item.title} value={item.value} info={item.info} />
                ))}
              </div>
            </section>

            <section className="panel reports-panel">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("AI kalibrasyonu")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("AI önerileri ile recruiter kararlarının ne kadar hizalı olduğunu görün.")}
                  </p>
                </div>
              </div>

              <div className="reports-metric-grid">
                {calibrationHighlights.map((item) => (
                  <MetricTile key={item.title} label={item.title} value={item.value} info={item.info} />
                ))}
              </div>

              <ul className="plain-list" style={{ marginTop: 12 }}>
                <DetailRow
                  label={t("AI önerisi olan dosya")}
                  value={formatMetricNumber(locale, data.ai.calibration.recommendedCount, 0)}
                  info={t("AI recommendation üretilmiş başvuru sayısı.")}
                />
                <DetailRow
                  label={t("İnsan kararı kaydı olan")}
                  value={formatMetricNumber(locale, data.ai.calibration.humanReviewedCount, 0)}
                  info={t(data.definitions.humanDecisionCoverage)}
                />
                <DetailRow
                  label={t("Karşılaştırılabilir karar")}
                  value={formatMetricNumber(locale, data.ai.calibration.comparableDecisionCount, 0)}
                  info={t("AI'nin ADVANCE veya HOLD önerdiği ve insan kararının da kaydedildiği dosyalar.")}
                />
                <DetailRow
                  label={t("Hold kabul oranı")}
                  value={formatPercentLabel(locale, data.ai.calibration.holdAcceptanceRate, 0)}
                  info={t("AI'nin HOLD önerdiği ve insan kararının kaydedildiği dosyalarda bekletme kararı verilme oranı.")}
                />
              </ul>
            </section>

            <section className="panel reports-panel">
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Mülakat operasyonu")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("Mülakat akışının hacmini ve verimini izleyin.")}
                  </p>
                </div>
              </div>

              {data.interviews.total === 0 ? (
                <EmptyState message={t("Henüz mülakat verisi bulunmuyor.")} />
              ) : (
                <ul className="plain-list">
                  <DetailRow
                    label={t("Toplam oturum")}
                    value={formatMetricNumber(locale, data.interviews.total, 0)}
                    info={t("Planlanan, devam eden, tamamlanan veya sonuçlanmayan tüm mülakat oturumları.")}
                  />
                  <DetailRow
                    label={t("Tamamlanan oturum")}
                    value={formatMetricNumber(locale, data.interviews.completed, 0)}
                    info={t("Adayın görüşmeyi başarıyla tamamladığı oturum sayısı.")}
                  />
                  <DetailRow
                    label={t("Tamamlanma oranı")}
                    value={formatPercentLabel(locale, data.interviews.completionRate, 0)}
                    info={t("Tamamlanan oturumların tüm mülakat oturumlarına oranı.")}
                  />
                  <DetailRow
                    label={t("Ortalama görüşme süresi")}
                    value={formatMinuteLabel(locale, data.interviews.avgDurationMinutes)}
                    info={t("Tamamlanan oturumların ortalama süresi.")}
                  />
                  <DetailRow
                    label={t("Medyan görüşme süresi")}
                    value={formatMinuteLabel(locale, data.interviews.medianDurationMinutes)}
                    info={t("Tamamlanan oturumlarda ortadaki süreyi gösterir; uç değerlerden daha az etkilenir.")}
                  />
                  <DetailRow
                    label={t("No-show oranı")}
                    value={formatPercentLabel(locale, data.interviews.noShowRate, 0)}
                    info={t("Adayın katılmadığı oturumların toplam oturumlara oranı.")}
                  />
                  <DetailRow
                    label={t("AI ile planlanan oturum oranı")}
                    value={formatPercentLabel(locale, data.interviews.aiSchedulingRate, 0)}
                    info={t("Sistem veya otomasyon desteğiyle planlanan oturumların oranı.")}
                  />
                </ul>
              )}
            </section>

            <section className="panel reports-panel">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Süreç hızı")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("Sistemin doğrudan etkilediği hız metriklerini görün.")}
                  </p>
                </div>
              </div>

              <ul className="plain-list">
                <DetailRow
                  label={t("Ön değerlendirme dönüş süresi")}
                  value={formatMinuteLabel(locale, data.pipeline.velocity.averageScreeningTurnaroundMinutes)}
                  info={t("Başvuru tarihi ile ilk AI screening veya fit score çıkışı arasındaki ortalama süre.")}
                />
                <DetailRow
                  label={t("İlk mülakata geçiş süresi")}
                  value={formatDayLabel(locale, data.pipeline.velocity.averageTimeToInterviewDays)}
                  info={t("Başvuru tarihi ile ilk mülakat planlama tarihi arasındaki ortalama fark.")}
                />
              </ul>
            </section>
          </div>

          <div className="mini-grid">
            <section className="panel">
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Aşama dağılımı")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("Pipeline'da hangi aşamada ne kadar aday olduğunu gösterir.")}
                  </p>
                </div>
              </div>

              {data.pipeline.funnel.length === 0 ? (
                <EmptyState message={t("Henüz yeterli veri bulunmuyor.")} />
              ) : (
                <ul className="plain-list">
                  {data.pipeline.funnel.map((item) => (
                    <li key={item.stage} className="list-row">
                      <StageChip stage={item.stage} />
                      <strong>{formatMetricNumber(locale, item.count, 0)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>{t("Dönüşüm ve AI kapsamı")}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {t("Operasyonel dönüşüm oranlarını ve AI çıktı kalitesini birlikte izleyin.")}
                  </p>
                </div>
              </div>

              <ul className="plain-list">
                <DetailRow
                  label={t("Ön eleme oranı")}
                  value={formatPercentLabel(locale, data.pipeline.conversion.shortlistRate, 0)}
                  info={t("Başvuruların kısa liste veya ön eleme aşamasına taşınma oranı.")}
                />
                <DetailRow
                  label={t("Mülakata geçiş oranı")}
                  value={formatPercentLabel(locale, data.pipeline.conversion.interviewRate, 0)}
                  info={t("Başvuruların mülakat aşamasına taşınma oranı.")}
                />
                <DetailRow
                  label={t("Teklif / ileri aşama oranı")}
                  value={formatPercentLabel(locale, data.pipeline.conversion.offerRate, 0)}
                  info={t("Başvuruların teklif veya daha ileri aşamalara taşınma oranı.")}
                />
                <DetailRow
                  label={t("AI ön değerlendirme kapsaması")}
                  value={formatPercentLabel(locale, data.ai.screeningCoverageRate, 0)}
                  info={`${formatMetricNumber(locale, data.ai.screeningCoverageCount, 0)} ${t("başvuruda AI sinyali var.")}`}
                />
                <DetailRow
                  label={t("Fit score ortalaması")}
                  value={
                    data.ai.fitScoreAverage === null
                      ? "-"
                      : `${formatMetricNumber(locale, data.ai.fitScoreAverage, 1)} / 100`
                  }
                  info={
                    data.ai.fitScoreConfidenceAverage === null
                      ? t("Güven verisi henüz oluşmadı.")
                      : `${t("Güven ortalaması")} ${formatPercent(data.ai.fitScoreConfidenceAverage, 0)}`
                  }
                />
                <DetailRow
                  label={t("AI rapor güveni")}
                  value={formatPercent(data.ai.reportConfidenceAverage, 0)}
                  info={t(data.definitions.reportConfidence)}
                />
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
