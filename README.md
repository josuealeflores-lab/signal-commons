# Signal Commons — Claude Build Handoff

Signal Commons is a public-interest intelligence dashboard for discovering lesser-known AI companies shaping essential sectors through transparent, source-linked evidence.

## What is in this package

- `00_START_HERE.md` — how to use this package with Claude Code and Claude Cowork
- `CLAUDE.md` — repository-level instructions for Claude Code
- `docs/PRODUCT_REQUIREMENTS.md` — product purpose, users, scope, pages, and acceptance criteria
- `docs/TECHNICAL_ARCHITECTURE.md` — recommended stack and system design
- `docs/DATA_MODEL.md` — entities, evidence model, statuses, and access rules
- `docs/DESIGN_SYSTEM.md` — brand, UI, accessibility, and visual-reference instructions
- `docs/RESEARCH_METHODOLOGY.md` — evidence rules and human-review methodology
- `docs/BUILD_PLAN.md` — phased implementation backlog
- `docs/ACCEPTANCE_CHECKLIST.md` — definition of done for the MVP
- `docs/DECISIONS.md` — decisions already made and questions intentionally deferred
- `prompts/CLAUDE_CODE_KICKOFF.md` — first prompt to paste into Claude Code
- `prompts/CLAUDE_COWORK_RESEARCH.md` — optional prompt for research/documentation work in Cowork
- `seed/demo-data.json` — explicitly fictional demo data with equal sector representation
- `references/brand-guide.png` — approved brand direction
- `references/dashboard-mockup.png` — approved dashboard direction

## Core MVP outcome

Build a deployed, responsive vertical slice that includes:

1. A public dashboard with all seven sectors represented equally.
2. Searchable company and signal views.
3. Source-linked evidence and transparent evidence labels.
4. A protected research queue where a reviewer can approve, edit, reject, or request more evidence.
5. A publish gate: unreviewed research cannot appear as verified public content.
6. Clearly labeled demo data until real research connectors are added.

## Important scope rule

Do not begin with automated scraping, market prediction, an opaque company ranking, Kubernetes, or a multi-service architecture. Build the trustworthy research-and-review foundation first.

## Local development

The application is a Next.js (App Router) + TypeScript project scaffolded in `src/`. This scaffold (Milestone 0) intentionally has no dashboard, Supabase, or auth wired up yet — see `docs/BUILD_PLAN.md`.

```bash
npm install

npm run dev        # start the dev server at http://localhost:3000
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit (strict mode)
npm test            # Vitest + React Testing Library (jsdom)
npm run build       # production build
```

Copy `.env.example` to `.env.local` and fill in values once Supabase/Claude credentials are introduced (not required for Milestone 0).

## Demo script (production)

A live demo from a clean browser session, in order:

1. **Public browse** — visit the production URL. The dashboard, `/sectors`, `/companies`, and `/signals` all load with a persistent "Demo data" notice. Every sector is represented equally.
2. **Evidence** — open any signal and any company profile. Each shows source-linked evidence with a publisher, event date, retrieval date, source type, verification status, and evidence-strength label — no opaque overall score.
3. **A draft stays private** — a draft/in-review signal returns the same branded 404 as a nonexistent one; there is no way to distinguish "exists but unpublished" from "doesn't exist" as an anonymous visitor.

**Reviewer flow** is demonstrated separately, since production intentionally has no publicly-known reviewer login:

- **On dev/CI**, sign in at `/auth/login` with one of the five fixture reviewer accounts (`docs/DECISIONS.md` D-066), open `/research-queue`, and walk a pending item through approve → dispute — the signal appears on `/signals` immediately after approval and disappears immediately after dispute.
- **On production**, the reviewer flow can only be demonstrated after manually provisioning one real reviewer account, following the runbook in `docs/DEPLOYMENT.md` — production ships with zero usable reviewer logins by design (only an inactive system identity used for seeded audit-anchor attribution, `docs/DECISIONS.md` D-076).

See `docs/DEPLOYMENT.md` for the full environment map, production setup order, and Vercel cutover/rollback steps.
