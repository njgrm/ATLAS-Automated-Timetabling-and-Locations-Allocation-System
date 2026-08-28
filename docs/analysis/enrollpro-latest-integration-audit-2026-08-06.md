# EnrollPro Latest Integration Audit

Date: 2026-08-06  
Target EnrollPro fork: `https://github.com/njgrm/EnrollPro/tree/main`  
Local checkout: `D:\EnrollPro`  
Latest local fork commit: `d1f0aa1c` (`docs: initialize system architecture documentation and implement global page title handling with core UI styling.`)

## Verdict

`NO-GO for school-year rollover scheduling until ATLAS mirrors the new EnrollPro active school-year context deliberately.`

`GO for current EnrollPro credential delegation after the ATLAS nullable-email fix.`

## What changed in EnrollPro that matters to ATLAS

- EnrollPro now documents itself as the owner of learner identity, enrollment, class placement, personnel records, school-year context, and official school-form workflows.
- EnrollPro now documents ATLAS as the owner of schedules and teaching loads.
- EnrollPro exposes a public partner API under `/api/integration/v1`.
- ATLAS-relevant partner feeds are:
  - `GET /api/integration/v1/health`
  - `GET /api/integration/v1/school-year`
  - `GET /api/integration/v1/default/faculty`
  - `GET /api/integration/v1/faculty`
  - `GET /api/integration/v1/sections`
- EnrollPro school-year rollover is atomic and must be treated as the boundary for new-year schedule creation.
- After rollover, EnrollPro creates the target-year section structures without advisers and without active learner enrollment records until BOSY confirmation/sectioning proceeds.

## Live Tailnet probes

Credential used:

```text
1234501 / DepEdSY2026!
```

| Probe | Result | Notes |
| --- | --- | --- |
| `POST http://100.120.169.123:5002/api/auth/verify` | `200` | Valid EnrollPro `SYSTEM_ADMIN`; user has `email=null`, `employeeId=1234501`, `accountName=1234501`. |
| `POST http://100.120.169.123:5002/api/auth/login` | `200` | EnrollPro direct login works with `accountName/password`. |
| `POST https://njgrm.buru-degree.ts.net/enrollpro-api/auth/verify` | `200` | ATLAS client proxy path can reach EnrollPro auth verification. |
| `POST https://njgrm.buru-degree.ts.net/api/v1/auth/login` before fix | `500` | ATLAS crashed while provisioning EnrollPro staff with `email=null`. |
| `POST https://njgrm.buru-degree.ts.net/api/v1/auth/login` after fix | `200` | ATLAS now provisions an internal fallback email and issues a local token. |
| `GET http://100.120.169.123:5002/api/integration/v1/school-year` | `200` | Active EnrollPro year is `id=1`, `yearLabel=2026-2027`. |
| `GET https://njgrm.buru-degree.ts.net/enrollpro-api/integration/v1/school-year` | `200` | Proxy returns the same active EnrollPro year. |
| `GET http://100.120.169.123:5002/api/integration/v1/sections?page=1&limit=200` | `200` | `20` sections; scoped to EnrollPro school year `1`. |
| `GET http://100.120.169.123:5002/api/integration/v1/default/faculty?page=1&limit=200` | `200` | `24` faculty rows; scoped to EnrollPro school year `1`. |
| `GET http://100.120.169.123:5002/api/settings/public` | `200` | Branding and public school-year context are reachable. |
| `GET http://100.120.169.123:5002/api/settings/scp-config` | `200` | Empty SCP program config payload in the current EnrollPro fixture. |
| `GET http://100.120.169.123:5002/api/integration/v1/subject-offerings?schoolYearId=1` | `404` | This endpoint is not in the new EnrollPro route catalog and must remain optional or be removed from ATLAS assumptions. |

## ATLAS contract alignment

### Working

- `atlas-server/src/services/local-auth.service.ts` now accepts EnrollPro verified users with `email=null`.
- `atlas-server/src/services/faculty-adapter.ts` already reads paginated `/integration/v1/faculty` and maps `teacherId`, `employeeId`, department fields, specialization, advisership, and ancillary minutes.
- `atlas-server/src/services/section-adapter.ts` already reads `/integration/v1/school-year` and `/integration/v1/sections`, and its normalizer accepts the current flat `data[]` section feed.
- `atlas-server/src/services/cohort.service.ts` uses `/settings/scp-config`, which is still exposed.
- `atlas-client` proxy configuration points `/enrollpro-api` to `VITE_ENROLLPRO_API_BASE=http://100.120.169.123:5002`.

### Drift / risk

- ATLAS runtime context currently resolves `activeSchoolYearId=39` from persisted ATLAS evidence.
- EnrollPro currently reports active `schoolYearId=1` for `2026-2027`.
- `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true` reports:
  - `source=atlas-persisted`
  - `upstream.reachable=true`
  - `upstream.verified=false`
  - `upstream.matched=false`
- This means ATLAS can reach EnrollPro, but current persisted schedule/setup context does not match EnrollPro's active year.
- ATLAS still contains a best-effort enrichment call to `/integration/v1/subject-offerings`, which the latest EnrollPro fork does not expose.
- Existing cross-repo verification helper used the old EnrollPro login body shape. It has been patched to send `accountName`.

## Immediate code fixes applied

### Nullable EnrollPro email login fix

File: `atlas-server/src/services/local-auth.service.ts`

- Changed `EnrollProVerifiedUser.email` to `string | null`.
- Added deterministic internal fallback email generation:

```text
enrollpro-<employee-or-account-id>@atlas.local
```

- Verified live ATLAS login with `1234501 / DepEdSY2026!` returns `200`.

### Cross-repo auth helper fix

File: `atlas-server/src/scripts/verify-cross-repo-source-gate.ts`

- Changed EnrollPro login request body from `{ email, password }` to `{ accountName, password }`.
- Preserved existing CLI/env naming so old scripts do not need immediate argument renames.

## Verification caveat

- `npm run build` in `atlas-server` passed after the code changes.
- `npm run test:auth` is not clean in the current local database because the old seeded local faculty account `maria.santos@deped.edu.ph` no longer accepts the test's assumed `DepEd2026!` password.
- The same test run passed the delegated EnrollPro faculty provisioning cases, and the new live EnrollPro admin credential path was verified through ATLAS with `200`.
- Treat the seeded local faculty fixture as a separate test-data repair item, not as a blocker for the nullable-email EnrollPro delegation fix.

## Readiness decision

ATLAS should not create a new generation run for the current EnrollPro year until a controlled rollover sync creates or selects the correct ATLAS school-year context for EnrollPro `1 / 2026-2027`.

The next implementation should focus on:

1. active-year mapping;
2. rollover sync;
3. read-only contract tests for the new EnrollPro partner feeds;
4. schedule-creation gating when ATLAS and EnrollPro active years do not match.
