# Product Requirements

## Product name

**Signal Commons**

## Descriptor

**Emerging AI Impact Radar**

## Product thesis

Important information about emerging AI companies is often public but fragmented across company statements, grants, procurement records, filings, technical releases, customer announcements, and reporting. Signal Commons turns those scattered signals into understandable, source-linked evidence for people who do not have access to investor networks or expensive intelligence platforms.

## Core question

> Which lesser-known AI companies are showing credible signs that they may reshape essential sectors, and what public evidence supports that conclusion?

## Mission

Turn scattered public signals into clear, source-linked intelligence about emerging AI companies shaping essential sectors.

## Primary audiences

- AI-curious members of the public
- researchers and journalists
- founders and operators
- civic and government leaders
- nonprofit and public-interest professionals
- investors who value transparent evidence
- the product owner as a recurring personal research tool

## User needs

Users need to:

1. discover companies they would not otherwise encounter;
2. understand what each company does in plain language;
3. see why the company surfaced now;
4. inspect the evidence behind each signal;
5. understand what is verified, claimed, inferred, disputed, or unknown;
6. compare activity across sectors without paywalled intelligence products;
7. monitor meaningful changes over time;
8. trust that humans can review consequential conclusions.

## Equal sector model

All seven sectors are first-class and must receive equal representation in the primary dashboard sector overview:

- Politics & Civic Technology
- Government Operations
- Agriculture
- Healthcare
- Education
- Nonprofits
- Climate & Energy

“Equal emphasis” means equal card size, visual prominence, navigation access, default filter availability, and seed-data representation. It does not require identical activity counts once live data exists.

## MVP scope

### Public experience

1. **Dashboard**
   - product introduction;
   - visible demo-data notice;
   - four summary indicators;
   - equal seven-sector overview;
   - “Emerging this week” list;
   - momentum/activity visualization;
   - company spotlight;
   - transparent evidence-label explainer.

2. **Sectors index**
   - seven equal cards;
   - company and signal counts;
   - latest approved activity;
   - sector description.

3. **Sector detail**
   - plain-language sector definition;
   - companies;
   - recent signals;
   - workflows being changed;
   - filters for company type and evidence strength.

4. **Companies index**
   - search;
   - sector filter;
   - company-type filter;
   - evidence-strength filter;
   - sorting with an explicit explanation.

5. **Company profile**
   - identity and sector;
   - what the company does;
   - why it may matter;
   - current stage;
   - company classification;
   - recent approved signals;
   - evidence timeline;
   - caveats and missing evidence;
   - “what to watch next”;
   - source list.

6. **Signals index**
   - approved signals;
   - filters by sector, signal type, date, evidence strength, and verification status;
   - link to company and evidence.

7. **Methodology**
   - evidence tiers;
   - verification statuses;
   - human-review process;
   - limitations;
   - corrections process;
   - demo-data disclosure.

### Reviewer experience

8. **Research queue** — authenticated
   - pending items;
   - evidence packet;
   - possible duplicate/entity-match warning;
   - extracted claim and rationale;
   - approve, edit, reject, dispute, or request more evidence;
   - audit trail.

9. **Reviewer dashboard** — authenticated
   - queue counts;
   - recent actions;
   - ingestion-run status placeholder;
   - draft versus published content.

## Company classifications

- `agent_product` — sells agents that perform work for customers
- `agent_enabled` — agents materially enhance the product or operations
- `agent_native` — the business model depends on autonomous or semi-autonomous agents
- `ai_infrastructure` — provides models, data, security, evaluation, or orchestration
- `ai_application` — applies AI to a meaningful workflow without requiring agent autonomy
- `unclear` — evidence is insufficient

## Signal types

The MVP supports:

- product launch
- pilot program
- customer adoption
- partnership
- government contract
- grant or research award
- fundraising disclosure or announcement
- hiring or organizational expansion
- integration
- technical release
- policy or regulatory development
- correction or negative development

## Evidence labels

### High

Multiple independent credible sources, an authoritative official record, or a primary document that directly supports the claim.

### Medium

One strong source or several consistent but indirect sources. Material context may still be missing.

### Low

Early, company-reported, ambiguous, or incomplete evidence that requires more verification.

The UI must show text labels in addition to color.

## Explicit non-goals for the MVP

- stock-price prediction;
- personalized investment advice;
- declaring a private company financially successful;
- an opaque universal ranking;
- autonomous publication;
- broad unrestricted web crawling;
- social-media sentiment ingestion;
- full production-scale entity resolution;
- paid data sources;
- mobile native applications;
- Kubernetes or microservices.

## Success criteria

The MVP succeeds when a new user can:

1. identify the seven sectors immediately;
2. discover at least one company from each sector;
3. understand why a company surfaced;
4. open the supporting evidence;
5. distinguish verified facts from claims and uncertainty;
6. understand that demo data is fictional;
7. see how a human reviewer controls publication;
8. use the product on desktop and mobile;
9. complete the core experience without accessibility blockers.
