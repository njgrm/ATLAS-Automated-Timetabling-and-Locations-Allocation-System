# Prompt 9c: Admin Server Pagination And Search

## Mission

Add server-side pagination/search for high-volume admin and review lists after the `AdminDataTable` UI contract is proven.

Do not combine all pages in one risky rewrite. Implement the backend and wire pages in a measured order, starting with the Teachers pilot contract if Prompt 2 has landed.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`
- `docs/prompts/tl-timetable-02-teachers-admin-data-table-pilot-prompt.md`

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-prisma-database`
- `atlas-21st-dev-frontend` for client wiring

Candidate pages/lists:

- Teachers/faculty
- Subjects
- Sections
- preference reviews
- room requests
- violations

## Scope

In scope:

- Shared pagination/search API conventions.
- First one or two high-value list integrations, preferably `/teachers` first.
- Client wiring through existing/future `AdminDataTable` props.
- Tests/probes for pagination and search.

Out of scope:

- Virtualization.
- Full conversion of every admin page in one pass.
- Visual redesign unrelated to table contract.

## Mandatory Outcomes

### 1. Define pagination contract

Use a consistent response shape such as:

- `items`
- `page`
- `pageSize`
- `total`
- `totalPages`
- `query`

Preserve existing endpoints or add new query params without breaking current consumers.

### 2. Implement scoped backend support

Start with the pilot list and one adjacent list only if safe.

Use school-year/school scoping and indexed filters where possible.

### 3. Wire the UI conservatively

Connect `AdminDataTable` pagination props without changing row semantics.

Keep client-side fallback if backend pagination is unavailable in degraded mode.

### 4. Prove no regression

Verify search, page changes, empty results, and source-state behavior.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- backend pagination/search probes
- browser smoke on wired page(s)
- line-count and primitive scans for touched React files

Self-correction requirement:

- If pagination, search, build, or UI wiring fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- pagination contract
- pages wired
- backend probe results
- browser/build evidence
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`