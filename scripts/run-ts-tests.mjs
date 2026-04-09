import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const roots = process.argv.slice(2);

function collectTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.test\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

const searchRoots = roots.length > 0 ? roots : ["src"];
const testFiles = searchRoots
  .map((root) => resolve(process.cwd(), root))
  .filter((root) => {
    try {
      return statSync(root).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap((root) => collectTestFiles(root))
  .map((file) => relative(process.cwd(), file))
  .sort();

if (testFiles.length === 0) {
  console.log("No TypeScript test files found.");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  cwd: process.cwd(),
  stdio: "inherit"
});

process.exit(result.status ?? 1);
