"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { canPerformAction } from "../../../lib/auth/policy";
import { resolveActiveSession } from "../../../lib/auth/session";
import { AI_TASK_TYPE_LABELS } from "../../../lib/constants";
import { formatDate, truncate } from "../../../lib/format";
import type {
  AiSupportCenterReadModel,
  FeatureFlag,
  InfrastructureReadinessReadModel
} from "../../../lib/types";

const DEMO_FLAG_KEYS = [
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

function renderTaskScope(run: AiSupportCenterReadModel["taskRuns"][number]) {
  return run.scope;
}

export default function AiSupportCenterPage() {
  const { t } = useUiText();
  const [canEditFlags, setCanEditFlags] = useState(() =>
    canPerformAction(resolveActiveSession(), "ai.config.update")
  );
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [taskRuns, setTaskRuns] = useState<AiSupportCenterReadModel["taskRuns"]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureReadinessReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingFlagKey, setSavingFlagKey] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [readModel, infraReadModel] = await Promise.all([
        apiClient.aiSupportCenterReadModel(),
        apiClient.infrastructureReadinessReadModel()
      ]);
      setFlags(readModel.flags);
      setTaskRuns(readModel.taskRuns);
      setProviders(readModel.providers);
      setInfrastructure(infraReadModel);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("AI destek merkezi yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    setCanEditFlags(canPerformAction(resolveActiveSession(), "ai.config.update"));
  }, []);

  const demoFlags = useMemo(
    () =>
      DEMO_FLAG_KEYS.map((key) => flags.find((flag) => flag.key === key)).filter(
        (flag): flag is FeatureFlag => Boolean(flag)
      ),
    [flags]
  );

  async function toggleFlag(flag: FeatureFlag, nextValue: boolean) {
    setSavingFlagKey(flag.key);
    try {
      const updated = await apiClient.updateFeatureFlag(flag.key, {
        value: nextValue,
        type: flag.type,
        description: flag.description ?? undefined
      });
      setFlags((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : t("Feature flag güncellenemedi."));
    } finally {
      setSavingFlagKey("");
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <PageTitleWithGuide
            as="h2"
            guideKey="aiSupport"
            title="AI Destek Merkezi"
            style={{ marginBottom: 4 }}
          />
          <p className="small" style={{ marginTop: 0 }}>
            {t("AI destek akışının aç/kapat kontrolü, son görev durumları ve fallback görünürlüğü.")}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadPage()}>
          {t("Yenile")}
        </button>
      </div>

      {loading ? <LoadingState message={t("AI destek merkezi yükleniyor...")} /> : null}
      {!loading && error ? (
        <ErrorState
          error={error}
          actions={
            <button type="button" className="ghost-button" onClick={() => void loadPage()}>
              {t("Tekrar dene")}
            </button>
          }
        />
      ) : null}

      {!loading && !error ? (
        <>
          <div className="mini-grid">
            <article className="panel nested-panel">
              <h3 style={{ marginTop: 0 }}>Aktif AI Sağlayıcıları</h3>
              {providers.length === 0 ? (
                <EmptyState message={t("Sağlayıcı bulunamadı.")} />
              ) : (
                <ul className="plain-list">
                  {providers.map((provider) => (
                    <li key={provider} className="list-row">
                      <strong>{provider}</strong>
                      <span className="small">
                        {provider === "deterministic-fallback"
                          ? "LLM yoksa deterministic fallback kullanılır."
                          : "Gerçek model çağrısı kullanılır."}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {infrastructure?.ai?.providers ? (
                <table className="table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Config</th>
                      <th>Aktif</th>
                      <th>Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infrastructure.ai.providers.map((provider) => (
                      <tr key={provider.key}>
                        <td>{provider.key}</td>
                        <td>{provider.configured ? "Hazır" : "Eksik"}</td>
                        <td>{provider.active ? "Evet" : "Hayır"}</td>
                        <td>{provider.reason ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </article>
            <article className="panel nested-panel">
              <h3 style={{ marginTop: 0 }}>Demo Davranış Durumu</h3>
              <ul className="plain-list">
                <li className="list-row">
                  <span>AI sadece yardımcı</span>
                  <strong>Evet</strong>
                </li>
                <li className="list-row">
                  <span>Otomatik red</span>
                  <strong>Hayır (kural)</strong>
                </li>
                <li className="list-row">
                  <span>Kritik aksiyonlarda insan onayı</span>
                  <strong>Zorunlu</strong>
                </li>
              </ul>
            </article>
          </div>

          {infrastructure ? (
            <section className="panel nested-panel" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Infrastructure Readiness</h3>
              {infrastructure.queryWarnings?.length ? (
                <div style={{ marginBottom: 12 }}>
                  <strong>{t("Bazi readiness verileri eksik yüklendi.")}</strong>
                  <ul className="plain-list" style={{ marginTop: 8 }}>
                    {infrastructure.queryWarnings.map((warning) => (
                      <li key={warning} className="list-row">
                        <span>{t(warning)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <table className="table">
                <tbody>
                  <tr>
                    <td>CV Extraction</td>
                    <td>{JSON.stringify(infrastructure.cvExtraction?.byStatus ?? {})}</td>
                  </tr>
                  <tr>
                    <td>Speech Runtime</td>
                    <td>{infrastructure.runtime.speech.providerMode}</td>
                  </tr>
                  <tr>
                    <td>Calendly OAuth</td>
                    <td>{infrastructure.runtime.calendly.oauthConfigured ? "Hazır" : "Eksik"}</td>
                  </tr>
                  <tr>
                    <td>Google OAuth</td>
                    <td>{infrastructure.runtime.googleCalendar.oauthConfigured ? "Hazır" : "Eksik"}</td>
                  </tr>
                  <tr>
                    <td>Email Provider</td>
                    <td>
                      {infrastructure.runtime.notifications.emailProvider} /{" "}
                      {infrastructure.runtime.notifications.ready ? "Hazır" : "Eksik"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Feature Flag Kontrolü</h3>
            <p className="small" style={{ marginTop: 0 }}>
              Demo akışında kullanılan AI bayrakları. `ai.auto_reject.enabled` kural gereği açılamaz.
            </p>
            {!canEditFlags ? (
              <p className="small" style={{ marginTop: 0, color: "var(--text-secondary)" }}>
                Bu alanda sadece hesap sahibi degisiklik yapabilir. Siz salt okunur gorunumdesiniz.
              </p>
            ) : null}
            {demoFlags.length === 0 ? (
              <EmptyState message={t("Demo flag kaydı bulunamadı.")} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Flag</th>
                    <th>Değer</th>
                    <th>Açıklama</th>
                    <th>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {demoFlags.map((flag) => {
                    const boolValue = toBoolean(flag.value);
                    const canToggle = boolValue !== null;

                    return (
                      <tr key={flag.id}>
                        <td>
                          <strong>{flag.key}</strong>
                        </td>
                        <td>{boolValue === null ? JSON.stringify(flag.value) : boolValue ? "Açık" : "Kapalı"}</td>
                        <td>{flag.description ?? "-"}</td>
                        <td>
                          {canToggle ? (
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={
                                !canEditFlags ||
                                savingFlagKey === flag.key ||
                                flag.key === "ai.auto_reject.enabled"
                              }
                              onClick={() => void toggleFlag(flag, !Boolean(boolValue))}
                            >
                              {!canEditFlags
                                ? "Sadece owner"
                                : savingFlagKey === flag.key
                                  ? "Güncelleniyor..."
                                  : boolValue
                                    ? "Kapat"
                                    : "Aç"}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <div className="section-head">
              <h3 style={{ margin: 0 }}>Son AI Görev Çalışmaları</h3>
              <Link href="/applications" className="ghost-button">
                Başvuru ekranına dön
              </Link>
            </div>
            {taskRuns.length === 0 ? (
              <EmptyState message={t("AI task run kaydı bulunamadı.")} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Task</th>
                    <th>Durum</th>
                    <th>Kapsam</th>
                    <th>Sağlayıcı</th>
                    <th>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {taskRuns.slice(0, 25).map((run) => (
                    <tr key={run.id}>
                      <td>{formatDate(run.createdAt)}</td>
                      <td>{AI_TASK_TYPE_LABELS[run.taskType]}</td>
                      <td>{run.status}</td>
                      <td>{renderTaskScope(run)}</td>
                      <td>{run.providerKey ?? "-"}</td>
                      <td>{truncate(run.errorMessage, 100) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Integration Connection Durumu</h3>
            {infrastructure?.integrations && infrastructure.integrations.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Durum</th>
                    <th>Effective</th>
                    <th>Credential</th>
                    <th>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {infrastructure.integrations.map((connection) => (
                    <tr key={connection.id}>
                      <td>{connection.provider}</td>
                      <td>{connection.status}</td>
                      <td>{connection.effectiveStatus}</td>
                      <td>{connection.credentialStatus ?? "-"}</td>
                      <td>{truncate(connection.lastError ?? connection.credentialLastError, 80) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message={t("Integration connection kaydı yok.")} />
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
