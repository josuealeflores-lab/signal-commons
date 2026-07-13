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

- **Window:** a recent-but-*not-overlapping* window vs. the connector's first live 90-day pull (e.g. an **older fiscal quarter**), so the gate isn't measured on rows the connector will later ingest. (Confirm — Protocol §7.3.) **Note (D-087):** the sampling frame is defined **operationally** — it is whatever award records USAspending Award Search's `time_period` filter returns for the given date range (`2025-01-01`–`2025-03-31`), using USAspending's own filter semantics as the source of truth. Diagnostic testing found that a record's `Start Date` can fall well outside this range while still being returned by the filter (e.g. a multi-year award that started years earlier); no returned point-in-time field (`Start Date`, `Action Date`, `Date Signed`, `Last Modified Date`) was confirmed to explain this. **Do not use `Start Date` alone to reject records from the sample** — it is retained as descriptive context only. See §6 for the full source-limitation note.
- **Award types:** contracts (`A`,`B`,`C`,`D`) + assistance (`02`–`11`); prime awards only. **Note (D-086):** USAspending rejects any `award_type_codes` filter that mixes more than one award-type group in a single request (HTTP 422). Every sub-pull below runs as **two separate requests** — one contracts-only, one assistance/grant-only — with results combined and deduped by `generated_internal_id`. This is a request-mechanics correction only; it does not change the validation gates or labeling rules.
- **Four sub-pulls, combined and de-duplicated (Fable R3 fix — a fourth, code-based pull was added to address sampling-frame bias; see D-085):**
  1. **AI-candidate pull** — descriptions matching strong AI terms (positives + some false-positive traps). `sample_source = keyword_pull`.
  2. **Ambiguous pull** — weak-term descriptions (`analytics`, `automation`, `smart`, `intelligent`, `model`, bare `AI`) to load the weak/ambiguous and false-positive slices. `sample_source = ambiguous_pull`.
  3. **Control pull** — random awards with **no** AI terms, spread across agencies/sectors, for true negatives. `sample_source = control_pull`.
  4. **Code-based pull (new)** — **no `description` filter at all**; driven instead by the NAICS/PSC/CFDA/agency code candidates already listed in the Field-Mapping Spec §4.2/§4.3. This exists specifically to catch **true positives that describe genuine AI/ML work without using any of the keyword-list terms** — a pure keyword pull structurally cannot find these, since by construction it only ever surfaces records containing a keyword. `sample_source = code_pull`. See §3.5 below for the exact query.
- **Why this matters:** the original three-pull design could systematically overstate Stage-1 recall, because every candidate it samples was *already* selected by matching a keyword — records that are genuinely AI-relevant but described in code-only terms (e.g. an agriculture ML award whose description never says "AI" or "machine learning" but carries an AI-relevant CFDA/NAICS code) would never enter the labeled set at all, and so could never count against recall. The code-based pull closes this gap.
- **Balance to the Protocol §1.1 targets** (case mix + ~18–22 per sector via §3 provisional sector assignment); the code-based pull's positives count toward the same per-sector targets.
- **Freeze**: store `award_id`, all captured fields (Protocol §1.2), and `retrieved_at`. Do not re-pull mid-labeling.

## 3. Exact query bodies for Code / a human to run (read-only)

> These are `POST` requests. Run them from an environment with real HTTP (not the assistant's GET-only fetch). No auth header needed. Respect a polite rate (≤ ~1 req/s).
>
> **Note (D-087):** every query below uses `time_period` to select the Q1 2025 sampling frame, but the exact field USAspending uses internally to satisfy that filter has **not** been confirmed. Do not reject, discard, or re-filter results based on `Start Date` — accept whatever the `time_period` filter returns as the sample, and record `Start Date` as context only. The D-086 split contract/assistance-per-request rule below is unaffected and remains required.

**3.1 AI-candidate pull** — `POST https://api.usaspending.gov/api/v2/search/spending_by_award/`

**Note (D-086):** do not combine contract and assistance/grant `award_type_codes` in one request — USAspending rejects mixed award-type groups with HTTP 422 (`"'award_type_codes' must only contain types from one group."`). Run the **contracts request** and the **assistance/grant request** below separately, then combine results and dedupe by `generated_internal_id`.

Contracts request:
```json
{
  "filters": {
    "award_type_codes": ["A","B","C","D"],
    "time_period": [{"start_date":"2025-01-01","end_date":"2025-03-31"}],
    "description": "artificial intelligence"
  },
  "fields": ["Award ID","Recipient Name","Recipient UEI","Awarding Agency","Awarding Sub Agency",
             "Award Amount","Award Type","Start Date","NAICS Code","PSC Code","CFDA Number","Description",
             "generated_internal_id"],
  "page": 1, "limit": 100, "sort": "Award Amount", "order": "desc"
}
```

Assistance/grant request (identical except `award_type_codes`):
```json
{
  "filters": {
    "award_type_codes": ["02","03","04","05"],
    "time_period": [{"start_date":"2025-01-01","end_date":"2025-03-31"}],
    "description": "artificial intelligence"
  },
  "fields": ["Award ID","Recipient Name","Recipient UEI","Awarding Agency","Awarding Sub Agency",
             "Award Amount","Award Type","Start Date","NAICS Code","PSC Code","CFDA Number","Description",
             "generated_internal_id"],
  "page": 1, "limit": 100, "sort": "Award Amount", "order": "desc"
}
```

Repeat both (contracts + assistance/grant) with `"description"` set to each of: `machine learning`, `deep learning`, `natural language processing`, `computer vision`, `autonomous`, `large language model`, `predictive analytics`. (The `description` filter is a substring match; combine all results, dedup by `generated_internal_id`.)

**3.2 Ambiguous pull** — same endpoint, `"description"` ∈ {`analytics`, `automation`, `smart`, `intelligent`, `optimization`, `algorithm`}. **Same D-086 note applies:** run as separate contracts (`["A","B","C","D"]`) and assistance/grant (`["02","03","04","05"]`) requests per description term, then combine and dedupe by `generated_internal_id`.

**3.3 Control pull** — same endpoint with **no `description` filter**, random pages across a spread of `awarding_agencies` (or omit and page deeply), to collect true-negative awards. Optionally filter by NAICS/PSC/agency to spread sectors. **Same D-086 note applies:** if `award_type_codes` is specified, run separate contracts and assistance/grant requests and combine/dedupe by `generated_internal_id` — do not mix groups in one request.

**3.5 Code-based pull (Fable R3 fix — new)** — same endpoint, **no `description` filter**, filtered instead by the Field-Mapping Spec's §4.2/§4.3 candidate code sets.

**Note (D-086):** as with §3.1, do not combine contract and assistance/grant `award_type_codes` in one request — run the **contracts request** and the **assistance/grant request** below separately, then combine results and dedupe by `generated_internal_id`.

Contracts request:
```json
{
  "filters": {
    "award_type_codes": ["A","B","C","D"],
    "time_period": [{"start_date":"2025-01-01","end_date":"2025-03-31"}],
    "naics_codes": ["541511","541512","541513","541519","518210","541715","541714","541713","541690"],
    "psc_codes": ["DA01","DA10"],
    "agencies": [{"type":"awarding","tier":"toptier","name":"National Science Foundation"},
                 {"type":"awarding","tier":"toptier","name":"Department of Energy"},
                 {"type":"awarding","tier":"toptier","name":"National Institutes of Health"}]
  },
  "fields": ["Award ID","Recipient Name","Recipient UEI","Awarding Agency","Awarding Sub Agency",
             "Award Amount","Award Type","Start Date","NAICS Code","PSC Code","CFDA Number","Description",
             "generated_internal_id"],
  "page": 1, "limit": 100, "sort": "Award Amount", "order": "desc"
}
```

Assistance/grant request (identical except `award_type_codes`):
```json
{
  "filters": {
    "award_type_codes": ["02","03","04","05"],
    "time_period": [{"start_date":"2025-01-01","end_date":"2025-03-31"}],
    "naics_codes": ["541511","541512","541513","541519","518210","541715","541714","541713","541690"],
    "psc_codes": ["DA01","DA10"],
    "agencies": [{"type":"awarding","tier":"toptier","name":"National Science Foundation"},
                 {"type":"awarding","tier":"toptier","name":"Department of Energy"},
                 {"type":"awarding","tier":"toptier","name":"National Institutes of Health"}]
  },
  "fields": ["Award ID","Recipient Name","Recipient UEI","Awarding Agency","Awarding Sub Agency",
             "Award Amount","Award Type","Start Date","NAICS Code","PSC Code","CFDA Number","Description",
             "generated_internal_id"],
  "page": 1, "limit": 100, "sort": "Award Amount", "order": "desc"
}
```

Repeat both (contracts + assistance/grant) varying the NAICS/PSC/CFDA/agency combination to cover the full candidate sets in Field-Mapping Spec §4.2/§4.3, and to reach into sectors under-represented by the keyword/ambiguous/control pulls. Tag every record surfaced only by this pull (i.e. not already present in pulls 3.1–3.3) with `sample_source = code_pull`.

**3.6 Recipient detail (entity set)** — for entity pairs, capture `Recipient UEI`, `Recipient Name`, and parent fields from the same rows; where parent info isn't in the search fields, `GET https://api.usaspending.gov/api/v2/awards/{generated_internal_id}/` (this **is** a GET endpoint) returns full award detail including recipient parent data.

> Field names in `fields`/results may vary slightly by API version — reconcile against the live response, and **re-verify the access facts** (no auth, no hard rate limit) at pull time, per the Source Assessment's own caveat. **If the API now requires a key or enforces a documented hard limit, STOP and report the discrepancy** before proceeding.

## 4. Labeling schema

See the Labeling Protocol (§1.3 Stage-1 labels; §2.3 entity labels). Data files are **JSONL** (one object per line) because of nested Stage-1/entity fields; a flat CSV equivalent is fine if preferred (column order = the input fields followed by the label fields). The first line of each `.SAMPLE.jsonl` is a **header/metadata object** marking the file synthetic.

## 5. How acceptance metrics are computed
Full formulas in Labeling Protocol §5. In short:
- **Stage-1 hard gate:** recall ≥ 0.90 overall **and** ≥ 0.80 per sector (with n reported; tiny-n sectors → grow the slice, don't auto-fail).
- **Stage-1 recall by `sample_source` (Fable R3 fix, in addition to the above, not a replacement for it):** recall must also be reported **separately for keyword-sourced positives (`keyword_pull`/`ambiguous_pull`) vs. code-sourced positives (`code_pull`)**. A low code-sourced recall specifically would indicate the Stage-1 filter is missing genuinely AI-relevant awards that don't use any keyword — exactly the sampling-frame-bias risk this fourth pull exists to surface. See Labeling Protocol §5.1.
- **Stage-1 FP:** measured + reported; **not** a hard gate this pass (advisory future target ≤ 0.35 FP / ≥ 0.5 precision).
- **Entity gate:** **0 false merges** in the labeled set before UEI-exact auto-reuse is trusted; missed-match rate reported but tolerated.

## 6. Limitations
- **Sampling-window compliance field unconfirmed (D-087)** — USAspending Award Search's `time_period` filter can return records whose `Start Date` falls outside the requested date range (confirmed via diagnostic: a record with `Start Date = 2020-04-23` was returned by a `2025-01-01`–`2025-03-31` `time_period` query). Diagnostic testing of `Action Date`, `Date Signed`, and `Last Modified Date` did not identify a reliable alternative point-in-time field — `Action Date` and `Date Signed` were `null` on the tested record, and `Last Modified Date` is a system record-update timestamp, not a transaction date. **The sampling frame is therefore defined by USAspending's own filter result set, not by any single date field on the returned records.** `Start Date` is preserved on every record as descriptive context but must not be used to reject records or judge window compliance. This is a genuine source limitation of the Award Search endpoint, not a project-side sampling error.
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
4. **Labeler count / adjudication — resolved (Fable follow-up):** dual-label **20–30% of the real validation data** (both sets) and report inter-rater agreement on that subset; single-label the remainder. Not left fully open.
5. **Accept the provisional sector heuristic** (Protocol §3) as candidate-to-validate with override + `sector_unclear`?
6. **Accept FP as measure-only** this pass (recall is the sole hard gate)?
7. **Accept "0 false merges" bar** as tied specifically to the UEI-exact-only rule (Protocol §6)?
8. **Re-verify API access facts at pull time**, and stop-and-report if they've changed.
9. **Retention policy — elevated (Fable follow-up):** must be decided **before the first real pull**, not left open indefinitely (Field-Mapping Spec §16.4).
10. **Code-based pull (§3.5) code-set coverage** — confirm the NAICS/PSC/agency combination above is sufficient to reach under-represented sectors, or whether additional passes are needed per sector.

---

*Read-only, labeling-only. No DB writes, no connector code, no credentials. Real sets pending a POST-capable pull; synthetic templates are illustrative only.*
