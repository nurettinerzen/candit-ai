"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import {
  formatInternalPlan,
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

function dashboardBadgeVariant(key: string) {
  if (key === "ENTERPRISE") return "info";
  if (key === "GROWTH") return "success";
  return "warn";
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
          ? `${starterCount} Starter, ${growthCount} Growth, ${enterpriseCount} Enterprise`
          : `${starterCount} Starter, ${growthCount} Growth, ${enterpriseCount} Kurumsal`
    },
    {
      label: copy.activeCustomers,
      value: data.summary.activeCustomers,
      tone: "success",
      icon: "\u2713",
      iconTone: "success",
      href: "/admin/users?status=ACTIVE",
      detail:
        locale === "en"
          ? `${accounts.summary.suspended} suspended workspace`
          : `${accounts.summary.suspended} askıdaki hesap`
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
          ? `${data.quickLinks.leads} open inbound lead`
          : `${data.quickLinks.leads} açık inbound lead`
    },
    {
      label: copy.trialAccounts,
      value: trialTotal,
      tone: "warning",
      icon: "\u23F3",
      iconTone: "warning",
      href: "/admin/users?segment=TRIAL",
      detail:
        locale === "en"
          ? `${accounts.summary.trialActive} active · ${accounts.summary.trialExpired} ended`
          : `${accounts.summary.trialActive} aktif · ${accounts.summary.trialExpired} biten`
    }
  ];

  const segmentCards = [
    {
      key: "TRIAL",
      label: copy.segmentTrial,
      count: trialTotal,
      tone: "warning",
      href: "/admin/users?segment=TRIAL" as Route
    },
    {
      key: "STARTER",
      label: formatInternalPlan("STARTER", locale),
      count: starterCount,
      tone: dashboardBadgeVariant("STARTER"),
      href: "/admin/users?planKey=STARTER" as Route
    },
    {
      key: "GROWTH",
      label: formatInternalPlan("GROWTH", locale),
      count: growthCount,
      tone: dashboardBadgeVariant("GROWTH"),
      href: "/admin/users?planKey=GROWTH" as Route
    },
    {
      key: "ENTERPRISE",
      label: formatInternalPlan("ENTERPRISE", locale),
      count: enterpriseCount,
      tone: dashboardBadgeVariant("ENTERPRISE"),
      href: "/admin/users?planKey=ENTERPRISE" as Route
    }
  ];

  const quickLinks = [
    {
      href: "/admin/users" as Route,
      title: copy.customers,
      detail:
        locale === "en"
          ? "Open customer list, filter plans, and inspect account details."
          : "Müşteri listesini açın, planları filtreleyin ve hesap detaylarını inceleyin.",
      icon: "\u{1F465}"
    },
    {
      href: "/admin/red-alert" as Route,
      title: copy.redAlerts,
      detail:
        locale === "en"
          ? "Review platform failures, delivery issues, and commercial risk signals."
          : "Platform hatalarını, teslimat sorunlarını ve ticari risk sinyallerini inceleyin.",
      icon: "\u26A0"
    },
    {
      href: "/admin/leads" as Route,
      title: copy.leads,
      detail:
        locale === "en"
          ? "Review inbound demo and pilot demand from the public site."
          : "Public siteden gelen demo ve pilot taleplerini inceleyin.",
      icon: "\u2709"
    },
    {
      href: "/admin/enterprise" as Route,
      title: copy.enterprise,
      detail:
        locale === "en"
          ? "Manage contract customers, custom offers, and payment link flows."
          : "Sözleşmeli müşterileri, özel teklifleri ve ödeme linki akışlarını yönetin.",
      icon: "\u{1F3E2}"
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

      <section className="panel">
        <div className="tlx-section-header">
          <h2 className="tlx-section-title">{copy.planSegments}</h2>
        </div>
        <div className="admin-distribution-grid">
          {segmentCards.map((item) => (
            <Link key={item.key} href={item.href} className="admin-distribution-card admin-distribution-link">
              <span className={`badge ${item.tone}`}>{item.label}</span>
              <strong>{item.count}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-quick-grid">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className="admin-quick-card">
            <div>
              <span aria-hidden="true" style={{ fontSize: 18, marginRight: 6 }}>{link.icon}</span>
              <h3 style={{ display: "inline" }}>{link.title}</h3>
              <p>{link.detail}</p>
            </div>
            <span aria-hidden="true">{"\u2192"}</span>
          </Link>
        ))}
      </section>
    </section>
  );
}
