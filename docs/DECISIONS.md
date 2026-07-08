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
