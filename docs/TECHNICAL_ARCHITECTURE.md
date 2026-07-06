# Technical Architecture

## Architecture principle

Build one well-structured application first. Separate domain modules inside the repository before separating deployable services.

## Recommended MVP stack

### Application

- Node.js current LTS
- Next.js App Router
- React
- TypeScript with `strict: true`
- Tailwind CSS
- a restrained accessible component system; use existing primitives where appropriate rather than inventing complex controls
- a simple chart library only for the one required activity chart

### Data and identity

- Supabase Postgres
- Supabase Auth for reviewer accounts
- Supabase Storage only if source snapshots or uploaded evidence files are included
- Row Level Security for all exposed tables
- SQL migrations in source control

### Deployment and collaboration

- GitHub as source of truth
- Vercel for preview and production deployments
- Vercel environment variables for public/server values
- Supabase secrets for function-specific secrets where applicable

### Testing

- unit tests for evidence and publication rules
- component tests for critical labels/forms
- integration tests for data-access boundaries where practical
- Playwright smoke tests for public dashboard and reviewer publish gate

## Why this stack

It matches the tools already available, reduces operational overhead, and keeps the path from local development to preview deployment straightforward.

## Suggested repository structure

```text
signal-commons/
├── CLAUDE.md
├── README.md
├── references/
├── docs/
├── seed/
├── public/
│   └── brand/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── sectors/
│   │   │   ├── companies/
│   │   │   ├── signals/
│   │   │   ├── methodology/
│   │   │   └── about/
│   │   ├── (reviewer)/
│   │   │   ├── research-queue/
│   │   │   └── reviewer/
│   │   ├── auth/
│   │   └── api/
│   ├── components/
│   │   ├── brand/
│   │   ├── dashboard/
│   │   ├── evidence/
│   │   ├── companies/
│   │   ├── review/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── data/
│   │   ├── evidence/
│   │   ├── review/
│   │   ├── validation/
│   │   └── ai/
│   ├── types/
│   └── styles/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── tests/
└── .env.example
```

Keep the exact tree flexible, but preserve separation between UI, data access, evidence rules, and review rules.

## Rendering model

- Use server components by default for read-heavy public pages.
- Use client components for search controls, filters, interactive charts, and review forms.
- Keep privileged data mutations in server actions or route handlers.
- Never trust authorization decisions made only in the browser.

## Data flow

```text
Demo seed or approved connector
        ↓
Source document / source metadata
        ↓
Extracted draft signal
        ↓
Entity match + evidence classification
        ↓
Research queue
        ↓
Human review action
        ↓
Approved published signal
        ↓
Public dashboard and profiles
```

## AI boundary

Create an AI-provider adapter, but the first milestone should work without an API key.

Suggested interface:

```ts
interface ResearchExtractor {
  extract(input: SourceDocument): Promise<ExtractionResult>
}
```

Implementations may include:

- `DemoResearchExtractor` for deterministic development fixtures
- `ClaudeResearchExtractor` later

AI output must be validated with a schema before database insertion. AI must not directly set a record to published or verified.

## Scheduled ingestion

Do not add scheduling until the manual end-to-end flow works.

Later options:

1. A daily Vercel Cron calling a secured route handler.
2. Supabase `pg_cron` invoking an Edge Function.
3. A GitHub Action for controlled batch imports.

Every run must be idempotent and write an `ingestion_runs` record. Prevent duplicate source documents using a canonical URL and content hash.

## Search

Start with Postgres full-text search and normalized columns. Do not add embeddings merely because the product involves AI. Add semantic search only after a specific query failure is demonstrated and evaluated.

## Local development

### Minimal path

- run Next.js locally with Node.js;
- connect to a hosted Supabase development project.

### More reproducible path

- use Supabase CLI locally, which may rely on Docker Desktop;
- optionally create a dev container after the initial scaffold is stable.

## Use of `uv` and Python

Do not add Python to the MVP by default. Introduce a `workers/research` Python project managed by `uv` only if one of these becomes true:

- document parsing libraries are materially better in Python;
- batch ETL becomes difficult to maintain in serverless TypeScript;
- data-science evaluation requires Python;
- long-running research jobs exceed the application runtime model.

## Kubernetes decision

Kubernetes is intentionally excluded. Reconsider only when there are multiple independently scaling services, long-running workers, and an operational need that cannot be addressed by Vercel, Supabase, or a single worker deployment.

## Security requirements

- RLS enabled for exposed tables.
- Public users can read only published, non-deleted records.
- Reviewer users can access review functions based on a role claim or reviewer profile table.
- Service-role access is server-only.
- Secrets are never logged.
- External source HTML/text is untrusted.
- Sanitize rendered excerpts.
- Validate all incoming payloads.
- Rate-limit mutation endpoints before public launch.
- Use an idempotency key for ingestion and review actions where appropriate.
- Keep an append-only review/audit record.

## Observability

For the MVP:

- structured server logs;
- ingestion-run records;
- review-action records;
- visible error state for failed source processing;
- Vercel runtime/build logs;
- Supabase logs.

Add third-party monitoring only after the application has meaningful traffic or recurring background jobs.
