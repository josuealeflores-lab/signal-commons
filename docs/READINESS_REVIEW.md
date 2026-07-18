# Milestone 5 Readiness Review — Security + Accessibility (manual, combined)

Manual, documented review only — no automated accessibility tooling was added this milestone (`docs/DECISIONS.md` D-081). This document combines the security review (`docs/BUILD_PLAN.md`'s "basic security review" deliverable) and the accessibility review (its "accessibility review" deliverable) in one file.

## Security review

### Service-role boundary

Confirmed via repo-wide grep: no file under `src/app/`, `src/components/`, or `src/lib/data/` imports `service-client.ts` or references `SUPABASE_SERVICE_ROLE_KEY`. The service-role client is used only by `supabase/seed.ts`, `supabase/seed-reviewer.ts`, `supabase/seed-baseline-reviewer.ts`, `supabase/seed-research-queue.ts`, and `tests/integration/` setup — all run locally or in CI, never inside the deployed app's request path.

Confirmed: no `NEXT_PUBLIC_`-prefixed environment variable exists for the service-role key or any other secret — only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` carry that prefix, both non-secret by design.

### Vercel environment variables

Production scope should contain exactly two variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, both pointing at the new dedicated production Supabase project. `SUPABASE_SERVICE_ROLE_KEY` must be absent from Vercel's project settings entirely, under any scope — verify directly in the Vercel dashboard as part of cutover (`docs/DEPLOYMENT.md`).

### Production Supabase separation

The new production project should contain exactly one reviewer identity (the inactive Demo Baseline Reviewer, `docs/DECISIONS.md` D-076) and zero of the 5 shared-password dev/CI fixture accounts. Verified as part of the production verification checklist in `docs/DEPLOYMENT.md`.

### RLS / reviewer-gate assumptions

Re-walked against `docs/TECHNICAL_ARCHITECTURE.md`'s security checklist and the Milestone 4 decision log — no regressions found:
- `submit_review_action`'s reviewer gate (`docs/DECISIONS.md` D-055) remains the function's literal first statement, before any `research_items` lookup, `item_type` check, or status check — a non-reviewer/inactive caller gets an identical "not an active reviewer" error regardless of what they pass in.
- No RLS UPDATE/INSERT/DELETE policy exists for `authenticated`/`anon` on any of the 5 content tables (D-056) — the only path to `published` is the RPC's own internal update.
- `reviewer_profiles`'s own RLS (D-065) — no `anon` SELECT policy at all; `authenticated` gets exactly one self-scoped SELECT policy, no mutation policy.
- `review_actions` has no INSERT/UPDATE/DELETE policy for any role — append-only is structural, not conventional.

### Known, accepted, still-deferred gaps

- **No rate limiting** on mutation endpoints (in particular `submit_review_action`). Documented since the Milestone 4 plan's risk section; not addressed this milestone.
- **No idempotency keys** on review actions or ingestion (ingestion doesn't exist yet). A double form-submission is already guarded by the per-action valid-current-status check, but a true idempotency-key column is deferred.
- Both gaps are tracked in `docs/DECISIONS.md`'s "Intentionally deferred decisions" list.
- **Status update:** both gaps were promoted from "accepted" to **blocking for M11** (`docs/DECISIONS.md` D-098), with the full implementation design recorded in D-100 (M11 Phase B) — this M5-era passage is left otherwise unchanged as a historical record of the original finding.

### Supabase security advisors (production project)

Checked via the Supabase MCP `get_advisors` tool against `signal-commons-production` after migrations + seeding. All findings are pre-existing, expected properties of the M3/M4 schema/RLS design applied verbatim — nothing new was introduced by this milestone (no schema changes were made):

- **`submit_review_action` executable by `authenticated`** (WARN) — intentional, per `docs/DECISIONS.md` D-055: the function needs `auth.uid()` to resolve the calling reviewer's own session, so it must be granted to `authenticated` rather than `service_role`. Not a bug.
- **Leaked password protection disabled** (WARN) — a Supabase Auth project setting, not a migration/schema concern. Recommended, zero-code follow-up: enable it in the dashboard (Authentication → Policies) before any real reviewer account is provisioned. Not done as part of this milestone since it's a dashboard toggle outside "apply the same migrations unchanged," not a code change.
- **Unindexed foreign keys** (INFO, several tables) and **Auth RLS initplan re-evaluation** (WARN, the reviewer-select policies) and **multiple permissive SELECT policies** (WARN, anon + reviewer policies coexisting on the same 5 tables) — all are inherited, pre-existing properties of the M3/M4 schema and RLS design, unchanged by this milestone. Addressing them would require migration changes, which are out of scope for Milestone 5 ("no schema changes unless explicitly justified"). Tracked as a known, accepted, non-blocking follow-up for a future milestone.

## Accessibility review

Manual review of the following routes: `/`, `/sectors`, `/sectors/[slug]`, `/companies`, `/companies/[slug]`, `/signals`, `/signals/[id]`, `/methodology`, `/auth/login`, `/research-queue`, `/research-queue/[id]`, `/reviewer` (reviewer routes reviewed while signed in as a dev-project test-fixture reviewer only — never a real or production identity).

Checked against: semantic heading structure, keyboard operability of interactive controls, visible focus states, color-contrast of status/evidence badges, form label association, alt text/ARIA labeling where relevant.

| Area | Finding |
|---|---|
| Public page heading structure | Pass — each page has a single `<h1>`, nested headings follow document order (established in M1/M2's design-system work, D-019/D-020). |
| Evidence-strength / verification-status badges | Pass — implemented as labeled badges with both color and text (not color alone), per D-019. |
| Accessible chart (activity series) | Pass — accompanied by a text table alternative, per D-020. |
| Login form (`/auth/login`) | Pass — email/password inputs both have associated `<label>` elements (confirmed via `htmlFor`/`getByLabel` in `src/app/auth/login/page.tsx` and its test coverage). |
| Review-action forms (`ReviewActionForm.tsx`, `EditApproveDiff.tsx`) | Pass — form fields have associated labels; action buttons are real `<button>` elements (keyboard-operable, not click-handler `<div>`s). |
| Reviewer dashboard / research queue tables | Pass — tabular data uses semantic table markup; filter controls are real form elements. |
| Mobile nav toggle | Pass — existing component has an accessible name and keyboard operability (covered by its own unit test, `tests/components/MobileNavToggle.test.tsx`). |
| Focus states | Pass on components inspected — relies on browser/Tailwind default focus rings; no custom focus-suppressing CSS (e.g. no `outline: none` without a replacement) found in the reviewed components. |

No fixes were required as part of this review — findings above are all "pass," consistent with accessibility groundwork already established during M1/M2's design-system work (D-019/D-020) and carried forward through M3/M4 without regression.

## Production verification results

Production project: `signal-commons-production` (`us-east-1`). All checks from `docs/DEPLOYMENT.md`'s production verification checklist completed successfully:

- **Migrations applied**: all 3 confirmed present via `list_migrations` (`initial_schema`, `reseed_demo_data_where_true`, `reviewer_auth_and_publish_gate`).
- **Seeded counts**: 7 sectors, 21 companies, 21 signals (14 published / 7 draft), 21 source_documents, 21 signal_evidence — matches the demo dataset exactly; `reseed_demo_data`'s own post-seed verification also passed with no exceptions.
- **Baseline reviewer setup**: exactly 1 `reviewer_profiles` row, `display_name` = "Demo Baseline Reviewer (system identity — not a real reviewer, never used for login)", `is_active = false`. Exactly 1 `auth.users` row total (zero fixture accounts).
- **Baseline audit anchors**: 21 `research_items` (7 pending, 14 approved), 14 `review_actions`, all `action = 'approve'`, attributed to the baseline reviewer.
- **Idempotency**: `db:seed:baseline-reviewer:prod` and `db:seed:queue:prod` were each re-run a second time — identical counts afterward (1 reviewer_profiles, 1 auth.users, 21 research_items, 14 review_actions) — no duplicates, no errors.
- **Anon/public RLS + public data reads**: a known published signal (`demo-signal-1-1`) is readable by the anon/publishable client; a known draft signal (`demo-signal-1-3`) returns zero rows.
- **No reviewer fixture accounts in production**: confirmed — exactly 1 `auth.users` row, the Demo Baseline Reviewer, nothing else.
- **Supabase advisors**: checked, see "Supabase security advisors" above — no new issues introduced.
- **Post-cutover Vercel smoke checklist**: passed. Vercel Production's environment variables were repointed to `signal-commons-production`'s URL and publishable key only (no service-role key added), and the resulting deployment was verified live at `https://signal-commons-six.vercel.app`:
  - Public routes load (`/`, `/sectors`, `/companies`, `/signals`, `/methodology` — all HTTP 200).
  - The demo-data banner appears.
  - Public nav is unchanged (Sectors / Companies / Signals / Methodology all present).
  - A known draft/demo signal id (`demo-signal-1-3`) 404s publicly with the branded 404 page.
  - An unknown signal id shows the identical branded 404.
  - Unknown sector/company routes 404 the same way.
  - `/research-queue` redirects to `/auth/login` while logged out (HTTP 307).
  - `/reviewer` redirects to `/auth/login` while logged out (HTTP 307).
  - Production is now confirmed serving from the dedicated `signal-commons-production` Supabase project, not the shared dev/CI project.

  With this, Milestone 5's stop condition — a production URL is available and the full demo scenario works from a clean browser session — is satisfied.
