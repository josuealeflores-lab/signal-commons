# USAspending Validation Sets — README / Sourcing & Results Summary

**Status:** Planning/methodology artifact. Not implementation approval. Read-only public-API use for labeling data only; no DB writes, no connector code, no credentials.

---

## 1. What was verified vs. what could not be done (be honest about this)

**Verified (read-only, this session):**
- USAspending's public API is **reachable and unauthenticated**. `GET https://api.usaspending.gov/api/v2/references/toptier_agencies/` returned JSON with **no API key**, agency data active through **FY2026 Q3**. This is consistent with the Source Assessment's "no authentication; U.S. Government work" facts. **No access-fact discrepancy was found for GET.**

**Could not be done (tooling limitation — not an access-fact discrepancy):**
- The award-description **search** is `POST /api/v2/search/spending_by_award/`. The assistant's fetch tool performs **GET only**, and it is not permitted to issue `POST` via curl/python. **So the real, systematically-sampled award/recipient rows were not pulled by the assistant.** This is a capability limit of the assistant's environment, not a change in the API's terms.

**Consequence:** the `.SAMPLE.jsonl` files here are **synthetic templates** (schema + case coverage), clearly flagged. The **real** sets must be pulled by **Code** (which has real HTTP POST) or by a human, using the queries in §3, then blind-labeled per the Labeling Protocol. **The acceptance gate must be computed only on the real, labeled data — never on the synthetic templates.**

---

## 2. Sampling approach (what the real pull should do)

Goal: a **real, representative, frozen** sample supporting both a hard recall gate and a reported false-positive rate — which requires **positives, negatives, and false-positive traps**, not a pure keyword pull.

- **Window:** a recent-but-*not-overlapping* window vs. the connector's first live 90-day pull (e.g. an **older fiscal quarter**), so the gate isn't measured on rows the connector will later ingest. (Confirm — Protocol §7.3.)
- **Award types:** contracts (`A`,`B`,`C`,`D`) + assistance (`02`–`11`); prime awards only.
- **Three sub-pulls, combined and de-duplicated:**
  1. **AI-candidate pull** — descriptions matching strong AI terms (positives + some false-positive traps).
  2. **Ambiguous pull** — weak-term descriptions (`analytics`, `automation`, `smart`, `intelligent`, `model`, bare `AI`) to load the weak/ambiguous and false-positive slices.
  3. **Control pull** — random awards with **no** AI terms, spread across agencies/sectors, for true negatives.
- **Balance to the Protocol §1.1 targets** (case mix + ~18–22 per sector via §3 provisional sector assignment).
- **Freeze**: store `award_id`, all captured fields (Protocol §1.2), and `retrieved_at`. Do not re-pull mid-labeling.

## 3. Exact query bodies for Code / a human to run (read-only)

> These are `POST` requests. Run them from an environment with real HTTP (not the assistant's GET-only fetch). No auth header needed. Respect a polite rate (≤ ~1 req/s).

**3.1 AI-candidate pull** — `POST https://api.usaspending.gov/api/v2/search/spending_by_award/`
```json
{
  "filters": {
    "award_type_codes": ["A","B","C","D","02","03","04","05"],
    "time_period": [{"start_date":"2025-01-01","end_date":"2025-03-31"}],
    "description": "artificial intelligence"
  },
  "fields": ["Award ID","Recipient Name","Recipient UEI","Awarding Agency","Awarding Sub Agency",
             "Award Amount","Award Type","Start Date","NAICS Code","PSC Code","CFDA Number","Description",
             "generated_internal_id"],
  "page": 1, "limit": 100, "sort": "Award Amount", "order": "desc"
}
```
Repeat with `"description"` set to each of: `machine learning`, `deep learning`, `natural language processing`, `computer vision`, `autonomous`, `large language model`, `predictive analytics`. (The `description` filter is a substring match; combine results, dedup by `generated_internal_id`.)

**3.2 Ambiguous pull** — same endpoint, `"description"` ∈ {`analytics`, `automation`, `smart`, `intelligent`, `optimization`, `algorithm`}.

**3.3 Control pull** — same endpoint with **no `description` filter**, random pages across a spread of `awarding_agencies` (or omit and page deeply), to collect true-negative awards. Optionally filter by NAICS/PSC/agency to spread sectors.

**3.4 Recipient detail (entity set)** — for entity pairs, capture `Recipient UEI`, `Recipient Name`, and parent fields from the same rows; where parent info isn't in the search fields, `GET https://api.usaspending.gov/api/v2/awards/{generated_internal_id}/` (this **is** a GET endpoint) returns full award detail including recipient parent data.

> Field names in `fields`/results may vary slightly by API version — reconcile against the live response, and **re-verify the access facts** (no auth, no hard rate limit) at pull time, per the Source Assessment's own caveat. **If the API now requires a key or enforces a documented hard limit, STOP and report the discrepancy** before proceeding.

## 4. Labeling schema

See the Labeling Protocol (§1.3 Stage-1 labels; §2.3 entity labels). Data files are **JSONL** (one object per line) because of nested Stage-1/entity fields; a flat CSV equivalent is fine if preferred (column order = the input fields followed by the label fields). The first line of each `.SAMPLE.jsonl` is a **header/metadata object** marking the file synthetic.

## 5. How acceptance metrics are computed
Full formulas in Labeling Protocol §5. In short:
- **Stage-1 hard gate:** recall ≥ 0.90 overall **and** ≥ 0.80 per sector (with n reported; tiny-n sectors → grow the slice, don't auto-fail).
- **Stage-1 FP:** measured + reported; **not** a hard gate this pass (advisory future target ≤ 0.35 FP / ≥ 0.5 precision).
- **Entity gate:** **0 false merges** in the labeled set before UEI-exact auto-reuse is trusted; missed-match rate reported but tolerated.

## 6. Limitations
- **No assistant-pulled real data** (POST limitation, §1). The scored sets depend on Code/human executing §3.
- **Sector heuristic is provisional** (Protocol §3) — agency/CFDA/NAICS/PSC → sector is coarse; NSF and cross-cutting programs are genuinely ambiguous; `sector_unclear` absorbs these.
- **Award descriptions are terse** — the core USAspending limitation; some records are unclassifiable from the description alone and correctly land in `ai_adjacent_insufficient`.
- **Small-sector n** — nonprofits/agriculture may be thin in any window; per-sector recall on small n is noisy.
- **Entity duplicate-UEI cases** may not appear in a given window; the set may lack that edge case (Protocol §7.7).
- **Point-in-time** — awards get modified; the frozen snapshot may drift from the live record (that's fine for a validation set; note `retrieved_at`).

## 7. Open questions / decisions needed before Code lands these artifacts
1. **Owner of the real pull + labeling** (Code vs human).
2. **Sampling window** (older quarter; must not overlap the first live 90-day connector pull).
3. **Tiny-sector recall handling** (grow-and-re-measure vs auto-fail) — recommended: grow-and-re-measure with n reported.
4. **Labeler count / adjudication** (single vs ≥2 + agreement).
5. **Accept the provisional sector heuristic** (Protocol §3) as candidate-to-validate with override + `sector_unclear`?
6. **Accept FP as measure-only** this pass (recall is the sole hard gate)?
7. **Accept "0 false merges" bar** as tied specifically to the UEI-exact-only rule (Protocol §6)?
8. **Re-verify API access facts at pull time**, and stop-and-report if they've changed.

---

*Read-only, labeling-only. No DB writes, no connector code, no credentials. Real sets pending a POST-capable pull; synthetic templates are illustrative only.*
