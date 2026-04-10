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
import type { SiteLocale } from "../../../../lib/i18n";
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

type PlanCardKey = "TRIAL" | BillingPlanKey;

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

function isTrialRow(row: InternalAdminCustomerRow) {
  return row.billing.trial.isActive || row.billing.trial.isExpired;
}

function isBillingRiskStatus(status: string) {
  return status === "PAST_DUE" || status === "INCOMPLETE" || status === "CANCELED";
}

function matchesPlanKey(row: InternalAdminCustomerRow, planKey: "ALL" | BillingPlanKey) {
  if (planKey === "ALL") {
    return true;
  }

  return !isTrialRow(row) && row.billing.currentPlanKey === planKey;
}

function matchesSegment(row: InternalAdminCustomerRow, segment: CustomerSegment) {
  if (segment === "ALL") {
    return true;
  }

  if (segment === "TRIAL") {
    return isTrialRow(row);
  }

  if (segment === "TRIAL_ACTIVE") {
    return row.billing.trial.isActive;
  }

  if (segment === "TRIAL_EXPIRED") {
    return row.billing.trial.isExpired;
  }

  return isBillingRiskStatus(row.billing.status);
}

function getPlanLabel(
  row: InternalAdminCustomerRow,
  locale: SiteLocale,
  copy: ReturnType<typeof getInternalAdminCopy>
) {
  return isTrialRow(row) ? copy.segmentTrial : formatInternalPlan(row.billing.currentPlanKey, locale);
}

function getStartDate(row: InternalAdminCustomerRow) {
  return row.billing.trial.startedAt ?? row.createdAt;
}

function getEndDate(row: InternalAdminCustomerRow) {
  return row.billing.trial.endsAt ?? row.billing.currentPeriodEnd;
}

function getActiveFilterLabel(
  locale: SiteLocale,
  copy: ReturnType<typeof getInternalAdminCopy>,
  segment: CustomerSegment,
  planKey: "ALL" | BillingPlanKey,
  status: "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED"
) {
  if (segment === "TRIAL") {
    return copy.segmentTrial;
  }

  if (segment === "TRIAL_ACTIVE") {
    return copy.segmentTrialActive;
  }

  if (segment === "TRIAL_EXPIRED") {
    return copy.segmentTrialExpired;
  }

  if (segment === "BILLING_RISK") {
    return copy.segmentBillingRisk;
  }

  if (planKey !== "ALL") {
    return formatInternalPlan(planKey, locale);
  }

  if (status !== "ALL") {
    return formatTenantStatus(status, locale);
  }

  return locale === "en" ? "All customers" : "Tüm müşteriler";
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

    return data.rows.filter((row) => matchesPlanKey(row, planKey) && matchesSegment(row, segment));
  }, [data, planKey, segment]);

  const cardCounts = useMemo(() => {
    const rows = data?.rows ?? [];

    return {
      trial: rows.filter((row) => isTrialRow(row)).length,
      starter: rows.filter((row) => !isTrialRow(row) && row.billing.currentPlanKey === "STARTER").length,
      growth: rows.filter((row) => !isTrialRow(row) && row.billing.currentPlanKey === "GROWTH").length,
      enterprise: rows.filter((row) => !isTrialRow(row) && row.billing.currentPlanKey === "ENTERPRISE").length
    };
  }, [data]);

  const summary = useMemo(() => {
    return {
      total: filteredRows.length,
      trialActive: filteredRows.filter((row) => row.billing.trial.isActive).length,
      trialExpired: filteredRows.filter((row) => row.billing.trial.isExpired).length,
      billingRisk: filteredRows.filter((row) => isBillingRiskStatus(row.billing.status)).length
    };
  }, [filteredRows]);

  const activeFilterLabel = getActiveFilterLabel(locale, copy, segment, planKey, status);
  const listDescription =
    segment === "TRIAL"
      ? locale === "en"
        ? `${summary.total} accounts shown. ${summary.trialActive} active trial and ${summary.trialExpired} expired trial.`
        : `${summary.total} hesap gösteriliyor. ${summary.trialActive} aktif deneme ve ${summary.trialExpired} süresi dolmuş deneme var.`
      : locale === "en"
        ? `${summary.total} accounts shown. Active filter: ${activeFilterLabel}.`
        : `${summary.total} hesap gösteriliyor. Aktif filtre: ${activeFilterLabel}.`;

  const planCards = [
    { key: "TRIAL" as const, label: copy.segmentTrial, count: cardCounts.trial, tone: "warning" },
    { key: "STARTER" as const, label: formatInternalPlan("STARTER", locale), count: cardCounts.starter, tone: "warn" },
    { key: "GROWTH" as const, label: formatInternalPlan("GROWTH", locale), count: cardCounts.growth, tone: "success" },
    {
      key: "ENTERPRISE" as const,
      label: formatInternalPlan("ENTERPRISE", locale),
      count: cardCounts.enterprise,
      tone: "info"
    }
  ];

  function handlePlanCardSelect(key: PlanCardKey) {
    if (key === "TRIAL") {
      setPlanKey("ALL");
      setSegment((current) => (current === "TRIAL" ? "ALL" : "TRIAL"));
      return;
    }

    setSegment("ALL");
    setPlanKey((current) => (current === key ? "ALL" : key));
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <div className="page-header-copy">
          <h1>{copy.usersTitle}</h1>
          <p>{copy.usersSubtitle}</p>
        </div>
      </div>

      {!loading && data ? (
        <section className="admin-distribution-grid">
          {planCards.map((item) => {
            const isActive =
              item.key === "TRIAL"
                ? segment === "TRIAL"
                : segment === "ALL" && planKey === item.key;

            return (
              <button
                key={item.key}
                type="button"
                className={`admin-distribution-card admin-segment-card${isActive ? " is-active" : ""}`}
                onClick={() => handlePlanCardSelect(item.key)}
              >
                <span className={`badge ${item.tone}`}>{item.label}</span>
                <strong>{item.count}</strong>
                <span>{locale === "en" ? "Customer accounts" : "Müşteri hesabı"}</span>
              </button>
            );
          })}
        </section>
      ) : null}

      <section className="panel">
        <div className="admin-filter-row admin-users-filter-row">
          <input
            className="input admin-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchUsersPlaceholder}
          />
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
          <button type="button" className="btn-primary-sm" onClick={() => setQuery(search.trim())}>
            {copy.search}
          </button>
        </div>
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
          <>
            <div className="admin-list-header">
              <div>
                <h2>{copy.customerListTitle}</h2>
                <p>{listDescription}</p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="admin-table admin-users-table">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{copy.customerName}</th>
                    <th>{copy.companyName}</th>
                    <th>{copy.plan}</th>
                    <th>{copy.startDate}</th>
                    <th>{copy.endDate}</th>
                    <th>{copy.usageSummary}</th>
                    <th>{copy.status}</th>
                    <th>{copy.details}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.tenantId}>
                      <td>
                        {row.owner ? (
                          <div className="admin-table-cell-stack">
                            <strong>{row.owner.fullName}</strong>
                            <span className="small">{row.owner.email}</span>
                            {row.owner.status !== "ACTIVE" ? (
                              <span className="small">{formatMemberStatus(row.owner.status, locale)}</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="admin-table-cell-stack">
                            <strong>—</strong>
                            <span className="small">{copy.noOwner}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="admin-table-cell-stack">
                          <strong>{row.tenantName}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="admin-table-cell-stack">
                          <strong>{getPlanLabel(row, locale, copy)}</strong>
                          {isBillingRiskStatus(row.billing.status) ? (
                            <span className="small">{formatBillingStatus(row.billing.status, locale)}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>{formatDate(getStartDate(row))}</td>
                      <td>{formatDate(getEndDate(row))}</td>
                      <td>
                        <div className="admin-table-cell-stack admin-usage-stack">
                          <span className="small">
                            {locale === "en" ? "Seats" : "Koltuk"} {row.usage.seats?.used ?? 0}/{row.usage.seats?.limit ?? 0}
                            {" · "}
                            {locale === "en" ? "Jobs" : "İlan"} {row.usage.activeJobs?.used ?? 0}/{row.usage.activeJobs?.limit ?? 0}
                          </span>
                          <span className="small">
                            {locale === "en" ? "Candidates" : "Aday"} {row.usage.candidateProcessing?.used ?? 0}/
                            {row.usage.candidateProcessing?.limit ?? 0}
                            {" · "}
                            {locale === "en" ? "AI Interviews" : "AI mülakat"} {row.usage.aiInterviews?.used ?? 0}/
                            {row.usage.aiInterviews?.limit ?? 0}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-table-cell-stack">
                          <span className={`admin-inline-status tone-${statusVariant(row.tenantStatus)}`}>
                            {formatTenantStatus(row.tenantStatus, locale)}
                          </span>
                          {isBillingRiskStatus(row.billing.status) && row.tenantStatus === "ACTIVE" ? (
                            <span className="small">{formatBillingStatus(row.billing.status, locale)}</span>
                          ) : null}
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
          </>
        )}
      </section>
    </section>
  );
}
