"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import {
  formatAlertCategory,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../lib/internal-admin-copy";
import type {
  InternalAdminAccountListReadModel,
  InternalAdminDashboardReadModel,
  InternalAdminPublicLeadListReadModel,
  InternalAdminRedAlertReadModel
} from "../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type SectionCard = {
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "danger" | "info" | "muted";
  href?: Route;
};

type DashboardSection = {
  key: string;
  title: string;
  href: Route;
  cards: SectionCard[];
};

export default function InternalAdminDashboardPage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminDashboardReadModel | null>(null);
  const [accounts, setAccounts] = useState<InternalAdminAccountListReadModel | null>(null);
  const [alerts, setAlerts] = useState<InternalAdminRedAlertReadModel | null>(null);
  const [leads, setLeads] = useState<InternalAdminPublicLeadListReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [dashboardResult, accountsResult, alertsResult, leadsResult] = await Promise.all([
        apiClient.internalAdminDashboard(),
        apiClient.internalAdminAccounts(),
        apiClient.internalAdminRedAlert(),
        apiClient.internalAdminPublicLeads()
      ]);
      setData(dashboardResult);
      setAccounts(accountsResult);
      setAlerts(alertsResult);
      setLeads(leadsResult);
    } catch (loadError) {
      setData(null);
      setAccounts(null);
      setAlerts(null);
      setLeads(null);
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

  if (error && (!data || !accounts || !alerts || !leads)) {
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

  if (!data || !accounts || !alerts || !leads) {
    return (
      <section className="page-grid">
        <section className="panel">
          <EmptyState message={copy.noData} />
        </section>
      </section>
    );
  }

  const trialCount = accounts.summary.trialActive + accounts.summary.trialExpired;

  const alertCount = (key: string) => alerts.summary.find((s) => s.key === key)?.count ?? 0;

  const viewAllLabel = locale === "en" ? "View all" : "Tümünü gör";

  const sections: DashboardSection[] = [
    {
      key: "customers",
      title: copy.customers,
      href: "/admin/users",
      cards: [
        {
          label: copy.totalCustomers,
          value: data.summary.totalCustomers,
          tone: "primary",
          href: "/admin/users"
        },
        {
          label: copy.activeCustomers,
          value: data.summary.activeCustomers,
          tone: "success",
          href: "/admin/users?status=ACTIVE"
        },
        {
          label: copy.suspendedCustomers,
          value: data.summary.suspendedCustomers,
          tone: "muted",
          href: "/admin/users?status=SUSPENDED"
        },
        {
          label: copy.trialAccounts,
          value: trialCount,
          tone: "warning",
          href: "/admin/users?segment=TRIAL"
        }
      ]
    },
    {
      key: "red-alert",
      title: copy.redAlerts,
      href: "/admin/red-alert",
      cards: [
        {
          label: formatAlertCategory("APPLICATION", locale),
          value: alertCount("APPLICATION"),
          tone: "danger",
          href: "/admin/red-alert?category=APPLICATION"
        },
        {
          label: formatAlertCategory("SECURITY", locale),
          value: alertCount("SECURITY"),
          tone: "danger",
          href: "/admin/red-alert?category=SECURITY"
        },
        {
          label: formatAlertCategory("ASSISTANT", locale),
          value: alertCount("ASSISTANT"),
          tone: "warning",
          href: "/admin/red-alert?category=ASSISTANT"
        },
        {
          label: formatAlertCategory("OPERATIONS", locale),
          value: alertCount("OPERATIONS"),
          tone: "muted",
          href: "/admin/red-alert?category=OPERATIONS"
        }
      ]
    },
    {
      key: "leads",
      title: copy.leads,
      href: "/admin/leads",
      cards: [
        {
          label: copy.openLeadInbox,
          value: leads.summary.total,
          tone: "primary",
          href: "/admin/leads"
        },
        {
          label: locale === "en" ? "New" : "Yeni",
          value: leads.summary.new,
          tone: "warning",
          href: "/admin/leads?status=NEW"
        },
        {
          label: locale === "en" ? "Reviewing" : "İnceleniyor",
          value: leads.summary.reviewing,
          tone: "info",
          href: "/admin/leads?status=REVIEWING"
        },
        {
          label: locale === "en" ? "Contacted" : "İletişime Geçildi",
          value: leads.summary.contacted,
          tone: "success",
          href: "/admin/leads?status=CONTACTED"
        }
      ]
    }
  ];

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide guideKey="adminDashboard" title={copy.dashboardTitle} />
          <p>{copy.dashboardSubtitle}</p>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.key} className="panel">
          <div className="tlx-section-header">
            <h2 className="tlx-section-title">{section.title}</h2>
            <Link href={section.href} className="ghost-button">
              {viewAllLabel}
            </Link>
          </div>
          <div className="admin-distribution-grid">
            {section.cards.map((card) =>
              card.href ? (
                <Link
                  key={card.label}
                  href={card.href}
                  className="admin-distribution-card admin-distribution-link"
                >
                  <span className={`badge ${card.tone}`}>{card.label}</span>
                  <strong>{card.value}</strong>
                </Link>
              ) : (
                <div key={card.label} className="admin-distribution-card">
                  <span className={`badge ${card.tone}`}>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              )
            )}
          </div>
        </section>
      ))}
    </section>
  );
}
