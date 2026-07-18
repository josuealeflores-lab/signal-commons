# Reviewer Runbook

A practical, plain-language guide for a human reviewer using Signal Commons — distinct from `docs/DEPLOYMENT.md`, which covers the ops/admin side of provisioning a reviewer account. This document covers what a reviewer actually does day to day. See `docs/DECISIONS.md` D-100 for the design decisions behind this milestone's reviewer/operational hardening work.

## Purpose of the reviewer workflow

Signal Commons never publishes anything automatically. Every company, signal, or correction that could ever appear publicly starts as a draft and requires an explicit, human reviewer decision before it becomes public. AI-assisted tools (Copilot, the queue digest) can help a reviewer work faster, but they never decide, approve, reject, publish, or verify anything on their own — **a human reviewer's own action is always what changes a record's status.**

## Logging in

1. Go to `/auth/login`.
2. Sign in with your reviewer email and password.
3. If your account exists but is not currently active, you'll see: *"Your reviewer access is not active."* — this means your password worked, but your account has been deactivated (see "Reviewer activate/deactivate," below). Contact whoever administers reviewer accounts for this deployment.
4. Once signed in, you'll land on `/research-queue` — the list of items awaiting review.

## Reviewing queue items

1. `/research-queue` lists every pending research item. Open one to see its detail page (`/research-queue/[id]`).
2. Each item's detail page shows the proposed signal/company content, its evidence sources, and (if you choose to use it) a Copilot analysis panel.
3. Read the evidence before deciding — the evidence-strength and verification-status labels reflect what's currently known, not a final judgment; your review is what turns evidence into a decision.

## Demo vs. real data

As of this milestone, **every company, signal, and source in this deployment is fictional demo data** — built to test this exact workflow, not to represent anything real. Nothing you review today is a real company or a real event. Once real data exists (a later milestone), this section — and the public-facing banner — will be updated to explain how to tell demo and real content apart. Until then, treat everything in the queue as safe-to-practice-on demo content.

## Approve / reject / dispute / reopen

- **Approve** — the item becomes public (if its linked company is already published; otherwise it stays private until the company is also published — the system tells you which happened).
- **Edit and approve** — make a small correction to the headline/summary/evidence-strength before approving, when the underlying claim is right but the wording needs a fix.
- **Reject** — the item is marked rejected and never becomes public. Use this for unsupported, duplicate, irrelevant, or materially misleading content.
- **Request more evidence** — send the item back for more sourcing before it can be approved or rejected.
- **Mark disputed** — flag that credible evidence conflicts with the claim. A previously-published signal that gets disputed is pulled from public view until resolved.
- **Reopen** — bring a previously-decided item back into active review, when new information warrants revisiting a past decision.

Always add a short reviewer note explaining your reasoning — it's preserved in the audit trail (see below) and helps anyone reviewing your decision later understand why.

## Human reviewer remains the decision-maker

No AI feature in this deployment can approve, reject, publish, or verify anything. **You are always the one making the decision.** Never treat an AI summary as if it were itself an approval, a rejection, or a verification — it's an input to your judgment, not a substitute for it.

## Copilot and the queue digest are advisory only

- **Copilot** ("Run analysis" on an item's detail page) summarizes one item's evidence, flags risks, and suggests missing-evidence questions — advisory only.
- **The queue digest** (on the reviewer dashboard) summarizes the whole pending queue — also advisory only.
- Both are bounded, read-only, and can never approve, reject, publish, verify, or otherwise change anything — they only read and summarize.

## "AI features are not configured" — what this means

Until production AI activation happens (a separate, later milestone — M12, not this one), clicking "Run Copilot analysis" or "Generate queue digest" will show: *"AI features are not configured in this environment."* **This is expected, not a bug.** It means the live AI provider connection isn't turned on yet in this deployment — it does not mean anything is broken. Human review (approve/reject/dispute/reopen) works fully and normally regardless of whether AI features are configured; reviewer activation never depends on AI activation.

## Reporting an issue

If you notice something wrong on the public site, or have a question about the review workflow itself, email **corrections@signal-commons.org** — the same public corrections channel documented on `/methodology` and `/about`. There is no separate internal reviewer-only channel; this one address covers both.

## Inspecting the audit trail (high level)

Every review action you (or any reviewer) take is recorded permanently in the `review_actions` table — who did what, when, and why (your reviewer note). This history is never edited or deleted; a correction or a reopened decision adds a new entry rather than erasing the old one. If you need to understand why an item is in its current state, the audit trail is the authoritative record — an administrator with database access can pull the full history for any item on request.

## Reviewer activate/deactivate (high level)

Reviewer accounts are provisioned and deactivated by whoever administers this deployment, via the Supabase dashboard/Admin API — not self-service, and not through this app's UI. If your access is ever unexpectedly deactivated, or you believe another reviewer's access should be, contact the administrator directly; this runbook doesn't grant you that ability yourself.

## Admin-side password reset

Self-service password reset does not exist in this deployment yet (self-service reset is deferred — see `docs/DECISIONS.md` D-100). If you forget your password or need it reset, the administrator resets it directly through the Supabase Auth dashboard (Authentication → Users → reset password, or the Admin API), then shares the new password with you through a secure channel — never by email in plain text alongside the account details.

## Suspected compromise response

If you suspect your reviewer account credentials have been compromised (e.g. you notice review actions you didn't take, or you believe your password was exposed):

1. Tell the administrator immediately.
2. The administrator should deactivate your `reviewer_profiles` row (`is_active = false`) right away — this immediately blocks further access at every layer (the reviewer route gate, and the RPC's own authoritative check), even before your password is changed.
3. The administrator resets your password via the Supabase Auth dashboard.
4. Once confirmed safe, the administrator reactivates your account and shares the new password securely.
5. Review the audit trail (`review_actions`) for the affected time window to confirm what, if anything, happened while the account may have been compromised.

## What not to do

- **Do not treat AI output as a final decision.** Copilot and the digest are advisory only — your own explicit action is what changes a record's status, always.
- **Do not publish real records without the approved workflow.** Every publication path goes through the standard approve/edit-and-approve flow — there is no shortcut, and none should ever be built or used.
- **Do not bypass review gates.** Don't ask an administrator to directly edit database rows to skip a review decision — the RPC-first, audit-trailed path is the only sanctioned way a record's status changes.
- **Do not use service-role keys in public/runtime paths.** If you ever have database access for administrative tasks, the service-role key is for local/CI scripts only — it must never be used from, or exposed to, the deployed public application.
