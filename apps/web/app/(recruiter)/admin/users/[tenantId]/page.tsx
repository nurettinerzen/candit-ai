"use client";

import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../../../components/ui-states";
import { useUiText } from "../../../../../components/site-language-provider";
import { apiClient } from "../../../../../lib/api-client";
import { formatDate, formatDateOnly } from "../../../../../lib/format";
import {
  formatBillingStatus,
  formatGenericDeliveryStatus,
  formatInternalPlan,
  formatTenantStatus,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../../lib/internal-admin-copy";
import type { SiteLocale } from "../../../../../lib/i18n";
import type { BillingPlanKey, InternalAdminAccountDetailReadModel } from "../../../../../lib/types";

type PlanFormState = {
  planKey: BillingPlanKey;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
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

type GrantFormState = {
  label: string;
  seats: string;
  activeJobs: string;
  candidateProcessing: string;
  aiInterviews: string;
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "TRIALING" || status === "SUSPENDED" || status === "PAST_DUE" || status === "INCOMPLETE") return "warning";
  if (status === "DELETED" || status === "CANCELED" || status === "DISABLED") return "danger";
  return "muted";
}

function createEmptyGrantForm(): GrantFormState {
  return {
    label: "",
    seats: "",
    activeJobs: "",
    candidateProcessing: "",
    aiInterviews: ""
  };
}

function confirmAdminAction(message: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(message);
}

function buildPlanFormState(detail: InternalAdminAccountDetailReadModel): PlanFormState {
  const currentPlan = detail.billing.currentPlan;
  const account = detail.billing.account;

  return {
    planKey: detail.billing.account.currentPlanKey,
    status: (account.status as PlanFormState["status"]) ?? "ACTIVE",
    monthlyAmountCents: String(currentPlan.monthlyAmountCents ?? ""),
    seatsIncluded: String(currentPlan.seatsIncluded),
    activeJobsIncluded: String(currentPlan.activeJobsIncluded),
    candidateProcessingIncluded: String(currentPlan.candidateProcessingIncluded),
    aiInterviewsIncluded: String(currentPlan.aiInterviewsIncluded),
    advancedReporting: account.features.advancedReporting,
    calendarIntegrations: account.features.calendarIntegrations,
    brandedCandidateExperience: account.features.brandedCandidateExperience,
    customIntegrations: account.features.customIntegrations,
    note: ""
  };
}

function isTrialAccount(detail: InternalAdminAccountDetailReadModel) {
  return detail.billing.trial.isActive || detail.billing.trial.isExpired;
}

function getDisplayedPlanLabel(
  detail: InternalAdminAccountDetailReadModel,
  locale: SiteLocale,
  copy: ReturnType<typeof getInternalAdminCopy>
) {
  return isTrialAccount(detail) ? copy.segmentTrial : formatInternalPlan(detail.billing.account.currentPlanKey, locale);
}

function normalizeAccountDetail(detail: InternalAdminAccountDetailReadModel): InternalAdminAccountDetailReadModel {
  return {
    ...detail,
    activity: {
      recentCheckouts: Array.isArray(detail.activity?.recentCheckouts) ? detail.activity.recentCheckouts : []
    }
  };
}

export default function InternalAdminAccountDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { locale } = useUiText();
  const copy = getInternalAdminCopy(locale);

  const [detail, setDetail] = useState<InternalAdminAccountDetailReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [planForm, setPlanForm] = useState<PlanFormState | null>(null);
  const [grantForm, setGrantForm] = useState<GrantFormState>(createEmptyGrantForm());

  const loadPage = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError("");

    try {
      const result = normalizeAccountDetail(await apiClient.internalAdminAccountDetail(tenantId));
      setDetail(result);
      setPlanForm(buildPlanFormState(result));
    } catch (loadError) {
      setDetail(null);
      setError(translateInternalAdminMessage(toErrorMessage(loadError, copy.internalOnly), locale));
    } finally {
      setLoading(false);
    }
  }, [copy.internalOnly, locale, tenantId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const selectedPlanDefaults = useMemo(() => {
    if (!detail || !planForm) return null;
    return detail.billing.planCatalog.find((plan) => plan.key === planForm.planKey) ?? null;
  }, [detail, planForm]);

  function handlePlanKeyChange(nextPlanKey: BillingPlanKey) {
    if (!detail || !planForm) return;

    const planDefaults = detail.billing.planCatalog.find((plan) => plan.key === nextPlanKey);
    if (!planDefaults) {
      setPlanForm({ ...planForm, planKey: nextPlanKey });
      return;
    }

    setPlanForm({
      ...planForm,
      planKey: nextPlanKey,
      monthlyAmountCents: nextPlanKey === "ENTERPRISE" ? planForm.monthlyAmountCents : String(planDefaults.monthlyAmountCents ?? ""),
      seatsIncluded: String(planDefaults.seatsIncluded),
      activeJobsIncluded: String(planDefaults.activeJobsIncluded),
      candidateProcessingIncluded: String(planDefaults.candidateProcessingIncluded),
      aiInterviewsIncluded: String(planDefaults.aiInterviewsIncluded),
      advancedReporting: planDefaults.features.advancedReporting,
      calendarIntegrations: planDefaults.features.calendarIntegrations,
      brandedCandidateExperience: planDefaults.features.brandedCandidateExperience,
      customIntegrations: planDefaults.features.customIntegrations
    });
  }

  async function handleStatusUpdate(status: "ACTIVE" | "SUSPENDED" | "DELETED") {
    if (!tenantId) return;

    const approved = confirmAdminAction(
      status === "ACTIVE"
        ? locale === "en"
          ? "Activate this customer account?"
          : "Bu müşteri hesabı aktifleştirilsin mi?"
        : status === "SUSPENDED"
          ? locale === "en"
            ? "Suspend this customer account?"
            : "Bu müşteri hesabı askıya alınsın mı?"
          : locale === "en"
            ? "Mark this customer account as deleted?"
            : "Bu müşteri hesabı silinmiş olarak işaretlensin mi?"
    );
    if (!approved) return;

    setBusyAction(`status:${status}`);
    setNotice("");
    setError("");

    try {
      await apiClient.internalAdminUpdateAccountStatus(tenantId, { status });
      setNotice(copy.workspaceStatusSaved);
      await loadPage();
    } catch (actionError) {
      setError(translateInternalAdminMessage(toErrorMessage(actionError, copy.internalOnly), locale));
    } finally {
      setBusyAction("");
    }
  }

  async function handleOwnerReset() {
    if (!tenantId) return;

    const approved = confirmAdminAction(
      locale === "en"
        ? "Send a fresh owner access link?"
        : "Hesap sahibine yeni erişim bağlantısı gönderilsin mi?"
    );
    if (!approved) return;

    setBusyAction("owner-reset");
    setNotice("");
    setError("");

    try {
      await apiClient.internalAdminSendOwnerResetInvite(tenantId);
      setNotice(copy.ownerResetSent);
      await loadPage();
    } catch (actionError) {
      setError(translateInternalAdminMessage(toErrorMessage(actionError, copy.internalOnly), locale));
    } finally {
      setBusyAction("");
    }
  }

  async function handlePlanSave() {
    if (!tenantId || !planForm) return;

    setBusyAction("plan");
    setNotice("");
    setError("");

    try {
      const result = await apiClient.internalAdminUpdateAccountPlan(tenantId, {
        planKey: planForm.planKey,
        status: planForm.status,
        monthlyAmountCents: planForm.monthlyAmountCents ? Number(planForm.monthlyAmountCents) : undefined,
        seatsIncluded: Number(planForm.seatsIncluded),
        activeJobsIncluded: Number(planForm.activeJobsIncluded),
        candidateProcessingIncluded: Number(planForm.candidateProcessingIncluded),
        aiInterviewsIncluded: Number(planForm.aiInterviewsIncluded),
        advancedReporting: planForm.advancedReporting,
        calendarIntegrations: planForm.calendarIntegrations,
        brandedCandidateExperience: planForm.brandedCandidateExperience,
        customIntegrations: planForm.customIntegrations,
        note: planForm.note || undefined
      });
      setDetail(result);
      setPlanForm(buildPlanFormState(result));
      setNotice(copy.planSaved);
    } catch (actionError) {
      setError(translateInternalAdminMessage(toErrorMessage(actionError, copy.internalOnly), locale));
    } finally {
      setBusyAction("");
    }
  }

  async function handleGrantSubmit() {
    if (!tenantId) return;

    setBusyAction("grant");
    setNotice("");
    setError("");

    try {
      const result = await apiClient.internalAdminCreateQuotaGrant(tenantId, {
        label: grantForm.label || undefined,
        seats: grantForm.seats ? Number(grantForm.seats) : undefined,
        activeJobs: grantForm.activeJobs ? Number(grantForm.activeJobs) : undefined,
        candidateProcessing: grantForm.candidateProcessing ? Number(grantForm.candidateProcessing) : undefined,
        aiInterviews: grantForm.aiInterviews ? Number(grantForm.aiInterviews) : undefined
      });
      setDetail(result);
      setPlanForm(buildPlanFormState(result));
      setGrantForm(createEmptyGrantForm());
      setNotice(copy.quotaSaved);
    } catch (actionError) {
      setError(translateInternalAdminMessage(toErrorMessage(actionError, copy.internalOnly), locale));
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return (
      <section className="page-grid">
        <section className="panel">
          <LoadingState message={copy.loading} />
        </section>
      </section>
    );
  }

  if (error && !detail) {
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

  if (!detail || !planForm) {
    return (
      <section className="page-grid">
        <section className="panel">
          <EmptyState message={copy.noData} />
        </section>
      </section>
    );
  }

  const displayedPlanLabel = getDisplayedPlanLabel(detail, locale, copy);
  const isTrial = isTrialAccount(detail);
  const planFieldHint = isTrial
    ? locale === "en"
      ? "Trial status is tracked separately from the base catalog plan."
      : "Deneme durumu, temel katalog plandan ayrı takip edilir."
    : "";
  const accountCardTitle = locale === "en" ? "Account" : "Hesap";
  const accountCardSubtitle = locale === "en" ? "Customer workspace and owner details." : "Müşteri hesabı ve sahip bilgileri.";
  const billingSummaryTitle = locale === "en" ? "Subscription Summary" : "Abonelik Özeti";
  const billingSummarySubtitle = isTrial
    ? locale === "en"
      ? "Trial lifecycle is shown separately from the base catalog plan."
      : "Deneme yaşam döngüsü, temel katalog plandan ayrı gösterilir."
    : locale === "en"
      ? "Current billing state and renewal window."
      : "Güncel abonelik durumu ve yenileme dönemi.";
  const adminActionsTitle = locale === "en" ? "Admin Actions" : "Yönetim İşlemleri";
  const adminActionsSubtitle = locale === "en"
    ? "Use only when you need to change customer access."
    : "Sadece müşteri erişimini değiştirmek gerektiğinde kullanın.";
  const billingSettingsTitle = locale === "en" ? "Plan Settings" : "Plan Ayarları";
  const billingSettingsSubtitle = locale === "en"
    ? "Adjust the base plan, billing status, limits, and enabled capabilities."
    : "Temel planı, abonelik durumunu, limitleri ve açık özellikleri yönetin.";
  const quotaTitle = locale === "en" ? "Manual Quota" : "Manuel Kota";
  const quotaSubtitle = locale === "en"
    ? "Add temporary quota on top of the current plan when needed."
    : "Gerektiğinde mevcut planın üzerine geçici kota tanımlayın.";
  const paymentLinksTitle = locale === "en" ? "Payment Links" : "Ödeme Linkleri";
  const paymentLinksSubtitle = locale === "en"
    ? "Recent checkout links created for this customer."
    : "Bu müşteri için oluşturulan son ödeme linkleri.";
  const recentCheckouts = detail.activity?.recentCheckouts ?? [];

  return (
    <section className="page-grid admin-detail-page">
      <Link href={"/admin/users" as Route} className="ghost-button admin-inline-back">
        ← {copy.backToUsers}
      </Link>

      <div className="page-header">
        <div className="page-header-copy">
          <h1>{detail.tenant.name}</h1>
          <p>{copy.accountDetailSubtitle}</p>
        </div>
        <div className="page-header-actions">
          <span className={`status-badge status-${statusVariant(detail.tenant.status)}`}>
            {formatTenantStatus(detail.tenant.status, locale)}
          </span>
          <span className={`status-badge status-${statusVariant(detail.billing.account.status)}`}>
            {formatBillingStatus(detail.billing.account.status, locale)}
          </span>
        </div>
      </div>

      {notice ? <div className="notice-box notice-success">{notice}</div> : null}
      {error && detail ? <div className="notice-box notice-danger">{error}</div> : null}

      <div className="admin-detail-top-grid">
        <section className="panel admin-detail-card">
          <div className="admin-panel-head">
            <h2>{accountCardTitle}</h2>
            <p>{accountCardSubtitle}</p>
          </div>
          <ul className="admin-detail-list admin-kv-list">
            <li><span>{copy.companyName}</span><strong>{detail.tenant.name}</strong></li>
            <li><span>{copy.ownerFullName}</span><strong>{detail.owner?.fullName ?? "—"}</strong></li>
            <li><span>{copy.ownerEmail}</span><strong>{detail.owner?.email ?? "—"}</strong></li>
            <li><span>{copy.workspaceStatus}</span><strong>{formatTenantStatus(detail.tenant.status, locale)}</strong></li>
            <li><span>{copy.createdAt}</span><strong>{formatDateOnly(detail.tenant.createdAt)}</strong></li>
          </ul>
        </section>

        <section className="panel admin-detail-card">
          <div className="admin-panel-head">
            <h2>{billingSummaryTitle}</h2>
            <p>{billingSummarySubtitle}</p>
          </div>
          <ul className="admin-detail-list admin-kv-list">
            <li><span>{copy.currentPlan}</span><strong>{displayedPlanLabel}</strong></li>
            <li><span>{copy.billingStatus}</span><strong>{formatBillingStatus(detail.billing.account.status, locale)}</strong></li>
            <li><span>{copy.billingEmail}</span><strong>{detail.billing.account.billingEmail ?? "—"}</strong></li>
            <li>
              <span>{detail.billing.trial.isActive || detail.billing.trial.isExpired ? copy.trialStartedAt : copy.createdAt}</span>
              <strong>
                {detail.billing.trial.startedAt
                  ? formatDateOnly(detail.billing.trial.startedAt)
                  : formatDateOnly(detail.tenant.createdAt)}
              </strong>
            </li>
            <li>
              <span>{detail.billing.trial.isActive || detail.billing.trial.isExpired ? copy.trialEndsAt : copy.nextInvoice}</span>
              <strong>{formatDateOnly(detail.billing.trial.endsAt ?? detail.billing.account.currentPeriodEnd)}</strong>
            </li>
          </ul>
        </section>
      </div>

      <div className="admin-detail-main-grid">
        <div className="admin-section-stack">
          <section className="panel admin-detail-card">
            <div className="admin-panel-head">
              <h2>{billingSettingsTitle}</h2>
              <p>{billingSettingsSubtitle}</p>
            </div>
            <div className="form-grid admin-compact-form">
              <div className="admin-detail-grid">
                <div className="field">
                  <label className="field-label">{isTrial ? copy.basePlan : copy.planKey}</label>
                  <select className="select" value={planForm.planKey} onChange={(event) => handlePlanKeyChange(event.target.value as BillingPlanKey)}>
                    <option value="STARTER">{formatInternalPlan("STARTER", locale)}</option>
                    <option value="GROWTH">{formatInternalPlan("GROWTH", locale)}</option>
                    <option value="ENTERPRISE">{formatInternalPlan("ENTERPRISE", locale)}</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">{copy.billingStatus}</label>
                  <select
                    className="select"
                    value={planForm.status}
                    onChange={(event) => setPlanForm({ ...planForm, status: event.target.value as PlanFormState["status"] })}
                  >
                    {(["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE", "CANCELED"] as const).map((status) => (
                      <option key={status} value={status}>
                        {formatBillingStatus(status, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {planFieldHint ? <p className="admin-form-note">{planFieldHint}</p> : null}

              <div className="field">
                <label className="field-label">{copy.monthlyAmount}</label>
                <input
                  className="input"
                  value={planForm.monthlyAmountCents}
                  onChange={(event) => setPlanForm({ ...planForm, monthlyAmountCents: event.target.value })}
                />
              </div>

              <div className="admin-detail-grid">
                <div className="field">
                  <label className="field-label">{copy.seatsIncluded}</label>
                  <input className="input" value={planForm.seatsIncluded} onChange={(event) => setPlanForm({ ...planForm, seatsIncluded: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.activeJobsIncluded}</label>
                  <input className="input" value={planForm.activeJobsIncluded} onChange={(event) => setPlanForm({ ...planForm, activeJobsIncluded: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.candidateProcessingIncluded}</label>
                  <input className="input" value={planForm.candidateProcessingIncluded} onChange={(event) => setPlanForm({ ...planForm, candidateProcessingIncluded: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.aiInterviewsIncluded}</label>
                  <input className="input" value={planForm.aiInterviewsIncluded} onChange={(event) => setPlanForm({ ...planForm, aiInterviewsIncluded: event.target.value })} />
                </div>
              </div>

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
                      checked={planForm[key]}
                      onChange={(event) =>
                        setPlanForm({
                          ...planForm,
                          [key]: event.target.checked
                        })
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div className="field">
                <label className="field-label">{copy.note}</label>
                <textarea className="textarea" value={planForm.note} onChange={(event) => setPlanForm({ ...planForm, note: event.target.value })} />
              </div>

              <div className="admin-inline-actions">
                <button type="button" className="btn-primary-sm" onClick={() => void handlePlanSave()} disabled={busyAction !== ""}>
                  {busyAction === "plan" ? copy.saving : copy.saveChanges}
                </button>
                {selectedPlanDefaults ? (
                  <span className="small">
                    {locale === "en" ? "Base catalog" : "Temel katalog"}: {formatInternalPlan(selectedPlanDefaults.key, locale)}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel admin-detail-card">
            <div className="admin-panel-head">
              <h2>{quotaTitle}</h2>
              <p>{quotaSubtitle}</p>
            </div>
            <div className="form-grid admin-compact-form">
              <div className="field">
                <label className="field-label">{copy.grantLabel}</label>
                <input className="input" value={grantForm.label} onChange={(event) => setGrantForm({ ...grantForm, label: event.target.value })} />
              </div>

              <div className="admin-detail-grid">
                <div className="field">
                  <label className="field-label">{copy.grantSeats}</label>
                  <input className="input" value={grantForm.seats} onChange={(event) => setGrantForm({ ...grantForm, seats: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.grantActiveJobs}</label>
                  <input className="input" value={grantForm.activeJobs} onChange={(event) => setGrantForm({ ...grantForm, activeJobs: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.grantCandidateProcessing}</label>
                  <input className="input" value={grantForm.candidateProcessing} onChange={(event) => setGrantForm({ ...grantForm, candidateProcessing: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.grantAiInterviews}</label>
                  <input className="input" value={grantForm.aiInterviews} onChange={(event) => setGrantForm({ ...grantForm, aiInterviews: event.target.value })} />
                </div>
              </div>

              <div className="admin-inline-actions">
                <button type="button" className="btn-primary-sm" onClick={() => void handleGrantSubmit()} disabled={busyAction !== ""}>
                  {busyAction === "grant" ? copy.processing : copy.addQuota}
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="admin-section-stack">
          <section className="panel admin-detail-card">
            <div className="admin-panel-head">
              <h2>{adminActionsTitle}</h2>
              <p>{adminActionsSubtitle}</p>
            </div>
            <div className="admin-action-stack">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleStatusUpdate("ACTIVE")}
                disabled={busyAction !== "" || detail.tenant.status === "ACTIVE"}
              >
                {busyAction === "status:ACTIVE" ? copy.processing : copy.activateWorkspaceConfirm}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleStatusUpdate("SUSPENDED")}
                disabled={busyAction !== "" || detail.tenant.status === "SUSPENDED"}
              >
                {busyAction === "status:SUSPENDED" ? copy.processing : copy.suspendWorkspaceConfirm}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleStatusUpdate("DELETED")}
                disabled={busyAction !== "" || detail.tenant.status === "DELETED"}
              >
                {busyAction === "status:DELETED" ? copy.processing : copy.deleteWorkspaceConfirm}
              </button>
              <button type="button" className="btn-primary-sm" onClick={() => void handleOwnerReset()} disabled={busyAction !== "" || !detail.owner}>
                {busyAction === "owner-reset" ? copy.processing : copy.sendResetLink}
              </button>
            </div>
          </section>

          <section className="panel admin-detail-card">
            <div className="admin-panel-head">
              <h2>{paymentLinksTitle}</h2>
              <p>{paymentLinksSubtitle}</p>
            </div>
            {recentCheckouts.length === 0 ? (
              <EmptyState message={copy.noRecentCheckouts} />
            ) : (
              <div className="admin-stack">
                {recentCheckouts.map((checkout) => (
                  <div key={checkout.id} className="admin-list-row">
                    <div>
                      <strong>{checkout.label ?? checkout.checkoutType}</strong>
                      <p className="small">{formatDate(checkout.createdAt)}</p>
                    </div>
                    <div className="admin-inline-actions">
                      <span className={`admin-inline-status tone-${statusVariant(checkout.status)}`}>
                        {formatGenericDeliveryStatus(checkout.status, locale)}
                      </span>
                      {checkout.checkoutUrl ? (
                        <a href={checkout.checkoutUrl} target="_blank" rel="noreferrer" className="ghost-button">
                          {copy.openCheckoutLink}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
