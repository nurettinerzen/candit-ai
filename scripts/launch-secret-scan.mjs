#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const TEXT_FILE_SIZE_LIMIT_BYTES = 1024 * 1024;
const SKIPPED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".sqlite",
  ".db"
]);

const DETECTORS = [
  {
    label: "resend_api_key",
    pattern: /\bre_[A-Za-z0-9]{20,}\b/g
  },
  {
    label: "stripe_secret_key",
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g
  },
  {
    label: "github_token",
    pattern: /\bghp_[A-Za-z0-9]{20,}\b/g
  },
  {
    label: "github_pat",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g
  },
  {
    label: "google_api_key",
    pattern: /\bAIza[0-9A-Za-z\-_]{20,}\b/g
  }
];

const ALLOWLIST_PATTERNS = [
  /sk_test_launch_drift/g,
  /replace-with-a-32-plus-char-secret/g,
  /disabled-for-production/g
];

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "--cached"], {
    encoding: "utf8"
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function shouldSkipFile(filePath) {
  const extension = extname(filePath).toLowerCase();

  if (SKIPPED_EXTENSIONS.has(extension)) {
    return true;
  }

  try {
    const stats = statSync(filePath);
    return !stats.isFile() || stats.size > TEXT_FILE_SIZE_LIMIT_BYTES;
  } catch {
    return true;
  }
}

function removeAllowlistedMatches(line) {
  return ALLOWLIST_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, ""),
    line
  );
}

const findings = [];

for (const filePath of listTrackedFiles()) {
  if (shouldSkipFile(filePath)) {
    continue;
  }

  let content;

  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  if (content.includes("\u0000")) {
    continue;
  }

  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = removeAllowlistedMatches(rawLine);

    for (const detector of DETECTORS) {
      detector.pattern.lastIndex = 0;
      const matches = line.match(detector.pattern);
      if (!matches) {
        continue;
      }

      findings.push({
        label: detector.label,
        filePath,
        lineNumber: index + 1,
        sample: matches[0]
      });
    }
  });
}

if (findings.length > 0) {
  console.error("Potential secret leaks detected:");
  for (const finding of findings) {
    console.error(
      `- [${finding.label}] ${finding.filePath}:${finding.lineNumber} (${finding.sample})`
    );
  }
  process.exit(1);
}

console.log("Secret scan passed with no known key signatures.");
