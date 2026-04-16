import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const I18N_FILE = path.join(ROOT, "lib", "i18n.ts");
const DEFAULT_SOURCE_ENTRIES = [path.join(ROOT, "app"), path.join(ROOT, "components"), path.join(ROOT, "lib")];

function resolveSourceEntries(rawArgs) {
  if (rawArgs.length === 0) {
    return DEFAULT_SOURCE_ENTRIES;
  }

  const resolved = rawArgs
    .map((entry) => {
      const fromCwd = path.resolve(process.cwd(), entry);
      if (fs.existsSync(fromCwd)) {
        return fromCwd;
      }

      const fromRoot = path.resolve(ROOT, entry);
      return fs.existsSync(fromRoot) ? fromRoot : null;
    })
    .filter(Boolean);

  return [...new Set(resolved)];
}

const SOURCE_ENTRIES = resolveSourceEntries(process.argv.slice(2));

function extractObjectBodies(source, marker) {
  const bodies = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start < 0) {
      break;
    }

    const braceStart = source.indexOf("{", start);
    if (braceStart < 0) {
      break;
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
      break;
    }

    bodies.push(source.slice(braceStart + 1, end));
    cursor = end + 1;
  }

  return bodies;
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
  const keys = new Set();

  const baseBodies = extractObjectBodies(source, "const EN_PHRASE_TRANSLATIONS");
  const assignBodies = extractObjectBodies(source, "Object.assign(EN_PHRASE_TRANSLATIONS");

  for (const body of [...baseBodies, ...assignBodies]) {
    for (const key of extractQuotedKeys(body)) {
      keys.add(key);
    }
  }

  return keys;
}

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const stats = fs.statSync(dir);
  if (stats.isFile()) {
    if (/\.(ts|tsx|js|jsx)$/.test(path.basename(dir)) && !path.basename(dir).includes(" 2.")) {
      files.push(dir);
    }
    return;
  }

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
  for (const entry of SOURCE_ENTRIES) {
    walk(entry, files);
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
