# Source-Candidate Assessment — Signal Commons

**Status:** Draft for human review. Not yet approved. Do not treat any recommendation here as an approved connector.
**Prepared for:** Research and methodology track (Signal Commons, Emerging AI Impact Radar).
**Scope of this document:** Assess public data sources for *discovering* and *verifying* emerging AI-company activity across the seven equally weighted sectors. This document does **not** create company claims, rankings, or seed records, and it does not modify application code or call any API.
**Date prepared:** 2026-07-04. **Revised:** 2026-07-04 (Rev. 2 — see Change Log, Section 11).

---

## How to read this document

Every source entry separates two things the methodology requires be kept apart:

- **Confirmed facts** — statements verified against the source's own official documentation during this assessment. Each is a reproducible property of the source (access method, authentication, documented limits).
- **Assessment / recommendation** — judgments made by the author of this document about discovery value, verification value, entity-matching risk, and first-connector suitability. These are opinions for a reviewer to accept, edit, or reject.

Where a fact could not be confirmed from the official source, it is marked **UNCONFIRMED** and moved to Open Questions rather than stated as fact.

### Source-tier classification (corrected in Rev. 2)

Source tiers use the project's own `RESEARCH_METHODOLOGY.md` hierarchy (Tier 1 = primary/authoritative … Tier 4 = community/weakly verified). An important distinction, understated in Rev. 1, is now made explicit:

- **Official government sources (Tier 1, direct).** The issuing organization *is* the authoritative record-keeper and serves the records through its own API. Nine of the ten candidates are in this class: USAspending, Grants.gov, SBIR.gov, NIH RePORTER, NSF, SEC EDGAR, USPTO Open Data Portal, Federal Register, and SAM.gov. A record retrieved here is a primary official record.
- **Third-party intermediaries over official records (Tier 1 underlying data, Tier 2 provenance).** The data *originates* as an authoritative government record but is republished through a non-government interface that may re-key, enrich, or reshape it. The **ProPublica Nonprofit Explorer API** is in this class: the underlying IRS Form 990 filings are Tier 1 public records, but ProPublica is an intermediary. Records sourced this way should, wherever possible, cite or link the **original IRS filing** as the canonical source, with the intermediary noted as the retrieval path. The intermediary is not itself the authoritative issuer.
- **Government-supported analytical derivatives.** A narrower note: **USPTO PatentsView** is USPTO-supported but applies disambiguation/enrichment algorithms on top of the raw grant record. For an authoritative citation, prefer the USPTO Open Data Portal (the raw record); treat PatentsView's enriched fields (e.g., resolved assignee) as analysis, not primary fact.

The practical rule: **`source_documents.source_tier` reflects the authority of the underlying record; provenance (who served it) is tracked separately and, for intermediaries, the original record is linked as canonical.**

---

## 1. Executive summary

Emerging-AI-company activity in essential sectors leaves a public paper trail in federal award, grant, filing, patent, and regulatory systems. Ten U.S. federal or federally derived sources cover the seven Signal Commons sectors with **official-record** evidence and — critically — with **published terms and access methods that clearly permit programmatic use**. Nine are direct Tier 1 government sources; one (ProPublica Nonprofit Explorer) is a third-party intermediary over Tier 1 IRS records and is treated accordingly.

The strongest candidates share three properties the methodology prizes: they are authoritative primary records (high verification value), they are queryable by keyword/date without scraping (terms clearly permit access), and they carry structured fields (award amounts, dates, recipient identifiers) that map directly onto the `signals` and `source_documents` data model.

**Recommended first connector: USAspending.gov Award Search API.** It requires no authentication, has no documented hard rate limit, publishes data as U.S. Government work in the public domain, and returns Tier 1 official records of federal contracts and grants across every sector. Its **primary source role is Discovery + Verification.** It maps cleanly to the `government contract` and `grant or research award` signal types and provides recipient names, UEIs, agencies, amounts, and action dates. Its main limitation is a genuine entity-resolution challenge (recipient names and UEIs are not AI-company identifiers), which is a review-workflow problem, not a terms or access problem.

Three cautions carry through the whole assessment. First, **none of these sources identify "AI companies" as such** — every candidate requires keyword/classification filtering plus human review to separate genuine AI signals from noise, exactly the draft-then-review flow the methodology mandates. To make that reviewable and consistent, Rev. 2 adds an **AI-relevance taxonomy (Section 8)**, a **two-stage triage process (Section 9)**, and **award-relevance distinctions (Section 10)**. Second, **an award, grant, filing, or patent is evidence of an event, not evidence of impact or success** — consistent with the product's explicit non-goals. Third, **equal sector emphasis is a methodology and interface commitment, not a data-count commitment** (clarified in Section 1.1).

### 1.1 What "equal emphasis" means (and does not mean)

The product requires all seven sectors to be first-class. Rev. 2 states precisely what that obligates for *sourcing*:

**Equal emphasis means equal:**
- **methodology** — the same source hierarchy, evidence-strength logic, AI-relevance taxonomy, triage process, and review checklist apply identically to every sector;
- **interface prominence** — equal card size, navigation access, and default filter availability in the dashboard and sector index (per Product Requirements);
- **opportunity to surface** — every sector is actively covered by at least one connector and the triage process, so a real signal in any sector has a genuine path into the queue; no sector is structurally excluded from discovery.

**Equal emphasis does NOT mean:**
- **equal data volume** — federal award and filing volume is genuinely uneven across sectors (e.g., defense-adjacent government operations and healthcare generate far more records than nonprofits); the pipeline must not fabricate parity by padding thin sectors or throttling active ones;
- **equal signal counts** — once live data exists, published-signal counts will differ by sector and that is expected and honest;
- **forcing a quota** — the system must never manufacture or upweight weak signals in a sparse sector to hit a visual balance.

The obligation is **equal process and equal access to discovery**, with **honest, unequal counts** where reality is unequal. Any sector view that cannot show comparable activity must attribute that to data availability, not present a manufactured number.

---

## 2. Comparison matrix

Legend — **Role:** primary source role (D = Discovery, V = Verification, C = Context, En = Enrichment, ER = Entity resolution). **Auth:** None = no key; Key = free API key; Acct = account/registration. **Tier:** authority of the *underlying* record. **First connector:** ✔ strong / ~ possible / ✗ not for first.

| # | Source | Tier (underlying) | Primary role | Primary sectors | Access | Auth | Documented rate limit | Cadence | License / terms | First connector | Confidence |
|---|--------|:-----------------:|:------------:|-----------------|--------|------|----------------------|---------|-----------------|:---------------:|:----------:|
| 1 | **USAspending.gov Award Search API** | 1 (direct) | **D + V** | All seven | REST/JSON + bulk download | None | None documented (batch; use bulk) | ~twice monthly per agency | U.S. Gov work; open | **✔** | High |
| 2 | **Grants.gov Search2 API** | 1 (direct) | **C + D** | Education, Nonprofits, Climate & Energy, Agriculture, Healthcare | REST/JSON (POST) | None | None documented | Continuous | U.S. Gov work | ~ | High |
| 3 | **SBIR/STTR Awards API (SBIR.gov)** | 1 (direct) | **D + V** | All seven (early R&D) | REST (JSON/XML) + downloads | None | Not clearly documented | Periodic loads | U.S. Gov work | ~ | Medium |
| 4 | **NIH RePORTER API v2** | 1 (direct) | **D + V** | Healthcare (+ Agriculture/bio) | REST/JSON | None | ~1 req/sec; 500/page, 10k/result | Regular | U.S. Gov work | ~ | High |
| 5 | **NSF Awards API (Research.gov)** | 1 (direct) | **D + V** | Education, Climate & Energy, Agriculture | REST (JSON/XML) | None | Not clearly documented | Regular | U.S. Gov work | ~ | Medium |
| 6 | **SEC EDGAR (filings + full-text + Form D)** | 1 (direct) | **V + En** | All seven (funding) | REST/JSON + full-text | None | 10 req/sec; declared User-Agent | Real-time | U.S. Gov work | ~ | High |
| 7 | **USPTO PatentsView / Open Data Portal** | 1 (direct; PatentsView is a derivative layer) | **D + C** | All seven (technical release) | REST/JSON | Key (PatentsView) | ~45 queries/min (PatentsView) | Periodic reload | U.S. Gov work; attribution requested | ✗ (early) | Medium |
| 8 | **Federal Register API** | 1 (direct) | **C + V** | Politics & Civic Tech, Government Operations | REST/JSON | None | No key; IP throttling possible | Daily (business days) | U.S. Gov work | ~ | High |
| 9 | **ProPublica Nonprofit Explorer API v2** | 1 underlying (IRS 990); **intermediary provenance** | **ER + En** | Nonprofits | REST/JSON | None | Not clearly documented | Periodic (IRS cycle) | Underlying 990 public domain; **API is ProPublica's — terms apply** | ✗ | Medium |
| 10 | **SAM.gov Opportunities / Entity API** | 1 (direct) | **ER + En + V** | Government Operations; procurement across all | REST/JSON | Key + Acct | Public 10/day; registered 1,000/day; federal 10,000/day | Daily | U.S. Gov work; account terms | ✗ (first) | High |

---

## 3. Source candidate records

Each record separates **Confirmed facts** from **Assessment**, and now states a **Primary Source Role** (Rev. 2). "Confirmed" means verified against official documentation during this assessment (July 2026). Links are in Section 7.

### 3.1 USAspending.gov Award Search API

**Primary source role: Discovery + Verification.** It surfaces companies transacting with government (discovery) and, for each, provides an authoritative award record that corroborates a signal (verification).

**Confirmed facts**
- Official name: USAspending.gov API (`api.usaspending.gov`), operated by the U.S. Department of the Treasury (Bureau of the Fiscal Service) under the DATA Act.
- Access method: public REST API returning JSON; a bulk-download endpoint exists for large volumes. A sandbox API is also published.
- Authentication: none required; no API key.
- Rate limits: no formal documented rate limit. Guidance is to batch large requests by date/filter and use the bulk-download endpoint for large volumes.
- Update cadence: agencies submit spending data on a recurring cycle (broadly twice-monthly), so records lag the underlying event.
- Licensing: U.S. Government work; data is offered openly for reuse.
- Tier: **1, direct** (Treasury is the authoritative source).
- Important fields: recipient name, recipient UEI, awarding agency/sub-agency, award type (contract/grant/loan), award amount, action/period-of-performance dates, place of performance, NAICS/PSC (contracts), CFDA/Assistance Listing (grants), award description.

**Assessment**
- Sectors covered: **all seven** — federal contracts and assistance flow to civic-tech vendors, government-operations tooling, agricultural programs, health systems, education, nonprofits, and climate/energy programs.
- Discovery value: **High.** Award descriptions and recipient lists surface companies that may not appear in press coverage.
- Verification value: **High.** An award record is a Tier 1 official record that directly corroborates a `government contract` or `grant or research award` signal, with amount and date.
- Entity-matching risks: **High.** Recipient names are legal entity names (often parents, resellers, or integrators), not product brands; UEI ties to an entity registration, not an "AI company" concept. Description text is terse. AI relevance must be inferred (see Sections 8–10) and human-reviewed.
- First-connector suitability: **Strong.** Best combination of open terms, no auth, cross-sector coverage, and high verification value.
- Confidence: **High.**

### 3.2 Grants.gov Search2 API

**Primary source role: Context + Discovery.** It describes funding *opportunities* (context on where sector money is offered) and can surface programs and applicant landscapes (secondary discovery). It does not by itself verify that a company received funds.

**Confirmed facts**
- Official name: Grants.gov RESTful APIs — `search2` endpoint (`api.grants.gov/v1/api/search2`), operated by HHS on behalf of the federal grant-making community.
- Access method: public REST API; `search2` is called via HTTP POST returning JSON. A "Simpler.Grants.gov" gateway also exists.
- Authentication: the public `search2` search endpoint requires no login or API key.
- Rate limits: none documented for the public search endpoint.
- Update cadence: funding opportunities are posted and updated continuously by agencies.
- Licensing: U.S. Government work. Tier: **1, direct.**
- Important fields: opportunity number/title, agency, Assistance Listing (CFDA) number, opportunity status, post/close dates, category, eligibility.

**Assessment**
- Sectors covered: strong for Education, Nonprofits, Climate & Energy, Agriculture, Healthcare; weaker for Politics & Civic Tech and core Government Operations tooling.
- Discovery value: **Medium** — opportunities (money offered), not awards (money granted); it signals where activity may occur, not that a specific company won anything.
- Verification value: **Medium** for the existence and terms of a funding program; it does **not** verify that a named company received funds.
- Entity-matching risks: **Low at the opportunity level** (opportunities are not company-specific).
- First-connector suitability: **Possible** second connector for grant context.
- Confidence: **High** on access facts.

### 3.3 SBIR/STTR Awards API (SBIR.gov)

**Primary source role: Discovery + Verification.** One of the best public windows into early-stage AI startups (discovery), with named-firm awards and abstracts (verification).

**Confirmed facts**
- Official name: SBIR.gov APIs (Awards, Company, Solicitations), administered by the U.S. Small Business Administration.
- Access method: REST API returning JSON or XML; bulk downloads (XLS/JSON/XML) also available. More award fields are available via download than via the API.
- Authentication: none required for the public API.
- Rate limits: not clearly documented (Company API defaults to 100 rows, paginating up to a 5,000-row limit).
- Update cadence: periodic per-agency data loads.
- Licensing: U.S. Government work. Tier: **1, direct.**
- Important fields (awards): firm name, UEI/DUNS, agency (DOD, HHS, NASA, NSF, DOE, USDA, EPA), award title, phase (I/II), amount, award date, abstract, PI, location.

**Assessment**
- Sectors covered: **all seven**, via agency spread — DOE (climate/energy), USDA (agriculture), HHS/NIH (healthcare), NSF (education-adjacent), plus civic and government tooling.
- Discovery value: **High.** Excellent early-stage deep-tech/AI signal with technology-describing abstracts.
- Verification value: **High.** Named-firm award with phase, amount, and abstract is a Tier 1 record.
- Entity-matching risks: **Medium.** Firm names and UEIs present (better than pure text), but small firms rebrand and spin out.
- First-connector suitability: **Possible / strong second.** Held back only by less clearly documented API stability (published maintenance notices) and rate limits.
- Confidence: **Medium** (access facts good; stability/limits less certain — see Open Questions).

### 3.4 NIH RePORTER API v2

**Primary source role: Discovery + Verification (sector-specific).** Surfaces AI-in-health projects and organizations (discovery) with authoritative grant records (verification), within healthcare.

**Confirmed facts**
- Official name: NIH RePORTER API v2 (`api.reporter.nih.gov`), National Institutes of Health.
- Access method: public REST API returning JSON (POST query bodies).
- Authentication: none required.
- Rate limits: NIH requests **no more than ~1 request/second** and asks that large jobs run off-peak. Documented caps: max 500 results per page and a maximum of 10,000 records per result set; IP blocking possible for abuse.
- Update cadence: regularly refreshed.
- Licensing: U.S. Government work. Tier: **1, direct.**
- Important fields: project title, abstract, PI(s), organization, award amount, fiscal year, funding IC, project terms, dates.

**Assessment**
- Sectors covered: **Healthcare** primarily; also Agriculture/bio overlap.
- Discovery value: **High** within health research.
- Verification value: **High** for grant/research-award signals in healthcare.
- Entity-matching risks: **Medium–High.** Awardees are frequently universities and hospitals, not companies; company signals often appear via subawards or PI affiliations (see Section 10 award distinctions).
- First-connector suitability: **Possible**, but healthcare-weighted, which conflicts with equal-sector *opportunity* for a *first* connector.
- Confidence: **High** on access facts.

### 3.5 NSF Awards API (Research.gov)

**Primary source role: Discovery + Verification (research-weighted).**

**Confirmed facts**
- Official name: NSF Award Search Web API (Research.gov / `api.nsf.gov`), National Science Foundation.
- Access method: REST API returning JSON or XML; awards from 2007 onward.
- Authentication: none required.
- Rate limits: not clearly documented.
- Update cadence: regularly updated.
- Licensing: U.S. Government work. Tier: **1, direct.**
- Important fields: award title, abstract, awardee organization, PI (name/email), program officer, funds obligated and estimated total, directorate/division, program element, CFDA, dates, performance location.

**Assessment**
- Sectors covered: **Education, Climate & Energy, Agriculture** (and general science).
- Discovery value: **High** for research-stage AI work and spinouts.
- Verification value: **High** for grant/research-award signals.
- Entity-matching risks: **Medium–High**, same university-vs-company issue as NIH RePORTER.
- First-connector suitability: **Possible** second connector, research-weighted.
- Confidence: **Medium** (rate-limit documentation unclear).

### 3.6 SEC EDGAR (filings, full-text search, Form D)

**Primary source role: Verification + Enrichment.** Confirms funding/corporate events (verification) and enriches a company profile with authoritative filer identity and financing disclosures (enrichment). Weak as a discovery firehose.

**Confirmed facts**
- Official name: SEC EDGAR APIs and full-text search (`data.sec.gov`, `efts.sec.gov`), U.S. Securities and Exchange Commission.
- Access method: public REST/JSON APIs plus full-text search (filings since 2001).
- Authentication: none required, **but** the SEC requires a declared descriptive `User-Agent` and enforces a **fair-access cap of 10 requests/second**; excessive requesters may be IP-blocked.
- Rate limits: 10 requests/second; some query interfaces cap results (~10,000 per query).
- Update cadence: real-time as filings are submitted.
- Licensing: U.S. Government work. Tier: **1, direct.**
- Important fields: filer name, CIK, filing type (e.g., Form D for exempt offerings), filing date; Form D adds issuer, offering amount, industry group, related persons.

**Assessment**
- Sectors covered: **all seven**, indirectly, via corporate/funding disclosures; Form D maps to `fundraising disclosure`.
- Discovery value: **Medium.** Many emerging private AI companies file little; Form D coverage is partial and self-reported.
- Verification value: **High** where a filing exists.
- Entity-matching risks: **Medium.** CIK is a strong identifier; Form D issuer names can be SPVs/holding entities.
- First-connector suitability: **Possible** second connector; fair-access rules and User-Agent must be built in from the start.
- Confidence: **High** on access facts.
- Methodology caution: fundraising is explicitly **not** proof of impact.

### 3.7 USPTO PatentsView / Open Data Portal

**Primary source role: Discovery + Context.** Assignee organizations offer discovery leads; patents provide technical-release context. Note PatentsView is a government-supported *analytical derivative*; prefer the Open Data Portal for authoritative citation.

**Confirmed facts**
- Official name: PatentsView API and the USPTO Open Data Portal (ODP) Search/Assignment APIs, U.S. Patent and Trademark Office.
- Access method: REST API returning JSON.
- Authentication: PatentsView is free; the ODP APIs may require a key. (Which surface to use is an Open Question.)
- Rate limits: PatentsView documents ~45 queries/minute.
- Update cadence: periodic data reloads.
- Licensing: U.S. Government work; USPTO requests attribution ("Data sourced from PatentsView").
- Tier: **1 underlying (the granted patent)**; PatentsView's disambiguated assignee is an **analytical enrichment**, not primary fact.
- Important fields: patent title/abstract, assignee organization, inventor, CPC/USPC classification, grant/filing dates, patent type.

**Assessment**
- Sectors covered: **all seven** (technical-release), skewed toward companies that patent.
- Discovery value: **Medium.** Patents lag invention by years; many AI startups do not patent.
- Verification value: **Medium–High** for a `technical release` signal; weak as evidence of market impact.
- Entity-matching risks: **High.** Assignee-name disambiguation is a known hard problem.
- First-connector suitability: **Not first** — high entity-resolution burden, lagging signal, attribution obligation.
- Confidence: **Medium.**

### 3.8 Federal Register API

**Primary source role: Context + Verification.** Provides authoritative policy/regulatory context and verifies `policy or regulatory development` signals; companies appear incidentally, so it is weak for company discovery.

**Confirmed facts**
- Official name: Federal Register API v1 (`federalregister.gov/api/v1`), Office of the Federal Register / GPO.
- Access method: public REST API returning JSON or CSV; interactive documentation published.
- Authentication: none required; no API key issued.
- Rate limits: no key-based limits, but aggressive querying can trigger temporary IP throttling.
- Update cadence: published on federal business days.
- Licensing: U.S. Government work. Tier: **1, direct.**
- Important fields: document title, agency, document type (rule/proposed rule/notice), publication date, abstract, docket, effective dates.

**Assessment**
- Sectors covered: **Politics & Civic Technology** and **Government Operations** most directly; touches other sectors when regulation names them.
- Discovery value: **Medium** for `policy or regulatory development` signals, not companies per se.
- Verification value: **High** for regulatory/policy signals.
- Entity-matching risks: **Low–Medium.**
- First-connector suitability: **Possible** for the two civic/government sectors; does not serve equal-sector discovery on its own.
- Confidence: **High.**

### 3.9 ProPublica Nonprofit Explorer API v2

**Primary source role: Entity resolution + Enrichment.** Best used to resolve and enrich nonprofit identities (EIN, scale, mission), not as a primary discovery firehose or an authoritative citation in its own right.

**Confirmed facts**
- Official name: ProPublica Nonprofit Explorer API v2, operated by **ProPublica** over IRS Form 990 data.
- Access method: public REST/JSON API (organization lookup + full-text search).
- Authentication: none documented for basic use.
- Rate limits: not clearly documented.
- Update cadence: tied to the IRS release cycle for 990 filings (significant lag).
- **Provenance / tier: the underlying IRS Form 990 data is Tier 1 public-domain record; ProPublica is a third-party intermediary.** Cite/link the original IRS filing as canonical where available; record ProPublica as the retrieval path, not the authority.
- Licensing: underlying 990 data is public domain; **the API itself is ProPublica's service and its terms of use govern reuse** — must be confirmed before building on it.
- Important fields: organization name, EIN, subsection, revenue/assets, filing years, officer data, NTEE category.

**Assessment**
- Sectors covered: **Nonprofits** primarily.
- Discovery value: **Low–Medium**; 990s do not describe AI activity directly.
- Verification/enrichment value: **Medium–High** for organizational existence, scale, and mission.
- Entity-matching value: **High** — EIN is a strong identifier for resolving nonprofit entities.
- First-connector suitability: **Not first** — intermediary provenance, API-terms review outstanding, single-sector. If adopted, prefer routing to the original IRS filing (or IRS bulk 990 data) as canonical.
- Confidence: **Medium.**

### 3.10 SAM.gov Opportunities / Entity API

**Primary source role: Entity resolution + Enrichment + Verification.** Its highest value is resolving award recipients (UEI cross-walk with USAspending) and enriching entity records; also an authoritative opportunity/registration record.

**Confirmed facts**
- Official name: SAM.gov Get Opportunities Public API and Entity Management API (`api.sam.gov`), U.S. General Services Administration.
- Access method: public REST/JSON APIs.
- Authentication: **API key required**; the Entity Management API additionally requires an approved System Account (registration).
- Rate limits: tiered and strict — **public: 10 requests/day; registered entity: 1,000/day; federal system: 10,000/day**; exceeding returns HTTP 429 with reset at midnight UTC (no sliding window).
- Update cadence: daily.
- Licensing: U.S. Government work; account/system-account terms apply. Tier: **1, direct.**
- Important fields: opportunity notice ID/title, agency, NAICS, set-aside, posted/response dates; entity records include UEI, legal name, registration status, NAICS, physical address.

**Assessment**
- Sectors covered: **Government Operations** and procurement across all seven.
- Discovery value: **Medium.** Entity data mainly helps resolve award recipients rather than surface new ones.
- Verification/enrichment value: **High** — authoritative registration/opportunity record and a strong **companion to USAspending** for entity resolution.
- Entity-matching value: **High** (UEI authoritative).
- First-connector suitability: **Not first.** API key + System Account registration (reported multi-week approval) and the very low public tier (10/day) make it operationally heavy. Reserve as an enrichment source once USAspending is live.
- Confidence: **High** on access facts.

---

## 4. Recommendation — safest and most useful first connector

**Recommended first connector: USAspending.gov Award Search API (source #1). Primary role: Discovery + Verification.**

**Why it is the safest**
- **No credentials to manage.** No API key, no account, no service-role secret — nothing that could leak into a client bundle.
- **Terms clearly permit programmatic access.** Public government API with an explicit bulk-download path; data is a U.S. Government work offered openly. No scraping, no ambiguous terms-of-service — respecting the rule against building on sources whose terms do not clearly permit it.
- **No hard rate limit to trip**, with an official bulk path for volume, so ingestion can be polite by construction.

**Why it is the most useful**
- **Tier 1 verification value.** Every record is an official federal award — the strongest evidence class — directly supporting `government contract` and `grant or research award` signals with amount and date.
- **Equal-sector reach.** Federal contracts and assistance touch all seven sectors, so a first connector built on it gives every sector an *opportunity to surface* (Section 1.1) without privileging any sector by construction. Sector assignment is driven by agency/CFDA/NAICS plus review, not a hardcoded bias, and unequal counts are reported honestly.
- **Model fit.** Fields map cleanly onto `source_documents` and onto draft `signals` with `created_by_type = import`, feeding the existing draft-then-review pipeline.

**What it is explicitly *not***
- Not a source of "AI companies." AI relevance is inferred via the taxonomy (Section 8) and triage (Section 9); every candidate enters the research queue as a **draft** for human review — no autonomous publication.
- Not evidence of impact or success — only that an award event occurred.

**Suggested guardrails for the first build (recommendation, not yet approved)**
- Ingest as **drafts only** (`research_items.item_type = new_signal` / `new_company`), never auto-publish; record an `ingestion_runs` row per pull.
- Store the canonical USAspending award URL and a content hash in `source_documents`; set `source_tier = 1`, `claim_type = official_record`.
- Apply the two-stage triage (Section 9); log the Stage-1 filter and the Stage-2 AI-relevance class for every surfaced record.
- Do **not** merge entities automatically; emit `entity_match` research items for reviewer confirmation.
- Prefer the bulk-download endpoint for backfills and honor a self-imposed polite request rate.

---

## 5. Proposed source-registry record (for the recommended connector)

Draft record for review. Field names mirror the `source_documents` / `ingestion_runs` model in `DATA_MODEL.md`. This is a *proposal*; it creates no company claims.

```yaml
connector_key: usaspending_award_search
official_name: "USAspending.gov Award Search API"
issuing_organization: "U.S. Department of the Treasury, Bureau of the Fiscal Service"
status: proposed            # proposed | approved | active | retired
source_tier: 1              # Tier 1 — direct primary/authoritative (official award record)
provenance: direct          # direct | intermediary | derivative
default_claim_type: official_record
primary_source_role: [discovery, verification]
sectors_covered: [politics-civic-technology, government-operations, agriculture,
                  healthcare, education, nonprofits, climate-energy]
sector_assignment_method: "Derived from awarding agency + CFDA/Assistance Listing + NAICS/PSC, confirmed in human review. No default sector. Counts reported honestly; no quota."
access_method: rest_api      # rest_api + bulk_download
base_url: "https://api.usaspending.gov/api/v2/"
bulk_download: true
authentication: none
credentials_required: false
documented_rate_limit: "None published; batch large jobs and prefer bulk download."
self_imposed_rate_limit: "<= 1 request/sec sustained; bulk endpoint for backfill"  # recommendation
update_cadence: "Agency submissions ~twice monthly; expect lag between event and record."
license: "U.S. Government work; openly available for reuse."
attribution_required: false
maps_to_signal_types: [government contract, grant or research award]
ai_relevance:
  taxonomy_version: "0.1 (see Section 8)"
  triage: "two-stage (see Section 9); Stage-1 filter + Stage-2 class logged per record"
key_fields:
  - recipient_name
  - recipient_uei
  - awarding_agency
  - awarding_sub_agency
  - award_type            # contract | grant | loan | direct payment
  - award_amount
  - action_date
  - period_of_performance
  - place_of_performance
  - naics_or_psc          # contracts
  - cfda_assistance_listing # grants
  - award_description
  - usaspending_permalink   # -> source_documents.canonical_url
entity_matching:
  primary_identifier: recipient_uei
  risks: "Recipient is a legal entity (often parent/reseller/integrator), not an AI product brand; descriptions terse; AI relevance inferred, not stated."
  policy: "Emit entity_match research items; never auto-merge."
ingestion_policy:
  publication: "Draft only (created_by_type = import); no autonomous publish."
  audit: "One ingestion_runs row per pull; store content_hash + retrieved_at."
  award_relevance_classes: "see Section 10 (company / AI-enabled project / non-company institution / insufficient)"
is_demo: false
confidence_in_assessment: high
verification_notes: "Access facts confirmed against api.usaspending.gov documentation, July 2026."
```

---

## 6. Open questions requiring human review

1. **AI-relevance taxonomy tuning.** Section 8 is v0.1. Which positive indicators and minimum-evidence thresholds does the reviewer accept, and where should thresholds be stricter to reduce false positives?
2. **Equal-sector fairness in practice.** Given honestly unequal volumes (Section 1.1), how should sparse-sector views communicate low counts as a data-availability fact rather than a signal of lower importance?
3. **Entity resolution scope.** Full production entity resolution is an MVP non-goal. What is the minimum viable, human-in-the-loop matching (UEI + aliases) that is good enough for review without overreaching?
4. **SBIR.gov API stability.** SBIR.gov has published maintenance notices and its rate limits are not clearly documented. Confirm current availability and limits with SBA before treating it as connector #2. *(UNCONFIRMED.)*
5. **ProPublica API terms & canonical routing.** The 990 *data* is public domain, but the *ProPublica API* has its own terms. Confirm reuse is permitted, and whether the IRS's own bulk 990 data (or AWS-hosted filings) is a cleaner canonical source to link. *(UNCONFIRMED.)*
6. **USPTO surface choice.** PatentsView (key, enriched/derivative) vs. Open Data Portal (raw, may need key). Which is the supported long-term surface, and does the attribution requirement create a UI obligation? *(UNCONFIRMED.)*
7. **SEC User-Agent policy.** Confirm the exact declared `User-Agent` and contact convention, and build the 10 req/sec cap into any client from day one.
8. **Data-freshness disclosure.** Several sources lag the event (USAspending ~twice-monthly; 990s by months). How should the UI express "record date vs. event date," per the methodology's event-date-vs-publication-date rule?
9. **Retention policy.** `RESEARCH_METHODOLOGY.md` requires a documented retention policy per source. What retention applies to stored excerpts and content hashes per connector?
10. **Prompt-injection hygiene.** Award descriptions, abstracts, and filing text are untrusted input. Confirm the Stage-2 classifier never executes instructions found in source text (a stated principle needing a concrete test).

---

## 7. Official source links

- USAspending.gov API documentation — https://api.usaspending.gov/docs/endpoints
- USAspending.gov intro tutorial (sandbox) — https://sandbox-api.usaspending.gov/docs/intro-tutorial
- Grants.gov API guide — https://www.grants.gov/api/api-guide
- Grants.gov Search2 endpoint — https://grants.gov/api/common/search2
- SBIR.gov API — https://www.sbir.gov/api
- SBIR.gov data resources — https://www.sbir.gov/data-resources
- NIH RePORTER API — https://api.reporter.nih.gov/
- NSF Award Search Web API — https://resources.research.gov/common/webapi/awardapisearch-v1.htm
- NSF developer resources — https://www.nsf.gov/digital/developer
- SEC EDGAR developer resources — https://www.sec.gov/about/developer-resources
- SEC "Accessing EDGAR Data" (fair access) — https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
- USPTO PatentsView — https://www.uspto.gov/ip-policy/economic-research/patentsview
- USPTO Open Data Portal (Search API) — https://data.uspto.gov/apis/patent-file-wrapper/search
- Federal Register API documentation — https://www.federalregister.gov/developers/documentation/api/v1
- Federal Register developer resources — https://www.federalregister.gov/reader-aids/developer-resources/rest-api
- ProPublica Nonprofit Explorer API — https://projects.propublica.org/nonprofits/api
- SAM.gov Get Opportunities Public API — https://open.gsa.gov/api/get-opportunities-public-api/
- SAM.gov Entity Management API — https://open.gsa.gov/api/entity-api/
- SAM.gov web service rate limits — https://api.sam.gov/docs/rate-limits/

---

## 8. AI-relevance taxonomy (v0.1)

Purpose: give reviewers a **consistent, conservative** vocabulary for classifying whether a record (e.g., a USAspending award, an SBIR abstract, an NSF grant) reflects genuine AI activity. This is a *review aid for draft items*, not an auto-publish rule. It runs on the description/abstract text plus structured fields (agency, NAICS/PSC, CFDA).

**Bias: toward under-classifying.** When indicators are weak or ambiguous, prefer "AI-adjacent — insufficient evidence" over a specific AI class. **Human review is mandatory for every class except the two terminal classes** ("AI-adjacent — insufficient evidence" and "Not AI-related"), which route records *out* of the AI pipeline and therefore require review only if a human contests the exclusion.

Each class below gives: **Definition · Positive indicators · Common false positives · Minimum evidence required · Human review mandatory?**

### 8.1 Explicit artificial intelligence
- **Definition:** The record itself names artificial intelligence as the subject of the work.
- **Positive indicators:** Terms "artificial intelligence," "AI system," "AI model," "AI-based," used to describe the deliverable (not just background).
- **Common false positives:** "AI" as an acronym for something else (e.g., "aortic insufficiency," "artificial insemination," "Amnesty International"); boilerplate agency-priority language ("in support of the national AI strategy") that does not describe the funded work.
- **Minimum evidence required:** At least one explicit AI reference tied to the scope of work, not solely to background/justification.
- **Human review mandatory?** **Yes.**

### 8.2 Machine learning or predictive analytics
- **Definition:** Work centered on models that learn from data to predict, classify, or score.
- **Positive indicators:** "machine learning," "deep learning," "neural network," "predictive model/analytics," "classifier," "training data," named methods (gradient boosting, random forest).
- **Common false positives:** Generic "data analytics," "statistical analysis," or "dashboards" with no learned model; "predictive" used loosely for rule-based forecasting.
- **Minimum evidence required:** A described learned/trained model or a named ML method applied to the work.
- **Human review mandatory?** **Yes.**

### 8.3 Natural-language processing
- **Definition:** Work whose core is machine processing of human language (text/speech).
- **Positive indicators:** "NLP," "language model," "text classification," "named-entity recognition," "speech recognition," "machine translation," "chatbot/conversational."
- **Common false positives:** Plain full-text search, keyword matching, or OCR alone; "language services" meaning human translation/interpretation.
- **Minimum evidence required:** A described NLP task or model applied to language data.
- **Human review mandatory?** **Yes.**

### 8.4 Computer vision
- **Definition:** Machine interpretation of images or video.
- **Positive indicators:** "computer vision," "image/object/facial recognition," "image segmentation," "video analytics," "remote-sensing classification."
- **Common false positives:** Ordinary imaging hardware, photography, or GIS mapping with no learned interpretation; medical imaging *devices* without an analytic model.
- **Minimum evidence required:** A described vision task performed by a model/algorithm.
- **Human review mandatory?** **Yes.**

### 8.5 Autonomous systems
- **Definition:** Physical or cyber-physical systems that sense and act with reduced human control.
- **Positive indicators:** "autonomous vehicle/UAV/robot," "self-navigating," "autonomy stack," "sense-and-avoid," "unmanned system" with decision-making.
- **Common false positives:** Remote-controlled or teleoperated equipment; "automation" meaning scripted/RPA business automation (which may be AI-adjacent, not autonomous).
- **Minimum evidence required:** Described self-directed sensing/decision/action beyond fixed automation.
- **Human review mandatory?** **Yes.**

### 8.6 Agentic workflows
- **Definition:** Software agents that plan and execute multi-step tasks with limited human intervention (directly relevant to the product's `agent_*` classifications).
- **Positive indicators:** "autonomous agent," "AI agent," "tool-using agent," "multi-agent," "orchestration of tasks," "plans and executes," "human-in-the-loop agent."
- **Common false positives:** "Agent" meaning a person (field agent, insurance agent) or a simple software daemon; workflow tools with no autonomous planning.
- **Minimum evidence required:** Described autonomous or semi-autonomous multi-step task execution by software.
- **Human review mandatory?** **Yes** (and important for correct `company_type` assignment).

### 8.7 Generative AI
- **Definition:** Models that generate novel content (text, image, audio, video, code).
- **Positive indicators:** "generative AI," "GenAI," "large language model," "foundation model," "diffusion model," "text-to-image," "synthetic data generation."
- **Common false positives:** "Generation" in a non-AI sense (power generation, lead generation, report generation from templates).
- **Minimum evidence required:** A described generative model producing content.
- **Human review mandatory?** **Yes.**

### 8.8 AI infrastructure
- **Definition:** Provision of models, compute, data, security, evaluation, or orchestration that *enables* AI (maps to `ai_infrastructure`).
- **Positive indicators:** "model hosting/serving," "MLOps," "vector database," "GPU/accelerator compute," "training platform," "model evaluation/red-teaming," "data labeling," "AI orchestration."
- **Common false positives:** General cloud/IT infrastructure with no AI-specific role; ordinary data warehousing.
- **Minimum evidence required:** A described component whose purpose is to enable AI systems specifically.
- **Human review mandatory?** **Yes.**

### 8.9 AI-adjacent but insufficient evidence *(terminal — routes out pending contest)*
- **Definition:** The record plausibly touches AI but lacks enough detail to assign a specific class.
- **Positive indicators:** Vague "advanced analytics," "smart," "intelligent," "algorithm-driven," or a single ambiguous keyword with no scope detail.
- **Common false positives:** Marketing language ("smart," "intelligent") on non-AI products.
- **Minimum evidence required:** *By definition insufficient* — hold as a lead, not a signal. Do not create an AI signal from this class alone.
- **Human review mandatory?** **Optional** — routes the record out of the AI pipeline; review only if a human contests the exclusion or requests more evidence.

### 8.10 Not AI-related *(terminal — excluded)*
- **Definition:** No credible AI relevance.
- **Positive indicators:** No AI/ML/NLP/vision/autonomy/generative/infrastructure content; keyword hits resolve to false positives (e.g., "AI" = a different acronym).
- **Common false positives:** N/A (this *is* the exclusion bucket; the risk is wrongly excluding a real signal, so borderline cases should go to 8.9, not here).
- **Minimum evidence required:** Reviewer or Stage-1 filter confidence that AI signals are absent or spurious.
- **Human review mandatory?** **Optional** — excluded from the pipeline; review only on contest.

---

## 9. Proposed two-stage triage process (conservative)

A record must clear both stages before a human sees it as a draft signal. The design goal is **high precision at the queue**, accepting that some real signals are missed (they can be recovered later); the methodology forbids autonomous publication, so nothing here publishes anything.

### Stage 1 — Deterministic pre-filter (no AI)
Purely rule-based and fully logged, so any surfaced record can be traced to the exact rule that surfaced it.

- **Keyword/phrase filter** over title + description/abstract, using the taxonomy's positive-indicator vocabulary (Section 8), with an **exclusion list** for known false-positive expansions ("aortic insufficiency," "artificial insemination," etc.).
- **Classification-code filter** — retain or boost records with AI-relevant NAICS/PSC (e.g., software/computer-services, R&D codes) or CFDA/Assistance-Listing programs known to fund AI/R&D.
- **Agency filter** — weight agencies/programs with concentrated AI activity (e.g., NSF CISE, DOE, NIH, DoD research), without excluding others outright (equal-sector opportunity).
- **Description-quality gate** — require enough descriptive text to classify; records with empty/boilerplate descriptions route to "insufficient evidence" (8.9), not into the queue.
- **Output:** a candidate set with, per record, the matched keywords, codes, and agency flags recorded for audit.

### Stage 2 — Structured AI-assisted classification, then human review
- **AI-assisted classification (assist only).** A model assigns a single Section-8 class plus a confidence and a short rationale, and a Section-10 award-relevance type. It operates only on record text/fields; **it never executes instructions embedded in source text** (prompt-injection hygiene) and **never converts an inference into a fact** (methodology rule). Low-confidence or ambiguous outputs default to 8.9.
- **Mandatory human review.** Every record that Stage 2 places in an AI class (8.1–8.8) enters the research queue as a **draft** `research_item` for a human reviewer, who applies the existing review checklist (correct company? event vs. publication date? source original? claim labeled? contradictions? sector supported?).
- **No auto-publish.** Consistent with `created_by_type = ai` records being barred from draft→published transition without human approval.
- **Full auditability.** Stage-1 rule hits, Stage-2 class + confidence + rationale, and reviewer action are all stored (supports `review_actions` audit trail).

**Net effect:** deterministic recall control first, AI *assistance* second, human judgment last — conservative by construction.

---

## 10. Award-relevance distinctions (for USAspending-style records)

To keep signals honest, classify *what an award actually evidences* before it becomes a company signal. These four cases are mutually exclusive and must be recorded on the draft item.

1. **Government award involving an AI company.** The **recipient is a company whose product/business is AI** (or materially AI, per Section 8 and the `company_type` classifications) and the award is *to that company*.
   - *Evidence needed:* recipient resolves (UEI + name + website/aliases) to a company with independent AI evidence, and the award scope is AI-relevant. *→ Candidate `government contract`/`grant` signal on a company profile.*

2. **Government award involving an AI-enabled project.** The award funds AI work, **but** the recipient is not (or not yet shown to be) an AI *company* — e.g., a traditional contractor or integrator delivering an AI-enabled project, or AI is one component of a larger scope.
   - *Evidence needed:* AI-relevant scope confirmed; recipient's identity-as-AI-company **not** established. *→ Signal about the project/scope, with explicit caveat that the recipient is not characterized as an AI company; may prompt an `entity_match` lead.*

3. **Government award mentioning AI but awarded to a non-company institution.** Recipient is a **university, hospital, government body, or nonprofit**, not a company (common in NIH/NSF records).
   - *Evidence needed:* AI mention present; recipient is an institution. *→ Context/discovery lead (possible company link via PI, subaward, or spinout) — **not** a company signal until a company is identified. Route to review; do not attach to a company profile on the strength of the mention alone.*

4. **Award with insufficient evidence of AI relevance.** AI relevance is unclear or rests only on ambiguous keywords (Section 8.9), regardless of recipient type.
   - *Evidence needed:* below the minimum-evidence bar. *→ Hold as a lead; do **not** create an AI signal. Recoverable if stronger evidence appears.*

**Rule of thumb:** *recipient-is-an-AI-company* and *scope-is-AI* are independent questions. Only case 1 supports a company-level AI signal directly; cases 2–3 are leads or caveated project signals; case 4 stays out of the pipeline.

---

## 11. Change log (Rev. 1 → Rev. 2)

- **Source tiers corrected.** Replaced the blanket "all ten are Tier 1 official-record sources" with an explicit three-way distinction: direct Tier 1 government sources (9), a third-party intermediary over Tier 1 records (ProPublica Nonprofit Explorer), and a note on government-supported analytical derivatives (USPTO PatentsView). Added a source-tier subsection under "How to read this document," and a `provenance` field to the registry record. `source_tier` now reflects underlying-record authority; provenance is tracked separately, with originals linked as canonical for intermediaries.
- **Primary Source Role added** to every candidate (Section 3 headers and the comparison matrix): Discovery, Verification, Context, Enrichment, Entity resolution, or a justified combination.
- **Equal-emphasis clarified** (new Section 1.1): equal methodology, interface prominence, and opportunity to surface — explicitly **not** equal data volume or signal counts, and no quota-padding.
- **AI-relevance taxonomy added** (new Section 8, v0.1): ten classes, each with definition, positive indicators, common false positives, minimum evidence, and human-review requirement; conservative bias toward under-classification.
- **Two-stage triage added** (new Section 9): Stage 1 deterministic keyword/classification-code/agency/description filtering; Stage 2 AI-assisted classification followed by mandatory human review; no autonomous publication.
- **Award-relevance distinctions added** (new Section 10): AI company vs. AI-enabled project vs. AI-mention-to-non-company-institution vs. insufficient evidence.
- **Registry record updated** to add `provenance`, `primary_source_role`, `ai_relevance`, and award-relevance references.
- **Open questions updated** to reference taxonomy tuning, equal-sector honesty, and canonical routing for intermediaries.
- **Scope reaffirmed:** still a methodology artifact — no connector implemented, no API called, no live company profiles, no rankings.

---

## 12. Recommended next research artifact

**A "USAspending First-Connector Field-Mapping & Review Spec."** With sources assessed and the AI-relevance taxonomy and triage defined, the next artifact should specify — still without writing connector code — exactly how a USAspending award record maps to `source_documents`, `signals`, and `research_items`; the concrete Stage-1 filter (keyword list, NAICS/PSC and CFDA code sets, agency weights, exclusion terms); the Stage-2 classification prompt contract and its guardrails; and a **small, hand-labeled validation set** (e.g., 50–100 real award descriptions classified by a human against Section 8) to measure the taxonomy's precision/recall before any build. That artifact turns this assessment into an approvable, testable connector plan while keeping a human in the loop.

*(A secondary candidate: an "Entity-Resolution Policy" defining the minimum viable UEI + alias matching and the `entity_match` review flow, since that risk is common to nearly every source here.)*

---

*Prepared as a research artifact for human review. Nothing in this document is an approved connector, a company claim, or a ranking. Access facts were verified against official documentation in July 2026; verify again before implementation, as government APIs and terms change.*
