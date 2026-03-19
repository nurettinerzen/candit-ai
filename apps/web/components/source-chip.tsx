import { SOURCE_LABELS } from "../lib/constants";

export function SourceChip({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source;
  const cls = `chip source-chip source-chip-${source.replace(/_/g, "-")}`;
  return <span className={cls}>{label}</span>;
}
