# Prompt to paste into Claude Code

We are beginning the Signal Commons build. Treat this repository as the source of truth.

Before writing or editing code:

1. Read `CLAUDE.md` and every markdown file it requires.
2. Inspect `references/brand-guide.png` and `references/dashboard-mockup.png`.
3. Inspect `seed/demo-data.json`.
4. Enter or remain in Plan Mode.
5. Summarize your understanding of:
   - the product purpose;
   - the seven-sector equality requirement;
   - the evidence and human-review requirements;
   - the explicit MVP non-goals;
   - the demo-data disclosure rule.
6. Propose:
   - the exact MVP technical stack and package choices;
   - a repository file tree;
   - the implementation sequence for Milestone 0 and Milestone 1 only;
   - the tests and quality checks you will add;
   - any assumptions or conflicts you found.
7. Identify anything in the mockup that should be adjusted for accessibility or realistic implementation.
8. Do not initialize, install packages, edit files, or run mutating commands until I approve the plan.

After approval, implement only Milestone 0 and Milestone 1 from `docs/BUILD_PLAN.md`. Use typed deterministic demo data. Do not connect Supabase or the Claude API yet unless I explicitly expand the scope.

At the end of implementation:

- run lint, typecheck, tests, and production build;
- report the exact results;
- list files changed;
- explain how to run the app locally;
- identify remaining limitations;
- stop and wait before starting Milestone 2.
