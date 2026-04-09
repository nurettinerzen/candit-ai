"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { formatDate } from "../../../lib/format";
import {
  formatInternalPlan,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../lib/internal-admin-copy";
import type { InternalAdminDashboardReadModel } from "../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dashboardBadgeVariant(key: string) {
  if (key === "ENTERPRISE") return "info";
  if (key === "GROWTH") return "success";
  return "warn";
}

export default function InternalAdminDashboardPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminDashboardReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiClient.internalAdminDashboard();
      setData(result);
    } catch (loadError) {
      setData(null);
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

  if (error && !data) {
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

  if (!data) {
    return (
      <section className="page-grid">
        <section className="panel">
          <EmptyState message={copy.noData} />
        </section>
      </section>
    );
  }

  /* ── Stat card definitions (icon + label + value, 3-col grid) ── */
  const metrics = [
    { label: copy.totalCustomers, value: data.summary.totalCustomers, tone: "primary", icon: "\u{1F465}", iconTone: "primary" },
    { label: copy.activeCustomers, value: data.summary.activeCustomers, tone: "success", icon: "\u2713", iconTone: "success" },
    { label: copy.todayCandidateProcessing, value: data.summary.todayCandidateProcessing, tone: "warning", icon: "\u{1F4CB}", iconTone: "warning" },
    { label: copy.todayAiInterviews, value: data.summary.todayAiInterviews, tone: "info", icon: "\u{1F399}", iconTone: "info" },
    { label: copy.openAlerts, value: data.summary.openAlerts, tone: "danger", icon: "\u26A0", iconTone: "danger" },
    { label: copy.openLeadInbox, value: data.summary.openLeadInbox, tone: "warning", icon: "\u2709", iconTone: "warning" },
    { label: copy.enterpriseCustomers, value: data.summary.enterpriseCustomers, tone: "muted", icon: "\u{1F3E2}", iconTone: "muted" }
  ];

  /* ── Quick-link definitions ── */
  const quickLinks = [
    {
      href: "/admin/users" as Route,
      title: copy.customers,
      detail: `${data.quickLinks.customers} ${locale === "en" ? "customer workspace" : "müşteri çalışma alanı"}`,
      icon: "\u{1F465}"
    },
    {
      href: "/admin/red-alert" as Route,
      title: copy.redAlerts,
      detail: `${data.quickLinks.redAlerts} ${locale === "en" ? "open signal" : "açık sinyal"}`,
      icon: "\u26A0"
    },
    {
      href: "/admin/leads" as Route,
      title: copy.leads,
      detail: `${data.quickLinks.leads} ${locale === "en" ? "open inbound lead" : "açık inbound lead"}`,
      icon: "\u2709"
    },
    {
      href: "/admin/enterprise" as Route,
      title: copy.enterprise,
      detail: `${data.quickLinks.enterprise} ${locale === "en" ? "contract account" : "kurumsal hesap"}`,
      icon: "\u{1F3E2}"
    }
  ];

  return (
    <section className="page-grid">
      {/* ── Header: title + subtitle + refresh ── */}
      <div className="page-header">
        <div className="page-header-copy">
          <h1>{copy.dashboardTitle}</h1>
          <p>{copy.dashboardSubtitle}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="ghost-button" onClick={() => void loadPage()}>
            {copy.refresh}
          </button>
        </div>
      </div>

      {/* ── Stat cards grid (3 cols on desktop) ── */}
      <section className="admin-metric-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className={`admin-metric-card tone-${metric.tone}`}>
            <div className="admin-metric-text">
              <span className="admin-metric-label">{metric.label}</span>
              <strong className="admin-metric-value">{metric.value}</strong>
            </div>
            <div className={`admin-metric-icon icon-${metric.iconTone}`} aria-hidden="true">
              {metric.icon}
            </div>
          </article>
        ))}
      </section>

      {/* ── Plan Distribution ── */}
      <section className="panel">
        <div className="tlx-section-header">
          <h2 className="tlx-section-title">{copy.planDistribution}</h2>
        </div>
        <div className="admin-distribution-grid">
          {data.planDistribution.map((plan) => (
            <article key={plan.key} className="admin-distribution-card">
              <span className={`badge ${dashboardBadgeVariant(plan.key)}`}>
                {formatInternalPlan(plan.key, locale)}
              </span>
              <strong>{plan.count}</strong>
              <span>{formatInternalPlan(plan.key, locale)}</span>
            </article>
          ))}
        </div>
      </section>

      {/* ── Quick Links grid ── */}
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

      {/* ── Overview section ── */}
      <section className="panel">
        <div className="tlx-section-header">
          <h2 className="tlx-section-title">{copy.overview}</h2>
        </div>
        <div className="admin-overview-grid">
          <div className="admin-overview-item">
            <strong>{copy.enterprise}</strong>
            <p className="small text-muted" style={{ margin: "4px 0 0" }}>
              {locale === "en"
                ? "Enterprise offers, payment links, and custom quotas are managed from the Enterprise page."
                : "Kurumsal teklifler, ödeme linkleri ve özel kotalar Kurumsal sayfasından yönetilir."}
            </p>
          </div>
          <div className="admin-overview-item">
            <strong>{copy.redAlerts}</strong>
            <p className="small text-muted" style={{ margin: "4px 0 0" }}>
              {locale === "en"
                ? "Operational, assistant, security, and delivery signals are consolidated in one list."
                : "Operasyon, asistan, güvenlik ve teslimat sinyalleri tek listede toplanır."}
            </p>
          </div>
          <div className="admin-overview-item">
            <strong>{copy.billing}</strong>
            <p className="small text-muted" style={{ margin: "4px 0 0" }}>
              {locale === "en"
                ? `Snapshot generated on ${formatDate(new Date().toISOString())}.`
                : `${formatDate(new Date().toISOString())} itibarıyla anlık görünüm.`}
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
