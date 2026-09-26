# HIGH — `ATLAS_SYSTEM_TOKEN` rotation (operator action, requires EnrollPro coordination)

**Status: OPEN. This is the one unresolved credential from the 2026-09-26 incident.**
**Why it is still open:** the value is committed in a **public** repository, and ATLAS validates it against what
EnrollPro presents. EnrollPro's copy lives on `dev-jegs`, a `READ_ONLY` companion under `AGENTS.md` §4, so **this
lane may not complete it.** It needs the operator and the EnrollPro owner acting together.
**Never echo the value** into any prompt, doc, commit, screenshot or transcript.

---

## 1. What it is — an admin bypass key, not a scoped integration credential

`atlas-server/src/middleware/authenticate.ts:127` exports `authenticateWithSystemToken`. On a match
(`isSystemTokenMatch`, line 75, a `timingSafeEqual` comparison) it sets:

```
userId: 0   role: 'SYSTEM_ADMIN'   authSource: 'system'   email: 'atlas-system-token@local'
```

and calls `next()`. The presented value is read from **either** header — `X-Integration-Key` (line 129) **or**
`Authorization: Bearer` (line 130). There is no scope, no expiry, no per-caller identity: **one static string is a
full SYSTEM_ADMIN credential.** The plain `authenticate` export (line 177) does *not* accept it, so the blast
radius is exactly the routes using `authenticateWithSystemToken`.

## 2. Blast radius — measured, not estimated

**29 routes accept the token; 14 of them are write operations.** The token alone suffices, because it already
carries `SYSTEM_ADMIN`:

| Router | Routes | of which write |
| --- | --- | --- |
| `runtime.router.ts` | 12 | **8** |
| `faculty-assignment.router.ts` | 9 | **3** |
| `faculty.router.ts` | 3 (incl. `router.use`, so the whole router) | 2 |
| `section.router.ts` | 3 | 1 |
| `dashboard.router.ts` | 2 | 0 |
| `draft-schedule.router.ts` | via array-form middleware | — |

**`runtime.router.ts` is the serious one: 12 of its 13 guarded routes take the token with NO additional
`requirePrivilegedRole`,** so nothing else stands between the published string and production-data writes. Those
include `POST /rollover-recovery/apply`, `POST /rollover-sync/apply`, `POST /rollover-archive/apply`,
`POST /rollover-recovery/mark-test-data` and `POST /rollover-sync/reset-dummy-year` — rollover and archive
operations on live teaching-load data. `faculty-assignment` adds `POST /coverage/repair`,
`POST /coverage/rebalance-special-programs` and `POST /coverage/recover-real-faculty`.

ATLAS is served to the Tailnet at `https://njgrm.buru-degree.ts.net`, so the reachable population is **any enrolled
Tailnet node** — the same threat model as the closed PostgreSQL grant, except here the credential grants admin
rather than access to an empty database.

## 3. Why it is committed, and how it got there

`CHANGELOG.md:2748` and `:2757` carry the live value (pre-existing; **hash-confirmed byte-identical** to
`ATLAS_SYSTEM_TOKEN` in the durable env). Both sit in a narrative changelog entry about a secret-mismatch incident
with the EnrollPro dev — the value was pasted into prose. The surrounding entry even records the correct intent
("never committed"), which the paste defeated.

**The new guard does not catch this shape**, and this is a known, disclosed limitation rather than an oversight: the
guard flags *credential-shaped literals* (DSNs, assignments, hash-call arguments, markdown email/credential pairs),
not a bare token in prose. The guard's job is to stop the classes it knows; this is a class it does not yet model.

## 4. Why rotation needs two sides — the ordering constraint

ATLAS **verifies** the token; the caller **presents** it. Rotating only ATLAS's copy breaks every caller
immediately; rotating only the caller's copy changes nothing. They must move together, and the safe order is
**caller first, ATLAS second** — because a caller holding a new token that ATLAS does not yet accept is merely
rejected, which is a visible, recoverable failure, whereas ATLAS holding a new token that no caller can present is
an outage of the integration.

## 5. Procedure

**Preconditions — verify, do not assume.** Record before acting: current `ATLAS_SYSTEM_TOKEN` hash (first 16 hex of
SHA-256) from `D:\ATLAS-runtime-config\atlas-server.env`; the current release SHA from the
`ATLAS-Runtime-Supervisor` scheduled-task action and the `ATLAS_RUNTIME_RELEASE_SHA` machine variable; the
supervisor PID; and the live `GET /api/v1/health/ready` result. Per `AGENTS.md` §6 the env file is **read-only by
ACL** (`Read, Synchronize` only, not even FullControl for Administrators, who own it) — this is the same trap that
caused an outage on 2026-09-26. **Probe the write first**, and prefer the operator making the one-line edit
themselves, which preserves the hardening.

1. **Generate** a new token (44 chars, base64url alphabet, so no escaping is ever needed). **Write it to a
   retrievable file before using it** — never hold it only in process memory.
2. **EnrollPro owner** updates their `ATLAS_API_KEY` (their remote `server/.env`, per the CHANGELOG entry) to the
   new value. Confirm out-of-band. ATLAS still holds the old value, so their calls now fail `401
   INVALID_SYSTEM_TOKEN` — **expected and recoverable**, and the reason this side goes first.
3. **Operator** updates `ATLAS_SYSTEM_TOKEN` in `D:\ATLAS-runtime-config\atlas-server.env`, byte-level
   substitution only, reporting a byte delta equal to the length change.
4. **Restart** the supervised runtime the sanctioned way: `taskkill /T /F` the supervisor tree, wait for 5001/5174
   to release, then `schtasks /run /tn ATLAS-Runtime-Supervisor`. Arm the rollback before starting.
5. **Verify**: `GET /api/v1/health/ready` 200 with `database:"ok"`; a token-authenticated read succeeds with the
   **new** value and returns `401 INVALID_SYSTEM_TOKEN` with the **old** one; `GET /api/v1/subjects?schoolId=1` 200;
   Tailnet health 200; the EnrollPro integration call succeeds.
6. **Then** scrub `CHANGELOG.md:2748` and `:2757` — redact in place with a dated note (the changelog is a live
   document, not a frozen handoff), and extend the committed guard to model a bare token in prose, or accept the
   limitation explicitly in the guard's header.
7. Restore the env file's read-only ACL if it was temporarily granted, and prove it: SDDL compared equal and a
   real write re-tested and **denied**.

**Rollback:** restore the previous token in the env file, restart as in step 4, and have the EnrollPro owner
restore their previous value. Both sides are needed for a coherent rollback, so agree the rollback before step 2.

**Note on history:** the value remains in `CHANGELOG.md` at earlier commits regardless. That residual was accepted
for the PostgreSQL credential; it applies identically here and is not fixed by any source change.

## 6. What I could not do, and why

- I did not rotate it: the caller half lives on a `READ_ONLY` companion (`AGENTS.md` §4), and a unilateral change
  breaks the integration.
- I did not edit `CHANGELOG.md`: the rotation must land first, so a redaction cannot precede the value becoming
  inert, and a stale-but-harmless redaction would hide the fact that the live token is still public.
- I did not add a prose-token rule to the guard: it would need to distinguish a real token from every UUID and
  identifier in the changelog, which is a design decision with a real false-positive cost, not a drive-by fix.

**Source evidence:** `atlas-server/src/middleware/authenticate.ts:70-86,127-157`; route usage enumerated across
`atlas-server/src/routes/{runtime,faculty,faculty-assignment,section,dashboard,draft-schedule}.router.ts`;
committed copies at `CHANGELOG.md:2748,2757`. Incident context and the PostgreSQL rotation that preceded this:
`docs/handoffs/lane-a-credential-incident-2026-09-26.md`.
