import type { BulkImportCandidate } from "./types";

export type ImportSourceHint = "csv_import" | "kariyer_net" | "linkedin" | "eleman_net" | "agency";

export type ParsedBulkImportCsv = {
  candidates: BulkImportCandidate[];
  headers: string[];
  delimiter: "," | ";" | "\t";
  detectedSource: ImportSourceHint;
  mappedHeaders: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    locationText: string | null;
    yearsOfExperience: string | null;
    externalRef: string | null;
  };
};

export type ParsedDelimitedTable = {
  headers: string[];
  rows: string[][];
  delimiter: "," | ";" | "\t";
  detectedSource: ImportSourceHint;
};

const COLUMN_ALIASES = {
  fullName: [
    "ad",
    "ad soyad",
    "ad soyadı",
    "aday",
    "aday adı",
    "aday ad soyad",
    "aday adı soyadı",
    "isim",
    "isim soyisim",
    "isim soyad",
    "name",
    "full name",
    "candidate",
    "candidate name",
    "applicant",
    "applicant name"
  ],
  phone: [
    "telefon",
    "telefon no",
    "telefon numarası",
    "telefon numarasi",
    "cep telefonu",
    "gsm",
    "mobile",
    "mobile phone",
    "phone",
    "phone number",
    "tel"
  ],
  email: [
    "email",
    "e posta",
    "e-posta",
    "eposta",
    "mail",
    "email address",
    "e mail"
  ],
  locationText: [
    "lokasyon",
    "konum",
    "şehir",
    "sehir",
    "il",
    "city",
    "location"
  ],
  yearsOfExperience: [
    "deneyim",
    "deneyim yıl",
    "deneyim yılı",
    "deneyim yili",
    "toplam deneyim",
    "tecrübe",
    "tecrube",
    "yıl",
    "yil",
    "experience",
    "years experience",
    "years of experience",
    "total experience"
  ],
  externalRef: [
    "referans",
    "ref",
    "referans no",
    "başvuru no",
    "basvuru no",
    "başvuru numarası",
    "basvuru numarasi",
    "application id",
    "application no",
    "applicant id",
    "candidate id",
    "aday no",
    "aday id",
    "id"
  ]
} as const;

export function normalizeImportHeader(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[()/:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitDelimitedLine(line: string, delimiter: "," | ";" | "\t") {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    const next = line[index + 1] ?? "";

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function detectImportDelimiter(text: string): "," | ";" | "\t" {
  const sample = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  const scores = [
    { delimiter: "\t" as const, score: 0 },
    { delimiter: ";" as const, score: 0 },
    { delimiter: "," as const, score: 0 }
  ];

  for (const line of sample) {
    for (const entry of scores) {
      entry.score += splitDelimitedLine(line, entry.delimiter).length - 1;
    }
  }

  return scores.sort((left, right) => right.score - left.score)[0]?.delimiter ?? ",";
}

function findColumnIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => {
    const normalized = normalizeImportHeader(header);
    return aliases.some((alias) => normalized === normalizeImportHeader(alias));
  });
}

function readOptionalValue(values: string[], index: number) {
  if (index < 0) {
    return undefined;
  }

  const value = values[index]?.trim();
  return value ? value : undefined;
}

export function parseExperienceValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.round(parsed));
}

export function detectImportSource(headers: string[], fileName?: string): ImportSourceHint {
  const haystack = `${headers.join(" ")} ${fileName ?? ""}`;
  const normalized = normalizeImportHeader(haystack);

  if (normalized.includes("kariyer") || normalized.includes("ilan no")) {
    return "kariyer_net";
  }

  if (normalized.includes("linkedin")) {
    return "linkedin";
  }

  if (normalized.includes("eleman")) {
    return "eleman_net";
  }

  if (normalized.includes("agency") || normalized.includes("ajans")) {
    return "agency";
  }

  return "csv_import";
}

export function parseDelimitedTable(text: string, fileName?: string): ParsedDelimitedTable | null {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return null;
  }

  const delimiter = detectImportDelimiter(normalizedText);
  const headers = splitDelimitedLine(lines[0] ?? "", delimiter).map((item) => item.trim());
  const rows = lines.slice(1).map((line) => splitDelimitedLine(line, delimiter));

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return {
    headers,
    rows,
    delimiter,
    detectedSource: detectImportSource(headers, fileName)
  };
}

export function parseBulkImportCsv(text: string, fileName?: string): ParsedBulkImportCsv {
  const table = parseDelimitedTable(text, fileName);
  if (!table) {
    return {
      candidates: [],
      headers: [],
      delimiter: ",",
      detectedSource: detectImportSource([], fileName),
      mappedHeaders: {
        fullName: null,
        phone: null,
        email: null,
        locationText: null,
        yearsOfExperience: null,
        externalRef: null
      }
    };
  }
  const { headers, rows, delimiter, detectedSource } = table;

  const fullNameIndex = findColumnIndex(headers, COLUMN_ALIASES.fullName);
  const phoneIndex = findColumnIndex(headers, COLUMN_ALIASES.phone);
  const emailIndex = findColumnIndex(headers, COLUMN_ALIASES.email);
  const locationIndex = findColumnIndex(headers, COLUMN_ALIASES.locationText);
  const experienceIndex = findColumnIndex(headers, COLUMN_ALIASES.yearsOfExperience);
  const externalRefIndex = findColumnIndex(headers, COLUMN_ALIASES.externalRef);

  if (fullNameIndex === -1) {
    return {
      candidates: [],
      headers,
      delimiter,
      detectedSource,
      mappedHeaders: {
        fullName: null,
        phone: phoneIndex >= 0 ? headers[phoneIndex] ?? null : null,
        email: emailIndex >= 0 ? headers[emailIndex] ?? null : null,
        locationText: locationIndex >= 0 ? headers[locationIndex] ?? null : null,
        yearsOfExperience: experienceIndex >= 0 ? headers[experienceIndex] ?? null : null,
        externalRef: externalRefIndex >= 0 ? headers[externalRefIndex] ?? null : null
      }
    };
  }

  const candidates = rows
    .map((values): BulkImportCandidate => ({
      fullName: readOptionalValue(values, fullNameIndex) ?? "",
      phone: readOptionalValue(values, phoneIndex),
      email: readOptionalValue(values, emailIndex),
      locationText: readOptionalValue(values, locationIndex),
      yearsOfExperience: parseExperienceValue(readOptionalValue(values, experienceIndex)),
      externalRef: readOptionalValue(values, externalRefIndex)
    }))
    .filter((candidate) => candidate.fullName.length >= 2);

  return {
    candidates,
    headers,
    delimiter,
    detectedSource,
    mappedHeaders: {
      fullName: headers[fullNameIndex] ?? null,
      phone: phoneIndex >= 0 ? headers[phoneIndex] ?? null : null,
      email: emailIndex >= 0 ? headers[emailIndex] ?? null : null,
      locationText: locationIndex >= 0 ? headers[locationIndex] ?? null : null,
      yearsOfExperience: experienceIndex >= 0 ? headers[experienceIndex] ?? null : null,
      externalRef: externalRefIndex >= 0 ? headers[externalRefIndex] ?? null : null
    }
  };
}
