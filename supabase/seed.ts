import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getServiceSupabaseClient } from "../src/lib/supabase/service-client.ts";
import { demoDataSchema } from "../src/lib/data/schema.ts";

/**
 * Portable, user-runnable seed script (docs/DECISIONS.md D-046).
 *
 * Validates seed/demo-data.json locally, then calls the reseed_demo_data
 * Postgres RPC via the service-role client. The RPC itself performs the
 * atomic delete/reinsert/derive/verify entirely inside Postgres — this
 * script's only job is validation + one RPC call.
 *
 * Requires only NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * No MCP, no pg, no psql, no Supabase CLI, no connection string, at
 * seed-run time — runnable by anyone, anytime, outside Claude Code.
 *
 * Never prints, logs, or writes the service-role key anywhere.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSeedJson(): unknown {
  const seedPath = path.resolve(__dirname, "../seed/demo-data.json");
  const raw = readFileSync(seedPath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  console.log("Validating seed/demo-data.json against demoDataSchema...");
  const rawJson = loadSeedJson();
  const parseResult = demoDataSchema.safeParse(rawJson);

  if (!parseResult.success) {
    console.error("seed/demo-data.json failed schema validation:");
    console.error(parseResult.error.message);
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed. Calling reseed_demo_data via the service-role client...");

  let supabase;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const { error } = await supabase.rpc("reseed_demo_data", { payload: parseResult.data });

  if (error) {
    console.error("reseed_demo_data RPC failed:");
    console.error(`  message: ${error.message}`);
    if (error.details) console.error(`  details: ${error.details}`);
    if (error.hint) console.error(`  hint: ${error.hint}`);
    process.exitCode = 1;
    return;
  }

  console.log("Seed complete — reseed_demo_data reported no errors and its own post-seed verification counts passed.");
}

main();
