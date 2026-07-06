# Start Here

## Recommended workflow

Use **Claude Code in VS Code as the primary builder**. Use **Claude Cowork as a supporting research and documentation workspace**.

### Why Claude Code is primary

This project requires repository awareness, file creation, command execution, database migrations, tests, Git commits, and iterative debugging. Those are software-engineering tasks and should happen in Claude Code inside the project repository.

### Where Cowork helps

Use Cowork for work that produces or improves knowledge artifacts rather than application code, such as:

- researching potential public data sources;
- comparing source licensing and access constraints;
- drafting methodology language;
- reviewing company evidence packets;
- creating weekly intelligence-brief templates;
- organizing research notes into structured files that can later be added to the repository.

Do not have Cowork and Claude Code simultaneously edit the same repository files. Let Git remain the source of truth.

## Setup sequence

1. Create a new GitHub repository named `signal-commons`.
2. Clone it locally and open it in VS Code.
3. Copy the contents of this handoff package into the repository root.
4. Confirm that the two PNG files are in `references/`.
5. Open Claude Code from the repository root.
6. Begin in **Plan Mode**.
7. Paste the contents of `prompts/CLAUDE_CODE_KICKOFF.md`.
8. Review Claude's plan before allowing file changes.
9. Ask Claude to implement **Milestone 0 and Milestone 1 only**.
10. Run the quality gate before moving to the next milestone:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Tool choices

### Use now

- Node.js
- GitHub
- VS Code with Claude Code
- Supabase
- Vercel
- Docker Desktop only where the Supabase local workflow needs it

### Keep optional for later

- `uv` and Python for a dedicated research/ETL worker if source parsing becomes cumbersome in TypeScript
- Dev Containers for a reproducible and isolated development environment
- Claude Code GitHub Actions after the repository has tests and stable conventions

### Do not use for the MVP

- Kubernetes
- Multiple deployable microservices
- A message broker
- A vector database unless a demonstrated search requirement cannot be met with Postgres full-text search

## First release philosophy

The first release is not an autonomous market-intelligence engine. It is a credible, attractive, auditable research product with a safe path toward automation.
