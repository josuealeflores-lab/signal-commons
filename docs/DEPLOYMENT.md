# Deployment — Environments, Production Setup, and Runbooks

This document covers Milestone 5's deployment/operational hardening work: environment separation, one-time production Supabase setup, Vercel cutover, the production verification checklist, and the manual reviewer-provisioning runbook. See `docs/DECISIONS.md` D-075 through D-081 for the reasoning behind each choice below.

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

## Reviewer provisioning runbook (manual, for later — not executed this milestone)

Production has zero real, loginable reviewer accounts after Milestone 5 — only the inactive Demo Baseline Reviewer, which cannot log in. To provision one real reviewer, when you're ready:

0. **Before provisioning any real reviewer account tied to Milestone 6 (Fable pre-M6 review fix — see `docs/DECISIONS.md` D-085): enable Supabase Auth's leaked-password protection** (Authentication → Policies, in the production project's dashboard) if it isn't already on. This was flagged as a recommended, zero-code follow-up back in `docs/READINESS_REVIEW.md`'s M5 security review; it becomes a concrete prerequisite the moment a real reviewer account might review real (non-demo) connector-sourced items, not just a generic best practice to get to eventually.
1. In the Supabase dashboard for the production project: **Authentication → Add User**, with the real reviewer's email and a password (or use the Admin API's `createUser` directly, one-off, with `email_confirm: true`).
2. Note the created user's UID.
3. Insert one row into `reviewer_profiles`: `id` = that UID, `display_name` = the reviewer's real name, `is_active = true`. This can be done via the Supabase SQL editor or a small one-off script using the service-role client — never client-side, and never via `supabase/seed-reviewer.ts` (that script is for the dev/CI shared-password fixture set only) or `supabase/seed-baseline-reviewer.ts` (that script is exclusively for the inactive system identity).
4. The new reviewer can now sign in at `/auth/login` on the production URL and access `/research-queue`/`/reviewer`.

This runbook is documentation only — no real reviewer account was created as part of Milestone 5 or by this update.

## Known, accepted, non-blocking follow-ups

- **`middleware.ts` → `proxy.ts` rename** — deferred; see `docs/DECISIONS.md` D-080. Next.js 16.2.10's deprecation warning for the legacy filename is cosmetic and non-blocking.
- **Rate limiting and idempotency keys on mutation endpoints** (in particular `submit_review_action`) — a known, accepted gap carried forward from the Milestone 4 plan, not addressed this milestone. See `docs/READINESS_REVIEW.md`.
