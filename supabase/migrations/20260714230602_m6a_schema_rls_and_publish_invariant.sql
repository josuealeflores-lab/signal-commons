-- Signal Commons — Milestone 6A: USAspending connector schema/RLS
-- prerequisites and the Option-B publish invariant.
--
-- Adds 2 tables: company_aliases (UEI/name alias storage for entity
-- resolution, docs/ENTITY_RESOLUTION_POLICY.md §3) and ingestion_runs (one
-- row per connector invocation, docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md
-- §10). Adds reviewer-only RLS to both (no anon policy, no reviewer
-- INSERT/UPDATE/DELETE policy — writes happen only via a future
-- service-role connector script, out of scope for this migration). Adds an
-- additive `research_items.is_demo` column, defaulting existing rows to
-- `true`. Adds the first trigger in this codebase: a BEFORE INSERT OR
-- UPDATE guard on `signals` enforcing that a signal cannot be published
-- unless its company is already published (docs/DECISIONS.md D-090).
--
-- Does not include a USAspending fetcher, a connector script, any reviewer
-- UI change, or any change to submit_review_action. Per D-090, this trigger
-- surfaces a known, deliberately-deferred follow-up: submit_review_action's
-- approve/edit_approve will start raising an exception on a real
-- connector-sourced new_signal item (whose company stays draft in M6),
-- rather than silently succeeding-but-hidden as it does today. That RPC
-- reconciliation is out of scope here and is tracked separately.

-- ============================================================
-- Tables
-- ============================================================

create table public.company_aliases (
  id text primary key,
  company_id text not null references public.companies (id),
  alias text not null,
  alias_type text not null check (alias_type in ('uei', 'legal_name', 'dba', 'parent_uei', 'parent_name')),
  normalized_alias text not null,
  created_at timestamptz not null default now()
);

-- DB-level safety backstop for the duplicate_uei conflict case
-- (docs/ENTITY_RESOLUTION_POLICY.md §5): a given UEI should map to at most
-- one company. This index is not the primary conflict-detection mechanism
-- — the future connector script pre-checks for an existing alias before
-- inserting and routes a conflict to a human-reviewed entity_match item.
-- This index exists so a missed pre-check or a race condition can never
-- silently produce two companies sharing one UEI; a violation must be
-- caught and logged as the same duplicate_uei conflict, never treated as a
-- signal to merge.
create unique index company_aliases_uei_unique
  on public.company_aliases (normalized_alias)
  where alias_type = 'uei';

create table public.ingestion_runs (
  id text primary key,
  connector_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'partially_succeeded', 'failed')),
  records_discovered int not null default 0,
  records_created int not null default 0,
  records_skipped int not null default 0,
  error_summary text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- research_items.is_demo: additive column, backfilled to `true` on every
-- existing row by the DEFAULT clause itself — no separate UPDATE needed.
-- Fixes the schema-level gap underlying the is_demo hardcoding bug in
-- src/lib/review/queue.ts (the UI-layer fix is a later, separate step).
alter table public.research_items
  add column is_demo boolean not null default true;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.company_aliases enable row level security;
alter table public.ingestion_runs enable row level security;

-- company_aliases / ingestion_runs: reviewer SELECT only (all rows), same
-- exists-active-reviewer pattern used everywhere else in this schema. No
-- anon policy at all — neither table is surfaced publicly in Milestone 6.
-- No reviewer INSERT/UPDATE/DELETE policy — rows are written only by a
-- future service-role connector script (not part of this migration), which
-- bypasses RLS entirely, exactly like reseed_demo_data and
-- derive_research_items_from_seed_signals today.
create policy company_aliases_reviewer_select on public.company_aliases
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

create policy ingestion_runs_reviewer_select on public.ingestion_runs
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

-- research_items.is_demo needs no RLS change: RLS in Postgres is row-level,
-- not column-level, and the existing research_items_reviewer_select policy
-- (unconditional on any column) already covers this new column on every
-- row. research_items still has no anon policy at all.

-- ============================================================
-- Option-B safety invariant — a signal cannot be published unless its
-- company is already published (docs/DECISIONS.md D-090)
-- ============================================================
--
-- A CHECK constraint cannot reference another table, so this is
-- implemented as a trigger — the first one in this codebase's migrations.
-- Scoped narrowly: it only does anything when a row is being set to
-- publication_status = 'published'; a signal can still be freely
-- inserted/updated as draft/in_review/archived regardless of its
-- company's status.
--
-- Not SECURITY DEFINER: it doesn't need to be. Every real call path that
-- can reach this trigger already runs under an elevated role — either
-- submit_review_action (itself SECURITY DEFINER, so its own nested
-- UPDATE on signals executes as the function owner) or a service-role
-- connector script (service_role bypasses RLS but not triggers, which is
-- exactly the point of enforcing this invariant here rather than only in
-- RLS or application code).
--
-- Known, deliberate consequence (D-090): once a real M6B/M6C
-- connector-sourced new_signal item exists, submit_review_action's
-- approve/edit_approve will raise the exception below instead of silently
-- succeeding, because Milestone 6 has no company-publish mechanism at
-- all. Reconciling submit_review_action for that case is a separate,
-- already-tracked follow-up (D-090) — not part of this migration.
create or replace function public.enforce_signal_requires_published_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_status text;
begin
  if new.publication_status = 'published' then
    select publication_status into v_company_status
    from public.companies
    where id = new.company_id;

    if v_company_status is distinct from 'published' then
      raise exception 'cannot publish signal %: company % is not published (status=%)',
        new.id, new.company_id, v_company_status;
    end if;
  end if;

  return new;
end;
$$;

create trigger signals_require_published_company
before insert or update on public.signals
for each row
execute function public.enforce_signal_requires_published_company();
