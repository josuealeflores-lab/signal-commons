# Optional prompt for Claude Cowork

You are supporting the research and methodology work for Signal Commons, an Emerging AI Impact Radar. You are not editing the application repository in this task.

Goal: create a structured source-candidate assessment that can later be reviewed and added to the project documentation.

Read the project handoff documents, especially:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/RESEARCH_METHODOLOGY.md`
- `docs/DATA_MODEL.md`

Research potential public data sources for discovering and verifying emerging AI-company activity across these seven equally weighted sectors:

1. Politics & Civic Technology
2. Government Operations
3. Agriculture
4. Healthcare
5. Education
6. Nonprofits
7. Climate & Energy

For each candidate source, document:

- official name;
- issuing organization;
- sectors covered;
- discovery value;
- verification value;
- access method (API, download, RSS, manual, or permitted webpage access);
- authentication requirement;
- rate limits if documented;
- update cadence;
- licensing or terms considerations;
- important fields;
- entity-matching risks;
- whether the source is suitable for the first connector;
- confidence in the assessment;
- official source links.

Separate confirmed facts from recommendations. Do not recommend scraping a source whose terms or technical controls do not clearly permit it. Do not create company claims or rankings.

Deliver:

1. A concise executive summary.
2. A comparison matrix.
3. A recommendation for the single safest and most useful first connector.
4. A proposed source-registry record for that connector.
5. Open questions requiring human review.

Save the output as a standalone Markdown document. Do not modify any application code.
