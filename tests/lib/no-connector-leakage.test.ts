import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hermetic, filesystem-only (no DB, no live API) -- confirms nothing
 * app-facing or in the public data layer ever imports the USAspending
 * connector modules or the service-role client. Scans src/app (public and
 * reviewer routes), src/components (shared UI), src/lib/data (the public
 * data-access layer), and src/lib/review (the reviewer-facing data/action
 * layer, added in M6D -- docs/DECISIONS.md D-094 -- since the reviewer
 * queue now does its own company/signal reads and must stay on the session
 * client, never service-role) -- the places connector/service-role code
 * must never leak into. Isolation is enforced by (a) these modules never
 * being referenced from any of the four, and (b) this grep-based check, not
 * by any runtime guard (the connector modules are deliberately not
 * `server-only`-guarded so they stay hermetically testable under plain
 * `npm test` -- see http-client.ts's header comment).
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..", "src");
const SCANNED_DIRS = ["app", "components", "lib/data", "lib/review"];
// lib\/connectors\/ already covers commit.ts/commit-serializer.ts/cli-guards.ts
// (M6C) since they live under src/lib/connectors/usaspending/. connector-usaspending
// is an additional, explicit pattern for the CLI script itself
// (supabase/connector-usaspending.ts), which lives outside src/lib/connectors/
// and so wouldn't otherwise match the first pattern.
const FORBIDDEN_IMPORT_PATTERNS = [/lib\/connectors\//, /service-client/, /connector-usaspending/];

function listFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findOffenders(dir: string): string[] {
  const files = listFilesRecursive(dir);
  const offenders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    if (FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(content))) {
      offenders.push(file);
    }
  }

  return offenders;
}

describe("no-connector-leakage", () => {
  it.each(SCANNED_DIRS)("no file under src/%s imports src/lib/connectors/** or service-client.ts", (relativeDir) => {
    const offenders = findOffenders(path.join(SRC_ROOT, relativeDir));
    expect(offenders).toEqual([]);
  });
});
