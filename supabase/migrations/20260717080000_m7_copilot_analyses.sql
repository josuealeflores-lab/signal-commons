-- Signal Commons — Milestone 7 (DRAFT, NOT APPLIED): copilot_analyses table
-- and record_copilot_analysis RPC for the authenticated Reviewer Copilot.
--
-- DRAFT STATUS: this file is a planning-phase draft only. It has not been
-- applied to any Supabase project (local, dev, CI, or prod) and must not be
-- applied until it has been Cowork/Fable-reviewed per the M7 plan's manual
-- approval gates (docs/DECISIONS.md D-095).
--
-- Adds exactly one new table (copilot_analyses) and one new SECURITY
-- DEFINER function (record_copilot_analysis). No changes to any existing
-- table, function, trigger, or RLS policy. No new item_type,
-- research_items.status, or review_actions.action value.
--
-- ============================================================
-- What this migration is NOT
-- ============================================================
-- copilot_analyses rows are advisory annotations, not reviewer decisions.
-- record_copilot_analysis never writes to research_items, signals,
-- companies, source_documents, signal_evidence, review_actions, or any
-- connector table (company_aliases/ingestion_runs). It cannot approve,
-- reject, request evidence, mark disputed, reopen, publish, change any
-- publication_status, or call submit_review_action. It does not depend on
-- or require service-role in any runtime path. This migration adds no
-- auto-approval and no auto-publication of any kind.
--
-- ============================================================
-- What is deliberately NOT stored in copilot_analyses
-- ============================================================
-- This table stores only the small, structured output contract (summary,
-- risk flags, missing-evidence questions, a disjoint advisory-lean
-- enum, confidence, optional limitations) -- never the full prompt sent to
-- the model, never the model's raw/unparsed output, never source-document
-- excerpts beyond what already exists in the structured summary fields
-- above, never review_actions history, never a full research_items
-- payload, never reviewer_note, and never before_state/after_state. The
-- application-layer prompt builder (src/lib/copilot/prompt.ts, a later,
-- separately-approved implementation step) is responsible for what is sent
-- TO the model; this table is only responsible for what is persisted AFTER
-- the model responds, and that persisted shape is deliberately minimal.
--
-- ============================================================
-- Why record_copilot_analysis mirrors submit_review_action's shape
-- ============================================================
-- submit_review_action (20260710044846_reviewer_auth_and_publish_gate.sql,
-- reconciled in 20260716070000_m6d_submit_review_action_connector_reconciliation.sql)
-- established the pattern this function reuses: SECURITY DEFINER, set
-- search_path = public, the active-reviewer gate as the unconditional first
-- statement (before any other lookup), reviewer_id/auth.uid() attribution
-- set inside the function body rather than accepted as a parameter, and
-- `revoke ... from public, anon, authenticated; grant execute ... to
-- authenticated` (never service_role, since the function needs auth.uid()
-- to resolve to the calling reviewer -- SECURITY DEFINER changes
-- privilege, not identity). Keeping this one, consistent enforcement style
-- for every reviewer-driven write in this schema is preferred over
-- inventing a second, RLS-policy-based write path for this new table.
--
-- ============================================================
-- Why reviewer_id is never a parameter
-- ============================================================
-- record_copilot_analysis takes no p_reviewer_id argument at all. Inside
-- the function, the INSERT sets reviewer_id = auth.uid() directly --
-- exactly mirroring submit_review_action's own
-- `insert into review_actions (..., reviewer_id, ...) values (..., auth.uid(), ...)`
-- pattern. This makes attribution spoofing structurally impossible: there
-- is no argument through which a caller could claim a different reviewer's
-- identity, regardless of what the caller passes.
--
-- ============================================================
-- Why suggested_next_step's vocabulary is what it is
-- ============================================================
-- suggested_next_step is intentionally disjoint from BOTH
-- submit_review_action's real action verbs (approve, edit_approve, reject,
-- request_evidence, mark_disputed, reopen) AND research_items.status's
-- real values (pending, needs_more_evidence, approved, rejected,
-- disputed). An earlier draft of this field used the value
-- 'needs_more_evidence' and was corrected specifically because it collided
-- with the real research_items.status value of the same name -- reusing it
-- here would have made a copilot analysis row structurally
-- indistinguishable from an actual workflow-status transition. The
-- approved vocabulary (leans_approve / leans_reject /
-- suggests_evidence_review / unclear) shares no member with either real
-- vocabulary, and this is enforced at the database layer via a CHECK
-- constraint (not only in application-layer zod validation), consistent
-- with this project's existing preference for enforcing allow-lists at the
-- DB layer (D-058).
--
-- ============================================================
-- Why risk_flags / missing_evidence get jsonb_typeof checks
-- ============================================================
-- Both columns are meant to hold a JSON array of short strings. A CHECK
-- constraint on jsonb_typeof(...) = 'array' rejects any other JSON shape
-- (object, string, number, null-as-a-value) at the database layer, so a
-- future application-layer bug or a direct RPC call bypassing the
-- TypeScript zod schema still cannot persist a malformed value. The RPC
-- itself re-validates this server-side as defense in depth over the
-- table's own constraint, the same layered-validation pattern
-- submit_review_action already uses for its edit_approve column allow-list.

-- ============================================================
-- Table
-- ============================================================

create table public.copilot_analyses (
  id uuid primary key default gen_random_uuid(),
  research_item_id text not null references public.research_items (id),
  reviewer_id uuid not null references public.reviewer_profiles (id),
  model text not null,
  prompt_version text not null,
  summary text not null,
  risk_flags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(risk_flags) = 'array'),
  missing_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_evidence) = 'array'),
  suggested_next_step text not null
    check (suggested_next_step in ('leans_approve', 'leans_reject', 'suggests_evidence_review', 'unclear')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  limitations text,
  created_at timestamptz not null default now()
);

comment on table public.copilot_analyses is
  'M7: advisory-only Reviewer Copilot analyses. Never a reviewer decision -- decisions remain exclusively submit_review_action calls into research_items/signals/review_actions. This table stores only the small structured output contract (summary/risk_flags/missing_evidence/suggested_next_step/confidence/limitations), never the full prompt, raw model output, or any research_items/review_actions internals.';
comment on column public.copilot_analyses.reviewer_id is
  'Set exclusively from auth.uid() inside record_copilot_analysis -- never accepted as an RPC parameter, so attribution cannot be spoofed by a caller.';
comment on column public.copilot_analyses.suggested_next_step is
  'Deliberately disjoint from submit_review_action''s action verbs (approve/edit_approve/reject/request_evidence/mark_disputed/reopen) and from research_items.status values (pending/needs_more_evidence/approved/rejected/disputed). Advisory only -- never fed into submit_review_action or any reviewer-decision path.';

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.copilot_analyses enable row level security;

-- Reviewer SELECT only (all rows -- team-wide visibility, matching the
-- existing research_items_reviewer_select / review_actions_reviewer_select
-- / company_aliases_reviewer_select / ingestion_runs_reviewer_select
-- pattern: every reviewer-facing table in this schema grants "any active
-- reviewer sees every row," not a per-reviewer-scoped view). No anon
-- policy at all -- this table is never surfaced publicly. No
-- INSERT/UPDATE/DELETE policy for authenticated or anon of any kind --
-- RLS default-denies once enabled with no matching policy, so the only
-- write path is the SECURITY DEFINER RPC below.
create policy copilot_analyses_reviewer_select on public.copilot_analyses
for select to authenticated using (
  exists (
    select 1
    from public.reviewer_profiles
    where id = auth.uid() and is_active
  )
);

-- ============================================================
-- record_copilot_analysis RPC
-- ============================================================

create function public.record_copilot_analysis(
  p_research_item_id text,
  p_model text,
  p_prompt_version text,
  p_summary text,
  p_risk_flags jsonb,
  p_missing_evidence jsonb,
  p_suggested_next_step text,
  p_confidence text,
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
begin
  -- Step 1, unconditionally first: the reviewer gate. Identical shape to
  -- submit_review_action's own first statement -- a non-reviewer or
  -- inactive-reviewer caller gets the same exception regardless of what
  -- else they pass, so differing error behavior can never leak
  -- information about which research items exist.
  if not exists (
    select 1 from public.reviewer_profiles
    where id = auth.uid() and is_active
  ) then
    raise exception 'not an active reviewer';
  end if;

  -- Step 2: look up the research item and validate item_type. Same gate
  -- submit_review_action uses -- this function only ever analyzes a
  -- new_signal item, never any other item_type.
  select * into v_item from public.research_items where id = p_research_item_id;
  if not found then
    raise exception 'research item not found: %', p_research_item_id;
  end if;

  if v_item.item_type != 'new_signal' then
    raise exception 'unsupported item_type: %', v_item.item_type;
  end if;

  -- Step 3: server-side re-validation of suggested_next_step/confidence,
  -- defense in depth over the table's own CHECK constraints (mirrors the
  -- layered-validation pattern submit_review_action already uses for its
  -- edit_approve column allow-list).
  if p_suggested_next_step not in ('leans_approve', 'leans_reject', 'suggests_evidence_review', 'unclear') then
    raise exception 'invalid suggested_next_step: %', p_suggested_next_step;
  end if;

  if p_confidence not in ('low', 'medium', 'high') then
    raise exception 'invalid confidence: %', p_confidence;
  end if;

  -- Step 4: server-side re-validation that risk_flags/missing_evidence are
  -- JSON arrays, defense in depth over the table's own jsonb_typeof checks.
  if jsonb_typeof(p_risk_flags) != 'array' then
    raise exception 'risk_flags must be a JSON array';
  end if;

  if jsonb_typeof(p_missing_evidence) != 'array' then
    raise exception 'missing_evidence must be a JSON array';
  end if;

  -- Step 5: insert exactly one row. reviewer_id is set from auth.uid()
  -- directly -- never from a parameter -- exactly mirroring
  -- submit_review_action's own review_actions insert
  -- (`values (..., auth.uid(), ...)`), so attribution cannot be spoofed.
  insert into public.copilot_analyses (
    research_item_id, reviewer_id, model, prompt_version, summary,
    risk_flags, missing_evidence, suggested_next_step, confidence, limitations
  )
  values (
    p_research_item_id, auth.uid(), p_model, p_prompt_version, p_summary,
    p_risk_flags, p_missing_evidence, p_suggested_next_step, p_confidence, p_limitations
  )
  returning id, created_at into v_id, v_created_at;

  -- Small, non-sensitive jsonb result -- ids and a timestamp only, never
  -- the summary/risk_flags/missing_evidence content back out (the caller
  -- already has that, since it supplied it). This function never writes
  -- to research_items, signals, companies, source_documents,
  -- signal_evidence, review_actions, or any connector table -- its only
  -- effect is the single copilot_analyses row above.
  return jsonb_build_object(
    'id', v_id,
    'research_item_id', p_research_item_id,
    'created_at', v_created_at
  );
end;
$$;

comment on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, text) is
  'M7: persists one advisory-only Reviewer Copilot analysis. reviewer_id is set from auth.uid() inside the function, never accepted as a parameter, so attribution cannot be spoofed. Writes only to copilot_analyses -- never research_items/signals/companies/review_actions/any connector table. Cannot approve, publish, or otherwise mutate any reviewer decision. service_role generally bypasses RLS and may carry platform/owner-level privileges at the Postgres level, independent of this function''s own grant/revoke block below -- but service_role is not the intended Copilot runtime caller, and the Copilot''s own code path never holds or uses that credential. Any actual call to this RPC, from any caller, still passes through the reviewer-active gate (the auth.uid()-based check above) as its unconditional first step.';

revoke execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, text) from public;
revoke execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, text) from anon;
revoke execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, text) from authenticated;
grant execute on function public.record_copilot_analysis (text, text, text, text, jsonb, jsonb, text, text, text) to authenticated;
