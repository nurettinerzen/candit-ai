import type { ReactNode } from "react";

export function LoadingState({ message = "Yükleniyor..." }: { message?: string }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p className="loading-text">{message}</p>
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
  return (
    <div className="error-box">
      <strong>{title}</strong>
      <p style={{ margin: actions ? "0 0 8px" : 0 }}>{error}</p>
      {actions}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">—</div>
      <p className="empty-state-text">{message}</p>
    </div>
  );
}
