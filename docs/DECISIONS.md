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
