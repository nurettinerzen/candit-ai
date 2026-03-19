"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { request } from "../../../lib/api/http";
import { API_BASE_URL } from "../../../lib/auth/runtime";
import { apiClient } from "../../../lib/api-client";
import { AI_TASK_TYPE_LABELS } from "../../../lib/constants";
import { compactJson, formatDate, truncate } from "../../../lib/format";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import type {
  AiSupportCenterReadModel,
  AuditLog,
  FeatureFlag,
  InfrastructureReadinessReadModel,
  ProviderHealthDashboard
} from "../../../lib/types";

const FLAG_DISPLAY_NAMES: Record<string, string> = {
  "ai.cv_parsing.enabled": "CV Analizi",
  "ai.screening_support.enabled": "Ön Değerlendirme Desteği",
  "ai.report_generation.enabled": "Rapor Oluşturma",
  "ai.recommendation_generation.enabled": "Öneri Oluşturma",
  "ai.system_triggers.application_created.screening_support.enabled": "Otomatik Ön Değerlendirme",
  "ai.system_triggers.stage_review_pack.enabled": "Aşama Değişiminde AI İncelemesi",
  "ai.auto_reject.enabled": "Otomatik Red (Devre Dışı)"
};

type TabId = "baglantilar" | "ai_ayarlari" | "sistem" | "denetim";

const TABS: { id: TabId; label: string }[] = [
  { id: "baglantilar", label: "Bağlantılar" },
  { id: "ai_ayarlari", label: "AI Ayarları" },
  { id: "sistem", label: "Sistem Durumu" },
  { id: "denetim", label: "Denetim Kayıtları" },
];

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
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) return Boolean((value as { enabled: unknown }).enabled);
  return null;
}

function connectionStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Bağlı", color: "var(--success, #22c55e)" };
    case "INACTIVE":
      return { label: "Yapılandırılmadı", color: "var(--muted, #94a3b8)" };
    case "DEGRADED":
      return { label: "Sorunlu", color: "var(--warn, #f59e0b)" };
    case "ERROR":
      return { label: "Hata", color: "var(--risk, #ef4444)" };
    default:
      return { label: status, color: "var(--muted, #94a3b8)" };
  }
}

export default function AyarlarPage() {
  const searchParams = useSearchParams();
  const googleConnected = searchParams.get("google_connected") === "true";
  const oauthError = searchParams.get("error");

  const [activeTab, setActiveTab] = useState<TabId>("baglantilar");
  const [health, setHealth] = useState<ProviderHealthDashboard | null>(null);
  const [aiData, setAiData] = useState<AiSupportCenterReadModel | null>(null);
  const [infra, setInfra] = useState<InfrastructureReadinessReadModel | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingFlagKey, setSavingFlagKey] = useState("");
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditEntityId, setAuditEntityId] = useState("");
  const [auditLimit, setAuditLimit] = useState("50");

  const googleAuthorizeUrl = `${API_BASE_URL.replace(/\/v1\/?$/, "/v1")}/integrations/google/authorize`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [healthData, aiReadModel, infraData] = await Promise.all([
        request<ProviderHealthDashboard>("read-models/provider-health").catch(() => null),
        apiClient.aiSupportCenterReadModel().catch(() => null),
        apiClient.infrastructureReadinessReadModel().catch(() => null),
      ]);
      setHealth(healthData);
      if (aiReadModel) {
        setAiData(aiReadModel);
        setFlags(aiReadModel.flags);
      }
      setInfra(infraData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ayarlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const rows = await apiClient.listAuditLogs({
        entityType: auditEntityType || undefined,
        entityId: auditEntityId || undefined,
        limit: Number(auditLimit) || 50
      });
      setAuditLogs(rows);
    } catch {}
  }, [auditEntityType, auditEntityId, auditLimit]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { if (activeTab === "denetim") void loadAuditLogs(); }, [activeTab, loadAuditLogs]);

  const demoFlags = useMemo(
    () => DEMO_FLAG_KEYS.map((key) => flags.find((f) => f.key === key)).filter((f): f is FeatureFlag => Boolean(f)),
    [flags]
  );

  async function toggleFlag(flag: FeatureFlag, nextValue: boolean) {
    setSavingFlagKey(flag.key);
    try {
      const updated = await apiClient.updateFeatureFlag(flag.key, { value: nextValue, type: flag.type, description: flag.description ?? undefined });
      setFlags((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
    } catch {} finally { setSavingFlagKey(""); }
  }

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Ayarlar & Bağlantılar</h1>
          <p className="small" style={{ margin: 0 }}>
            Entegrasyonlar, AI yapılandırması, sistem durumu ve denetim kayıtları.
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadAll()}>Yenile</button>
      </div>

      {googleConnected && (
        <div style={{ padding: "12px 16px", background: "var(--success-light)", border: "1px solid var(--success-border)", borderRadius: 8, color: "var(--success-text)", fontSize: 14 }}>
          Google Calendar başarıyla bağlandı!
        </div>
      )}
      {oauthError && (
        <div style={{ padding: "12px 16px", background: "var(--risk-light)", border: "1px solid var(--risk-border)", borderRadius: 8, color: "var(--risk-text)", fontSize: 14 }}>
          Bağlantı hatası: {oauthError}
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default, #e2e8f0)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary, #5046e5)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--primary, #5046e5)" : "var(--text-secondary, #64748b)",
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              fontSize: 14,
              transition: "all 0.15s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <section className="panel"><LoadingState message="Ayarlar yükleniyor..." /></section>}
      {!loading && error && <section className="panel"><ErrorState error={error} /></section>}

      {!loading && !error && (
        <>
          {/* ─── Bağlantılar Tab ─── */}
          {activeTab === "baglantilar" && health && (
            <>
              <section className="panel">
                <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 12 }}>Genel Bağlantı Durumu</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: health.overall === "healthy" ? "var(--success)" : "var(--warn)" }} />
                  <span style={{ fontWeight: 600, fontSize: 16 }}>
                    {health.overall === "healthy" ? "Tüm sistemler aktif" : "Bazı bağlantılarda sorun var"}
                  </span>
                </div>
                {health.warnings.length > 0 && (
                  <div style={{ background: "var(--warn-light)", border: "1px solid var(--warn-border)", borderRadius: 8, padding: 12, fontSize: 13 }}>
                    <strong style={{ color: "var(--warn-text)" }}>Dikkat gerektiren konular:</strong>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--warn-text)" }}>
                      {health.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </section>

              <section className="panel">
                <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 12 }}>Entegrasyonlar</h3>
                {health.integrations.length === 0 ? (
                  <p className="small">Henüz entegrasyon bağlantısı yapılmamış.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {health.integrations.map((i) => {
                      const statusInfo = connectionStatusLabel(i.status);
                      return (
                        <div key={i.provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-muted)", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{i.displayName || i.provider}</span>
                            {i.lastError && <span className="text-muted text-xs" style={{ marginLeft: 8 }}>{i.lastError}</span>}
                          </div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: statusInfo.color, fontWeight: 500 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusInfo.color, display: "inline-block" }} />
                            {statusInfo.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <h4 style={{ fontSize: 14, margin: "0 0 8px" }}>Google Calendar Bağlantısı</h4>
                  <p className="small" style={{ margin: "0 0 12px" }}>
                    Google Calendar entegrasyonu ile görüşmeleri otomatik olarak takviminize ekleyebilirsiniz.
                  </p>
                  <a href={googleAuthorizeUrl} style={{ display: "inline-block", padding: "8px 20px", background: "var(--primary, #4285f4)", color: "var(--text-on-primary, #fff)", borderRadius: 6, textDecoration: "none", fontWeight: 500, fontSize: 14 }}>
                    Google Calendar Bağla
                  </a>
                </div>
              </section>
            </>
          )}

          {/* ─── AI Ayarları Tab ─── */}
          {activeTab === "ai_ayarlari" && (
            <>
              <section className="panel">
                <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 12 }}>AI Sağlayıcıları</h3>
                {health?.ai.providers.map((p) => (
                  <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-muted)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>{p.key}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: p.available ? "var(--success)" : "var(--risk)", fontWeight: 500 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.available ? "var(--success)" : "var(--risk)", display: "inline-block" }} />
                      {p.available ? "Aktif" : "Devre Dışı"}
                    </span>
                  </div>
                ))}
                {health?.ai.activeProvider && (
                  <p className="small" style={{ margin: "4px 0 0" }}>Aktif sağlayıcı: <strong>{health.ai.activeProvider}</strong></p>
                )}
              </section>

              <section className="panel">
                <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 8 }}>AI Davranış Kuralları</h3>
                <ul className="plain-list">
                  <li className="list-row"><span>AI sadece yardımcı rol üstlenir</span><strong>Evet</strong></li>
                  <li className="list-row"><span>Otomatik red</span><strong>Hayır (kural gereği)</strong></li>
                  <li className="list-row"><span>Kritik aksiyonlarda insan onayı</span><strong>Zorunlu</strong></li>
                </ul>
              </section>

              <section className="panel">
                <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 8 }}>AI Özellikleri</h3>
                <p className="small" style={{ marginTop: 0 }}>AI özelliklerini buradan açıp kapatabilirsiniz. Otomatik red kuralı gereği kapalıdır.</p>
                {demoFlags.length === 0 ? <EmptyState message="Özellik kaydı bulunamadı." /> : (
                  <table className="table">
                    <thead><tr><th>Özellik</th><th>Durum</th><th>Açıklama</th><th>İşlem</th></tr></thead>
                    <tbody>
                      {demoFlags.map((flag) => {
                        const boolValue = toBoolean(flag.value);
                        const canToggle = boolValue !== null;
                        return (
                          <tr key={flag.id}>
                            <td><strong>{FLAG_DISPLAY_NAMES[flag.key] ?? flag.key}</strong></td>
                            <td>
                              <span className={boolValue ? "badge success" : "badge"}>
                                {boolValue === null ? JSON.stringify(flag.value) : boolValue ? "Açık" : "Kapalı"}
                              </span>
                            </td>
                            <td>{flag.description ?? "-"}</td>
                            <td>
                              {canToggle ? (
                                <button type="button" className="ghost-button" disabled={savingFlagKey === flag.key || flag.key === "ai.auto_reject.enabled"} onClick={() => void toggleFlag(flag, !Boolean(boolValue))}>
                                  {savingFlagKey === flag.key ? "Güncelleniyor..." : boolValue ? "Kapat" : "Aç"}
                                </button>
                              ) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              {aiData && (
                <section className="panel">
                  <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 8 }}>Son AI Görev Çalışmaları</h3>
                  {aiData.taskRuns.length === 0 ? <EmptyState message="AI görev kaydı bulunamadı." /> : (
                    <table className="table">
                      <thead><tr><th>Tarih</th><th>Görev</th><th>Durum</th><th>Hata</th></tr></thead>
                      <tbody>
                        {aiData.taskRuns.slice(0, 25).map((run) => (
                          <tr key={run.id}>
                            <td>{formatDate(run.createdAt)}</td>
                            <td>{AI_TASK_TYPE_LABELS[run.taskType]}</td>
                            <td>{run.status}</td>
                            <td>{truncate(run.errorMessage, 100) || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}
            </>
          )}

          {/* ─── Sistem Durumu Tab ─── */}
          {activeTab === "sistem" && (
            <>
              <section className="panel">
                <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 12 }}>Çalışma Zamanı Sağlayıcıları</h3>
                {health?.runtimeProviders.map((p) => (
                  <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-muted)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>{p.key}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: p.ready ? "var(--success)" : "var(--risk)", fontWeight: 500 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.ready ? "var(--success)" : "var(--risk)", display: "inline-block" }} />
                      {p.ready ? "Hazır" : p.reason || "Hazır Değil"}
                    </span>
                  </div>
                ))}
              </section>

              {infra && (
                <section className="panel">
                  <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 8 }}>Altyapı Durumu</h3>
                  <table className="table">
                    <tbody>
                      <tr>
                        <td>CV İşleme</td>
                        <td>
                          {infra.cvExtraction?.byStatus
                            ? Object.entries(infra.cvExtraction.byStatus).map(([k, v]) => `${k}: ${v}`).join(", ") || "Veri yok"
                            : "Veri yok"}
                        </td>
                      </tr>
                      <tr>
                        <td>Ses Sistemi</td>
                        <td>{infra.runtime.speech.providerMode}</td>
                      </tr>
                      <tr>
                        <td>Google Takvim</td>
                        <td>{infra.runtime.googleCalendar.oauthConfigured ? "Hazır" : "Yapılandırılmadı"}</td>
                      </tr>
                      <tr>
                        <td>E-posta Bildirimi</td>
                        <td>
                          {infra.runtime.notifications.emailProvider}
                          {" / "}
                          {infra.runtime.notifications.ready ? "Hazır" : "Yapılandırılmadı"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}
            </>
          )}

          {/* ─── Denetim Kayıtları Tab ─── */}
          {activeTab === "denetim" && (
            <section className="panel">
              <h3 style={{ marginTop: 0, fontSize: 15, marginBottom: 8 }}>Denetim Kayıtları</h3>
              <p className="small" style={{ marginTop: 0 }}>
                Sistem aksiyonlarının ve recruiter kararlarının izlenebilirliği.
              </p>
              <form className="inline-grid audit-filter-grid" onSubmit={(e) => { e.preventDefault(); void loadAuditLogs(); }}>
                <input className="input" value={auditEntityType} onChange={(e) => setAuditEntityType(e.target.value)} placeholder="Kayıt tipi" />
                <input className="input" value={auditEntityId} onChange={(e) => setAuditEntityId(e.target.value)} placeholder="Kayıt ID" />
                <input className="input" type="number" min={1} max={200} value={auditLimit} onChange={(e) => setAuditLimit(e.target.value)} placeholder="Limit" />
                <button type="submit" className="ghost-button">Filtrele</button>
              </form>
              {auditLogs.length === 0 ? <EmptyState message="Denetim kaydı bulunamadı." /> : (
                <table className="table">
                  <thead><tr><th>Tarih</th><th>İşlem</th><th>Kayıt</th><th>Kullanıcı</th><th>Detay</th></tr></thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td>{log.action}</td>
                        <td>{log.entityType}/{log.entityId.slice(0, 8)}...</td>
                        <td>{log.actorUserId ?? "-"}</td>
                        <td>
                          {log.metadata ? (
                            <details><summary className="small" style={{ cursor: "pointer" }}>Detay</summary><code className="small">{truncate(compactJson(log.metadata), 220)}</code></details>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
