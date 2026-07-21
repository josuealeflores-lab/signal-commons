-- Signal Commons — Milestone 11 Phase B: true idempotency keys and
-- per-reviewer rate limits on the two reviewer mutation RPCs.
--
-- STATUS: Cowork/Opus 4.8 High completed the required migration-first
-- review and returned PASS WITH NOTES, with one required fix (the custom
-- SQLSTATE codes below were changed from P0002/P0003/P0004 -- which
-- collide with predefined PL/pgSQL condition codes -- to the dedicated,
-- collision-free SC001-SC005 class). This file is applied to the dev/CI
-- Supabase project only, alongside the coordinated app/client/test updates
-- in the same change -- never to production, which remains untouched and
-- separately gated.
--
-- docs/DECISIONS.md D-100 is the full source of truth for this design
-- (the two-phase split, the five required idempotency invariants, the
-- replay/race-condition/rate-limit-ordering rules). This migration
-- implements exactly what D-100 specifies -- nothing more.
--
-- ============================================================
-- Scope
-- ============================================================
-- In scope: public.submit_review_action, public.record_copilot_analysis --
-- the only two reviewer-workflow mutation RPCs that exist today.
--
-- Out of scope, deliberately:
-- - public.commit_usaspending_candidate (supabase/migrations/
--   20260715090000_m6c_commit_usaspending_candidate.sql) -- connector/
--   service-role/CLI-scoped, never called from any reviewer UI action, and
--   already has its own deterministic-id-based idempotency from M6C. Its
--   operational hardening belongs to M13 ("Real Connector Operations"),
--   not M11.
-- - The queue digest (M8A) -- it persists nothing at all (no table, no
--   RPC write of any kind), so there is nothing to key an idempotency or
--   rate-limit check against. Its own run-logging is an M12+ decision, not
--   M11's to make.
-- - Production reviewer activation, production AI activation,
--   ANTHROPIC_API_KEY provisioning, connector writes, real-data
--   publishing -- all separately gated, all untouched by this migration.
--
-- ============================================================
-- Why idempotency_keys has no authenticated/anon direct policies
-- ============================================================
-- RLS is enabled below with zero policies for `authenticated` or `anon` --
-- the same "RLS-enabled, no matching policy, default-deny" idiom this
-- schema already uses for review_actions and copilot_analyses (neither of
-- those tables has an authenticated INSERT/UPDATE/DELETE policy either).
-- This table is touched only from inside the two SECURITY DEFINER
-- functions below; SECURITY DEFINER is what lets those functions read/
-- write it despite the calling role having no policy of its own. No
-- explicit REVOKE ON TABLE statement is added, matching the precedent
-- already set by every other reviewer-facing table in this schema (RLS
-- alone is the established deny mechanism here, not table-level GRANT/
-- REVOKE, which this schema has never used for a content table).
-- service_role bypasses RLS at the Postgres/platform level as usual, but
-- service_role is never the intended caller of either RPC in normal
-- operation -- exactly the same caveat already documented on
-- record_copilot_analysis (M7).
--
-- ============================================================
-- Payload hashing: md5(), not digest() -- a deliberate, documented tradeoff
-- ============================================================
-- No migration in this project's history runs `create extension pgcrypto`
-- (confirmed by direct inspection of every file under supabase/migrations/
-- before drafting this one) -- `digest()`, which would give a stronger
-- sha256 hash, is a pgcrypto function, not a core Postgres builtin, so this
-- migration cannot assume it is available without introducing an
-- extension this history has never declared. `gen_random_uuid()` (already
-- used by review_actions.id and copilot_analyses.id) is NOT the same
-- concern -- it has been part of core Postgres (no extension required)
-- since Postgres 13, unlike `digest()`. This migration therefore uses
-- `md5()`, a core Postgres builtin requiring no extension at all. The
-- tradeoff: md5 is not collision-resistant against a determined adversary
-- deliberately searching for a colliding payload. That threat does not
-- apply here -- payload_hash's only job is to detect an accidental or
-- buggy client reusing the same idempotency key for a genuinely different
-- request; it is not a security boundary on its own (the reviewer-active
-- gate and the reviewer_id/endpoint checks below are), and every value it
-- hashes is a small, structured, already-server-validated set of RPC
-- inputs, not attacker-controlled binary data. If pgcrypto is confirmed
-- available in a later milestone, this could be upgraded to
-- `digest(..., 'sha256')` without changing anything about the surrounding
-- design.
--
-- ============================================================
-- Why replay-before-rate-limit ordering matters
-- ============================================================
-- The idempotency replay check runs strictly before the rate-limit check
-- in both functions below. A safe replay (matching key + payload +
-- reviewer + endpoint) performs no new mutation at all -- it is a client
-- retrying a request it already successfully made, most commonly after a
-- network blip, not a new action. Counting it against the rate cap would
-- penalize normal retry behavior for something that never actually mutated
-- anything a second time. The rate-limit check therefore only ever runs on
-- the new-mutation path -- i.e., only once the idempotency-key INSERT
-- below has confirmed this is genuinely the first attempt with this key.
--
-- ============================================================
-- Why failure paths roll back the idempotency-key insert automatically
-- ============================================================
-- No explicit rollback code exists anywhere below, and none is needed:
-- every RPC call in Postgres executes as a single transaction (or as part
-- of whatever transaction the caller is in), and an unhandled `raise
-- exception` unwinds and rolls back everything that transaction has done
-- so far -- including the idempotency_keys row this same function inserted
-- moments earlier. This is why a rate-limit rejection, a "research item
-- not found," an evidence-requirement failure, or any other business-logic
-- exception all correctly leave zero trace in idempotency_keys: Postgres's
-- own transaction semantics provide Required invariant D for free, without
-- a BEGIN/EXCEPTION block anywhere in either function.
--
-- ============================================================
-- Race-condition design (accepted per D-100; not changed here)
-- ============================================================
-- `insert into idempotency_keys (...) values (...) on conflict (key) do
-- nothing` is the sole concurrency-control mechanism -- no
-- `select ... for update` and no Postgres advisory lock is used anywhere
-- in this migration. Two near-simultaneous calls carrying the identical
-- key cannot both mutate: Postgres serializes concurrent inserts on the
-- same primary key, so the second caller's INSERT blocks at the row level
-- until the first caller's entire transaction commits or rolls back, and
-- only then evaluates the ON CONFLICT branch -- by which point the first
-- transaction's outcome (a fully-populated response row, on success; no
-- row at all, on failure/rollback) is exactly what the second caller
-- observes. PL/pgSQL's `FOUND` variable (set immediately after the INSERT
-- statement) is the sole first-vs-replay signal used below -- never a
-- `select`-then-`insert` pattern, which would reintroduce the exact
-- check-then-act race this design exists to prevent (Required invariant B).
--
-- ============================================================
-- Custom SQLSTATE codes: SC001-SC005, never P0002/P0003/P0004
-- ============================================================
-- Every idempotency/rate-limit exception below raises one of five
-- dedicated, collision-free custom SQLSTATEs in the SC00x class (Cowork/
-- Opus-required fix, post migration-first review): SC001 (idempotency
-- conflict -- same key, different payload), SC002 (idempotency endpoint
-- mismatch -- same key, different endpoint), SC003 (idempotency
-- cross-reviewer replay -- same key, different reviewer), SC004 (rate
-- limit exceeded), SC005 (idempotency incomplete/in-progress replay --
-- committed key found with a still-null response). The initial draft used
-- P0002/P0003/P0004, which collide with predefined PL/pgSQL condition
-- codes (P0001-P0004 are reserved for RAISE's own built-in
-- raise_exception/no_data_found/too_many_rows/assert_failure conditions) --
-- reusing them here would make this app-domain error indistinguishable
-- from an unrelated PL/pgSQL built-in condition to any caller pattern-
-- matching on SQLSTATE. SC00x is a Signal-Commons-specific class with no
-- predefined meaning anywhere in Postgres, so it cannot collide with
-- anything current or future. Both submit_review_action and
-- record_copilot_analysis use the exact same five-code mapping,
-- consistently.

-- ============================================================
-- idempotency_keys table
-- ============================================================

create table public.idempotency_keys (
  key uuid primary key,
  reviewer_id uuid not null references public.reviewer_profiles (id),
  endpoint text not null check (endpoint in ('submit_review_action', 'record_copilot_analysis')),
  payload_hash text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

comment on table public.idempotency_keys is
  'M11 Phase B (docs/DECISIONS.md D-100): true idempotency-key storage for submit_review_action and record_copilot_analysis. response is null while a request is still being processed inside its own transaction and is populated only once that same transaction''s mutation succeeds -- a replay that ever observes a null response has raced a still-in-flight request and must be treated as "in progress," never as a successful empty result. Retention is 24 hours by policy; no scheduled cleanup job exists in M11 (see docs/DEPLOYMENT.md''s periodic manual cleanup note) -- rows are not deleted by this migration or by either RPC below. Excluded from this table entirely: commit_usaspending_candidate (connector/service-role/CLI-scoped, already has deterministic-id idempotency from M6C) and the queue digest (M8A persists nothing at all; its own run-logging is an M12+ decision).';

comment on column public.idempotency_keys.response is
  'Null only while the owning transaction''s mutation is still in progress; populated with the RPC''s exact jsonb return value in the same transaction, immediately before that transaction commits. A concurrent caller in a different transaction can only ever observe this column fully populated or the row entirely absent -- never transiently null -- because Postgres does not make an uncommitted transaction''s writes visible to others.';

comment on column public.idempotency_keys.payload_hash is
  'Server-computed md5() hash of the calling RPC''s actual mutation inputs (excluding the idempotency key parameter itself) -- never a client-supplied value. Used only to detect a key being reused for a genuinely different request, not as a security boundary on its own. See this migration''s header comment for why md5() (not pgcrypto''s digest()) was chosen.';

alter table public.idempotency_keys enable row level security;

-- ============================================================
-- submit_review_action -- add idempotency + rate limiting
-- ============================================================
--
-- Behavior preserved exactly from the M6D reconciliation version
-- (supabase/migrations/20260716070000_m6d_submit_review_action_connector_reconciliation.sql):
-- the reviewer-active gate as the unconditional first statement; the
-- item_type/target_table gates; the per-action status-validity table; the
-- edit_approve column allow-list; the publish-time evidence requirement;
-- the company-published-branching logic (publish vs. approved-but-private);
-- the mark_disputed auto-unpublish/never-mislabel-never-public logic; the
-- enriched before/after_state snapshots; the review_actions insert; the
-- small non-sensitive jsonb return contract; SECURITY DEFINER; `set
-- search_path = public`; the authenticated-only grant. Every one of those
-- is unchanged below -- only the idempotency/rate-limit wrapper around
-- them, and one new required parameter, are new.
--
-- New required parameter p_idempotency_key is positioned before the two
-- existing defaulted parameters (p_reviewer_note, p_edited_fields) --
-- Postgres requires defaulted parameters to trail in a function's
-- parameter list. This has no effect on any real caller: every call to
-- this RPC (the app's Server Actions, every integration test) already
-- calls it with named parameters via PostgREST, never positionally, so
-- parameter order in this definition doesn't change how it's invoked.
--
-- p_idempotency_key has no default, so every prior call site would fail
-- against this new signature -- src/lib/review/actions.ts and every
-- tests/integration/*.test.ts call have been updated in this same change
-- to generate and pass a real key, coordinated with this migration's
-- application to dev/CI (never applied in isolation, per Cowork/Opus's
-- review notes).

drop function if exists public.submit_review_action (text, text, text, jsonb);

create function public.submit_review_action(
  p_research_item_id text,
  p_action text,
  p_idempotency_key uuid,
  p_reviewer_note text default null,
  p_edited_fields jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.research_items%rowtype;
  v_signal public.signals%rowtype;
  v_company public.companies%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_new_item_status text;
  v_has_evidence boolean;
  v_edit_key text;
  v_company_published boolean;
  v_signal_was_published boolean;
  v_published boolean;
  v_payload_hash text;
  v_existing_reviewer_id uuid;
  v_existing_endpoint text;
  v_existing_payload_hash text;
  v_existing_response jsonb;
  v_recent_count int;
  v_result jsonb;
begin
  -- Step 1, unconditionally first: the reviewer gate. Unchanged from M6D.
  if not exists (
    select 1 from public.reviewer_profiles
    where id = auth.uid() and is_active
  ) then
    raise exception 'not an active reviewer';
  end if;

  -- Step 2: server-computed payload hash from the actual mutation inputs
  -- only -- never includes p_idempotency_key itself, and never trusts a
  -- client-supplied hash (there is no such parameter).
  v_payload_hash := md5(
    jsonb_build_object(
      'p_research_item_id', p_research_item_id,
      'p_action', p_action,
      'p_reviewer_note', p_reviewer_note,
      'p_edited_fields', p_edited_fields
    )::text
  );

  -- Step 3: idempotency insert / first-vs-replay detection. FOUND is set
  -- by this INSERT statement itself (Required invariant B) -- true if this
  -- call's row was actually inserted, false if ON CONFLICT DO NOTHING
  -- skipped it because the key already existed.
  insert into public.idempotency_keys (key, reviewer_id, endpoint, payload_hash)
  values (p_idempotency_key, auth.uid(), 'submit_review_action', v_payload_hash)
  on conflict (key) do nothing;

  if not found then
    -- Step 4: replay path. Look up the existing row and apply all three
    -- replay security checks (Required invariant E) before ever returning
    -- anything derived from it.
    select reviewer_id, endpoint, payload_hash, response
    into v_existing_reviewer_id, v_existing_endpoint, v_existing_payload_hash, v_existing_response
    from public.idempotency_keys
    where key = p_idempotency_key;

    if v_existing_reviewer_id != auth.uid() then
      -- Different reviewer reusing the same key -- reject outright. Never
      -- return this row's response under any circumstance; it is not this
      -- caller's response to see.
      raise exception 'idempotency key belongs to a different reviewer' using errcode = 'SC003';
    end if;

    if v_existing_endpoint != 'submit_review_action' then
      raise exception 'idempotency key was already used for a different endpoint' using errcode = 'SC002';
    end if;

    if v_existing_payload_hash != v_payload_hash then
      raise exception 'idempotency key already used for a different request' using errcode = 'SC001';
    end if;

    if v_existing_response is null then
      -- Required invariant C's defensive guard: a still-in-flight
      -- concurrent call owns this key right now. Never treat a null
      -- response as a successful empty result.
      raise exception 'request with this idempotency key is still being processed' using errcode = 'SC005';
    end if;

    return v_existing_response;
  end if;

  -- Step 5: rate-limit check -- new-mutation path only. A safe replay
  -- above already returned before reaching here, so it is never counted
  -- against this cap. 20 actions/minute is far above any plausible
  -- single-reviewer manual pace (docs/DECISIONS.md D-100).
  select count(*) into v_recent_count
  from public.review_actions
  where reviewer_id = auth.uid() and created_at > now() - interval '1 minute';

  if v_recent_count >= 20 then
    -- Step 6: this exception rolls back the entire transaction, including
    -- the idempotency_keys row inserted in Step 3 above (Required
    -- invariant D) -- a rate-limited attempt is never memoized, so a retry
    -- with the same key gets a fresh new-mutation attempt, not a cached
    -- failure.
    raise exception 'rate limit exceeded: no more than 20 actions per minute' using errcode = 'SC004';
  end if;

  -- Step 7: existing mutation logic, entirely unchanged from M6D below
  -- this point (through the review_actions insert).

  -- Look up the research item. Unchanged.
  select * into v_item from public.research_items where id = p_research_item_id;
  if not found then
    raise exception 'research item not found: %', p_research_item_id;
  end if;

  -- item_type gate (Milestone 4/6D scope). Unchanged.
  if v_item.item_type != 'new_signal' then
    raise exception 'unsupported item_type in Milestone 4: %', v_item.item_type;
  end if;

  -- Validate target_table (redundant given the item_type gate, defense in depth). Unchanged.
  if (v_item.payload ->> 'target_table') != 'signals' then
    raise exception 'unsupported target_table: %', v_item.payload ->> 'target_table';
  end if;

  -- Validate the action against the per-action valid-current-status set. Unchanged.
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

  -- Look up the target signal and its linked company. Unchanged.
  select * into v_signal from public.signals where id = (v_item.payload ->> 'target_id');
  if not found then
    raise exception 'target signal not found: %', v_item.payload ->> 'target_id';
  end if;

  select * into v_company from public.companies where id = v_signal.company_id;
  if not found then
    raise exception 'linked company not found: %', v_signal.company_id;
  end if;

  v_signal_was_published := (v_signal.publication_status = 'published');
  v_company_published := (v_company.publication_status = 'published');

  -- before_state snapshot, enriched with company publication_status/is_demo. Unchanged.
  v_before := to_jsonb(v_signal) || jsonb_build_object(
    'company_publication_status', v_company.publication_status,
    'company_is_demo', v_company.is_demo
  );

  -- edit_approve's column allow-list, enforced here (not only in Zod). Unchanged.
  if p_action = 'edit_approve' and p_edited_fields is not null then
    for v_edit_key in select jsonb_object_keys(p_edited_fields) loop
      if v_edit_key not in ('headline', 'summary', 'why_it_matters', 'evidence_strength') then
        raise exception 'edit_approve does not permit editing column: %', v_edit_key;
      end if;
    end loop;
  end if;

  -- Evidence requirement for approve/edit_approve. Unchanged.
  if p_action in ('approve', 'edit_approve') then
    select exists (
      select 1 from public.signal_evidence se where se.signal_id = v_signal.id
    ) into v_has_evidence;
    if not v_has_evidence then
      raise exception 'cannot approve a signal with no linked evidence';
    end if;
  end if;

  -- Apply the transition. Unchanged.
  v_published := false;

  if p_action = 'approve' then
    if v_company_published then
      update public.signals
      set publication_status = 'published', verification_status = 'verified', updated_at = now()
      where id = v_signal.id;
      v_published := true;
    else
      update public.signals
      set verification_status = 'verified', updated_at = now()
      where id = v_signal.id;
      v_published := false;
    end if;
    v_new_item_status := 'approved';

  elsif p_action = 'edit_approve' then
    if v_company_published then
      update public.signals
      set headline = coalesce(p_edited_fields ->> 'headline', headline),
          summary = coalesce(p_edited_fields ->> 'summary', summary),
          why_it_matters = coalesce(p_edited_fields ->> 'why_it_matters', why_it_matters),
          evidence_strength = coalesce(p_edited_fields ->> 'evidence_strength', evidence_strength),
          publication_status = 'published',
          verification_status = 'verified',
          updated_at = now()
      where id = v_signal.id;
      v_published := true;
    else
      update public.signals
      set headline = coalesce(p_edited_fields ->> 'headline', headline),
          summary = coalesce(p_edited_fields ->> 'summary', summary),
          why_it_matters = coalesce(p_edited_fields ->> 'why_it_matters', why_it_matters),
          evidence_strength = coalesce(p_edited_fields ->> 'evidence_strength', evidence_strength),
          verification_status = 'verified',
          updated_at = now()
      where id = v_signal.id;
      v_published := false;
    end if;
    v_new_item_status := 'approved';

  elsif p_action = 'reject' then
    update public.signals
    set publication_status = 'archived', verification_status = 'rejected', updated_at = now()
    where id = v_signal.id;
    v_new_item_status := 'rejected';
    v_published := false;

  elsif p_action = 'request_evidence' then
    v_new_item_status := 'needs_more_evidence';
    v_published := false;

  elsif p_action = 'mark_disputed' then
    if v_signal_was_published then
      update public.signals
      set publication_status = 'in_review', verification_status = 'disputed', updated_at = now()
      where id = v_signal.id;
    else
      update public.signals
      set verification_status = 'disputed', updated_at = now()
      where id = v_signal.id;
    end if;
    v_new_item_status := 'disputed';
    v_published := false;

  elsif p_action = 'reopen' then
    v_new_item_status := 'pending';
    v_published := false;
  end if;

  -- Re-select the signal and company to capture after_state. Unchanged.
  select * into v_signal from public.signals where id = v_signal.id;
  select * into v_company from public.companies where id = v_signal.company_id;

  v_after := to_jsonb(v_signal) || jsonb_build_object(
    'company_publication_status', v_company.publication_status,
    'company_is_demo', v_company.is_demo
  );

  update public.research_items
  set status = v_new_item_status, updated_at = now()
  where id = v_item.id;

  insert into public.review_actions (research_item_id, reviewer_id, action, before_state, after_state, reviewer_note)
  values (v_item.id, auth.uid(), p_action, v_before, v_after, p_reviewer_note);

  -- Small, non-sensitive jsonb result -- identical shape to the M6D
  -- version. Held in v_result (not returned directly) so it can also be
  -- stored into idempotency_keys.response in Step 8 below, in the same
  -- transaction as the mutation above (Required invariant A/C).
  v_result := jsonb_build_object(
    'action', p_action,
    'research_item_id', v_item.id,
    'research_item_status', v_new_item_status,
    'signal_id', v_signal.id,
    'signal_publication_status', v_signal.publication_status,
    'signal_verification_status', v_signal.verification_status,
    'company_id', v_company.id,
    'company_publication_status', v_company.publication_status,
    'published', v_published,
    'private_approval', (p_action in ('approve', 'edit_approve') and not v_published)
  );

  -- Step 8: store the exact response in the same transaction as the
  -- mutation above.
  update public.idempotency_keys set response = v_result where key = p_idempotency_key;

  -- Step 9: return it.
  return v_result;
end;
$$;

comment on function public.submit_review_action (text, text, uuid, text, jsonb) is
  'M6D behavior unchanged: approve/edit_approve only publish the linked signal if its company is already published; otherwise the signal is verified/approved but stays draft/private. mark_disputed only moves publication_status to in_review if the signal was actually published. M11 Phase B (docs/DECISIONS.md D-100) adds: a required p_idempotency_key parameter, true idempotency-key semantics (safe replay, conflicting-replay rejection, cross-reviewer replay rejection, in-progress-replay guard), and a 20-per-minute-per-reviewer rate limit on the new-mutation path only. Returns a small non-sensitive jsonb status object. service_role bypasses this entirely; authenticated reviewers only.';

revoke execute on function public.submit_review_action (text, text, uuid, text, jsonb) from public;
revoke execute on function public.submit_review_action (text, text, uuid, text, jsonb) from anon;
revoke execute on function public.submit_review_action (text, text, uuid, text, jsonb) from authenticated;
grant execute on function public.submit_review_action (text, text, uuid, text, jsonb) to authenticated;

-- ============================================================
-- record_copilot_analysis -- add idempotency + rate limiting
-- ============================================================
--
-- Behavior preserved exactly from the M7 version (supabase/migrations/
-- 20260717080000_m7_copilot_analyses.sql): the reviewer-active gate as the
-- unconditional first statement; the item_type = 'new_signal' gate; the
-- server-side suggested_next_step/confidence re-validation; the
-- risk_flags/missing_evidence JSON-array re-validation; reviewer_id set
-- exclusively from auth.uid() (never a parameter, so attribution cannot be
-- spoofed); the single copilot_analyses insert; the small non-sensitive
-- jsonb return contract; SECURITY DEFINER; `set search_path = public`; the
-- authenticated-only grant. Every one of those is unchanged below -- only
-- the idempotency/rate-limit wrapper around them, and one new required
-- parameter, are new.
--
-- New required parameter p_idempotency_key is positioned before the sole
-- existing defaulted parameter (p_limitations), for the same Postgres
-- parameter-ordering reason documented above submit_review_action.
--
-- Same consequence as submit_review_action above, already handled: call
-- sites in src/lib/copilot/* and tests/integration/m7-copilot.test.ts have
-- been updated in this same change to generate and pass a real key.

drop function if exists public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, text);

create function public.record_copilot_analysis(
  p_research_item_id text,
  p_model text,
  p_prompt_version text,
  p_summary text,
  p_risk_flags jsonb,
  p_missing_evidence jsonb,
  p_suggested_next_step text,
  p_confidence text,
  p_idempotency_key uuid,
  p_limitations text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.research_items%rowtype;
  v_id uuid;
  v_created_at timestamptz;
  v_payload_hash text;
  v_existing_reviewer_id uuid;
  v_existing_endpoint text;
  v_existing_payload_hash text;
  v_existing_response jsonb;
  v_recent_count int;
  v_result jsonb;
begin
  -- Step 1, unconditionally first: the reviewer gate. Unchanged from M7.
  if not exists (
    select 1 from public.reviewer_profiles
    where id = auth.uid() and is_active
  ) then
    raise exception 'not an active reviewer';
  end if;

  -- Step 2: server-computed payload hash from the actual mutation inputs
  -- only -- never includes p_idempotency_key itself, and never trusts a
  -- client-supplied hash (there is no such parameter).
  v_payload_hash := md5(
    jsonb_build_object(
      'p_research_item_id', p_research_item_id,
      'p_model', p_model,
      'p_prompt_version', p_prompt_version,
      'p_summary', p_summary,
      'p_risk_flags', p_risk_flags,
      'p_missing_evidence', p_missing_evidence,
      'p_suggested_next_step', p_suggested_next_step,
      'p_confidence', p_confidence,
      'p_limitations', p_limitations
    )::text
  );

  -- Step 3: idempotency insert / first-vs-replay detection. Identical
  -- pattern to submit_review_action above -- see this migration's header
  -- comment for the full race-condition/invariant reasoning, not repeated
  -- per-function here.
  insert into public.idempotency_keys (key, reviewer_id, endpoint, payload_hash)
  values (p_idempotency_key, auth.uid(), 'record_copilot_analysis', v_payload_hash)
  on conflict (key) do nothing;

  if not found then
    -- Step 4: replay path -- all three replay security checks (Required
    -- invariant E) before ever returning anything derived from the
    -- existing row.
    select reviewer_id, endpoint, payload_hash, response
    into v_existing_reviewer_id, v_existing_endpoint, v_existing_payload_hash, v_existing_response
    from public.idempotency_keys
    where key = p_idempotency_key;

    if v_existing_reviewer_id != auth.uid() then
      raise exception 'idempotency key belongs to a different reviewer' using errcode = 'SC003';
    end if;

    if v_existing_endpoint != 'record_copilot_analysis' then
      raise exception 'idempotency key was already used for a different endpoint' using errcode = 'SC002';
    end if;

    if v_existing_payload_hash != v_payload_hash then
      raise exception 'idempotency key already used for a different request' using errcode = 'SC001';
    end if;

    if v_existing_response is null then
      raise exception 'request with this idempotency key is still being processed' using errcode = 'SC005';
    end if;

    return v_existing_response;
  end if;

  -- Step 5: rate-limit check -- new-mutation path only, separate cap from
  -- submit_review_action (10/minute, tighter, per docs/DECISIONS.md D-100
  -- -- Copilot calls become computationally/cost-significant once M12
  -- activates a real provider, even though no live call happens in M11).
  select count(*) into v_recent_count
  from public.copilot_analyses
  where reviewer_id = auth.uid() and created_at > now() - interval '1 minute';

  if v_recent_count >= 10 then
    -- Step 6: rolls back the transaction, including the idempotency_keys
    -- row from Step 3 (Required invariant D) -- same reasoning as
    -- submit_review_action above.
    raise exception 'rate limit exceeded: no more than 10 actions per minute' using errcode = 'SC004';
  end if;

  -- Step 7: existing mutation logic, entirely unchanged from M7 below this point.

  -- Look up the research item and validate item_type. Unchanged.
  select * into v_item from public.research_items where id = p_research_item_id;
  if not found then
    raise exception 'research item not found: %', p_research_item_id;
  end if;

  if v_item.item_type != 'new_signal' then
    raise exception 'unsupported item_type: %', v_item.item_type;
  end if;

  -- Server-side re-validation of suggested_next_step/confidence. Unchanged.
  if p_suggested_next_step not in ('leans_approve', 'leans_reject', 'suggests_evidence_review', 'unclear') then
    raise exception 'invalid suggested_next_step: %', p_suggested_next_step;
  end if;

  if p_confidence not in ('low', 'medium', 'high') then
    raise exception 'invalid confidence: %', p_confidence;
  end if;

  -- Server-side re-validation that risk_flags/missing_evidence are JSON arrays. Unchanged.
  if jsonb_typeof(p_risk_flags) != 'array' then
    raise exception 'risk_flags must be a JSON array';
  end if;

  if jsonb_typeof(p_missing_evidence) != 'array' then
    raise exception 'missing_evidence must be a JSON array';
  end if;

  -- Insert exactly one row. reviewer_id from auth.uid() directly, never a
  -- parameter. Unchanged.
  insert into public.copilot_analyses (
    research_item_id, reviewer_id, model, prompt_version, summary,
    risk_flags, missing_evidence, suggested_next_step, confidence, limitations
  )
  values (
    p_research_item_id, auth.uid(), p_model, p_prompt_version, p_summary,
    p_risk_flags, p_missing_evidence, p_suggested_next_step, p_confidence, p_limitations
  )
  returning id, created_at into v_id, v_created_at;

  -- Small, non-sensitive jsonb result -- identical shape to the M7
  -- version. Held in v_result so it can also be stored into
  -- idempotency_keys.response in Step 8, in the same transaction as the
  -- insert above (Required invariant A/C).
  v_result := jsonb_build_object(
    'id', v_id,
    'research_item_id', p_research_item_id,
    'created_at', v_created_at
  );

  -- Step 8: store the exact response in the same transaction as the mutation above.
  update public.idempotency_keys set response = v_result where key = p_idempotency_key;

  -- Step 9: return it.
  return v_result;
end;
$$;

comment on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, uuid, text) is
  'M7 behavior unchanged: persists one advisory-only Reviewer Copilot analysis; reviewer_id from auth.uid() only, never a parameter; writes only to copilot_analyses. M11 Phase B (docs/DECISIONS.md D-100) adds: a required p_idempotency_key parameter, true idempotency-key semantics (safe replay, conflicting-replay rejection, cross-reviewer replay rejection, in-progress-replay guard), and a 10-per-minute-per-reviewer rate limit on the new-mutation path only. Cannot approve, publish, or otherwise mutate any reviewer decision. Any actual call, from any caller, still passes through the reviewer-active gate as its unconditional first step.';

revoke execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, uuid, text) from public;
revoke execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, uuid, text) from anon;
revoke execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, uuid, text) from authenticated;
grant execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, uuid, text) to authenticated;
