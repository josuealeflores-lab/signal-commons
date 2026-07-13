# Architecture and Product Decisions

Record new decisions here with date, context, choice, and consequence.

## Decisions already made

### D-001 — Seven sectors receive equal emphasis

**Choice:** Politics & Civic Technology, Government Operations, Agriculture, Healthcare, Education, Nonprofits, and Climate & Energy are equally prominent.

**Consequence:** The dashboard and seed dataset cannot privilege a showcase sector.

### D-002 — Claude Code is the primary implementation environment

**Choice:** Use Claude Code in VS Code for repository work. Use Cowork for research and knowledge artifacts.

**Consequence:** `CLAUDE.md`, Git, tests, and plan review guide implementation.

### D-003 — Vertical slice before live research automation

**Choice:** Build the full public-to-review-to-publish flow with demo data before adding connectors.

**Consequence:** The first version is demonstrable and testable without fragile external dependencies.

### D-004 — Single application architecture

**Choice:** Next.js + Supabase + Vercel.

**Consequence:** No Kubernetes or microservices in the MVP.

### D-005 — No opaque success score

**Choice:** Show evidence dimensions, labels, rationale, and changes rather than a universal ranking.

**Consequence:** The product remains explainable while methodology matures.

### D-006 — Human approval gates publication

**Choice:** AI/imported research creates drafts only.

**Consequence:** Reviewer workflow and audit history are core product functionality.

### D-007 — Demo data is explicit

**Choice:** Fictional seed data is marked and disclosed.

**Consequence:** UI work can proceed without making unsupported real-world claims.

### D-008 — Scaffold via a temp-dir `create-next-app` run, then merge

**Choice:** Ran `create-next-app` in an isolated scratch directory (not the repo root) and copied only the needed generated files in by hand.

**Consequence:** The repo root was non-empty (docs, `.gitignore`, `.env.example`) and `create-next-app` expects an empty target for a clean non-interactive run; this avoided any risk of the CLI touching existing handoff files or re-initializing git. The CLI's own generated `README.md`, `.gitignore`, `CLAUDE.md`, and `AGENTS.md` were discarded in favor of the repo's existing versions.

### D-009 — npm as the package manager

**Choice:** `create-next-app --use-npm`.

**Consequence:** Matches the quality-gate commands already specified everywhere (`npm run lint/typecheck/test/build`); no lockfile-format decision needed later.

### D-010 — App Router, `src/` layout, `@/*` import alias

**Choice:** `--app --src-dir --import-alias "@/*"`.

**Consequence:** Matches the suggested repository structure in `docs/TECHNICAL_ARCHITECTURE.md` (`src/app/...`).

### D-011 — Placeholder home page replaces the default starter

**Choice:** `src/app/page.tsx` shows only the Signal Commons name and a one-line description instead of the Next.js/Vercel starter marketing content; the default `public/*.svg` boilerplate was not copied in.

**Consequence:** The scaffold boots without shipping unrelated starter branding. This is still not the dashboard — Milestone 1 replaces this placeholder entirely.

### D-012 — Reference images stay in `references/` only for Milestone 0

**Choice:** `references/brand-guide.png` and `references/dashboard-mockup.png` were not copied into `public/brand/`.

**Consequence:** `docs/BUILD_PLAN.md` allows either location for Milestone 0; no approved brand-asset extraction has happened yet, so the raw mockups remain non-runtime references. Revisit when the branded header is built in Milestone 1.

### D-013 — Vitest + React Testing Library + jsdom for the test runner

**Choice:** Added `vitest`, `@vitejs/plugin-react` (required by Vitest to compile JSX/TSX in tests), `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`, with the `@/*` alias resolved directly in `vitest.config.ts` rather than via an extra `vite-tsconfig-paths` dependency.

**Consequence:** One smoke test (`tests/page.test.tsx`) proves the pipeline works end to end without inventing domain logic that doesn't exist yet.

### D-014 — Zod added, unused for now

**Choice:** Added `zod` as a dependency ahead of any validation code.

**Consequence:** `docs/TECHNICAL_ARCHITECTURE.md` plans a `lib/validation` module; Zod is the standard choice for it and for validating future AI extraction output, but nothing calls it yet.

### D-015 — `.gitignore` gets Next.js-specific entries merged in, `next-env.d.ts` stays tracked

**Choice:** Added `out/`, `*.tsbuildinfo`, and `.vercel` to the existing `.gitignore`. `next-env.d.ts` is intentionally **not** ignored, despite `create-next-app`'s own generated `.gitignore` ignoring it by default.

**Consequence:** `next-env.d.ts` remains tracked and visible in the repo. No broad `.env*` glob was introduced, so `.env.example` stays tracked.

### D-016 — No `npm audit fix --force` for the transitive `postcss` advisory

**Choice:** `npm audit` reports 2 moderate-severity advisories from a `postcss` version bundled inside `next`'s own dependencies. `npm audit fix --force` would downgrade `next` to `9.3.3` (canary-range breaking change).

**Consequence:** Left as a known, tracked limitation rather than forcing a regression; revisit when Next.js ships an updated bundled `postcss`.

### D-017 — Omit public Research Queue preview

**Choice:** The public Milestone 1 dashboard does not surface a "Research Queue (Needs Review)" section, even though `docs/DESIGN_SYSTEM.md`'s dashboard layout list mentions one. The seed data's only queue-like content is 7 `draft`-status signals (one per sector); showing those publicly, even as a "preview," would violate D-006 (AI/imported research creates drafts only) and `docs/DATA_MODEL.md`'s publication invariant #4 (public queries must exclude draft content).

**Consequence:** Draft signals are never rendered, listed, counted in public metrics, or referenced on the public dashboard. The real, authenticated research queue remains Milestone 4 scope.

### D-018 — Reframe "Emerging This Week" as "Recently Emerging"

**Choice:** The seed dataset's `occurred_at` values (Jan–Jun 2026) don't fall within a literal trailing-7-day window of `meta.as_of` (2026-07-04), which would make a strict "this week" list empty. Renamed the section to "Recently Emerging": the top 5 most recent **published** signals overall, sorted by `occurred_at` descending, with a caption noting the dates reflect the fixed demo dataset rather than live monitoring.

**Consequence:** The section shows real, non-fabricated content instead of an empty list, without falsely implying live calendar-week freshness.

### D-019 — Evidence strength and verification status are separate UI components

**Choice:** `EvidenceStrengthBadge` (High/Medium/Low only) and `VerificationStatusBadge` (verified/partially_verified/unverified/disputed/rejected) are distinct components with their own TypeScript prop types, both wrapping one domain-agnostic `StatusPill` primitive. "Disputed" can only ever appear via `VerificationStatusBadge`, never as an evidence-strength value.

**Consequence:** The two axes defined in `docs/RESEARCH_METHODOLOGY.md` (evidence strength "is not a probability"; verification status is a review-lifecycle state) can never be conflated into one badge or one legend, at the type level, not just by convention.

### D-020 — Hand-rolled accessible chart, no charting library

**Choice:** The activity/momentum visualization is a hand-authored SVG bar chart paired with an always-visible `<table>` of the same monthly published-signal counts, rather than an external charting package. `docs/DECISIONS.md`'s own deferred-decisions list leaves "final chart library" unspecified, and the dataset is only 6 monthly buckets.

**Consequence:** Satisfies "chart has a text summary or data table" (accessibility checklist) with no new runtime dependency to justify.

### D-021 — Public-safe company/signal counting rule

**Choice:** Company-profile counts (21 total, 3 per sector) use the full company roster, since every company record is independently `publication_status: "published"` regardless of its associated signal's status. All signal-derived content (Published signals, High-confidence signals, Recently Emerging, the activity chart, Company Spotlight) is strictly gated to `publication_status: "published"` signals, with the "Company profiles" KPI explicitly captioned ("not all have a published signal yet") to avoid implying all 21 have public approved evidence.

**Consequence:** Company existence/profile data and signal-level evidence are governed by two clearly-documented, independently-testable gates instead of one conflated "is this public" rule.

### D-022 — Non-functional nav/search policy

**Choice:** The header's search input is omitted entirely in Milestone 1 (no backend exists for it yet) rather than shown disabled. Nav items for pages that don't exist yet (Sectors, Companies, Signals, Methodology) render as muted `aria-disabled` text with no `href` — never a dead link. "Research Queue" and "Reports" are omitted from the public nav entirely (see D-017 — these are authenticated Milestone-4+ concepts).

**Consequence:** No broken links, no fake/non-functional search experience presented as real.

### D-023 — Static demo freshness via `meta.as_of`

**Choice:** The dashboard's "reference date" display uses `meta.as_of` from the seed data, never `new Date()`/real wall-clock time.

**Consequence:** The UI never implies live monitoring freshness that doesn't exist yet; server-rendered output stays deterministic and testable (also underpins the Company Spotlight's deterministic sector rotation).

### D-024 — `next/font/google` for Inter, confirmed as build-time-only

**Choice:** Switched the Milestone-0 default (Geist) to Inter per `docs/DESIGN_SYSTEM.md`'s explicit typography direction, using `next/font/google`. Confirmed directly with the user that this fetches font files once at build time and self-hosts them afterward — there is no runtime/client-side network call to Google's servers, so it does not conflict with Milestone 1's "no external API calls" scope note (which targets live data/connector calls, not build tooling).

**Consequence:** Consistent Inter rendering for every visitor regardless of their system fonts, with no new runtime external dependency.

### D-025 — Signal detail routes use raw signal IDs

**Choice:** `/signals/[id]` uses the signal's raw `id` in the URL (e.g. `/signals/demo-signal-6-2`) since `signals[]` has no `slug` field in the seed schema, unlike sectors/companies.

**Consequence:** Signal URLs expose internal-looking ids rather than pretty slugs. Adding real slugs would require a seed-data schema change, out of scope without separate approval.

### D-026 — Filter options derived from the loaded dataset

**Choice:** Filter option lists (signal types, company types) are derived at runtime via `getAvailableSignalTypes()`/`getAvailableCompanyTypes()`, not hardcoded from the full documented taxonomies in `docs/PRODUCT_REQUIREMENTS.md`.

**Consequence:** Avoids offering filter options with zero possible matches (e.g. `signal_type: "partnership"` only ever occurs on the always-draft N-3 signal position, so it correctly never appears as a public filter option).

### D-027 — Server-rendered URL searchParams filtering

**Choice:** Filters/search/sort on `/companies` and `/signals` (and the company-type/evidence-strength filters on `/sectors/[slug]`) are implemented entirely as URL `searchParams` read by server components + plain GET `<form>`s.

**Consequence:** There is no client-side filtering/explorer component and no client-side filter state anywhere. All actual data filtering happens server-side via `browse.ts` functions; filtering works with JavaScript disabled and produces shareable/bookmarkable URLs.

### D-028 — NavLink client component only for active nav state

**Choice:** `NavLink.tsx` is a new client component, added solely because a persistent root-layout header has no other way to know the current route than `usePathname()`.

**Consequence:** It exists only to set `aria-current="page"` on the matching nav link and has nothing to do with filtering. After Milestone 2, the client component inventory is exactly two: the pre-existing `MobileNavToggle` (unchanged) and this new `NavLink`.

### D-029 — Shared layout lifted into root layout

**Choice:** `SiteHeader`/`DemoDataBanner`/skip-link/`SiteFooter` lifted from `app/page.tsx` into the root `app/layout.tsx`.

**Consequence:** Removes duplication across 8 routes and guarantees the demo-data banner appears on every route, including the new 404 page, automatically.

### D-030 — Company "What to watch next" uses honest empty state

**Choice:** The company profile's "What to watch next" section renders an honest empty state ("No watch items are recorded for this demo company yet") rather than fabricated content, since `seed/demo-data.json` has no `company_watch_items` data at all despite `docs/DATA_MODEL.md` documenting that entity.

**Consequence:** The required section is present on every company profile, but never implies data that doesn't exist.

### D-031 — Playwright deferred

**Choice:** Playwright smoke tests are deferred past Milestone 2 despite `CLAUDE.md`'s "add once core routes exist" guidance technically now applying.

**Consequence:** Kept as a distinct, explicitly-approved follow-up step rather than bundled into an already-large milestone. True end-to-end 404/navigation verification (e.g. that `notFound()` actually renders the branded 404 page) is deferred to that step; Milestone 2's own tests instead verify the underlying "draft/unknown → undefined" data behavior at the `browse.ts`/`repository.ts` unit-test level.

### D-032 — No fabricated sector descriptions or "workflows being changed"

**Choice:** `docs/PRODUCT_REQUIREMENTS.md`'s sector-detail requirements list a "plain-language sector definition" and "workflows being changed," but `sectors[]` in the seed schema has no `description` field and no such data exists anywhere. The sector detail page instead shows a factual, product-principle-grounded line ("One of the seven sectors Signal Commons tracks with equal prominence") rather than inventing sector-specific marketing copy; "workflows being changed" is omitted entirely rather than fabricated.

**Consequence:** Same reasoning as D-030 — required sections stay honest about what is and isn't backed by real data, consistent with "visible uncertainty before false precision."

### D-033 — Playwright added now, reversing the Milestone 2 deferral

**Choice:** Playwright smoke tests were added in this small follow-up milestone (2.1), specifically to regression-protect the public route chain and the draft/unknown-signal 404 boundary before Milestone 3 replaces the JSON-repository data layer with Supabase. Chromium only, dev-dependency only (`@playwright/test`); the one-time browser-binary download is build/test tooling (same category as D-024's font fetch), not a live/runtime external call.

**Consequence:** The e2e fixtures in `e2e/smoke.spec.ts` (company slugs, signal ids, sector names) are coupled to the current `seed/demo-data.json`. This file should be revisited during the Milestone 3 Supabase/data-layer swap, since the underlying data source — and potentially some ids/slugs — may change.

### D-034 — Playwright specs live in `e2e/`, explicitly separated from Vitest

**Choice:** Playwright specs live in a dedicated `e2e/` directory, not `tests/` (which stays Vitest-only). `vitest.config.ts` was updated to explicitly scope Vitest's `include` to `tests/**/*.{test,spec}.{ts,tsx}` and `exclude` `e2e/**` (and `node_modules/**`), rather than relying on Vitest's default glob to happen not to match Playwright specs.

**Consequence:** `npm test` (Vitest) and `npm run test:e2e` (Playwright) cannot collide or accidentally pick up each other's spec files, regardless of future default-glob changes in either tool.

### D-035 — Playwright runs the production build on an explicit, dedicated port

**Choice:** Playwright's `webServer` runs the real production build via `npm run build && npm run start -- -p 3100` — the port is passed explicitly as a CLI flag to `next start`, not left to `next start`'s default (3000), since a developer's own `next dev` may already be using 3000 (this exact conflict happened earlier in this project's session).

**Consequence:** The e2e suite exercises actual build output on a collision-free port; `baseURL` in `playwright.config.ts` points at the same explicit port.

### D-036 — `npm run test:e2e` stays separate from `npm test`

**Choice:** `npm run test:e2e` (Playwright) is a separate command from `npm test` (Vitest) — e2e specs are not bundled into the fast unit/component suite.

**Consequence:** `npm test` stays fast or CI-cheap; the full quality gate for changes touching routing/navigation is the existing four commands plus this fifth, run separately.

### D-037 — Hosted dev Supabase project created via the Supabase MCP connector

**Choice:** Used the Supabase MCP connector (`create_project`/`apply_migration`) to provision and migrate a hosted dev project, rather than the local Supabase CLI/Docker.

**Consequence:** Matches `docs/TECHNICAL_ARCHITECTURE.md`'s minimal-path guidance and avoids a Docker dependency; the MCP connector was already integrated in this environment.

### D-038 — Migration scope is 7 tables

**Choice:** `sectors`, `companies`, `company_sectors`, `source_documents`, `signals`, `signal_evidence`, and a new `app_meta` table (replacing the JSON `meta` object).

**Consequence:** `company_aliases`, `company_watch_items`, `research_items`, `review_actions`, `ingestion_runs` are deferred to the milestones that actually use them (Milestone 4+), not created speculatively now.

### D-039 — Migrations include the full documented column list per in-scope table

**Choice:** Each of the 7 tables includes `docs/DATA_MODEL.md`'s full documented columns, including several nullable fields unused by the app today (`legal_name`, `website_url`, `founded_year`, `event_date`, `content_hash`, `excerpt`, `storage_path`).

**Consequence:** The TypeScript domain layer (`src/lib/data/schema.ts`) continues to project only the subset the app actually uses; the schema doesn't need re-migration when those fields are wired up later.

### D-040 — Existing string ids preserved as literal TEXT primary keys

**Choice:** Ids like `"demo-company-1-1"`/`"demo-signal-6-2"` stay as literal `TEXT` primary keys, not UUIDs. `signal_evidence` (the one table with no JSON-native id) gets a deterministic id, `` `${signal.id}-ev-${index}` ``, not a random UUID.

**Consequence:** D-025's raw-id `/signals/[id]` routing and every existing test fixture id keep working unchanged; re-seeding is naturally idempotent instead of producing duplicate `signal_evidence` rows.

### D-041 — RLS design: anon gets SELECT-only, dual-gated by publication status

**Choice:** The anon role gets SELECT-only policies: `sectors` (all rows), `companies` (`publication_status = 'published'`), `company_sectors` (gated by the company's own `publication_status`), `signals` (published only), `signal_evidence`/`source_documents` (gated by the linked signal's `publication_status`), and `app_meta` (unconditional SELECT, no mutations). No INSERT/UPDATE/DELETE policies exist for anon on any of the 7 tables. The `company_sectors` partial unique index (`is_primary` per company) enforces "at most one" primary sector at the DB level; "exactly one per published company" is a seed-validation and `test:db` guarantee, not a DB constraint.

**Consequence:** Draft content, and anything derived only from draft content, is structurally unreachable by the anon client regardless of application-code correctness; the "at most one" vs. "exactly one" distinction is documented rather than silently assumed.

### D-042 — Reviewer-role RLS policies deferred to Milestone 4

**Choice:** No reviewer/authenticated-role RLS policies exist yet.

**Consequence:** They're added once reviewer auth exists to actually exercise and test them, avoiding untested policy code sitting in the schema.

### D-043 — No Postgres VIEW database objects in Milestone 3

**Choice:** "Public read views/queries" are satisfied via parameterized repository queries against tables directly (always through the anon/publishable client), not separate `VIEW` objects.

**Consequence:** One less database object type to migrate/maintain; equivalent behavior achieved entirely in `repository.ts`/`dashboard.ts`/`browse.ts`.

### D-044 — `server-only` added to structurally guard the service-role client module

**Choice:** Added the tiny `server-only` package; `src/lib/supabase/service-client.ts` starts with `import "server-only"`.

**Consequence:** That module throws if ever imported into client-bundled code, enforcing CLAUDE.md's #1 decision priority (credential security) at import time rather than by convention alone. Under Vitest specifically, this guard throws unconditionally (its "react-server" no-op export condition is a Next.js-bundler behavior that Vitest does not replicate — confirmed directly by testing `resolve.conditions: ["react-server"]` in `vitest.integration.config.ts`), so `tests/integration/` uses a separate, non-guarded test-only client (`tests/integration/test-service-client.ts`) instead of importing `service-client.ts`.

### D-045 — New single-row `app_meta` table replaces the JSON `meta` object

**Choice:** `app_meta` has one row (`id int primary key default 1 check (id = 1)`) holding `dataset_name`, `is_demo`, `warning`, `generated_for`, `as_of`, with its own public SELECT RLS policy (no mutations).

**Consequence:** `getMeta()` keeps its exact prior shape/purpose (dataset labeling, and the deterministic reference date behind Company Spotlight's rotation and the dashboard's reference-date display) while reading from Postgres through the same anon client as everything else — no special-cased access path.

### D-046 — Seed execution via a Postgres RPC, not MCP/`execute_sql` or client-side transactions

**Choice:** `supabase/seed.ts` validates `seed/demo-data.json` locally via `demoDataSchema`, then calls a Postgres RPC (`reseed_demo_data(payload jsonb)`, created by the initial migration) using the service-role client. The RPC deletes children-before-parents and re-inserts parents-before-children entirely inside Postgres, derives `company_sectors` from each company's `primary_sector_slug` and `signal_evidence` from each signal's embedded `evidence[]` (deterministic ids per D-040), then runs post-seed verification counts and `RAISE EXCEPTION` on any mismatch. `EXECUTE` on the RPC is revoked from `PUBLIC`/`anon`/`authenticated` and granted only to `service_role`.

**Consequence:** Atomicity is a property of one Postgres function call rolling back entirely on error, not a claim that `supabase-js` table methods are transactional. No MCP tool call, `pg` dependency, or connection string is required to re-run seeding — `npm run db:seed` only needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and is runnable by anyone, anytime, outside Claude Code. (A follow-up migration added `WHERE true` to the function's bare `DELETE` statements after discovering this database enforces "DELETE requires a WHERE clause.")

### D-047 — `@supabase/supabase-js` added as the only new runtime dependency

**Choice:** Added `@supabase/supabase-js`; `@supabase/ssr` is deferred to Milestone 4 (session/cookie-based auth isn't needed until reviewer auth exists).

**Consequence:** No unused auth-helper dependency sitting in the tree before it's needed.

### D-048 — Data-layer functions become async; affected components/pages become async Server Components

**Choice:** Every DB-touching function in `repository.ts`/`dashboard.ts`/`browse.ts` became `async`, using the anon/publishable client exclusively, with identical function names/params/return shapes (now `Promise<T>`). The 6 dashboard components (`CompanySpotlight`, `DashboardHero`, `SectorOverview`, `ActivityChart`, `KpiCards`, `RecentlyEmerging`) and `sectors/page.tsx` became `async` Server Components; the other 5 page files already were. Pure, data-access-free functions (`filterCompanyViews`, `filterSignalViews`, `sortCompanyViews`, `COMPANY_SORT_OPTIONS`) stayed synchronous.

**Consequence:** Callers didn't need to change their call sites beyond adding `await`; no component/page had to be restructured beyond that mechanical change.

### D-049 — Data-layer testing is split between `npm test` and `npm run test:db`

**Choice:** `npm test` stays hermetic: schema validation against the seed JSON fixture, plus pure filter/sort function tests using hand-built local fixtures (no network, no Supabase env vars required — `vitest.config.ts` explicitly excludes `tests/integration/**`). `npm run test:db` (`vitest.integration.config.ts`) runs real integration tests against the live seeded Supabase project: `public-data-reads.test.ts` exercises `repository.ts`/`dashboard.ts`/`browse.ts` through the anon client exactly as the app does; `rls.test.ts` exercises RLS and the RPC's access control directly against tables using the anon client (published-only reads, draft/source_documents/signal_evidence exclusion, the exactly-one-primary-sector guarantee, anon mutation denial, anon RPC-call denial); `seeded-counts.test.ts` is the one file that intentionally uses a service-role client (bypassing RLS is required to see draft rows at all) to verify full post-seed counts across all 7 tables. `tests/integration/setup.ts` fails fast with a clear message if required env vars are missing, without ever printing their values.

**Consequence:** `npm run test:e2e` (Playwright) is operationally no longer hermetic after Milestone 3 even though its own assertions are unchanged (D-033) — it now requires a reachable, seeded Supabase project, since the app it drives reads from that database.

### D-050 — Batched Supabase reads to eliminate N+1 query patterns

**Choice:** The Milestone 3 data-layer rewrite (D-048) preserved function-level `async` shapes but, in several places, translated an old in-memory per-item loop directly into a per-item network round trip: `getCompanyViews()` and `getSignalViews()` (`browse.ts`) called a per-company/per-signal repository function inside `.map()`; `getSectorOverview()` and `getRecentlyEmerging()` (`dashboard.ts`) did the same per sector/signal; the company detail page fetched each signal's sources one at a time. Measured directly against the live seeded project, this made `/sectors/healthcare` take ~9.7s and `/signals` ~9.0s to render, and caused 5 of 8 Playwright smoke tests to fail on timeout. Fixed by having each function fetch every needed table **at most once**, then join in memory: `getCompanyViews()`/`getSignalViews()`/`getRecentlyEmerging()` now fetch `companies`, `getPublishedSignals()`, and `getSectors()` once each and build `Map`-based lookups (by `company_id`/`sector.slug`) instead of looping awaits; `getSectorOverview()` counts companies per sector from one `getCompanies()` call instead of one `getCompaniesBySector()` call per sector; source-document lookups across many signals now go through a new batched `getSourceDocumentsByIds(ids)` (a single `.in("id", ids)` query) instead of the removed per-signal `getSourceDocumentsForSignal()`. `getSectorDetailView()` was also simplified to filter its own already-fetched `getCompanyViews()` result instead of issuing a redundant separate `getCompaniesBySector()` call. The now-fully-unused `getCompanySector()` and `getPublishedSignalsForCompany()` were deleted rather than left as dead code.

**Consequence:** Every public data-layer function issues a small, fixed number of Supabase round trips regardless of how many companies/signals/sources it joins, instead of scaling with the size of the dataset. All public-safe gating (published-only companies, published-signal-only derived data, draft-id-behaves-as-unknown, draft-linked source_documents/signal_evidence never surfaced) is preserved exactly — the join logic changed, not what is fetched or how RLS gates it. Still uses only the anon/publishable client; no RLS, migration, or seed changes were needed.

### D-051 — Playwright runs serially, with modestly raised timeouts, against the live Supabase-backed e2e app

**Choice:** After Milestone 3, `e2e/smoke.spec.ts` drives routes that perform live Supabase reads rather than in-memory JSON lookups, so `npm run test:e2e` is no longer hermetic (D-033/D-049). The N+1 query pattern that made per-route latency severe (~9–10s) was fixed first (D-050), bringing single-request render times down to a measured 0.7–4.6s range. With Playwright's default parallelism, that remaining range still occasionally exceeded a modestly-raised `expect` timeout (15000ms) — one run saw a raw `page.goto` exceed even a 15000ms navigation timeout — while an immediate rerun passed fully, confirming this was intermittent dev-infrastructure latency (several workers concurrently hitting the one hosted dev Supabase project), not a deterministic bug. `playwright.config.ts` now sets `fullyParallel: false` and `workers: 1`, so this suite never sends concurrent Supabase-backed requests to the single dev project it depends on, removing that concurrency variable entirely; `use.navigationTimeout` is raised to 30000ms (the one observed failure was a `page.goto` timeout) and `expect.timeout` stays at 15000ms. These are conservative, targeted settings for this project's real remote-dependency constraint, not oversized/unconditional timeouts. No test assertion was weakened, removed, or skipped; no app/RLS/schema/migration code changed.

**Consequence:** The existing draft-404, demo-banner, route-chain, evidence/verification-badge, and source-link-safety assertions are all unchanged and still enforced — only how long Playwright waits for them to become true increased. If e2e flakiness returns above this margin, that's a signal to look at network conditions or query performance again, not to raise the timeout further by default.

### D-052 — Reviewer identity via a new `reviewer_profiles` table

**Choice:** A new `reviewer_profiles` table (`id` → `auth.users(id)`, `is_active` flag), not a custom JWT claim/Auth Hook.

**Consequence:** Matches the existing preference for plain, migration-tracked SQL authorization logic over out-of-band, dashboard-configured mechanisms — inspectable via `git diff`, testable with ordinary `test:db` fixtures.

### D-053 — `research_items.payload` is a pointer, not staged data

**Choice:** `research_items.payload` is a pointer to an already-existing draft row (`{target_table, target_id}`), not staged not-yet-inserted data — the draft row is created first (by extraction/seed), then queued for review; approval transitions the existing row's status rather than inserting a new one.

**Consequence:** The `target_table` field is general (not constrained to `'signals'` at the schema level), but Milestone 4 only ever produces or acts on `target_table = 'signals'` rows — see D-058.

### D-054 — One unified `submit_review_action` RPC for all 6 actions

**Choice:** One unified `submit_review_action` RPC handles all 6 actions (`approve`, `edit_approve`, `reject`, `request_evidence`, `mark_disputed`, `reopen`), rather than 6 separate RPCs.

**Consequence:** Mirrors `reseed_demo_data`'s established "one domain operation, one revoked-then-narrowly-granted function" pattern; all 6 actions share the same validate → snapshot → mutate → audit shape.

### D-055 — `submit_review_action` granted to `authenticated`, reviewer gate first

**Choice:** `submit_review_action` is granted to `authenticated` (not `service_role`, unlike `reseed_demo_data`) because it needs `auth.uid()` to resolve the calling reviewer's own session; the reviewer-only gate is enforced inside the function body via the `reviewer_profiles` check, not via the GRANT alone. This gate is the function's literal first statement, before any `research_items` lookup, `item_type` check, status check, or target-row access of any kind.

**Consequence:** A non-reviewer or inactive-reviewer caller gets the identical `'not an active reviewer'` exception no matter what `p_research_item_id`/`p_action` they pass, so differing error behavior can never leak information about which ids exist, their `item_type`, or their current status to a caller who hasn't already proven they're an active reviewer.

### D-056 — No RLS UPDATE grant to `authenticated`/`anon` on publication columns

**Choice:** No RLS UPDATE policy is ever granted to `authenticated`/`anon` on `signals.publication_status`/`companies.publication_status`.

**Consequence:** The only path to `published` is `submit_review_action`'s internal update, structurally preventing an AI/import-created draft from self-publishing (`docs/DATA_MODEL.md` invariant #6).

### D-057 — `mark_disputed` auto-unpublishes an already-published signal

**Choice:** `mark_disputed` on an already-published signal moves `publication_status` back to `in_review` and `verification_status` to `disputed` (auto-unpublish), not just a badge change — confirmed with the user as the safer default given evidence-integrity priority. `mark_disputed`'s valid-current-status set includes `approved` (in addition to `pending`/`needs_more_evidence`), so the *same* research item that was previously approved for a published signal is reused for the dispute — no new or reopened item is required first.

**Consequence:** A published signal's queue history is a single row moving `pending → approved → disputed`, and the very next anon read after a dispute cannot see the signal — no cache, no delay, no separate "unpublish" step.

### D-058 — Milestone 4 scope: `item_type = 'new_signal'` only, RPC-enforced `edit_approve` allow-list

**Choice:** Milestone 4 builds full UI/RPC support for `item_type = 'new_signal'` only; `new_company`/`entity_match`/`correction` remain valid enum values with no code path yet. `submit_review_action` checks `research_items.item_type` and raises "unsupported item_type in Milestone 4" for anything but `new_signal` — but only after the D-055 reviewer gate passes, never before it. `edit_approve`'s column allow-list is likewise enforced authoritatively inside the RPC, not only in `src/lib/review/schema.ts`'s Zod schema: `submit_review_action` hardcodes exactly four editable `signals` columns (`headline`, `summary`, `why_it_matters`, `evidence_strength`) via an explicit static `UPDATE` with `coalesce(p_edited_fields ->> '<col>', <col>)` per column — never a dynamic/generic JSON-to-column mechanism.

**Consequence:** No key outside that allow-list (including `id`, `company_id`, `publication_status`, `verification_status`, `is_demo`, `created_by_type`) can ever be written from reviewer-supplied input, even by a reviewer calling the RPC directly and bypassing the app entirely. The Zod schema mirrors this list purely as UI-layer defense-in-depth; no `companies`-branch UPDATE logic or edit-field allow-list exists anywhere this milestone.

### D-059 — `derive_research_items_from_seed_signals` covers all seed signals, not just drafts

**Choice:** Queue content comes from a new, isolated `derive_research_items_from_seed_signals(p_baseline_reviewer_email text)` RPC (renamed/broadened from an earlier `derive_research_items_from_drafts()`) and `supabase/seed-research-queue.ts`, rather than modifying `seed/demo-data.json` or the Milestone 3 `reseed_demo_data` migration. This RPC covers all 21 seed signals: drafts get a `pending` `research_items` row; the 14 already-published signals additionally get an `approved` `research_items` row plus one baseline `review_actions` anchor (D-069).

**Consequence:** Keeps both already-shipped M3 artifacts byte-for-byte unchanged, while closing the gap where the 14 already-published signals would otherwise have no queue/audit trail at all (violating `docs/DATA_MODEL.md` invariant #2 — a verified signal must have an approving review action).

### D-060 — A third Supabase client for reviewer sessions

**Choice:** A third Supabase client, `src/lib/supabase/session-client.ts` (`@supabase/ssr`, cookie/session-aware, publishable key + user JWT only), is added alongside the existing anon and service-role clients.

**Consequence:** Used only under reviewer routes, never imported by `repository.ts`/`dashboard.ts`/`browse.ts` — the public app's anon-only invariant stays intact.

### D-061 — `@supabase/ssr` added as a new runtime dependency

**Choice:** `@supabase/ssr` added as a new runtime dependency (anticipated by D-047).

**Consequence:** Required because `@supabase/supabase-js` alone has no cookie/session integration for Next.js Server Components — this is Supabase's own official package for exactly that.

### D-062 — Reviewer test-account provisioning is a separate script

**Choice:** Reviewer test-account provisioning (`supabase/seed-reviewer.ts`, `TEST_REVIEWER_EMAIL`/`TEST_REVIEWER_PASSWORD`) is a separate script/npm command from `supabase/seed.ts`.

**Consequence:** Supabase Auth users can't be created via plain SQL and have a different idempotency shape (create-if-missing, never delete-and-recreate) than the JSON reseed.

### D-063 — `mark_disputed` valid against an `approved` research item

**Choice:** `mark_disputed` is valid against an `approved` research item (not only `pending`/`needs_more_evidence`), specifically to support disputing an already-published signal without creating a duplicate/second research item or requiring a separate `reopen` step first.

**Consequence:** (This decision's original scope also described `reopen` as valid from `approved` — that half is superseded by D-071, which restricts `reopen` to `rejected`/`disputed` only.)

### D-064 — e2e reset mechanism preserves `review_actions` append-only semantics

**Choice:** `e2e/reviewer-workflow.spec.ts` resets its one fixture signal/research-item pair (`demo-signal-1-3`/`ri-demo-signal-1-3`) via a `test.beforeAll` hook using the existing `tests/integration/test-service-client.ts` (reused as-is, not duplicated) rather than a full `db:seed`/`db:seed:queue` re-run before each pass — two targeted `UPDATE` statements resetting only `signals`/`research_items` status columns, never touching `seed/demo-data.json` and never `DELETE`-ing from `review_actions`.

**Consequence:** Runs only in the Playwright test-runner's Node process (never in the deployed app); append-only holds even in test setup, the same property production code relies on.

### D-065 — `reviewer_profiles` gets its own explicit, load-bearing RLS

**Choice:** `reviewer_profiles` gets its own explicit RLS: no `anon` SELECT policy at all, and `authenticated` gets exactly one SELECT policy scoped to `id = auth.uid() and is_active` (no INSERT/UPDATE/DELETE for `authenticated`).

**Consequence:** This isn't optional hardening — every other reviewer-role RLS policy embeds an `exists (select 1 from reviewer_profiles where id = auth.uid() and is_active)` subquery, and RLS subqueries run under the *calling* role's own privileges, not the outer policy's. Without this policy, that subquery would return zero rows for every authenticated caller regardless of whether a matching row exists, silently breaking every reviewer policy in the schema.

### D-066 — Five distinct fixture accounts for reviewer RLS/deactivation test coverage

**Choice:** Test coverage for `reviewer_profiles` RLS and reviewer deactivation requires five distinct fixture accounts (primary active reviewer, second active reviewer for row-isolation proof, non-reviewer authenticated user, inactive reviewer, and the demo baseline reviewer — D-069), all provisioned by one `supabase/seed-reviewer.ts` via plus-addressing off the existing `TEST_REVIEWER_EMAIL`/`TEST_REVIEWER_PASSWORD` — no new env var names.

**Consequence:** Both the new integration test file and the e2e reset hook assert `review_actions` state via before/after count deltas and "latest matching row" queries, never via absolute row counts or `DELETE`, so append-only semantics hold even inside test setup.

### D-067 — Non-reviewer/inactive test assertions don't assume anon parity

**Choice:** Non-reviewer/inactive-reviewer test assertions target the actual required security property directly (a known draft signal id returns zero rows; `submit_review_action` fails with "not an active reviewer") rather than asserting parity with `anon`'s read results.

**Consequence:** Whether an M3 policy incidentally also applies to the `authenticated` role (a `for select` policy with no `to` clause defaults to `public`, which includes `authenticated`) is an implementation detail this plan doesn't need to depend on either way.

### D-068 — No `/auth/callback` route this milestone

**Choice:** No `src/app/auth/callback/route.ts` and no `/auth/callback` entry in `middleware.ts`'s `matcher` this milestone.

**Consequence:** Email/password sign-in (`signInWithPassword`) sets the session cookie directly with no redirect-based code exchange, so there is no callback flow to gate. Would be added together (route + matcher entry) if a future milestone adds magic-link or OAuth reviewer login.

### D-069 — A dedicated "Demo Baseline Reviewer" fixture account

**Choice:** A dedicated fixture account (`<local>+baseline@<domain>`, a 5th fixture alongside the 4 from D-066) exists solely so the 14 already-published seed signals' baseline `review_actions` anchors have a real, valid `reviewer_profiles`-backed `reviewer_id` to attribute to (the column is `not null` and FK-constrained, so a placeholder/null isn't possible). `derive_research_items_from_seed_signals()` looks up this account's `auth.users.id` by email (passed as a parameter) and raises a clear error if `db:seed:reviewer` hasn't run yet.

**Consequence:** Makes the previously-informal "run reviewer seed before queue seed" ordering an actual enforced dependency, not just documentation. Each baseline `review_actions` row's `reviewer_note` states plainly that it's a seeded anchor, not a live review event. Idempotency uses a `not exists` guard (no natural unique key for `review_actions` to `on conflict` against) — re-running `db:seed:queue` inserts zero additional anchor rows once each published signal already has one.

### D-070 — Publish-time evidence requirement

**Choice:** `submit_review_action`'s `approve`/`edit_approve` branches assert the target signal has at least one `signal_evidence` row before setting `publication_status = 'published'`, raising a clear exception otherwise.

**Consequence:** Enforces `docs/DATA_MODEL.md` invariant #1 ("a published signal must have at least one linked source document") at the database level for the review-driven publish path — previously this invariant held only incidentally, because the seed data's Zod schema already requires `evidence.length >= 1`, not because the database itself required it for a reviewer-driven publish.

### D-071 — `reopen` restricted to `rejected`/`disputed`, never `approved`

**Choice:** `reopen`'s valid-current-status set is `rejected`/`disputed` only — `approved` was removed (supersedes the `reopen` half of D-063).

**Consequence:** Allowing `reopen` from `approved` would let `research_items.status` read `pending` for a signal whose `publication_status` was still `published` and fully live — a confusing queue-state/public-reality mismatch with no real benefit, since `mark_disputed` already fully covers "reconsider a decision on a published/approved item," including retracting public visibility. `mark_disputed` is therefore the sole path that can act on an `approved` item, and the sole path that ever un-publishes a signal; `reopen` only ever walks an already-`rejected`/`disputed` item back to `pending` for reconsideration from scratch, never touching a currently-live signal.

### D-072 — `npm run test:db` runs test files sequentially (`fileParallelism: false`)

**Choice:** Once `publish-gate.test.ts` began performing real mutations against shared `signals`/`research_items` rows (even carefully reset before/after each test), Vitest's default parallel-file execution raced against other integration test files' exact-count/exact-row assertions (`tests/integration/rls.test.ts`, `public-data-reads.test.ts`, `seeded-counts.test.ts`) reading those same rows mid-mutation — observed directly as `demo-signal-1-1` (hardcoded elsewhere as a stable "known always-published" fixture) intermittently failing a "signal exists and is published" assertion while `publish-gate.test.ts`'s dispute test had it transiently unpublished. `vitest.integration.config.ts` now sets `test.fileParallelism: false`.

**Consequence:** This is the exact same class of problem D-051 already fixed for Playwright (`workers: 1`) — several workers concurrently hitting the one shared live dev Supabase project. Verified stable across two consecutive full `npm run test:db` runs (57/57 both times) after the fix. `publish-gate.test.ts`'s single-test "dispute on an originally-published seed signal" describe block also gained an explicit `afterEach` restoring `demo-signal-1-1` to `published`/`verified`/`approved` — belt-and-suspenders on top of the sequencing fix, not a substitute for it.

### D-073 — `npm run test:e2e` loads `.env.local` via `node --env-file`

**Choice:** `e2e/reviewer-workflow.spec.ts`'s `test.beforeAll` hook runs inside the Playwright test-runner's own Node process (not the deployed app under test) and calls `getTestServiceClient()` directly, which needs `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` present in that process's own environment — unlike `e2e/smoke.spec.ts`'s tests, which only need the app (started via `next build`/`next start`, which load `.env.local` themselves) to have them. Plain `npx playwright test` doesn't load `.env.local` into its own process, the same gap already solved for `db:seed`/`test:db` via `node --env-file=.env.local`. `package.json`'s `test:e2e` script now invokes Playwright's CLI (`node_modules/@playwright/test/cli.js`) the same way: `node --env-file=.env.local ./node_modules/@playwright/test/cli.js test`.

**Consequence:** `npm run test:e2e` now works uniformly for both the hermetic-to-the-runner `smoke.spec.ts` and the runner-needs-Supabase-too `reviewer-workflow.spec.ts`, without any new dependency (no `dotenv` package) — matching the established pattern from D-046/`db:seed`.

### D-074 — `e2e/reviewer-workflow.spec.ts` restores its fixture in `afterAll`, not only `beforeAll`

**Choice:** The reviewer e2e spec's flow deliberately ends with `demo-signal-1-3` disputed (`publication_status = 'in_review'`), not `draft` — proving the dispute action works. `tests/integration/seeded-counts.test.ts` hardcodes "7 draft signals" as a global count, so leaving this fixture at anything but `draft` after an e2e run silently broke the very next `npm run test:db` run. `test.afterAll` now calls the same reset used in `test.beforeAll`, restoring `draft`/`pending` after the spec finishes, not only before it starts.

**Consequence:** `npm run test:e2e` and `npm run test:db` can now run in either order, any number of times, without manually repairing state in between — verified directly (`test:e2e` → `test:db` back-to-back, both green). Same root-cause class as D-072/the `publish-gate.test.ts` `afterEach` fix: a test that intentionally leaves shared live-database state changed must restore it in a symmetric cleanup hook, not only set it up beforehand.

### D-075 — Dedicated production Supabase project, separate from dev/CI/test

**Choice:** Milestone 5 creates a new, separate Supabase project for production, distinct from the project used for local dev, CI, and `test:db`/`test:e2e`. The existing project is untouched and continues serving dev/CI exactly as before. The 3 existing migrations are applied to the new project unchanged — no schema changes.

**Consequence:** Vercel Production's environment variables point at the new project; Vercel Preview stays on the existing dev/test project (Preview therefore shows dev/demo data — acceptable at this stage, since Preview exists to review in-progress code, not to represent what a real visitor to production sees). This closes the gap where "production" previously meant the same project used by CI's mutating test suite and the 5 shared-password reviewer fixture accounts.

### D-076 — Demo Baseline Reviewer: one inactive system identity for prod audit-anchor attribution

**Choice:** Production gets exactly one reviewer identity — one `auth.users` row (email `baseline@signal-commons.invalid`, the RFC-2606-reserved `.invalid` TLD guaranteeing it can never be a real, deliverable address) plus one `reviewer_profiles` row (`is_active = false`) — created by a new, idempotent `supabase/seed-baseline-reviewer.ts` script. Its password is generated locally at creation time, used once, and never logged or stored; this identity has no legitimate login path.

**Consequence:** `derive_research_items_from_seed_signals`'s baseline `review_actions` anchors can be attributed to a real `reviewer_profiles` row (satisfying the `not null` foreign key) with zero SQL/migration/RPC changes: the foreign key only requires the row to *exist*, not `is_active = true`, and the RPC itself never checks `is_active` — it only resolves the baseline email against `auth.users`. `is_active = false` is enforced exactly where it should be — `submit_review_action`'s reviewer-gate-first check and the `reviewer_profiles_self_select` RLS policy / `(reviewer)` layout re-check all correctly reject this identity, so it structurally cannot act as a reviewer or log in anywhere. The 5-account, shared-password `supabase/seed-reviewer.ts` fixture script is never run against production.

### D-077 — `BASELINE_REVIEWER_EMAIL` env var, with a dev/CI fallback

**Choice:** `supabase/seed-research-queue.ts` now resolves the baseline reviewer's email by preferring `process.env.BASELINE_REVIEWER_EMAIL` if set; otherwise it falls back to the existing plus-addressing derivation from `TEST_REVIEWER_EMAIL` (`<local>+baseline@<domain>`).

**Consequence:** Dev/CI behavior is completely unchanged by default (no env var set there, so the existing derivation still applies against the dev fixture set). Production setup (`.env.production.local`) sets `BASELINE_REVIEWER_EMAIL=baseline@signal-commons.invalid` explicitly, pointing `db:seed:queue:prod` at the D-076 identity instead.

### D-078 — `.env.production.local` + explicit `:prod`-suffixed npm scripts

**Choice:** A new, local-only, already-gitignored `.env.production.local` file holds the new prod project's credentials for one-time local setup. Four new npm scripts (`db:seed:baseline-reviewer`, `db:seed:prod`, `db:seed:baseline-reviewer:prod`, `db:seed:queue:prod`) invoke the identical existing script bodies, differing only in which `--env-file` they load. No generic `--env-file` override flag was added.

**Consequence:** `.env.local` is never touched or repurposed. There is deliberately no `db:seed:reviewer:prod` script at all, so the shared-password fixture seed cannot be run against production even by typo of an existing `:prod` command name. `SUPABASE_SERVICE_ROLE_KEY` for the new project lives only in `.env.production.local`, is used only by these local `:prod` scripts, and is never added to any Vercel environment variable.

### D-079 — Reviewer-fixture tests stay dev/CI-only, permanently; production gets a separate verification checklist

**Choice:** `tests/integration/publish-gate.test.ts`, `tests/integration/reviewer-profiles-rls.test.ts`, and `e2e/reviewer-workflow.spec.ts` are never run against the production Supabase project — not just for Milestone 5, but permanently, since they require reviewer fixture accounts that must never exist there. They continue to run only against the existing dev/CI project, proving the exact migrations/RPCs applied to production are correct without ever needing that proof repeated against production itself.

**Consequence:** `npm run test:db` cannot run at all against a fixture-free project regardless — `tests/integration/setup.ts`'s global setup requires ≥4 active `reviewer_profiles` rows to exist as a prerequisite for any test file in that suite. Production pre-cutover verification instead uses a separate, lightweight, fixture-free checklist (documented in `docs/DEPLOYMENT.md`): migrations applied; `db:seed:prod`/`db:seed:baseline-reviewer:prod`/`db:seed:queue:prod` succeed; seeded counts and baseline audit anchors verified (including idempotency, via read-only re-runs); anon/public RLS and public data reads verified via a throwaway anon-client check; confirmation that no reviewer fixture accounts exist in prod; Supabase security advisors checked via MCP where available; then the manual Vercel production smoke checklist after cutover.

### D-080 — `middleware.ts` → `proxy.ts` rename deferred out of Milestone 5

**Choice:** `src/middleware.ts` is kept unchanged this milestone, despite Next.js 16.2.10 emitting a real deprecation warning for the legacy filename (`proxy.ts` is now the expected convention). The rename is deferred to a future milestone.

**Consequence:** The originally-proposed verification — re-running `e2e/reviewer-workflow.spec.ts`'s redirect assertions after renaming — is confounded: `src/app/(reviewer)/layout.tsx` independently re-checks the session server-side and redirects unauthenticated requests to `/auth/login` on its own, so that assertion would pass identically whether the middleware/proxy layer is loaded at all. It does not isolate or prove the proxy layer specifically is active. The deprecation warning is documented as a known, non-blocking follow-up (`docs/DEPLOYMENT.md`/`docs/READINESS_REVIEW.md`); the rename should not be attempted again until a non-confounded verification method is identified — e.g., a check that observes something only the middleware/proxy layer itself does, decoupled entirely from the layout's independent redirect.

### D-081 — Manual, combined readiness review; no new accessibility-tooling dependency

**Choice:** Milestone 5's security and accessibility reviews are both manual and documented in one combined `docs/READINESS_REVIEW.md`, rather than automated tooling (e.g., `@axe-core/playwright`) or two separate files.

**Consequence:** No new dependency this milestone. Findings, fixes, and known accepted gaps (no rate limiting, no idempotency keys on mutation endpoints — carried forward from the Milestone 4 plan's risk section) are recorded in one place alongside the Supabase advisor results and production smoke-check outcomes.

### D-082 — `docs/SOURCE_CANDIDATE_ASSESSMENT.md` approved as methodology/source-selection basis for Milestone 6 planning

**Choice:** Cowork reviewed `docs/SOURCE_CANDIDATE_ASSESSMENT.md` and returned Pass. It is now approved specifically as: (1) the source-selection decision — USAspending.gov Award Search API is the approved first controlled connector source; (2) the methodology basis for Milestone 6 planning — the AI-relevance taxonomy (§8), the two-stage triage design (§9), and the award-relevance distinctions (§10). A **Stage-1-only first cut** (deterministic filtering only, no AI classification) is the preferred direction for the first implementation pass; **Stage-2 AI-assisted classification is deferred** to a later milestone, not part of this approval.

**Consequence:** This approval is deliberately narrow and does **not** cover: connector implementation, Stage-2 AI-assisted classification, production ingestion, or any real (non-demo) record entering the system. Implementation remains gated on two artifacts that don't yet exist — the "USAspending First-Connector Field-Mapping & Review Spec" (concrete Stage-1 keyword/code/agency rules, exact field mappings, a written Stage-2 prompt contract) and a hand-labeled validation set (50–100 real award descriptions classified against the §8 taxonomy) — both called for by the source document's own §12. No code, migration, or connector work is authorized by this decision alone.

## Intentionally deferred decisions

- First live connector
- Production authentication provider configuration
- Final chart library
- Whether to store source snapshots
- Exact momentum methodology
- User accounts beyond reviewers
- Public alerting channels
- Python worker requirement
- Semantic search requirement
- Monetization or organizational structure
- `middleware.ts` → `proxy.ts` migration (needs a non-confounded verification method first — see D-080)
- Rate limiting and idempotency keys on mutation endpoints (accepted gap, documented in D-070's area and `docs/READINESS_REVIEW.md`)
- Reviewer throughput / queue-size circuit breaker for ingestion runs (raised in Fable's pre-M6 review, D-085 — a real consideration, not yet a locked requirement)

### D-083 — Milestone 6 methodology artifacts landed: Field-Mapping & Review Spec and Entity-Resolution Policy (Option B locked)

**Choice:** `docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md` and `docs/ENTITY_RESOLUTION_POLICY.md` are added as **planning/methodology artifacts only — not implementation approval.** Neither document contains connector code, calls any API, creates any record, or writes a migration. Together they lock the following decisions for Milestone 6:

- **Option B — ingest-to-queue only.** Real USAspending award records may become `is_demo = false` **drafts in the reviewer queue**, but connector-sourced records **do not publish publicly in Milestone 6**. The M4 publish gate stays `new_signal`-only.
- **`company_aliases` is planned as a small additive M6 migration** (UEI/name alias storage and recipient deduplication, since `companies` has no UEI column) — reviewer/service-role access only, no public read. **No migration is written by these documents**; the actual SQL is produced in a later Code planning pass and reviewed by Cowork before it is applied.
- **Public publication of connector records is deferred**, along with **`new_company`/`entity_match`/`correction` publish-gate support** — all explicit follow-on-milestone work, not part of Milestone 6.
- **Stage-2 AI-assisted classification is deferred.** Milestone 6 is Stage-1 (deterministic filter) only; humans classify manually until a validation bar is cleared.
- **Entity-resolution policy is deliberately conservative:** UEI-exact match against `company_aliases` is the **only** automatic company-reuse path; name-only matching **never** auto-reuses or auto-creates; ambiguous or conflicting matches always produce an `entity_match` research item for human review; **the system never auto-merges** entities under any circumstance.
- **A hand-labeled validation set and explicit recall thresholds (≥ 0.90 overall, ≥ 0.80 per sector) remain a hard gate** before the Stage-1 filter rules (keywords, codes, agency weights) are trusted for any real run.

**Consequence:** Milestone 6 implementation, whenever it begins, is scoped and bounded by these two documents — any future session or reviewer should treat their locked decisions (Option B, the conservative entity-resolution rules, the deferred items above) as settled inputs, not open questions to re-litigate, while still recognizing that neither document authorizes writing connector code, calling the USAspending API, creating any record, or applying any migration on its own.

### D-084 — USAspending validation labeling protocol and synthetic sample templates landed (real data not yet pulled)

**Choice:** `docs/USASPENDING_VALIDATION_LABELING_PROTOCOL.md`, `docs/USASPENDING_VALIDATION_SET_README.md`, `docs/research/stage1_validation_set.SAMPLE.jsonl`, and `docs/research/entity_resolution_validation_set.SAMPLE.jsonl` are added as **planning/methodology artifacts only — not implementation approval.** The two `.SAMPLE.jsonl` files are explicitly **synthetic templates** (fabricated award/recipient data, each carrying its own `_meta`/`_synthetic` header) that illustrate the labeling schema and case coverage only — they **cannot be used to compute the Stage-1 recall or entity-resolution false-merge acceptance metrics.** No real USAspending validation data has been pulled: the labeling protocol's own README documents that the assistant preparing these artifacts could confirm the API is reachable via `GET` but could not execute the required `POST` award-search queries with its available tooling.

**Consequence:** The real Stage-1 AI-Relevance Validation Set (target ~150 records) and the real Entity-Resolution Validation Set (target ~75 items) still require a **separate, explicit approval** before any USAspending `POST` queries are run — this decision does not authorize that step. The acceptance gates these real sets must clear before their respective rules are trusted remain as locked in D-083/the Field-Mapping Spec and Entity-Resolution Policy:
- **Stage-1 recall ≥ 0.90 overall and ≥ 0.80 per sector.**
- **Entity-resolution false-merge rate = 0** in the labeled set before UEI-exact auto-reuse is trusted.

No connector code, migrations, API calls, database records, or Milestone 6 implementation were created by this checkpoint — only the four docs-only planning/template files listed above.

### D-085 — Fable pre-M6 senior review: four must-fix planning requirements accepted (docs-only)

**Choice:** Fable performed a read-only senior project review of the merged Milestone 6 methodology/validation artifacts and returned "Proceed with caution," identifying four must-fix-before-implementation planning items — all four are **accepted** and reflected as documentation updates only, in `docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md`, `docs/ENTITY_RESOLUTION_POLICY.md`, `docs/USASPENDING_VALIDATION_SET_README.md`, `docs/USASPENDING_VALIDATION_LABELING_PROTOCOL.md`, and `docs/DEPLOYMENT.md`:

- **R1 — Import signal approval semantics:** in Milestone 6, `approve` on a connector-imported `new_signal` means "triaged and reviewed," not "cleared for public display" — the RPC's `published`/`verified` state values are a technical side effect of reusing the unmodified M4 gate, not a public-readiness claim. **Hard requirement:** any future milestone adding `new_company` publish-gate support must re-confirm every already-"approved" M6-era import signal before its associated real company can be published; a stale M6 approval must never silently go live later (Field-Mapping Spec §5.4).
- **R2 — Demo/live distinction in the reviewer queue:** the reviewer queue UI must visually distinguish `is_demo = true` demo items from `is_demo = false` real connector items (badge and/or filter) **before** any real connector draft is allowed to enter the queue, with a corresponding test requirement that demo and real items are never rendered indistinguishably (Field-Mapping Spec §11/§13).
- **R3 — Sampling-frame bias:** a fourth validation sub-pull is added, sourced by NAICS/PSC/CFDA/agency/program codes with no description keyword filter (`sample_source = code_pull`, alongside `keyword_pull`/`ambiguous_pull`/`control_pull`), specifically to catch true positives a keyword-only sampling frame structurally cannot surface. Stage-1 recall must be reported by `sample_source` (keyword-sourced vs. code-sourced), in addition to the existing overall/per-sector gates (README §2/§3/§5, Labeling Protocol §1.2/§5.1).
- **R5 — Person-named-recipient policy:** before auto-creating a draft company for an unmatched recipient, the connector must check whether `recipient_name` appears to be a natural person; if so, it must **never** auto-create a draft company — it routes to `entity_match` (`reason='possible_individual'`) or is excluded, pending human review. This is a conservative privacy/reputational safeguard, not an entity-matching optimization (Entity-Resolution Policy §2.1/§5).

Non-blocking follow-ups also folded in as documentation updates: inert-rendering tests for untrusted award text are now required **in Milestone 6 itself** (Field-Mapping Spec §13), not deferred to Stage-2; a reviewer-UI caveat recommendation that `evidence_strength = high` means the award event is documented, not impact/success (Field-Mapping Spec §12); dual-labeling 20–30% of the real validation data with reported inter-rater agreement (Labeling Protocol/README §7); retention policy elevated to "must decide before the first real pull" (Field-Mapping Spec §16.4); leaked-password protection added as a concrete prerequisite before provisioning any real M6-era reviewer account (`docs/DEPLOYMENT.md`); reviewer throughput/queue-size circuit breaker logged as a real but not-yet-locked consideration (Field-Mapping Spec §14, and the deferred-decisions list below).

**Consequence:** This is **docs-only planning work.** No implementation is authorized by this decision. No USAspending `POST` queries are authorized. No real validation data exists yet. No connector code, migrations, records, or database changes were made — only the six documentation files listed above were edited. R1, R2, R3, and R5 are now locked, must-fix-before-M6-implementation planning requirements; any future Code implementation plan for Milestone 6 must reflect all four before Cowork review, not treat them as optional.

### D-086 — USAspending query-body correction: `award_type_codes` must not mix contract and assistance groups

**Choice:** A bounded, read-only diagnostic pass (6 total live requests: 1 access-check GET, 1 failing full-pull attempt, 4 isolation diagnostics — zero validation records collected, zero data written to any RAW/CANDIDATES file) found the root cause of the first attempted real collection pull's HTTP 422 failure. Isolation testing confirmed: contract-only `award_type_codes` (`["A","B","C","D"]`) returned HTTP 200; assistance-only `award_type_codes` (`["02","03","04","05"]`) returned HTTP 200; the original mixed array (`["A","B","C","D","02","03","04","05"]`) returned HTTP 422, with USAspending's response explicitly stating: `"'award_type_codes' must only contain types from one group."` `docs/USASPENDING_VALIDATION_SET_README.md` §3.1 and §3.5 are corrected to run **separate contract and assistance/grant requests per sub-pull**, combining results and deduping by `generated_internal_id`; §3.2, §3.3, and §2 gained a pointer note to the same rule so it isn't rediscovered independently.

**Consequence:** This is a mechanical correction to how the real pull must be executed — it changes no acceptance gate, no taxonomy, no entity-resolution rule, no D-085 requirement (R1/R2/R3/R5), and no publication policy. No real validation records were collected during this diagnostic work; the interrupted RAW/CANDIDATES files from the original attempt remained header/meta-only throughout and required no rework. The full collection-only pull remains separately gated on its own explicit execution approval and was not resumed by this docs update.

### D-087 — Validation sampling-window clarification: sampling frame defined by USAspending's Award Search `time_period` result set, not a confirmed action-date field

**Choice:** The first corrected (D-086-aware) collection attempt halted because a returned record had `Start Date = 2020-04-23`, outside the approved Q1 2025 window. Follow-up diagnostics (three minimal, separately-approved requests, logged outside the repo) reproduced the exact record and tested whether `Action Date`, `Date Signed`, or `Last Modified Date` would explain why it matched a `time_period: 2025-01-01..2025-03-31` filter. None did: `Start Date` was outside Q1 2025; `Action Date` was `null`; `Date Signed` was `null`; `Last Modified Date` (`2026-03-16`) was also outside Q1 2025 and appears to be a system record-update timestamp, not a transaction date. **No returned point-in-time field has been confirmed as the authoritative window-compliance field.** The validation sampling frame is therefore defined **operationally**: it is the set of records USAspending Award Search's `time_period` filter returns for `2025-01-01`–`2025-03-31`, using USAspending's own filter semantics as the source of truth — not a project-side reinterpretation tied to any single date field. `Start Date` is retained on every record as descriptive context but is **not** the compliance field, and records must not be rejected solely because `Start Date` falls outside the window. This uncertainty is documented as a named source limitation of the Award Search endpoint (README §6), not smoothed over.

**Consequence:** No acceptance gate, `sample_source` rule, D-086 split-query rule, entity-resolution policy, D-085 requirement (R1/R2/R3/R5), or publication policy changes. No real validation records were collected before this clarification — only diagnostic requests were made, all logged outside the repository. The full collection-only pull remains separately gated on its own explicit execution approval and was not resumed by this docs update.

### D-088 — Cowork final pre-labeling methodology review: PROCEED; blind-labeling files, sector-coverage gap, and normalizer bug all resolved

**Choice:** Cowork performed a final, read-only pre-labeling methodology review of the completed collection/downsampling artifacts and returned **PROCEED** (following an earlier "PROCEED WITH CAUTION" review that identified four items, all now resolved). Specifically: (1) **Blind-labeling files created** — `stage1_validation_set.BLIND.jsonl` (150 rows) and `entity_resolution_validation_set.BLIND.jsonl` (75 rows) strip `sample_source`, `query_label`, `sector_provisional` (Stage-1) and `candidate_reason`, `normalized_name`/`normalized_name_a`/`normalized_name_b` (entity-resolution) — all priming fields that could bias a labeler's judgment — while every BLIND row traces back to its source `CANDIDATES.jsonl` row by stable ID (`generated_internal_id` for Stage-1; `award_id_a`(+`award_id_b`) for entity-resolution), so hidden provenance can be rejoined only **after** labeling for scoring. (2) **`politics-civic-technology` coverage gap closed** — a bounded, 6-request `supplemental_pull` (EAC/FEC, Library of Congress, "election security" description query) added 105 real records to the Stage-1 pool, 103 of them sector-taggable as `politics-civic-technology`; Stage-1 `CANDIDATES.jsonl` was regenerated (150 records, unchanged seed `20250713`) and now has **all seven sectors represented**, with `politics-civic-technology` at 18 records. (3) **Normalizer bug fixed** — `normalize_name()`'s legal-suffix stripping previously ran as an unanchored substring search (`"Columbia"` → `"lumbia"`); fixed to strip a legal suffix only when it is the exact trailing whitespace-delimited token, verified against 8 offline cases plus real production data (`"Columbia University"`, `"Columbia Power Technologies"`, `"District of Columbia"` all now normalize correctly); both entity-resolution `POOL.jsonl` and `CANDIDATES.jsonl` were regenerated from the corrected logic using the same Stage-1 POOL and zero new API calls.

**Consequence:** No acceptance gate, taxonomy, entity-resolution rule, D-085 requirement (R1/R2/R3/R5), or publication policy changes. **No labels or metrics have been created** — `CANDIDATES.jsonl` and `BLIND.jsonl` remain fully unlabeled; no `LABELED.jsonl` or `METRICS.md` file exists anywhere. `possible_individual` (0 records) and `parent_subsidiary` (0 records) remain **documented, not fabricated** gaps in the entity-resolution set — both are collection-tooling limitations (the R5 heuristic was never wired into candidate-reason tagging; the 5 collected recipient-detail GET responses were never parsed into a confirmed parent/subsidiary relationship), not evidence of real-world absence. **Any future milestone that has connector logic depend on R5's person-safeguard or on parent/subsidiary non-merge behavior must first resolve these two gaps** — they are out of scope for the current UEI-exact false-merge gate, which Cowork confirmed is measurable as-is. `stage1_validation_set.RAW/POOL/CANDIDATES/BLIND.jsonl` and `entity_resolution_validation_set.RAW/POOL/CANDIDATES/BLIND.jsonl` all contain **real USAspending data** and remain **local/untracked, uncommitted** pending a separate future commit decision. **The next approved phase is blind labeling of the BLIND files** — not connector implementation, not Milestone 6 code, not any further live collection under the now-exhausted 50-request budget.
