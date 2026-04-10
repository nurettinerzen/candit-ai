"use client";

import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../../../components/ui-states";
import { useUiText } from "../../../../../components/site-language-provider";
import { apiClient } from "../../../../../lib/api-client";
import { formatDate } from "../../../../../lib/format";
import {
  formatBillingStatus,
  formatGenericDeliveryStatus,
  formatInternalPlan,
  formatInternalRole,
  formatJobStatus,
  formatMemberStatus,
  formatTenantStatus,
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../../lib/internal-admin-copy";
import type { BillingPlanKey, InternalAdminAccountDetailReadModel } from "../../../../../lib/types";

type PlanFormState = {
  planKey: BillingPlanKey;
  billingEmail: string;
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
    billingEmail: account.billingEmail ?? "",
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
      const result = await apiClient.internalAdminAccountDetail(tenantId);
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

  const currentPlanDefaults = useMemo(() => {
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

    if (status === "SUSPENDED") {
      const approved = confirmAdminAction(
        locale === "en"
          ? "Suspend this workspace? Recruiter access will be blocked until re-activated."
          : "Bu workspace askıya alınsın mı? Recruiter erişimi tekrar aktive edilene kadar kapanacak."
      );
      if (!approved) return;
    }

    if (status === "DELETED") {
      const approved = confirmAdminAction(
        locale === "en"
          ? "Delete this workspace? This is a destructive admin action."
          : "Bu workspace silinsin mi? Bu işlem yıkıcı bir yönetim aksiyonudur."
      );
      if (!approved) return;
    }

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
        ? "Send a password reset invite to the workspace owner?"
        : "Workspace sahibine şifre sıfırlama daveti gönderilsin mi?"
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
        billingEmail: planForm.billingEmail || undefined,
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

  const quotaMap = new Map(detail.billing.usage.quotas.map((quota) => [quota.key, quota]));

  return (
    <section className="page-grid">
      <div className="page-header">
        <div className="page-header-copy">
          <Link href={"/admin/users" as Route} className="ghost-button admin-inline-back">
            ← {copy.backToUsers}
          </Link>
          <h1>{detail.tenant.name}</h1>
          <p>{copy.accountDetailSubtitle}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="ghost-button" onClick={() => void loadPage()}>
            {copy.refresh}
          </button>
        </div>
      </div>

      {notice ? <div className="notice-box notice-success">{notice}</div> : null}
      {error && detail ? <div className="notice-box notice-danger">{error}</div> : null}

      <section className="admin-metric-grid">
        <article className="admin-metric-card tone-primary">
          <span className="admin-metric-label">{copy.currentPlan}</span>
          <strong className="admin-metric-value">{formatInternalPlan(detail.billing.account.currentPlanKey, locale)}</strong>
          <p className="admin-metric-copy">{formatBillingStatus(detail.billing.account.status, locale)}</p>
        </article>
        <article className="admin-metric-card tone-success">
          <span className="admin-metric-label">{copy.teamMembers}</span>
          <strong className="admin-metric-value">{detail.members.length}</strong>
        </article>
        <article className="admin-metric-card tone-warning">
          <span className="admin-metric-label">{copy.quotaLabelCandidateProcessing}</span>
          <strong className="admin-metric-value">
            {quotaMap.get("CANDIDATE_PROCESSING")?.used ?? 0}/{quotaMap.get("CANDIDATE_PROCESSING")?.limit ?? 0}
          </strong>
        </article>
        <article className="admin-metric-card tone-info">
          <span className="admin-metric-label">{copy.quotaLabelAiInterviews}</span>
          <strong className="admin-metric-value">
            {quotaMap.get("AI_INTERVIEWS")?.used ?? 0}/{quotaMap.get("AI_INTERVIEWS")?.limit ?? 0}
          </strong>
        </article>
      </section>

      <section className="admin-detail-layout">
        <div className="admin-section-stack">
          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.overview}</h2>
            </div>
            <div className="admin-detail-grid">
              <article className="admin-subtle-card">
                <span className="section-label">{copy.workspace}</span>
                <ul className="admin-detail-list">
                  <li><span>{copy.workspaceStatus}</span><strong>{formatTenantStatus(detail.tenant.status, locale)}</strong></li>
                  <li><span>{copy.createdAt}</span><strong>{formatDate(detail.tenant.createdAt)}</strong></li>
                  <li><span>Locale</span><strong>{detail.tenant.locale}</strong></li>
                  <li><span>Timezone</span><strong>{detail.tenant.timezone}</strong></li>
                </ul>
              </article>
              <article className="admin-subtle-card">
                <span className="section-label">{copy.billing}</span>
                <ul className="admin-detail-list">
                  <li><span>{copy.billingEmail}</span><strong>{detail.billing.account.billingEmail ?? "—"}</strong></li>
                  <li><span>{copy.currentPlan}</span><strong>{formatInternalPlan(detail.billing.account.currentPlanKey, locale)}</strong></li>
                  <li><span>{copy.billingStatus}</span><strong>{formatBillingStatus(detail.billing.account.status, locale)}</strong></li>
                  <li><span>{copy.nextInvoice}</span><strong>{formatDate(detail.billing.account.currentPeriodEnd)}</strong></li>
                </ul>
              </article>
              <article className="admin-subtle-card">
                <span className="section-label">{copy.trialLifecycle}</span>
                <ul className="admin-detail-list">
                  <li>
                    <span>{copy.trialStatus}</span>
                    <strong>
                      {detail.billing.trial.isActive
                        ? copy.trialActive
                        : detail.billing.trial.isExpired
                          ? copy.trialExpired
                          : "—"}
                    </strong>
                  </li>
                  <li>
                    <span>{copy.trialStartedAt}</span>
                    <strong>{detail.billing.trial.startedAt ? formatDate(detail.billing.trial.startedAt) : "—"}</strong>
                  </li>
                  <li>
                    <span>{copy.trialEndsAt}</span>
                    <strong>{detail.billing.trial.endsAt ? formatDate(detail.billing.trial.endsAt) : "—"}</strong>
                  </li>
                  <li>
                    <span>{copy.daysRemaining}</span>
                    <strong>{detail.billing.trial.isActive ? detail.billing.trial.daysRemaining : "—"}</strong>
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.teamMembers}</h2>
            </div>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{copy.owner}</th>
                    <th>{copy.status}</th>
                    <th>{copy.createdAt}</th>
                    <th>{copy.lastLogin}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.members.map((member) => (
                    <tr key={member.userId}>
                      <td>
                        <div className="admin-table-cell-stack">
                          <strong>{member.fullName}</strong>
                          <span className="small">{member.email}</span>
                          <span className="small">{formatInternalRole(member.role, locale)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge status-${statusVariant(member.status)}`}>
                          {formatMemberStatus(member.status, locale)}
                        </span>
                      </td>
                      <td>{formatDate(member.createdAt)}</td>
                      <td>{member.lastLoginAt ? formatDate(member.lastLoginAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.recentActivity}</h2>
            </div>
            <div className="admin-detail-grid">
              <article className="admin-subtle-card">
                <span className="section-label">{copy.recentJobs}</span>
                {detail.activity.recentJobs.length === 0 ? (
                  <EmptyState message={copy.noRecentJobs} />
                ) : (
                  <div className="admin-stack">
                    {detail.activity.recentJobs.map((job) => (
                      <div key={job.id} className="admin-list-row">
                        <div>
                          <strong>{job.title}</strong>
                          <p className="small">{formatDate(job.createdAt)}</p>
                        </div>
                        <span className={`status-badge status-${statusVariant(job.status)}`}>
                          {formatJobStatus(job.status, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <article className="admin-subtle-card">
                <span className="section-label">{copy.recentNotifications}</span>
                {detail.activity.recentNotifications.length === 0 ? (
                  <EmptyState message={copy.noRecentNotifications} />
                ) : (
                  <div className="admin-stack">
                    {detail.activity.recentNotifications.map((notification) => (
                      <div key={notification.id} className="admin-list-row">
                        <div>
                          <strong>{notification.subject ?? notification.channel}</strong>
                          <p className="small">{notification.toAddress}</p>
                        </div>
                        <span className={`status-badge status-${statusVariant(notification.status)}`}>
                          {formatGenericDeliveryStatus(notification.status, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </section>
        </div>

        <div className="admin-section-stack">
          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.statusActions}</h2>
            </div>
            <div className="admin-action-grid">
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
            <p className="small" style={{ marginTop: 12 }}>{copy.ownerResetInfo}</p>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.planSettings}</h2>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="field-label">{copy.planKey}</label>
                <select className="select" value={planForm.planKey} onChange={(event) => handlePlanKeyChange(event.target.value as BillingPlanKey)}>
                  <option value="STARTER">{formatInternalPlan("STARTER", locale)}</option>
                  <option value="GROWTH">{formatInternalPlan("GROWTH", locale)}</option>
                  <option value="ENTERPRISE">{formatInternalPlan("ENTERPRISE", locale)}</option>
                </select>
                <span className="field-hint">{copy.planHintStarterGrowth}</span>
              </div>

              <div className="field">
                <label className="field-label">{copy.billingEmail}</label>
                <input className="input" value={planForm.billingEmail} onChange={(event) => setPlanForm({ ...planForm, billingEmail: event.target.value })} />
              </div>

              <div className="field">
                <label className="field-label">{copy.billingStatus}</label>
                <select className="select" value={planForm.status} onChange={(event) => setPlanForm({ ...planForm, status: event.target.value as PlanFormState["status"] })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="TRIALING">TRIALING</option>
                  <option value="PAST_DUE">PAST_DUE</option>
                  <option value="INCOMPLETE">INCOMPLETE</option>
                  <option value="CANCELED">CANCELED</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">{copy.monthlyAmount}</label>
                <input
                  className="input"
                  value={planForm.monthlyAmountCents}
                  onChange={(event) => setPlanForm({ ...planForm, monthlyAmountCents: event.target.value })}
                />
                <span className="field-hint">{copy.billingAmountHint}</span>
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

              <button type="button" className="btn-primary-sm" onClick={() => void handlePlanSave()} disabled={busyAction !== ""}>
                {busyAction === "plan" ? copy.saving : copy.saveChanges}
              </button>

              {currentPlanDefaults ? (
                <p className="small">
                  {copy.currentPlan}: {formatInternalPlan(currentPlanDefaults.key, locale)} • {copy.seatsIncluded}: {currentPlanDefaults.seatsIncluded}
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.quotaGrants}</h2>
            </div>
            <div className="form-grid">
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

              <button type="button" className="btn-primary-sm" onClick={() => void handleGrantSubmit()} disabled={busyAction !== ""}>
                {busyAction === "grant" ? copy.processing : copy.addQuota}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
              <h2 className="tlx-section-title">{copy.recentPaymentLinks}</h2>
            </div>
            {detail.activity.recentCheckouts.length === 0 ? (
              <EmptyState message={copy.noRecentCheckouts} />
            ) : (
              <div className="admin-stack">
                {detail.activity.recentCheckouts.map((checkout) => (
                  <div key={checkout.id} className="admin-list-row">
                    <div>
                      <strong>{checkout.label ?? checkout.checkoutType}</strong>
                      <p className="small">{formatDate(checkout.createdAt)}</p>
                    </div>
                    <div className="admin-inline-actions">
                        <span className={`status-badge status-${statusVariant(checkout.status)}`}>
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
        </div>
      </section>
    </section>
  );
}
