# Entity-Resolution Policy (Draft v0.1) — Minimum-Viable, Human-in-the-Loop

**Status:** Planning/methodology artifact for Milestone 6. **Not implementation approval.** No code, no API calls, no records, no migrations. Implementation begins only after a later Code planning pass and Cowork review.
**Companion to:** `USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC_v0.2` (locked decisions), `docs/DATA_MODEL.md` (`companies`, `company_aliases`, `research_items`), the M4 publish gate, and the Assessment's award-relevance distinctions (§10).
**Scope note:** written for the USAspending first connector under **Option B (ingest-to-queue only)**, but the model is source-agnostic so later connectors reuse it.

---

## 1. Purpose and non-goals

**Purpose:** define the *minimum viable* way to decide, for an incoming recipient (e.g. a USAspending award recipient), whether it **matches an existing company**, is a **new company**, or is **ambiguous and needs a human** — without overreaching into production-grade entity resolution (an explicit MVP non-goal in `PRODUCT_REQUIREMENTS.md`).

**Core principle (non-negotiable):** **the system never auto-merges entities.** Automation may *propose*; only a human review action *confirms* a merge or a new-company creation as anything publishable. This mirrors the publish-gate philosophy: machines draft, humans decide.

**Non-goals for M6:**
- No probabilistic/ML entity resolution, no fuzzy-match auto-accept, no third-party entity-resolution service.
- No cross-source identity graph (SAM.gov cross-walk, SEC CIK linkage, etc.) — deferred.
- No automated company **merging** or **splitting** of existing records.
- No public exposure of aliases or match internals (reviewer/service-role only in M6).
- **No automatic creation of a draft company for a recipient that appears to be a natural person** (Fable R5 fix — see §2.1). This is a conservative privacy/reputational safeguard, not an entity-matching optimization.

---

## 2. Identifiers, in priority order

| Rank | Identifier | Strength | Notes |
|---|---|---|---|
| 1 | **UEI** (Unique Entity Identifier) | **Strong** | Government-issued, stable per registered entity. The primary key for matching. **But:** identifies a *registered legal entity*, not an "AI company" — a parent, reseller, or integrator can share/own it. |
| 2 | **Normalized legal name** | Medium | Useful corroboration and for recipients missing a UEI; noisy (DBAs, punctuation, legal suffixes). |
| 3 | **Parent UEI / parent name** | Context | Flags parent-vs-subsidiary situations; never auto-collapses a subsidiary into its parent. |
| — | Website / domain | (future) | Not available from USAspending; deferred to enrichment connectors. |

**Rule:** UEI is the only identifier strong enough to drive an automatic *reuse* of an existing company. Name alone never auto-reuses and never auto-creates-as-duplicate — name conflicts route to human review.

### 2.1 Person-named-recipient check (Fable R5 fix — see D-085)

USAspending recipients are not always companies — sole proprietorships and individual-named awardees appear in real federal award data. **The connector must never automatically create a draft company for a recipient that appears to be a natural person.** This check runs specifically at the point where the match decision (§5, branch 2a) would otherwise create a new draft company for an unmatched UEI — never at the MATCH (reuse) branch, since reusing an already-existing company record isn't creating a new person-named profile.

**Provisional heuristic (candidate to refine, not final truth):**
- `recipient_name` matches a `"Last, First"` or `"Last, First Middle"` comma-inverted pattern common to USAspending individual/sole-proprietor records; or
- `recipient_name` consists of exactly two or three simple word tokens with no legal-entity indicator at all (no `Inc`/`LLC`/`Corp`/`Co`/`Ltd`/`Company`/etc. — see the normalization suffix list, §4) and no other business-identifying signal (no DBA, no `parent_uei`); or
- Any structured "business type"/recipient-type field available from the API (if present in the actual response) explicitly flags an individual/sole-proprietor recipient type — this should be checked first if available, since it's more reliable than name-pattern guessing.

**On a match:** route to an `entity_match` research item with `reason='possible_individual'` (extending the §7 payload's `reason` enum), or exclude the record entirely — either way, **no draft company is auto-created.** A human reviewer decides whether and how to proceed (e.g., confirming it's actually a business operating under a personal name, vs. genuinely an individual that shouldn't become a company profile).

**Why this is conservative by design, not an accuracy optimization:** an automatically-created company profile for what is actually a named individual is a real privacy and reputational risk — publishing (even as an internal draft) a "company" record built around a private citizen's name is a materially different harm than a merely-inaccurate entity match. This check is deliberately biased toward over-flagging (routing more borderline cases to human review) rather than under-flagging.

**Validation status (D-088):** this connector-time safeguard is **not yet validated** by the completed entity-resolution validation set — the 75-record `CANDIDATES.jsonl`/`BLIND.jsonl` has zero `possible_individual` examples, a documented collection-tooling gap (the heuristic above was only ever wired into a collection-time reporting/stop-condition check during the validation pull, never into actual candidate-reason tagging). **Any future milestone that has real connector logic depend on this safeguard must close that gap and produce validated `possible_individual` examples first** — this round's PROCEED decision covers the UEI-exact false-merge gate only, not R5's real-world accuracy.

---

## 3. Storage model (`company_aliases`, added in M6)

Per the v0.2 spec's Decision 2, `company_aliases` is added as a small additive migration matching `DATA_MODEL.md`:

```
company_aliases:
  id               primary key
  company_id       references companies(id)
  alias            text not null            -- raw value (UEI string, legal name, DBA)
  alias_type       text not null            -- 'uei' | 'legal_name' | 'dba' | 'parent_uei' | 'parent_name'
  normalized_alias text not null            -- normalized form used for matching (§4)
```

- One company may have many aliases (its UEI, its legal name, DBAs, historical names).
- **Uniqueness intent:** a given `('uei', normalized_alias)` should map to **at most one** company. If ingestion ever finds the same UEI pointing at two companies, that is a data-integrity flag → human review (not an auto-merge).
- **RLS (M6):** reviewer SELECT + service-role write only; no anon/public policy. Not surfaced publicly this milestone.

---

## 4. Normalization (`normalized_alias`)

Deterministic, documented, and applied identically at write time and match time (so a stored alias and an incoming value normalize to the same string).

**UEI normalization:** trim, uppercase (UEIs are alphanumeric, case-insensitive), strip surrounding whitespace. UEIs are otherwise used verbatim.

**Name normalization (candidate rules — validate before trusting):**
1. Unicode-normalize (NFKC), lowercase.
2. Trim and collapse internal whitespace.
3. Remove punctuation except internal alphanumerics (`&` → `and`).
4. Strip common legal suffixes as separate tokens: `inc`, `incorporated`, `llc`, `l.l.c`, `ltd`, `limited`, `corp`, `corporation`, `co`, `company`, `lp`, `llp`, `plc`, `gmbh`.
5. Strip common noise tokens: `the`, `dba`, `formerly`.
6. Collapse remaining tokens to a single normalized string.

> These rules are **candidates to validate** (like the Stage-1 code sets), because over-aggressive suffix/token stripping can collapse genuinely different entities (e.g. "Delta LLC" vs "Delta Corp" may or may not be the same). The validation set (§8) measures false-merge risk before these are trusted.

**Implementation rule, confirmed the hard way (D-088):** rule 4's "as separate tokens" is load-bearing, not stylistic — a first implementation stripped suffixes via an unanchored substring match instead of whole-token matching, which silently corrupted unrelated names containing a suffix as a substring (e.g. `"Columbia"` → `"lumbia"`, since `"co"` matched inside the word). **Suffix stripping must only ever remove a suffix when it is the exact trailing whitespace-delimited token — never a substring match anywhere in the name.** This was fixed and the entity-resolution POOL/CANDIDATES were regenerated from the corrected logic; verified against real production data (`"Columbia University"`, `"Columbia Power Technologies"`, `"District of Columbia"` all normalize correctly post-fix).

---

## 5. Match decision (deterministic, three outcomes)

For each incoming recipient `(uei, legal_name, parent_uei, parent_name)`:

```
1. If uei present AND exactly one company has an alias ('uei', normalize(uei)):
      → MATCH  → reuse that company (no new company, no entity_match item)

2. If uei present AND NO company has that uei alias:
      2a. If NO company has a matching normalized legal_name:
             → Check recipient_name against the person-named-recipient
               heuristic (§2.1, Fable R5 fix) FIRST, before creating anything:
               2a-i.  If it appears to be a natural person:
                        → NEVER auto-create a draft company. Emit an
                          `entity_match` item with reason='possible_individual'
                          (or exclude the record entirely), pending human
                          review judgment.
               2a-ii. Otherwise:
                        → NEW  → create is_demo=false draft company + insert
                                 ('uei', ...) and ('legal_name', ...) aliases
                                 + emit a `new_company` research item (queue-only)
      2b. If one-or-more companies DO match on normalized legal_name (but not uei):
             → AMBIGUOUS → do NOT reuse, do NOT create blindly;
                           emit an `entity_match` research item with both
                           candidates for a human to resolve

3. If uei present AND MORE THAN ONE company has that uei alias:
      → CONFLICT (data-integrity) → emit an `entity_match` item flagged
        "duplicate UEI"; never auto-merge

4. If uei ABSENT:
      → AMBIGUOUS by default → name-only can never auto-create or auto-reuse;
        emit an `entity_match` (or hold as a lead) for human review
```

**Summary of the three review-relevant outcomes:**
- **MATCH** — automatic reuse (UEI-exact, single company). The only automatic path.
- **NEW** — automatic draft-company creation + `new_company` item (UEI present, no UEI or name collision). Draft only; queue-only under Option B.
- **AMBIGUOUS / CONFLICT** — `entity_match` item; **human decides**; nothing is merged or created-as-canonical automatically.

**No fuzzy auto-accept.** There is deliberately no "80% name similarity → auto-match" rule in M6. Near-matches are `entity_match` items, full stop.

---

## 6. Parent / subsidiary handling

- A recipient's `parent_uei`/`parent_name` is **recorded** (as `parent_uei`/`parent_name` aliases on the child, once created) but **never used to collapse** the child into the parent.
- A subsidiary and its parent are **distinct companies** unless a human explicitly decides otherwise via an `entity_match` review.
- This directly supports Assessment §10's cases: the award recipient (which may be a parent/integrator) is not automatically treated as the AI company; the reviewer makes that call.

---

## 7. `entity_match` research item — payload and review flow

`entity_match` items are **queue-only in M6** (the M4 gate doesn't act on them; a human resolves them manually or the resolution is deferred to the follow-on milestone that adds `entity_match` gate support).

**Proposed payload:**
```json
{
  "item_type": "entity_match",
  "connector_key": "usaspending_award_search",
  "incoming": {
    "uei": "...", "legal_name": "...", "parent_uei": "...", "parent_name": "...",
    "source_document_id": "usasp-{...}", "award_id": "{...}"
  },
  "reason": "name_collision" | "duplicate_uei" | "no_uei" | "possible_individual" ,
  "candidates": [
    { "company_id": "...", "matched_on": "legal_name", "normalized_alias": "..." }
  ],
  "proposed_resolution": null,        // never pre-decided by the machine
  "confidence": "low"
}
```

**Reviewer options (conceptual, for the milestone that wires the gate):** confirm-match (attach incoming to an existing company + add aliases), create-new (promote to a new company), reject (not a company / irrelevant), or request-more-evidence. Until that gate support exists, `entity_match` items sit in the queue as flagged leads — visible, triageable context, not silently resolved.

**M6 reality:** because only fictional demo companies exist and connector records don't publish, most first-run recipients will be **NEW** (no prior real company to match), with `entity_match` firing mainly on within-run duplicate UEIs or name collisions among newly-created drafts. That's expected and low-volume.

---

## 8. Validation (before trusting normalization/matching)

Reusing the labeling-protocol discipline, build a **small hand-labeled entity set** (e.g. 50–100 real recipient pairs/singletons) and measure:
- **False-merge rate** — how often normalization collapses two genuinely different entities (the dangerous error; target near-zero).
- **Missed-match rate** — how often the same entity fails to match itself across two awards (tolerable; recoverable via human review).
- **Name-normalization sensitivity** — which suffix/token rules cause false merges.

**Acceptance posture:** favor **precision over recall** for auto-reuse — a missed match just creates a duplicate draft a human can later merge (via `entity_match`), whereas a false auto-merge silently fuses two entities and corrupts the record. When in doubt, the rule must route to `entity_match`, never auto-merge. Set a false-merge ceiling (proposed: 0 in the labeled set) before UEI-exact auto-reuse is trusted; name normalization is only ever corroboration, never an auto-reuse trigger.

---

## 9. Security, audit, and boundaries

- **Service-role, server-side only** — alias writes and match decisions happen in the ingestion job, never in the app request path. `company_aliases` has no anon policy.
- **Auditability** — every automatic decision (MATCH/NEW) is logged (which alias matched, normalized values, rule branch) so a reviewer can trace why a recipient was reused or created. `entity_match` items carry the full candidate set.
- **Untrusted input** — recipient names are untrusted text; normalized and stored, never executed; rendered inert in the reviewer UI.
- **Demo/live separation** — alias/company records created here are `is_demo = false`; never mixed with demo entities.
- **Reversibility** — because nothing auto-merges and nothing publishes under Option B, every automatic decision is a *draft* a human can override; there is no irreversible entity action in M6.

---

## 10. Tests needed before implementation

- **Normalization unit tests:** UEI + name rules against fixtures, including tricky suffix/DBA cases; assert two known-different entities do **not** normalize equal.
- **Match-decision unit tests:** each branch of §5 (UEI-exact match; UEI-new; name-collision → `entity_match`; duplicate-UEI → conflict; no-UEI → `entity_match`).
- **Person-named-recipient tests (Fable R5 fix):** recipient names matching the §2.1 heuristic (comma-inverted `"Last, First"`, bare two/three-token names with no legal-entity indicator) never result in an auto-created draft company — they produce an `entity_match` item with `reason='possible_individual'` instead, for both the UEI-present and UEI-absent cases.
- **Dedup within a run:** two awards, same UEI → one company + one `('uei',...)` alias, no `entity_match`.
- **False-merge guard:** the labeled entity set's false-merge rate is 0 before UEI-exact auto-reuse is enabled.
- **Boundary/RLS:** `company_aliases` not anon-readable; alias/company drafts never appear in public reads or demo counts.
- **Audit:** each MATCH/NEW decision writes a traceable log entry; each `entity_match` carries its candidate set.

---

## 11. Out of scope (M6)

- Fuzzy/probabilistic matching, ML entity resolution, third-party ER services.
- Cross-source identity linkage (SAM.gov, SEC CIK, website/domain).
- Automated merging/splitting of existing companies.
- `entity_match` **publish-gate** support (queue-only in M6; gate support deferred with `new_company`).
- Public exposure of aliases/match internals.
- Subaward recipients (prime only in M6).

---

## 12. Open questions

1. **Final `normalized_alias` rules** — confirm the suffix/token strip list (§4) after the false-merge validation; decide whether `&`→`and` and legal-suffix stripping are on by default.
2. **Duplicate-UEI-in-DB handling** — should a detected duplicate UEI block further ingestion for that recipient until resolved, or just flag?
3. **`entity_match` gate support timing** — confirm it lands with `new_company` publish support in the follow-on milestone (not M6).
4. **Alias types enumeration** — finalize the `alias_type` vocabulary (`uei`/`legal_name`/`dba`/`parent_uei`/`parent_name`), and whether it needs a CHECK constraint.
5. **Historical-name capture** — should superseded legal names be stored as aliases for future matching, or only current?
6. **Precision target** — confirm the "false-merge ceiling = 0 in the labeled set" acceptance posture before UEI-exact auto-reuse is enabled.

---

*Planning/methodology artifact for human review. Not an implementation approval. No code, API calls, records, or migrations are created here. The system never auto-merges entities — automation proposes, a human confirms. Under the locked Option B, all entity records are `is_demo = false` drafts and do not publish publicly in Milestone 6.*
