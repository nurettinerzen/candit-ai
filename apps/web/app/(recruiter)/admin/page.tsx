"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import {
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../lib/internal-admin-copy";
import type {
  InternalAdminAccountListReadModel,
  InternalAdminDashboardReadModel
} from "../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}


function isTrialAccount(account: InternalAdminAccountListReadModel["rows"][number]) {
  return account.billing.trial.isActive || account.billing.trial.isExpired;
}

type MetricCard = {
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "danger" | "info" | "muted";
  icon: string;
  iconTone: "primary" | "success" | "warning" | "danger" | "info" | "muted";
  href: Route;
  detail?: string;
};

export default function InternalAdminDashboardPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminDashboardReadModel | null>(null);
  const [accounts, setAccounts] = useState<InternalAdminAccountListReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardResult, accountResult] = await Promise.all([
        apiClient.internalAdminDashboard(),
        apiClient.internalAdminAccounts()
      ]);
      setData(dashboardResult);
      setAccounts(accountResult);
    } catch (loadError) {
      setData(null);
      setAccounts(null);
      setError(translateInternalAdminMessage(toErrorMessage(loadError, copy.internalOnly), locale));
    } finally {
      setLoading(false);
    }
  }, [copy.internalOnly, locale]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  if (loading) {
    return (
      <section className="page-grid">
        <section className="panel">
          <LoadingState message={copy.loading} />
        </section>
      </section>
    );
  }

  if (error && (!data || !accounts)) {
    return (
      <section className="page-grid">
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
      </section>
    );
  }

  if (!data || !accounts) {
    return (
      <section className="page-grid">
        <section className="panel">
          <EmptyState message={copy.noData} />
        </section>
      </section>
    );
  }

  const trialTotal = accounts.summary.trialActive + accounts.summary.trialExpired;
  const starterCount = accounts.rows.filter(
    (row) => !isTrialAccount(row) && row.billing.currentPlanKey === "STARTER"
  ).length;
  const growthCount = accounts.rows.filter(
    (row) => !isTrialAccount(row) && row.billing.currentPlanKey === "GROWTH"
  ).length;
  const enterpriseCount = accounts.rows.filter(
    (row) => !isTrialAccount(row) && row.billing.currentPlanKey === "ENTERPRISE"
  ).length;

  const metrics: MetricCard[] = [
    {
      label: copy.totalCustomers,
      value: data.summary.totalCustomers,
      tone: "primary",
      icon: "\u{1F465}",
      iconTone: "primary",
      href: "/admin/users",
      detail:
        locale === "en"
          ? `${data.summary.activeCustomers} active · ${accounts.summary.suspended} suspended · ${trialTotal} trial`
          : `${data.summary.activeCustomers} aktif · ${accounts.summary.suspended} askıda · ${trialTotal} deneme`
    },
    {
      label: copy.openAlerts,
      value: data.summary.openAlerts,
      tone: "danger",
      icon: "\u26A0",
      iconTone: "danger",
      href: "/admin/red-alert",
      detail:
        locale === "en"
          ? "Platform failures, delivery issues and risk signals"
          : "Platform hataları, teslimat sorunları ve risk sinyalleri"
    },
    {
      label: copy.leads,
      value: data.quickLinks.leads,
      tone: "warning",
      icon: "\u2709",
      iconTone: "warning",
      href: "/admin/leads",
      detail:
        locale === "en"
          ? "Open inbound demo and pilot requests"
          : "Açık demo ve pilot talepleri"
    },
    {
      label: copy.enterprise,
      value: enterpriseCount,
      tone: "info",
      icon: "\u{1F3E2}",
      iconTone: "info",
      href: "/admin/enterprise",
      detail:
        locale === "en"
          ? `${starterCount} Starter · ${growthCount} Growth`
          : `${starterCount} Starter · ${growthCount} Growth`
    }
  ];

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <h1>{copy.dashboardTitle}</h1>
          <p>{copy.dashboardSubtitle}</p>
        </div>
      </div>

      <section className="admin-metric-grid">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className={`admin-metric-card tone-${metric.tone}`}>
            <div className="admin-metric-text">
              <span className="admin-metric-label">{metric.label}</span>
              <strong className="admin-metric-value">{metric.value}</strong>
              {metric.detail ? <p className="admin-metric-copy">{metric.detail}</p> : null}
            </div>
            <div className={`admin-metric-icon icon-${metric.iconTone}`} aria-hidden="true">
              {metric.icon}
            </div>
          </Link>
        ))}
      </section>
    </section>
  );
}
