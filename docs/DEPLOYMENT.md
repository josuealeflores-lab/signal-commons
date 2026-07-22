# Deployment — Environments, Production Setup, and Runbooks

This document originated with Milestone 5's deployment/operational hardening work (environment separation, one-time production Supabase setup, Vercel cutover, the production verification checklist) and has since accumulated later milestones' runbooks as they were added: M9's production AI activation runbook, and M11 Phase A's production reviewer activation checklist, observability checklist, and key-rotation runbook. See `docs/DECISIONS.md` D-075 through D-081 for the M5-era reasoning, and D-097/D-100 for the later additions.

## Environment map

| Environment | Config source | Supabase project |
|---|---|---|
| Local dev (`next dev`) | `.env.local` | existing dev/test project |
| CI (`test:db`/`test:e2e`) | CI secrets (same values as `.env.local`) | existing dev/test project |
| Vercel Preview | Vercel dashboard, "Preview" scope | existing dev/test project — **shows dev/demo data; acceptable at this stage** (Preview reviews in-progress code, not what a real visitor sees) |
| Vercel Production | Vercel dashboard, "Production" scope | **new**, dedicated production project |
| One-time local production setup | `.env.production.local` (gitignored, referenced only by `:prod` npm scripts) | **new**, dedicated production project |

`.env.local` is never overwritten, repurposed, or touched by any production setup step. `.env.production.local` is never auto-loaded by anything — Next.js only auto-loads a file by that name during a local `NODE_ENV=production` build, which this project never runs; Vercel reads its environment variables from its own dashboard settings, not from any file in the repository.

`TEST_REVIEWER_EMAIL`/`TEST_REVIEWER_PASSWORD` are never needed in Vercel Production — they exist solely for `db:seed:reviewer` and `test:db`/`test:e2e`, all of which run locally or in CI, never against the deployed app. `SUPABASE_SERVICE_ROLE_KEY` for the production project is likewise never added to Vercel — it's used only by the local `:prod` seed scripts below, and is never printed by any script.

## Production setup scripts

| Script | Env file | Purpose |
|---|---|---|
| `db:seed:baseline-reviewer` (dev-scoped) | `.env.local` | test the new baseline-reviewer script against the existing dev project first |
| `db:seed:prod` | `.env.production.local` | seed demo companies/signals/evidence into the new production project |
| `db:seed:baseline-reviewer:prod` | `.env.production.local` | create the one inactive Demo Baseline Reviewer identity in the new production project |
| `db:seed:queue:prod` | `.env.production.local` | derive `research_items` + baseline audit anchors in the new production project, using `BASELINE_REVIEWER_EMAIL` |

There is deliberately **no `db:seed:reviewer:prod` script** — the 5-account, shared-password dev/CI fixture script must never run against production, and giving it no production-facing variant means it can't be run there even by typo of an existing `:prod` command name.

## One-time production setup order

1. Create a new Supabase project, dedicated to production (via the Supabase MCP connector or the Supabase dashboard).
2. Apply the 3 existing migrations to it, unchanged, in order:
   - `20260709062842_initial_schema.sql`
   - `20260709080747_reseed_demo_data_where_true.sql`
   - `20260710044846_reviewer_auth_and_publish_gate.sql`
3. Create `.env.production.local` locally (never committed) with the new project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `BASELINE_REVIEWER_EMAIL=baseline@signal-commons.invalid`.
4. Run `npm run db:seed:prod`.
5. Run `npm run db:seed:baseline-reviewer:prod`.
6. Run `npm run db:seed:queue:prod`.
7. Complete the production verification checklist below.
8. Only after it passes cleanly, repoint Vercel Production's environment variables (see "Vercel cutover" below).
9. Run the post-cutover Vercel smoke checklist below.

## Production verification checklist (pre-cutover, no vitest, no reviewer fixtures)

**Reviewer-fixture tests (`tests/integration/publish-gate.test.ts`, `tests/integration/reviewer-profiles-rls.test.ts`, `e2e/reviewer-workflow.spec.ts`) are never run against production — see `docs/DECISIONS.md` D-079.** They stay dev/CI-only permanently: `tests/integration/setup.ts`'s global setup requires ≥4 active `reviewer_profiles` rows before any `test:db` file can run at all, so the command is structurally incompatible with a fixture-free production project regardless of intent. Their job — proving the publish gate, reviewer RLS, and audit trail correct — is done once against dev/CI, against the exact same migrations/RPCs applied to production unchanged.

Production verification instead uses these fixture-free, mostly read-only checks:

1. **Migrations applied** — confirm all 3 migrations are present in the new project (e.g. via the Supabase MCP `list_migrations` tool or dashboard).
2. **`db:seed:prod` succeeded** — the `reseed_demo_data` RPC self-verifies via its own `RAISE EXCEPTION` checks (7 sectors, 21 companies, 21 signals, 14 published/7 draft, 21 source_documents, 21 signal_evidence, 21 company_sectors, exactly one primary sector per company — D-046), so a failed seed already fails loudly. Optionally spot-check via a read-only `SELECT COUNT(*)` per table.
3. **Baseline reviewer setup succeeded** — confirm exactly one `reviewer_profiles` row exists with `display_name` matching the Demo Baseline Reviewer and `is_active = false`. Re-run `db:seed:baseline-reviewer:prod` once more and confirm no duplicate row and no error (idempotency proof).
4. **`db:seed:queue:prod` succeeded; baseline audit anchors exist** — confirm one `review_actions` row with `action = 'approve'` per already-published signal's `research_items` row, attributed to the baseline reviewer's id.
5. **Baseline audit anchors are idempotent** — re-run `db:seed:queue:prod` once more and confirm the `review_actions` count for those items doesn't grow.
6. **Anon/public RLS behavior and public data reads** — using the anon/publishable client directly against the new project (a small, throwaway, read-only script — not vitest), confirm a known published signal is readable and a known draft signal id returns zero rows.
7. **No reviewer fixture accounts exist in production** — confirm `reviewer_profiles`/`auth.users` contain exactly one row (the Demo Baseline Reviewer) and nothing else.
8. **Supabase security advisors checked, where available** — via the Supabase MCP `get_advisors` tool, confirm no unexpected findings for the new project.

## Vercel cutover

1. In the Vercel dashboard, set **Production**-scoped environment variables to the new project's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only.
2. Leave **Preview** environment variables pointed at the existing dev/test project — unchanged.
3. Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel under any scope.
4. Trigger or wait for the next Production deployment to pick up the new variables.

**Rollback:** if anything is wrong post-cutover, revert Production's environment variables back to the old project's values. This is immediate and safe — the old project is never modified or migrated out of by this milestone, so nothing is lost by reverting.

## Post-cutover Vercel production smoke checklist

- Public routes load (`/`, `/sectors`, `/companies`, `/signals`, `/methodology`).
- The demo-data banner appears.
- Public nav is unchanged.
- A known draft/demo signal id returns the branded 404 publicly.
- An unknown signal/sector/company route returns the same branded 404.
- `/research-queue` and `/reviewer` redirect to `/auth/login` while logged out.

## Production reviewer activation checklist (manual, for later — a separate, production-touching gate)

Production has zero real, loginable reviewer accounts today — only the inactive Demo Baseline Reviewer, which cannot log in. **Production reviewer activation is explicitly not part of M11 Phase A, and not part of Phase B's code merge either — it is its own separate, final, explicitly-approved step (`docs/DECISIONS.md` D-100, D-101).** Every box below must be true before a real reviewer account is created:

- [x] M11 Phase A merged (reviewer-gate helper extraction, hermetic tests, this checklist, `docs/REVIEWER_RUNBOOK.md`, the observability and key-rotation sections below).
- [x] M11 Phase B merged (idempotency keys + rate limiting on `submit_review_action`/`record_copilot_analysis`, per D-100).
- [x] Phase B's migration applied to the production Supabase project — verified: 8/8 migrations present, `idempotency_keys` table/RLS/grants and both RPCs' new signatures confirmed live against production.
- [x] Phase B's code deployed to production (Vercel, deployed from `main`).
- [ ] **Leaked-password protection — currently blocked by Supabase plan tier, not yet complete.** Confirmed live (via the Supabase advisors tool) still disabled; the project's Supabase organization is on the Free plan, which does not support this feature (Pro Plan or above required). Per D-101, this is no longer a blocker to M11's own technical completion, but remains required before a real reviewer is activated. Resolve via one of: (1) upgrade the Supabase plan and verify this setting live in production, or (2) a separate decision record with explicit compensating controls and Cowork/Opus review — (1) is the preferred, expected path; (2) is a deliberate fallback, not a routine alternative.
- [ ] The remaining steps below completed.

**M11 technical work (Phase A + Phase B) and production schema/code alignment are both complete as of D-101.** The sole remaining item blocking real reviewer activation is the leaked-password-protection line above.

**Reviewer activation is independent of AI activation (M12).** A real reviewer can be activated and can perform full human review — approve, edit-and-approve, reject, mark disputed, reopen — entirely through the Phase A/B-hardened path while Copilot and the queue digest continue to show "AI features are not configured in this environment." `ANTHROPIC_API_KEY` is **not required** for a human-only reviewer activation. **No production AI activation is authorized as part of M11 (Phase A or Phase B).**

Once every box above is checked, to provision one real reviewer:

1. In the Supabase dashboard for the production project: **Authentication → Add User**, with the real reviewer's email and a password (or use the Admin API's `createUser` directly, one-off, with `email_confirm: true`).
2. Note the created user's UID.
3. Insert one row into `reviewer_profiles`: `id` = that UID, `display_name` = the reviewer's real name, `is_active = true`. This can be done via the Supabase SQL editor or a small one-off script using the service-role client — never client-side, and never via `supabase/seed-reviewer.ts` (that script is for the dev/CI shared-password fixture set only) or `supabase/seed-baseline-reviewer.ts` (that script is exclusively for the inactive system identity).
4. The new reviewer can now sign in at `/auth/login` on the production URL and access `/research-queue`/`/reviewer`. Share `docs/REVIEWER_RUNBOOK.md` with them.

This checklist is documentation only — no real reviewer account has been created by M11 Phase A or by this update.

## Operational observability checklist (manual monitoring — M11 Phase A)

**This is manual, human-performed monitoring, not automated alerting.** No new paid APM/alerting dependency is introduced in M11. Each watch item maps to a concrete, already-existing surface — not an abstract category:

| Watch item | Concrete surface | When to check |
|---|---|---|
| App/server-action errors | Vercel deployment status, build logs, and runtime error/log dashboards (or the Vercel MCP tools `get_runtime_errors`/`get_runtime_logs`/`get_deployment_build_logs`) | After every deploy; periodically; always before/after reviewer activation |
| RPC/auth/database errors | Supabase project logs (dashboard, or the Supabase MCP `get_logs` tool) | Same cadence as above |
| Reviewer action audit trail | `review_actions` table (row count/rate, action types) | Periodically once a real reviewer is active; as a before/after baseline around activation |
| AI usage, once activated | `copilot_analyses` table | Not yet relevant in M11 — table remains empty until M12 |
| Connector run visibility | `ingestion_runs` table | Relevant starting M13 — not yet active in M11 |
| Public corrections | `corrections@signal-commons.org` inbox (Gmail label/forwarding, confirmed live per M10) | Recurring, manual, non-technical check |
| Change audit | GitHub PR history and `docs/DECISIONS.md` entries | Whenever reviewing what changed and why |

**Before reviewer activation:** confirm Vercel and Supabase logs are both reachable and show no unexpected errors; confirm the corrections inbox is still receiving mail; confirm `review_actions` is empty or matches the expected baseline-only rows.

**After reviewer activation:** spot-check `review_actions` for the new reviewer's first few actions; confirm no unexpected Supabase auth errors; confirm Vercel shows no new runtime errors correlated with the reviewer's session.

## Key rotation and secret-handling runbook

- **No service-role key in the public app runtime.** `SUPABASE_SERVICE_ROLE_KEY` is never added to Vercel under any scope — unchanged since M5 (see "Environment map" above). It is used only by local `:prod` seed scripts, run from a developer machine.
- **`ANTHROPIC_API_KEY` is not provisioned anywhere yet.** Production AI activation remains M12 or later — not M11 Phase A, not Phase B.
- **If/when AI activation happens (M12), the provider key must be server-only** — never `NEXT_PUBLIC_`-prefixed, never present in any client bundle, following the same discipline already applied to `SUPABASE_SERVICE_ROLE_KEY`. See "Production AI activation runbook" below for the full sequencing.
- **Basic key-rotation steps (high level, any secret in this project):**
  1. Generate/obtain the new key value from its source (the Supabase dashboard for Supabase keys; the Anthropic console for a provider key, once one exists).
  2. Update the value in Vercel's dashboard for the affected scope(s) only — never mixing Production's and Preview's credentials.
  3. Trigger a new deployment so the running app picks up the new value.
  4. Revoke/invalidate the old key at its source once the new deployment is confirmed healthy.
  5. Record the rotation (date, reason, who performed it) — a short note in this file or an internal log is sufficient; no new tooling is introduced for this in M11.
- **If a key is suspected leaked:** rotate it immediately following the steps above — don't wait for confirmation of misuse — then separately investigate how it may have been exposed (a log line, a committed file, a screen share) and close that specific exposure path. Never "wait and see" with a suspected-leaked credential.

## Production AI activation runbook (documented only — not executed, requires separate approval)

M7's Reviewer Copilot and M8A's queue digest are implemented, tested, and merged, but intentionally **not activated in production**: `ANTHROPIC_API_KEY` is unprovisioned and there are 0 active production reviewers. **This section documents what activating them would involve — it does not execute any of these steps, and none of them is authorized by this document alone.** Each remains a separate, later, explicitly-gated decision (`docs/DECISIONS.md` D-095/D-096/D-097).

If and when that separate approval is given, in this order:

1. **Re-verify the current Anthropic model/API/tool-use request-response shape against official live documentation** before the first live call is ever made — the exact shape (model id, Messages API request/response format, tool-use `tool_use`/`tool_result` blocks) may have drifted since M7/M8A's implementation time, and neither `src/lib/copilot/client.ts` nor `src/lib/digest/client.ts` has ever been exercised against the real provider by any test in this repo.
2. **Provision `ANTHROPIC_API_KEY` as a server-only secret** in Vercel Production only after that verification — never `NEXT_PUBLIC_`-prefixed, never in a client bundle, following the same environment-separation discipline this document already applies to `SUPABASE_SERVICE_ROLE_KEY`.
3. **Make the production reviewer-account decision separately** — provisioning the provider key does not by itself require or imply activating a real reviewer account; follow the existing "Reviewer provisioning runbook" above only once that decision is made on its own terms.
4. **Preserve migration-before-reviewer-activation sequencing** — production's schema is already aligned through M7 (the `copilot_analyses` table and `record_copilot_analysis` RPC are already applied), so no migration step is needed here; the sequencing requirement is only that any future schema change must land before any reviewer activation that depends on it, not the other way around, matching the discipline already used for M6A–M8A.

Do not activate production AI as part of M9 — M9's own scope (`docs/DECISIONS.md` D-097) is documentation and polish only.

## Known, accepted, non-blocking follow-ups

- **`middleware.ts` → `proxy.ts` rename** — deferred; see `docs/DECISIONS.md` D-080. Next.js 16.2.10's deprecation warning for the legacy filename is cosmetic and non-blocking.
- ~~**Rate limiting and idempotency keys on mutation endpoints**~~ — **closed.** M11 Phase B (`docs/DECISIONS.md` D-100) implemented the `idempotency_keys` table and per-reviewer rate caps on `submit_review_action`/`record_copilot_analysis`; merged, `test:db`-verified (174/174), and applied to production. Retained here, struck through, only as a historical record of the original finding.
- **Leaked-password protection disabled** — not closed; see the production reviewer activation checklist above and `docs/DECISIONS.md` D-101. Currently blocked by the Supabase organization's Free plan tier, not a code/migration matter.
