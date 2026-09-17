# SYNC-SECTION-ENROLMENT-C01 — bounded live-data sync packet (R1)

Status: authored 2026-09-17 (Asia/Manila); **R1 corrected 2026-09-17 by the primary planner**
(see §10). A bounded live **mirror-data** sync. Requires the operator's exact approval
before the POST.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `58e0535adff79c0f01da52fb49525443a5b52603`,
  LF-SHA-256 `e7ea7f7d6b2bb36a41c7d3be29063f70900163c75de605880ac958bf1f02aa11`.
  Re-verified from Git bytes 2026-09-17.
- Base: the `origin/main` tip at dispatch. Authoring base `dd4f8552…`; dispatch base
  `43f6909f09f73c43de1f77092c23fdb764f545e7` (re-verify at execution).
- Worktree: `E:/ATLAS-worktrees/sync-section-enrolment-c01`, branch
  `chore/sync-section-enrolment-c01`, disposition `RETIRE_AFTER_INTEGRATION`.
- Risk tier: **HIGH**. The action writes to the live ATLAS database, and `AGENTS.md`
  fixes a non-downgradable floor: *"live data apply … are HIGH even when an incoming
  prompt, report, or suggested handoff labels them LOW or MEDIUM."* The action is one
  idempotent, refreshable POST with no schema change and no destructive intent, but the
  tier is HIGH and the full HIGH gate set applies: fresh independent pre-action review,
  exact operator approval, and a post-action Wave Completion Auditor.

### 0.1 Verified live runtime identity (read-only, 2026-09-17T11:13+08)

| Fact | Value |
|---|---|
| Supervisor | PID 4020 — `node D:\ATLAS-runtime-supervised-54dce67b-20260914\ops\runtime\cli.mjs start` |
| Server (5001) | PID 13244 — `…\atlas-server\dist\server.js` (parent 4020) |
| Host (5174) | PID 13260 — `…\ops\runtime\host.mjs` (parent 4020) |
| Release SHA | `54dce67b8392cbce09aa810813c37f9c87a67159` (`supervisor-state.json` `releaseSha`) |
| Product pin | `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` |
| Durable env | `D:\ATLAS-runtime-config\atlas-server.env` |
| Section source mode | `SECTION_SOURCE_MODE=enrollpro` (**no** cached-snapshot fallback) |
| Upstream base | `ENROLLPRO_API=https://dev-jegs.buru-degree.ts.net/api` |
| Required credentials | `ATLAS_SYSTEM_TOKEN` and `ENROLLPRO_SERVICE_TOKEN` both present (key names observed only) |
| Health | `/api/v1/health` → `{"status":"ok"}`; `/api/v1/health/ready` → `{"status":"ready","checks":{"database":"ok"}}` |

Note for the register: the prose register's "shared runtime release `3d916b26`" narrative is
stale; the supervisor state and process command lines agree on `54dce67b`. This packet uses
the verified identity; the register is reconciled by the closing cycle.

## 1. Verified defect

The active school year's section mirrors carry **no enrolment counts**, although the upstream
has them (read-only probes, 2026-09-17):

| Source | Result |
|---|---|
| EnrollPro `GET /integration/v1/sections` (active year) | HTTP 200, `total: 20`, **20 of 20 rows with `enrolledCount > 0`**; sample Aguinaldo 4/40, Bonifacio 5/40, Luna 4/40, Mabini 4/40, Rizal 4/40; `meta.scope` = schoolId 4 "HINIGARAN NATIONAL HIGH SCHOOL", year 9 "2030-2031", `isActiveSchoolYear: true`, TRIMESTER |
| ATLAS `section_mirrors` school 1 / **year 9 (active)** | 20 rows, **all `enrolledCount = 0`** |
| ATLAS `section_mirrors` school 1 / year 8 | 20 rows, 81 learners total (previous year's values) |
| ATLAS adapter `section-adapter.ts:529-614` | Correct: reads `page.data` across pages (`limit=200`), wraps `{data: allRows}`, maps `enrolledCount`/`maxCapacity`, and upserts the durable snapshot |

Conclusion: neither EnrollPro nor the fetch code is defective. The year-9 section mirror was
never re-synced after the counts existed upstream.

Secondary lead: `cohort.service.ts:222` consumes `enrolledCount` for cohort/specialization
sizing, so zero enrolment may also distort specialization demand.

## 2. Exact action (exactly one)

```
POST /api/v1/sections/sync
Auth: authenticateWithSystemToken + requirePrivilegedRole
      (system token; NO browser login, NO JWT, NO upstream bridge token)
Body: { "schoolId": 1, "schoolYearId": 9 }
```

- Route `atlas-server/src/routes/section.router.ts:112-160`, mounted at
  `atlas-server/src/app.ts:111` (`app.use('/api/v1/sections', sectionRouter)`).
- Service `syncSectionsFromExternal` (`atlas-server/src/services/section.service.ts:193-299`).
- Adapter `EnrollProSectionAdapter.fetchSectionsBySchoolYear`
  (`atlas-server/src/services/section-adapter.ts:529-615`); durable snapshot upsert at
  `saveSectionSnapshot` (`section-adapter.ts:443-462`).
- Token read **in-process only** from `D:\ATLAS-runtime-config\atlas-server.env`; never
  printed, echoed, logged, or written to any artifact.
- One POST. **No retry, no replay, no warm-up request.**

### 2.1 Write semantics (verified, stated truthfully)

- Upsert key `(schoolId, schoolYearId, externalId)` — 20 rows for (1, 9).
- **The route also hard-deletes** rows in scope whose `externalId` is absent from the
  upstream response (`section.service.ts:283-289`). The delete is scoped to
  `(schoolId, schoolYearId)`, so **year 8 cannot be touched**, but a truncated or
  invalid upstream page would remove rows. Two controls:
  1. the preflight requires `count = 20` with `skipped = 0` and `removed = 0` in the response;
  2. the pre-state y9 row set (id, externalId, name, maxCapacity, enrolledCount) is captured
     in the evidence before the POST so the exact prior state is restorable.
- `getUpstreamAuthToken` returns `undefined` for `authSource === 'system'`
  (`middleware/upstream-auth.ts:13-19`), so the adapter authenticates upstream with
  `process.env.ENROLLPRO_SERVICE_TOKEN` — present in the durable env (§0.1). This is why the
  system-token path is sufficient and no bridge token is needed.
- `SECTION_SOURCE_MODE=enrollpro` selects `EnrollProSectionAdapter` directly, not
  `AutoSectionAdapter`: there is **no silent cached-snapshot fallback**. If upstream is
  unreachable the sync throws and the POST fails — fail-closed.

## 3. Execution mechanism (R1 — names the exact reviewed procedure)

The preflight, the single POST, and the post-state capture run in **one Node process**, so
there is no window between preflight and POST and no stale preflight.

- The harness is written to `%TEMP%\opencode\sync-section-enrolment-c01\run.mjs` — outside
  the repository. The harness text below is the reviewed artifact; the committed candidate is
  the packet that contains it.
- It runs with `workdir = D:\ATLAS-runtime-supervised-54dce67b-20260914` and loads that
  checkout's Prisma client (shared dependency tree used **read-only**; no install).
- It performs **read-only** database access only: `findMany` / `count` / `aggregate`. No
  `$executeRaw`, no write, no schema or migration command, no `prisma db push`.
- If any preflight predicate fails it prints `PREFLIGHT_FAIL` and exits **without issuing the
  POST**.
- It prints one JSON document: `preflight`, `request` (token redacted), `response`, `post`,
  `acceptance[]`, `deltas`, `verdict`.

````js
// %TEMP%\opencode\sync-section-enrolment-c01\run.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ENV = 'D:/ATLAS-runtime-config/atlas-server.env';
const RELEASE = 'D:/ATLAS-runtime-supervised-54dce67b-20260914';
const BASE = 'http://127.0.0.1:5001';
const SCHOOL = 1, YEAR = 9, BODY = { schoolId: SCHOOL, schoolYearId: YEAR };
const out = (o) => { process.stdout.write(JSON.stringify(o, null, 2) + '\n'); };
const hash = (s) => {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(s).digest('hex');
};

// 1. env loaded in-process; nothing is ever printed from it
for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const require = createRequire(`file:///${RELEASE}/`);
const { PrismaClient } = require(`${RELEASE}/node_modules/.prisma/client/default.js`);
const db = new PrismaClient();

const y9sel = { schoolId: SCHOOL, schoolYearId: YEAR };
const rowSig = (r) => [r.id, r.externalId, r.name, r.gradeLevelId, r.gradeLevelName, r.displayOrder,
  r.maxCapacity, r.enrolledCount, r.programType, r.programCode, r.programName, r.isSpecialProgram,
  r.isActiveForScheduling, r.preferredRoomId, r.homeRoomId, r.buildingZoneId,
  r.lastSyncedAt?.toISOString() ?? null, r.isStale, r.staleReason, r.staleAt?.toISOString() ?? null,
  r.version, r.createdAt.toISOString(), r.updatedAt.toISOString()];

async function signature() {
  const y9 = await db.sectionMirror.findMany({ where: y9sel, orderBy: { id: 'asc' } });
  const y8 = await db.sectionMirror.findMany({ where: { schoolId: SCHOOL, schoolYearId: 8 }, orderBy: { id: 'asc' } });
  const snaps = await db.sectionSnapshot.findMany({ where: { schoolId: SCHOOL }, orderBy: { schoolYearId: 'asc' } });
  const sym = await db.enrollProSchoolYearMirror.findMany({
    where: { schoolId: SCHOOL }, orderBy: { enrollProSchoolYearId: 'asc' },
  });
  const [tlc, fs, sso, gr, psr, cps, al] = await Promise.all([
    db.teachingLoadCycle.count(), db.facultySubject.count(), db.subjectSectionOwnership.count(),
    db.generationRun.count(), db.publishedScheduleRevision.count(), db.classProgramSlot.count(),
    db.auditLog.count(),
  ]);
  const syncs = y9.map((r) => r.lastSyncedAt?.toISOString() ?? null);
  return {
    y9: {
      count: y9.length,
      counted: y9.filter((r) => r.enrolledCount > 0).length,
      sum: y9.reduce((a, r) => a + r.enrolledCount, 0),
      distinctLastSyncedAt: [...new Set(syncs)].sort(),
      allFresh: y9.every((r) => r.isStale === false && r.staleReason === null),
      rows: y9.map((r) => ({ id: r.id, externalId: r.externalId, name: r.name,
        maxCapacity: r.maxCapacity, enrolledCount: r.enrolledCount, lastSyncedAt: r.lastSyncedAt })),
      hash: hash(JSON.stringify(y9.map(rowSig))),
    },
    y8: { count: y8.length, sum: y8.reduce((a, r) => a + r.enrolledCount, 0),
      hash: hash(JSON.stringify(y8.map(rowSig))) },
    snapshots: snaps.map((s) => ({ schoolYearId: s.schoolYearId, source: s.source,
      fetchedAt: s.fetchedAt, checksum: s.checksum })),
    schoolYearMirror: sym.map((m) => ({ id: m.id, enrollProSchoolYearId: m.enrollProSchoolYearId,
      yearLabel: m.yearLabel, isActive: m.isActive, isArchived: m.isArchived, syncStatus: m.syncStatus,
      sectionCount: m.sectionCount, lastSyncedAt: m.lastSyncedAt, lastVerifiedAt: m.lastVerifiedAt })),
    protected: { teachingLoadCycle: tlc, facultySubject: fs, subjectSectionOwnership: sso,
      generationRun: gr, publishedScheduleRevision: psr, classProgramSlot: cps, auditLog: al },
  };
}

async function upstream() {
  const url = `${process.env.ENROLLPRO_API}/integration/v1/sections?page=1&limit=200`;
  const t = process.env.ENROLLPRO_SERVICE_TOKEN;
  const r = await fetch(url, { headers: t ? { Authorization: `Bearer ${t}` } : undefined,
    signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { ok: false, status: r.status };
  const j = await r.json();
  const rows = Array.isArray(j.data) ? j.data : [];
  const pages = Number(j.meta?.totalPages ?? 1) || 1;
  if (pages > 1) return { ok: false, status: 200, error: 'MULTI_PAGE_PREFLIGHT_UNSUPPORTED', pages };
  return { ok: true, status: r.status, total: j.total ?? rows.length, rows: rows.length,
    counted: rows.filter((s) => (s.enrolledCount ?? 0) > 0).length,
    sum: rows.reduce((a, s) => a + (s.enrolledCount ?? 0), 0),
    scope: j.meta?.scope ?? null };
}

const pre = await signature();
const up = await upstream();
const health = await (await fetch(`${BASE}/api/v1/health/ready`)).json().catch(() => null);
const activeY9 = pre.schoolYearMirror.filter((m) => m.enrollProSchoolYearId === YEAR && m.isActive && !m.isArchived);

const preflight = {
  y9_is_20_rows: pre.y9.count === 20,
  y9_all_zero: pre.y9.counted === 0,
  upstream_200_20_all_counted: up.ok === true && up.rows === 20 && up.counted === 20,
  exactly_one_active_non_archived_y9_mirror: activeY9.length === 1,
  ready_with_database_ok: health?.checks?.database === 'ok',
};
if (Object.values(preflight).some((v) => v !== true)) {
  out({ verdict: 'PREFLIGHT_FAIL', preflight, upstream: up, pre, health });
  await db.$disconnect();
  process.exit(2);
}

const token = process.env.ATLAS_SYSTEM_TOKEN;
const res = await fetch(`${BASE}/api/v1/sections/sync`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(BODY), signal: AbortSignal.timeout(60000) });
const status = res.status;
const body = await res.json().catch(() => null);
if (status !== 200) {
  out({ verdict: 'POST_FAILED', preflight, request: { method: 'POST', url: `${BASE}/api/v1/sections/sync`,
    body: BODY, auth: 'Bearer [REDACTED]' }, status, body, upstream: up, pre });
  await db.$disconnect();
  process.exit(3);
}

const post = await signature();
const healthPost = await (await fetch(`${BASE}/api/v1/health/ready`)).json().catch(() => null);
const snap9 = post.snapshots.filter((s) => s.schoolYearId === YEAR);
const preSnap9 = pre.snapshots.filter((s) => s.schoolYearId === YEAR);
const y9Sync = [...new Set(post.y9.distinctLastSyncedAt)];
const A = (id, pass, detail) => ({ id, pass, detail });
const acceptance = [
  A('L1 response 200 / count 20 / removed 0 / skipped 0', status === 200 && body?.count === 20
    && body?.removed === 0 && body?.skipped === 0 && body?.synced === true, { status, body }),
  A('L2 20/20 counted, sum == upstream total', post.y9.counted === 20 && post.y9.sum === up.sum
    && post.y9.count === up.rows, { counted: post.y9.counted, sum: post.y9.sum, upstreamSum: up.sum }),
  A('L3 identity: 20 rows, same externalIds+names, maxCapacity unchanged, no add/remove',
    JSON.stringify(pre.y9.rows.map((r) => [r.externalId, r.name, r.maxCapacity]).sort())
    === JSON.stringify(post.y9.rows.map((r) => [r.externalId, r.name, r.maxCapacity]).sort()),
    { preIds: pre.y9.rows.length, postIds: post.y9.rows.length }),
  A('L4 year 8 byte-identical', pre.y8.hash === post.y8.hash && pre.y8.count === post.y8.count
    && pre.y8.sum === post.y8.sum, { preHash: pre.y8.hash, postHash: post.y8.hash }),
  A('L5 exactly one section_snapshots row for y9, source enrollpro, checksum changed',
    snap9.length === 1 && snap9[0].source === 'enrollpro'
    && (preSnap9.length === 0 || preSnap9[0].checksum !== snap9[0].checksum),
    { pre: preSnap9, post: snap9 }),
  A('L6 single-fetch uniformity: one lastSyncedAt on all 20 rows, equal to snapshot fetchedAt, all fresh',
    y9Sync.length === 1 && new Date(y9Sync[0]).getTime() === new Date(snap9[0].fetchedAt).getTime()
    && post.y9.allFresh, { distinctLastSyncedAt: post.y9.distinctLastSyncedAt,
    snapshotFetchedAt: snap9[0]?.fetchedAt, allFresh: post.y9.allFresh }),
  A('L7 audit_logs delta 0 (route writes no audit row)',
    post.protected.auditLog === pre.protected.auditLog, { pre: pre.protected.auditLog,
    post: post.protected.auditLog }),
  A('L8 protected domains delta 0', ['teachingLoadCycle', 'facultySubject', 'subjectSectionOwnership',
    'generationRun', 'publishedScheduleRevision', 'classProgramSlot']
    .every((k) => post.protected[k] === pre.protected[k]),
    Object.fromEntries(Object.keys(pre.protected).map((k) => [k, [pre.protected[k], post.protected[k]]]))),
  A('L9 health/ready 200 database ok after the POST', healthPost?.checks?.database === 'ok', { healthPost }),
  A('L10 mirror syncStatus reported', true, { pre: activeY9[0] ?? null,
    post: post.schoolYearMirror.find((m) => m.enrollProSchoolYearId === YEAR) ?? null }),
];
out({
  verdict: acceptance.every((a) => a.pass) ? 'ACCEPTANCE_PASS' : 'ACCEPTANCE_FAIL',
  preflight, upstream: up,
  request: { method: 'POST', url: `${BASE}/api/v1/sections/sync`, body: BODY, auth: 'Bearer [REDACTED]' },
  status, response: body, acceptance, deltas: { pre, post }, health: { pre: health, post: healthPost },
});
await db.$disconnect();
````

Invocation (single command, workdir `D:\ATLAS-runtime-supervised-54dce67b-20260914`):

```
node "%TEMP%\opencode\sync-section-enrolment-c01\run.mjs"
```

## 4. Acceptance matrix (R1)

Classes: `MANDATORY_SOURCE` = 2, `MANDATORY_LIVE` = 10, `DEFERRED_EXTERNAL` = 1 (plan total 13).

### MANDATORY_SOURCE

| # | Requirement | Observable pass condition | Failing-first control |
|---|---|---|---|
| S1 | Fresh independent pre-action review of this packet | Committed review artifact returning `ACCEPT_READY` with tally `2/2/0/0/0` | The pre-state y9 counts are all 0; a packet that could not change them would not be accepted |
| S2 | Production path reproduced from the deployed release | Route mounted (`app.ts:111`), auth chain, service upsert/delete scope, adapter pagination + snapshot upsert, `SECTION_SOURCE_MODE=enrollpro` | The delete path (`section.service.ts:283-289`) is the adversarial control: any upstream truncation removes rows, so `count/skipped/removed` are gated in L1 |

### MANDATORY_LIVE

L1–L10 as computed by the harness in §3. L1 additionally requires `removed: 0` **and
`skipped: 0`** — a non-zero `skipped` is the mechanism by which an invalid upstream row would
be silently hard-deleted, so it is a blocking condition, not a note.

### DEFERRED_EXTERNAL

| # | Requirement | Why deferred | Owner and unlock condition |
|---|---|---|---|
| D1 | "Exactly one `SECTION_SYNC_COMPLETED` notification" (original row 6) | `publishNotificationEvent` (`notification-events.service.ts:76-101`) appends to an **in-memory buffer + SSE fan-out only**; there is no Prisma model, so no database delta exists and the event cannot be observed post-hoc. The SSE route requires an authenticated actor school (`notification.router.ts:143-151`); the system-token actor is `{userId: 0, role: 'SYSTEM_ADMIN'}` with no school (`authenticate.ts:136-141`), so observing it would require a browser login that this packet does not authorize. | Next primary planner. Unlock condition: a separate packet that authorizes one privileged browser login and binds a pre-POST SSE subscription. Not blocking this cycle. |

The 200 response with `count: 20` entails exactly one `publishNotificationEvent` call, because
the call sits between the sync resolution and `res.json` in a single handler
(`section.router.ts:139-156`) and the packet authorizes exactly one POST with no retry. This is
recorded as a disclosed entailment, **not** as a passed gate.

## 5. Preflight (inside the §3 harness; any divergence is a STOP)

1. `registry.revision` re-read from `origin/main` before each transition.
2. y9 baseline: 20 rows, **0** with `enrolledCount > 0`.
3. Upstream: `GET {ENROLLPRO_API}/integration/v1/sections` → 200, 20 rows, all counted; single page.
4. Exactly one active, non-archived `EnrollProSchoolYearMirror` for school 1 with
   `enrollProSchoolYearId` 9.
5. Full pre-state signature captured: y9 mirror rows (incl. per-row `id`, `externalId`, `name`,
   `maxCapacity`, `enrolledCount`, `lastSyncedAt`), y8 mirror hash, `section_snapshots`,
   `enrollpro_school_year_mirrors`, and the protected-domain counts + `audit_logs`.
6. `/api/v1/health/ready` reports `database: ok`.

## 6. Rollback

- The sync is idempotent over the same read-only upstream; the rollback is a **re-run** of the
  same single POST.
- The pre-state y9 row set is captured before the POST (§5.5), so if the upstream row set
  changed the exact prior `enrolledCount` / `maxCapacity` / `name` values are restorable from
  the committed evidence.
- **Do NOT hand-edit `section_mirrors`.** Any restore is an application-path write under a
  separate reviewed packet.

## 7. Boundaries

One POST, one school (1), one year (9). Read-only ATLAS HTTP access is limited to
`/api/v1/health` and `/api/v1/health/ready`. No other ATLAS endpoint. Read-only database
access is limited to `findMany`/`count`/`aggregate` on the tables named in §3. EnrollPro is
**READ_ONLY** and is read exactly once through the packet's preflight GET. No rollover,
term-cache apply, Teaching Load write, generation, publication, migration, deployment or
restart, task/environment change, or companion action. No browser login.

## 8. Return contract

Pre-state signature table; the exact request (token redacted) and the response body; the
acceptance table with the y9 total; the resulting mirror `syncStatus` (pre → post); the full
delta table; rollback statement; approval status; register state; push status; worktree
disposition; single next action; and the D1 deferral restated.

## 9. Registration annex (R1)

Registered via `ops/workflow/transition.mjs` from `origin/main` (CAS on `registry.revision`).

**Transition-surface gap (under-report, disclosed).** There is no `record-approval` or
`record-execution` transition on the current `origin/main`; those belong to WF-C10
(`WF-C10-TRANSITION-GUARD-HARDENING`, `RUNNING`, not integrated). Therefore:

- `approval.granted`, `approval.presentedReady`, and `approval.execution` remain `false`/`null`
  in the machine record while the operator's grant is recorded in **committed evidence**
  (`docs/reviews/sync-section-enrolment-c01/`). The machine record under-reports the grant
  until WF-C10 lands; this is disclosed rather than worked around by hand-editing state.
- The approval rules that are structural still apply and are enforced by the verifier:
  `HIGH_EXECUTION_WITHOUT_APPROVAL` and `HIGH_BOUNDARY_EXCEEDED` fire if
  `approval.execution.performed` is ever set without a complete granted approval.
- Closure uses the available transitions: `record-executor-return` → `record-qa-result`
  (`ACCEPT_READY`) → `record-integration` → `record-audit` (`AUDIT_CLEAR`) → `close-cycle`
  (receipt) → `record-remote-observation`.

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-09-17 | planner | Initial packet + stream spec authored (base `dd4f8552`) |
| 2026-09-17 | primary planner | **R1**: raised the risk tier to HIGH per the `AGENTS.md` non-downgradable live-data floor; pinned the verified live runtime identity (`54dce67b`, supervisor 4020 / server 13244 / host 13260) because the prose register's `3d916b26` narrative is stale; named the exact reviewed single-process execution harness and its read-only DB/env boundaries; corrected row 6 (notification) to `DEFERRED_EXTERNAL` with source evidence because `publishNotificationEvent` is in-memory only and unobservable without an unauthorized login; corrected row 7 to the observable `audit_logs delta = 0` because the route writes no audit row; added `skipped: 0` / `removed: 0` as blocking conditions for the documented hard-delete path; added the single-fetch uniformity row `L6`; recorded the stale deletion-residue/invalid-year fallbacks discovered in the adapter (`SECTION_SOURCE_MODE=enrollpro` ⇒ no snapshot fallback); documented the WF-C10 transition-surface under-report |
