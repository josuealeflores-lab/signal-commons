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
