# USAspending First-Connector — Field-Mapping & Review Spec (v0.2, decision-resolved)

**Status:** Planning/methodology artifact for Milestone 6. **Not implementation approval.** No connector code, no API calls, no records, and **no migrations** are created by this document. Implementation begins only after a later Code planning pass and a Cowork review of that plan.
**Supersedes:** v0.1 draft (the seven open decisions in v0.1 §16 are now resolved and locked below).
**Depends on:** `docs/SOURCE_CANDIDATE_ASSESSMENT.md` (source selection; AI-relevance taxonomy §8; two-stage triage §9; award-relevance distinctions §10), `docs/DATA_MODEL.md` (table shapes + publication invariants), and the Milestone 4 publish gate (`submit_review_action`, `new_signal`-only).
**Companion artifacts to finalize/land alongside this:** AI-Relevance Stage-1 triage spec, validation-set labeling protocol, evidence-label guide, and the forthcoming Entity-Resolution Policy.

---

## 0. Locked decisions (resolved from v0.1)

These are settled and drive the rest of the document. They are product/methodology decisions, not yet an implementation approval.

1. **Option B — ingest-to-queue only.** Real USAspending awards may become `is_demo = false` **drafts in the reviewer queue**. Connector-sourced records **do not publish publicly in Milestone 6**. The M4 publish gate stays **`new_signal`-only**; `new_company` / `entity_match` / `correction` publish-gate support is **deferred** to a follow-on milestone.
2. **Add `company_aliases` in M6** — a small additive migration matching `DATA_MODEL.md`'s documented shape, used for UEI/name alias storage and recipient de-duplication (the `companies` table has no UEI column, so real recipients would otherwise duplicate across awards). **Reviewer/service-role access only in M6; no public read.** Never an auto-merge mechanism — ambiguous matches still become `entity_match` review items.
3. **Default `evidence_strength = high` on import** — applies **only** to the federal-award *event* being documented by a Tier-1 official source. It does **not** mean the company is successful, impactful, or an "AI company." `verification_status` stays `unverified` until human review.
4. **Demo/live banner unchanged in M6** (nothing connector-sourced publishes publicly under Option B) — plus a **committed future requirement**: the banner must become conditional/per-record before any real record is ever published (§9, §16).
5. **Company-creation policy** — the connector may create `is_demo = false` **draft** companies for unmatched recipients and store UEI/name aliases in `company_aliases`. It must **never auto-merge**; ambiguous matches produce `entity_match` review items.
6. **First-pull parameters** — last 90 days; **prime awards only**; contracts `A`–`D` and assistance/grants `02`–`11`; candidate cap **≤ 200**; **all-agency with tight Stage-1 filters** (not an agency-only subset).
7. **Validation acceptance bar** — Stage-1 recall **≥ 0.90 overall** and **≥ 0.80 per sector** before the rules are trusted; the NAICS/PSC/CFDA/agency sets in §4 are **candidates to validate, not final truth**.

---

## 1. Scope, schema dependency, and the Option-B stop condition

### 1.1 Why Option B
A real USAspending award is about a **real company that does not yet exist** in the database (today only the 21 fictional `is_demo = true` demo companies exist). But `signals.company_id` is a `NOT NULL` FK, and public visibility requires **both** a published company **and** a published signal (D-021), while the M4 gate publishes **`new_signal` only** (D-058). So a real connector cannot be end-to-end to the public site under the M4 gate as-is. **Option B resolves this by not requiring anything to reach the public site.**

**Milestone 6 stop condition (Option B):** *real USAspending award records land as `is_demo = false` drafts in the reviewer queue and can be triaged by a reviewer.* Public publication of connector-sourced records — and the `new_company` publish-gate support it needs — is an explicit follow-on milestone.

### 1.2 Schema dependency: `company_aliases` (added in M6, additive)
Per locked Decision 2, M6 adds one table, matching `DATA_MODEL.md`'s documented shape:

```
company_aliases:
  id              text/uuid primary key
  company_id      references companies(id)
  alias           text not null           -- e.g. the recipient legal name or UEI value
  alias_type      text not null           -- 'uei' | 'legal_name' | 'dba' | ...
  normalized_alias text not null          -- lowercased/trimmed/normalized for matching
```

- **Why it's required:** `companies` has no UEI column, so the connector needs `company_aliases` to (a) store a recipient's UEI/legal name and (b) dedup a recipient across its many awards within/across runs (match on `alias_type = 'uei'` + `normalized_alias`).
- **RLS (M6):** reviewer SELECT + service-role write only; **no anon/public policy** (aliases aren't surfaced publicly this milestone). This is additive and does not touch any existing anon policy — same low-risk posture as the M4 additive migration.
- **Not auto-merge:** presence of a matching alias reuses a company; **absence** creates a new draft company; **ambiguity** (partial/conflicting match) creates an `entity_match` item for human review. Full matching rules live in the forthcoming **Entity-Resolution Policy**.
- **Reminder:** this migration is *planned*, not written here. No migration is created by this artifact.

### 1.3 First pull (tight by design, per Decision 6)
- **Endpoint:** Award Search — `POST /api/v2/search/spending_by_award/` for candidates, `GET /api/v2/awards/{generated_internal_id}/` for detail. (Reconcile exact fields at build.)
- Last 90 days by `action_date`; prime awards only; contracts `A`–`D` + assistance `02`–`11`; Stage-1 filter (§4) applied; hard cap ≤ 200 candidates per run; deterministic ids + content hashing make runs idempotent.

---

## 2. Exact USAspending fields needed

| Field (USAspending) | Notes |
|---|---|
| `generated_internal_id` (award unique key) | Canonical award id; permalink + dedup key |
| `Award ID` (`piid` / `fain` / `uri`) | Human-facing award number |
| `Recipient Name` | Legal entity name (often parent/reseller/integrator, not a brand) |
| `Recipient UEI` | Primary entity-match id (an entity registration, not an "AI company" id) |
| `Recipient parent name / parent UEI` | Parent-vs-sub disambiguation |
| `Awarding Agency` / `Sub Agency` | Sector assignment + Stage-1 agency weighting |
| `Award Amount` (obligated) / `total_obligation` | **Context only — never impact/success** |
| `Award Type` (code + label) | Contract vs grant → `signal_type` |
| `action_date` | Award action date → `event_date` / `occurred_at` |
| `Period of Performance` start/end | Context |
| `Place of Performance` | Context |
| `NAICS` code + description (contracts) | Stage-1 code corroborator |
| `PSC` code + description (contracts) | Stage-1 code corroborator |
| `CFDA` / Assistance Listing number + title (assistance) | Stage-1 corroborator + sector hint |
| `Award Description` (`description`) | **Primary AI-relevance signal** (terse — the core limitation) |
| `last_modified_date` | Change detection / modifications (§6) |

---

## 3. Mapping to `source_documents`

One row per canonical award (post-dedup), written by the service-role ingestion job (server-side only — §8).

| `source_documents` column | Value |
|---|---|
| `id` | `usasp-{generated_internal_id}` |
| `canonical_url` | `https://www.usaspending.gov/award/{generated_internal_id}/` |
| `source_title` | Factual: `"{Award Type label} to {Recipient Name} — {Awarding Agency}"` (no AI claim) |
| `publisher` | `"USAspending.gov (U.S. Department of the Treasury)"` |
| `source_type` | `"government_award"` |
| `source_tier` | `1` |
| `event_date` | `action_date` |
| `published_at` | `last_modified_date`, or `null` |
| `retrieved_at` | ingestion timestamp |
| `content_hash` | hash of the normalized award record (dedup + change detection — §6) |
| `excerpt` | `Award Description`, truncated; stored verbatim, treated as untrusted (§8) |
| `storage_path` | optional raw-JSON snapshot path (nullable) |
| `is_demo` | **`false`** |
| `created_at` | now |

---

## 4. Stage-1 deterministic filter (the only classifier in M6)

Rule-based, fully logged, high-recall. Decides *"does this award deserve a reviewer's look?"* — never *"this is an AI signal."* Per Decision 7, **every value below is a candidate to validate against the hand-labeled set (§7) before it is trusted.**

### 4.1 Keyword / phrase rules (over `Award Description` + title)
Word-boundary matching (`\bAI\b`, not "email"/"detail").
- **Strong terms** (one hit triages, subject to exclusions): `artificial intelligence`, `machine learning`, `deep learning`, `neural network`, `natural language processing`, `computer vision`, `large language model`, `generative ai`, `foundation model`, `reinforcement learning`, `autonomous system`, `agentic`, `MLOps`.
- **Weak terms** (need a second weak/strong term or a code/agency corroborator): `AI`, `algorithm`, `predictive`, `analytics`, `automation`, `intelligent`, `smart`, `model`, `classifier`, `agent`, `chatbot`, `recognition`, `optimization`, `data-driven`.
- **Phrase patterns:** `AI[- ]?(enabled|powered|based|driven|assisted)`, `(machine|deep)[- ]learning`, `(predictive|prescriptive)\s+(analytics|model)`, `(natural[- ]language|speech|image|facial)\s+(processing|recognition|classification)`, `(large[- ]language|foundation|diffusion|generative)\s+model`, `(autonomous|unmanned|self[- ]navigating)\s+(vehicle|system|robot|aircraft)`, `(multi[- ]agent|ai[- ]agent|agent[- ]based)`.

### 4.2 Candidate classification-code sets (corroborators only — never a sole trigger; validate first)
- **NAICS (candidates):** `541511`, `541512`, `541513`, `541519`, `518210`, `541715`/`541714`/`541713`, `541690`.
- **PSC (candidates):** `DA01`/`DA10`, `D3xx`/`DB0x`, `AC*`/`AR*` (R&D services).
- **CFDA / Assistance Listing (candidates):** SBIR/STTR listings; NSF CISE-related; NIH data-science; DOE/USDA/ED R&D.

### 4.3 Candidate agency weighting (corroborator only; never excludes a sector)
Weight (not gate): NSF (esp. CISE), DoD research/DARPA, NIH, DOE, DHS S&T, GSA/18F. **No agency excluded**, preserving equal-sector opportunity.

### 4.4 Exclusion terms / false-positive handling
If only a bare-`AI`/weak-term hit is present **and** an exclusion context matches **and** no strong term / §4.1 pattern is present → drop with a logged reason.
- Acronym collisions: `aortic insufficiency`, `artificial insemination`, `avian influenza`, `aromatase inhibitor`, `Amnesty International`, `Adobe Illustrator`, `as-built`.
- Non-AI "agent": `real estate/insurance/field/procurement/contracting agent`, `user agent`, `chemical/contrast/cleaning agent`.
- Non-AI model/automation/vision/generation: `financial model`, `climate model` (unless ML-qualified), `building/office automation`, `power generation`, `next[- ]gen(eration)`, `lead generation`, `vision statement`, `vision care`.
- Non-AI smart/intelligent marketing: `smart building/meter/card`, `business intelligence` (unless ML-qualified), `intelligence community` (unless AI-qualified).

**Exclusions never override a strong-term or §4.1 pattern hit.**

### 4.5 Description-quality gate
Empty/boilerplate descriptions route to "insufficient evidence" (Assessment §8.9) and are **not** queued.

### 4.6 Triage decision rule (conservative)
Queue if **any**: (1) ≥1 strong term not fully negated by an exclusion; (2) ≥1 §4.1 pattern; (3) ≥2 weak terms co-occurring; (4) 1 weak term **+** a §4.2/§4.3 corroborator. Else pass over. **Log** matched terms/codes/agency flags, exclusions fired, and the deciding branch on every record.

---

## 5. Mapping to `companies`, `signals`, `signal_evidence`, `research_items`

### 5.1 Recipient → `companies` (Decision 5 + §1.2)
1. **Match** by `recipient_uei` against `company_aliases` (`alias_type='uei'`, `normalized_alias`). Matched → reuse the company.
2. **No match →** create an `is_demo = false` **draft** company: `publication_status='draft'`, `company_type='unclear'` (AI classification is a reviewer judgment), factual placeholder `summary`/`why_it_matters`/`stage`; insert `company_aliases` rows for the UEI and legal name; emit a **`new_company`** research item (queue-only under Option B).
3. **Ambiguous** (partial/conflicting UEI-vs-name) → do **not** guess; emit an **`entity_match`** research item (queue-only). Full rules: Entity-Resolution Policy.

Under Option B, draft companies and `new_company`/`entity_match` items are **triageable but not publishable** this milestone.

### 5.2 `signals` (draft)

| `signals` column | Value |
|---|---|
| `id` | `sig-usasp-{generated_internal_id}` |
| `company_id` | matched/created company id (§5.1) |
| `signal_type` | `government contract` (contracts `A`–`D`) or `grant or research award` (assistance `02`–`11`) |
| `headline` | Factual award-event line — describes the award, **not** any AI claim |
| `summary` | Factual: description excerpt + amount + dates + agency; no invented detail |
| `why_it_matters` | Conservative placeholder for the reviewer to complete — **never an invented impact claim** |
| `occurred_at` | `action_date` |
| `detected_at` | ingestion timestamp |
| `evidence_strength` | **`high`** (Decision 3) — rates the award *event* documented by a Tier-1 source, **not** AI-impact/company success; reviewer may downgrade |
| `verification_status` | **`unverified`** (no human review yet) |
| `publication_status` | **`draft`** |
| `is_demo` | **`false`** |
| `created_by_type` | **`import`** |

### 5.3 `signal_evidence`
One row: `id = {signal_id}-ev-0`, `signal_id`, `source_document_id = usasp-{...}`, `support_type='supports'`, `claim_type='official_record'`, `supporting_passage` = award-description excerpt.

### 5.4 `research_items` and item_type reconciliation
Payload = D-053 pointer + Stage-1 provenance + **suggestions** (never facts):

```json
{
  "target_table": "signals",
  "target_id": "sig-usasp-{generated_internal_id}",
  "connector_key": "usaspending_award_search",
  "stage1": { "matched_terms": [...], "matched_codes": [...], "agency_flag": "...", "rule_branch": "..." },
  "suggested_ai_relevance_class": "ml_predictive",
  "suggested_award_relevance_case": 2,
  "confidence": "low"
}
```

| item_type | Produced in M6? | M4 gate support | Handling under Option B |
|---|---|---|---|
| `new_signal` | Yes | **Yes** (D-058) | Reviewer flow works; approval **does not surface publicly** (company still draft) |
| `new_company` | Yes (unmatched recipient) | No | **Queue-only**; publish support deferred |
| `entity_match` | Yes (ambiguous) | No | **Queue-only**; reviewer confirms manually |
| `correction` | No (deferred) | No | Deferred (§6.1) |

- `id`: `ri-{signal_id}` / `ri-company-{company_id}`. `status='pending'`, `priority='medium'` default (`high` only for strong explicit-AI matches), `assigned_to=null`.
- **Caveat (why Option B):** `submit_review_action` `approve` on a `new_signal` sets it `published`/`verified` **unconditionally** — it does not check the company is published. For a real award whose company is a fresh draft, the public join (D-021) correctly hides it. Safe, but it means connector data cannot surface publicly until `new_company` publish support lands. **In M6, reviewers triage; nothing connector-sourced publishes.**

---

## 6. Modifications, deduplication, prime vs subaward

### 6.1 Dedup + modifications
- **Canonical key:** `generated_internal_id` (the award, not the action). Deterministic ids ⇒ re-ingest updates in place, no duplicates.
- Ingest the **award-level rolled-up record**, not each modification action as a separate signal.
- **Change detection via `content_hash`:** unchanged → skip (`records_skipped++`); changed **before review** → update the draft; changed **after a reviewer acted** → **do not silently mutate**; log and hold for a corrections flow (`correction` item_type — **deferred**).

### 6.2 Prime vs subaward
- **Prime awards only** (Decision 6). Subaward data is a separate, less-complete dataset — **deferred**.
- The prime recipient is often **not** the AI company (Assessment §10 case 2). The connector attaches a **suggested** §10 case to the item payload; the **reviewer** decides case 1/2/3/4. Never asserted as fact.

---

## 7. Validation-set requirements (gate before trusting Stage-1)

Per the labeling protocol: hand-label **100–200 real USAspending award descriptions** across all seven sectors against Assessment §8 (AI class) and §10 (award case), **blind to Stage-1 output**. Measure Stage-1 **recall overall and per sector**, plus false-positive rate. **Acceptance bar (Decision 7): recall ≥ 0.90 overall and ≥ 0.80 per sector before the rules are trusted.** Per-sector recall guards equal-sector opportunity (agriculture/climate awards often describe ML without saying "AI"). The set must exist and clear the bar **before** any real run relies on the filter.

---

## 8. Security and prompt-injection boundaries

- **Service-role, server-side only.** Ingestion uses the service-role client (to INSERT drafts; no anon/reviewer INSERT policy exists) and runs **outside the deployed app's request path** — a script/job, never imported by `src/app`, components, or the public data layer. Consistent with M3/M4 isolation. **No service-role key in Vercel.**
- **Award text is untrusted input** — stored verbatim, **never executed as instructions**. When Stage-2 (deferred) is added, the classifier prompt treats award text as data only; a concrete prompt-injection test is required then.
- **Display safety:** reviewer UI renders award text as inert text (no HTML/markdown injection).
- **Integrity:** `content_hash` per source document; deterministic ids; polite request rate (self-imposed ≤ ~1 req/s; prefer bulk for backfill).
- **Demo/live separation:** all connector records are `is_demo = false`, never silently mixed with demo data.

---

## 9. Demo/live banner (Decision 4)

- **M6:** the "Demo data" banner stays **unchanged** — under Option B nothing connector-sourced publishes publicly, so the public site remains 100% demo and the banner is accurate.
- **Committed future requirement (must precede any real publication):** before the first real (`is_demo = false`) record is ever published publicly, the banner must become **conditional/per-record** — demo records clearly labeled, real records clearly not, and a mixed-state disclosure if both appear. This is a hard prerequisite for the later publication milestone, recorded here so it cannot be lost.

---

## 10. `ingestion_runs` mapping

| `ingestion_runs` column | Value |
|---|---|
| `id` | generated |
| `connector_key` | `"usaspending_award_search"` |
| `started_at` / `finished_at` | run bounds |
| `status` | `running` → `succeeded` / `partially_succeeded` / `failed` |
| `records_discovered` | Stage-1 candidate count |
| `records_created` | drafts (signals/companies/source_docs) created |
| `records_skipped` | dedup/unchanged/excluded |
| `error_summary` | nullable |
| `metadata` | `{ date_window, award_types, stage1_ruleset_version, query_params, caps }` |

> Note: `ingestion_runs` is documented in `DATA_MODEL.md` but not yet migrated. Like `company_aliases`, adding it is a small additive M6 migration (planned here, not written).

---

## 11. Reviewer workflow expectations

Each queued item shows: the award `source_document` (title, publisher, tier 1, dates, canonical link); the proposed draft `signal` (headline/summary/placeholder why-it-matters); the **Stage-1 provenance**; and the **suggested** §8 class + §10 case (labeled suggestions, not facts). Reviewer checklist (existing + connector-specific):

1. Correct **company** (UEI/name)? And is it an AI company (§10 case 1), AI-enabled project (case 2), institution lead (case 3), or insufficient (case 4)?
2. Is the **AI relevance real** (actual AI work vs a keyword false positive)?
3. `event_date` (action date) distinct from any record/publication date?
4. Does the drafted summary add any claim the award doesn't support? (Must not.)
5. Is `evidence_strength` appropriate for the *event* (not conflated with AI-impact)?
6. Contradictory evidence; privacy/reputational concern?

Actions: `approve` / `edit_approve` (headline/summary/why_it_matters/evidence_strength within allow-list) / `reject` / `request_evidence` / `mark_disputed`. **Cases 3 and 4 must not be approved as company signals.** Under Option B, approval triages but does not surface publicly.

---

## 12. Evidence-label mapping (connector → methodology)

| Concept | Value | Rationale |
|---|---|---|
| `source_tier` | 1 | Treasury is the authoritative record-keeper |
| `claim_type` (evidence) | `official_record` | Primary government award record |
| `support_type` | `supports` | Record supports the award-event claim |
| `evidence_strength` (default) | `high` (reviewer-adjustable) | One authoritative source directly documents the *event* — **event only, not impact/success** |
| `verification_status` (import) | `unverified` → `verified` on approve | Human-review axis, separate from evidence strength |
| Public "why it matters" | reviewer-authored, never invented | Significance is editorial, gated by review |

---

## 13. Tests needed before implementation

- **Stage-1 unit tests:** keyword/pattern/exclusion/code logic vs fixtures, incl. every §4.4 false positive (must not queue) and strong-term cases (must queue).
- **Field-mapping unit tests:** award JSON → `source_documents`/`signals`/`signal_evidence` (contracts + assistance fixtures).
- **Recipient-dedup tests:** two awards, same UEI → one draft company + one alias; modified award → detected; re-run window → no duplicate drafts.
- **Validation-set measurement (gate):** recall overall + per sector vs the hand-labeled set; must clear the §7 bar.
- **Boundary/RLS tests:** `is_demo = false` connector drafts are **not** anon-readable, never appear in public reads, never counted in demo/public metrics; `company_aliases` not anon-readable.
- **Integration test:** a mock run creates draft signal + source_document + signal_evidence + research_item(s) + one `ingestion_runs` row; a reviewer session reads them; `new_signal` `approve` works for a matched-company case (and does not surface publicly).
- **Playwright:** connector drafts never appear on the public site.
- **Prompt-injection test (when Stage-2 lands):** instruction-like award text doesn't alter classifier behavior.

---

## 14. Explicitly out of scope (M6)

- **Stage-2 AI classification** — deferred; humans classify manually until the validation bar justifies an AI assist.
- **Public publication of connector records** — deferred (Option B).
- **`new_company` / `entity_match` / `correction` publish-gate support** — deferred; those items are queue-only in M6.
- **Subawards** — prime awards only.
- **Automated entity resolution / auto-merge** — never; manual, human-in-the-loop; see Entity-Resolution Policy.
- **Corrections flow** for post-review award changes — deferred.
- **Other connectors** (SBIR, SEC, etc.) — later.
- **Scheduling/cron** — a single manual run this slice.
- Any ranking, success score, impact claim, or real-world claim asserted without review.

---

## 15. Migrations planned for M6 (additive; planned, not written here)

1. **`company_aliases`** — Decision 2 (§1.2); reviewer/service-role RLS, no public read.
2. **`ingestion_runs`** — for run auditing (§10).

Both are additive, match `DATA_MODEL.md`'s documented shapes, and touch no existing anon policy — but **this artifact writes no migration.** The actual migration SQL is produced only in a later Code planning pass and reviewed by Cowork before it is applied.

---

## 16. Remaining open questions (after v0.2)

1. **USAspending field/endpoint reconciliation** — confirm exact field names/availability on `spending_by_award` vs award-detail at build; **re-verify access facts** (no auth, no hard rate limit) still hold before the first run.
2. **Sector-assignment rule** — the precise agency + CFDA/NAICS/PSC → sector mapping each award needs (ambiguous → `sector_unclear`).
3. **`company_aliases` normalization** — the exact `normalized_alias` rules (case, punctuation, legal-suffix stripping like "Inc/LLC") — to be finalized in the Entity-Resolution Policy.
4. **Retention policy** — for stored raw award JSON / excerpts / content hashes (RESEARCH_METHODOLOGY requires a per-source retention policy).
5. **`company_aliases`/`ingestion_runs` RLS specifics** — confirm reviewer-SELECT-only (no anon) is right for M6, and whether `ingestion_runs` should be reviewer-visible (for the reviewer dashboard's ingestion placeholder) or service-role-only.
6. **Priority derivation** — is `high` for strong explicit-AI matches desirable, or keep all `medium` to avoid implying pre-review importance?
7. **Validation-set sourcing** — who hand-labels, and which window, to avoid overlap with the first live pull.
8. **`why_it_matters` placeholder wording** — confirm the neutral template.

---

*Planning/methodology artifact for human review. Not an implementation approval. No connector code, no API calls, no records, and no migrations are created here. Every keyword, code, threshold, and mapping is a proposal for human review and empirical validation. All connector records are `is_demo = false`, enter as drafts, and — under the locked Option B — do not publish publicly in Milestone 6.*
