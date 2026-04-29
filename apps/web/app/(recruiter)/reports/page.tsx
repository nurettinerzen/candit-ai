"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InfoHint } from "../../../components/page-guide";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { formatPercent } from "../../../lib/format";
import type { AnalyticsSummary } from "../../../lib/types";
import s from "./analytics.module.css";

/* ─ Helpers ─────────────────────────────────────────────── */
function resolveLocaleTag(locale: string) {
  return locale === "en" ? "en-US" : "tr-TR";
}

function fmt(locale: string, value: number | null | undefined, dec = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(resolveLocaleTag(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(value) ? 0 : dec
  }).format(value);
}

function fmtPct(locale: string, value: number | null | undefined, dec = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${fmt(locale, value, dec)}%`;
}

function fmtHour(locale: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${fmt(locale, value)} ${locale === "en" ? "hr" : "saat"}`;
}

function fmtMin(locale: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${fmt(locale, value)} ${locale === "en" ? "min" : "dk"}`;
}

function fmtDay(locale: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${fmt(locale, value)} ${locale === "en" ? "days" : "gün"}`;
}

/* ─ SVG Sparkline (decorative wave) ─────────────────────── */
const SPARK_WAVES = [
  "M0,28 C8,24 14,30 22,18 C30,8 36,22 44,14 C52,6 58,20 66,10 C74,4 80,16 88,8 C94,4 98,10 100,6",
  "M0,26 C6,22 12,30 20,20 C28,12 34,26 42,16 C50,8 56,22 64,12 C72,4 78,18 88,10 C94,6 98,14 100,8",
  "M0,30 C10,26 18,32 28,16 C38,6 46,24 54,14 C62,6 70,20 80,10 C88,4 94,12 100,7",
  "M0,25 C8,20 16,28 24,16 C32,6 40,22 50,12 C58,4 66,18 76,8 C84,2 92,14 100,7",
];

function Sparkline({ index, color }: { index: number; color: string }) {
  const id = `spark-${index}`;
  const path = SPARK_WAVES[index] ?? SPARK_WAVES[0];
  return (
    <svg className={s.kpiSparkline} viewBox="0 0 100 34" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L100,34 L0,34 Z`}
        fill={`url(#${id})`}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─ SVG Donut Chart ─────────────────────────────────────── */
function DonutChart({
  segments,
}: {
  segments: { value: number; color: string; label: string }[];
}) {
  const R = 56;
  const C = 2 * Math.PI * R; // ≈ 351.9
  const total = segments.reduce((a, b) => a + b.value, 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * C;
    const arc = { ...seg, dash, offset, pct };
    offset += dash;
    return arc;
  });

  return (
    <svg className={s.donutSvg} viewBox="0 0 140 140">
      {/* track */}
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
      {/* segments */}
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx="70" cy="70" r={R}
          fill="none"
          stroke={arc.color}
          strokeWidth="14"
          strokeDasharray={`${arc.dash} ${C - arc.dash}`}
          strokeDashoffset={-arc.offset}
          strokeLinecap="butt"
          style={{ filter: `drop-shadow(0 0 6px ${arc.color}70)` }}
        />
      ))}
    </svg>
  );
}

/* ─ Stage name map ───────────────────────────────────────── */
const STAGE_NAME_TR: Record<string, string> = {
  APPLIED: "Başvurdu",
  TALENT_POOL: "Aday Havuzu",
  SCREENING: "Ön Eleme",
  RECRUITER_REVIEW: "Recruiter İnceleme",
  INTERVIEW_SCHEDULED: "Mülakat Planlandı",
  INTERVIEW_COMPLETED: "Mülakat Tamamlandı",
  OFFER: "Teklif",
  HIRED: "İşe Alındı",
  REJECTED: "Reddedildi",
  SHORTLISTED: "Kısa Liste",
  HOLD: "Bekleme",
  REVIEW: "İnceleme",
};
const STAGE_NAME_EN: Record<string, string> = {
  APPLIED: "Applied",
  TALENT_POOL: "Talent Pool",
  SCREENING: "Screening",
  RECRUITER_REVIEW: "Recruiter Review",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Done",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
  SHORTLISTED: "Shortlisted",
  HOLD: "On Hold",
  REVIEW: "In Review",
};

/* ─ KPI card icons ───────────────────────────────────────── */
const ICON_BRIEFCASE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const ICON_USERS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const ICON_MIC = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const ICON_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

/* ─ Funnel bar gradient classes ──────────────────────────── */
const FUNNEL_FILL_CLASSES = [
  s.funnelFill0, s.funnelFill1, s.funnelFill2,
  s.funnelFill3, s.funnelFill4, s.funnelFill5, s.funnelFill6
];
const DONUT_COLORS = ["#22d3ee", "#8b5cf6", "#f59e0b", "#10b981"];

/* ─ Inline detail row ────────────────────────────────────── */
function DRow({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <li className={s.detailRow}>
      <span className={s.detailLabel}>
        {label}
        {info ? <InfoHint label={label} content={info} /> : null}
      </span>
      <strong className={s.detailValue}>{value}</strong>
    </li>
  );
}

/* ═══ Main Page Component ════════════════════════════════ */
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Rapor verileri yüklenemedi."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  /* funnel data sorted by descending count, exclude zero/rejected for visual */
  const funnelRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.pipeline.funnel].sort((a, b) => b.count - a.count);
    const maxCount = rows[0]?.count ?? 1;
    return rows.map((r) => ({
      ...r,
      pct: maxCount > 0 ? (r.count / maxCount) * 100 : 0,
      name: locale === "en"
        ? (STAGE_NAME_EN[r.stage] ?? r.stage)
        : (STAGE_NAME_TR[r.stage] ?? r.stage),
    }));
  }, [data, locale]);

  /* donut segments for time saved */
  const donutSegments = useMemo(() => {
    if (!data) return [];
    const { screening, interviewAnalysis, scheduling } = data.ai.estimatedTimeSavedHours;
    return [
      { value: screening,         color: DONUT_COLORS[0]!, label: t("Screening") },
      { value: interviewAnalysis, color: DONUT_COLORS[1]!, label: t("Mülakat Analizi") },
      { value: scheduling,        color: DONUT_COLORS[2]!, label: t("Planlama") },
    ].filter((s) => s.value > 0);
  }, [data, t]);

  /* conversion rows */
  const conversionRows = useMemo(() => {
    if (!data) return [];
    const c = data.pipeline.conversion;
    return [
      { label: t("Ön eleme oranı"),       value: c.shortlistRate },
      { label: t("Mülakata geçiş oranı"), value: c.interviewRate },
      { label: t("Teklif oranı"),         value: c.offerRate },
      { label: t("İşe alım oranı"),       value: c.hireRate },
      { label: t("AI kapsam oranı"),      value: data.ai.screeningCoverageRate },
    ];
  }, [data, t]);

  return (
    <div className={s.analyticsPage}>
      {/* ─ Header ─────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>{t("Analytics")}</h1>
          <p className={s.pageSubtitle}>
            {t("İK ekibinin günlük operasyonu ve üst yönetim raporlaması için kritik KPI'lar")}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadReports()}>
          {t("Yenile")}
        </button>
      </div>

      {loading ? (
        <section className="panel"><LoadingState message={t("Raporlar yükleniyor...")} /></section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState error={error} actions={
            <button type="button" className="ghost-button" onClick={() => void loadReports()}>
              {t("Tekrar dene")}
            </button>
          } />
        </section>
      ) : null}

      {!loading && !error && data ? (
        <>
          {/* ─ KPI Row ──────────────────────────────── */}
          <div className={s.kpiRow}>
            <article className={s.kpiCard}>
              <div className={s.kpiBadge}>{ICON_BRIEFCASE}</div>
              <p className={s.kpiLabel}>{t("Aktif İlanlar")}</p>
              <p className={s.kpiValue}>{fmt(locale, data.overview.publishedJobs, 0)}</p>
              <Sparkline index={0} color="#22d3ee" />
            </article>

            <article className={s.kpiCard}>
              <div className={s.kpiBadge}>{ICON_USERS}</div>
              <p className={s.kpiLabel}>{t("Toplam Başvuru")}</p>
              <p className={s.kpiValue}>{fmt(locale, data.overview.totalApplications, 0)}</p>
              <Sparkline index={1} color="#8b5cf6" />
            </article>

            <article className={s.kpiCard}>
              <div className={s.kpiBadge}>{ICON_MIC}</div>
              <p className={s.kpiLabel}>{t("Mülakat Yapılan")}</p>
              <p className={s.kpiValue}>{fmt(locale, data.overview.interviewedApplications, 0)}</p>
              <Sparkline index={2} color="#10b981" />
            </article>

            <article className={s.kpiCard}>
              <div className={s.kpiBadge}>{ICON_CLOCK}</div>
              <p className={s.kpiLabel}>{t("Tahmini Zaman Kazancı")}</p>
              <p className={s.kpiValue}>{fmtHour(locale, data.ai.estimatedTimeSavedHours.total)}</p>
              <Sparkline index={3} color="#f59e0b" />
            </article>
          </div>

          {/* ─ Charts Row ───────────────────────────── */}
          <div className={s.chartsRow}>
            {/* Pipeline Funnel */}
            <div className={s.chartPanel}>
              <div className={s.chartPanelHeader}>
                <div>
                  <h3 className={s.chartTitle}>{t("Aşama Dağılımı")}</h3>
                  <p className={s.chartSubtitle}>{t("Pipeline'da hangi aşamada ne kadar aday var")}</p>
                </div>
              </div>

              {funnelRows.length === 0 ? (
                <EmptyState message={t("Henüz yeterli veri bulunmuyor.")} />
              ) : (
                <ul className={s.funnelList}>
                  {funnelRows.map((row, i) => (
                    <li key={row.stage} className={s.funnelRow}>
                      <span className={s.funnelLabel}>{row.name}</span>
                      <div className={s.funnelBarTrack}>
                        <div
                          className={`${s.funnelBarFill} ${FUNNEL_FILL_CLASSES[i % FUNNEL_FILL_CLASSES.length]}`}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className={s.funnelCount}>{fmt(locale, row.count, 0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* AI Impact Donut */}
            <div className={s.donutPanel}>
              <div>
                <h3 className={s.chartTitle}>{t("AI Zaman Kazancı")}</h3>
                <p className={s.chartSubtitle}>{t("AI'nin hangi alanda ne kadar zaman kurtardığı")}</p>
              </div>

              {donutSegments.length === 0 ? (
                <div style={{ marginTop: 16 }}>
                  <EmptyState message={t("Henüz AI kazanım verisi yok.")} />
                </div>
              ) : (
                <>
                  <div className={s.donutWrap}>
                    <DonutChart segments={donutSegments} />
                    <div className={s.donutCenter}>
                      <span className={s.donutCenterValue}>
                        {fmt(locale, data.ai.estimatedTimeSavedHours.total)}
                      </span>
                      <span className={s.donutCenterLabel}>{locale === "en" ? "hr saved" : "saat"}</span>
                    </div>
                  </div>

                  <div className={s.donutLegend}>
                    {donutSegments.map((seg) => (
                      <div key={seg.label} className={s.donutLegendRow}>
                        <div className={s.donutLegendLeft}>
                          <div className={s.donutDot} style={{ background: seg.color }} />
                          <span className={s.donutLegendLabel}>{seg.label}</span>
                        </div>
                        <span className={s.donutLegendValue}>{fmtHour(locale, seg.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* AI calibration mini stats */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className={s.metricTileGrid}>
                  <div className={s.metricTile}>
                    <span className={s.metricTileValue} style={{ color: "#22d3ee" }}>
                      {fmtPct(locale, data.ai.screeningCoverageRate)}
                    </span>
                    <span className={s.metricTileLabel}>{t("AI kapsam")}</span>
                  </div>
                  <div className={s.metricTile}>
                    <span className={s.metricTileValue} style={{ color: "#8b5cf6" }}>
                      {data.ai.fitScoreAverage != null
                        ? `${fmt(locale, data.ai.fitScoreAverage, 1)}`
                        : "—"}
                    </span>
                    <span className={s.metricTileLabel}>{t("Fit score ort.")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─ Metrics Row ──────────────────────────── */}
          <div className={s.metricsRow}>
            {/* Yönetici Özeti */}
            <div className={s.metricPanel}>
              <div>
                <p className={s.metricPanelTitle}>{t("Yönetici Özeti")}</p>
                <p className={s.metricPanelSubtitle}>{t("Yönetime sunulacak temel sinyaller")}</p>
              </div>
              <div className={s.metricTileGrid}>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#22d3ee" }}>
                    {fmtPct(locale, data.ai.screeningCoverageRate)}
                  </span>
                  <span className={s.metricTileLabel}>{t("Ön değerlendirme hazır")}</span>
                </div>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#8b5cf6" }}>
                    {fmtDay(locale, data.pipeline.velocity.averageTimeToInterviewDays)}
                  </span>
                  <span className={s.metricTileLabel}>{t("İlk mülakata geçiş")}</span>
                </div>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#10b981" }}>
                    {fmtPct(locale, data.interviews.completionRate)}
                  </span>
                  <span className={s.metricTileLabel}>{t("Mülakat tamamlanma")}</span>
                </div>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#f59e0b" }}>
                    {data.ai.aiTaskSuccessRate != null
                      ? fmtPct(locale, data.ai.aiTaskSuccessRate)
                      : "—"}
                  </span>
                  <span className={s.metricTileLabel}>{t("AI görev başarısı")}</span>
                </div>
              </div>
            </div>

            {/* Mülakat Operasyonu */}
            <div className={s.metricPanel}>
              <div>
                <p className={s.metricPanelTitle}>{t("Mülakat Operasyonu")}</p>
                <p className={s.metricPanelSubtitle}>{t("Mülakat akışının hacmi ve verimi")}</p>
              </div>
              {data.interviews.total === 0 ? (
                <EmptyState message={t("Henüz mülakat verisi bulunmuyor.")} />
              ) : (
                <ul className={s.detailList}>
                  <DRow label={t("Toplam oturum")}      value={fmt(locale, data.interviews.total, 0)} />
                  <DRow label={t("Tamamlanan")}         value={fmt(locale, data.interviews.completed, 0)} />
                  <DRow label={t("Tamamlanma oranı")}   value={fmtPct(locale, data.interviews.completionRate)} />
                  <DRow label={t("Ort. süre")}          value={fmtMin(locale, data.interviews.avgDurationMinutes)} />
                  <DRow label={t("No-show oranı")}      value={fmtPct(locale, data.interviews.noShowRate)} />
                  <DRow label={t("AI planlama oranı")}  value={fmtPct(locale, data.interviews.aiSchedulingRate)} />
                </ul>
              )}
            </div>

            {/* AI Kalibrasyonu */}
            <div className={s.metricPanel}>
              <div>
                <p className={s.metricPanelTitle}>{t("AI Kalibrasyonu")}</p>
                <p className={s.metricPanelSubtitle}>{t("AI önerileri ile recruiter kararlarının hizalanması")}</p>
              </div>
              <div className={s.metricTileGrid}>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#22d3ee" }}>
                    {fmtPct(locale, data.ai.calibration.humanDecisionCoverageRate)}
                  </span>
                  <span className={s.metricTileLabel}>{t("İnsan kararı kapsamı")}</span>
                </div>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#10b981" }}>
                    {fmtPct(locale, data.ai.calibration.agreementRate)}
                  </span>
                  <span className={s.metricTileLabel}>{t("AI yön uyumu")}</span>
                </div>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#8b5cf6" }}>
                    {fmtPct(locale, data.ai.calibration.advanceAcceptanceRate)}
                  </span>
                  <span className={s.metricTileLabel}>{t("Advance kabul")}</span>
                </div>
                <div className={s.metricTile}>
                  <span className={s.metricTileValue} style={{ color: "#f59e0b" }}>
                    {fmt(locale, data.ai.calibration.recommendedCount, 0)}
                  </span>
                  <span className={s.metricTileLabel}>{t("AI önerisi olan")}</span>
                </div>
              </div>
              <ul className={s.detailList} style={{ marginTop: 2 }}>
                <DRow label={t("İnsan kararı kaydı")}    value={fmt(locale, data.ai.calibration.humanReviewedCount, 0)} />
                <DRow label={t("Karşılaştırılabilir")}   value={fmt(locale, data.ai.calibration.comparableDecisionCount, 0)} />
                <DRow label={t("Hold kabul oranı")}      value={fmtPct(locale, data.ai.calibration.holdAcceptanceRate)} />
                <DRow label={t("Review çözümleme")}      value={fmtPct(locale, data.ai.calibration.resolvedReviewRecommendationRate)} />
              </ul>
            </div>
          </div>

          {/* ─ Bottom Row ───────────────────────────── */}
          <div className={s.bottomRow}>
            {/* Dönüşüm Oranları */}
            <div className={s.metricPanel}>
              <div>
                <p className={s.metricPanelTitle}>{t("Dönüşüm ve AI Kapsamı")}</p>
                <p className={s.metricPanelSubtitle}>{t("Operasyonel dönüşüm oranları")}</p>
              </div>
              <div className={s.conversionList}>
                {conversionRows.map((row) => (
                  <div key={row.label} className={s.conversionRow}>
                    <span className={s.conversionLabel}>{row.label}</span>
                    <div className={s.conversionTrack}>
                      <div
                        className={s.conversionFill}
                        style={{ width: `${Math.min(row.value ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className={s.conversionValue}>{fmtPct(locale, row.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Süreç Hızı */}
            <div className={s.metricPanel}>
              <div>
                <p className={s.metricPanelTitle}>{t("Süreç Hızı")}</p>
                <p className={s.metricPanelSubtitle}>{t("Sistemin doğrudan etkilediği hız metrikleri")}</p>
              </div>
              <div className={s.velocityGrid}>
                <div className={s.velocityCard}>
                  <div className={s.velocityIcon} style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <span className={s.velocityValue} style={{ color: "#22d3ee" }}>
                    {fmtMin(locale, data.pipeline.velocity.averageScreeningTurnaroundMinutes)}
                  </span>
                  <span className={s.velocityLabel}>{t("Ön değerlendirme dönüş")}</span>
                </div>

                <div className={s.velocityCard}>
                  <div className={s.velocityIcon} style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <span className={s.velocityValue} style={{ color: "#8b5cf6" }}>
                    {fmtDay(locale, data.pipeline.velocity.averageTimeToInterviewDays)}
                  </span>
                  <span className={s.velocityLabel}>{t("İlk mülakata geçiş")}</span>
                </div>

                <div className={s.velocityCard}>
                  <div className={s.velocityIcon} style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <span className={s.velocityValue} style={{ color: "#34d399" }}>
                    {fmtPct(locale, data.interviews.completionRate)}
                  </span>
                  <span className={s.velocityLabel}>{t("Mülakat tamamlanma")}</span>
                </div>

                <div className={s.velocityCard}>
                  <div className={s.velocityIcon} style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  </div>
                  <span className={s.velocityValue} style={{ color: "#fbbf24" }}>
                    {data.ai.reportCount > 0
                      ? `${fmt(locale, data.ai.reportCount, 0)}`
                      : "—"}
                  </span>
                  <span className={s.velocityLabel}>{t("AI rapor sayısı")}</span>
                </div>
              </div>

              {/* AI report confidence */}
              <ul className={s.detailList} style={{ marginTop: 8 }}>
                <DRow
                  label={t("AI rapor güveni")}
                  value={formatPercent(data.ai.reportConfidenceAverage, 0)}
                  info={t(data.definitions.reportConfidence)}
                />
                <DRow
                  label={t("Fit score güveni")}
                  value={data.ai.fitScoreConfidenceAverage != null
                    ? fmtPct(locale, data.ai.fitScoreConfidenceAverage)
                    : "—"}
                />
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
