# USAspending Validation-Set Labeling Protocol (Draft v0.1)

**Status:** Planning/methodology artifact for Milestone 6. **Not implementation approval.** No connector code, no migrations, no database records, no credentials. Read-only public-API use for *labeling data only*.
**Covers two validation sets, both hard/soft gates before their rules are trusted:**
1. **Stage-1 AI-Relevance Validation Set** — gates the Stage-1 deterministic filter (Field-Mapping Spec §4).
2. **Entity-Resolution Validation Set** — gates the UEI-exact match rule (Entity-Resolution Policy §5/§8).
**Depends on:** `SOURCE_CANDIDATE_ASSESSMENT.md` (§8 AI-relevance taxonomy, §10 award-relevance cases), `USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC` (Stage-1 rules), `ENTITY_RESOLUTION_POLICY` (matching rules).

> **Important sourcing constraint (read `USASPENDING_VALIDATION_SET_README.md` first).** The award-description *search* USAspending exposes is a `POST` endpoint. The assistant preparing this protocol could confirm the API is reachable and unauthenticated via `GET` (verified 2026 — `GET /api/v2/references/toptier_agencies/` returned JSON, no key, active FY2026 Q3), but **could not execute the `POST` search** with its available tools. The **real** award/recipient rows must be pulled by Code (or a human) using the exact query bodies in the README, then labeled per this protocol. The `.SAMPLE.jsonl` files accompanying this protocol are **synthetic templates** demonstrating the schema and case coverage — they are **not** real data and **must not** be used to compute the acceptance gate.

---

## 0. Principles

- **Blind labeling.** Labelers judge the award text (and structured fields) **without** seeing what the Stage-1 filter would output. Any Stage-1 verdict is joined in *after* labeling, for scoring only. Otherwise the validation is circular.
- **Conservative bias.** When AI relevance is ambiguous, prefer `ai_adjacent_insufficient`, not a specific AI class. When entity identity is ambiguous, prefer `entity_match` / "different or unknown," never a merge.
- **Real, representative, frozen.** The scored set is a fixed snapshot of real awards. Synthetic rows illustrate the schema only.
- **Two axes stay separate** throughout: *is the scope AI?* vs *is the recipient an AI company?* (Assessment §10).

---

## 1. Stage-1 AI-Relevance Validation Set

### 1.1 Size and composition
- **Target: 150 real award descriptions** (acceptable range 100–200).
- Balanced across the seven sectors (~18–22 per sector after provisional sector assignment, §3) plus a `cross-sector`/`sector_unclear` slice.
- **Deliberate case mix** (oversample hard/negative cases relative to natural frequency, so the gate is meaningfully measurable):
  - ~35–40% **true positives** (clearly AI/ML/NLP/vision/etc.);
  - ~20–25% **likely false positives** (acronym collisions, "smart/intelligent" marketing, non-AI "agent/model/automation");
  - ~20–25% **weak/ambiguous** (bare `AI`, generic analytics, terse descriptions);
  - ~15–20% **clear non-AI controls**.
- The sampling query (README) uses **tight Stage-1-adjacent keywords** to find AI candidates, **plus** a set of deliberately-AI-ambiguous and clearly-non-AI pulls so the negatives and false-positive traps are represented (a pure keyword pull would contain almost no true negatives, making recall unmeasurable in context and precision unmeasurable at all).

### 1.2 Input fields captured per record (read-only from the API)
`award_id` (generated_internal_id), `award_type`, `recipient_name`, `recipient_uei`, `awarding_agency`, `awarding_sub_agency`, `award_description`, `naics_code`+`naics_description`, `psc_code`+`psc_description`, `cfda_number`+`cfda_title`, `action_date`, `award_amount`, `source_url`. (No `stage1_*` fields are shown to the labeler — see §0.)

### 1.3 Labels the human assigns
| Label | Values |
|---|---|
| `ai_category` | one of the 10 Assessment §8 classes: `explicit_ai`, `ml_predictive`, `nlp`, `computer_vision`, `autonomous_systems`, `agentic_workflows`, `generative_ai`, `ai_infrastructure`, `ai_adjacent_insufficient`, `not_ai` |
| `ai_category_secondary` | optional, same set or `none` |
| `award_relevance_case` | Assessment §10: `1` (AI company), `2` (AI-enabled project), `3` (AI mention, non-company institution), `4` (insufficient) |
| `is_ai_relevant` | derived boolean: **true** iff `ai_category` ∈ {8.1–8.8}; **false** for `ai_adjacent_insufficient`/`not_ai`. *This is the ground-truth label recall/precision are computed against.* |
| `evidence_sufficiency` | `sufficient` / `insufficient` / `unclear` |
| `false_positive_reason` | required iff `ai_category=not_ai`: `acronym_collision` / `non_ai_agent` / `generic_analytics` / `marketing_smart_intelligent` / `non_ai_model_generation_vision` / `automation_non_ai` / `other` |
| `sector` | one of the 7 slugs, `cross-sector`, or `sector_unclear` (§3) |
| `sector_uncertain` | boolean |
| `review_confidence` | `high` / `medium` / `low` |
| `labeler_id`, `label_date`, `notes` | provenance + rationale (cite the phrase relied on) |

### 1.4 Labeling decision rules (condensed from the taxonomy)
- **Bare `AI`** → confirm it means artificial intelligence in context; if it plausibly expands to a collision (aortic insufficiency, artificial insemination, avian influenza, Adobe Illustrator, as-built) → `not_ai` (`acronym_collision`). If unsupported by any method → `ai_adjacent_insufficient`.
- **analytics / automation / smart / intelligent / model / optimization / agent** are **weak**: require a described learned/trained model or AI method before an AI class; else `not_ai` (with reason) or `ai_adjacent_insufficient`.
- **Scope vs background:** an AI reference only in boilerplate justification ("supports the national AI strategy") without describing the funded work → not sufficient for an AI class.
- **Institutions vs companies (award case):** recipient = university/hospital/gov/nonprofit → case 3 even if scope is AI. Traditional contractor delivering AI → case 2. Company whose business is materially AI → case 1. Ambiguous/thin → case 4.
- **Amount is never evidence** of AI relevance or of case; ignore it when labeling.

---

## 2. Entity-Resolution Validation Set

### 2.1 Size and composition
- **Target: 75 items** (range 50–100), a mix of:
  - **Same-entity pairs** — two real award records for the same recipient (identical UEI, and cases where the *name* varies but UEI matches; and cases where a DBA/legal-name differs).
  - **Different-entity pairs** — two recipients with **similar names but different UEIs** (the false-merge trap), and clearly-different pairs.
  - **Parent/subsidiary pairs** — child recipient with a `parent_uei`/`parent_name` (must resolve as *different* companies unless a human says otherwise).
  - **Singletons** — one recipient, labeled with whether it *should* match anything else in the set.
  - **No-UEI recipients** — recipients missing a UEI (name-only), which must route to `entity_match`, never auto-reuse.
  - **Duplicate-UEI edge** — if found in real data, a UEI that appears under two distinct names (the data-integrity flag).

### 2.2 Input fields captured per item/pair
For each recipient: `recipient_name`, `recipient_uei`, `parent_name`, `parent_uei`, `example_award_id`, `example_award_agency`, `source_url`. For a **pair**, both recipients' fields.

### 2.3 Labels the human assigns
| Label | Values |
|---|---|
| `relationship` (for pairs) | `same_entity` / `different_entity` / `parent_subsidiary` / `unknown` |
| `singleton_expectation` (for singletons) | `has_match_in_set` / `no_match_in_set` |
| `should_auto_reuse` | boolean — **true only** when UEI-exact + a human agrees it's the same entity |
| `should_route_to_entity_match` | boolean — true for name-collisions, no-UEI, duplicate-UEI, ambiguous |
| `normalized_name_a` / `normalized_name_b` | the human's normalization applied (to check the rules in §4) |
| `labeler_id`, `label_date`, `notes` | provenance + rationale |

### 2.4 Labeling decision rules
- **UEI-exact + same real entity → `same_entity`, `should_auto_reuse=true`.** This is the only auto-reuse case.
- **Similar/identical names, different UEIs → `different_entity`, `should_auto_reuse=false`, `should_route_to_entity_match=true`.** These are the false-merge traps the normalization rules must NOT collapse.
- **Parent + subsidiary → `parent_subsidiary`, never auto-reuse** (distinct companies unless a human merges).
- **No UEI → `should_route_to_entity_match=true`** regardless of name similarity.
- **Duplicate UEI under two names → `should_route_to_entity_match=true`, flagged `duplicate_uei`.**

---

## 3. Provisional sector-assignment heuristic (required for per-sector recall)

Per-sector recall can't be measured without a sector per award. This heuristic assigns a **provisional** sector at sampling/labeling time; the human labeler may override it, and `sector_unclear` is always allowed. It is deliberately simple and **a candidate to validate**, not truth.

**Order of precedence: (1) explicit program/CFDA → (2) awarding agency → (3) NAICS/PSC → (4) description keywords → else `sector_unclear`.**

| Sector (slug) | Provisional signals (any) |
|---|---|
| `healthcare` | Agency: HHS / NIH / CDC / FDA / CMS / HRSA / AHRQ. CFDA 93.*. NAICS 62* or 3391*/3254 (pharma/devices). Description: clinical, patient, disease, diagnosis, hospital, health |
| `agriculture` | Agency: USDA (NIFA/ARS/FSA/NRCS). CFDA 10.*. NAICS 11* (crop/animal). Description: crop, farm, soil, livestock, agricultural, food-production |
| `climate-energy` | Agency: DOE / EPA / NOAA / Interior. CFDA 81.* / 66.*. NAICS 2211*/2111/562. Description: energy, grid, emissions, climate, renewable, carbon, environmental |
| `education` | Agency: Dept. of Education / IMLS; NSF EHR/EDU directorate. CFDA 84.* / (NSF ed programs). NAICS 61*. Description: student, curriculum, school, teaching, learning, K-12, university-instruction |
| `politics-civic-technology` | Agency: EAC, FEC, GSA/18F civic, Library of Congress, election-adjacent. Description: elections, voting, civic, public-records, legislative, transparency, government-service-to-public |
| `government-operations` | Agency: GSA, OPM, Treasury, DoD/DHS internal ops, agency IT/shared-services. PSC D3*/DA*. Description: internal agency operations, back-office, procurement, workforce, IT modernization |
| `nonprofits` | Recipient is a 501(c)/nonprofit (business_type / recipient type flags), CFDA to nonprofit-serving programs. Description: community, foundation, public-interest, service-organization |
| `cross-sector` | Genuinely spans ≥2 sectors (e.g. NSF CISE AI infrastructure used across domains) |
| `sector_unclear` | None of the above clearly applies |

Notes: agency spread is uneven (defense-adjacent government-operations and healthcare dominate award volume — Assessment §1.1); the composition targets (§1.1) deliberately rebalance so thin sectors are still measurable. NSF is multi-sector: route by directorate/program where visible, else `cross-sector`/`sector_unclear`.

---

## 4. Normalization to check (entity set)

The entity set measures whether the Entity-Resolution Policy §4 normalization causes **false merges**. Candidate rules under test (labelers record their own `normalized_name_*` so disagreements surface):
- lowercase, NFKC, collapse whitespace, `&`→`and`, strip punctuation;
- strip legal suffixes (`inc`, `llc`, `ltd`, `corp`, `co`, `lp`, `llp`, `plc`, `gmbh`) and noise (`the`, `dba`, `formerly`).
The dangerous case: two **different** entities whose names normalize equal (e.g. "Delta Systems LLC" vs "Delta Systems Inc" that are truly different companies). The set must include such traps so false-merge risk is measured, not assumed.

---

## 5. How acceptance metrics are computed

After the real set is pulled and blind-labeled, join the Stage-1 filter output (and, for the entity set, the match-rule output) and compute:

### 5.1 Stage-1 gate (hard)
Let ground truth `is_ai_relevant` (§1.3) be the positive class. Let `stage1_matched` be whether the deterministic filter (Field-Mapping §4) would queue the record.

- **Recall = TP / (TP + FN)** where TP = labeled-AI **and** stage1_matched; FN = labeled-AI **and** not matched.
- **Overall recall must be ≥ 0.90.**
- **Per-sector recall** (compute recall within each of the seven sector slugs) **must be ≥ 0.80 for every sector** that has a usable sample size (see caveat below). Report each sector's recall and n.
- **Sector sample-size caveat:** with ~150 records, some sectors will have small n (e.g. nonprofits). A per-sector recall on n<10 is noisy; report n alongside recall and treat a sub-threshold result on a very small sector as "insufficient sample — expand that slice," not an automatic fail. (Decision needed — §7.)

### 5.2 Stage-1 false-positive rate (measure + report; soft, not a hard gate this pass)
- **FP rate = FP / (FP + TN)** where FP = labeled-not-AI **and** stage1_matched; TN = labeled-not-AI **and** not matched. Also report **precision = TP / (TP + FP)**.
- Per your instruction, **FP is measured and reported but is not a hard gate this pass** (the hard gate is recall). **Proposed *future* soft target:** FP rate ≤ 0.35 / precision ≥ 0.5 at the queue, to keep reviewer volume sane once Stage-2 is deferred — but this is advisory, not a gate now. Justification for not gating FP now: Stage-1 is intentionally high-recall; precision is recovered by the human reviewer (and later Stage-2), so gating precision prematurely would push the filter to under-recall real signals — the more dangerous error for a discovery tool.

### 5.3 Entity gate
- **False-merge rate = (# pairs the rule would auto-reuse but are labeled `different_entity`/`parent_subsidiary`) / (# pairs the rule would auto-reuse).** **Target: 0 false merges in the labeled set** before UEI-exact auto-reuse is trusted.
- **Missed-match rate = (# `same_entity` pairs the rule would NOT auto-reuse) / (# `same_entity` pairs)** — measured and reported, **tolerated** (a missed match just creates a duplicate draft a human can merge via `entity_match`); no hard ceiling.

---

## 6. Is "0 false merges" realistic as the bar? (assessment)

**Yes — realistic and appropriate, *because the merge rule is UEI-exact only.*** The reasoning:
- The only automatic-reuse path is **UEI-exact** (Entity-Resolution Policy §5, branch 1). UEI is a government-issued, entity-unique identifier, so two genuinely different entities sharing a UEI essentially only happens through a government data error — rare, and itself flagged as a `duplicate_uei` `entity_match` (not a merge).
- **Name similarity never triggers auto-reuse** — it only ever routes to `entity_match`. So the classic false-merge source (fuzzy name matching) is structurally absent.
- Therefore the labeled-set false-merge count *should* be 0 by construction, and if it isn't, that reveals either a normalization bug (a name rule leaking into the reuse path — which the policy forbids) or a real duplicate-UEI in the data (which must route to review). Either way, 0 is the correct target and an achievable one.

**Caveat:** 0 false merges is realistic **only** for this conservative UEI-exact rule. If a future milestone adds fuzzy/name auto-merge, 0 becomes unrealistic and the bar must be replaced with a small tolerated ceiling plus mandatory human confirmation. Keep the bar tied explicitly to the UEI-exact-only rule.

---

## 7. Open questions / decisions needed before Code lands these artifacts

1. **Who executes the real pull and labeling?** The assistant can't POST-search; Code (real HTTP) or a human must run the README queries. Confirm the owner.
2. **Small-sector sample sizes.** For sectors with n < ~10 in a 150-record set, is sub-0.80 recall an automatic fail, or a "grow the slice and re-measure" signal? (Recommended: the latter, with n reported.)
3. **Sampling window overlap.** The validation pull should use a window that will **not** overlap the connector's first live 90-day pull, so the gate isn't measured on the same rows the connector later ingests. Confirm the window (e.g. an older quarter).
4. **Labeler count / adjudication.** Single labeler vs ≥2 with inter-rater agreement on a subset; who adjudicates disagreements.
5. **Provisional sector heuristic (§3)** — accept as a candidate to validate, with human override + `sector_unclear` always allowed?
6. **FP soft target** — accept "measure, report, no hard gate this pass," with the ≤0.35 FP / ≥0.5 precision figure as advisory only?
7. **Entity-set duplicate-UEI inclusion** — real duplicate-UEIs may be hard to find; is the set acceptable without one if none surface in the sampled window?

---

*Planning/methodology artifact for human review. Not an implementation approval. No connector code, migrations, records, or credentials. The scored validation sets must be **real, blind-labeled** award/recipient data pulled per the README; the accompanying `.SAMPLE.jsonl` files are synthetic templates and cannot be used to compute the gate.*
