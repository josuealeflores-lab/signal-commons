-- Signal Commons — Milestone 3: fix reseed_demo_data's bare DELETE statements
--
-- The dev project's Postgres environment enforces "DELETE/UPDATE requires a
-- WHERE clause" as a safety restriction. reseed_demo_data's 7 intentional
-- "delete everything" statements had no WHERE clause at all, which this
-- restriction blocks outright. Fix: add a tautological `where true` to each
-- of the 7 DELETE statements — same semantics (delete every row), just
-- satisfies the literal "must have a WHERE clause" requirement.
--
-- Nothing else changes: same signature, same SECURITY DEFINER, same pinned
-- search_path, same schema-qualified references throughout, same
-- delete/insert/derive/verify logic and ordering, same RAISE EXCEPTION
-- checks. No tables, RLS policies, or seed data are touched by this
-- migration. The REVOKE/GRANT block is repeated here only as an idempotent
-- re-assertion (CREATE OR REPLACE FUNCTION preserves existing privileges on
-- the same function signature already — this does not change or reset
-- anything that wasn't already in place).

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
  -- Delete children-before-parents (FK-safe order). `where true` added to
  -- satisfy this environment's "DELETE requires a WHERE clause" safety
  -- restriction — semantics are unchanged (still deletes every row).
  delete from public.signal_evidence where true;
  delete from public.signals where true;
  delete from public.source_documents where true;
  delete from public.company_sectors where true;
  delete from public.companies where true;
  delete from public.sectors where true;
  delete from public.app_meta where true;

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

-- Idempotent re-assertion only — CREATE OR REPLACE FUNCTION does not reset
-- existing privileges on the same function signature, so this does not
-- change anything that wasn't already true; included so this migration
-- file is self-documenting about the intended security posture.
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
