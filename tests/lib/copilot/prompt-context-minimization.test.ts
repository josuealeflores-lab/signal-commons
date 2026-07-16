import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hermetic, filesystem-only -- confirms the Copilot prompt builder and its
 * narrow context read can never reference review_actions history,
 * reviewer_note, before_state, after_state, or a full research_items
 * payload (docs/DECISIONS.md D-095's data-minimization requirement).
 * CopilotPromptContext's own TypeScript shape already can't express these
 * fields; this grep-based check is an independent, structural guarantee on
 * top of that, mirroring tests/lib/no-connector-leakage.test.ts's approach.
 */

const COPILOT_SRC_ROOT = path.resolve(__dirname, "..", "..", "..", "src", "lib", "copilot");
const FORBIDDEN_PATTERNS = [/\.history\b/, /reviewer_note/, /before_state/, /after_state/, /full_payload/i];

function listFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(dir, entry.name));
}

describe("copilot prompt/context data minimization", () => {
  it.each(listFiles(COPILOT_SRC_ROOT))(
    "%s never references review_actions history, reviewer_note, before_state, after_state, or a full payload",
    (file) => {
      const source = fs.readFileSync(file, "utf-8");
      const offenders = FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(source));
      expect(offenders).toEqual([]);
    },
  );
});
