import { getActiveLocaleTag } from "./i18n";

function resolveLocaleTag() {
  return getActiveLocaleTag();
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(resolveLocaleTag(), {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat(resolveLocaleTag(), {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function formatCurrencyTry(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  return new Intl.NumberFormat(resolveLocaleTag(), {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(numeric);
}

export function compactJson(input: unknown) {
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

export function prettyJson(input: unknown) {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function formatPercent(value: number | string | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined) {
    return "-";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "-";
  }

  return new Intl.NumberFormat(resolveLocaleTag(), {
    style: "percent",
    maximumFractionDigits: fractionDigits
  }).format(numeric);
}

export function truncate(value: string | null | undefined, max = 160) {
  if (!value) {
    return "";
  }

  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
