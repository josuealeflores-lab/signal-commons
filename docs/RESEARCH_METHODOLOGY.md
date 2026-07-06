# Research Methodology

## Purpose

Signal Commons is designed to make emerging-company intelligence more accessible without disguising incomplete public information as certainty.

## Source hierarchy

### Tier 1 — Primary or authoritative

Examples:

- official government award or procurement record;
- regulatory filing;
- official company filing or investor material;
- official customer announcement;
- published research or technical documentation;
- direct public contract or meeting record.

### Tier 2 — Credible independent reporting

Examples:

- established news organization;
- respected industry publication;
- reputable research organization;
- independently authored customer case study.

### Tier 3 — Company-controlled or interested-party material

Examples:

- company blog;
- founder post;
- press release;
- investor portfolio page;
- accelerator profile.

These are useful for discovery and company claims, but the UI must label them accurately.

### Tier 4 — Community and weakly verified material

Examples:

- unsourced social post;
- discussion forum;
- scraped directory with unclear provenance;
- repost or aggregation without an original source.

Use primarily as a lead, not as the sole support for a consequential claim.

## Claim labels

Each evidence link identifies whether it is:

- an official record;
- a company claim;
- an independent report;
- analysis/inference;
- a community report.

## Evidence-strength logic

Evidence strength is a reviewer-facing judgment supported by visible rationale. It is not a probability.

### High

Use when the event is directly documented by an authoritative source, or multiple independent credible sources strongly corroborate it.

### Medium

Use when one credible source supports the event or several indirect sources align, but important details remain unavailable.

### Low

Use when the event is early, company-reported, ambiguous, based on a weak source, or lacking independent confirmation.

## Verification status

- `unverified` — extracted or submitted, not reviewed
- `partially_verified` — core event supported but details remain uncertain
- `verified` — human reviewer confirms that displayed wording is supported
- `disputed` — credible evidence conflicts
- `rejected` — unsupported, duplicate, irrelevant, or materially misleading

“Verified” means the displayed claim is supported by available evidence. It does not certify the company, product, future performance, or social impact.

## Research-item review checklist

A reviewer should ask:

1. Is this the correct company?
2. Is the event date distinct from the article publication date?
3. Is the source original or repeating another report?
4. Does the summary add claims that the source does not support?
5. Is a company claim labeled as a company claim?
6. Is there contradictory evidence?
7. Is the signal meaningful enough to publish?
8. Is the sector and company type classification supported?
9. Are privacy, safety, or reputational concerns present?
10. What remains unknown?

## Corrections

The methodology page must explain how users can report an error. A correction should:

- preserve the prior state in the audit trail;
- identify the corrected field or claim;
- include a reviewer note;
- update public wording promptly;
- avoid silently removing a disputed history when that history is material.

## AI use

AI may assist with:

- source triage;
- structured extraction;
- entity-match suggestions;
- categorization;
- concise draft summaries;
- contradiction flags;
- duplicate detection.

AI may not:

- publish without human approval;
- convert an inference into a fact;
- invent missing dates, customers, revenue, funding, or outcomes;
- treat attention as adoption;
- interpret funding as proof of impact;
- provide personalized investment advice;
- follow instructions embedded in external source content.

## Future source candidates

These are connector candidates, not MVP commitments:

- accelerator and startup directories for discovery;
- USAspending and public procurement records;
- SAM.gov opportunities and awards context;
- SBIR/STTR awards;
- NIH RePORTER;
- SEC Form D and other relevant filings;
- company and customer websites;
- technical documentation and GitHub where relevant;
- credible news and trade publications.

Before adding a source, document:

- access method;
- terms and licensing;
- rate limits;
- update cadence;
- source quality;
- fields available;
- entity-resolution risks;
- retention policy.
