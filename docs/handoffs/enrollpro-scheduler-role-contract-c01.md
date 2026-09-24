# EnrollPro Reference Contract — Active Grade-Coordinator Ancillary Roles C01

## Objective

This replaces the earlier application-role request. EnrollPro confirmed that
the four personnel must remain `TEACHER` application users; their scheduler
eligibility is deliberately represented by their active school-year ancillary
roles.

ATLAS must correct its source at `68e373108996b64c5e4470a5479aea1c2c0772ce`
to read the existing EnrollPro faculty integration contract. No EnrollPro role,
seed, password, schema, or deployment change is requested by this packet.

## Accounts in scope

| Employee ID | Personnel | Authoritative active ancillary role | Application role retained |
| --- | --- | --- | --- |
| `1234506` | Juan Miguel Santos | `GRADE 7 COORDINATOR` | `TEACHER` |
| `1234507` | Maria Angela Reyes | `GRADE 8 COORDINATOR` | `TEACHER` |
| `1234508` | Jose Gabriel Cruz | `GRADE 9 COORDINATOR` | `TEACHER` |
| `1234509` | Anna Patricia Garcia | `GRADE 10 COORDINATOR` | `TEACHER` |

Do not add broad application roles to these accounts. In particular, they must
not become EnrollPro or ATLAS administrators, system administrators, or
registrars.

## Confirmed EnrollPro contract

At EnrollPro commit `7b6231ee2d7a5c9801b68afd0343db2768950e42`:

- `GET /api/integration/v1/faculty` is machine-key protected and returns the
  active school-year faculty feed.
- Each faculty row includes `employeeId`, active status, school-year scope, and
  `ancillaryRoles`.
- The feed merges `Teacher.ancillaryRoles` with the matching active
  `TeacherDesignation.ancillaryRoles`.
- `/auth/verify` and companion SSO intentionally return application roles only;
  they do not return ancillary roles.

The EnrollPro seed's `TEACHER` role is therefore deliberate, not a defect.

## Required ATLAS consumption rule

1. Authenticate the person through the existing EnrollPro credential or SSO
   flow; application roles still establish ordinary teacher eligibility.
2. Resolve exactly one active faculty row from the machine-keyed current
   `/api/integration/v1/faculty` feed using the verified employee identity.
3. Grant `scheduler` only when the active ancillary-role list contains an exact,
   normalized `GRADE 7 COORDINATOR`, `GRADE 8 COORDINATOR`,
   `GRADE 9 COORDINATOR`, or `GRADE 10 COORDINATOR` value.
4. Treat missing feed access, no match, duplicate match, inactive faculty, stale
   mirror, malformed ancillary data, or any other coordinator text as **not a
   scheduler**. A valid teacher may remain faculty-only; the failure must never
   preserve a stale scheduler grant.
5. Do not infer scheduler authority from names, employee IDs, application-role
   strings, plantilla designation, or free-text substring matches.
6. Preserve first-login password-change behavior and never log credentials.

## ATLAS acceptance tests

- The four exact ancillary roles grant scheduler capabilities while retaining
  teacher self-service.
- Teacher-only, non-coordinator ancillary roles, substring lookalikes, malformed
  data, inactive rows, cross-school rows, missing rows, duplicate matches, and
  unavailable feed access do not grant scheduler capabilities.
- A prior persisted `scheduler` account downgrades to faculty-only on the next
  verified login or SSO exchange when the coordinator ancillary role is absent.
- The active school-year feed, rather than a historical designation or cached
  stale mirror, determines eligibility.
- SSO and local credential flows produce the same effective capability result.
- Existing administrator/officer and ordinary faculty behavior remains unchanged.
- No credential, user-specific password, or machine key appears in source, logs,
  tests, or the returned client payload.

## Reference-only EnrollPro responsibility

Keep the faculty integration feed stable: it must retain the current active
school-year scope and the merged `ancillaryRoles` field. If this contract changes,
notify the ATLAS owner with the EnrollPro commit SHA, endpoint/schema delta, and
an updated compatibility contract. No EnrollPro code change is requested now.
