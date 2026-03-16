import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const I18N_FILE = path.join(ROOT, "lib", "i18n.ts");
const SOURCE_DIRS = [path.join(ROOT, "app"), path.join(ROOT, "components")];

function extractObjectBody(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) {
    return "";
  }

  let depth = 0;
  let end = -1;

  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end < 0) {
    return "";
  }

  return source.slice(braceStart + 1, end);
}

function extractQuotedKeys(body) {
  const keys = new Set();
  for (const line of body.split(/\n/)) {
    const match = line.trim().match(/^"([^"]+)"\s*:/);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function collectTranslationKeys() {
  const source = fs.readFileSync(I18N_FILE, "utf8");

  const baseBody = extractObjectBody(source, "const EN_PHRASE_TRANSLATIONS");
  const assignBody = extractObjectBody(source, "Object.assign(EN_PHRASE_TRANSLATIONS");

  return new Set([...extractQuotedKeys(baseBody), ...extractQuotedKeys(assignBody)]);
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".next" || entry.name === "node_modules") {
      continue;
    }

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes(" 2.")) {
      files.push(full);
    }
  }
}

function collectUiPhrases() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    walk(dir, files);
  }

  const phraseRefs = new Map();
  const turkishPattern = /[ÇĞİÖŞÜçğıöşü]/;
  const asciiTurkishTokens = [
    "aday",
    "adaylar",
    "basvuru",
    "başvuru",
    "mulakat",
    "mülakat",
    "gorusme",
    "görüşme",
    "rol",
    "aile",
    "ailesi",
    "bagla",
    "bağla",
    "planlanan",
    "bekliyor",
    "randevu",
    "ilan",
    "karar",
    "inceleme"
  ];

  const hasAsciiTurkishToken = (value) => {
    const normalized = value.toLocaleLowerCase("tr-TR");
    return asciiTurkishTokens.some((token) =>
      new RegExp(`(^|[^\\p{L}\\p{N}_])${token}([^\\p{L}\\p{N}_]|$)`, "u").test(normalized)
    );
  };

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\n/);

    lines.forEach((line, index) => {
      const lineNo = index + 1;

      for (const match of line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
        const raw = (match[1] ?? match[2] ?? match[3] ?? "").replace(/\s+/g, " ").trim();
        if (!raw || raw.length < 2) {
          continue;
        }
        if (raw.includes("${") || /[{}$`]/.test(raw)) {
          continue;
        }
        if (!turkishPattern.test(raw) && !hasAsciiTurkishToken(raw)) {
          continue;
        }

        if (!phraseRefs.has(raw)) {
          phraseRefs.set(raw, `${path.relative(ROOT, file)}:${lineNo}`);
        }
      }

      for (const match of line.matchAll(/>([^<>]{2,})</g)) {
        const raw = match[1].replace(/\s+/g, " ").trim();
        if (!raw || raw.length < 2) {
          continue;
        }
        if ((!turkishPattern.test(raw) && !hasAsciiTurkishToken(raw)) || /[{}$`]/.test(raw)) {
          continue;
        }

        if (!phraseRefs.has(raw)) {
          phraseRefs.set(raw, `${path.relative(ROOT, file)}:${lineNo}`);
        }
      }
    });
  }

  return phraseRefs;
}

const translationKeys = collectTranslationKeys();
const phrases = collectUiPhrases();

const missing = [...phrases.entries()]
  .filter(([phrase]) => !translationKeys.has(phrase))
  .sort((a, b) => a[0].localeCompare(b[0], "tr"));

if (missing.length === 0) {
  console.log("i18n audit passed: all detected Turkish UI phrases exist in EN_PHRASE_TRANSLATIONS.");
  process.exit(0);
}

console.error(`i18n audit failed: ${missing.length} phrase(s) missing translation key.`);
for (const [phrase, ref] of missing) {
  console.error(`- ${phrase}  (${ref})`);
}

process.exit(1);
