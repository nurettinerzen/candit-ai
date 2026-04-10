"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import type {
  BillingPlanKey,
  InternalAdminAccountListReadModel,
  InternalAdminCustomerRow
} from "../../../../lib/types";

type CustomerSegment =
  | "ALL"
  | "TRIAL"
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRED"
  | "BILLING_RISK";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED" || status === "PAST_DUE" || status === "TRIALING" || status === "INCOMPLETE") {
    return "warning";
  }
  if (status === "DELETED" || status === "CANCELED") return "danger";
  return "muted";
}

function normalizePlanKey(raw: string | null): "ALL" | BillingPlanKey {
  return raw === "STARTER" || raw === "GROWTH" || raw === "ENTERPRISE" ? raw : "ALL";
}

function normalizeWorkspaceStatus(raw: string | null): "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED" {
  return raw === "ACTIVE" || raw === "SUSPENDED" || raw === "DELETED" ? raw : "ALL";
}

function normalizeSegment(raw: string | null): CustomerSegment {
  return raw === "TRIAL" ||
    raw === "TRIAL_ACTIVE" ||
    raw === "TRIAL_EXPIRED" ||
    raw === "BILLING_RISK"
    ? raw
    : "ALL";
}

function isBillingRiskStatus(status: string) {
  return status === "PAST_DUE" || status === "INCOMPLETE" || status === "CANCELED";
}

function matchesSegment(row: InternalAdminCustomerRow, segment: CustomerSegment) {
  if (segment === "ALL") {
    return true;
  }

  if (segment === "TRIAL") {
    return row.billing.trial.isActive || row.billing.trial.isExpired;
  }

  if (segment === "TRIAL_ACTIVE") {
    return row.billing.trial.isActive;
  }

  if (segment === "TRIAL_EXPIRED") {
    return row.billing.trial.isExpired;
  }

  return isBillingRiskStatus(row.billing.status);
}

export default function InternalAdminUsersPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialQuery = searchParams.get("query") ?? "";
  const initialPlanKey = normalizePlanKey(searchParams.get("planKey"));
  const initialStatus = normalizeWorkspaceStatus(searchParams.get("status"));
  const initialSegment = normalizeSegment(searchParams.get("segment"));

  const [data, setData] = useState<InternalAdminAccountListReadModel | null>(null);
  const [search, setSearch] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [planKey, setPlanKey] = useState<"ALL" | BillingPlanKey>(initialPlanKey);
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED" | "DELETED">(initialStatus);
  const [segment, setSegment] = useState<CustomerSegment>(initialSegment);
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

  useEffect(() => {
    const nextQuery = searchParams.get("query") ?? "";
    const nextPlanKey = normalizePlanKey(searchParams.get("planKey"));
    const nextStatus = normalizeWorkspaceStatus(searchParams.get("status"));
    const nextSegment = normalizeSegment(searchParams.get("segment"));

    setSearch((current) => (current === nextQuery ? current : nextQuery));
    setQuery((current) => (current === nextQuery ? current : nextQuery));
    setPlanKey((current) => (current === nextPlanKey ? current : nextPlanKey));
    setStatus((current) => (current === nextStatus ? current : nextStatus));
    setSegment((current) => (current === nextSegment ? current : nextSegment));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (query) {
      params.set("query", query);
    }
    if (planKey !== "ALL") {
      params.set("planKey", planKey);
    }
    if (status !== "ALL") {
      params.set("status", status);
    }
    if (segment !== "ALL") {
      params.set("segment", segment);
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl as Route, { scroll: false });
  }, [pathname, planKey, query, router, segment, status]);

  const filteredRows = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.rows.filter((row) => matchesSegment(row, segment));
  }, [data, segment]);

  const summary = useMemo(() => {
    return {
      total: filteredRows.length,
      active: filteredRows.filter((row) => row.tenantStatus === "ACTIVE").length,
      suspended: filteredRows.filter((row) => row.tenantStatus === "SUSPENDED").length,
      trialActive: filteredRows.filter((row) => row.billing.trial.isActive).length,
      trialExpired: filteredRows.filter((row) => row.billing.trial.isExpired).length,
      billingRisk: filteredRows.filter((row) => isBillingRiskStatus(row.billing.status)).length
    };
  }, [filteredRows]);

  const metrics = [
    { label: copy.totalCustomers, value: summary.total, tone: "primary" },
    { label: copy.activeCustomers, value: summary.active, tone: "success" },
    { label: copy.suspendedCustomers, value: summary.suspended, tone: "warning" },
    { label: copy.trialActive, value: summary.trialActive, tone: "info" },
    { label: copy.trialExpired, value: summary.trialExpired, tone: "muted" },
    { label: copy.billingRisk, value: summary.billingRisk, tone: "danger" }
  ];

  return (
    <section className="page-grid">
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
          <select
            className="select"
            value={segment}
            onChange={(event) => setSegment(event.target.value as CustomerSegment)}
          >
            <option value="ALL">{copy.allSegments}</option>
            <option value="TRIAL">{copy.segmentTrial}</option>
            <option value="TRIAL_ACTIVE">{copy.segmentTrialActive}</option>
            <option value="TRIAL_EXPIRED">{copy.segmentTrialExpired}</option>
            <option value="BILLING_RISK">{copy.segmentBillingRisk}</option>
          </select>
          <button type="button" className="btn-primary-sm" onClick={() => void loadPage()}>
            {copy.search}
          </button>
        </div>
      </section>

      <section className="admin-metric-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className={`admin-metric-card tone-${metric.tone}`}>
            <span className="admin-metric-label">{metric.label}</span>
            <strong className="admin-metric-value">{metric.value}</strong>
          </article>
        ))}
      </section>

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
        ) : !data || filteredRows.length === 0 ? (
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
                {filteredRows.map((row) => (
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
                        {row.billing.trial.isActive ? (
                          <span className="small">
                            {locale === "en"
                              ? `Trial ends ${formatDate(row.billing.trial.endsAt ?? row.billing.currentPeriodEnd)} · ${row.billing.trial.daysRemaining} days left`
                              : `Deneme ${formatDate(row.billing.trial.endsAt ?? row.billing.currentPeriodEnd)} tarihinde bitiyor · ${row.billing.trial.daysRemaining} gün kaldı`}
                          </span>
                        ) : row.billing.trial.isExpired ? (
                          <span className="small">
                            {locale === "en"
                              ? `Trial ended ${formatDate(row.billing.trial.endsAt ?? row.billing.currentPeriodEnd)}`
                              : `Deneme ${formatDate(row.billing.trial.endsAt ?? row.billing.currentPeriodEnd)} tarihinde bitti`}
                          </span>
                        ) : null}
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
                      <Link href={`/admin/users/${row.tenantId}`} className="ghost-button">
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
