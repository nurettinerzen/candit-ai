"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../../components/ui-states";
import { useUiText } from "../../../../components/site-language-provider";
import { apiClient } from "../../../../lib/api-client";
import { formatDate } from "../../../../lib/format";
import {
  formatGenericDeliveryStatus,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../lib/internal-admin-copy";
import type {
  InternalAdminPublicLeadListReadModel,
  InternalAdminPublicLeadStatus
} from "../../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function leadStatusTone(status: InternalAdminPublicLeadStatus) {
  switch (status) {
    case "NEW":
      return "warning";
    case "REVIEWING":
      return "info";
    case "CONTACTED":
      return "success";
    case "ARCHIVED":
      return "muted";
  }
}

function formatLeadStatus(status: InternalAdminPublicLeadStatus, locale: string) {
  if (locale === "en") {
    switch (status) {
      case "NEW":
        return "New";
      case "REVIEWING":
        return "Reviewing";
      case "CONTACTED":
        return "Contacted";
      case "ARCHIVED":
        return "Archived";
    }
  }

  switch (status) {
    case "NEW":
      return "Yeni";
    case "REVIEWING":
      return "İnceleniyor";
    case "CONTACTED":
      return "İletişime Geçildi";
    case "ARCHIVED":
      return "Arşivlendi";
  }
}

function clipText(value: string | null, max = 180) {
  if (!value) {
    return "—";
  }

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}...`;
}

const STATUS_OPTIONS: Array<"ALL" | InternalAdminPublicLeadStatus> = [
  "ALL",
  "NEW",
  "REVIEWING",
  "CONTACTED",
  "ARCHIVED"
];

export default function InternalAdminLeadsPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminPublicLeadListReadModel | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | InternalAdminPublicLeadStatus>("ALL");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, InternalAdminPublicLeadStatus>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyLeadId, setBusyLeadId] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiClient.internalAdminPublicLeads({
        query: query || undefined,
        status
      });
      setData(result);
    } catch (loadError) {
      setData(null);
      setError(translateInternalAdminMessage(toErrorMessage(loadError, copy.internalOnly), locale));
    } finally {
      setLoading(false);
    }
  }, [copy.internalOnly, locale, query, status]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const metrics = useMemo(
    () =>
      data
        ? [
            {
              label: locale === "en" ? "Total Leads" : "Toplam Lead",
              value: data.summary.total,
              tone: "primary"
            },
            {
              label: locale === "en" ? "New" : "Yeni",
              value: data.summary.new,
              tone: "warning"
            },
            {
              label: locale === "en" ? "Reviewing" : "İnceleniyor",
              value: data.summary.reviewing,
              tone: "info"
            },
            {
              label: locale === "en" ? "Contacted" : "İletişime Geçildi",
              value: data.summary.contacted,
              tone: "success"
            }
          ]
        : [],
    [data, locale]
  );

  async function handleStatusSave(leadId: string) {
    const nextStatus = statusDrafts[leadId];

    if (!nextStatus) {
      return;
    }

    setBusyLeadId(leadId);
    setError("");
    setSuccess("");

    try {
      await apiClient.internalAdminUpdatePublicLeadStatus(leadId, {
        status: nextStatus
      });
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[leadId];
        return next;
      });
      setSuccess(copy.leadStatusSaved);
      await loadPage();
    } catch (actionError) {
      setError(translateInternalAdminMessage(toErrorMessage(actionError, copy.internalOnly), locale));
    } finally {
      setBusyLeadId("");
    }
  }

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide guideKey="adminLeads" title={copy.leadsTitle} />
          <p>{copy.leadsSubtitle}</p>
        </div>
      </div>

      <section className="panel">
        <div className="admin-filter-row">
          <input
            className="input"
            placeholder={copy.searchLeadsPlaceholder}
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
          />
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | InternalAdminPublicLeadStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? copy.allStatuses : formatLeadStatus(option, locale)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => setQuery(queryInput.trim())}
          >
            {copy.search}
          </button>
        </div>
      </section>

      {success ? (
        <section className="panel" style={{ padding: "12px 16px" }}>
          <div className="status-badge status-success">{success}</div>
        </section>
      ) : null}

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
          <section className="admin-metric-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className={`admin-metric-card tone-${metric.tone}`}>
                <span className="admin-metric-label">{metric.label}</span>
                <strong className="admin-metric-value">{metric.value}</strong>
              </article>
            ))}
          </section>

          {error ? (
            <section className="panel" style={{ padding: "12px 16px" }}>
              <ErrorState error={error} />
            </section>
          ) : null}

          <section className="panel">
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{locale === "en" ? "Submitted" : "Gönderim"}</th>
                    <th>{locale === "en" ? "Lead" : "Lead"}</th>
                    <th>{copy.source}</th>
                    <th>{copy.message}</th>
                    <th>{locale === "en" ? "Ops Delivery" : "Ops Teslimatı"}</th>
                    <th>{copy.status}</th>
                    <th>{copy.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState message={copy.noLeads} />
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row) => {
                      const selectedStatus = statusDrafts[row.id] ?? row.status;
                      const opsStatus =
                        row.opsNotificationStatus !== null
                          ? formatGenericDeliveryStatus(row.opsNotificationStatus, locale)
                          : locale === "en"
                            ? "Not sent"
                            : "Gönderilmedi";

                      return (
                        <tr key={row.id}>
                          <td>
                            <div className="admin-table-cell-stack">
                              <strong>{formatDate(row.lastSubmittedAt)}</strong>
                              <span className="small text-muted">
                                {locale === "en" ? "First seen" : "İlk kayıt"}: {formatDate(row.createdAt)}
                              </span>
                              <span className="small text-muted">
                                {locale === "en" ? "Count" : "Adet"}: {row.submissionCount}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-table-cell-stack">
                              <strong>{row.fullName}</strong>
                              <span>{row.email}</span>
                              <span className="small text-muted">
                                {[row.company, row.role].filter(Boolean).join(" • ") || "—"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-table-cell-stack">
                              <strong>{row.sourcePage ?? "contact"}</strong>
                              <span className="small text-muted">{row.utmCampaign ?? row.utmSource ?? "—"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-table-cell-stack">
                              <strong>{clipText(row.message, 120)}</strong>
                              <span className="small text-muted">{clipText(row.landingUrl, 80)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-table-cell-stack">
                              <span
                                className={`status-badge status-${
                                  row.opsNotificationStatus === "FAILED"
                                    ? "danger"
                                    : row.opsNotificationStatus === "SENT"
                                      ? "success"
                                      : "muted"
                                }`}
                              >
                                {opsStatus}
                              </span>
                              <span className="small text-muted">{row.opsNotificationProvider ?? "—"}</span>
                              <span className="small text-muted">
                                {row.opsNotificationError
                                  ? translateInternalAdminMessage(row.opsNotificationError, locale)
                                  : "—"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-${leadStatusTone(row.status)}`}>
                              {formatLeadStatus(row.status, locale)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
                              <select
                                className="select"
                                value={selectedStatus}
                                onChange={(event) =>
                                  setStatusDrafts((current) => ({
                                    ...current,
                                    [row.id]: event.target.value as InternalAdminPublicLeadStatus
                                  }))
                                }
                              >
                                {STATUS_OPTIONS.filter(
                                  (option): option is InternalAdminPublicLeadStatus => option !== "ALL"
                                ).map((option) => (
                                  <option key={option} value={option}>
                                    {formatLeadStatus(option, locale)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={busyLeadId === row.id || selectedStatus === row.status}
                                onClick={() => void handleStatusSave(row.id)}
                              >
                                {busyLeadId === row.id
                                  ? copy.processing
                                  : locale === "en"
                                    ? "Save status"
                                    : "Durumu Kaydet"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
