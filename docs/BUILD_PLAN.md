# Build Plan

## Delivery strategy

Build a trustworthy vertical slice first. Each milestone must end with lint, typecheck, tests, and build passing.

## Milestone 0 — Repository and plan

### Deliverables

- initialize Git and Next.js TypeScript application;
- create feature branch;
- add baseline scripts for lint, typecheck, test, and build;
- copy approved reference images into `public/brand/` or retain them in `references/` as non-runtime references;
- create `.env.example`;
- document setup in README;
- present final implementation file tree before substantive UI work.

### Stop condition

Do not build the dashboard until the project boots locally and the quality scripts execute.

## Milestone 1 — Branded public dashboard with deterministic demo data

### Deliverables

- responsive top navigation;
- logo/wordmark implementation;
- dashboard title and mission;
- visible demo-data notice;
- four KPI cards calculated from the demo dataset;
- equal seven-sector overview;
- emerging-this-week list;
- activity chart with accessible text summary;
- company spotlight;
- evidence-label explainer;
- platform principles;
- footer;
- loading/empty/error component patterns;
- responsive and keyboard checks.

### Data

Load from `seed/demo-data.json` through a typed repository module, not directly inside components.

### Stop condition

Dashboard matches the approved visual direction, is responsive, and all quality checks pass.

## Milestone 2 — Public navigation and detail pages

### Deliverables

- sectors index and seven sector detail pages;
- companies index with search/filter/sort;
- company profile page;
- signals index;
- methodology page;
- dynamic metadata and not-found states;
- test coverage for filtering and evidence rendering.

### Stop condition

A user can navigate from dashboard → sector → company → signal → source without broken routes.

## Milestone 3 — Supabase foundation

### Deliverables

- local or development Supabase project configuration;
- migrations for the core model;
- seed process that imports the demo dataset;
- server-side Supabase clients;
- RLS policies;
- public read views/queries;
- application switched from JSON repository to Supabase repository through the same domain interface;
- no service-role key in browser code.

### Stop condition

The public application renders from Supabase and anonymous mutation attempts fail.

## Milestone 4 — Authenticated research queue

### Deliverables

- reviewer authentication;
- role/authorization check;
- pending research-item list;
- evidence packet view;
- editable proposed summary;
- actions: approve, edit-and-approve, reject, dispute, request evidence;
- append-only review actions;
- publish gate;
- tests proving an AI/import draft cannot become public without review.

### Stop condition

A reviewer can move a draft through the complete workflow and the public site reflects only approved content.

## Milestone 5 — Deployment and operational hardening

### Deliverables

- GitHub-connected Vercel project;
- preview and production environments;
- environment-variable documentation;
- production Supabase project;
- deployment smoke tests;
- basic security review;
- accessibility review;
- realistic empty states;
- README demo script for the bootcamp presentation.

### Stop condition

A production URL is available and the full demo scenario works from a clean browser session.

## Milestone 6 — First controlled research connector

Choose only one connector after source research. Recommended characteristics:

- official or clearly licensed;
- structured API or feed;
- manageable entity matching;
- meaningful coverage across one or more sectors;
- stable enough for a demo.

### Deliverables

- source registry entry;
- connector implementation;
- idempotent ingestion run;
- source-document storage;
- draft-signal creation;
- queue entry;
- logs and failure handling;
- no autonomous publication.

## Deferred backlog

- multiple connectors;
- weekly automated brief;
- user watchlists;
- email alerts;
- semantic search;
- richer entity resolution;
- source contradiction detection;
- public corrections form;
- GitHub Actions automated review;
- Python/uv research worker;
- agentic recurring research;
- real momentum methodology;
- public API.
