import { formatDepartment } from "./constants";

type TranslateFn = (value: string) => string;

function normalizeToken(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[\s/_-]+/g, " ")
    .trim();
}

function dedupeLabels(labels: string[]) {
  return Array.from(new Set(labels.filter(Boolean)));
}

function extractShiftLabels(part: string) {
  const normalized = normalizeToken(part);
  const labels: string[] = [];

  if (
    normalized.includes("onsite") ||
    normalized.includes("on site") ||
    normalized.includes("ofisten") ||
    normalized.includes("office")
  ) {
    labels.push("Ofis İçi");
  }

  if (normalized.includes("hibrit") || normalized.includes("hybrid")) {
    labels.push("Hibrit");
  }

  if (normalized.includes("uzaktan") || normalized.includes("remote")) {
    labels.push("Uzaktan");
  }

  if (
    normalized.includes("tam zamanli") ||
    normalized.includes("full time") ||
    normalized.includes("fulltime")
  ) {
    labels.push("Tam Zamanlı");
  }

  if (
    normalized.includes("yari zamanli") ||
    normalized.includes("part time") ||
    normalized.includes("parttime")
  ) {
    labels.push("Yarı Zamanlı");
  }

  if (normalized.includes("vardiyali") || normalized.includes("shift based") || normalized === "shift") {
    labels.push("Vardiyalı");
  }

  if (normalized.includes("stajyer") || normalized.includes("intern")) {
    labels.push("Stajyer");
  }

  if (normalized.includes("sozlesmeli") || normalized.includes("contract")) {
    labels.push("Sözleşmeli");
  }

  return labels;
}

export function formatJobShiftTypeLabel(value: string | null | undefined, translate: TranslateFn) {
  if (!value?.trim()) {
    return "";
  }

  const parts = value
    .split(/[,\u00b7]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const canonicalLabels = dedupeLabels(
    parts.flatMap((part) => extractShiftLabels(part))
  );

  if (canonicalLabels.length === 0) {
    return translate(value.trim());
  }

  return canonicalLabels.map((label) => translate(label)).join(", ");
}

export function formatJobRoleFamilyLabel(value: string | null | undefined, translate: TranslateFn) {
  const department = formatDepartment(value);
  return translate(department);
}
