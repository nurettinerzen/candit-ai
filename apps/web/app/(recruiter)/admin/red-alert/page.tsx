"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../../components/ui-states";
import { useUiText } from "../../../../components/site-language-provider";
import { apiClient } from "../../../../lib/api-client";
import { formatDate } from "../../../../lib/format";
import {
  formatAlertCategory,
  formatAlertSeverity,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../lib/internal-admin-copy";
import type { InternalAdminAlertCategory, InternalAdminRedAlertReadModel } from "../../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const CATEGORY_ORDER: InternalAdminAlertCategory[] = [
  "APPLICATION",
  "SECURITY",
  "ASSISTANT",
  "OPERATIONS"
];

const CATEGORY_TONE: Record<InternalAdminAlertCategory, string> = {
  APPLICATION: "warning",
  SECURITY: "danger",
  ASSISTANT: "info",
  OPERATIONS: "muted"
};

function getCategoryDescription(key: InternalAdminAlertCategory, locale: string): string {
  const descriptions: Record<InternalAdminAlertCategory, { en: string; tr: string }> = {
    APPLICATION: {
      en: "Webhook, delivery, and application-originated issues.",
      tr: "Webhook, teslimat ve uygulama kaynaklı sorunlar."
    },
    SECURITY: {
      en: "Session security and suspicious access signals.",
      tr: "Oturum güvenliği ve şüpheli erişim sinyalleri."
    },
    ASSISTANT: {
      en: "AI task failures and quality degradation.",
      tr: "AI görev hataları ve kalite düşüşü."
    },
    OPERATIONS: {
      en: "Billing, integrations, and operational anomalies.",
      tr: "Abonelik, entegrasyon ve operasyon sapmaları."
    }
  };
  return locale === "en" ? descriptions[key].en : descriptions[key].tr;
}

export default function InternalAdminRedAlertPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminRedAlertReadModel | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [category, setCategory] = useState<"ALL" | InternalAdminAlertCategory>("ALL");
  const [severity, setSeverity] = useState<"ALL" | "critical" | "warning">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiClient.internalAdminRedAlert({
        windowDays,
        category,
        severity
      });
      setData(result);
    } catch (loadError) {
      setData(null);
      setError(translateInternalAdminMessage(toErrorMessage(loadError, copy.internalOnly), locale));
    } finally {
      setLoading(false);
    }
  }, [category, copy.internalOnly, locale, severity, windowDays]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  /* ---- derive stat-card counts from summary keyed by category ---- */
  const summaryMap = new Map(
    (data?.summary ?? []).map((s) => [s.key, s.count])
  );

  return (
    <section className="page-grid">
      {/* ===== HEADER: title + time-range select + refresh ===== */}
      <div className="page-header">
        <div className="page-header-copy">
          <h1>{copy.redAlertTitle}</h1>
          <p>{copy.redAlertSubtitle}</p>
        </div>
        <div className="page-header-actions">
          <select
            className="select"
            value={String(windowDays)}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            <option value="1">{locale === "en" ? "Last 24 Hours" : "Son 24 Saat"}</option>
            <option value="7">{locale === "en" ? "Last 7 Days" : "Son 7 Gün"}</option>
            <option value="30">{locale === "en" ? "Last 30 Days" : "Son 30 Gün"}</option>
          </select>
        </div>
      </div>

      {/* ===== FILTER BAR: category + severity side-by-side ===== */}
      <section className="panel">
        <div className="admin-filter-row">
          <select
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as "ALL" | InternalAdminAlertCategory)}
          >
            <option value="ALL">{copy.allCategories}</option>
            <option value="APPLICATION">{formatAlertCategory("APPLICATION", locale)}</option>
            <option value="SECURITY">{formatAlertCategory("SECURITY", locale)}</option>
            <option value="ASSISTANT">{formatAlertCategory("ASSISTANT", locale)}</option>
            <option value="OPERATIONS">{formatAlertCategory("OPERATIONS", locale)}</option>
          </select>
          <select
            className="select"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "ALL" | "critical" | "warning")}
          >
            <option value="ALL">{copy.allSeverities}</option>
            <option value="critical">{formatAlertSeverity("critical", locale)}</option>
            <option value="warning">{formatAlertSeverity("warning", locale)}</option>
          </select>
        </div>
      </section>

      {/* ===== CONTENT AREA: loading / error / empty / data ===== */}
      {loading ? (
        <section className="panel">
          <LoadingState message={copy.loading} />
        </section>
      ) : error && !data ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPage()}>
                {copy.retry}
              </button>
            }
          />
        </section>
      ) : !data ? (
        <section className="panel">
          <EmptyState message={copy.noData} />
        </section>
      ) : (
        <>
          {/* ===== STAT CARDS (4): fixed order, colored left border ===== */}
          <section className="admin-metric-grid">
            {CATEGORY_ORDER.map((key) => (
              <article key={key} className={`admin-metric-card tone-${CATEGORY_TONE[key]}`}>
                <span className="admin-metric-label">{formatAlertCategory(key, locale)}</span>
                <strong className="admin-metric-value">{summaryMap.get(key) ?? 0}</strong>
                <p className="admin-metric-copy">{getCategoryDescription(key, locale)}</p>
              </article>
            ))}
          </section>

          {/* ===== DATA TABLE: full-width, scrollable ===== */}
          <section className="panel">
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{copy.lastSeen}</th>
                    <th>{copy.customer}</th>
                    <th>{copy.category}</th>
                    <th>{copy.severity}</th>
                    <th>{copy.source}</th>
                    <th>{copy.message}</th>
                    <th>{copy.repeats}</th>
                    <th>{copy.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState message={copy.noAlerts} />
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.lastSeenAt)}</td>
                        <td>
                          <div className="admin-table-cell-stack">
                            <strong>{item.tenantName}</strong>
                          </div>
                        </td>
                        <td>{formatAlertCategory(item.category, locale)}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              item.severity === "critical" ? "status-danger" : "status-warning"
                            }`}
                          >
                            {formatAlertSeverity(item.severity, locale)}
                          </span>
                        </td>
                        <td>{item.source}</td>
                        <td>
                          <div className="admin-table-cell-stack">
                            {translateInternalAdminMessage(item.message, locale)}
                          </div>
                        </td>
                        <td>{item.repeats}</td>
                        <td>
                          <span className="status-badge status-danger">
                            {locale === "en" ? "Open" : "Açık"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
