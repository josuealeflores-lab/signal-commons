-- Signal Commons — Milestone 4: reviewer auth, research queue, review
-- actions, publish gate.
--
-- Adds 3 tables: reviewer_profiles (reviewer identity/authorization source
-- of truth), research_items (the queue table), review_actions (append-only
-- audit trail). Adds reviewer-role RLS to the 5 existing content tables
-- (companies, signals, company_sectors, signal_evidence, source_documents)
-- without touching any existing anon policy. Adds two SECURITY DEFINER
-- RPCs: submit_review_action (the publish gate, granted to authenticated)
-- and derive_research_items_from_seed_signals (queue/anchor seeding,
-- granted to service_role only). Does not touch the Milestone 3 migrations
-- or seed/demo-data.json.

-- ============================================================
-- Tables
-- ============================================================

create table public.reviewer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.research_items (
  id text primary key,
  item_type text not null check (item_type in ('new_company', 'new_signal', 'entity_match', 'correction')),
  payload jsonb not null,
  status text not null check (status in ('pending', 'needs_more_evidence', 'approved', 'rejected', 'disputed')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  assigned_to uuid references public.reviewer_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  research_item_id text not null references public.research_items (id),
  reviewer_id uuid not null references public.reviewer_profiles (id),
  action text not null check (
    action in ('approve', 'edit_approve', 'reject', 'request_evidence', 'mark_disputed', 'reopen')
  ),
  before_state jsonb,
  after_state jsonb,
  reviewer_note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.reviewer_profiles enable row level security;
alter table public.research_items enable row level security;
alter table public.review_actions enable row level security;

-- reviewer_profiles: this is the authorization source of truth every other
-- reviewer policy below depends on via an EXISTS subquery. anon gets no
-- SELECT policy at all (no anonymous visibility into reviewer identities).
-- authenticated gets exactly one SELECT policy, scoped to the caller's own
-- row only — required so the EXISTS subqueries below (which run under the
-- calling role's own privileges, not this policy owner's) can actually see
-- a matching row when one exists. No INSERT/UPDATE/DELETE policy for
-- authenticated — only service_role (which bypasses RLS) can create or
-- deactivate a reviewer.
create policy reviewer_profiles_self_select on public.reviewer_profiles
for select to authenticated using (id = auth.uid() and is_active);

-- Reviewer SELECT policies on the 5 existing content tables — unconditional
-- on publication_status, so an active reviewer can see draft/in_review
-- content for review. Existing anon policies on these same 5 tables are
-- untouched. No reviewer UPDATE/INSERT/DELETE policy on any of them — the
-- only way publication_status/verification_status can change is through
-- submit_review_action, never a direct table write.
create policy companies_reviewer_select on public.companies
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

create policy signals_reviewer_select on public.signals
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

create policy company_sectors_reviewer_select on public.company_sectors
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

create policy signal_evidence_reviewer_select on public.signal_evidence
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

create policy source_documents_reviewer_select on public.source_documents
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

-- research_items: reviewer SELECT (all rows). No reviewer INSERT/UPDATE/
-- DELETE policy — rows are created only by
-- derive_research_items_from_seed_signals (service-role) and mutated only
-- by submit_review_action (both SECURITY DEFINER, bypass RLS on their own
-- writes).
create policy research_items_reviewer_select on public.research_items
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

-- review_actions: reviewer SELECT (all rows, for audit visibility). No
-- reviewer INSERT policy — a direct INSERT (even scoped to the caller's own
-- reviewer_id) could never be guaranteed atomic with the corresponding
-- research_items/target-row transition, which would let a review action be
-- recorded without the thing it claims to have done actually happening.
-- Every review_actions row is created solely as a side effect of a
-- successful submit_review_action call. No UPDATE/DELETE policy for any
-- role — append-only is a structural property, not a code convention.
create policy review_actions_reviewer_select on public.review_actions
for select to authenticated using (
  exists (select 1 from public.reviewer_profiles where id = auth.uid() and is_active)
);

-- ============================================================
-- submit_review_action RPC — the publish gate
-- ============================================================
--
-- Handles all 6 review actions atomically: approve, edit_approve, reject,
-- request_evidence, mark_disputed, reopen. The reviewer gate is the
-- function's literal first statement, before any research_items lookup,
-- item_type check, status check, or target-row access of any kind — a
-- non-reviewer or inactive-reviewer caller gets the identical "not an
-- active reviewer" exception no matter what p_research_item_id/p_action
-- they pass, so differing error behavior can never leak information about
-- which ids exist, their item_type, or their current status.
--
-- Granted to `authenticated` (not `service_role`) because the function
-- needs auth.uid() to resolve to the calling reviewer's own session —
-- SECURITY DEFINER changes whose privileges apply, not whose identity
-- auth.uid() reports.
--
-- Milestone 4 only builds item_type = 'new_signal' support: any other
-- item_type fails loudly and immediately (no companies-branch UPDATE logic
-- exists anywhere in this function).
--
-- edit_approve's editable-column allow-list is enforced here, not only in
-- the app's Zod schema — p_edited_fields is never applied via a dynamic
-- JSON-to-column mechanism, only via a static UPDATE naming exactly 4
-- columns (headline, summary, why_it_matters, evidence_strength).
--
-- approve/edit_approve require at least one linked signal_evidence row
-- before publishing (docs/DATA_MODEL.md invariant #1).
--
-- reopen only works from rejected/disputed, never approved — mark_disputed
-- is the sole path that can act on an approved item and the sole path that
-- ever un-publishes a signal.

create or replace function public.submit_review_action(
  p_research_item_id text,
  p_action text,
  p_reviewer_note text default null,
  p_edited_fields jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.research_items%rowtype;
  v_signal public.signals%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_new_item_status text;
  v_has_evidence boolean;
  v_edit_key text;
begin
  -- Step 1, unconditionally first: the reviewer gate.
  if not exists (
    select 1 from public.reviewer_profiles
    where id = auth.uid() and is_active
  ) then
    raise exception 'not an active reviewer';
  end if;

  -- Step 2: look up the research item.
  select * into v_item from public.research_items where id = p_research_item_id;
  if not found then
    raise exception 'research item not found: %', p_research_item_id;
  end if;

  -- Step 3: item_type gate (Milestone 4 scope).
  if v_item.item_type != 'new_signal' then
    raise exception 'unsupported item_type in Milestone 4: %', v_item.item_type;
  end if;

  -- Step 4: validate target_table (redundant given step 3, defense in depth).
  if (v_item.payload ->> 'target_table') != 'signals' then
    raise exception 'unsupported target_table: %', v_item.payload ->> 'target_table';
  end if;

  -- Step 5: validate the action against the per-action valid-current-status set.
  if p_action in ('approve', 'edit_approve', 'reject', 'request_evidence') then
    if v_item.status not in ('pending', 'needs_more_evidence') then
      raise exception '% is not valid from research_items.status = %', p_action, v_item.status;
    end if;
  elsif p_action = 'mark_disputed' then
    if v_item.status not in ('pending', 'needs_more_evidence', 'approved') then
      raise exception '% is not valid from research_items.status = %', p_action, v_item.status;
    end if;
  elsif p_action = 'reopen' then
    if v_item.status not in ('rejected', 'disputed') then
      raise exception '% is not valid from research_items.status = %', p_action, v_item.status;
    end if;
  else
    raise exception 'unknown action: %', p_action;
  end if;

  -- Step 6: look up the target signal and snapshot before_state.
  select * into v_signal from public.signals where id = (v_item.payload ->> 'target_id');
  if not found then
    raise exception 'target signal not found: %', v_item.payload ->> 'target_id';
  end if;
  v_before := to_jsonb(v_signal);

  -- edit_approve's column allow-list, enforced here (not only in Zod):
  -- reject any key outside the 4-column allow-list before applying anything.
  if p_action = 'edit_approve' and p_edited_fields is not null then
    for v_edit_key in select jsonb_object_keys(p_edited_fields) loop
      if v_edit_key not in ('headline', 'summary', 'why_it_matters', 'evidence_strength') then
        raise exception 'edit_approve does not permit editing column: %', v_edit_key;
      end if;
    end loop;
  end if;

  -- Publish-time evidence requirement for approve/edit_approve.
  if p_action in ('approve', 'edit_approve') then
    select exists (
      select 1 from public.signal_evidence se where se.signal_id = v_signal.id
    ) into v_has_evidence;
    if not v_has_evidence then
      raise exception 'cannot publish a signal with no linked evidence';
    end if;
  end if;

  -- Step 7: apply the transition.
  if p_action = 'approve' then
    update public.signals
    set publication_status = 'published', verification_status = 'verified', updated_at = now()
    where id = v_signal.id;
    v_new_item_status := 'approved';

  elsif p_action = 'edit_approve' then
    -- Static UPDATE naming exactly 4 editable columns — never a dynamic/
    -- generic JSON-to-column mechanism. Structural columns (id, company_id,
    -- publication_status, verification_status, is_demo, created_by_type,
    -- created_at) can never be written from p_edited_fields.
    update public.signals
    set headline = coalesce(p_edited_fields ->> 'headline', headline),
        summary = coalesce(p_edited_fields ->> 'summary', summary),
        why_it_matters = coalesce(p_edited_fields ->> 'why_it_matters', why_it_matters),
        evidence_strength = coalesce(p_edited_fields ->> 'evidence_strength', evidence_strength),
        publication_status = 'published',
        verification_status = 'verified',
        updated_at = now()
    where id = v_signal.id;
    v_new_item_status := 'approved';

  elsif p_action = 'reject' then
    update public.signals
    set publication_status = 'archived', verification_status = 'rejected', updated_at = now()
    where id = v_signal.id;
    v_new_item_status := 'rejected';

  elsif p_action = 'request_evidence' then
    v_new_item_status := 'needs_more_evidence';

  elsif p_action = 'mark_disputed' then
    -- Auto-unpublish: publication_status back to in_review so the disputed
    -- claim disappears from public anon reads immediately.
    update public.signals
    set publication_status = 'in_review', verification_status = 'disputed', updated_at = now()
    where id = v_signal.id;
    v_new_item_status := 'disputed';

  elsif p_action = 'reopen' then
    v_new_item_status := 'pending';
  end if;

  -- Re-select the signal to capture after_state (no-op re-select when the
  -- action didn't touch signals, but keeps this branch-independent).
  select * into v_signal from public.signals where id = v_signal.id;
  v_after := to_jsonb(v_signal);

  update public.research_items
  set status = v_new_item_status, updated_at = now()
  where id = v_item.id;

  insert into public.review_actions (research_item_id, reviewer_id, action, before_state, after_state, reviewer_note)
  values (v_item.id, auth.uid(), p_action, v_before, v_after, p_reviewer_note);
end;
$$;

revoke execute on function public.submit_review_action (text, text, text, jsonb) from public;
revoke execute on function public.submit_review_action (text, text, text, jsonb) from anon;
revoke execute on function public.submit_review_action (text, text, text, jsonb) from authenticated;
grant execute on function public.submit_review_action (text, text, text, jsonb) to authenticated;

-- ============================================================
-- derive_research_items_from_seed_signals RPC — queue/anchor seeding
-- ============================================================
--
-- service_role-only. Derives research_items from the current seed
-- signals: a pending item for each draft signal, an approved item plus one
-- idempotent baseline review_actions anchor for each already-published
-- signal. Never touches seed/demo-data.json or reseed_demo_data. Looks up
-- the baseline reviewer by email (passed as a parameter) and fails loudly
-- if that account doesn't exist yet, making "run db:seed:reviewer before
-- db:seed:queue" an enforced dependency, not just documentation.

create or replace function public.derive_research_items_from_seed_signals(p_baseline_reviewer_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baseline_reviewer_id uuid;
begin
  select id into v_baseline_reviewer_id from auth.users where email = p_baseline_reviewer_email;
  if v_baseline_reviewer_id is null then
    raise exception 'baseline reviewer not found for email %; run npm run db:seed:reviewer first', p_baseline_reviewer_email;
  end if;

  -- Pending research_items for draft signals.
  insert into public.research_items (id, item_type, payload, status, priority)
  select
    'ri-' || s.id,
    'new_signal',
    jsonb_build_object('target_table', 'signals', 'target_id', s.id),
    'pending',
    'medium'
  from public.signals s
  where s.publication_status = 'draft'
  on conflict (id) do nothing;

  -- Approved research_items for already-published signals.
  insert into public.research_items (id, item_type, payload, status, priority)
  select
    'ri-' || s.id,
    'new_signal',
    jsonb_build_object('target_table', 'signals', 'target_id', s.id),
    'approved',
    'medium'
  from public.signals s
  where s.publication_status = 'published'
  on conflict (id) do nothing;

  -- One idempotent baseline "approve" anchor per already-published signal's
  -- research item — guarded by NOT EXISTS since review_actions has no
  -- natural business key to ON CONFLICT against. Re-running this function
  -- inserts zero additional anchors once each published signal has one.
  insert into public.review_actions (research_item_id, reviewer_id, action, before_state, after_state, reviewer_note)
  select
    ri.id,
    v_baseline_reviewer_id,
    'approve',
    to_jsonb(s),
    to_jsonb(s),
    'Seeded demo baseline approval anchor for pre-existing published fixture; not a live review event.'
  from public.research_items ri
  join public.signals s on s.id = (ri.payload ->> 'target_id')
  where ri.item_type = 'new_signal'
    and ri.status = 'approved'
    and s.publication_status = 'published'
    and not exists (select 1 from public.review_actions ra where ra.research_item_id = ri.id);
end;
$$;

revoke execute on function public.derive_research_items_from_seed_signals (text) from public;
revoke execute on function public.derive_research_items_from_seed_signals (text) from anon;
revoke execute on function public.derive_research_items_from_seed_signals (text) from authenticated;
grant execute on function public.derive_research_items_from_seed_signals (text) to service_role;
