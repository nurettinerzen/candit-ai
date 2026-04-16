"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { getRoleLabel, isInternalAdminSession } from "../../../lib/auth/policy";
import { resendEmailVerification, resolveActiveSession, saveSession } from "../../../lib/auth/session";
import { formatDateOnly } from "../../../lib/format";
import type { BillingOverviewReadModel, MemberDirectoryItem } from "../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusBadge(status: MemberDirectoryItem["status"], locale: "tr" | "en") {
  switch (status) {
    case "ACTIVE":
      return { label: locale === "en" ? "Active" : "Aktif", ready: true };
    case "INVITED":
      return { label: locale === "en" ? "Invite Pending" : "Davet Bekliyor", ready: false };
    case "DISABLED":
    default:
      return { label: locale === "en" ? "Inactive" : "Pasif", ready: false };
  }
}

function formatOptionalDate(value: string | null) {
  return value ? formatDateOnly(value) : "—";
}

type EditableMemberRole = "owner" | "manager" | "staff";

export default function SettingsPage() {
  const { t, locale } = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSession = useMemo(() => resolveActiveSession(), []);
  const isInternalAdmin = isInternalAdminSession(currentSession);

  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, EditableMemberRole>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberLoadError, setMemberLoadError] = useState("");
  const [billingLoadError, setBillingLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [memberActionNotice, setMemberActionNotice] = useState("");
  const [memberActionPreviewUrl, setMemberActionPreviewUrl] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState("");
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    role: "staff" as "manager" | "staff"
  });

  const memberRoleOptions = useMemo(
    () =>
      ([
        { value: "owner", label: getRoleLabel("owner") },
        { value: "manager", label: getRoleLabel("manager") },
        { value: "staff", label: getRoleLabel("staff") }
      ] as const satisfies ReadonlyArray<{ value: EditableMemberRole; label: string }>),
    []
  );

  const inviteRoleOptions = useMemo(
    () =>
      memberRoleOptions.filter(
        (option): option is { value: "manager" | "staff"; label: string } =>
          option.value !== "owner"
      ),
    []
  );

  useEffect(() => {
    const requestedTab = searchParams.get("tab");

    if (!requestedTab) {
      return;
    }

    if (requestedTab === "plan") {
      router.replace("/subscription");
      return;
    }

    if (
      requestedTab === "entegrasyonlar" ||
      requestedTab === "ai" ||
      requestedTab === "sistem"
    ) {
      router.replace(isInternalAdmin ? "/admin/settings" : "/settings");
    }
  }, [isInternalAdmin, router, searchParams]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setMemberLoadError("");
    setBillingLoadError("");

    try {
      const [memberResult, billingResult] = await Promise.allSettled([
        apiClient.listMembers(),
        apiClient.billingOverview()
      ]);

      if (memberResult.status === "fulfilled") {
        setMembers(memberResult.value);
        setMemberRoleDrafts(
          Object.fromEntries(memberResult.value.map((member) => [member.userId, member.role]))
        );
      } else {
        setMembers([]);
        setMemberRoleDrafts({});
        setMemberLoadError(
          toErrorMessage(
            memberResult.reason,
            locale === "en" ? "Team data could not be loaded." : "Ekip bilgileri yüklenemedi."
          )
        );
      }

      if (billingResult.status === "fulfilled") {
        setBilling(billingResult.value);
      } else {
        setBilling(null);
        setBillingLoadError(
          toErrorMessage(
            billingResult.reason,
            locale === "en"
              ? "Usage limits could not be loaded."
              : "Kullanım limitleri yüklenemedi."
          )
        );
      }
    } catch (loadError) {
      setError(
        toErrorMessage(
          loadError,
          locale === "en" ? "Settings could not be loaded." : "Ayarlar yüklenemedi."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleResendOwnVerification() {
    setBusyKey("verify-email");
    setError("");
    setVerificationNotice("");
    setVerificationPreviewUrl("");

    try {
      const result = await resendEmailVerification(currentSession);
      if (!result.enabled) {
        setVerificationNotice(
          locale === "en"
            ? "Email verification is currently disabled across the platform."
            : "E-posta doğrulaması şu anda platform genelinde kapalı."
        );
      } else {
        setVerificationNotice(
          result.previewUrl
            ? locale === "en"
              ? "Verification flow prepared again. A local preview link is available."
              : "Doğrulama akışı yeniden hazırlandı. Lokal preview linki oluştu."
            : locale === "en"
              ? "Verification email sent again."
              : "Doğrulama e-postası yeniden gönderildi."
        );
      }
      setVerificationPreviewUrl(result.previewUrl ?? "");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : t("Doğrulama e-postası tekrar gönderilemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("invite");
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");

    try {
      const result = await apiClient.inviteMember(inviteForm);
      setInviteForm({
        fullName: "",
        email: "",
        role: "staff"
      });
      setMemberActionNotice(
        result.invitationUrl
          ? locale === "en"
            ? "Invitation created. A local preview link is ready."
            : "Davet oluşturuldu. Lokal preview linki hazır."
          : locale === "en"
            ? "Invitation created and email flow was triggered."
            : "Davet oluşturuldu ve e-posta akışı tetiklendi."
      );
      setMemberActionPreviewUrl(result.invitationUrl ?? "");
      await loadAll();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : t("Davet gönderilemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleResendInvitation(userId: string) {
    setBusyKey(`resend:${userId}`);
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");

    try {
      const result = await apiClient.resendMemberInvitation(userId);
      setMemberActionNotice(
        result.invitationUrl
          ? locale === "en"
            ? "Invitation sent again. A fresh local preview link is ready."
            : "Davet yeniden gönderildi. Yeni lokal preview linki hazır."
          : locale === "en"
            ? "Invitation sent again."
            : "Davet yeniden gönderildi."
      );
      setMemberActionPreviewUrl(result.invitationUrl ?? "");
      await loadAll();
    } catch (resendError) {
      setError(
        resendError instanceof Error ? resendError.message : t("Davet tekrar gönderilemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleRoleChange(member: MemberDirectoryItem, nextRole: EditableMemberRole) {
    const previousRole = member.role;
    if (nextRole === previousRole) {
      return;
    }

    if (
      nextRole === "owner" &&
      !window.confirm(
        locale === "en"
          ? `All authority will move to ${member.fullName}. Do you want to continue?`
          : `${member.fullName} hesabını hesap sahibi yaparsanız tüm yetkiler bu kullanıcıya devredilir. Devam etmek istiyor musunuz?`
      )
    ) {
      setMemberRoleDrafts((prev) => ({
        ...prev,
        [member.userId]: previousRole
      }));
      return;
    }

    setBusyKey(`role:${member.userId}`);
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");
    setMemberRoleDrafts((prev) => ({
      ...prev,
      [member.userId]: nextRole
    }));

    try {
      const result = await apiClient.updateMemberRole(member.userId, { role: nextRole });

      setMemberActionNotice(
        nextRole === "owner"
          ? locale === "en"
            ? "Account ownership transferred."
            : "Hesap sahipliği devredildi."
          : locale === "en"
            ? "Role saved automatically."
            : "Rol otomatik olarak kaydedildi."
      );

      if (
        result.previousOwnerUserId &&
        currentSession &&
        currentSession.userId === result.previousOwnerUserId
      ) {
        saveSession({
          ...currentSession,
          roles: "manager"
        });
        router.push("/dashboard");
        router.refresh();
        return;
      }

      await loadAll();
    } catch (roleError) {
      setMemberRoleDrafts((prev) => ({
        ...prev,
        [member.userId]: previousRole
      }));
      setError(roleError instanceof Error ? roleError.message : t("Rol güncellenemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleStatusUpdate(member: MemberDirectoryItem) {
    const nextStatus = member.status === "DISABLED" ? "ACTIVE" : "DISABLED";

    if (
      nextStatus === "DISABLED" &&
      !window.confirm(`${member.fullName} ${t("kullanıcısını pasifleştirmek istiyor musunuz?")}`)
    ) {
      return;
    }

    setBusyKey(`status:${member.userId}`);
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");

    try {
      await apiClient.updateMemberStatus(member.userId, { status: nextStatus });
      setMemberActionNotice(
        nextStatus === "DISABLED"
          ? locale === "en"
            ? "User access paused."
            : "Kullanıcı erişimi pasifleştirildi."
          : locale === "en"
            ? "User access restored."
            : "Kullanıcı erişimi yeniden açıldı."
      );
      await loadAll();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : t("Durum güncellenemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleDeleteMember(member: MemberDirectoryItem) {
    if (
      !window.confirm(
        locale === "en"
          ? `${member.fullName} will be removed from the workspace. Active sessions and pending invitations will also be cleared. Continue?`
          : `${member.fullName} çalışma alanından silinecek. Aktif oturumları ve bekleyen davetleri de temizlenecek. Devam etmek istiyor musunuz?`
      )
    ) {
      return;
    }

    setBusyKey(`delete:${member.userId}`);
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");

    try {
      await apiClient.deleteMember(member.userId);
      setMemberActionNotice(
        locale === "en"
          ? "User removed from the workspace."
          : "Kullanıcı çalışma alanından silindi."
      );
      await loadAll();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : t("Kullanıcı silinemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  const seatQuota = billing?.usage.quotas.find((quota) => quota.key === "SEATS") ?? null;
  const inviteBlockedReason =
    seatQuota?.warningState === "exceeded"
      ? locale === "en"
        ? "User seat limit is full. Upgrade the plan before inviting another teammate."
        : "Kullanıcı limiti dolu. Yeni davet için önce planı yükseltin."
      : "";
  const inviteDisabled = busyKey === "invite" || Boolean(inviteBlockedReason);
  const title = locale === "en" ? "Team and Access" : "Ekip ve Erişim";
  const subtitle =
    locale === "en"
      ? "Manage team access, roles, and email verification status."
      : "Ekip erişimini, rolleri ve e-posta doğrulama durumunu yönetin.";

  if (loading) {
    return (
      <section className="page-grid">
        <section className="panel">
          <LoadingState message={t("Ayarlar yükleniyor...")} />
        </section>
      </section>
    );
  }

  if (error && members.length === 0 && !billing) {
    return (
      <section className="page-grid">
        <section className="panel">
          <ErrorState error={error} />
        </section>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide guideKey="settings" title={title} subtitle={subtitle} style={{ margin: 0 }} />
        </div>
      </div>

      {error ? <NoticeBox tone="danger" message={error} /> : null}
      {memberActionNotice ? <NoticeBox tone="success" message={memberActionNotice} /> : null}
      {verificationNotice ? <NoticeBox tone="success" message={verificationNotice} /> : null}
      {billingLoadError ? <NoticeBox tone="danger" message={billingLoadError} /> : null}

      {memberActionPreviewUrl ? (
        <a
          href={memberActionPreviewUrl}
          target="_blank"
          rel="noreferrer"
          className="ghost-button"
          style={{ justifySelf: "start", textDecoration: "none" }}
        >
          {t("Davet preview bağlantısını aç")}
        </a>
      ) : null}

      {verificationPreviewUrl ? (
        <a
          href={verificationPreviewUrl}
          target="_blank"
          rel="noreferrer"
          className="ghost-button"
          style={{ justifySelf: "start", textDecoration: "none" }}
        >
          {t("Doğrulama preview bağlantısını aç")}
        </a>
      ) : null}

      {currentSession?.email && !currentSession.emailVerifiedAt ? (
        <section className="panel" style={{ display: "grid", gap: 10 }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>{t("E-posta doğrulaması bekleniyor")}</h2>
            <p className="small text-muted" style={{ margin: 0 }}>
              {locale === "en"
                ? "Before opening customer-facing flows, make sure the account owner email is verified."
                : "Müşteriye açık akışları devreye almadan önce hesap sahibi e-postasının doğrulanmış olduğundan emin olun."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ghost-button"
              disabled={busyKey === "verify-email"}
              onClick={() => void handleResendOwnVerification()}
            >
              {busyKey === "verify-email"
                ? t("Hazırlanıyor...")
                : t("Doğrulama mailini tekrar gönder")}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2 style={{ margin: "0 0 6px" }}>
          {locale === "en" ? "Invite teammate" : "Yeni üye davet et"}
        </h2>
        <p className="small text-muted" style={{ marginBottom: 12 }}>
          {locale === "en"
            ? "Invite managers or staff to this workspace and keep access under one owner account."
            : "Bu çalışma alanına menajer veya personel davet edin; hesapta tek bir hesap sahibi bulunsun."}
        </p>

        {inviteBlockedReason ? <NoticeBox tone="danger" message={inviteBlockedReason} /> : null}

        {seatQuota ? (
          <p className="small text-muted" style={{ marginTop: 12, marginBottom: 12 }}>
            {t("Kullanıcı kotası")}: {seatQuota.used}/{seatQuota.limit}.{" "}
            {locale === "en"
              ? "Pending invitations are included in this limit."
              : "Bekleyen davetler de bu limite dahildir."}
          </p>
        ) : null}

        <form
          className="inline-grid"
          style={{ gridTemplateColumns: "1.2fr 1.2fr 0.8fr auto", gap: 12 }}
          onSubmit={handleInviteSubmit}
        >
          <input
            className="input"
            value={inviteForm.fullName}
            disabled={inviteDisabled}
            onChange={(event) =>
              setInviteForm((prev) => ({ ...prev, fullName: event.target.value }))
            }
            placeholder={t("Ad Soyad")}
            required
          />
          <input
            className="input"
            type="email"
            value={inviteForm.email}
            disabled={inviteDisabled}
            onChange={(event) =>
              setInviteForm((prev) => ({ ...prev, email: event.target.value }))
            }
            placeholder={t("E-posta")}
            required
          />
          <select
            className="input"
            value={inviteForm.role}
            disabled={inviteDisabled}
            onChange={(event) =>
              setInviteForm((prev) => ({
                ...prev,
                role: event.target.value as "manager" | "staff"
              }))
            }
          >
            {inviteRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
          <button type="submit" className="ghost-button" disabled={inviteDisabled}>
            {busyKey === "invite" ? t("Gönderiliyor...") : t("Davet Gönder")}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>{locale === "en" ? "Team members" : "Üye listesi"}</h2>
            <p className="small text-muted" style={{ marginTop: 4 }}>
              {locale === "en"
                ? "One owner controls the workspace. Managers run operations; staff work in the daily flow."
                : "Tek bir hesap sahibi bulunur. Menajer operasyonu yönetir, personel günlük akışta çalışır."}
            </p>
          </div>
        </div>

        {memberLoadError ? (
          <ErrorState
            error={memberLoadError}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        ) : members.length === 0 ? (
          <EmptyState message={t("Henüz ekip üyesi bulunmuyor.")} />
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "User" : "Kullanıcı"}</th>
                  <th>{locale === "en" ? "Role" : "Rol"}</th>
                  <th>{t("Durum")}</th>
                  <th>{locale === "en" ? "Last login" : "Son giriş"}</th>
                  <th>{locale === "en" ? "Email verified" : "E-posta doğrulama"}</th>
                  <th>{locale === "en" ? "Actions" : "Aksiyonlar"}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const status = statusBadge(member.status, locale);
                  const roleDraft = memberRoleDrafts[member.userId] ?? member.role;
                  const roleBusy = busyKey === `role:${member.userId}`;
                  const statusBusy = busyKey === `status:${member.userId}`;
                  const resendBusy = busyKey === `resend:${member.userId}`;
                  const deleteBusy = busyKey === `delete:${member.userId}`;

                  return (
                    <tr key={member.userId}>
                      <td>
                        <div className="admin-table-cell-stack">
                          <strong>{member.fullName}</strong>
                          <span>{member.email}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          className="input"
                          style={{ minWidth: 180 }}
                          value={roleDraft}
                          disabled={roleBusy || member.role === "owner"}
                          onChange={(event) =>
                            void handleRoleChange(
                              member,
                              event.target.value as EditableMemberRole
                            )
                          }
                        >
                          {memberRoleOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={option.value === "owner" && member.status !== "ACTIVE"}
                            >
                              {t(option.label)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <StatusBadge ready={status.ready} label={status.label} />
                      </td>
                      <td>
                        {formatOptionalDate(member.lastLoginAt)}
                      </td>
                      <td>
                        {member.emailVerifiedAt
                          ? formatOptionalDate(member.emailVerifiedAt)
                          : t("Bekliyor")}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {member.role !== "owner" ? (
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={statusBusy}
                              onClick={() => void handleStatusUpdate(member)}
                            >
                              {statusBusy
                                ? t("İşleniyor...")
                                : member.status === "DISABLED"
                                  ? t("Aktifleştir")
                                  : t("Pasifleştir")}
                            </button>
                          ) : null}
                          {member.status === "INVITED" || member.hasPendingInvitation ? (
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={resendBusy}
                              onClick={() => void handleResendInvitation(member.userId)}
                            >
                              {resendBusy
                                ? t("Gönderiliyor...")
                                : t("Daveti Tekrar Gönder")}
                            </button>
                          ) : null}
                          {member.role !== "owner" ? (
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={deleteBusy}
                              onClick={() => void handleDeleteMember(member)}
                            >
                              {deleteBusy ? t("Siliniyor...") : t("Sil")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {members.length > 0 ? (
          <p className="small text-muted" style={{ marginTop: 12, textAlign: "right" }}>
            {locale === "en"
              ? "Role changes are saved automatically. Selecting Account Owner transfers all authority to that user."
              : "Rol değişiklikleri otomatik kaydedilir. Hesap Sahibi seçildiğinde tüm yetkiler o kullanıcıya devredilir."}
          </p>
        ) : null}
      </section>
    </section>
  );
}

function NoticeBox({
  message,
  tone
}: {
  message: string;
  tone: "success" | "danger";
}) {
  const { t } = useUiText();
  const color = tone === "success" ? "34,197,94" : "239,68,68";

  return (
    <div
      style={{
        padding: "12px 16px",
        background: `rgba(${color},0.08)`,
        border: `1px solid rgba(${color},0.2)`,
        borderRadius: 8,
        color: tone === "success" ? "var(--success, #22c55e)" : "var(--danger, #ef4444)",
        fontSize: 14
      }}
    >
      {t(message)}
    </div>
  );
}

function StatusBadge({
  ready,
  label
}: {
  ready: boolean;
  label?: string;
}) {
  const { t } = useUiText();

  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 10px",
        borderRadius: 10,
        fontWeight: 600,
        background: ready ? "rgba(34,197,94,0.12)" : "rgba(113,113,122,0.12)",
        color: ready ? "var(--success, #22c55e)" : "var(--text-dim)"
      }}
    >
      {t(label ?? (ready ? "Hazır" : "Sorunlu"))}
    </span>
  );
}
