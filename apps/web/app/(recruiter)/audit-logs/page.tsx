"use client";

import { useCallback, useEffect, useState } from "react";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { compactJson, formatDate, truncate } from "../../../lib/format";
import type { AuditLog } from "../../../lib/types";

export default function AuditLogsPage() {
  const { t } = useUiText();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [limit, setLimit] = useState("50");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await apiClient.listAuditLogs({
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        limit: Number(limit) || 50
      });
      setLogs(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Audit log verisi alınamadı."));
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, limit, t]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ marginBottom: 4 }}>{t("Denetim Kayıtları")}</h2>
          <p className="small" style={{ marginTop: 0 }}>
            {t("Recruiter kararlarının ve AI sistem aksiyonlarının izlenebilirliği.")}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadLogs()}>
          {t("Yenile")}
        </button>
      </div>

      <form
        className="inline-grid audit-filter-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void loadLogs();
        }}
      >
        <input
          className="input"
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          placeholder={t("Entity tipi (opsiyonel)")}
        />
        <input
          className="input"
          value={entityId}
          onChange={(event) => setEntityId(event.target.value)}
          placeholder={t("Entity ID (opsiyonel)")}
        />
        <input
          className="input"
          type="number"
          min={1}
          max={200}
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          placeholder={t("Limit")}
        />
        <button type="submit" className="ghost-button">
          {t("Uygula")}
        </button>
      </form>

      {loading ? <LoadingState message={t("Audit kayıtları yükleniyor...")} /> : null}
      {!loading && error ? (
        <ErrorState
          error={error}
          actions={
            <button type="button" className="ghost-button" onClick={() => void loadLogs()}>
              {t("Tekrar dene")}
            </button>
          }
        />
      ) : null}
      {!loading && !error && logs.length === 0 ? (
        <EmptyState message={t("Filtreye uygun audit kaydı bulunamadı.")} />
      ) : null}
      {!loading && !error && logs.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>{t("Tarih")}</th>
              <th>{t("Aksiyon")}</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>{t("Metadata")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.createdAt)}</td>
                <td>{log.action}</td>
                <td>
                  {log.entityType}/{log.entityId}
                </td>
                <td>{log.actorUserId ?? "-"}</td>
                <td>
                  <code className="small">{truncate(compactJson(log.metadata), 220) || "-"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
