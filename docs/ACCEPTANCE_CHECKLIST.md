# MVP Acceptance Checklist

## Product identity

- [ ] Signal Commons name and Emerging AI Impact Radar descriptor are visible.
- [ ] Brand direction is recognizably consistent with both reference images.
- [ ] Mission and public-interest purpose are understandable without scrolling deeply.

## Seven-sector equality

- [ ] All seven canonical sectors are visible on the dashboard.
- [ ] Cards have equal size and prominence.
- [ ] Demo data contains three companies per sector.
- [ ] Sector pages use the same layout and information hierarchy.
- [ ] No default “featured sector” exists.

## Evidence integrity

- [ ] Every public signal links to at least one evidence record.
- [ ] Source type and claim type are displayed.
- [ ] Evidence strength uses text plus visual treatment.
- [ ] Verification status is distinct from evidence strength.
- [ ] Company-controlled claims are labeled.
- [ ] Missing evidence is visible.
- [ ] Demo records cannot be mistaken for real research.

## Human review

- [ ] Reviewer authentication works.
- [ ] Unauthenticated users cannot access the queue.
- [ ] Draft items are not visible as verified public signals.
- [ ] Reviewer can approve, edit-and-approve, reject, dispute, and request evidence.
- [ ] Each review action creates an audit record.
- [ ] Original and edited states can be inspected.

## UX and accessibility

- [ ] Desktop, tablet, and mobile layouts are usable.
- [ ] Navigation is keyboard operable.
- [ ] Focus indicators are visible.
- [ ] Status does not rely on color alone.
- [ ] Chart includes a textual equivalent.
- [ ] Forms have labels and useful validation errors.
- [ ] Empty, loading, and error states exist.
- [ ] Contrast meets the stated accessibility target.

## Engineering

- [ ] No secrets are committed.
- [ ] TypeScript strict mode is enabled.
- [ ] RLS is enabled for exposed Supabase tables.
- [ ] Service-role key is server-only.
- [ ] Migrations are checked into source control.
- [ ] Domain rules have tests.
- [ ] Publish-gate flow has an automated test.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Production deployment smoke test passes.

## Presentation readiness

- [ ] README includes a five-minute demo path.
- [ ] Demo data notice is explained during the presentation.
- [ ] One example shows a strong evidence packet.
- [ ] One example shows uncertainty or missing evidence.
- [ ] One example demonstrates human review and publication.
- [ ] Limitations and next steps are stated candidly.
