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

### D-089 — Cowork/Fable M6–M9 roadmap review: PASS WITH NOTES; M6 is the next build milestone, M7/M8/M9 remain planning-only

**Choice:** Cowork/Fable reviewed the full M6–M9 platform roadmap (`docs/ROADMAP_M6_M9.md`) — USAspending connector, LLM Reviewer Copilot, agent-style workflow, and final demo polish — and returned **PASS WITH NOTES**. **M6 (USAspending connector, ingest-to-queue only) is now the next build milestone.** M7, M8, and M9 remain **planning-only** until M6 is complete and separately approved for implementation; nothing in this decision authorizes writing code, migrations, or API calls for any of the four milestones.

The platform's end goal, restated here for continuity: a working Signal Commons system with (1) a public, demo-safe dashboard; (2) a private reviewer queue; (3) real USAspending connector candidates entering that queue as private drafts; (4) an authenticated LLM Reviewer Copilot inside the reviewer workflow; and (5) a supervised, human-gated agent-style workflow/digest layered over the connector and Copilot. This is a restatement of already-locked scope, not a new decision — see D-082/D-083/D-085 for the connector's own locked design.

Boundaries reaffirmed as still binding across all four milestones:
- **M6 remains ingest-to-private-queue only** (Option B, D-083) — no connector-sourced record is publicly published in M6.
- **No auto-approval, anywhere in M6/M7/M8.** No milestone introduces a code path that approves, publishes, or edits a `research_items`/`review_actions` row without an explicit human reviewer action through the existing `submit_review_action` RPC.
- **No automatic public publication**, in the connector, the Copilot, or the agent workflow.
- **No automatic entity merge beyond strict UEI-exact reuse** (Entity-Resolution Policy §5) — name-similar, no-UEI, and duplicate-UEI cases always route to a human-reviewed `entity_match` item; this never changes as M7/M8 are added.
- **Stage-1 is candidate-surfacing only; recall is unvalidated and no recall gate has passed.** The ≥0.90 overall / ≥0.80 per-sector recall gate from D-083 has not been evaluated against real data. `code_pull`/`supplemental_pull` produced **zero** AI-relevant true positives in this session's validation window (`docs/research/usaspending_validation.METRICS.md` §4) — this means the code/agency-corroborator branch is **unproven for recall, not disqualified**, and it must not be treated as validated for live-queue use on the strength of this one window alone.
- **`possible_individual` and `parent_subsidiary` remain known validation gaps** (zero real examples in the labeled entity-resolution set, per D-088) — R5's person-safeguard and parent/subsidiary non-merge behavior ship as "safeguard active, accuracy unproven," not as validated protections.
- **M7 will be an authenticated advisory Reviewer Copilot, not a public chatbot** — reviewer-authenticated only, advisory-only output, structurally unable to call `submit_review_action` or write to `research_items`/`review_actions`, and logged via a reviewer-session-gated path (SECURITY DEFINER RPC recommended) rather than the Supabase service-role client, since the service-role key must not be required in the Vercel reviewer-app runtime.
- **M8 will be a supervised agent-style workflow, not autonomous publication** — every write-capable tool is audit-logged, no tool in the tool set can reach `submit_review_action` or any `publication_status` column, and every run terminates at "items enqueued + digest produced," identical to a manual M6 commit run's end state.

**Consequence:** This is **docs-only planning work.** No code, migration, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. `docs/ROADMAP_M6_M9.md` (new) is the canonical roadmap reference for M6–M9 going forward; its M6A section is the concrete next-implementation-step plan, itself still requiring separate approval before any code is written. Future Code implementation work should treat this decision's reaffirmed boundaries as settled inputs, not open questions to re-litigate.

### D-090 — M6A schema/RLS/safety-invariant plan approved with `submit_review_action` follow-up

**Choice:** Cowork/Fable reviewed the detailed M6A implementation plan (schema, RLS, and Option-B safety invariant only — no connector fetcher, no reviewer UI change, no LLM Copilot, no agent workflow) and returned **PASS WITH NOTES**. **M6A may proceed after this decision is recorded.** M6A adds exactly four things: `company_aliases`, `ingestion_runs`, `research_items.is_demo boolean not null default true`, and a DB-level Option-B safety invariant. Nothing beyond schema/RLS/tests is authorized by M6A — no USAspending fetcher, connector dry-run/commit script, reviewer UI change, LLM Copilot, agent workflow, or production change is authorized by this decision.

**Trigger decision:** the Option-B DB safety invariant is added in M6A as a `before insert or update` trigger on `public.signals` (a `CHECK` constraint cannot reference `companies`, so a trigger is required — the first one in this codebase's migrations). It blocks a signal from being inserted or updated to `publication_status = 'published'` unless its referenced company already has `publication_status = 'published'`. This is deliberately **stronger defense-in-depth than relying on the public query join alone**, which is the only protection that exists today.

**`submit_review_action` follow-up (the load-bearing part of this decision):** the trigger intentionally surfaces a latent mismatch in the current M4 approve/`edit_approve` semantics. Today, `submit_review_action`'s `approve`/`edit_approve` branches set `signals.publication_status = 'published'` **unconditionally**, with no check on the related company's status — this is too blunt once a real, connector-sourced `new_signal` tied to a permanently-draft company (M6 has no company-publish mechanism) enters the queue: the same RPC call that has always silently succeeded (hidden only by the public join) would now raise an exception under the new trigger. **Before M6B/M6D ship connector reviewer actions, `submit_review_action` must be reconciled** so that approving a connector-sourced `new_signal` records human triage/review without attempting to make the signal public. Preferred direction, to be designed and reviewed on its own in a later plan, not decided in full here:
- Connector-sourced `approve`/`edit_approve` should not set `publication_status = 'published'` while the company remains a draft.
- It should still preserve full audit history in `review_actions`.
- It should leave the item in a non-public state — e.g. `in_review`, or another explicitly non-public reviewed status — rather than erroring out on the reviewer.
- The exact mechanism (a new RPC branch, a new status value, a company-status pre-check with a distinct outcome, etc.) requires its own dedicated plan and review before implementation — this decision only locks the *requirement*, not the *mechanism*.
- M6D should additionally hide or disable `approve`/`edit_approve` in the reviewer UI for connector-sourced `new_signal` items whose company is still a draft, or otherwise show clear reviewer messaging about what "approve" will and won't do. **The UI guard is complementary only — the DB/RPC boundary remains the real safety control**, consistent with this project's existing "the gate is server-side, not UI-only" principle (D-055).

**Carry-forward tests:**
- M6A keeps its three trigger tests: cannot insert a signal directly as `published` when its company is a draft; cannot update a signal to `published` when its company is a draft; can publish a signal once its company is `published`.
- M6B/M6C must additionally add public-invisibility tests specific to connector draft records: an `is_demo = false` draft connector signal/company never appears on any public route; approved/triaged connector records remain private until a future, explicit company-publication workflow exists (which does not exist in M6 at all).

**Process gate:** Cowork/Fable should review the actual M6A migration and tests before the migration is applied to shared dev/CI — this is a behavior-changing trigger interacting with already-shipped M4 code, not a routine additive schema change, so review-before-apply is preferred over review-before-commit alone. No production Supabase changes are authorized by this decision.

**Consequence:** This is **docs-only planning work.** No code, migration, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. The M6A plan may proceed to implementation (its own separate approval step for writing the actual migration/tests), but `submit_review_action`'s reconciliation is explicitly **not** part of M6A's scope — it is a locked requirement for a **later**, separately-planned step that must land before M6B/M6D expose connector reviewer actions in the UI.

### D-091 — M6B diagnostic live smoke: NAICS/PSC map to null on live contract records (known limitation, non-blocking for dry-run commit)

**Choice:** A diagnostic keyword-biased live smoke test (`--diagnostic-keyword="artificial intelligence"`, `--max-requests=2`, dry-run only, zero DB writes) produced 154 real candidates and confirmed field mapping end-to-end on live data: `generated_internal_id`, `Description`, `Base Obligation Date`, `Last Modified Date`, `Contract Award Type` (contracts), `Award Type` (grants), and `CFDA Number` (grants) were all present as expected, and the `requestKind`-fallback bucket logic (added after Cowork/Fable's earlier review) was directly exercised and confirmed correct — `awardTypeCode` was null on all 154/154 candidates (spending_by_award does not return a distinct numeric award-type-code field via the current `fields` array, as expected), yet every grants candidate was still correctly bucketed as `validated02to05` via the `requestKind` fallback, not misfiled as `unknown`.

One gap surfaced: **NAICS and PSC mapped to null on all 54/54 live contract candidates.** USAspending accepted `"NAICS"`/`"PSC"` as request-side `fields` entries without error (no 422) on both the earlier cap=4 run and this diagnostic run, so this is a **response-side mapping/value-shape reconciliation issue** — either the response uses a different key/shape than requested, or contract records in this sample simply didn't carry the value — not a request-validity problem.

**Consequence:** This does **not** block committing M6B's dry-run connector. NAICS/PSC do not feed the `source_documents`/`signals`/`signal_evidence`/`research_items.payload` preview output at all (per the locked Field-Mapping Spec) and are already handled safely as `null` — no fabricated value, no crash, no silent corruption. **It must be reconciled before any larger operational dry-run and before relying on Stage-1's §4.2 code-corroborator branch** (NAICS/PSC-based), since that branch's live behavior is unverifiable while the underlying fields map to null. Carried forward, unchanged by this finding: loan codes 07/08 remain excluded and unimplemented for M6B (search.ts's `UNTESTED_LOAN_AWARD_TYPE_CODES`); `awardTypeCode` being null from `spending_by_award` is expected, and the `requestKind`-fallback bucketing logic that compensates for it is now confirmed correct on live data and should carry forward unchanged into M6C's `--commit` mode.

### D-092 — M6C commit_usaspending_candidate migration/RPC design, applied to dev/CI; commit-code scaffolding added but not run

**Choice:** The M6C `commit_usaspending_candidate` SECURITY DEFINER RPC (one atomic function, `set search_path = public`, schema-qualified references, `revoke execute from public, anon, authenticated` / `grant execute to service_role` only) was Cowork/Fable-reviewed across two drafting passes and applied to the dev/CI Supabase project only (`isdtiwdfeirgjoaokikg`; production `cxotknsqqswxxtbquyou` was never touched). The RPC commits **`new_signal` research_items only** — no other `item_type` is ever written by this pipeline. `entity_match` research-item creation, and any row creation at all for `AMBIGUOUS` / `CONFLICT` / `possible_individual` candidates or UEI matches that resolve only to a demo (`is_demo=true`) company, is explicitly **out of scope for M6C**: these are skipped and logged by reason (non-sensitive counts only, e.g. `ambiguous_name_collision`, `possible_individual`, `skipped_demo_company_collision`), never inserted as any kind of queue row, because `submit_review_action` (M4) hard-rejects any `item_type != 'new_signal'` — an `entity_match` row would be visible but completely un-actionable in the reviewer queue. This remains deferred until R2 (reviewer UI support) and a separate `submit_review_action` reconciliation both ship.

Connector UEI-exact automatic reuse is scoped to **non-demo companies only** — the RPC independently re-checks `is_demo` at write time (never trusting the Node-side `previewEntityDecision()` pass); a UEI that resolves only to a demo company is skipped, never reused, never duplicated into a second real company (would violate `company_aliases_uei_unique`).

`source_documents.source_tier` is persisted as **text**, using `"1"` as this project's first real-record `source_tier` vocabulary value (seed data uses the unrelated placeholder `"demo"`; the locked Field-Mapping Spec documents `1` as the connector's tier). `SourceDocumentPreview.source_tier` (`src/lib/connectors/usaspending/types.ts`) is corrected from `number` to `string` accordingly, and `buildCandidatePreview` (`field-mapping.ts`) now emits `"1"` as text.

`--commit` requires three independent **technical** guards, not a policy note, all checked before any USAspending fetch or DB write: (1) the explicit `--confirm-reviewer-control` flag; (2) a reviewer-control preflight query requiring exactly one active `reviewer_profiles` row; (3) a dev/CI Supabase project allow-list assertion (`isdtiwdfeirgjoaokikg` only) derived from `NEXT_PUBLIC_SUPABASE_URL` — an allow-list, not a production deny-list, so it fails safe against any unrecognized project including production. `--commit` combined with `--diagnostic-keyword` remains hard-rejected — a keyword-biased sample must never influence a real commit.

Commit-code scaffolding was added in this same decision window (`commit-serializer.ts`, `commit.ts`, `cli-guards.ts`, the `--commit` branch in `supabase/connector-usaspending.ts`, the `connector:usaspending:commit` package script, and hermetic tests) but **was not executed** — no live API call, no RPC call, no database write, no `test:db` run. NAICS/PSC (D-091) remain a known limitation, unaffected by and not relied upon by this scaffolding.

**Consequence:** The `commit_usaspending_candidate` function now exists on dev/CI (inert — never yet called by any code path). No production Supabase change occurred. Remaining before any live `--commit` smoke test: the reviewer-account-deactivation operational precondition, `test:db` integration tests against dev/CI, and a further Cowork/Fable review of the commit code/serializer/CLI guards/tests — all separately gated, none authorized by this decision.

### D-093 — M6C live `--commit` smoke against dev/CI: PASS WITH NOTES; M6C cleared to commit

**Choice:** After `test:db` integration tests passed against dev/CI (reviewer-control precondition re-verified via direct SQL beforehand — exactly one active `reviewer_profiles` row, never the reviewer UI), Cowork/Fable approved exactly one controlled live `--commit` smoke test. It was run once, with no diagnostic keyword and no cap increases:

```
npm run connector:usaspending:commit -- --confirm-reviewer-control --max-requests=4 --max-candidates=10
```

Result: `ingestion_run_id=ingest-usaspending-1784160801623`, `status=succeeded`, `records_discovered=0`, `records_created=0`, `records_skipped=0`, `error_summary=null`, `metadata.skippedByReason={}` (no `rpc_call_failed`, `rpc_skipped_invalid_payload`, `serialization_failed`, or `missing_entity_decision` — no defect reasons appeared at all), `finished_at` set. Teardown (a scoped delete of that one `ingestion_runs` row, by `ingestion_run_id` only) completed successfully; direct SQL confirmed zero rows remained anywhere afterward.

**What the smoke validated:** the `--confirm-reviewer-control`/dev-CI-project-assertion/reviewer-count preflight guards all fired correctly before any fetch or write; a real live USAspending fetch executed (up to 4 requests across the four award-type-group kinds); the `ingestion_runs` running-row insert and completion-row update both executed correctly against dev/CI; teardown was clean; production (`cxotknsqqswxxtbquyou`) was never touched; `connector-runs/` was unaffected (commit mode writes no local files); and no reviewer UI action of any kind (approve/edit_approve/reject/request_evidence/mark_disputed/reopen) was used at any point.

**Honest residual:** because this normal-window run produced zero Stage-1-eligible candidates, the live CLI → RPC row-commit path never actually invoked `commit_usaspending_candidate` from the CLI in this smoke — the RPC itself, the serializer, and `commitCandidateBatch` were already validated directly against dev/CI by `test:db`'s 29 M6C integration tests (happy path, idempotency, non-demo reuse, demo isolation, invalid payload, actionability, public invisibility, trigger invariant, RLS), so this is not an untested code path, but it is not yet proven **through the live CLI specifically**. The first future operational run that actually commits a real candidate should receive a lightweight, targeted SQL inspection of that candidate's 5-row set and the run's `ingestion_runs` counts before being treated as fully validated end-to-end.

**`records_discovered` semantics clarified:** in M6C commit summaries, `ingestion_runs.records_discovered` refers to the count of Stage-1-surfaced candidates considered for commit (`candidates.length` in `commitCandidateBatch`'s input), **not** the raw count of USAspending awards fetched/scanned before Stage-1 filtering (that raw count is a separate, larger number the CLI does not currently persist anywhere for commit-mode runs — dry-run mode's `computeFieldPresenceStats` computes an analogous pre-Stage-1 count, but commit mode does not carry that stat into `ingestion_runs.metadata` today). If future auditability needs require the raw fetched/scanned count for commit runs, add it to `ingestion_runs.metadata` in a later refinement — not decided here.

**Reviewer-control state:** after the smoke's teardown, zero connector rows of any kind remained in dev/CI. The single-active-reviewer operational control (only the owner-controlled Primary account active; "Second" and "Baseline" reviewer fixtures deactivated) **remains in place** — this decision does not reactivate them. Any future reactivation of those fixture accounts is a separate, explicit decision/action, not implied by this one. The standing restriction is unchanged: no reviewer UI action (approve/edit_approve/reject/request_evidence/mark_disputed/reopen) may be taken on any connector-created row until R2 (reviewer UI support) and D-090's `submit_review_action` reconciliation both ship, separately.

**Carried forward, unchanged:** no production commit path exists or is authorized; `--commit` + `--diagnostic-keyword` remains hard-rejected; no public publication path exists in M6; no auto-approval anywhere; no `entity_match` research_items are ever inserted by the M6C path; connector UEI-exact reuse remains scoped to non-demo companies only; NAICS/PSC (D-091) remains a known, carried-forward limitation.

**Consequence:** M6C is cleared to commit. No further live smoke test is required before committing this milestone's code. The residual noted above (live-CLI commit-path proof deferred to the first real operational run) is documented, not blocking.

### D-094 — M6D reviewer workflow reconciliation for connector-created records: PASS WITH NOTES; plan approved

**Choice:** Cowork/Fable reviewed the M6D plan (reconciling the reviewer workflow for real, connector-created `research_items` before M7) and returned **PASS WITH NOTES**, with all required refinements folded into the approved plan. M6D's purpose: M6C can now write real, `is_demo=false` connector rows into the private reviewer queue, but the reviewer workflow was never reconciled for them (D-090, R2) — M7 (the authenticated LLM Reviewer Copilot) must not be built on top of a reviewer workflow that still mislabels or mishandles those rows.

**R2 — demo/real distinction:** the reviewer queue currently cannot tell demo records from real connector-created ones at all. Worse, `src/lib/review/queue.ts`'s row mapper currently **hardcodes `is_demo: true`** on every signal it returns, regardless of the row's real value (inherited from reusing `data/schema.ts`'s seed-only zod types, which type `is_demo` as the literal `true`) — this is a live bug, not a hypothetical gap, and M6D fixes it. The reviewer UI will show demo-vs-real badges and a USAspending-connector/real-record indicator, and the item detail page will show **both** the linked company's status and the signal's own `publication_status`/`verification_status` — not company status alone — so an "approved but private" record stays legible after a page reload, not just in a one-time message.

**D-090 reconciliation — mechanism:** `submit_review_action` is modified **in place**, not replaced by a connector-specific RPC — one unified reviewer-action RPC keeps `review_actions` audit semantics single-sourced (per D-054's original "one RPC for all 6 actions" rationale) rather than fragmenting them across two functions. Safety branching happens **server-side, inside the RPC**, not only in the UI — the UI is a complementary, honest reflection of what the RPC will do, never the safety boundary itself (per D-055's "the gate is server-side, not UI-only" precedent, which D-090 itself cites).

**Branching condition:** the RPC branches on the linked company's `publication_status`, never on `is_demo`, `item_type`, or any `research_items.payload` metadata. Reason: the actual safety invariant (already enforced today by the `signals_require_published_company` trigger) is "a signal can only publish if its company is already published" — keying off that same condition means the new branch is provably a no-op for every row that can exist today, and the fix is not "connector-aware" logic at all, just a correct generalization of an invariant that already exists.

**approve/edit_approve semantics:**
- If the company is **published**: unchanged — publish the signal, `verification_status='verified'` (or edited-field values), `research_items.status='approved'`.
- If the company is **draft/not published**: apply allow-listed edits (for `edit_approve` only), set `verification_status='verified'`, set `research_items.status='approved'`, append a `review_actions` row — but **never change `signals.publication_status`** (the `UPDATE` in this branch omits it entirely, not even re-setting its current value); the signal stays draft/private. The RPC returns jsonb indicating `published:false` for this branch.
- **Evidence requirement unchanged in both branches**: approve/edit_approve continue to require at least one linked `signal_evidence` row, even when the outcome will stay private — this is a quality gate on what a reviewer may endorse at all, not merely a publication precondition, and must not be skipped or scoped only to the published path.

**Deliberate, explained deviation from D-090's literal wording:** D-090 suggested `publication_status='in_review'` as the connector-approved resting state. M6D intentionally keeps `publication_status='draft'` instead, because `in_review` already carries a specific, conflicting meaning in this codebase — "a previously-published row was pulled back for reinvestigation via `mark_disputed`." Reusing it for "good, reviewer-approved, just blocked on company" would collide two opposite meanings into one enum value with nothing in the schema to disambiguate them. The approved-but-private state is instead fully represented by the combination of `research_items.status='approved'` + `signals.verification_status='verified'` + `signals.publication_status='draft'`, with the enriched audit trail (below) providing legibility.

**mark_disputed semantics:** if the signal is currently **published**, `mark_disputed` may still set `publication_status='in_review'` exactly as today (unchanged, regression-tested). If the signal was **never published** (still draft), `mark_disputed` sets `verification_status='disputed'` and appends a `review_actions` row, but leaves `publication_status='draft'` untouched — a never-published connector row must never be mislabeled as "pulled back from public view" when it was never public to begin with.

**reject/request_evidence/reopen:** unchanged unless implementation reveals a concrete issue. `reject`'s existing `publication_status='archived'` write remains acceptable for connector draft rows because `archived` is a terminal rejection state, not a public-specific one, and is not gated by the publish trigger.

**Audit enrichment (core M6D scope, not a fast-follow):** `review_actions.before_state`/`after_state` will include the signal's own state, the company's `publication_status`, and the company's `is_demo`, so that a `review_actions` row alone lets an auditor distinguish all four of: approved-and-published; approved-but-private; disputed-while-already-public; disputed-while-never-public.

**No data model changes:** no new columns, statuses, action values, or item_types — the existing vocabulary is sufficient. Exactly one migration is anticipated (a `DROP FUNCTION` + `CREATE FUNCTION` + re-`REVOKE`/`GRANT` rewrite of `submit_review_action`, since a bare `CREATE OR REPLACE FUNCTION` cannot change return type).

**Safety boundaries (unchanged, reaffirmed):** no company-publish mechanism is introduced in M6D; no public publication of connector rows; no auto-approval; no auto-publication; no service-role client anywhere in the reviewer UI; the RPC remains the real safety boundary with the UI as a complementary layer only; no production migration apply in M6D; no LLM/Copilot/agent work.

**Required test coverage for M6D implementation:** all existing `publish-gate.test.ts` cases must still pass unchanged (regression); approve/edit_approve against a draft-company connector item approves privately without publishing; the evidence requirement is still enforced on the private branch; private `edit_approve` omits `publication_status='published'` and leaves it `draft`; `mark_disputed` on an already-published signal still moves to `in_review` (regression); `mark_disputed` on a never-published connector draft keeps `publication_status='draft'`; `reject` on a connector draft item is safe (no publish, no trigger error); the `edit_approve` column allow-list is still enforced on the private branch; a full jsonb-return-contract test exists for all six actions; a lifecycle test (approve-private → mark_disputed → reopen) proves `publication_status` never becomes `published` at any step; audit enrichment is verified to contain company `publication_status`/`is_demo`; public invisibility is re-proven via the anon client after a connector approval; the `DROP`+`CREATE` migration is verified not to have lost the `authenticated` grant; the `queue.ts` mapper fix is verified to preserve a real `is_demo=false` value; and `tests/lib/no-connector-leakage.test.ts`'s scanned directories are extended to include `src/lib/review`.

**Implementation sequence:** this D-094 entry first; the `submit_review_action` migration draft second; Cowork/Fable review of that migration before it is applied to dev/CI; `queue.ts` mapper/view-model fixes; UI/action messaging changes; hermetic tests; local gates (`lint`/`typecheck`/`test`/`build`); migration applied to dev/CI only after that review; `test:db` against dev/CI; a further Cowork/Fable review of the `test:db` results before merge; Playwright/e2e coverage may be a fast-follow unless implementation shows it's needed in the first PR.

**Consequence:** This is **docs-only planning work.** No code, migration, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. The M6D plan may proceed to its next step (drafting the `submit_review_action` migration) only once that step is separately, explicitly approved — not implied by this entry.

### D-095 — M7 Reviewer Copilot: PASS WITH NOTES; plan approved

**Choice:** Cowork/Fable reviewed the M7 plan (an authenticated, advisory-only LLM Reviewer Copilot, per `docs/ROADMAP_M6_M9.md`) and returned **PASS WITH NOTES**, with twelve required refinements folded into the approved plan. M7's purpose: give a signed-in reviewer an assistive summary of a research item's evidence, risk flags, and missing-evidence questions, plus a non-binding suggested lean — never a decision. M7 is **not** a public chatbot, does not approve, reject, publish, or mutate any reviewer decision, does not bypass `submit_review_action`, and does not write to `research_items`, `signals`, `companies`, `source_documents`, `signal_evidence`, or `review_actions` under any input. The human reviewer remains the sole decision-maker; every real workflow transition still requires an explicit, separate `submit_review_action` call.

**Scope:** one new persisted `copilot_analyses` table; one new `record_copilot_analysis` SECURITY DEFINER RPC; a narrow `src/lib/copilot/` module (prompt builder, output schema, injectable model client, two narrow reads); a reviewer-only Copilot card on the research-item detail page; a prompt/output contract with schema validation; a model call reachable only through an authenticated reviewer-initiated Server Action. The module, UI card, prompt/schema, and Server Action are implementation-phase work, not authorized by this entry — this decision covers the design, not the code.

**Non-scope:** no auto-approval; no auto-publication; no agent/tool-using loop (that remains M8's scope); no mutation of `research_items`, `signals`, `companies`, `source_documents`, `signal_evidence`, or `review_actions`; no service-role client anywhere in the reviewer UI/runtime; no production `ANTHROPIC_API_KEY` provisioning during M7 planning; no production reviewer-account creation; no production writes during planning; no public route or chatbot surface; no change to the M6C connector/commit path.

**Persistence decision:** M7 persists analyses rather than keeping them ephemeral. This is a **deliberate auditability choice, not mere convenience** — it lets a reviewer's later decision be understood in the context of what advice they saw (consistent with "evidence before conclusions" and "human review before publication"), and gives M8's future digest a queryable, per-item interface to read without M7 needing to anticipate M8's design further. `copilot_analyses` rows are **advisory annotations, not reviewer decisions** — they carry no authority and cannot be substituted for a `review_actions` row. Visibility is **team-wide to all active reviewers**, matching every existing reviewer-select RLS policy in this schema (`research_items`, `review_actions`, `company_aliases`, `ingestion_runs` are all unconditional "any active reviewer sees every row" today) — a per-reviewer-scoped policy would be the one exception, not the norm. **Anchoring risk is explicitly accepted, not overlooked**: a prior "leans_reject" analysis visible to a second reviewer could bias independent judgment; this is accepted for the first slice because Copilot output is advisory-only by design and because production currently has 0 active reviewers (confirmed during the M6 production-alignment check), making simultaneous-reviewer anchoring a currently low-probability concern to revisit if that changes. This risk is not purely a cross-reviewer concern — the same reviewer re-opening an item they previously ran the Copilot against could also anchor on their own earlier "leans_*" output rather than re-evaluating fresh; the first-slice mitigations for both cases are the same two UI properties (the mandatory, model-output-independent disclaimer and the visually de-emphasized, non-button-styled suggested-next-step rendering), not a technical access restriction.

**`copilot_analyses` table design (draft, to be finalized at migration-draft time):**
```sql
create table public.copilot_analyses (
  id uuid primary key default gen_random_uuid(),
  research_item_id text not null references public.research_items (id),
  reviewer_id uuid not null references public.reviewer_profiles (id),
  model text not null,
  prompt_version text not null,
  summary text not null,
  risk_flags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(risk_flags) = 'array'),
  missing_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_evidence) = 'array'),
  suggested_next_step text not null
    check (suggested_next_step in ('leans_approve','leans_reject','suggests_evidence_review','unclear')),
  confidence text not null check (confidence in ('low','medium','high')),
  limitations text,
  created_at timestamptz not null default now()
);
```
Every column is `not null` except `limitations` (no strong reason found to require it — a model may have nothing further to caveat). `id`/`reviewer_id` types match `review_actions`'s actual column definitions (`uuid default gen_random_uuid()`, `reviewer_id references reviewer_profiles(id)`), confirmed against the M4 migration directly. `risk_flags`/`missing_evidence` must be JSON arrays, enforced at the database layer via `jsonb_typeof(...) = 'array'` — not trusted from application validation alone, consistent with this project's existing "enforce allow-lists/shapes at the DB layer" pattern (D-058). `suggested_next_step`'s vocabulary (`leans_approve | leans_reject | suggests_evidence_review | unclear`) is deliberately disjoint from **both** `submit_review_action`'s real action verbs (`approve|edit_approve|reject|request_evidence|mark_disputed|reopen`) **and** `research_items.status` values (`pending|needs_more_evidence|approved|rejected|disputed`) — an earlier draft used `needs_more_evidence` for this field and was corrected specifically because it collided with the real status value of the same name, which would have made a copilot analysis row structurally ambiguous with an actual workflow-status transition.

**`record_copilot_analysis` RPC design:** modeled directly on `submit_review_action`'s shape (D-054/D-055) — `security definer`, `set search_path = public`, the reviewer-active gate (`exists (select 1 from reviewer_profiles where id = auth.uid() and is_active)`) as the literal first statement, `revoke execute from public, anon, authenticated; grant execute to authenticated` only (no `service_role`-specific grant, since — like `submit_review_action`, unlike `commit_usaspending_candidate` — it needs `auth.uid()` to resolve to the calling reviewer). **`reviewer_id` is never accepted as a parameter** — it is set from `auth.uid()` directly inside the function's `INSERT` statement, mirroring `submit_review_action`'s own `insert into review_actions (..., reviewer_id, ...) values (..., auth.uid(), ...)` pattern exactly, so attribution can never be spoofed by a caller-supplied value. The RPC validates `item_type = 'new_signal'` (same gate `submit_review_action` uses), re-validates `suggested_next_step`/`confidence` and the array-typeof of `risk_flags`/`missing_evidence` server-side (defense in depth over the table's own CHECK constraints), inserts exactly one row into `copilot_analyses`, and returns a small non-sensitive jsonb (`{id, research_item_id, created_at}`). It never writes `review_actions`, never changes `research_items.status`, never changes `signals`/`signals.publication_status`, never changes `companies`, and never publishes anything — its only effect is one additive row in the one new table.

**Data minimization / prompt context:** the Copilot's Server Action uses a dedicated narrow read, `getCopilotPromptContext(researchItemId)`, rather than reusing the full `getResearchItemById`/`ResearchItemDetail` shape — its TypeScript return type structurally has **no field** for `review_actions` history, `reviewer_note`, `before_state`/`after_state`, full payloads, or full DB rows, so the exclusion is a type-level guarantee rather than a convention the prompt builder merely has to remember to honor. The prompt may include only: `signal.{headline, summary, why_it_matters, evidence_strength, verification_status}`; `company.{name, publication_status, is_demo}`; each `source_document.{source_title, publisher, source_type, published_at, excerpt}`; each `signal_evidence.supporting_passage}`. No raw DB dump and no `JSON.stringify(row)` on any whole table row is ever sent to the model. Displaying past analyses on the detail page is a separate concern from building the prompt: `getCopilotAnalyses(researchItemId)` is its own narrow, session-client/RLS-gated read (same `getSessionSupabaseClient()` pattern, no service-role) that only selects existing `copilot_analyses` rows for display — it does not feed the prompt builder and carries no additional data-minimization requirement of its own, since `copilot_analyses` rows are already the minimized, structured output this decision defines.

**Provider/model boundary:** the model call happens only server-side, inside a new Server Action, triggered only by an authenticated reviewer's own form submission — never automatically on page load. The provider key (`ANTHROPIC_API_KEY`, already reserved in `.env.example`) is never `NEXT_PUBLIC_`-prefixed and never present in the client bundle; no service-role key is used anywhere in this feature. The provider client **prefers a thin, injectable server-side fetch wrapper** (mirroring the connector stack's own `http-client.ts` — injectable `fetchImpl`, typed errors, no silent retries) over defaulting to the `@anthropic-ai/sdk` dependency; the SDK may be added only if, at implementation time, current official SDK usage patterns clearly justify it over a hand-rolled wrapper, with that justification documented at that time (per this project's "don't add a package without explaining why existing deps can't satisfy it" standard). Exact model name and exact structured-output call shape are **not locked by this decision** and must be verified against current official Anthropic documentation at implementation time, never assumed from memory — the model name lives in config/env, not hardcoded. The model client must be **injectable/mockable**, and no test may ever call the live Anthropic API.

**Timeout / `maxDuration`:** required, not optional. The model call must use an explicit `AbortSignal`-based timeout strictly shorter than the platform/Server-Action execution limit. The reviewer detail route segment (or relevant segment) must set an explicit `maxDuration` if required by the current Next.js/Vercel runtime — this repo has no such configuration anywhere today, so the correct mechanism must be verified against the actual Next.js/Vercel version at implementation time, not copied from assumption. A hung or slow model call must always produce a clean `?error=` redirect/notice (reusing `callSubmitReviewAction`'s existing try/redirect convention), never an opaque platform-killed timeout.

**Prompt injection and output rendering:** all evidence/source/signal text sent to the model is treated as untrusted, wrapped in an untrusted-content boundary keyed by a **per-request random nonce** (e.g. `crypto.randomUUID()`), not a fixed delimiter string — evidence text (USAspending award descriptions, scraped excerpts) is attacker-adjacent and could contain a literal copy of any fixed marker, so a fixed delimiter is a "secret" that isn't secret. The system prompt explicitly instructs the model to never follow directives found inside that boundary and to surface suspicious embedded instructions as a risk flag rather than act on them. Model output is parsed and validated against the output schema before it ever reaches `record_copilot_analysis`; malformed output is rejected outright, with no partial-trust fallback. The UI renders output strictly as plain, React-escaped text from the validated schema's named fields — no `dangerouslySetInnerHTML`, no markdown-to-HTML rendering of model output, and no rendering of any raw/extra model-supplied field. Copilot output is advisory only and is never treated by the model or the UI as determining truth or publishability.

**UI/UX decision:** the Copilot appears as a reviewer-only Card on the research-item detail page, positioned after the Evidence card and before `ReviewActionForm`, visually distinct from it (prose/summary styling, not button-row styling). The only trigger is a manual "Run Copilot analysis" button — no auto-run. The disclaimer "Advisory only. Verify sources independently. Not publication-ready. Does not replace reviewer judgment." is rendered unconditionally by the UI itself every time output is shown, independent of what the model's own text says. The suggested next step is plain advisory text only, visually de-emphasized relative to the risk-flags and missing-evidence sections, and must never be styled like a real reviewer action button or badge. The first slice includes a minimal pending/loading state — likely one small client component using `useFormStatus` — that disables the button and shows "Analyzing…" (or similar) while the call is in flight; this is the first client component in the reviewer route tree, scoped narrowly to this one control, and doubles as basic accidental-double-submit protection. Full rate limiting remains a fast-follow, not first-slice scope.

**Rate limiting / cost risk:** no full rate limiting or per-reviewer/day cap exists in the first slice. Residual risk, stated explicitly rather than left implicit: a compromised or careless active-reviewer account could generate uncapped provider costs, since the gate is only "authenticated, active reviewer," not a request-volume control. First-slice mitigations: authenticated-reviewer-only access (a small, trusted account set, not the public); production currently has 0 active reviewers; the disabled-while-pending UI (accidental, not deliberate-abuse, protection); no auto-run. Full rate limiting is a tracked, required fast-follow.

**Required test coverage for M7 implementation:** *Hermetic* — prompt-builder structure and untrusted-text boundary wrapping; nonce is per-request random (two calls produce different nonces); a nonce collision inside evidence text is neutralized; output-schema validation accepts valid output and rejects missing/wrong-type/extra-field/action-verb-spoofing cases; `suggestedNextStep`'s vocabulary is disjoint from both `reviewActionSchema`'s action verbs and `research_items.status` values (two separate set-intersection assertions); the model client is injectable/mocked and no test calls the live provider; mocked-client coverage for success, malformed response, timeout/abort, and provider-error handling; `tests/lib/no-connector-leakage.test.ts`'s `SCANNED_DIRS` extended to include `lib/copilot` (no service-client import, no connector/commit-module leakage); a structural grep test proving `src/lib/copilot/prompt.ts` never references `.history`, `reviewer_note`, `before_state`, or `after_state`; an inert-rendering test proving a `<script>`/markdown-bearing fixture analysis renders as plain text. *Integration (`test:db`, dev/CI only)* — active reviewer can call `record_copilot_analysis`; anon and non-reviewer/inactive-reviewer calls are rejected identically to `submit_review_action`'s pattern; the inserted row's `reviewer_id` equals the calling reviewer's `auth.uid()`; `reviewer_id` cannot be spoofed via any parameter; `item_type != 'new_signal'` is rejected; a successful call writes only to `copilot_analyses` — `research_items`, `signals`, `companies`, and `review_actions` are all unchanged; the `suggested_next_step`/`confidence` CHECK constraints reject out-of-vocabulary values; the `risk_flags`/`missing_evidence` array-typeof constraints reject non-array values even bypassing application validation; RLS allows active-reviewer `SELECT` of all rows, denies anon `SELECT`, and denies direct `authenticated` `INSERT`/`UPDATE`/`DELETE` (bypassing the RPC); fixture cleanup follows the M6D pattern (`test-m7-` id prefix, per-describe-block teardown, sweeping `afterAll` net).

**Dev/CI and production considerations:** M7 is built and tested entirely against dev/CI (`isdtiwdfeirgjoaokikg`) first — dev/CI has an active reviewer fixture; production currently has zero and must remain unchanged during planning. Production migration alignment for the one anticipated migration is a separate, later, explicitly-gated step, matching the pattern just used for M6A/C/D. Production `ANTHROPIC_API_KEY` provisioning and the standing "production has 0 active reviewers" decision are both separate, later, explicitly-gated steps — neither is authorized or implied by this entry.

**Implementation sequence:** this D-095 entry first; the `copilot_analyses`/`record_copilot_analysis` migration draft second; Cowork/Fable review of that migration before it is applied anywhere; the migration applied to **dev/CI only** after that review; implementation of `src/lib/copilot/`, the UI card, and the pending-state client component, with hermetic tests alongside; local gates (`lint`/`typecheck`/`test`/`build`); `test:db` against dev/CI; a further Cowork/Fable review of the implementation and `test:db` results before merge; merge to `main` via feature branch + PR; production migration alignment as a later, separately-gated decision; production `ANTHROPIC_API_KEY` provisioning and the production reviewer-account decision as later, separately-gated steps.

**Known fast-follows (not first-slice, explicitly tracked):** full rate limiting; stronger idempotency/double-submit protection beyond the disabled-while-pending button; Playwright/e2e coverage; production key provisioning; the production reviewer-account decision.

**Consequence:** This is **docs-only planning work.** No code, migration, dependency, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. The M7 plan may proceed to its next step (drafting the `copilot_analyses`/`record_copilot_analysis` migration) only once that step is separately, explicitly approved — not implied by this entry.

### D-096 — M8A Agent-Style Queue Digest: PASS WITH NOTES; plan approved

**Choice:** Cowork/Fable reviewed the M8 plan (a supervised, agent-style, reviewer-only queue digest layered over M7's per-item Copilot analyses, per `docs/ROADMAP_M6_M9.md`) and returned **PASS WITH NOTES**, with eight required refinements folded into the approved plan below. M8A's purpose: let a signed-in reviewer request a point-in-time, non-binding summary of the pending queue — overall shape, which items likely deserve attention first, recurring missing-evidence themes, recurring risk patterns — generated by a model using a small, read-only tool set, demonstrating a genuine bounded tool-use loop rather than M7's single fixed-context call. M8A is **not** autonomous, does not schedule anything, does not persist anything, and cannot mutate any reviewer-decision table under any input.

**Scope:** a bounded, read-only, ephemeral tool-use loop (`src/lib/digest/`: tool contracts, prompt, output schema, injectable model/tool-loop client, orchestration, thin Server Action); one reviewer-dashboard card with a manual "Generate queue digest" trigger and an in-memory-only result display. No new table, no new RPC, no new migration. The module, tool implementations, UI, and Server Action are implementation-phase work, not authorized by this entry — this decision covers the design, not the code.

**Non-scope:** M8A does not auto-approve, auto-reject, or auto-publish anything; does not mutate any reviewer decision; does not schedule or run any background/cron job; does not persist digest history; is not a public chatbot; is not an autonomous production agent; does not require or imply production reviewer-account activation; does not provision `ANTHROPIC_API_KEY`; introduces no service-role access anywhere in the reviewer UI/runtime. M8A never calls `submit_review_action` and never calls `record_copilot_analysis` — it only *reads* `copilot_analyses` rows a reviewer already generated through M7's own flow.

**1. Bounded tool-use loop (Cowork-required reframing):** M8A is a **bounded** tool-use loop, not an open-ended agent — explicit limits, enforced in code, not merely described in a prompt:
- Max model turns: **4**.
- Max total tool invocations: **6**.
- Max `get_item_context` calls specifically: **3** (bounds how many individual items one digest run can drill into).
- Wall-clock timeout: **20 seconds or less**, aligned with M7's own timeout convention (D-095's `AbortSignal`-based, strictly-shorter-than-platform-limit approach), enforced via the same `AbortSignal` mechanism.
- Max output tokens: bounded the same way M7's `DEFAULT_MAX_TOKENS` is (an explicit, config-lived constant, not left to provider default).
- **Fail-closed behavior:** if any bound is exceeded before a valid final digest is produced, the loop stops and returns a clear, typed error (no partial or best-guess digest is ever returned to the reviewer) — mirroring M7's `ModelTimeoutError`/`ModelProviderError`/`ModelResponseParseError` typed-error convention, extended with a bound-specific error type (e.g. `DigestLoopBoundExceededError`).

**2. Extended prompt-injection posture for tool results (Cowork-required):** every tool result is untrusted data, without exception — **including `copilot_analyses` rows that M7 itself generated**, since a prior Copilot analysis is still model-authored, attacker-adjacent-content-derived text, not ground truth. Every untrusted field returned by a tool (headline, summary, excerpts, prior analysis summaries/risk flags) is nonce-wrapped using the same per-request-random-nonce boundary M7 established (`src/lib/copilot/prompt.ts`'s `wrapUntrusted`/`neutralizeNonceOccurrences`, reused or lifted into a shared helper). The system prompt must instruct the model to never follow directives embedded in tool-result content, including directives that attempt to manipulate **future tool calls** the model makes in the same loop (e.g., text inside one item's summary instructing the model to call `get_item_context` on a different, attacker-chosen id, or to skip its bounds) — such content must be surfaced as a risk pattern, never obeyed or acted on. Because the tool set is read-only by construction (see §6), the worst case of a fully successful injection is influence over the digest's *advisory text* or an in-bounds request for an *already-permitted* read — it cannot mutate any row, escalate privilege, or reach any tool outside the two defined below, under any input.

**3. Anthropic tool-use API verification (Cowork-required):** the exact tool-use request/response shape (tool definitions, `tool_use`/`tool_result` content blocks, `stop_reason` handling — specifically the multi-turn loop shape for `stop_reason: "tool_use"` — request format, response parsing, and current model id) must be verified against current official Anthropic documentation at implementation time, never assumed from training memory or copied wholesale from M7's non-tool-use `client.ts`. No live provider call is permitted in any test, at any point — the client must be fully injectable/mocked, matching M7's existing discipline. No `@anthropic-ai/sdk` dependency may be added unless, at implementation time, current official SDK tool-use ergonomics clearly justify it over a hand-rolled wrapper, with that justification documented then — same standing rule D-095 already applies to M7's client.

**4. Enumerated hermetic test matrix (Cowork-required, explicit list — implementation must cover all of these, not a representative subset):**
- Mocked model + mocked read tools; no live provider call anywhere in the suite.
- Tool-loop success path (model requests tools, receives results, produces a valid final digest).
- Loop-bound enforcement when the model keeps requesting tools past the max-turns/max-invocations limits — fails closed with the typed bound-exceeded error.
- Max tool invocations enforced independently of max turns (a single turn requesting many tool calls must still be bounded).
- Malformed tool-call arguments from the model are rejected cleanly, not passed through to a tool handler.
- Unknown tool names requested by the model are rejected cleanly, never silently executed or ignored-then-continued as if valid.
- Malformed final digest output (schema-invalid JSON) is rejected outright.
- Timeout and provider-error handling produce the same clean, typed-error behavior as M7's client.
- Nonce wrapping applies to every untrusted tool-result field, across multiple items in one loop (not just one fixed context, as in M7).
- An injection embedded in one tool result that attempts to influence a *subsequent* tool call is not followed.
- `copilot_analyses` content surfaced through a tool result is treated as untrusted (nonce-wrapped, not trusted as ground truth) — a dedicated test case, not merely implied by the general untrusted-tool-result tests.
- The read-only tool registry itself contains no write/action tool of any kind — a structural/enumeration test over the registered tool set, not just behavioral tests of the two defined tools.
- No call to `submit_review_action` occurs anywhere in the digest code path.
- No call to `record_copilot_analysis` occurs anywhere in the digest code path.
- No `insert`/`update`/`delete`/`rpc` call occurs against a fake session client during a full orchestration run — only `select`-shaped reads.
- Data minimization: each tool returns only its explicitly documented projected fields, never a full row or full payload.
- Digest output schema strict validation (extra/missing/wrong-type fields rejected), mirroring `copilotAnalysisOutputSchema`'s `.strict()` discipline.
- Inert rendering: a fixture digest containing `<script>`/markdown content renders as plain, React-escaped text — no `dangerouslySetInnerHTML`, no markdown-to-HTML.
- `tests/lib/no-connector-leakage.test.ts`'s `SCANNED_DIRS` extended to include `lib/digest` and `components/digest`.
- A component test for the digest panel's pending state and for the unconditional, model-output-independent advisory disclaimer.
- **No `test:db` is required for M8A** unless implementation surfaces a genuine RLS/read-pattern gap the existing M6/M7 `test:db` coverage doesn't already exercise (M8A introduces no new table/RPC/grant, so no new integration-test file is presumed necessary) — this is a default-to-not-required stance, not a prohibition if a real gap is found.

**5. Explicit M8A/M8B split (Cowork-required):** **M8A** — read-only, manual-triggered, ephemeral, reviewer-only queue digest; the only scope this entry authorizes planning for. **M8B** — optional future persistence of digest history and/or scheduled/background digest generation; **not authorized now**, and not implied by this entry. M8B would require its own separate plan, its own Cowork/Fable review, likely a new migration/RPC/RLS design (mirroring `copilot_analyses`/`record_copilot_analysis`'s shape, per D-095's persistence pattern), and its own separate, explicit approval before any of that design work begins — exactly the same gated-sequence discipline this project has applied to every milestone so far.

**6. Read-only tool contracts (Cowork-required, both tools defined here):**
- `list_queue_items` — returns each pending/needs-more-evidence item's id, headline, priority, evidence_strength, verification_status, and (if one exists) its latest `copilot_analyses` row's `suggested_next_step`/`confidence`/risk-flag count.
- `get_item_context` — given one item id, returns the same minimized fields M7's `getCopilotPromptContext` already exposes for that item (headline/summary/why_it_matters/evidence_strength/verification_status, company name/publication_status/is_demo).

Both tools, without exception: use the session client only (`getSessionSupabaseClient()`), never service-role; rely entirely on the existing reviewer-only RLS SELECT policies already in place for `research_items`/`signals`/`companies`/`copilot_analyses` — no new policy is introduced; return only explicitly projected, minimized fields, never a full row or full payload; never write anything, under any input; never call `submit_review_action`; never call `record_copilot_analysis`; never expose or are reachable from any public/unauthenticated route; never return `research_items.payload`, `review_actions` history, `reviewer_note`, or either side of `review_actions`'s `before_state`/`after_state` snapshot pair — the same exclusions D-095 already locked for M7's own narrow read, extended here to the tool layer.

**7. Ephemeral rendering (Cowork-required):** M8A stores no digest rows anywhere — no table, no RPC, no migration exists or is needed for this slice. Because nothing is persisted, there is no row to redirect-and-refetch (M7's `revalidatePath`/`?notice=` pattern doesn't apply); a `useActionState`-based (or equivalent in-memory) client component holding the one returned digest object is the accepted mechanism — narrowly scoped, in the same minimal-client-surface spirit as M7's `RunAnalysisButton`, just extended to also hold a returned value rather than only a pending flag. The digest clears naturally on navigation or refresh; nothing is cached, stored, or recoverable after that. The digest card/panel remains reviewer-only, gated by the same route-level auth this project already applies to every page under `src/app/(reviewer)/`. The result is rendered strictly as escaped React text from the validated schema's named fields — no `dangerouslySetInnerHTML`, no markdown-to-HTML.

**8. Non-scope (Cowork-required explicit restatement):** M8A does not auto-approve; does not auto-reject; does not auto-publish; does not mutate any reviewer decision; does not schedule any background job; does not persist digest history; is not a public chatbot; is not an autonomous production agent; does not activate or require production reviewer-workflow activation; does not provision `ANTHROPIC_API_KEY`; introduces no service-role runtime access anywhere in this feature.

**Recommended clarification (adopted):** M8A may read existing M7 `copilot_analyses` rows only as untrusted advisory input to the digest (see §2) — it never treats them as ground truth and never re-derives or re-validates a reviewer decision from them. `review_actions` history remains excluded from every tool read, matching M7's own exclusion — no justification for including it has surfaced in either milestone's planning.

**Dev/CI and production considerations:** M8A introduces no schema change, so there is no production migration-alignment step for this milestone — a genuine difference from every prior milestone's gated sequence. Production remains schema-aligned through M7 with 0 active reviewers and no `ANTHROPIC_API_KEY` provisioned; M8A does not change, require, or imply either of those standing gates, and is not authorized to touch production in any way by this entry.

**Implementation sequence:** this D-096 entry first; implementation of `src/lib/digest/` (tools, prompt, schema, injectable model/tool-loop client, orchestration, thin Server Action), the dashboard digest card, and the pending/result-holding client component, with the full hermetic test matrix in §4 alongside; local gates (`lint`/`typecheck`/`test`/`build`); no `test:db` step expected (see §4's default stance); a further Cowork/Fable review of the implementation and test results before merge; merge to `main` via feature branch + PR; no production migration-alignment step (see above). M8B remains a separate, later, explicitly-gated decision, not implied by this entry.

**Consequence:** This is **docs-only planning work.** No code, migration, dependency, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. The M8 plan may proceed to its next step (implementing `src/lib/digest/` and the dashboard card) only once that step is separately, explicitly approved — not implied by this entry.

### D-097 — M9 Final Demo/Polish Milestone: PASS WITH NOTES; plan approved

**Choice:** Cowork/Fable reviewed the M9 plan (final demo/polish milestone, per `docs/ROADMAP_M6_M9.md`'s one-line scope: *"M9 adds no new product capability — it is integration, rehearsal, and polish only"*) and returned **PASS WITH NOTES**, with three required refinements and two recommended refinements folded into the approved plan below. M9's purpose: make the public demo and reviewer-workflow story complete and honest for presentation/submission — documentation, public copy, and two small correctness fixes — without adding any new product capability, DB/schema change, or AI/production activation.

**Scope — final demo/polish only, no new product capability:**
1. `README.md` demo script and status summary update (include the M7 Copilot / M8A digest reviewer walkthrough, scoped to dev/CI fixtures only).
2. `docs/ROADMAP_M6_M9.md` header correction to reflect the current merged state (M6A–M8A shipped; the header's prior "M7–M9 remain planning-only until M6 is complete" language is now stale).
3. A new, public "AI-assisted review" section on `src/app/methodology/page.tsx`.
4. Reviewer-facing "AI features are not configured in this environment" messaging in `src/lib/copilot/actions.ts` and `src/lib/digest/actions.ts`, distinguished from a genuine provider/network error.
5. A sector-detail company-count correctness fix (`src/app/sectors/[slug]/page.tsx`).
6. `README.md` "implemented vs. intentionally gated" status summary.
7. `docs/DEPLOYMENT.md` documented-not-executed production AI-activation runbook section.
8. M9-specific hermetic + e2e test coverage (see "Required test coverage" below).
9. A final, read-only M9 demo-readiness check as the last gated step.

**Non-scope (explicit, unchanged from the reviewed plan):** no new product capability of any kind; no DB/schema/RLS/RPC change of any kind; no migration; no live provider or USAspending API call, during planning or implementation; no production `ANTHROPIC_API_KEY` provisioning; no production reviewer creation or activation; no connector script run or write to `connector-runs/`; no new autonomous workflow, scheduling, or background job (M8B remains separately deferred, not opened by this entry); no public chatbot surface; no exposure of private or reviewer-only data on any public route; no expansion of service-role runtime access anywhere in the app. Every one of these remains a standing, separately-gated decision this entry does not open.

**Required refinement 1 — sector-count semantics (Cowork-required correction):** `src/app/sectors/[slug]/page.tsx`'s current copy has a real bug — it hardcodes *"this sector has 3 companies in total"* regardless of the actual count. The fix must use honest, consistent count semantics: if the copy says **"in total,"** the number shown must be the sector's actual total published company count (i.e. `view.companies.length`, or the equivalent already-computed value for that page — not a new query); if the UI instead wants to describe a filtered subset (e.g. after a company-type or evidence-strength filter is applied), it must be worded as **"showing X of Y"** or equivalent, never as an unqualified "in total" count that is actually a filtered count. The implementation must not expose any draft/private/unpublished count on this public page — only the same published-company count already safe to show elsewhere on the page. The wording and the number must always match (no "in total" copy paired with a filtered number, and vice versa). The required test must use a fixture whose real count is **not** 3 (or otherwise structurally prove the displayed value is derived from live data, not a literal), so the test cannot pass against a reintroduced hardcoded value by coincidence.

**Required refinement 2 — honest public AI methodology/status copy (Cowork-required framing):** the new methodology-page "AI-assisted review" section may describe M7's Copilot and M8A's queue digest **conceptually only** — what they do, not how to reach them, since neither is publicly accessible. The copy must frame both as **advisory, human-in-the-loop reviewer aids**, and must state plainly that neither ever decides, approves, rejects, publishes, or verifies any public content on its own — every real workflow transition still requires an explicit, separate human reviewer action (`submit_review_action`), unchanged since D-054/D-095/D-096. The copy must **prominently disclose that live AI is not enabled in the deployed production environment** — the single most important sentence in this section, since it prevents a visitor or grader from concluding a live, active AI system is running against production. The copy must not imply, anywhere, that any published demo or public content was AI-decided, AI-approved, AI-verified, or generated by an active production AI system. This must align with the project's "public interest before hype" principle (`CLAUDE.md`) and with D-089's existing "not a public chatbot" framing — it is a restatement and public-facing extension of that framing, not a new position.

**Required refinement 3 — fixed, honest "not configured" message (Cowork-required correction):** today, a missing `ANTHROPIC_API_KEY` collapses into each module's generic `ModelProviderError` branch, producing "Try again" — technically true but misleading, since retrying can never succeed when the feature is simply unconfigured. The fix must add a **distinct, fixed, friendly message** for the not-configured state (e.g. "AI features are not configured in this environment.") — additive to, not a replacement of, the existing `ModelTimeoutError`/`ModelProviderError`/`ModelResponseParseError` typed-error pattern each of `copilot/client.ts` and `digest/client.ts` already has. This message must **never include the literal string `ANTHROPIC_API_KEY`** (or any other internal env-var name) and must **never pass through raw internal error text** to the reviewer — it is a fixed, reviewer-facing string, not an interpolation of the underlying error. A genuine provider/network failure (a real HTTP error, timeout, or malformed response from a configured key) must continue to map to the existing, separate, retryable "provider error" message — the two failure modes must remain distinguishable in the code and in what the reviewer sees. Required tests must assert both (a) the not-configured message never contains `ANTHROPIC_API_KEY` or raw internal error text, and (b) a genuine provider/network error still produces the existing generic retryable message, not the new one.

**Recommended refinement 1 (adopted) — `DEPLOYMENT.md` runbook consolidation:** the new documented-not-executed production-AI-activation runbook section should consolidate every standing pre-go-live gate in one place, not just key provisioning: (a) re-verify the current Anthropic model/API/tool-use request-response shape against official live documentation before the first live call is ever made (the exact caution D-095/D-096 already state for implementation time, restated here for go-live time, since the shape may drift further between implementation and eventual activation); (b) provision the server-only provider key; (c) make the production reviewer-account decision; (d) preserve the existing migration-before-reviewer-activation sequencing already established for the `copilot_analyses` table (D-095) — i.e. schema alignment must precede any reviewer activation, not the other way around. This section documents what these steps would involve; **it does not execute any of them.**

**Recommended refinement 2 (adopted) — methodology test scope:** the hermetic test for the new methodology copy must specifically assert the "live AI is not enabled in the deployed production environment" disclosure sentence is present, not merely that the section renders with some AI-related text — the disclosure sentence itself is the safety-relevant assertion, not incidental copy.

**Required test coverage for M9 implementation:** *Hermetic* — a methodology-page copy test asserting both the advisory/human-in-the-loop framing and the live-AI-not-enabled disclosure specifically (per Recommended refinement 2); not-configured-vs-provider-error tests for both `copilot/actions.ts` and `digest/actions.ts`, extending (not replacing) the existing `client.test.ts`/`run-analysis.test.ts`/`run-digest.test.ts` suites; a dedicated test proving the not-configured message contains neither `ANTHROPIC_API_KEY` nor any raw internal error text (per Required refinement 3); a sector-count regression test using a fixture whose real count is not 3, or an equivalent structural proof that the value is derived rather than hardcoded (per Required refinement 1). *e2e (Playwright)* — coverage for both the Copilot "Run analysis" and digest "Generate queue digest" not-configured UI states when no provider key is present, reusing the existing `TEST_REVIEWER_EMAIL`/`TEST_REVIEWER_PASSWORD` dev/CI login pattern already established in `e2e/reviewer-workflow.spec.ts` — no new auth mechanism. *`test:db`* — **not required**: M9 introduces no DB/RLS/schema change of any kind.

**Cowork/Fable review before merge (required, not skippable):** a further implementation-stage review is required before merge, focused specifically on: public methodology copy honesty (Required refinement 2); sector-count correctness and wording consistency (Required refinement 1); the not-configured message's no-leak behavior (Required refinement 3); and factual accuracy of the README/ROADMAP/DEPLOYMENT doc updates against the actual current merged state. This is a lighter, more targeted review than a full plan/migration review — there is no migration to review, since none exists for this milestone.

**Dev/CI and production considerations:** M9 introduces no schema change, so — like M8A — there is no production migration-alignment step. Production remains schema-aligned through M7, with 0 active reviewers and no `ANTHROPIC_API_KEY` provisioned; M9 does not change, require, or imply either of those standing gates. The doc/copy changes ship to production on the next normal deploy like any other merged change, but remain inert with respect to AI activation: the new methodology copy is static text, and the new not-configured message only ever renders when a key is genuinely absent — which remains true in production today and is not changed by this entry.

**Implementation sequence:** this D-097 entry first; implementation of the nine scope items above, with the required hermetic + e2e test coverage alongside; local gates (`lint`/`typecheck`/`test`/`build`); **no migration-draft gate** (none is needed); **no `test:db` step** by default (see "Required test coverage"); the required Cowork/Fable implementation review above, before merge; merge to `main` via feature branch + PR; a final, **read-only** M9 demo-readiness check as the last step, mirroring the M6/M7 production-readiness-check pattern already used twice this project — confirming production's standing state is unchanged (0 active reviewers, no provider key, schema aligned through M7) and that the dev/CI demo runbook actually works end-to-end, without making any production write, migration, or activation.

**Consequence:** This is **docs-only planning work.** No code, migration, dependency, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. The M9 plan may proceed to its next step (implementing the scope items above) only once that step is separately, explicitly approved — not implied by this entry.

### D-098 — Post-M9 Public Usability and Production-Readiness Roadmap

**Choice:** Fable/Cowork completed a whole-system review after M9 merged and returned an assessment that this entry records verbatim in substance, alongside adopting the post-M9 roadmap (M10–M16) that follows from it. This entry is the canonical successor to `docs/ROADMAP_M6_M9.md` — that document's own scope ends at M9; everything from here forward is planned under this entry and the milestones it defines.

**Post-M9 state snapshot (as of this entry):** M6A–M6D complete and merged; M7 Reviewer Copilot complete and merged; M8A Queue Digest complete and merged; M9 final demo/polish complete and merged. The public demo is deployed. Production schema is aligned through M7; M8A and M9 introduced no schema/RLS/RPC changes. Production active reviewer count remains 0. `ANTHROPIC_API_KEY` has not been provisioned. No production reviewer has been created or activated. No live Anthropic or other provider call has ever occurred. No live production connector write has ever occurred. The public site currently shows fictional demo data only. Both AI features are implemented but intentionally not production-usable yet.

**Fable's overall assessment:** Signal Commons has a **strong foundation** that is **correctly gated** — the safety and integrity architecture is, in Fable's words, **ahead of the product**: more of the system is built to prevent a bad outcome than is built to produce a good one yet. The platform is **still not publicly useful with real data** — every public record remains fictional demo content, and no real connector-sourced item has ever been committed or published. The next phase is explicitly **not "more features" for their own sake** — it is **converting a well-gated demo into a small, real, trustworthy public dataset, one gate at a time**, in the deliberate order this entry lays out below.

**What Fable identified as strong, to be preserved and not weakened by any future milestone:**
- The publish gate and RPC-first enforcement pattern (`submit_review_action`, `record_copilot_analysis`, `commit_usaspending_candidate` — every mutation with real consequence goes through a single, reviewer-gated, `SECURITY DEFINER` RPC, never ad hoc client-side writes).
- The RLS posture across every table (default-deny, explicit reviewer-only or public-published-only policies, no anon write policy anywhere).
- The three-client separation (anon/publishable session client for public reads, session client for reviewer reads/writes, service-role client confined to local/CI scripts and never present in the Vercel runtime).
- Service-role isolation from the deployed app — confirmed structurally, not just by convention.
- The no-leakage structural tests (`tests/lib/no-connector-leakage.test.ts`) proving connector and service-role code never reaches `src/app`, `src/components`, `src/lib/data`, `src/lib/review`, `src/lib/copilot`, or `src/lib/digest`.
- Decision-log discipline — every milestone's design, required/recommended refinements, and consequences recorded in `docs/DECISIONS.md` before implementation, not after.
- Prompt-injection and AI-output discipline — the nonce-boundary untrusted-content pattern (M7), extended to a bounded, read-only, multi-turn tool-use loop (M8A) that still cannot mutate anything, and a strict output schema layered under both.
- Honest public UX — the demo-data banner, the methodology page's disclosure language, and the M9 additions (honest not-configured AI messaging, corrected sector counts, the AI-assisted-review section's live-AI-not-enabled disclosure) all reflect actual system state rather than aspirational copy.
- Environment separation (local/CI/Preview/Production, each with its own credentials, `.env.production.local` never auto-loaded, service-role key never given to Vercel).
- The conservative entity-resolution posture (UEI-exact-only automatic matching, `possible_individual` routing before any draft-company creation, no automatic entity merge beyond strict UEI reuse).

**What Fable identified as remaining demo-only, not yet proven in real conditions:**
- All public content is fictional — no real company, signal, or source has ever been shown publicly.
- The connector's live `--commit` CLI path has been smoke-tested but has never committed a real candidate into the reviewer queue.
- Stage-1 recall (the deterministic USAspending filter's ability to actually find relevant candidates at scale) remains unproven — M6's own acceptance criteria explicitly excluded this.
- Entity-resolution edge cases beyond the tested fixtures (parent/subsidiary chains, near-duplicate names, ambiguous UEIs) remain unvalidated against real data volume.
- The `entity_match`/`new_company`/correction reviewer paths are view-only today — no review-action support exists for them yet (M6's own documented scope limit).
- Neither AI feature has ever been run against a live provider — every test in this repo injects its own mock; the actual Anthropic API shape has never been exercised.
- Reviewer operations (login, approve/reject/dispute, Copilot, digest) have never been exercised in production — only on dev/CI, with fixture accounts.
- Known operational hardening gaps remain accepted-but-open: no rate limiting or idempotency keys on mutation endpoints (carried forward since M4), no production error monitoring/alerting, no key-rotation runbook, leaked-password protection not yet confirmed enabled in production.
- Vercel Preview still points at the shared dev/CI Supabase project (an accepted M5-era decision, not yet revisited).

**Adopted next roadmap (M10–M16), replacing `docs/ROADMAP_M6_M9.md` as the canonical forward plan:**

- **M10 — Public Usability & Trust Foundation.** Scope: a feedback/corrections channel; a public FAQ/About page; "what is a signal?" plain-language explainers; badge-to-methodology links (evidence-strength and verification-status badges linking to their definitions); `robots.txt`/sitemap/Open Graph metadata; human-written sector context (beyond the current auto-generated framing); a search plan (Postgres full-text search is the likely mechanism, not yet decided); a signal-slug strategy decision, required before any real record is ever published (today's slugs are demo-fixture-derived); an optional RSS/feed. Exit gate: quality gate (`lint`/`typecheck`/`test`/`build`) green; an accessibility check performed; the corrections channel live.
- **M11 — Reviewer & Operational Hardening → Production Reviewer Activation.** Scope: rate limiting and idempotency keys on mutation endpoints (promoted from accepted gap to blocking, see below); confirm/enable leaked-password protection in production; a login-abuse posture decision; an advisor-follow-up hardening migration if the Supabase security advisors surface anything at that time; error monitoring/alerting; a key-rotation runbook; **only then**, provision the first real production reviewer. Exit gate: one real reviewer active in production; every M4-era accepted gap this milestone targets is closed, not merely documented.
- **M12 — Production AI Activation.** Scope: re-verify the current Anthropic model/API/tool-use request-response shape against official live documentation (mandatory first step, per D-095/D-096/D-097's own standing caution — never assumed from implementation-time memory); a dev/CI provider-key smoke test first; per-reviewer and global run caps; provider spend limits; a digest-run logging decision (promoted from open question to a required decision before activation); the production key is provisioned **only after** caps and the smoke test both pass. Exit gate: one verified live Copilot run and one verified live digest run, performed by the real reviewer from M11, within the established caps, and logged.
- **M13 — Real Connector Operations, queue-only.** Scope: the first real operational commit run; the D-093 5-row SQL inspection step repeated at real-operation scale; NAICS/PSC reconciliation (the known null-mapping limitation from D-091); the `entity_match` reviewer path (still view-only as of D-098); ingestion observability; a circuit-breaker/queue-cap decision; a retention decision for `ingestion_runs`/connector artifacts; a recurring-run cadence — manual before any scheduled run is even considered. Exit gate: real drafts flow into the private queue; a reviewer can triage them; shed/skip reasons are visible; **still zero public exposure** of any real record.
- **M14 — Real Record Publishing Pipeline.** Scope: a company-publish mechanism (does not exist today — every company-level publication decision this project has made has been demo-data-only); an R1 re-confirmation mechanism (re-checking the "signal cannot publish while company is draft" invariant under real data); a real/demo provenance UI; a banner and methodology-copy redesign to accommodate mixed real/demo content honestly (the current "everything is fictional" framing becomes false the moment one real record publishes); real evidence display; data-quality bars; closure of the person-name and parent/subsidiary validation gaps flagged in M13; a privacy policy and a takedown/corrections process (promoted from open question to required-before-launch, see below). Exit gate: the first real record is publicly visible, fully labeled as real, and correctable through the now-live corrections channel.
- **M15 — Supervised Agent Layer.** Scope: M8B's persisted-digest design (deferred since M8A); scheduled digest generation, only after M12's caps and logging exist; pre-filled review-action drafts (an assistant that prepares a suggested action for a human to confirm, never auto-submits one); an entity-match assistant. Structurally unchanged from M7/M8A's own invariants: **no write tools, no auto-approval, no auto-publication** — this milestone extends the advisory pattern, it does not relax it. Exit gate: the structural no-write-tool tests (mirroring `tests/lib/digest/tools.test.ts`'s registry-enumeration pattern) are still green; every agent run is audited.
- **M16 — Public Launch Readiness.** Scope: a security re-review; a dependency scan; a load sanity check; monitoring verified end-to-end; an accessibility audit; a full content review; launch FAQ/comms. Exit gate: a go/no-go decision recorded in `docs/DECISIONS.md`, not merely a checklist completed silently.

**Accepted gaps promoted to blocking gates (must close before the milestone that depends on them, not merely tracked as known-accepted):**
- Rate limiting — blocking for M11.
- Idempotency keys on mutation endpoints — blocking for M11.
- AI run caps (per-reviewer and global) — blocking for M12.
- Provider cost/spend caps — blocking for M12.
- Production observability — blocking for M11 (reviewer activation) and reconfirmed for M12 (AI activation).
- Leaked-password protection — blocking for M11 (this was already flagged as a prerequisite once real reviewer accounts exist, per D-085 and `docs/DEPLOYMENT.md`'s reviewer-provisioning runbook — M11 is where it actually becomes blocking rather than merely recommended).
- A digest-run logging decision — blocking for M12, before production AI activation.
- A corrections/takedown process — blocking for M14, before any real public record.
- A real/demo banner and provenance-UI redesign — blocking for M14, before any real public record (the current single-state "everything here is fictional" banner cannot honestly describe a mixed real/demo public dataset).

**Consolidated activation-ordering rule (the sequence every later milestone must respect, restated as one list so no future plan can silently reorder it):**
1. Public usability/trust foundation (M10).
2. Reviewer and operational hardening (M11, first half).
3. Real production reviewer activation (M11, exit gate).
4. Live-documentation provider verification (M12, first step, before any key work).
5. Dev/CI provider-key smoke test (M12).
6. Rate/cost caps (M12, before the production key).
7. Production provider key (M12, only after 4–6).
8. Real connector operations, private queue only (M13 — no public exposure yet).
9. Company-publish and real-record publishing mechanism (M14, built before use).
10. Real public data (M14 exit gate — the first real record goes live).
11. Supervised agents beyond the current read-only advisory pattern (M15 — after real data exists, not before).
12. Public launch readiness (M16 — last, not first).

**Non-scope — explicitly not authorized by this entry:**
No code implementation of any kind; no migration; no schema/RLS/RPC change; no Supabase command; no database write; no live provider or API call; no Anthropic call; no provider-key provisioning; no production reviewer creation or activation; no live USAspending connector write; no publishing of real public data; no company-publish mechanism; no agent capability beyond what M7/M8A already ship; no scheduled or background job of any kind; no Vercel or environment-variable change. This entry adopts a roadmap; it does not begin executing any part of it.

**Immediate next steps after this entry (each still separately gated, not authorized by D-098 itself):**
1. Draft the M10 plan.
2. Send the M10 plan to Cowork/Fable for a light public-surface review (lighter than a full milestone review, since M10 touches no reviewer/AI/connector safety surface).
3. Decide the corrections-channel mechanism — email vs. a structured form — before M10 implementation begins.
4. Decide the signal-slug strategy before any real publishing work in M14.
5. Create a single, consolidated pre-launch gap list, gathering every deferred item named across this entry in one place rather than scattered across milestone entries: rate limiting; idempotency; digest-run logging; any INFO/WARN-level Supabase advisor items outstanding at the time; the leaked-password protection toggle; NAICS/PSC reconciliation; the `entity_match` reviewer path; the ingestion circuit breaker; the retention decision; production observability; the key-rotation runbook; and the privacy/corrections/takedown process.

**Consequence:** This is **docs-only planning work.** No code, migration, dependency, API call, database write, Supabase change, Vercel change, or env-file change is authorized by this decision. This entry adopts the M10–M16 roadmap as the project's canonical forward plan; it does not authorize starting M10 or any other milestone above — each remains its own separately-gated planning step, following the exact same plan → Cowork/Fable review → decision-log entry → implementation → test/build → review → merge sequence every milestone since M6A has used.
