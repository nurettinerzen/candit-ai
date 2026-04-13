"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../../components/ui-states";
import { useUiText } from "../../../../components/site-language-provider";
import { apiClient } from "../../../../lib/api-client";
import { formatDate } from "../../../../lib/format";
import {
  getInternalAdminCopy,
  translateInternalAdminMessage
} from "../../../../lib/internal-admin-copy";
import type {
  AiSupportCenterReadModel,
  FeatureFlag,
  InfrastructureReadinessReadModel,
  ProviderHealthDashboard
} from "../../../../lib/types";

const FLAG_DISPLAY: Record<string, { name: string; desc: string }> = {
  "ai.cv_parsing.enabled": {
    name: "CV Analizi",
    desc: "Yüklenen CV'leri otomatik inceler ve özet çıkarır."
  },
  "ai.screening_support.enabled": {
    name: "Ön Değerlendirme Desteği",
    desc: "Başvuru geldiğinde AI ön eleme yapar."
  },
  "ai.report_generation.enabled": {
    name: "Rapor Oluşturma",
    desc: "Aday değerlendirme raporu üretir."
  },
  "ai.recommendation_generation.enabled": {
    name: "Öneri Oluşturma",
    desc: "Uygunluk önerisi ve skor hesaplar."
  },
  "ai.system_triggers.application_created.screening_support.enabled": {
    name: "Otomatik Ön Değerlendirme",
    desc: "Yeni başvurularda otomatik ön eleme başlatır."
  },
  "ai.system_triggers.stage_review_pack.enabled": {
    name: "Aşama Değişiminde AI İncelemesi",
    desc: "Aşama geçişlerinde otomatik AI incelemesi yapar."
  },
  "ai.auto_reject.enabled": {
    name: "Otomatik Red",
    desc: "Kural gereği kapalı tutulur."
  }
};

const ADMIN_FLAG_KEYS = [
  "ai.cv_parsing.enabled",
  "ai.screening_support.enabled",
  "ai.report_generation.enabled",
  "ai.recommendation_generation.enabled",
  "ai.system_triggers.application_created.screening_support.enabled",
  "ai.system_triggers.stage_review_pack.enabled",
  "ai.auto_reject.enabled"
] as const;

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean((value as { enabled: unknown }).enabled);
  }

  return null;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function friendlyWarning(raw: string, locale: "tr" | "en") {
  if (raw.includes("Calendly") && raw.includes("OAuth")) {
    return locale === "en"
      ? "Calendly is not configured yet."
      : "Calendly henüz yapılandırılmamış.";
  }

  if (raw.includes("not_configured")) {
    return locale === "en" ? "Not configured yet." : "Henüz yapılandırılmamış.";
  }

  return raw;
}

export default function InternalAdminSettingsPage() {
  const { locale, t } = useUiText();
  const copy = getInternalAdminCopy(locale);
  const [health, setHealth] = useState<ProviderHealthDashboard | null>(null);
  const [aiData, setAiData] = useState<AiSupportCenterReadModel | null>(null);
  const [infra, setInfra] = useState<InfrastructureReadinessReadModel | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [healthLoadError, setHealthLoadError] = useState("");
  const [aiLoadError, setAiLoadError] = useState("");
  const [infraLoadError, setInfraLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [success, setSuccess] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    setHealthLoadError("");
    setAiLoadError("");
    setInfraLoadError("");

    try {
      const [healthResult, aiResult, infraResult] = await Promise.allSettled([
        apiClient.getProviderHealth(),
        apiClient.aiSupportCenterReadModel(),
        apiClient.infrastructureReadinessReadModel()
      ]);

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      } else {
        setHealth(null);
        setHealthLoadError(
          translateInternalAdminMessage(
            toErrorMessage(healthResult.reason, copy.internalOnly),
            locale
          )
        );
      }

      if (aiResult.status === "fulfilled") {
        setAiData(aiResult.value);
        setFlags(aiResult.value.flags ?? []);
      } else {
        setAiData(null);
        setFlags([]);
        setAiLoadError(
          translateInternalAdminMessage(
            toErrorMessage(aiResult.reason, copy.internalOnly),
            locale
          )
        );
      }

      if (infraResult.status === "fulfilled") {
        setInfra(infraResult.value);
      } else {
        setInfra(null);
        setInfraLoadError(
          translateInternalAdminMessage(
            toErrorMessage(infraResult.reason, copy.internalOnly),
            locale
          )
        );
      }
    } catch (loadError) {
      setError(translateInternalAdminMessage(toErrorMessage(loadError, copy.internalOnly), locale));
    } finally {
      setLoading(false);
    }
  }, [copy.internalOnly, locale]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const adminFlags = useMemo(
    () =>
      ADMIN_FLAG_KEYS.map((key) => flags.find((flag) => flag.key === key)).filter(
        (flag): flag is FeatureFlag => Boolean(flag)
      ),
    [flags]
  );

  const warnings = useMemo(
    () =>
      [
        ...(health?.warnings ?? []),
        ...(infra?.queryWarnings ?? [])
      ].map((warning) => friendlyWarning(warning, locale)),
    [health?.warnings, infra?.queryWarnings, locale]
  );

  const systemRows = useMemo(() => {
    const rows: Array<{ label: string; ready: boolean; detail: string }> = [];

    if (aiData?.providerStatus) {
      const activeProvider =
        aiData.providerStatus.providers.find((provider) => provider.active)?.key ??
        aiData.providerStatus.defaultProvider;

      rows.push({
        label: locale === "en" ? "Default AI provider" : "Varsayılan AI sağlayıcısı",
        ready: aiData.providerStatus.providers.some(
          (provider) => provider.active && provider.configured
        ),
        detail: activeProvider ?? "—"
      });
    }

    if (health) {
      for (const provider of health.runtimeProviders) {
        rows.push({
          label: provider.key,
          ready: provider.ready,
          detail: provider.ready ? t("Hazır") : provider.reason ?? t("Hazır değil")
        });
      }
    }

    if (infra) {
      rows.push(
        {
          label: locale === "en" ? "CV parsing runtime" : "CV parsing runtime",
          ready: infra.runtime.parsing.ready,
          detail: `${infra.runtime.parsing.provider} · ${infra.runtime.parsing.mode}`
        },
        {
          label: locale === "en" ? "Screening runtime" : "Screening runtime",
          ready: infra.runtime.screening.ready,
          detail: `${infra.runtime.screening.provider} · ${infra.runtime.screening.mode}`
        },
        {
          label: locale === "en" ? "Speech runtime" : "Ses runtime",
          ready: infra.runtime.speech.ready,
          detail: infra.runtime.speech.providerMode
        },
        {
          label: "Google Calendar OAuth",
          ready: infra.runtime.googleCalendar.oauthConfigured,
          detail: infra.runtime.googleCalendar.oauthConfigured
            ? t("Bağlı")
            : t("Yapılandırılmadı")
        },
        {
          label: locale === "en" ? "Email provider" : "E-posta sağlayıcısı",
          ready: infra.runtime.notifications.ready,
          detail: infra.runtime.notifications.emailProvider
        }
      );
    }

    return rows;
  }, [aiData, health, infra, locale, t]);

  async function toggleFlag(flag: FeatureFlag, nextValue: boolean) {
    setBusyKey(`flag:${flag.key}`);
    setError("");
    setSuccess("");

    try {
      const updated = await apiClient.updateFeatureFlag(flag.key, {
        value: nextValue,
        type: flag.type,
        description: flag.description ?? undefined
      });
      setFlags((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
      setSuccess(
        locale === "en"
          ? "AI settings updated."
          : "AI ayarları güncellendi."
      );
    } catch (toggleError) {
      setError(
        translateInternalAdminMessage(
          toErrorMessage(toggleError, locale === "en" ? "AI settings could not be updated." : "AI ayarları güncellenemedi."),
          locale
        )
      );
    } finally {
      setBusyKey("");
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

  if (error && !health && !aiData && !infra) {
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

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide guideKey="adminSettings" title={copy.settingsTitle} />
          <p>{copy.settingsSubtitle}</p>
        </div>
      </div>

      {error ? <NoticeBox tone="danger" message={error} /> : null}
      {success ? <NoticeBox tone="success" message={success} /> : null}
      {warnings.length > 0 ? (
        <section className="panel">
          <h2 style={{ margin: "0 0 8px" }}>
            {locale === "en" ? "Operational warnings" : "Operasyon uyarıları"}
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
            {warnings.map((warning) => (
              <li key={warning} className="small text-muted">
                {warning}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <h2 style={{ margin: "0 0 6px" }}>{t("AI Davranış Kuralları")}</h2>
        <p className="small text-muted" style={{ marginBottom: 12 }}>
          {locale === "en"
            ? "This area controls internal AI triggers and guardrails, not recruiter-facing preferences."
            : "Bu alan recruiter tercihi değil; iç AI tetiklerini ve koruma kurallarını yönetir."}
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <RuleRow label={t("AI sadece yardımcı rol üstlenir")} value={t("Evet")} positive />
          <RuleRow label={t("Otomatik red")} value={t("Kapalı")} />
          <RuleRow
            label={t("Kritik aksiyonlarda insan onayı")}
            value={t("Zorunlu")}
            positive
          />
        </div>
      </section>

      <section className="panel">
        <h2 style={{ margin: "0 0 6px" }}>{t("AI Özellikleri")}</h2>
        <p className="small text-muted" style={{ marginBottom: 12 }}>
          {locale === "en"
            ? "Enable or disable internal AI capabilities and auto-trigger behavior."
            : "İç AI kabiliyetlerini ve otomatik tetik davranışlarını buradan açıp kapatın."}
        </p>

        {aiLoadError ? (
          <ErrorState
            error={aiLoadError}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPage()}>
                {copy.retry}
              </button>
            }
          />
        ) : adminFlags.length === 0 ? (
          <EmptyState message={locale === "en" ? "No AI settings found." : "AI ayarı bulunamadı."} />
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Feature" : "Özellik"}</th>
                  <th>{copy.status}</th>
                  <th>{copy.action}</th>
                </tr>
              </thead>
              <tbody>
                {adminFlags.map((flag) => {
                  const boolValue = toBoolean(flag.value);
                  const display = FLAG_DISPLAY[flag.key];
                  const isLocked = flag.key === "ai.auto_reject.enabled";

                  return (
                    <tr key={flag.id}>
                      <td>
                        <div className="admin-table-cell-stack">
                          <strong>{display?.name ?? flag.key}</strong>
                          <span>{display?.desc ?? flag.description ?? ""}</span>
                        </div>
                      </td>
                      <td>{boolValue ? t("Açık") : t("Kapalı")}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={busyKey === `flag:${flag.key}` || isLocked}
                          onClick={() => void toggleFlag(flag, !Boolean(boolValue))}
                        >
                          {isLocked
                            ? t("Kilitli")
                            : busyKey === `flag:${flag.key}`
                              ? t("Güncelleniyor...")
                              : boolValue
                                ? t("Kapat")
                                : t("Aç")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ margin: "0 0 6px" }}>
          {locale === "en" ? "Recent AI tasks" : "Son AI görevleri"}
        </h2>
        <p className="small text-muted" style={{ marginBottom: 12 }}>
          {locale === "en"
            ? "Latest runtime output from internal AI execution."
            : "İç AI çalıştırmalarının son runtime çıktıları."}
        </p>

        {aiLoadError ? (
          <ErrorState
            error={aiLoadError}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPage()}>
                {copy.retry}
              </button>
            }
          />
        ) : !aiData || aiData.taskRuns.length === 0 ? (
          <EmptyState
            message={locale === "en" ? "No recent AI task found." : "Son AI görevi bulunmuyor."}
          />
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Task" : "Görev"}</th>
                  <th>{copy.status}</th>
                  <th>{locale === "en" ? "Scope" : "Kapsam"}</th>
                  <th>{locale === "en" ? "Time" : "Zaman"}</th>
                </tr>
              </thead>
              <tbody>
                {aiData.taskRuns.slice(0, 8).map((run) => (
                  <tr key={run.id}>
                    <td>{run.taskType}</td>
                    <td>{run.status}</td>
                    <td>{run.scope}</td>
                    <td>{formatDate(run.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ margin: "0 0 6px" }}>
          {locale === "en" ? "System readiness" : "Sistem hazırlığı"}
        </h2>
        <p className="small text-muted" style={{ marginBottom: 12 }}>
          {locale === "en"
            ? "Internal runtime and provider health visible only to the super admin team."
            : "Sadece süper admin ekibinin görmesi gereken runtime ve sağlayıcı sağlığı görünümü."}
        </p>

        {healthLoadError && infraLoadError ? (
          <ErrorState
            error={`${healthLoadError} ${infraLoadError}`.trim()}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPage()}>
                {copy.retry}
              </button>
            }
          />
        ) : systemRows.length === 0 ? (
          <EmptyState message={locale === "en" ? "No system data found." : "Sistem verisi bulunamadı."} />
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Component" : "Bileşen"}</th>
                  <th>{copy.status}</th>
                  <th>{copy.details}</th>
                </tr>
              </thead>
              <tbody>
                {systemRows.map((row) => (
                  <tr key={`${row.label}:${row.detail}`}>
                    <td>{row.label}</td>
                    <td>
                      <StatusBadge ready={row.ready} />
                    </td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function RuleRow({
  label,
  value,
  positive
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  const { t } = useUiText();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 8,
        border: "1px solid var(--border)"
      }}
    >
      <span style={{ fontSize: 13 }}>{t(label)}</span>
      <span
        style={{
          fontSize: 11,
          padding: "2px 10px",
          borderRadius: 10,
          fontWeight: 600,
          background: positive ? "rgba(34,197,94,0.12)" : "rgba(113,113,122,0.12)",
          color: positive ? "var(--success, #22c55e)" : "var(--text-dim)"
        }}
      >
        {t(value)}
      </span>
    </div>
  );
}
