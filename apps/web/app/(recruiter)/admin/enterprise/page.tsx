"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../../components/ui-states";
import { useUiText } from "../../../../components/site-language-provider";
import { apiClient } from "../../../../lib/api-client";
import { formatDate } from "../../../../lib/format";
import {
  formatBillingStatus,
  formatInternalPlan,
  formatTenantStatus,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../lib/internal-admin-copy";
import type { InternalAdminAccountListReadModel } from "../../../../lib/types";

/* ── Icon components (inline SVG, Candit-style) ── */

function IconBuilding() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ── Form state ── */

type EnterpriseFormState = {
  companyName: string;
  ownerFullName: string;
  ownerEmail: string;
  billingEmail: string;
  monthlyAmountCents: string;
  seatsIncluded: string;
  activeJobsIncluded: string;
  candidateProcessingIncluded: string;
  aiInterviewsIncluded: string;
  advancedReporting: boolean;
  calendarIntegrations: boolean;
  brandedCandidateExperience: boolean;
  customIntegrations: boolean;
  note: string;
};

function createDefaultForm(): EnterpriseFormState {
  return {
    companyName: "",
    ownerFullName: "",
    ownerEmail: "",
    billingEmail: "",
    monthlyAmountCents: "150000",
    seatsIncluded: "10",
    activeJobsIncluded: "25",
    candidateProcessingIncluded: "1000",
    aiInterviewsIncluded: "250",
    advancedReporting: true,
    calendarIntegrations: true,
    brandedCandidateExperience: false,
    customIntegrations: false,
    note: ""
  };
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "INCOMPLETE" || status === "SUSPENDED" || status === "PAST_DUE") return "warning";
  if (status === "DELETED" || status === "CANCELED") return "danger";
  return "muted";
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isLikelyEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

/* ── Page component ── */

export default function InternalAdminEnterprisePage() {
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [data, setData] = useState<InternalAdminAccountListReadModel | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED" | "DELETED">("ALL");
  const [tabFilter, setTabFilter] = useState<"ALL" | "ACTIVE" | "PENDING">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [generatedCheckoutUrl, setGeneratedCheckoutUrl] = useState<string | null>(null);
  const [form, setForm] = useState<EnterpriseFormState>(createDefaultForm());
  const [showModal, setShowModal] = useState(false);

  /* ── Data fetching ── */

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiClient.internalAdminEnterprise({
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

  /* ── Derived state ── */

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      total: data.summary.enterprise,
      active: data.rows.filter((row) => row.tenantStatus === "ACTIVE").length,
      pending: data.rows.filter((row) => row.billing.status === "INCOMPLETE").length,
      suspended: data.rows.filter((row) => row.tenantStatus === "SUSPENDED").length
    };
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (tabFilter === "ALL") return data.rows;
    if (tabFilter === "ACTIVE") return data.rows.filter((r) => r.tenantStatus === "ACTIVE");
    return data.rows.filter((r) => r.billing.status === "INCOMPLETE");
  }, [data, tabFilter]);

  const enterpriseFormError = useMemo(() => {
    if (!form.companyName.trim()) {
      return locale === "en" ? "Company name is required." : "Şirket adı zorunludur.";
    }
    if (!form.ownerFullName.trim()) {
      return locale === "en" ? "Owner full name is required." : "Hesap sahibi adı zorunludur.";
    }
    if (!isLikelyEmail(form.ownerEmail)) {
      return locale === "en" ? "Enter a valid owner email." : "Geçerli bir owner e-postası girin.";
    }
    if (!isLikelyEmail(form.billingEmail)) {
      return locale === "en" ? "Enter a valid billing email." : "Geçerli bir fatura e-postası girin.";
    }
    if (parsePositiveInteger(form.monthlyAmountCents) === null) {
      return locale === "en" ? "Monthly amount must be a positive integer." : "Aylık tutar pozitif tam sayı olmalıdır.";
    }
    if (parsePositiveInteger(form.seatsIncluded) === null) {
      return locale === "en" ? "Included seats must be a positive integer." : "Kullanıcı limiti pozitif tam sayı olmalıdır.";
    }
    if (parsePositiveInteger(form.activeJobsIncluded) === null) {
      return locale === "en" ? "Included active jobs must be a positive integer." : "Aktif ilan limiti pozitif tam sayı olmalıdır.";
    }
    if (parsePositiveInteger(form.candidateProcessingIncluded) === null) {
      return locale === "en" ? "Included candidate processing must be a positive integer." : "Aday işleme limiti pozitif tam sayı olmalıdır.";
    }
    if (parsePositiveInteger(form.aiInterviewsIncluded) === null) {
      return locale === "en" ? "Included AI interviews must be a positive integer." : "AI mülakat limiti pozitif tam sayı olmalıdır.";
    }
    return "";
  }, [form, locale]);

  /* ── Create enterprise customer ── */

  async function handleCreateEnterpriseCustomer() {
    if (enterpriseFormError) {
      setError(enterpriseFormError);
      return;
    }

    const monthlyAmountCents = parsePositiveInteger(form.monthlyAmountCents);
    const seatsIncluded = parsePositiveInteger(form.seatsIncluded);
    const activeJobsIncluded = parsePositiveInteger(form.activeJobsIncluded);
    const candidateProcessingIncluded = parsePositiveInteger(form.candidateProcessingIncluded);
    const aiInterviewsIncluded = parsePositiveInteger(form.aiInterviewsIncluded);

    if (
      monthlyAmountCents === null ||
      seatsIncluded === null ||
      activeJobsIncluded === null ||
      candidateProcessingIncluded === null ||
      aiInterviewsIncluded === null
    ) {
      setError(locale === "en" ? "Please review the enterprise offer fields." : "Lütfen enterprise teklif alanlarını gözden geçirin.");
      return;
    }

    setBusy("create");
    setError("");
    setNotice("");
    setGeneratedCheckoutUrl(null);

    try {
      const result = await apiClient.internalAdminCreateEnterpriseCustomer({
        companyName: form.companyName.trim(),
        ownerFullName: form.ownerFullName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        billingEmail: form.billingEmail.trim(),
        monthlyAmountCents,
        seatsIncluded,
        activeJobsIncluded,
        candidateProcessingIncluded,
        aiInterviewsIncluded,
        advancedReporting: form.advancedReporting,
        calendarIntegrations: form.calendarIntegrations,
        brandedCandidateExperience: form.brandedCandidateExperience,
        customIntegrations: form.customIntegrations,
        note: form.note || undefined
      });

      setNotice(result.stripeReady ? copy.enterpriseCreated : copy.stripeDisabled);
      setGeneratedCheckoutUrl(result.checkoutUrl);
      setForm(createDefaultForm());
      setShowModal(false);
      await loadPage();
    } catch (createError) {
      setError(translateInternalAdminMessage(toErrorMessage(createError, copy.internalOnly), locale));
    } finally {
      setBusy("");
    }
  }

  function resetForm() {
    setForm(createDefaultForm());
  }

  /* ── Render ── */

  return (
    <section className="page-grid">
      {/* ── Header ── */}
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide
            guideKey="adminEnterprise"
            title={copy.enterpriseTitle}
            subtitle={copy.enterpriseSubtitle}
            style={{ margin: 0 }}
          />
        </div>
      </div>

      {/* ── Notices ── */}
      {notice ? <div className="notice-box notice-success">{notice}</div> : null}
      {error && data ? <div className="notice-box notice-danger">{error}</div> : null}

      {generatedCheckoutUrl ? (
        <section className="panel">
          <div className="tlx-section-header">
            <div>
              <h2 className="tlx-section-title">{copy.generatedLink}</h2>
              <p className="small">{copy.generatedLinkDescription}</p>
            </div>
            <a href={generatedCheckoutUrl} target="_blank" rel="noreferrer" className="btn-primary-sm">
              {copy.openCheckoutLink}
            </a>
          </div>
        </section>
      ) : null}

      {/* ── Loading / Error / Empty ── */}
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
          <EmptyState message={copy.noEnterprise} />
        </section>
      ) : (
        <>
          {/* ── Stat cards (4 cols, Candit-style with icon + colored bg) ── */}
          {summary ? (
            <section className="admin-metric-grid">
              <article className="admin-metric-card tone-primary">
                <span className="admin-metric-icon icon-primary">
                  <IconBuilding />
                </span>
                <span className="admin-metric-label">{copy.enterpriseSummaryTotal}</span>
                <strong className="admin-metric-value">{summary.total}</strong>
              </article>
              <article className="admin-metric-card tone-success">
                <span className="admin-metric-icon icon-success">
                  <IconCheckCircle />
                </span>
                <span className="admin-metric-label">{copy.enterpriseSummaryActive}</span>
                <strong className="admin-metric-value">{summary.active}</strong>
              </article>
              <article className="admin-metric-card tone-warning">
                <span className="admin-metric-icon icon-warning">
                  <IconClock />
                </span>
                <span className="admin-metric-label">{copy.enterpriseSummaryPending}</span>
                <strong className="admin-metric-value">{summary.pending}</strong>
              </article>
              <article className="admin-metric-card tone-muted">
                <span className="admin-metric-icon icon-muted">
                  <IconAlertTriangle />
                </span>
                <span className="admin-metric-label">{copy.enterpriseSummarySuspended}</span>
                <strong className="admin-metric-value">{summary.suspended}</strong>
              </article>
            </section>
          ) : null}

          {/* ── Tab filter bar (pill buttons left + add button right) ── */}
          <div className="admin-tab-bar">
            <div className="admin-tab-group">
              <button
                type="button"
                className={`admin-tab${tabFilter === "ALL" ? " admin-tab-active" : ""}`}
                onClick={() => setTabFilter("ALL")}
              >
                {copy.all} ({data.rows.length})
              </button>
              <button
                type="button"
                className={`admin-tab${tabFilter === "ACTIVE" ? " admin-tab-active" : ""}`}
                onClick={() => setTabFilter("ACTIVE")}
              >
                {copy.active} ({summary?.active ?? 0})
              </button>
              <button
                type="button"
                className={`admin-tab${tabFilter === "PENDING" ? " admin-tab-active" : ""}`}
                onClick={() => setTabFilter("PENDING")}
              >
                {copy.pending} ({summary?.pending ?? 0})
              </button>
            </div>
            <button type="button" className="btn-primary-sm" onClick={() => { resetForm(); setShowModal(true); }}>
              + {copy.createEnterpriseLead}
            </button>
          </div>

          {/* ── Full-width table ── */}
          <section className="panel">
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{copy.customer}</th>
                    <th>{copy.plan}</th>
                    <th>{copy.billingStatus}</th>
                    <th>{copy.nextInvoice}</th>
                    <th>{copy.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message={copy.noEnterprise} />
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.tenantId}>
                        <td>
                          <div className="admin-table-cell-stack">
                            <strong>{row.tenantName}</strong>
                            <span className="small">{row.owner?.email ?? row.billing.billingEmail ?? "\u2014"}</span>
                            <span className={`status-badge status-${statusVariant(row.tenantStatus)}`}>
                              {formatTenantStatus(row.tenantStatus, locale)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="badge info">{formatInternalPlan(row.billing.currentPlanKey, locale)}</span>
                        </td>
                        <td>
                          <span className={`status-badge status-${statusVariant(row.billing.status)}`}>
                            {formatBillingStatus(row.billing.status, locale)}
                          </span>
                        </td>
                        <td>{formatDate(row.billing.currentPeriodEnd)}</td>
                        <td>
                          <Link href={`/admin/users/${row.tenantId}` as Route} className="ghost-button">
                            {copy.openCustomer}
                          </Link>
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

      {/* ── Modal dialog for creating enterprise customer ── */}
      {showModal ? (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{copy.createEnterpriseLead}</h3>
              <button type="button" className="ghost-button" onClick={() => setShowModal(false)}>
                {"\u2715"}
              </button>
            </div>
            <div className="modal-body">
              {enterpriseFormError ? (
                <div className="notice-box notice-danger" style={{ marginBottom: 12 }}>
                  {enterpriseFormError}
                </div>
              ) : null}
              {/* Company name */}
              <div className="field">
                <label className="field-label">{copy.companyName}</label>
                <input className="input" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>

              {/* Owner row */}
              <div className="form-grid">
                <div className="field">
                  <label className="field-label">{copy.ownerFullName}</label>
                  <input className="input" required value={form.ownerFullName} onChange={(e) => setForm({ ...form, ownerFullName: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.ownerEmail}</label>
                  <input className="input" type="email" required value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
                </div>
              </div>

              {/* Billing row */}
              <div className="form-grid">
                <div className="field">
                  <label className="field-label">{copy.billingEmail}</label>
                  <input className="input" type="email" required value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.monthlyAmount}</label>
                  <input className="input" type="number" min={100} step={100} required value={form.monthlyAmountCents} onChange={(e) => setForm({ ...form, monthlyAmountCents: e.target.value })} />
                </div>
              </div>

              {/* Quota row */}
              <div className="admin-detail-grid">
                <div className="field">
                  <label className="field-label">{copy.seatsIncluded}</label>
                  <input className="input" type="number" min={1} step={1} required value={form.seatsIncluded} onChange={(e) => setForm({ ...form, seatsIncluded: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.activeJobsIncluded}</label>
                  <input className="input" type="number" min={1} step={1} required value={form.activeJobsIncluded} onChange={(e) => setForm({ ...form, activeJobsIncluded: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.candidateProcessingIncluded}</label>
                  <input className="input" type="number" min={1} step={1} required value={form.candidateProcessingIncluded} onChange={(e) => setForm({ ...form, candidateProcessingIncluded: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.aiInterviewsIncluded}</label>
                  <input className="input" type="number" min={1} step={1} required value={form.aiInterviewsIncluded} onChange={(e) => setForm({ ...form, aiInterviewsIncluded: e.target.value })} />
                </div>
              </div>

              {/* Feature toggles */}
              <div className="admin-feature-grid">
                {(
                  [
                    { key: "advancedReporting", label: copy.advancedReporting },
                    { key: "calendarIntegrations", label: copy.calendarIntegrations },
                    { key: "brandedCandidateExperience", label: copy.brandedCandidateExperience },
                    { key: "customIntegrations", label: copy.customIntegrations }
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="admin-check-row">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {/* Note */}
              <div className="field">
                <label className="field-label">{copy.note}</label>
                <textarea className="textarea" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost-button" onClick={() => setShowModal(false)}>
                {locale === "en" ? "Cancel" : "Iptal"}
              </button>
              <button type="button" className="btn-primary-sm" onClick={() => void handleCreateEnterpriseCustomer()} disabled={busy !== "" || Boolean(enterpriseFormError)}>
                {busy === "create" ? copy.creating : copy.create}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
