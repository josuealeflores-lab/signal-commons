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
