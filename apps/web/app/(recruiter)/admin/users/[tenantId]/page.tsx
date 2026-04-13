"use client";

import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import type { BillingPlanKey, InternalAdminAccountDetailReadModel } from "../../../../../lib/types";

type PlanFormState = {
  planKey: BillingPlanKey;
  seatsIncluded: string;
  activeJobsIncluded: string;
  candidateProcessingIncluded: string;
  aiInterviewsIncluded: string;
};

type GrantFormState = {
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

  return {
    planKey: detail.billing.account.currentPlanKey,
    seatsIncluded: String(currentPlan.seatsIncluded),
    activeJobsIncluded: String(currentPlan.activeJobsIncluded),
    candidateProcessingIncluded: String(currentPlan.candidateProcessingIncluded),
    aiInterviewsIncluded: String(currentPlan.aiInterviewsIncluded)
  };
}

function isTrialAccount(detail: InternalAdminAccountDetailReadModel) {
  return detail.billing.trial.isActive || detail.billing.trial.isExpired;
}

function getLifecycleLabel(detail: InternalAdminAccountDetailReadModel, locale: "tr" | "en") {
  if (detail.billing.trial.isActive) {
    return locale === "en" ? "Trial Active" : "Aktif Deneme";
  }

  if (detail.billing.trial.isExpired) {
    return locale === "en" ? "Trial Expired" : "Deneme Süresi Bitti";
  }

  return formatBillingStatus(detail.billing.account.status, locale);
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
      seatsIncluded: String(planDefaults.seatsIncluded),
      activeJobsIncluded: String(planDefaults.activeJobsIncluded),
      candidateProcessingIncluded: String(planDefaults.candidateProcessingIncluded),
      aiInterviewsIncluded: String(planDefaults.aiInterviewsIncluded)
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
      const result = normalizeAccountDetail(await apiClient.internalAdminUpdateAccountPlan(tenantId, {
        planKey: planForm.planKey,
        seatsIncluded: Number(planForm.seatsIncluded),
        activeJobsIncluded: Number(planForm.activeJobsIncluded),
        candidateProcessingIncluded: Number(planForm.candidateProcessingIncluded),
        aiInterviewsIncluded: Number(planForm.aiInterviewsIncluded)
      }));
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
      const result = normalizeAccountDetail(await apiClient.internalAdminCreateQuotaGrant(tenantId, {
        seats: grantForm.seats ? Number(grantForm.seats) : undefined,
        activeJobs: grantForm.activeJobs ? Number(grantForm.activeJobs) : undefined,
        candidateProcessing: grantForm.candidateProcessing ? Number(grantForm.candidateProcessing) : undefined,
        aiInterviews: grantForm.aiInterviews ? Number(grantForm.aiInterviews) : undefined
      }));
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

  const displayedPlanLabel = formatInternalPlan(detail.billing.account.currentPlanKey, locale);
  const displayedLifecycleLabel = getLifecycleLabel(detail, locale);
  const isTrial = isTrialAccount(detail);
  const trialNote = isTrial
    ? locale === "en"
      ? "This customer is using the trial lifecycle on top of Starter limits."
      : "Bu müşteri, Starter limitleri üzerinde deneme yaşam döngüsünü kullanıyor."
    : "";
  const accountCardTitle = locale === "en" ? "Account" : "Hesap";
  const accountCardSubtitle = locale === "en" ? "Customer workspace and owner details." : "Müşteri hesabı ve sahip bilgileri.";
  const billingSummaryTitle = locale === "en" ? "Subscription Summary" : "Abonelik Özeti";
  const billingSummarySubtitle = isTrial
    ? locale === "en"
      ? "Plan and lifecycle are shown separately for trial accounts."
      : "Deneme hesaplarında plan ve yaşam döngüsü ayrı gösterilir."
    : locale === "en"
      ? "Current billing state and renewal window."
      : "Güncel abonelik durumu ve yenileme dönemi.";
  const adminActionsTitle = locale === "en" ? "Account Actions" : "Hesap İşlemleri";
  const adminActionsSubtitle = locale === "en"
    ? "Use only for access and owner login operations."
    : "Sadece erişim ve sahip giriş işlemleri için kullanın.";
  const billingSettingsTitle = locale === "en" ? "Plan and Limits" : "Plan ve Limitler";
  const billingSettingsSubtitle = locale === "en"
    ? "Change the package or adjust included limits for this customer."
    : "Bu müşteri için paketi değiştirin veya dahil limitleri düzenleyin.";
  const quotaTitle = locale === "en" ? "Extra Limits" : "Ek Limitler";
  const quotaSubtitle = locale === "en"
    ? "Adds extra usage rights on top of the current package."
    : "Mevcut paketin üzerine ek kullanım hakkı tanımlar.";
  const paymentLinksTitle = locale === "en" ? "Payment Links" : "Ödeme Linkleri";
  const paymentLinksSubtitle = locale === "en"
    ? "Recent checkout links created for this customer."
    : "Bu müşteri için oluşturulan son ödeme linkleri.";
  const recentCheckouts = detail.activity?.recentCheckouts ?? [];
  const packageLabel = locale === "en" ? "Package" : "Paket";
  const lifecycleLabel = locale === "en" ? "Lifecycle" : "Yaşam Döngüsü";
  const planSaveHint = isTrial
    ? locale === "en"
      ? "If you move this customer to Growth or Enterprise, the trial lifecycle ends and the account becomes active on that package."
      : "Bu müşteri Growth veya Enterprise pakete alınırsa deneme yaşam döngüsü biter ve hesap seçilen pakette aktif hale gelir."
    : locale === "en"
      ? "Use this area only to change package limits for the customer."
      : "Bu alanı sadece müşteri paketini veya dahil limitleri değiştirmek için kullanın.";
  const quotaInputHint = locale === "en"
    ? "Enter only the extra amount you want to add."
    : "Sadece eklemek istediğiniz ilave adedi girin.";
  const activateLabel = locale === "en" ? "Activate Account" : "Hesabı Aktifleştir";
  const suspendLabel = locale === "en" ? "Suspend Account" : "Hesabı Askıya Al";
  const deleteLabel = locale === "en" ? "Mark as Deleted" : "Silinmiş Olarak İşaretle";
  const ownerResetLabel = locale === "en" ? "Send Owner Login Link" : "Sahibe Giriş Linki Gönder";

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
            {displayedLifecycleLabel}
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
            <li><span>{packageLabel}</span><strong>{displayedPlanLabel}</strong></li>
            <li><span>{lifecycleLabel}</span><strong>{displayedLifecycleLabel}</strong></li>
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
                  <label className="field-label">{copy.planKey}</label>
                  <select className="select" value={planForm.planKey} onChange={(event) => handlePlanKeyChange(event.target.value as BillingPlanKey)}>
                    <option value="STARTER">{formatInternalPlan("STARTER", locale)}</option>
                    <option value="GROWTH">{formatInternalPlan("GROWTH", locale)}</option>
                    <option value="ENTERPRISE">{formatInternalPlan("ENTERPRISE", locale)}</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">{copy.billingStatus}</label>
                  <div className="input admin-readonly-field">{displayedLifecycleLabel}</div>
                </div>
              </div>

              <p className="admin-form-note">{isTrial ? trialNote : planSaveHint}</p>

              <div className="admin-detail-grid">
                <div className="field">
                  <label className="field-label">{copy.seatsIncluded}</label>
                  <input type="number" min="0" step="1" className="input" value={planForm.seatsIncluded} onChange={(event) => setPlanForm({ ...planForm, seatsIncluded: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.activeJobsIncluded}</label>
                  <input type="number" min="0" step="1" className="input" value={planForm.activeJobsIncluded} onChange={(event) => setPlanForm({ ...planForm, activeJobsIncluded: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.candidateProcessingIncluded}</label>
                  <input type="number" min="0" step="1" className="input" value={planForm.candidateProcessingIncluded} onChange={(event) => setPlanForm({ ...planForm, candidateProcessingIncluded: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{copy.aiInterviewsIncluded}</label>
                  <input type="number" min="0" step="1" className="input" value={planForm.aiInterviewsIncluded} onChange={(event) => setPlanForm({ ...planForm, aiInterviewsIncluded: event.target.value })} />
                </div>
              </div>

              <div className="admin-inline-actions">
                <button type="button" className="btn-primary-sm" onClick={() => void handlePlanSave()} disabled={busyAction !== ""}>
                  {busyAction === "plan" ? copy.saving : copy.saveChanges}
                </button>
              </div>
            </div>
          </section>

          <section className="panel admin-detail-card">
            <div className="admin-panel-head">
              <h2>{quotaTitle}</h2>
              <p>{quotaSubtitle}</p>
            </div>
            <div className="form-grid admin-compact-form">
              <p className="admin-form-note">{quotaInputHint}</p>

              <div className="admin-detail-grid">
                <div className="field">
                  <label className="field-label">{locale === "en" ? "Extra Seats" : "Ek Kullanıcı"}</label>
                  <input type="number" min="0" step="1" className="input" value={grantForm.seats} onChange={(event) => setGrantForm({ ...grantForm, seats: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{locale === "en" ? "Extra Active Jobs" : "Ek Aktif İlan"}</label>
                  <input type="number" min="0" step="1" className="input" value={grantForm.activeJobs} onChange={(event) => setGrantForm({ ...grantForm, activeJobs: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{locale === "en" ? "Extra Candidate Processing" : "Ek Aday İşleme"}</label>
                  <input type="number" min="0" step="1" className="input" value={grantForm.candidateProcessing} onChange={(event) => setGrantForm({ ...grantForm, candidateProcessing: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">{locale === "en" ? "Extra AI Interviews" : "Ek AI Mülakat"}</label>
                  <input type="number" min="0" step="1" className="input" value={grantForm.aiInterviews} onChange={(event) => setGrantForm({ ...grantForm, aiInterviews: event.target.value })} />
                </div>
              </div>

              <div className="admin-inline-actions">
                <button type="button" className="btn-primary-sm" onClick={() => void handleGrantSubmit()} disabled={busyAction !== ""}>
                  {busyAction === "grant" ? copy.processing : locale === "en" ? "Save Extra Limits" : "Ek Limitleri Kaydet"}
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
                {busyAction === "status:ACTIVE" ? copy.processing : activateLabel}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleStatusUpdate("SUSPENDED")}
                disabled={busyAction !== "" || detail.tenant.status === "SUSPENDED"}
              >
                {busyAction === "status:SUSPENDED" ? copy.processing : suspendLabel}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleStatusUpdate("DELETED")}
                disabled={busyAction !== "" || detail.tenant.status === "DELETED"}
              >
                {busyAction === "status:DELETED" ? copy.processing : deleteLabel}
              </button>
              <button type="button" className="btn-primary-sm" onClick={() => void handleOwnerReset()} disabled={busyAction !== "" || !detail.owner}>
                {busyAction === "owner-reset" ? copy.processing : ownerResetLabel}
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
