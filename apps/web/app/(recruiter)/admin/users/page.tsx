"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../../components/ui-states";
import { useUiText } from "../../../../components/site-language-provider";
import { apiClient } from "../../../../lib/api-client";
import { formatDate } from "../../../../lib/format";
import {
  formatBillingStatus,
  formatInternalPlan,
  formatMemberStatus,
  formatTenantStatus,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../lib/internal-admin-copy";
import type { BillingPlanKey, InternalAdminAccountListReadModel } from "../../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED" || status === "PAST_DUE") return "warning";
  if (status === "DELETED" || status === "CANCELED") return "danger";
  return "muted";
}

export default function InternalAdminUsersPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminAccountListReadModel | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [planKey, setPlanKey] = useState<"ALL" | BillingPlanKey>("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED" | "DELETED">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiClient.internalAdminAccounts({
        query: query || undefined,
        planKey,
        status
      });
      setData(result);
    } catch (loadError) {
      setData(null);
      setError(translateInternalAdminMessage(toErrorMessage(loadError, copy.internalOnly), locale));
    } finally {
      setLoading(false);
    }
  }, [copy.internalOnly, locale, planKey, query, status]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(search.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const metrics = useMemo(() => {
    if (!data) {
      return [
        { label: copy.totalCustomers, value: 0, tone: "primary" },
        { label: copy.activeCustomers, value: 0, tone: "success" },
        { label: copy.suspendedCustomers, value: 0, tone: "warning" },
        { label: formatInternalPlan("GROWTH", locale), value: 0, tone: "info" },
        { label: formatInternalPlan("ENTERPRISE", locale), value: 0, tone: "muted" }
      ];
    }

    return [
      { label: copy.totalCustomers, value: data.summary.total, tone: "primary" },
      { label: copy.activeCustomers, value: data.summary.active, tone: "success" },
      { label: copy.suspendedCustomers, value: data.summary.suspended, tone: "warning" },
      { label: formatInternalPlan("GROWTH", locale), value: data.summary.growth, tone: "info" },
      { label: formatInternalPlan("ENTERPRISE", locale), value: data.summary.enterprise, tone: "muted" }
    ];
  }, [copy.activeCustomers, copy.suspendedCustomers, copy.totalCustomers, data, locale]);

  return (
    <section className="page-grid">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-copy">
          <h1>{copy.usersTitle}</h1>
          <p>{copy.usersSubtitle}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="ghost-button" onClick={() => void loadPage()}>
            {copy.refresh}
          </button>
        </div>
      </div>

      {/* ── Search / Filter Bar ── */}
      <section className="panel">
        <div className="admin-filter-row">
          <input
            className="input admin-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchUsersPlaceholder}
          />
          <select
            className="select"
            value={planKey}
            onChange={(event) => setPlanKey(event.target.value as "ALL" | BillingPlanKey)}
          >
            <option value="ALL">{copy.allPlans}</option>
            <option value="STARTER">{formatInternalPlan("STARTER", locale)}</option>
            <option value="GROWTH">{formatInternalPlan("GROWTH", locale)}</option>
            <option value="ENTERPRISE">{formatInternalPlan("ENTERPRISE", locale)}</option>
          </select>
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED")}
          >
            <option value="ALL">{copy.allWorkspaceStatuses}</option>
            <option value="ACTIVE">{copy.active}</option>
            <option value="SUSPENDED">{copy.suspended}</option>
            <option value="DELETED">{copy.deleted}</option>
          </select>
          <button type="button" className="btn-primary-sm" onClick={() => void loadPage()}>
            {copy.search}
          </button>
        </div>
      </section>

      {/* ── Stat Cards ── */}
      <section className="admin-metric-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className={`admin-metric-card tone-${metric.tone}`}>
            <span className="admin-metric-label">{metric.label}</span>
            <strong className="admin-metric-value">{metric.value}</strong>
          </article>
        ))}
      </section>

      {/* ── Data Table ── */}
      <section className="panel">
        {loading ? (
          <LoadingState message={copy.loading} />
        ) : error && !data ? (
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPage()}>
                {copy.retry}
              </button>
            }
          />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState message={copy.noCustomers} />
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{copy.workspace}</th>
                  <th>{copy.workspaceOwner}</th>
                  <th>{copy.plan}</th>
                  <th>{copy.usageSummary}</th>
                  <th>{copy.status}</th>
                  <th>{copy.details}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.tenantId}>
                    <td>
                      <div className="admin-table-cell-stack">
                        <strong>{row.tenantName}</strong>
                        <span className="small">{formatDate(row.createdAt)}</span>
                      </div>
                    </td>
                    <td>
                      {row.owner ? (
                        <div className="admin-table-cell-stack">
                          <strong>{row.owner.fullName}</strong>
                          <span className="small">{row.owner.email}</span>
                          <span className={`status-badge status-${statusVariant(row.owner.status)}`}>
                            {formatMemberStatus(row.owner.status, locale)}
                          </span>
                        </div>
                      ) : (
                        <span className="small">{copy.noOwner}</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-table-cell-stack">
                        <span
                          className={`badge ${row.billing.currentPlanKey === "ENTERPRISE" ? "info" : row.billing.currentPlanKey === "GROWTH" ? "success" : "warn"}`}
                        >
                          {formatInternalPlan(row.billing.currentPlanKey, locale)}
                        </span>
                        <span className={`status-badge status-${statusVariant(row.billing.status)}`}>
                          {formatBillingStatus(row.billing.status, locale)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-cell-stack">
                        <span className="small">
                          {copy.quotaLabelSeats}: {row.usage.seats?.used ?? 0}/{row.usage.seats?.limit ?? 0}
                        </span>
                        <span className="small">
                          {copy.quotaLabelActiveJobs}: {row.usage.activeJobs?.used ?? 0}/{row.usage.activeJobs?.limit ?? 0}
                        </span>
                        <span className="small">
                          {copy.quotaLabelCandidateProcessing}: {row.usage.candidateProcessing?.used ?? 0}/{row.usage.candidateProcessing?.limit ?? 0}
                        </span>
                        <span className="small">
                          {copy.quotaLabelAiInterviews}: {row.usage.aiInterviews?.used ?? 0}/{row.usage.aiInterviews?.limit ?? 0}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-cell-stack">
                        <span className={`status-badge status-${statusVariant(row.tenantStatus)}`}>
                          {formatTenantStatus(row.tenantStatus, locale)}
                        </span>
                        <span className="small">{copy.createdOn}: {formatDate(row.createdAt)}</span>
                      </div>
                    </td>
                    <td>
                      <Link href={`/admin/users/${row.tenantId}` as Route} className="ghost-button">
                        {copy.viewDetails}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
