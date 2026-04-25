import type { ReactNode } from "react";
import { useUiText } from "./site-language-provider";

export function LoadingState({ message = "Yükleniyor..." }: { message?: string }) {
  const { t } = useUiText();

  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p className="loading-text">{t(message)}</p>
    </div>
  );
}

export function ErrorState({
  title = "İşlem başarısız.",
  error,
  actions
}: {
  title?: string;
  error: string;
  actions?: ReactNode;
}) {
  const { t } = useUiText();

  return (
    <div className="error-box">
      <strong>{t(title)}</strong>
      <p style={{ margin: actions ? "0 0 8px" : 0 }}>{t(error)}</p>
      {actions}
    </div>
  );
}

export function EmptyState({
  message,
  actions
}: {
  message: string;
  actions?: ReactNode;
}) {
  const { t } = useUiText();

  return (
    <div className="empty-state">
      <div className="empty-state-icon">—</div>
      <p className="empty-state-text" style={{ marginBottom: actions ? 12 : undefined }}>
        {t(message)}
      </p>
      {actions}
    </div>
  );
}
