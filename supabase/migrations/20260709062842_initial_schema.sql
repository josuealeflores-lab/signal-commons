-- Signal Commons — Milestone 3: initial schema, RLS, and reseed_demo_data RPC
--
-- 7 tables: sectors, companies, company_sectors, source_documents, signals,
-- signal_evidence, app_meta. Primary keys preserve the existing string ids
-- from seed/demo-data.json (docs/DECISIONS.md D-040) — no UUIDs anywhere.
--
-- RLS: anon/public gets SELECT-only policies on published/public content;
-- every other operation is default-denied once RLS is enabled with no
-- matching policy (docs/DECISIONS.md D-041).

create table public.sectors (
  id text primary key,
  slug text unique not null,
  name text not null,
  description text,
  display_order int not null,
  icon_key text not null,
  created_at timestamptz not null default now()
);

create table public.companies (
  id text primary key,
  slug text unique not null,
  name text not null,
  legal_name text,
  website_url text,
  headquarters text,
  founded_year int,
  summary text not null,
  why_it_matters text not null,
  company_type text not null,
  stage text not null,
  is_demo boolean not null default true,
  publication_status text not null check (publication_status in ('draft', 'in_review', 'published', 'archived')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_sectors (
  company_id text not null references public.companies (id),
  sector_id text not null references public.sectors (id),
  is_primary boolean not null default true,
  primary key (company_id, sector_id)
);

-- Enforces "at most one" primary sector per company at the DB level.
-- "Exactly one for every published company" is a seed-validation +
-- test:db guarantee (docs/DECISIONS.md D-041), not expressible as a plain
-- unique index (which can't enforce a minimum-cardinality constraint).
create unique index company_sectors_one_primary_idx on public.company_sectors (company_id)
where is_primary;

create table public.source_documents (
  id text primary key,
  canonical_url text not null,
  source_title text not null,
  publisher text not null,
  source_type text not null,
  source_tier text not null,
  event_date timestamptz,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  content_hash text,
  excerpt text,
  storage_path text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.signals (
  id text primary key,
  company_id text not null references public.companies (id),
  signal_type text not null,
  headline text not null,
  summary text not null,
  why_it_matters text not null,
  occurred_at timestamptz,
  detected_at timestamptz not null,
  evidence_strength text not null check (evidence_strength in ('low', 'medium', 'high')),
  verification_status text not null check (
    verification_status in ('unverified', 'partially_verified', 'verified', 'disputed', 'rejected')
  ),
  publication_status text not null check (publication_status in ('draft', 'in_review', 'published', 'archived')),
  is_demo boolean not null default true,
  created_by_type text not null check (created_by_type in ('human', 'ai', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.signal_evidence (
  -- Deterministic id (`${signal.id}-ev-${index}`), not a random UUID, so
  -- re-seeding never produces a duplicate logical row (docs/DECISIONS.md D-040).
  id text primary key,
  signal_id text not null references public.signals (id),
  source_document_id text not null references public.source_documents (id),
  support_type text not null check (support_type in ('supports', 'contradicts', 'context_only')),
  supporting_passage text,
  claim_type text not null check (
    claim_type in ('official_record', 'company_claim', 'independent_report', 'analysis', 'community_report')
  ),
  created_at timestamptz not null default now()
);

-- Single-row table replacing the JSON `meta` object (docs/DECISIONS.md D-045).
create table public.app_meta (
  id int primary key default 1 check (id = 1),
  dataset_name text,
  is_demo boolean not null,
  warning text,
  generated_for text,
  as_of date not null
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.sectors enable row level security;
alter table public.companies enable row level security;
alter table public.company_sectors enable row level security;
alter table public.source_documents enable row level security;
alter table public.signals enable row level security;
alter table public.signal_evidence enable row level security;
alter table public.app_meta enable row level security;

-- sectors: no publication concept of their own, all rows public.
create policy sectors_public_select on public.sectors for select using (true);

-- companies: published only. Public regardless of any signal's status
-- (docs/DECISIONS.md D-021's asymmetry).
create policy companies_public_select on public.companies for select using (publication_status = 'published');

-- company_sectors: gated by the *company's own* publication_status, not
-- any signal's (preserves D-021's asymmetry at the database level).
create policy company_sectors_public_select on public.company_sectors for select using (
  exists (
    select 1
    from public.companies c
    where c.id = company_sectors.company_id
      and c.publication_status = 'published'
  )
);

-- signals: published only.
create policy signals_public_select on public.signals for select using (publication_status = 'published');

-- signal_evidence: gated by the *linked signal's* publication_status.
create policy signal_evidence_public_select on public.signal_evidence for select using (
  exists (
    select 1
    from public.signals s
    where s.id = signal_evidence.signal_id
      and s.publication_status = 'published'
  )
);

-- source_documents: selectable only if referenced by at least one
-- published signal's evidence — deliberately not a blanket "all public"
-- policy, since a draft-linked source document must not be enumerable
-- even though its signal correctly 404s in the app.
create policy source_documents_public_select on public.source_documents for select using (
  exists (
    select 1
    from public.signal_evidence se
    join public.signals s on s.id = se.signal_id
    where se.source_document_id = source_documents.id
      and s.publication_status = 'published'
  )
);

-- app_meta: single row, unconditionally public (non-sensitive dataset
-- labeling metadata) so getMeta() works through the same anon client as
-- every other public read.
create policy app_meta_public_select on public.app_meta for select using (true);

-- No INSERT/UPDATE/DELETE policies exist for anon on any of the 7 tables.
-- Once RLS is enabled, any command with no matching policy is denied by
-- default — this alone satisfies "anonymous mutation attempts fail."

-- Reviewer-role RLS is deferred to Milestone 4 (docs/DECISIONS.md D-042).

-- ============================================================
-- reseed_demo_data RPC (docs/DECISIONS.md D-046)
-- ============================================================
--
-- Given the entire validated demo dataset as one JSONB argument, performs
-- an atomic delete/reinsert/derive/verify entirely inside Postgres.
-- Atomicity is inherent to one Postgres function call rolling back
-- entirely if RAISE EXCEPTION fires anywhere inside it — not a claim that
-- supabase-js table methods are transactional (they are not); no
-- client-side transaction is attempted.
--
-- SECURITY DEFINER means this runs with the owner's elevated privileges
-- regardless of caller, which is exactly why EXECUTE is revoked from
-- PUBLIC/anon/authenticated and granted only to service_role below — that
-- REVOKE/GRANT is the actual access-control gate, not RLS (which this
-- function's own operations bypass by virtue of running as the owner).
-- search_path is pinned to `public` and every table reference is
-- schema-qualified, to avoid SECURITY DEFINER search-path hijacking.

create or replace function public.reseed_demo_data(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sectors_count int;
  v_companies_count int;
  v_signals_count int;
  v_published_count int;
  v_draft_count int;
  v_source_documents_count int;
  v_signal_evidence_count int;
  v_primary_rows_count int;
  v_multi_primary_count int;
  v_missing_primary_count int;
begin
  -- Delete children-before-parents (FK-safe order).
  delete from public.signal_evidence;
  delete from public.signals;
  delete from public.source_documents;
  delete from public.company_sectors;
  delete from public.companies;
  delete from public.sectors;
  delete from public.app_meta;

  -- Re-insert parents-before-children.
  insert into public.app_meta (id, dataset_name, is_demo, warning, generated_for, as_of)
  select
    1,
    payload -> 'meta' ->> 'dataset_name',
    (payload -> 'meta' ->> 'is_demo')::boolean,
    payload -> 'meta' ->> 'warning',
    payload -> 'meta' ->> 'generated_for',
    (payload -> 'meta' ->> 'as_of')::date;

  insert into public.sectors (id, slug, name, description, display_order, icon_key)
  select
    s ->> 'slug',
    s ->> 'slug',
    s ->> 'name',
    null,
    (s ->> 'display_order')::int,
    s ->> 'icon_key'
  from jsonb_array_elements(payload -> 'sectors') as s;

  insert into public.companies (
    id, slug, name, legal_name, website_url, headquarters, founded_year,
    summary, why_it_matters, company_type, stage, is_demo, publication_status, last_reviewed_at
  )
  select
    c ->> 'id',
    c ->> 'slug',
    c ->> 'name',
    null,
    null,
    null,
    null,
    c ->> 'summary',
    c ->> 'why_it_matters',
    c ->> 'company_type',
    c ->> 'stage',
    (c ->> 'is_demo')::boolean,
    c ->> 'publication_status',
    null
  from jsonb_array_elements(payload -> 'companies') as c;

  -- Derived from companies[].primary_sector_slug.
  insert into public.company_sectors (company_id, sector_id, is_primary)
  select
    c ->> 'id',
    c ->> 'primary_sector_slug',
    true
  from jsonb_array_elements(payload -> 'companies') as c;

  insert into public.source_documents (
    id, canonical_url, source_title, publisher, source_type, source_tier,
    event_date, published_at, retrieved_at, content_hash, excerpt, storage_path, is_demo
  )
  select
    d ->> 'id',
    d ->> 'canonical_url',
    d ->> 'source_title',
    d ->> 'publisher',
    d ->> 'source_type',
    d ->> 'source_tier',
    null,
    (d ->> 'published_at')::timestamptz,
    (d ->> 'retrieved_at')::timestamptz,
    null,
    null,
    null,
    (d ->> 'is_demo')::boolean
  from jsonb_array_elements(payload -> 'source_documents') as d;

  insert into public.signals (
    id, company_id, signal_type, headline, summary, why_it_matters,
    occurred_at, detected_at, evidence_strength, verification_status, publication_status,
    is_demo, created_by_type
  )
  select
    sig ->> 'id',
    sig ->> 'company_id',
    sig ->> 'signal_type',
    sig ->> 'headline',
    sig ->> 'summary',
    sig ->> 'why_it_matters',
    (sig ->> 'occurred_at')::timestamptz,
    (sig ->> 'detected_at')::timestamptz,
    sig ->> 'evidence_strength',
    sig ->> 'verification_status',
    sig ->> 'publication_status',
    (sig ->> 'is_demo')::boolean,
    sig ->> 'created_by_type'
  from jsonb_array_elements(payload -> 'signals') as sig;

  -- Derived from each signal's embedded evidence[] array, with a
  -- deterministic id per row (signal id + 0-based position).
  insert into public.signal_evidence (id, signal_id, source_document_id, support_type, supporting_passage, claim_type)
  select
    (sig ->> 'id') || '-ev-' || (ev.ordinality - 1)::text,
    sig ->> 'id',
    ev.value ->> 'source_document_id',
    ev.value ->> 'support_type',
    ev.value ->> 'supporting_passage',
    ev.value ->> 'claim_type'
  from jsonb_array_elements(payload -> 'signals') as sig,
    jsonb_array_elements(sig -> 'evidence') with ordinality as ev (value, ordinality);

  -- Post-seed verification counts — RAISE EXCEPTION on any mismatch,
  -- which rolls back everything above (delete + inserts) atomically.
  select count(*) into v_sectors_count from public.sectors;
  select count(*) into v_companies_count from public.companies;
  select count(*) into v_signals_count from public.signals;
  select count(*) into v_published_count from public.signals where publication_status = 'published';
  select count(*) into v_draft_count from public.signals where publication_status = 'draft';
  select count(*) into v_source_documents_count from public.source_documents;
  select count(*) into v_signal_evidence_count from public.signal_evidence;
  select count(*) into v_primary_rows_count from public.company_sectors where is_primary;

  select count(*) into v_multi_primary_count from (
    select company_id
    from public.company_sectors
    where is_primary
    group by company_id
    having count(*) > 1
  ) dup;

  select count(*) into v_missing_primary_count
  from public.companies c
  where not exists (
    select 1 from public.company_sectors cs
    where cs.company_id = c.id and cs.is_primary
  );

  if v_sectors_count != 7 then
    raise exception 'reseed_demo_data verification failed: expected 7 sectors, got %', v_sectors_count;
  end if;
  if v_companies_count != 21 then
    raise exception 'reseed_demo_data verification failed: expected 21 companies, got %', v_companies_count;
  end if;
  if v_signals_count != 21 then
    raise exception 'reseed_demo_data verification failed: expected 21 signals, got %', v_signals_count;
  end if;
  if v_published_count != 14 then
    raise exception 'reseed_demo_data verification failed: expected 14 published signals, got %', v_published_count;
  end if;
  if v_draft_count != 7 then
    raise exception 'reseed_demo_data verification failed: expected 7 draft signals, got %', v_draft_count;
  end if;
  if v_source_documents_count != 21 then
    raise exception 'reseed_demo_data verification failed: expected 21 source_documents, got %', v_source_documents_count;
  end if;
  if v_signal_evidence_count != 21 then
    raise exception 'reseed_demo_data verification failed: expected 21 signal_evidence rows, got %', v_signal_evidence_count;
  end if;
  if v_primary_rows_count != 21 then
    raise exception 'reseed_demo_data verification failed: expected 21 primary company_sectors rows, got %', v_primary_rows_count;
  end if;
  if v_multi_primary_count != 0 then
    raise exception 'reseed_demo_data verification failed: % companies have more than one primary sector', v_multi_primary_count;
  end if;
  if v_missing_primary_count != 0 then
    raise exception 'reseed_demo_data verification failed: % companies have zero primary sectors', v_missing_primary_count;
  end if;
end;
$$;

revoke execute on function public.reseed_demo_data (jsonb)
from
public;

revoke execute on function public.reseed_demo_data (jsonb)
from
anon;

revoke execute on function public.reseed_demo_data (jsonb)
from
authenticated;

grant
execute on function public.reseed_demo_data (jsonb) to service_role;
