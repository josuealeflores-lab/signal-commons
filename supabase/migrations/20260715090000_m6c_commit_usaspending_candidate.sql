-- Signal Commons — Milestone 6C (DRAFT, NOT APPLIED): commit_usaspending_candidate RPC.
--
-- DRAFT STATUS: this file is a planning-phase draft only. It has not been
-- applied to any Supabase project (local, dev, CI, or prod) and must not be
-- applied until it has been Cowork/Fable-reviewed per the M6C plan's manual
-- approval gates (~/.claude/plans -- "Migration draft" gate, step 2 of 10).
-- This revision incorporates Cowork/Fable's PASS WITH NOTES review of the
-- first draft (7 required changes; see each numbered section below).
--
-- Adds exactly one new SECURITY DEFINER function: commit_usaspending_candidate.
-- No new tables, no new columns, no new RLS policies. Writes to
-- companies, company_aliases, source_documents, signals, signal_evidence,
-- research_items -- the reviewer-control preflight count (exactly one
-- active reviewer) lives in the future Node CLI, not in this function; this
-- function only ever runs after that preflight has already passed.
--
-- ============================================================
-- (Cowork note 1) p_candidate JSON contract (DTO), pinned
-- ============================================================
-- This RPC does NOT accept the M6B CandidatePreview shape directly, and
-- must not be assumed to. CandidatePreview
-- (src/lib/connectors/usaspending/types.ts) nests its data as
-- sourceDocumentPreview / signalPreview / signalEvidencePreview /
-- researchItemPayloadPreview / fields.recipientName -- a shape this
-- function never parses. A Node-side serializer -- NOT YET IMPLEMENTED,
-- required before --commit code lands, see the "Not yet implemented" list
-- at the end of this comment block -- must map CandidatePreview to the
-- flat DTO below before ever calling commit_usaspending_candidate:
--
-- p_candidate := {
--   "recipientName": string,                  -- from fields.recipientName
--   "researchItemId": string,                  -- from CandidatePreview.researchItemId
--   "generatedInternalId": string | null,      -- optional; from CandidatePreview.generatedInternalId. Reserved for payload provenance only.
--   "requestKind": string | null,               -- optional; from CandidatePreview.requestKind. Reserved for payload provenance only.
--   "entityDecision": object | null,            -- optional; from CandidatePreview.entityPreview. Reserved for payload provenance only -- decision/reason/isPossibleIndividual shape, never raw names.
--   "sourceDocument": {                         -- from CandidatePreview.sourceDocumentPreview
--     "id": string, "canonical_url": string, "source_title": string,
--     "publisher": string, "source_type": string,
--     "event_date": string | null, "published_at": string | null,
--     "excerpt": string
--   },
--   "signal": {                                 -- from CandidatePreview.signalPreview
--     "id": string, "signal_type": string, "headline": string,
--     "summary": string, "why_it_matters": string,
--     "occurred_at": string | null
--   },
--   "signalEvidence": {                         -- from CandidatePreview.signalEvidencePreview
--     "id": string, "supporting_passage": string
--   },
--   "researchItemPayload": {                    -- from CandidatePreview.researchItemPayloadPreview.
--                                                -- target_table/target_id in here are IGNORED --
--                                                -- always rebuilt server-side, see Cowork note 2.
--     "connector_key": string, "stage1": object,
--     "suggested_ai_relevance_class": string,
--     "suggested_award_relevance_case": number,
--     "confidence": "low" | "medium" | "high"
--   }
-- }
--
-- Not yet implemented (future work, explicitly out of scope for this
-- migration-draft-only revision -- Cowork note 8):
--   - the Node serializer described above (CandidatePreview -> this DTO).
--   - round-trip tests proving the serializer's output satisfies this
--     exact contract before it ever reaches this function.
--   - the SourceDocumentPreview.source_tier `number` -> `string` fix in
--     src/lib/connectors/usaspending/types.ts / field-mapping.ts (see the
--     source_tier note further down) -- the serializer must emit the
--     corrected text value, not rely on this function to coerce it.
--
-- ============================================================
-- Why entity_match rows are NOT created here (M6C non-scope)
-- ============================================================
-- submit_review_action (20260710044846_reviewer_auth_and_publish_gate.sql)
-- hard-rejects any research_items.item_type other than 'new_signal':
--   "raise exception 'unsupported item_type in Milestone 4: %', v_item.item_type;"
-- An entity_match row would therefore be visible in the reviewer queue via
-- research_items_reviewer_select but completely un-actionable -- worse than
-- not surfacing the conflict at all. This function only ever writes
-- item_type = 'new_signal', and only for candidates the caller has already
-- resolved as NEW or non-demo UEI-exact MATCH. AMBIGUOUS / CONFLICT /
-- possible_individual candidates must never be passed to this function --
-- the caller skips and counts them by reason instead (docs/DECISIONS.md,
-- entry to be added once M6C ships). entity_match support is deferred until
-- R2 (reviewer UI) and a separate submit_review_action reconciliation both
-- exist.
--
-- ============================================================
-- Why UEI-exact reuse is scoped to non-demo companies only
-- ============================================================
-- seed/demo-data.json's demo companies are fictional (is_demo = true) but
-- can carry the same shape of alias data as real ones. This function
-- independently re-checks, at write time, whether an existing or
-- newly-touched UEI alias belongs to a demo or non-demo company -- it never
-- trusts whatever the Node-side previewEntityDecision() pass already
-- concluded, the same way is_demo/publication_status are hardcoded below
-- rather than accepted as parameters. A UEI that resolves to a demo
-- company is neither reused (would attach a real government-award signal
-- to fictional demo content) nor duplicated into a second real company
-- (would violate the existing company_aliases_uei_unique partial unique
-- index, since that index applies across all companies regardless of
-- is_demo). It is skipped; no row of any kind is written for that
-- candidate. (Cowork note 3 adds a second check specifically for the NEW
-- branch -- see below.)
--
-- ============================================================
-- Option-B safety: connector signals stay draft and private
-- ============================================================
-- Every row this function ever writes to companies/signals/research_items
-- is hardcoded to is_demo = false, publication_status = 'draft' (companies/
-- signals) -- never accepted as a parameter, never derived from caller
-- input. Milestone 6 has no mechanism to publish a connector-sourced
-- company at all (D-090), and the existing
-- signals_require_published_company trigger
-- (20260714230602_m6a_schema_rls_and_publish_invariant.sql) independently
-- blocks any future attempt to publish one of these signals before its
-- company is published through some as-yet-nonexistent path. This function
-- adds a second, redundant layer on top of that trigger by never writing
-- anything but 'draft' in the first place.
--
-- ============================================================
-- (Cowork note 7) source_tier handling
-- ============================================================
-- source_documents.source_tier has been `text` since Milestone 3
-- (20260709062842_initial_schema.sql). seed/demo-data.json uses the
-- literal string 'demo' for every seed row's source_tier -- a demo-only
-- placeholder, not real-data vocabulary. This function hardcodes
-- source_tier to the text literal '1' for every row it writes (never
-- accepted from the caller), matching
-- docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md's own documented value
-- ("Treasury is the authoritative record-keeper"). '1' is therefore this
-- project's *first real-record* source_tier vocabulary value -- to be
-- captured explicitly in docs/DECISIONS.md once M6C ships (not yet added;
-- planning-phase note only). M6B's TypeScript preview type
-- (SourceDocumentPreview.source_tier) is still incorrectly typed as
-- `number` today -- that bug is unaffected by this function (which never
-- reads a source_tier value from p_candidate at all) but must still be
-- fixed in types.ts/field-mapping.ts before the (not yet implemented)
-- Node serializer is written.
--
-- ============================================================
-- Open design questions not fully specified by the M6C plan
-- (unchanged from the first draft; still flagged for Cowork/Fable)
-- ============================================================
-- 1. New-company placeholder fields (summary, why_it_matters, company_type,
--    stage): the M6C plan hardcodes is_demo/publication_status for new
--    companies but does not specify values for the 4 other NOT NULL
--    columns companies requires. This draft uses clearly-labeled
--    placeholder text for summary/why_it_matters, the existing app-level
--    Zod enum value 'unclear' (src/lib/data/schema.ts's companyTypeSchema)
--    for company_type, and 'discovery' for stage (companyStageSchema has
--    no not-yet-categorized value; 'discovery' is the closest fit and is
--    flagged for Cowork/Fable confirmation).
-- 2. company_aliases.id / .alias: this draft uses a new deterministic id
--    scheme ('alias-uei-' || normalized_uei) and stores the normalized UEI
--    in both alias and normalized_alias (no separate raw-form UEI
--    parameter exists in the current plan/DTO). Flagged for confirmation.
-- 3. research_items.priority: hardcoded to 'medium' (matches
--    derive_research_items_from_seed_signals' existing default). Whether
--    priority should instead derive from the candidate's own `confidence`
--    field is an open question, not decided by the plan.
-- 4. NEW-branch demo recheck ordering (Cowork note 3): Cowork's note
--    describes checking is_demo *after* both the companies insert and the
--    company_aliases insert. This draft instead checks is_demo on the
--    companies row immediately after the companies insert but *before* the
--    company_aliases insert -- if the deterministic id
--    co-uei-{normalizedUei} turns out to already belong to a pre-existing
--    demo company, checking before the alias insert means no alias row is
--    ever attached to that demo company at all. Checking only after both
--    inserts (as literally described) would have already created that
--    alias by the time the check ran, which contradicts "write nothing
--    further for that candidate." Flagged for Cowork/Fable confirmation
--    that this reordering is the intended fix, not a deviation to correct.

create or replace function public.commit_usaspending_candidate(
  p_ingestion_run_id text,
  p_normalized_uei text,
  p_candidate jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_missing text[] := array[]::text[];

  v_source_document_id text;
  v_signal_id text;
  v_signal_evidence_id text;
  v_research_item_id text;
  v_recipient_name text;

  v_company_id text;
  v_company_alias_id text;
  v_matched_company_id text;
  v_matched_is_demo boolean;
  v_company_created boolean := false;

  v_research_item_payload jsonb;
begin
  -- ----------------------------------------------------------
  -- (Cowork note 4) Validate the DTO before touching any table.
  -- Expected-malformed-payload cases return a structured
  -- skipped_invalid_payload result (non-sensitive: field-path names only,
  -- never raw values). raise exception is reserved below for states that
  -- should be structurally impossible given this validation (i.e. genuine
  -- internal/invariant failures, not caller mistakes).
  -- ----------------------------------------------------------
  v_recipient_name := p_candidate ->> 'recipientName';
  v_research_item_id := p_candidate ->> 'researchItemId';
  v_source_document_id := p_candidate -> 'sourceDocument' ->> 'id';
  v_signal_id := p_candidate -> 'signal' ->> 'id';
  v_signal_evidence_id := p_candidate -> 'signalEvidence' ->> 'id';

  if p_normalized_uei is null or length(trim(p_normalized_uei)) = 0 then
    v_missing := array_append(v_missing, 'p_normalized_uei');
  end if;
  if jsonb_typeof(p_candidate -> 'researchItemPayload') is distinct from 'object' then
    v_missing := array_append(v_missing, 'researchItemPayload');
  end if;
  if v_source_document_id is null then
    v_missing := array_append(v_missing, 'sourceDocument.id');
  end if;
  if p_candidate -> 'sourceDocument' ->> 'canonical_url' is null then
    v_missing := array_append(v_missing, 'sourceDocument.canonical_url');
  end if;
  if p_candidate -> 'sourceDocument' ->> 'source_title' is null then
    v_missing := array_append(v_missing, 'sourceDocument.source_title');
  end if;
  if p_candidate -> 'sourceDocument' ->> 'publisher' is null then
    v_missing := array_append(v_missing, 'sourceDocument.publisher');
  end if;
  if p_candidate -> 'sourceDocument' ->> 'source_type' is null then
    v_missing := array_append(v_missing, 'sourceDocument.source_type');
  end if;
  if v_signal_id is null then
    v_missing := array_append(v_missing, 'signal.id');
  end if;
  if p_candidate -> 'signal' ->> 'signal_type' is null then
    v_missing := array_append(v_missing, 'signal.signal_type');
  end if;
  if p_candidate -> 'signal' ->> 'headline' is null then
    v_missing := array_append(v_missing, 'signal.headline');
  end if;
  if p_candidate -> 'signal' ->> 'summary' is null then
    v_missing := array_append(v_missing, 'signal.summary');
  end if;
  if p_candidate -> 'signal' ->> 'why_it_matters' is null then
    v_missing := array_append(v_missing, 'signal.why_it_matters');
  end if;
  if v_signal_evidence_id is null then
    v_missing := array_append(v_missing, 'signalEvidence.id');
  end if;
  if v_research_item_id is null then
    v_missing := array_append(v_missing, 'researchItemId');
  end if;
  if v_recipient_name is null or length(trim(v_recipient_name)) = 0 then
    v_missing := array_append(v_missing, 'recipientName');
  end if;

  if array_length(v_missing, 1) > 0 then
    return jsonb_build_object(
      'decision', 'skipped_invalid_payload',
      'missingFields', to_jsonb(v_missing)
    );
  end if;

  -- Idempotency short-circuit: the research_items row is this pipeline's
  -- "commit is complete" marker. If it already exists, this candidate was
  -- already fully committed on a prior run -- never re-derive or duplicate.
  if exists (select 1 from public.research_items where id = v_research_item_id) then
    return jsonb_build_object(
      'decision', 'skipped_already_exists',
      'researchItemId', v_research_item_id
    );
  end if;

  -- Authoritative, demo-aware UEI lookup -- independent of whatever the
  -- Node-side previewEntityDecision() pass concluded. company_aliases_uei_unique
  -- guarantees at most one company can ever match a given normalized_alias
  -- where alias_type = 'uei', so this is a plain lookup, not a fan-out.
  select ca.company_id, c.is_demo
    into v_matched_company_id, v_matched_is_demo
  from public.company_aliases ca
  join public.companies c on c.id = ca.company_id
  where ca.alias_type = 'uei' and ca.normalized_alias = p_normalized_uei;

  if v_matched_company_id is not null and v_matched_is_demo then
    -- UEI already belongs to a demo company: never reuse (would attach a
    -- real signal to fictional content), never create a second company for
    -- the same UEI (would violate company_aliases_uei_unique). No row of
    -- any kind is written.
    return jsonb_build_object('decision', 'skipped_demo_company_collision');
  end if;

  if v_matched_company_id is not null then
    -- Non-demo MATCH: reuse as-is.
    v_company_id := v_matched_company_id;
  else
    -- NEW: create a draft, non-demo company using the deterministic id
    -- scheme co-uei-{normalizedUei} (normalizedUei is opaque here --
    -- already normalized in TypeScript, never re-normalized in SQL).
    v_company_id := 'co-uei-' || p_normalized_uei;

    insert into public.companies (
      id, slug, name, legal_name, website_url, headquarters, founded_year,
      summary, why_it_matters, company_type, stage, is_demo, publication_status, last_reviewed_at
    )
    values (
      v_company_id,
      v_company_id,
      v_recipient_name,
      null, null, null, null,
      'Company profile not yet researched. Auto-created from a USAspending award record pending reviewer research.',
      'Not yet assessed. This company was created automatically from a USAspending award record; a human reviewer has not yet evaluated its relevance.',
      'unclear',
      'discovery',
      false,
      'draft',
      null
    )
    on conflict (id) do nothing;

    -- (Cowork note 3) Re-check is_demo on the companies row at this
    -- deterministic id *before* ever inserting a company_aliases row --
    -- see the "Open design questions" #4 note above for why this check
    -- must come before, not after, the alias insert. Covers the case where
    -- co-uei-{normalizedUei} coincidentally already belongs to a
    -- pre-existing demo company (the insert above then no-ops and leaves
    -- that company's real is_demo value in place).
    select c.is_demo into v_matched_is_demo
    from public.companies c
    where c.id = v_company_id;

    if v_matched_is_demo is null then
      raise exception 'commit_usaspending_candidate: failed to resolve company % immediately after insert', v_company_id;
    end if;

    if v_matched_is_demo then
      return jsonb_build_object('decision', 'skipped_demo_company_collision');
    end if;

    v_company_alias_id := 'alias-uei-' || p_normalized_uei;

    insert into public.company_aliases (id, company_id, alias, alias_type, normalized_alias)
    values (v_company_alias_id, v_company_id, p_normalized_uei, 'uei', p_normalized_uei)
    on conflict (normalized_alias) where alias_type = 'uei' do nothing;

    -- Re-select the canonical company id for this UEI in case a concurrent
    -- call raced this insert -- both branches converge on conflict, but the
    -- alias table is the source of truth for "which company id actually
    -- owns this UEI now."
    select ca.company_id into v_company_id
    from public.company_aliases ca
    where ca.alias_type = 'uei' and ca.normalized_alias = p_normalized_uei;

    if v_company_id is null then
      raise exception 'commit_usaspending_candidate: failed to resolve company_aliases row after insert for normalized UEI %', p_normalized_uei;
    end if;

    v_company_created := true;
  end if;

  -- source_documents: source_tier and is_demo are hardcoded, never trusted
  -- from p_candidate (see source_tier header note).
  insert into public.source_documents (
    id, canonical_url, source_title, publisher, source_type, source_tier,
    event_date, published_at, retrieved_at, content_hash, excerpt, storage_path, is_demo
  )
  values (
    v_source_document_id,
    p_candidate -> 'sourceDocument' ->> 'canonical_url',
    p_candidate -> 'sourceDocument' ->> 'source_title',
    p_candidate -> 'sourceDocument' ->> 'publisher',
    p_candidate -> 'sourceDocument' ->> 'source_type',
    '1',
    (p_candidate -> 'sourceDocument' ->> 'event_date')::timestamptz,
    (p_candidate -> 'sourceDocument' ->> 'published_at')::timestamptz,
    now(),
    null,
    p_candidate -> 'sourceDocument' ->> 'excerpt',
    null,
    false
  )
  on conflict (id) do nothing;

  -- signals: company_id is the resolved value from above, never taken from
  -- p_candidate. evidence_strength / verification_status /
  -- publication_status / is_demo / created_by_type are all hardcoded.
  insert into public.signals (
    id, company_id, signal_type, headline, summary, why_it_matters,
    occurred_at, detected_at, evidence_strength, verification_status,
    publication_status, is_demo, created_by_type
  )
  values (
    v_signal_id,
    v_company_id,
    p_candidate -> 'signal' ->> 'signal_type',
    p_candidate -> 'signal' ->> 'headline',
    p_candidate -> 'signal' ->> 'summary',
    p_candidate -> 'signal' ->> 'why_it_matters',
    (p_candidate -> 'signal' ->> 'occurred_at')::timestamptz,
    now(),
    'high',
    'unverified',
    'draft',
    false,
    'import'
  )
  on conflict (id) do nothing;

  -- signal_evidence: support_type / claim_type hardcoded (mirrors
  -- SignalEvidencePreview's own literal types -- there is only one
  -- supported shape today).
  insert into public.signal_evidence (
    id, signal_id, source_document_id, support_type, supporting_passage, claim_type
  )
  values (
    v_signal_evidence_id,
    v_signal_id,
    v_source_document_id,
    'supports',
    p_candidate -> 'signalEvidence' ->> 'supporting_passage',
    'official_record'
  )
  on conflict (id) do nothing;

  -- (Cowork note 2) research_items.payload: target_table/target_id are
  -- never taken from p_candidate.researchItemPayload -- always rebuilt
  -- here from values this function itself resolved, so
  -- submit_review_action's `payload ->> 'target_table' = 'signals'` check
  -- can never be spoofed or drift from the row actually written above.
  -- ingestion_run_id / generated_internal_id / request_kind / entity_decision
  -- are reserved audit/provenance fields, included only when the DTO
  -- provides them (jsonb_strip_nulls drops any that are absent) -- never
  -- raw recipient names or award descriptions.
  v_research_item_payload := jsonb_strip_nulls(jsonb_build_object(
    'target_table', 'signals',
    'target_id', v_signal_id,
    'connector_key', coalesce(p_candidate -> 'researchItemPayload' ->> 'connector_key', 'usaspending_award_search'),
    'stage1', p_candidate -> 'researchItemPayload' -> 'stage1',
    'suggested_ai_relevance_class', p_candidate -> 'researchItemPayload' ->> 'suggested_ai_relevance_class',
    'suggested_award_relevance_case', (p_candidate -> 'researchItemPayload' ->> 'suggested_award_relevance_case')::int,
    'confidence', p_candidate -> 'researchItemPayload' ->> 'confidence',
    'ingestion_run_id', p_ingestion_run_id,
    'generated_internal_id', p_candidate ->> 'generatedInternalId',
    'request_kind', p_candidate ->> 'requestKind',
    'entity_decision', p_candidate -> 'entityDecision'
  ));

  -- research_items: item_type/status/is_demo hardcoded; item_type is
  -- always 'new_signal' (see "Why entity_match rows are NOT created here"
  -- above).
  insert into public.research_items (id, item_type, payload, status, priority, is_demo)
  values (
    v_research_item_id,
    'new_signal',
    v_research_item_payload,
    'pending',
    'medium',
    false
  )
  on conflict (id) do nothing;

  return jsonb_build_object(
    'decision', 'committed',
    'companyId', v_company_id,
    'companyCreated', v_company_created,
    'sourceDocumentId', v_source_document_id,
    'signalId', v_signal_id,
    'researchItemId', v_research_item_id
  );
end;
$$;

comment on function public.commit_usaspending_candidate (text, text, jsonb) is
  'M6C: commits one already-resolved (NEW or non-demo UEI-exact MATCH) USAspending candidate as a draft, non-demo source_documents/signals/signal_evidence/research_items(new_signal) row set. Never writes entity_match. Never reuses or duplicates a demo company for a real UEI. Expects the pinned flat DTO shape documented in this file''s header, not raw CandidatePreview. service_role only.';

revoke execute on function public.commit_usaspending_candidate (text, text, jsonb) from public;
revoke execute on function public.commit_usaspending_candidate (text, text, jsonb) from anon;
revoke execute on function public.commit_usaspending_candidate (text, text, jsonb) from authenticated;
grant execute on function public.commit_usaspending_candidate (text, text, jsonb) to service_role;
