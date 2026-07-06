# Data Model

## Modeling principle

A company profile is a published interpretation assembled from claims and signals. The original evidence must remain inspectable.

## Core entities

### `sectors`

Canonical seven-sector taxonomy.

Important fields:

- `id`
- `slug` unique
- `name`
- `description`
- `display_order`
- `icon_key`
- `created_at`

Seed exactly seven rows.

### `companies`

Important fields:

- `id`
- `slug` unique
- `name`
- `legal_name` nullable
- `website_url` nullable
- `headquarters` nullable
- `founded_year` nullable
- `summary`
- `why_it_matters`
- `company_type`
- `stage`
- `is_demo`
- `publication_status` (`draft`, `in_review`, `published`, `archived`)
- `last_reviewed_at` nullable
- `created_at`
- `updated_at`

### `company_sectors`

Many-to-many link, even though most MVP companies may have one primary sector.

Fields:

- `company_id`
- `sector_id`
- `is_primary`

Require exactly one primary sector for a published company.

### `company_aliases`

Supports entity matching.

Fields:

- `id`
- `company_id`
- `alias`
- `alias_type`
- `normalized_alias`

### `source_documents`

Represents the original evidence source.

Fields:

- `id`
- `canonical_url`
- `source_title`
- `publisher`
- `source_type`
- `source_tier`
- `event_date` nullable
- `published_at` nullable
- `retrieved_at`
- `content_hash` nullable
- `excerpt` nullable
- `storage_path` nullable
- `is_demo`
- `created_at`

A source document is not automatically trusted merely because it is stored.

### `signals`

A structured event or meaningful change connected to a company.

Fields:

- `id`
- `company_id`
- `signal_type`
- `headline`
- `summary`
- `why_it_matters`
- `occurred_at` nullable
- `detected_at`
- `evidence_strength` (`low`, `medium`, `high`)
- `verification_status` (`unverified`, `partially_verified`, `verified`, `disputed`, `rejected`)
- `publication_status` (`draft`, `in_review`, `published`, `archived`)
- `is_demo`
- `created_by_type` (`human`, `ai`, `import`)
- `created_at`
- `updated_at`

### `signal_evidence`

Links evidence to a signal and explains what it supports.

Fields:

- `id`
- `signal_id`
- `source_document_id`
- `support_type` (`supports`, `contradicts`, `context_only`)
- `supporting_passage` nullable
- `claim_type` (`official_record`, `company_claim`, `independent_report`, `analysis`, `community_report`)
- `created_at`

### `company_watch_items`

“What to watch next” statements.

Fields:

- `id`
- `company_id`
- `text`
- `status` (`open`, `observed`, `invalidated`, `archived`)
- `created_at`
- `resolved_at` nullable

### `research_items`

The queue object. It may point to a proposed company, proposed signal, entity match, or correction.

Fields:

- `id`
- `item_type` (`new_company`, `new_signal`, `entity_match`, `correction`, `dispute`)
- `payload` JSONB
- `status` (`pending`, `needs_more_evidence`, `approved`, `rejected`, `disputed`)
- `priority` (`low`, `medium`, `high`)
- `assigned_to` nullable
- `created_at`
- `updated_at`

### `review_actions`

Append-only audit trail.

Fields:

- `id`
- `research_item_id`
- `reviewer_id`
- `action` (`approve`, `edit_approve`, `reject`, `request_evidence`, `mark_disputed`, `reopen`)
- `before_state` JSONB nullable
- `after_state` JSONB nullable
- `reviewer_note` nullable
- `created_at`

Do not update or delete historical review actions through normal application flows.

### `ingestion_runs`

Fields:

- `id`
- `connector_key`
- `started_at`
- `finished_at` nullable
- `status` (`running`, `succeeded`, `partially_succeeded`, `failed`)
- `records_discovered`
- `records_created`
- `records_skipped`
- `error_summary` nullable
- `metadata` JSONB

## Evidence dimensions

Store these separately rather than hiding them inside one score:

- source tier;
- claim type;
- verification status;
- evidence strength;
- support or contradiction;
- human-review state;
- freshness.

## Publication invariants

1. A published signal must have at least one linked source document.
2. A verified signal must have an approving review action.
3. A published company must have one primary sector.
4. Public queries must exclude rejected, archived, and draft content.
5. Demo and live content must be distinguishable.
6. An AI-created record cannot directly transition from draft to published.
7. Editing a reviewed claim creates an audit record.

Enforce critical invariants in the database where practical and in domain logic with tests.

## Suggested public views

Create read-only database views or carefully scoped queries for:

- published companies with primary sector;
- published signals with evidence counts;
- sector summary counts;
- company timeline entries;
- latest approved signals.

## RLS intent

### Anonymous/public

- select published companies, sectors, published signals, public source metadata, and methodology content;
- no mutations.

### Authenticated reviewer

- read draft/in-review content;
- create review actions;
- update research-item workflow through validated server operations;
- should not directly bypass the publish domain function.

### Service process

- insert source documents and draft research items;
- cannot mark records verified without the review transition.
