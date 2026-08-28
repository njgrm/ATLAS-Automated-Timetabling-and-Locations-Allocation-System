# Active Term Prompt 06 — Release Proof and Documentation Handoff

## Role

You are the ATLAS release-proof and documentation executor. Finalize the active-term integration by updating handoff docs and proving the behavior end to end on Tailnet.

## Problem

After implementation, other systems need an unambiguous handoff explaining where active term comes from, how ATLAS exposes it, and which endpoints support active-term behavior.

## Target files

- `docs/guides/ATLAS-PUBLIC-API.md`
- `api/ATLAS-PUBLIC-API.md`
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`
- `docs/reference/atlas-smart-rollover-api-endpoints-2026-08-07.md`
- `docs/guides/ACTIVE-TERM-INTEGRATION.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `CHANGELOG.md`
- Add a verification report under:
  - `docs/verification/active-term-integration-release-proof-2026-08-22.md`

## Requirements

### Documentation requirements

- The docs shall state that EnrollPro owns active term.
- The docs shall state that ATLAS exposes active term through runtime context.
- The docs shall state that frontend and downstream systems must not receive the EnrollPro integration key.
- The docs shall distinguish active term from persisted entry `termIndex`.
- The docs shall document active-term unavailable behavior.
- The docs shall document active-term published schedule query parameters if Prompt 05 implemented them.
- The docs shall keep legacy `:termId` routes marked compatibility-only.

### Release proof requirements

- Tailnet proof shall verify `/api/v1/runtime/context?schoolId=1&verifyUpstream=true`.
- Tailnet proof shall verify the active-term source, active term, term index, and matching school year.
- Tailnet proof shall verify timetable default behavior.
- Tailnet proof shall verify Teaching Load current-term display.
- Tailnet proof shall verify dashboard active-term readiness display.
- Tailnet proof shall verify published/export/notification behavior implemented in Prompt 05.
- Release proof shall confirm the integration key is present only in ignored env files.

## Verification

Run full focused gates:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npm run test:workbook-export

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run secret hygiene checks:

```bash
cd D:\ATLAS
git grep -n "sk_live_" -- . ":!*.env" ":!atlas-server/.env" ":!atlas-client/.env"
rg -n "ENROLLPRO_SERVICE_TOKEN=.*sk_live_|sk_live_" docs api docs/guides/ATLAS-PUBLIC-API.md docs/guides/ACTIVE-TERM-INTEGRATION.md atlas-server/src atlas-client/src
git check-ignore -v .env atlas-server/.env
```

Expected: no tracked/docs/source secret matches; env files are ignored.

## Acceptance criteria

- Active-term runtime context is documented and verified.
- UI defaults and warnings are documented and verified.
- External API handoff is updated without ambiguity.
- Secret hygiene checks pass.
- Verification report contains exact Tailnet outputs and command results.

## Final report required

Report `GO` or `NO-GO`, files changed, all command results, Tailnet evidence, secret hygiene result, and remaining caveats.
