import { SOURCE_LABELS } from "../lib/constants";

export function SourceChip({ source }: { source: string | null | undefined }) {
  const safeSource = source ?? "other";
  const label = SOURCE_LABELS[safeSource] ?? safeSource;
  const cls = `chip source-chip source-chip-${safeSource.replace(/_/g, "-")}`;
  return <span className={cls}>{label}</span>;
}
