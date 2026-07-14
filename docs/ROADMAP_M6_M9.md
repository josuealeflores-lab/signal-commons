# Roadmap: M6 USAspending Connector → M7 LLM Reviewer Copilot → M8 Agent-Style Workflow → M9 Final Demo

**Status:** Cowork/Fable reviewed this roadmap and returned **PASS WITH NOTES** (see `docs/DECISIONS.md` D-089). **M6 is the next build milestone.** M7, M8, and M9 remain planning-only until M6 is complete and separately approved for implementation. This document is docs-only planning; it authorizes no code, migration, API call, database write, or environment change on its own.

The platform goal is a working Signal Commons system: a public demo-safe dashboard, a private reviewer queue, real USAspending connector candidates entering that queue, an authenticated LLM Reviewer Copilot inside the reviewer workflow, and a supervised agent-style workflow/digest — not just connector validation artifacts.

Binding boundaries that apply across every milestone below (restated, not new):
- No public publication of connector-sourced records.
- No auto-approval, anywhere.
- No automatic entity merge beyond strict UEI-exact reuse.
- Real USAspending records stay private/reviewer-only; the public app remains published/demo-safe only.

---

## M6 — USAspending Connector MVP

- **Private reviewer queue only** (Option B, D-083): real USAspending candidates become `is_demo = false` **private drafts** in `research_items`/`signals`/`companies` — never publicly published in M6.
- `new_company`/`entity_match` items are **view-only** in M6 — `submit_review_action`'s hard gate on `item_type != 'new_signal'` is unchanged, so these item types get zero review-action support this milestone, by design.
- The Stage-1 rationale (`matched_terms`, `matched_codes`, `agency_flag`, `rule_branch`) is shown to reviewers as **"why this was queued," not as truth** — it is the deterministic filter's guess, clearly separated from the factual award content.
- Entity resolution remains strict throughout:
  - UEI-exact reuse is the only automatic match path.
  - Name-similar/different-UEI always routes to `entity_match` (`reason='name_collision'`).
  - `possible_individual` (person-named-recipient) routes conservatively — the R5 check runs first, before any draft-company creation, and never auto-creates a company for a suspected individual.
  - Parent/subsidiary relationships are recorded as aliases but never auto-collapse a company.
- **M6 completion does not mean** Stage-1 recall is proven or that connector records are public-ready — both remain explicitly out of scope for this milestone's acceptance criteria (see D-089/D-083).

## M7 — LLM Reviewer Copilot

- Authenticated-reviewer-only. Not a public chatbot.
- The LLM provider key is server-only in the deployed app (never `NEXT_PUBLIC_`-prefixed, read only inside a Route Handler/Server Action).
- **The Supabase service-role key is not required in the Vercel reviewer-app runtime for this feature.** The Copilot's Server Action reads context and logs its output through the reviewer's own authenticated session (the same `getSessionSupabaseClient()` pattern already used for reviewer reads/writes elsewhere), not through a service-role client.
- Copilot output is **advisory only**.
- The Copilot cannot approve, publish, overwrite a reviewer's decision, call `submit_review_action`, or write to `research_items`/`review_actions` under any input.
- Recommended logging pattern: a **SECURITY DEFINER RPC** (e.g. `record_copilot_analysis`) that checks the caller is an authenticated, active reviewer internally — reviewer-gate-first, the same shape `submit_review_action` already uses — then inserts the analysis row as the function definer. This keeps one consistent enforcement style for all reviewer-driven mutations instead of introducing a second, RLS-policy-based write path.
- Provider/model/SDK details (exact model name, exact structured-output call shape) are **not locked in this roadmap** — they must be verified against current official provider documentation at M7 implementation time, and the selected model name should live in env/config, not be hardcoded into source.
- M7 satisfies the platform's direct-LLM-connection requirement.

## M8 — Agent-Style Workflow

- A **supervised** agent-style workflow/digest layered over the M6 connector's own steps and M7's per-item analysis — not a new independent system, and not autonomous publication.
- **M8A (dry-run agent + digest) is sufficient for the final-project agent-style demo requirement if time is tight.** It has zero write risk and still demonstrates the full tool-using loop live.
- **M8B (commit-mode agent) remains deferrable** — it adds real automation-of-writes value but is not required to satisfy the agent-workflow demo requirement.
- Provider-specific agent/tool-runner APIs are **not locked in this roadmap** — the exact SDK surface (tool-runner helper, tool definition shape) must be verified against current official provider documentation at M8 implementation time.
- No autonomous publication, no unsupervised public writes, and no automatic entity merge beyond the existing strict UEI-exact rule — every write-capable tool is audit-logged, and no tool in the tool set can reach `submit_review_action` or any `publication_status` column.

## M9 — Final Demo Polish

Demo narrative, in order:
1. Public dashboard.
2. Methodology/disclosure pages.
3. Private reviewer login.
4. Real USAspending candidate queue.
5. LLM Reviewer Copilot.
6. Agent dry-run/digest demo.
7. Clear safety-boundaries messaging (what is *not* automated).

M9 adds no new product capability — it is integration, rehearsal, and polish only.

---

## Prerequisites required before real connector records enter the queue (M6, Cowork-flagged)

The following must be addressed as part of M6 — none are optional cleanup, and none are satisfied by the methodology docs alone:

1. **Fix the hardcoded `is_demo=true` in the review queue data mapping.** Confirmed in the current codebase: `src/lib/review/queue.ts`'s `SignalRow.is_demo` is typed as the literal `true` (line 62), and `mapSignalRow()` hardcodes `is_demo: true` unconditionally (line 80) instead of passing through the real `row.is_demo` column value. **This is the M6-critical fix** — reviewers must be able to distinguish real connector drafts from demo items before any real connector record enters the private queue; until it's fixed, any real (`is_demo=false`) connector-sourced signal would be silently mislabeled as demo in the reviewer UI, a direct violation of publication invariant #5 ("demo and live content must be distinguishable").
   - **Related, but not M6-blocking:** `src/lib/data/repository.ts` has the identical hardcoding pattern in the **public** data layer — `mapSignalRow()` (line 61) and `mapCompanyRow()` (line 98) both hardcode `is_demo: true` unconditionally instead of passing through the real column value. Under Option B, M6 never publishes a connector record publicly, so this specific file is **not an M6 blocker**. It is, however, a latent public-surface issue: if left unfixed, a real record that later does get publicly published would also show as demo on the public site. This must be fixed and bundled together with whatever future milestone adds real (non-demo) public publication and/or a conditional "some content is demo, some is real" banner — it should not be forgotten as a M6-adjacent loose end.
2. **Add or plan a DB-level invariant so a signal cannot be published unless its company is published.** `docs/DATA_MODEL.md`'s current publication invariants (§"Publication invariants," items 1–7) do not yet state this explicitly, and M6 is the first milestone where it can actually be exercised: a connector-created company stays `draft` while its `new_signal` item can still be `approve`d through the unmodified M4 gate (R1, D-085) — today, in the all-demo dataset, every published signal's company happens to already be published, so this gap has never been triggered.
   - If implemented as a trigger/check, document the chosen approach (e.g., a `before insert or update` trigger on `signals` raising if `publication_status = 'published'` and the linked `companies.publication_status <> 'published'` — **`before insert`, not just `before update`**, so a signal can never be inserted directly in a `published` state while its company is still a draft, not only blocked from later transitioning into one) here and in `docs/DATA_MODEL.md` before writing it.
   - At minimum, a **public-invisibility test** must prove that an approved connector-imported `new_signal` whose company remains a draft does not appear anywhere on a public route — this is required in M6 regardless of whether the DB-level trigger ships in the first M6A pass.
3. **Make service-role-leakage tests explicit.** A repeatable check (CI script or test) confirming no client-bundled file imports `service-client.ts`, extended to cover the new M6 connector modules and the M7 Copilot path.
4. **Make RLS/no-anon tests explicit for new tables.** `company_aliases` and `ingestion_runs` must have an explicit test proving no anon SELECT/INSERT/UPDATE/DELETE policy exists on either table.
5. **Make inert-rendering tests explicit for award text and Copilot output.** A fixture `award_description` (and, later, Copilot output) containing `<script>`/markdown/HTML must render as plain text with no execution or structural change — required in M6 itself, not deferred to Stage-2.
6. **Make R5 conservative-behavior tests explicit.** Person-named-recipient fixtures (comma-inverted and bare-token forms) must never create a draft company and must always route to `entity_match` with `reason='possible_individual'`.
7. **Make the Copilot session-read boundary explicit** (applies once M7 begins, called out here so M6's schema/test conventions anticipate it): the Copilot must read/write via the reviewer session, never a service-role client, and `record_copilot_analysis` (or equivalent) must reject any caller who isn't an authenticated, active reviewer.
8. **Make Stage-1 framing explicit, everywhere it's described:** candidate-surfacing only; recall unvalidated; no recall gate passed; no connector-readiness claim. This applies to reviewer-facing UI copy, code comments, and `ingestion_runs.metadata`, matching `docs/research/usaspending_validation.METRICS.md`'s own disclosed-limitation language.

---

## M6A implementation plan (plan only — not authorized to implement)

**Scope:** schema + internal ingestion-run model. No connector fetch/filter/entity-resolution code yet, no reviewer UI changes yet — those are M6B–M6D.

**Migrations (additive, no changes to existing tables' data):**
- `company_aliases` — `id`, `company_id` (FK → `companies`), `alias`, `alias_type` (`uei|legal_name|dba|parent_uei|parent_name`), `normalized_alias`, `created_at`.
  - Partial unique index `company_aliases_uei_unique` on `(normalized_alias) where alias_type = 'uei'` — a **DB-level safety backstop**, not the primary conflict-detection mechanism.
  - **Duplicate-UEI conflict handling plan (three layers, precise):**
    1. *Pre-check (primary path):* before inserting a `uei`-type alias, the ingestion script queries for an existing row with the same `normalized_alias`. No match → safe to insert. A match pointing at a *different* company → route to an `entity_match` item (`reason='duplicate_uei'`); do not insert the new alias, do not touch the existing company.
    2. *Partial unique index:* exists purely as a backstop against a missed pre-check or a race condition — the ingestion script is not expected to rely on it for correctness.
    3. *Violation handling:* if the unique index is violated anyway, the script must catch that specific error, log it as the same `duplicate_uei` conflict, and exit/continue cleanly — never crash mid-run leaving partial rows, never treat the violation as a signal to merge.
  - **Invariant, restated:** the system never auto-merges two companies on a UEI conflict, under any of the three layers.
- `ingestion_runs` — `id`, `connector_key`, `started_at`, `finished_at`, `status` (`running|succeeded|partially_succeeded|failed`), `records_discovered`, `records_created`, `records_skipped`, `error_summary`, `metadata jsonb`, `created_at`. One row per connector invocation.
- `research_items.is_demo boolean not null default true` — additive column; a connector-created row explicitly sets it `false`. This is the schema-level fix underlying prerequisite #1 above (the UI-layer fix to `queue.ts` is separate M6D work, but the column must exist first).

**DB/RLS policies:**
- No anon access to `company_aliases` or `ingestion_runs` — no anon policy of any kind.
- Reviewer SELECT where appropriate: both tables get a reviewer-only SELECT policy (`to authenticated using (exists (select 1 from reviewer_profiles where id = auth.uid() and is_active))`), matching the existing `research_items`/`review_actions` reviewer-read pattern.
- No INSERT/UPDATE/DELETE policy for any role on either table — writes happen only via the service-role ingestion **script** (a local/CI-only CLI process), which bypasses RLS entirely, exactly like today's `supabase/seed-*.ts` scripts. This is a script-only write path, not a Vercel-reachable one — it does not reintroduce a service-role dependency into the deployed app.
- Publication-invariant safeguard (prerequisite #2 above): plan the DB-level check/trigger preventing a signal from being published while its company remains a draft, to be written and reviewed as its own small, explicit migration step within M6A or immediately after, before any real commit-mode ingestion run.

**Tests to add (extending existing conventions in `tests/integration/`, `tests/lib/` or `tests/app/`, and `e2e/`):**
- New-tables RLS/no-anon tests for `company_aliases` and `ingestion_runs`.
- `is_demo` defaults-and-false-for-connector-records tests: a fixture row inserted with `is_demo=false` is correctly distinguishable from the existing all-`true` demo rows.
- Public-invisibility test for connector drafts: a connector-sourced draft company/signal/research item never appears on any public route.
- Published-signal-with-draft-company cannot leak publicly: the specific R1 risk case — an approved `new_signal` whose company is still `draft` — asserted directly, not just inferred from the general public-invisibility test.
- Service-role-not-required-in-reviewer-app-runtime test/check: a build-time or grep-based CI check confirming no client-bundled file imports `service-client.ts`.
- Confirm all existing tests remain green after the additive migration (`npm run lint && npm run typecheck && npm test && npm run build`, plus `test:db`/`test:e2e`).

**Gate:** migration applies cleanly to dev/CI; the full existing test suite still passes unchanged; the new RLS/no-anon/public-invisibility tests above are added and pass; no connector fetch/filter code exists yet at this phase. This plan does not authorize starting M6A — it is the concrete next step pending separate approval.
