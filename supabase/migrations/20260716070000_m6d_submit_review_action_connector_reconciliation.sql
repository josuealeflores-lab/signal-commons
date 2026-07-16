-- Signal Commons — Milestone 6D (DRAFT, NOT APPLIED): submit_review_action
-- reconciliation for connector-created records.
--
-- DRAFT STATUS: this file is a planning-phase draft only. It has not been
-- applied to any Supabase project (local, dev, CI, or prod) and must not be
-- applied until it has been Cowork/Fable-reviewed per the M6D plan's manual
-- approval gates (docs/DECISIONS.md D-094).
--
-- Modifies exactly one existing function, in place: public.submit_review_action.
-- No new tables, columns, RLS policies, item_type values, research_items.status
-- values, or review_actions.action values. This is a function-body-only
-- change (plus a return-type widening from void to jsonb), so it is
-- expressed as DROP FUNCTION + CREATE FUNCTION rather than
-- CREATE OR REPLACE FUNCTION -- Postgres does not allow CREATE OR REPLACE
-- to change a function's return type. The REVOKE/GRANT block below is
-- re-issued after the drop+create because grants do not survive a DROP.
--
-- ============================================================
-- Why submit_review_action is modified in place, not replaced
-- ============================================================
-- D-054 established one unified RPC for all 6 reviewer actions specifically
-- to keep review_actions audit semantics single-sourced. A separate
-- "connector-aware" RPC would either need a new review_actions.action value
-- (there is deliberately no new vocabulary in M6D) or would overload the
-- existing 'approve'/'edit_approve' action labels across two functions with
-- different real-world effects -- making a review_actions row impossible to
-- interpret from the row alone. Keeping one function keeps the audit trail
-- self-describing and keeps the reviewer-gate/evidence/allow-list logic in
-- exactly one place.
--
-- ============================================================
-- Why branching uses companies.publication_status, not is_demo/item_type
-- ============================================================
-- The actual safety invariant -- already enforced today by the
-- signals_require_published_company trigger
-- (20260714230602_m6a_schema_rls_and_publish_invariant.sql) -- is "a signal
-- can only publish if its company is already published." Keying the new
-- branch off that same condition, rather than is_demo or item_type, means
-- this is not "connector-aware" logic at all: it is a correct
-- generalization of an invariant that already exists, and it is provably a
-- no-op for every research_items/signals row that can exist today, because
-- the trigger has guaranteed since M6A that a published signal's company is
-- always published too. The only new code path (the "company not
-- published" branch) runs on zero existing rows until a real
-- connector-sourced approval actually happens.
--
-- ============================================================
-- Why approved-but-private stays publication_status='draft', not 'in_review'
-- ============================================================
-- D-090 originally suggested landing a connector-approved signal in
-- publication_status='in_review'. In this codebase, 'in_review' already has
-- exactly one meaning: "this was published, mark_disputed pulled it back
-- for reinvestigation." Reusing it for "good, reviewer-approved, just
-- blocked on its company" would collide two opposite meanings into one
-- enum value with nothing in the schema to disambiguate them. This
-- migration instead leaves publication_status entirely untouched (i.e.
-- 'draft') on the private-approval branch, and represents "approved but
-- private" as the combination of research_items.status='approved' +
-- signals.verification_status='verified' + signals.publication_status
-- staying 'draft' -- with the enriched review_actions snapshot (below)
-- making that combination legible to an auditor. This is a deliberate,
-- explained deviation from D-090's literal suggested value, not an
-- unexplained departure from a locked decision (docs/DECISIONS.md D-094).
--
-- ============================================================
-- Why mark_disputed only writes 'in_review' for already-published signals
-- ============================================================
-- mark_disputed's status-validity set includes 'pending', so it is
-- reachable today on a connector item that was never approved/published.
-- Unconditionally writing publication_status='in_review' in that case would
-- mislabel a signal that was never public as "pulled back from public
-- view." This migration instead checks the signal's *current*
-- publication_status before the transition: only a signal that is
-- currently 'published' gets moved to 'in_review'; a signal that is still
-- 'draft' stays 'draft' -- verification_status still moves to 'disputed'
-- either way, and a review_actions row is still appended either way.
--
-- ============================================================
-- UI messaging vs. the safety boundary
-- ============================================================
-- The widened jsonb return value (small, non-sensitive: action, ids,
-- statuses, a `published` boolean, a `private_approval` boolean) exists so
-- the reviewer UI can show honest messaging ("Approved -- private, company
-- not yet published" vs. plain "Approved") without a second round trip. The
-- UI is a complementary layer only -- per D-055's "the gate is server-side,
-- not UI-only" precedent (explicitly cited by D-090) -- this function
-- remains the actual safety boundary regardless of what any UI does or
-- fails to do, since it is granted to `authenticated` and callable directly
-- by any signed-in reviewer through any path, not just one Next.js route.
--
-- ============================================================
-- What is unconditionally preserved from the existing function
-- ============================================================
-- - The reviewer-active gate remains the unconditional first statement,
--   before any research_items lookup, so a non-reviewer/inactive-reviewer
--   caller gets the identical error regardless of what id/action they pass.
-- - item_type != 'new_signal' is still hard-rejected (Milestone 4/6D scope).
-- - The per-action status-validity table is unchanged.
-- - The edit_approve column allow-list (headline/summary/why_it_matters/
--   evidence_strength only) is unchanged and still enforced identically on
--   both the published and private branches -- no new bypass is
--   introduced.
-- - The evidence requirement (>=1 linked signal_evidence row) for
--   approve/edit_approve is unchanged and still enforced identically on
--   both branches -- it is a quality gate on what a reviewer may endorse at
--   all, not merely a publication precondition, and is checked before
--   either branch is reached.
-- - reject/request_evidence/reopen are functionally unchanged (only the
--   final jsonb return shape is new for them, for return-contract
--   consistency across all 6 actions).

drop function if exists public.submit_review_action (text, text, text, jsonb);

create function public.submit_review_action(
  p_research_item_id text,
  p_action text,
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
begin
  -- Step 1, unconditionally first: the reviewer gate. Unchanged.
  if not exists (
    select 1 from public.reviewer_profiles
    where id = auth.uid() and is_active
  ) then
    raise exception 'not an active reviewer';
  end if;

  -- Step 2: look up the research item. Unchanged.
  select * into v_item from public.research_items where id = p_research_item_id;
  if not found then
    raise exception 'research item not found: %', p_research_item_id;
  end if;

  -- Step 3: item_type gate (Milestone 4/6D scope). Unchanged.
  if v_item.item_type != 'new_signal' then
    raise exception 'unsupported item_type in Milestone 4: %', v_item.item_type;
  end if;

  -- Step 4: validate target_table (redundant given step 3, defense in depth). Unchanged.
  if (v_item.payload ->> 'target_table') != 'signals' then
    raise exception 'unsupported target_table: %', v_item.payload ->> 'target_table';
  end if;

  -- Step 5: validate the action against the per-action valid-current-status set. Unchanged.
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

  -- Step 6: look up the target signal AND its linked company (new -- the
  -- company row is what the new branching condition and the enriched audit
  -- snapshot both depend on).
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

  -- before_state snapshot, enriched with company publication_status/is_demo
  -- so a review_actions row alone can distinguish approved-and-published /
  -- approved-but-private / disputed-while-public / disputed-while-never-public.
  v_before := to_jsonb(v_signal) || jsonb_build_object(
    'company_publication_status', v_company.publication_status,
    'company_is_demo', v_company.is_demo
  );

  -- edit_approve's column allow-list, enforced here (not only in Zod) --
  -- unchanged, and applies identically regardless of company/publication
  -- branch below.
  if p_action = 'edit_approve' and p_edited_fields is not null then
    for v_edit_key in select jsonb_object_keys(p_edited_fields) loop
      if v_edit_key not in ('headline', 'summary', 'why_it_matters', 'evidence_strength') then
        raise exception 'edit_approve does not permit editing column: %', v_edit_key;
      end if;
    end loop;
  end if;

  -- Evidence requirement for approve/edit_approve -- unchanged, and
  -- deliberately checked before the company-published branch below so it
  -- can never be skipped or scoped only to the "will actually publish"
  -- path. A quality gate on what a reviewer may endorse, not merely a
  -- publication precondition.
  if p_action in ('approve', 'edit_approve') then
    select exists (
      select 1 from public.signal_evidence se where se.signal_id = v_signal.id
    ) into v_has_evidence;
    if not v_has_evidence then
      raise exception 'cannot approve a signal with no linked evidence';
    end if;
  end if;

  -- Step 7: apply the transition.
  v_published := false;

  if p_action = 'approve' then
    if v_company_published then
      -- Unchanged existing behavior: company already published, so
      -- publishing the signal is safe (and is exactly what the trigger
      -- already permits).
      update public.signals
      set publication_status = 'published', verification_status = 'verified', updated_at = now()
      where id = v_signal.id;
      v_published := true;
    else
      -- New: company not published. Verify the signal, approve the item,
      -- but never touch publication_status -- it stays whatever it already
      -- is (draft). No exception, no trigger firing, no publication.
      update public.signals
      set verification_status = 'verified', updated_at = now()
      where id = v_signal.id;
      v_published := false;
    end if;
    v_new_item_status := 'approved';

  elsif p_action = 'edit_approve' then
    if v_company_published then
      -- Unchanged existing behavior. Static UPDATE naming exactly 4
      -- editable columns -- never a dynamic/generic JSON-to-column
      -- mechanism. Structural columns (id, company_id, publication_status,
      -- is_demo, created_by_type, created_at) can never be written from
      -- p_edited_fields.
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
      -- New: company not published. Apply only the allow-listed editable
      -- fields plus verification_status -- the UPDATE below deliberately
      -- has no publication_status assignment at all (not even re-set to
      -- its current value), so publication_status stays draft.
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
    -- Unchanged. 'archived' is a terminal rejection state, not a
    -- public-specific one, and is not gated by the publish trigger --
    -- safe as-is for connector draft rows.
    update public.signals
    set publication_status = 'archived', verification_status = 'rejected', updated_at = now()
    where id = v_signal.id;
    v_new_item_status := 'rejected';
    v_published := false;

  elsif p_action = 'request_evidence' then
    -- Unchanged -- never touches signals at all. published is reported as
    -- false unconditionally: this action never publishes anything, and
    -- reporting the signal's pre-existing status here would blur "did this
    -- call publish" with "was it already published for an unrelated
    -- reason" in the jsonb contract.
    v_new_item_status := 'needs_more_evidence';
    v_published := false;

  elsif p_action = 'mark_disputed' then
    if v_signal_was_published then
      -- Unchanged existing behavior: auto-unpublish so the disputed claim
      -- disappears from public anon reads immediately.
      update public.signals
      set publication_status = 'in_review', verification_status = 'disputed', updated_at = now()
      where id = v_signal.id;
    else
      -- New: the signal was never published -- do not write 'in_review'
      -- (that value means "pulled back from public view" elsewhere in
      -- this schema, and would mislabel a never-public row). Still mark
      -- the dispute, still leave publication_status untouched (draft).
      update public.signals
      set verification_status = 'disputed', updated_at = now()
      where id = v_signal.id;
    end if;
    v_new_item_status := 'disputed';
    v_published := false;

  elsif p_action = 'reopen' then
    -- Unchanged -- never touches signals at all. published reported as
    -- false unconditionally, same reasoning as request_evidence above.
    v_new_item_status := 'pending';
    v_published := false;
  end if;

  -- Re-select the signal and company to capture after_state (no-op
  -- re-select when the action didn't touch signals, but keeps this
  -- branch-independent).
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

  -- Small, non-sensitive jsonb result -- ids and statuses only, never a raw
  -- source excerpt, recipient name, award description, or full payload.
  -- Consumed by the reviewer UI for honest messaging; the RPC's own
  -- behavior above (not this return value) is the actual safety boundary.
  return jsonb_build_object(
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
end;
$$;

comment on function public.submit_review_action (text, text, text, jsonb) is
  'M6D: approve/edit_approve only publish the linked signal if its company is already published; otherwise the signal is verified/approved but stays draft/private. mark_disputed only moves publication_status to in_review if the signal was actually published. Returns a small non-sensitive jsonb status object. service_role bypasses this entirely; authenticated reviewers only.';

revoke execute on function public.submit_review_action (text, text, text, jsonb) from public;
revoke execute on function public.submit_review_action (text, text, text, jsonb) from anon;
revoke execute on function public.submit_review_action (text, text, text, jsonb) from authenticated;
grant execute on function public.submit_review_action (text, text, text, jsonb) to authenticated;
