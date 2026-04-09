import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.join(ROOT, "apps/web/app"),
  path.join(ROOT, "apps/web/components")
];
const FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const TEXT_HINTS = [
  "placeholder=",
  "title=",
  "description=",
  "message=",
  "label=",
  "hint=",
  "aria-label=",
  "toast",
  "NoticeBox",
  "LoadingState",
  "EmptyState",
  "ErrorState"
];
const SKIP_PATH_PARTS = new Set([".next", "node_modules", "ui-specs"]);
const SUSPICIOUS_LITERAL =
  /"[^"\n]*(?:[A-Za-zÇĞİÖŞÜçğıöşü]{3,}[^"\n]*)"|'[^'\n]*(?:[A-Za-zÇĞİÖŞÜçğıöşü]{3,}[^'\n]*)'/g;
const INLINE_TEXT_NODE = />\s*[^<{][^<]{1,}\s*</;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_PATH_PARTS.has(entry.name)) {
        continue;
      }
      walk(fullPath, files);
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isProbablyVisible(line) {
  return TEXT_HINTS.some((hint) => line.includes(hint)) || INLINE_TEXT_NODE.test(line);
}

function isNoise(line) {
  return (
    line.includes("function ") ||
    line.includes("t(") ||
    line.includes("translateUiText(") ||
    line.includes("transformUiText(") ||
    line.includes("message={") ||
    line.includes("import ") ||
    line.includes("export ") ||
    line.includes("className=") ||
    line.includes('type="button"') ||
    line.includes("http://") ||
    line.includes("https://") ||
    line.includes("aria-hidden") ||
    line.includes("data-testid") ||
    line.includes("console.") ||
    line.includes("process.env") ||
    line.includes("use server") ||
    line.includes("use client") ||
    line.includes("Candit.ai")
  );
}

const results = [];

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) {
    continue;
  }

  for (const file of walk(dir)) {
    const content = fs.readFileSync(file, "utf8");
    const hasUiText =
      content.includes("useUiText(") ||
      content.includes("translateUiText(") ||
      content.includes("transformUiText(");

    const suspicious = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      if (!isProbablyVisible(line) || isNoise(line)) {
        return;
      }

      const matches = line.match(SUSPICIOUS_LITERAL);
      if (!matches) {
        return;
      }

      suspicious.push({
        line: index + 1,
        text: line.trim().slice(0, 180)
      });
    });

    if (suspicious.length > 0) {
      results.push({
        file: path.relative(ROOT, file),
        hasUiText,
        suspicious
      });
    }
  }
}

results.sort((left, right) => {
  if (left.hasUiText !== right.hasUiText) {
    return left.hasUiText ? 1 : -1;
  }

  return right.suspicious.length - left.suspicious.length;
});

console.log("Translate audit");
console.log("===============");
console.log(`Toplam dosya: ${results.length}`);

for (const result of results) {
  console.log(`\n- ${result.file}`);
  console.log(`  useUiText: ${result.hasUiText ? "evet" : "hayır"}`);

  if (result.suspicious.length === 0) {
    console.log("  Şüpheli görünür literal: 0");
    continue;
  }

  console.log(`  Şüpheli görünür literal: ${result.suspicious.length}`);
  for (const item of result.suspicious.slice(0, 6)) {
    console.log(`    L${item.line}: ${item.text}`);
  }
}
