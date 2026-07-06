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
