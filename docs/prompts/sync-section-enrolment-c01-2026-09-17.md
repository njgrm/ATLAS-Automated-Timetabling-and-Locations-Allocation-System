# SYNC-SECTION-ENROLMENT-C01 — bounded live-data sync packet (R3)

Status: authored 2026-09-17 (Asia/Manila); **R1 corrected 2026-09-17**, **R2 corrected 2026-09-17**
after a fresh independent pre-action review returned `CORRECTION_REQUIRED` over the R1 harness, and
**R3 corrected 2026-09-17** after a second fresh review returned `CORRECTION_REQUIRED` on the §2.1
delete-guard wording while confirming `MANDATORY_SOURCE 2/2, blocked 0, unperformed 0` (see §10).
Requires the operator's exact approval before the POST.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. Re-verified from
  Git bytes 2026-09-17.
- Git ranges: **review base `19d4dbba` → R1 `4deb9d9c` → R2 `3ceab907` → R3 tip named in the
  dispatch handoff** (a packet cannot self-pin the commit that contains it). Each revision corrects
  forward from the previous one; the enlarged review range is `19d4dbba..<R3 tip>`.
  The registered `git.baseSha` retains its creation-time value `43f6909f` (the immediate ancestor
  of `19d4dbba`) by design; `19d4dbba` is the review base and was `origin/main` when R1 was pushed.
  `origin/main` advanced to `0a134bba` during R2 authoring because a **concurrent planner cycle**
  (`SLOT-BREAK-AUTHORITY-C11R`) took the register; this packet's register row survives and its
  register writes are deferred until that contention clears (§9).
- Worktree: `E:/ATLAS-worktrees/sync-section-enrolment-c01`, branch
  `chore/sync-section-enrolment-c01`, disposition `RETIRE_AFTER_INTEGRATION`. R2 changes are
  **docs-only**: this packet and the stream spec. No product source, no test, no harness file in the
  repository.
- Risk tier: **HIGH**. The action writes to the live ATLAS database, and `AGENTS.md` fixes a
  non-downgradable floor: *"live data apply … are HIGH even when an incoming prompt, report, or
  suggested handoff labels them LOW or MEDIUM."* The action is one idempotent, refreshable POST with
  no schema change and no destructive intent, but the tier is HIGH and the full HIGH gate set
  applies: fresh independent pre-action review, exact operator approval, and a post-action Wave
  Completion Auditor.

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
| Database | `localhost:5432/atlas_recovery_clean_rebuild_20260905` (credentials never displayed) |
| Health | `/api/v1/health` → `{"status":"ok"}`; `/api/v1/health/ready` → `{"status":"ready","checks":{"database":"ok"}}` |

Independently confirmed by the R1 pre-action review. The machine register row
`ENROLLPRO-PROXY-RECOVERY-LIVE` agrees (`LIVE_ACCEPTED`, release `54dce67b`).

## 1. Verified defect

The active school year's section mirrors carry **no enrolment counts**, although the upstream has
them (read-only probes, 2026-09-17):

| Source | Result |
|---|---|
| EnrollPro `GET /integration/v1/sections` (active year) | HTTP 200, `total: 20`, **20 of 20 rows with `enrolledCount > 0`**; sample Aguinaldo 4/40, Bonifacio 5/40, Luna 4/40, Mabini 4/40, Rizal 4/40; `meta.scope` = schoolId 4 "HINIGARAN NATIONAL HIGH SCHOOL", year 9 "2030-2031", `isActiveSchoolYear: true`, TRIMESTER |
| ATLAS `section_mirrors` school 1 / **year 9 (active)** | 20 rows, **all `enrolledCount = 0`** (independently reproduced by the R1 review) |
| ATLAS `section_mirrors` school 1 / year 8 | 20 rows, 81 learners total (independently reproduced) |
| ATLAS `section_snapshots` (1,9) | pre-existing, source `enrollpro`, `fetchedAt 2026-09-10T18:53:39.868Z` |
| ATLAS adapter `section-adapter.ts:529-615` | Correct: reads `page.data` across pages (`limit=200`), maps `enrolledCount`/`maxCapacity`, and upserts the durable snapshot |

Conclusion: neither EnrollPro nor the fetch code is defective. The year-9 section mirror was never
re-synced after the counts existed upstream.

Secondary lead: `cohort.service.ts:222` consumes `enrolledCount` for cohort/specialization sizing,
so zero enrolment may also distort specialization demand.

## 2. Exact action (exactly one)

```
POST /api/v1/sections/sync
Auth: authenticateWithSystemToken + requirePrivilegedRole
      (system token; NO browser login, NO JWT, NO upstream bridge token)
Body: { "schoolId": 1, "schoolYearId": 9 }
```

- Route `atlas-server/src/routes/section.router.ts:112-160`, mounted at
  `atlas-server/src/app.ts:111` (R2/review base) / `:110` (deployed release `54dce67b`).
- Service `syncSectionsFromExternal` (`atlas-server/src/services/section.service.ts:193-299`).
- Adapter `EnrollProSectionAdapter.fetchSectionsBySchoolYear`
  (`atlas-server/src/services/section-adapter.ts:529-615`); durable snapshot upsert at
  `saveSectionSnapshot` (`section-adapter.ts:443-462`, called at `:611-612`).
- Token read **in-process only** from `D:\ATLAS-runtime-config\atlas-server.env`; never printed,
  echoed, logged, or written to any artifact.
- One POST. **No retry, no replay, no warm-up request.**

### 2.1 Write semantics (verified, stated truthfully)

- Upsert key `(schoolId, schoolYearId, externalId)` — 20 rows for (1, 9).
- **The route also hard-deletes** rows in scope whose `externalId` is absent from the upstream
  response (`section.service.ts:283-289`). The delete is scoped to `(schoolId, schoolYearId)`, so
  **year 8 cannot be touched**. There is **no non-empty-set guard**: the `deleteMany` runs
  unconditionally with `externalId: { notIn: Array.from(externalIds) }`, and an empty or reduced
  valid set removes every in-scope row it does not name — an empty `notIn` matches all 20 in-scope
  year-9 rows, while the response would report a low `count`. The operative protections are therefore
  the harness preflight (20 raw upstream rows, 20 counted, a 20-row local baseline) plus L1
  (`count 20`, `skipped 0`, `removed 0`), with the pre-state y9 signature as the only recovery
  source. Three controls:
  1. the preflight requires 20 upstream rows and a 20-row local baseline before the POST;
  2. L1 requires `count = 20`, `skipped = 0`, and `removed = 0` in the response (`skipped > 0` is the
     mechanism by which an invalid upstream row would be silently deleted, so it is blocking);
  3. the pre-state y9 row set — including ATLAS-only fields `preferredRoomId`, `homeRoomId`,
     `buildingZoneId`, `lastSyncedAt`, `isStale` — is captured in the evidence before the POST.
- `getUpstreamAuthToken` returns `undefined` for `authSource === 'system'`
  (`middleware/upstream-auth.ts:13-19`), so the adapter authenticates upstream with
  `process.env.ENROLLPRO_SERVICE_TOKEN` — present in the durable env (§0.1). This is why the
  system-token path is sufficient and no bridge token is needed.
- `SECTION_SOURCE_MODE=enrollpro` selects `EnrollProSectionAdapter` directly, not
  `AutoSectionAdapter`: there is **no silent cached-snapshot fallback**. If upstream is unreachable
  the sync throws and the POST fails — fail-closed.
- `enrollProSchoolYearMirror` is **not** touched by this route (verified: the model appears nowhere
  in `section.service.ts`, `section.router.ts`, or `section-adapter.ts`). The mirror `syncStatus`
  therefore cannot change and is reported as a **non-gating pre→post disclosure** (L10), not as a
  pass/fail gate.

## 3. Execution mechanism (R2 — the exact reviewed procedure)

The preflight, the single POST, and the post-state capture run in **one Node process**, so there is
no window between preflight and POST and no stale preflight.

- The harness is written to `%TEMP%\opencode\sync-section-enrolment-c01\run.mjs` — outside the
  repository. The harness text below is the reviewed artifact; the committed candidate is the packet
  that contains it. No harness file is committed.
- It runs with `workdir = D:\ATLAS-runtime-supervised-54dce67b-20260914` and loads the **generated**
  Prisma client from `…\atlas-server\node_modules\.prisma\client\` (shared dependency tree used
  **read-only**; no install). It must **not** load the release-root
  `…\node_modules\.prisma\client\default.js`, which is Prisma's uninitialized stub and throws at
  construction (R1 review B1).
- It performs **read-only** database access only: `findMany` / `count`. No `create`, `update`,
  `delete`, `upsert`, `$transaction`, `$executeRaw`, `queryRaw`, schema or migration command.
- If any preflight predicate fails it prints `PREFLIGHT_FAIL` and exits **without issuing the POST**.
- It prints one JSON document: `preflight`, `request` (token redacted), `response`, `acceptance[]`,
  `deltas`, `verdict`.

````js
// %TEMP%\opencode\sync-section-enrolment-c01\run.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const ENV = 'D:/ATLAS-runtime-config/atlas-server.env';
const RELEASE = 'D:/ATLAS-runtime-supervised-54dce67b-20260914';
const BASE = 'http://127.0.0.1:5001';
const SCHOOL = 1, YEAR = 9, BODY = { schoolId: SCHOOL, schoolYearId: YEAR };
const out = (o) => { process.stdout.write(JSON.stringify(o, null, 2) + '\n'); };
const hash = (s) => createHash('sha256').update(s).digest('hex');

for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const require = createRequire(`file:///${RELEASE}/atlas-server/`);
const { PrismaClient } = require(`${RELEASE}/atlas-server/node_modules/.prisma/client/default.js`);
const db = new PrismaClient();

const getJson = async (url, opts) => {
  try {
    const r = await fetch(url, opts);
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
  } catch (e) { return { ok: false, status: 0, json: null, error: String(e) }; }
};

const rowSig = (r) => [r.id, r.externalId, r.name, r.gradeLevelId, r.gradeLevelName, r.displayOrder,
  r.maxCapacity, r.enrolledCount, r.programType, r.programCode, r.programName, r.isSpecialProgram,
  r.isActiveForScheduling, r.preferredRoomId, r.homeRoomId, r.buildingZoneId,
  r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null, r.isStale, r.staleReason,
  r.staleAt ? r.staleAt.toISOString() : null, r.version,
  r.createdAt.toISOString(), r.updatedAt.toISOString()];

async function signature() {
  const y9 = await db.sectionMirror.findMany({ where: { schoolId: SCHOOL, schoolYearId: YEAR }, orderBy: { id: 'asc' } });
  const y8 = await db.sectionMirror.findMany({ where: { schoolId: SCHOOL, schoolYearId: 8 }, orderBy: { id: 'asc' } });
  const other = await db.sectionMirror.findMany({
    where: { OR: [{ schoolId: { not: SCHOOL } }, { schoolYearId: { not: YEAR } }] }, orderBy: { id: 'asc' },
  });
  const snaps = await db.sectionSnapshot.findMany({ where: { schoolId: SCHOOL }, orderBy: { schoolYearId: 'asc' } });
  const sym = await db.enrollProSchoolYearMirror.findMany({ where: { schoolId: SCHOOL }, orderBy: { enrollProSchoolYearId: 'asc' } });
  const [tlc, fs, sso, gr, psr, cps, al] = await Promise.all([
    db.teachingLoadCycle.count(), db.facultySubject.count(), db.subjectSectionOwnership.count(),
    db.generationRun.count(), db.publishedScheduleRevision.count(), db.classProgramSlot.count(),
    db.auditLog.count(),
  ]);
  return {
    y9: {
      count: y9.length,
      counted: y9.filter((r) => r.enrolledCount > 0).length,
      sum: y9.reduce((a, r) => a + r.enrolledCount, 0),
      distinctLastSyncedAt: [...new Set(y9.map((r) => (r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null)))].sort(),
      allFresh: y9.every((r) => r.isStale === false && r.staleReason === null),
      rows: y9.map((r) => ({ id: r.id, externalId: r.externalId, name: r.name, maxCapacity: r.maxCapacity,
        enrolledCount: r.enrolledCount, lastSyncedAt: r.lastSyncedAt, preferredRoomId: r.preferredRoomId,
        homeRoomId: r.homeRoomId, buildingZoneId: r.buildingZoneId, isStale: r.isStale })),
      hash: hash(JSON.stringify(y9.map(rowSig))),
    },
    y8: { count: y8.length, sum: y8.reduce((a, r) => a + r.enrolledCount, 0), hash: hash(JSON.stringify(y8.map(rowSig))) },
    outOfScope: { count: other.length, hash: hash(JSON.stringify(other.map(rowSig))) },
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
  const r = await getJson(url, { headers: t ? { Authorization: `Bearer ${t}` } : undefined,
    signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { ok: false, status: r.status, error: r.error ?? null };
  const j = r.json;
  const rows = Array.isArray(j && j.data) ? j.data : [];
  const pages = Number(j && j.meta && j.meta.totalPages ? j.meta.totalPages : 1) || 1;
  if (pages > 1) return { ok: false, status: r.status, error: 'MULTI_PAGE_PREFLIGHT_UNSUPPORTED', pages };
  return { ok: true, status: r.status, total: j.total != null ? j.total : rows.length, rows: rows.length,
    counted: rows.filter((s) => (s.enrolledCount != null ? s.enrolledCount : 0) > 0).length,
    sum: rows.reduce((a, s) => a + (s.enrolledCount != null ? s.enrolledCount : 0), 0),
    scope: j.meta ? j.meta.scope : null };
}

const pre = await signature();
const up = await upstream();
const health = await getJson(`${BASE}/api/v1/health/ready`);
const activeY9 = pre.schoolYearMirror.filter((m) => m.enrollProSchoolYearId === YEAR && m.isActive && !m.isArchived);

const preflight = {
  y9_is_20_rows: pre.y9.count === 20,
  y9_all_zero: pre.y9.counted === 0,
  upstream_200_20_all_counted: up.ok === true && up.rows === 20 && up.counted === 20,
  exactly_one_active_non_archived_y9_mirror: activeY9.length === 1,
  ready_with_database_ok: !!(health.json && health.json.checks && health.json.checks.database === 'ok'),
};
if (Object.values(preflight).some((v) => v !== true)) {
  out({ verdict: 'PREFLIGHT_FAIL', preflight, upstream: up, health: { status: health.status }, pre });
  await db.$disconnect();
  process.exit(2);
}

const preTs = new Date();
const token = process.env.ATLAS_SYSTEM_TOKEN;
const res = await fetch(`${BASE}/api/v1/sections/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(BODY),
  signal: AbortSignal.timeout(60000),
}).catch((e) => ({ status: 0, json: async () => null, error: String(e) }));
const status = res.status;
const body = await res.json().catch(() => null);
const request = { method: 'POST', url: `${BASE}/api/v1/sections/sync`, body: BODY, auth: 'Bearer [REDACTED]' };
if (status !== 200) {
  out({ verdict: 'POST_FAILED', preflight, upstream: up, request, status, body, pre });
  await db.$disconnect();
  process.exit(3);
}

const post = await signature();
const healthPost = await getJson(`${BASE}/api/v1/health/ready`);
const snap9 = post.snapshots.filter((s) => s.schoolYearId === YEAR);
const preSnap9 = pre.snapshots.filter((s) => s.schoolYearId === YEAR);
const y9Sync = [...new Set(post.y9.distinctLastSyncedAt)];
const oneSnapFresh = snap9.length === 1 && snap9[0].source === 'enrollpro'
  && snap9[0].fetchedAt != null && new Date(snap9[0].fetchedAt).getTime() > preTs.getTime();
const A = (id, pass, detail) => ({ id, pass: pass === true, detail });
const acceptance = [
  A('L1 response 200 / count 20 / removed 0 / skipped 0', status === 200 && body != null
    && body.count === 20 && body.removed === 0 && body.skipped === 0 && body.synced === true,
    { status, body }),
  A('L2 20/20 counted, sum == upstream total', post.y9.counted === 20 && post.y9.sum === up.sum
    && post.y9.count === up.rows, { counted: post.y9.counted, sum: post.y9.sum, upstreamSum: up.sum }),
  A('L3 identity: 20 rows, same externalIds+names, maxCapacity unchanged, no add/remove',
    JSON.stringify(pre.y9.rows.map((r) => [r.externalId, r.name, r.maxCapacity]).sort())
    === JSON.stringify(post.y9.rows.map((r) => [r.externalId, r.name, r.maxCapacity]).sort()),
    { preRows: pre.y9.rows.length, postRows: post.y9.rows.length }),
  A('L4 year 8 byte-identical', pre.y8.hash === post.y8.hash && pre.y8.count === post.y8.count
    && pre.y8.sum === post.y8.sum, { preHash: pre.y8.hash, postHash: post.y8.hash }),
  A('L5 snapshot refreshed: exactly one (1,9) row, source enrollpro, fetchedAt after the pre-POST clock',
    oneSnapFresh, { preTs: preTs.toISOString(), pre: preSnap9, post: snap9 }),
  A('L6 single-fetch uniformity: one lastSyncedAt on all 20 rows, equal to snapshot fetchedAt, all fresh',
    y9Sync.length === 1 && oneSnapFresh && y9Sync[0] != null
    && new Date(y9Sync[0]).getTime() === new Date(snap9[0].fetchedAt).getTime() && post.y9.allFresh,
    { distinctLastSyncedAt: post.y9.distinctLastSyncedAt, snapshotFetchedAt: snap9[0] ? snap9[0].fetchedAt : null,
      allFresh: post.y9.allFresh }),
  A('L7 audit_logs delta 0 (route writes no audit row)',
    post.protected.auditLog === pre.protected.auditLog,
    { pre: pre.protected.auditLog, post: post.protected.auditLog }),
  A('L8 protected domains delta 0', ['teachingLoadCycle', 'facultySubject', 'subjectSectionOwnership',
    'generationRun', 'publishedScheduleRevision', 'classProgramSlot']
    .every((k) => post.protected[k] === pre.protected[k]),
    Object.fromEntries(Object.keys(pre.protected).map((k) => [k, [pre.protected[k], post.protected[k]]]))),
  A('L9 health/ready 200 database ok after the POST',
    !!(healthPost.json && healthPost.json.checks && healthPost.json.checks.database === 'ok'),
    { status: healthPost.status, body: healthPost.json }),
  A('L10 write scope isolation: every section_mirrors row outside (school 1, year 9) is byte-identical',
    pre.outOfScope.hash === post.outOfScope.hash && pre.outOfScope.count === post.outOfScope.count,
    { preHash: pre.outOfScope.hash, postHash: post.outOfScope.hash, count: post.outOfScope.count }),
];
out({
  verdict: acceptance.every((a) => a.pass) ? 'ACCEPTANCE_PASS' : 'ACCEPTANCE_FAIL',
  preflight, upstream: up, request, status, response: body, acceptance,
  y9CountTotal: post.y9.sum,
  mirrorSyncStatus: {
    pre: activeY9[0] ? { id: activeY9[0].id, syncStatus: activeY9[0].syncStatus, sectionCount: activeY9[0].sectionCount } : null,
    post: (() => { const m = post.schoolYearMirror.find((x) => x.enrollProSchoolYearId === YEAR);
      return m ? { id: m.id, syncStatus: m.syncStatus, sectionCount: m.sectionCount } : null; })(),
    gating: false,
    note: 'the sync route does not write enrollProSchoolYearMirror, so syncStatus is expected unchanged',
  },
  deltas: { pre, post }, health: { status: health.status, post: healthPost.status },
});
await db.$disconnect();
````

Invocation (single command, workdir `D:\ATLAS-runtime-supervised-54dce67b-20260914`):

```
node "%TEMP%\opencode\sync-section-enrolment-c01\run.mjs"
```

## 4. Acceptance matrix (R3)

Classes: `MANDATORY_SOURCE` = 2, `MANDATORY_LIVE` = 10, `DEFERRED_EXTERNAL` = 1 (plan total 13).
Tally form for every class: **`passed/total, blocked, unperformed`**.

### MANDATORY_SOURCE

| # | Requirement | Observable pass condition | Failing-first control |
|---|---|---|---|
| S1 | Fresh independent pre-action review of this packet | Committed review artifact returning `ACCEPT_READY` with `MANDATORY_SOURCE 2/2, blocked 0, unperformed 0`, and a `node --check`-clean harness that constructs `PrismaClient` without throwing | The review must show the harness head actually constructs the client from `…\atlas-server\node_modules\.prisma\client\`; R1 failed exactly here |
| S2 | Production path reproduced from the deployed release | Route mounted, auth chain, service upsert/delete scope, adapter pagination + snapshot upsert, `SECTION_SOURCE_MODE=enrollpro` | The delete path (`section.service.ts:283-289`) is the adversarial control: any upstream truncation removes rows, so `count`/`skipped`/`removed` are gated in L1 |

### MANDATORY_LIVE (10)

L1–L10 as computed by the harness in §3. Every row has a predicate that can be **false**; no row is
hard-coded true. L1's `removed: 0` and `skipped: 0` are blocking conditions, not notes.

L3 compares `[externalId, name, maxCapacity]` pre/post, so a legitimate upstream rename or capacity
change since the mirror's last sync (`2026-09-10`) makes L3 false and reports `ACCEPTANCE_FAIL` for
an otherwise correct action. That is fail-safe (it can never false-pass); the test's own probe
already shows identical identity, so this is a documented false-alarm path, not an expected outcome.

### DEFERRED_EXTERNAL

| # | Requirement | Why deferred | Owner and unlock condition |
|---|---|---|---|
| D1 | "Exactly one `SECTION_SYNC_COMPLETED` notification" (original row 6) | `publishNotificationEvent` (`notification-events.service.ts:76-101`) appends to an **in-memory buffer + SSE fan-out only**; there is no Prisma model, so no database delta exists and the event cannot be observed post-hoc. The SSE route requires an authenticated actor school (`notification.router.ts:42-46` + `:143-151`); the system-token principal is `{userId: 0, role: 'SYSTEM_ADMIN'}` with no `schoolId` (`authenticate.ts:136-141`), so observing it would require a browser login this packet does not authorize. | Next primary planner. Unlock condition: a separate packet authorizing one privileged browser login and binding a pre-POST SSE subscription. Not blocking this cycle. |

The 200 response with `count: 20` entails exactly one `publishNotificationEvent` call, because the
call sits between the sync resolution and `res.json` in a single handler
(`section.router.ts:139-156`) and the packet authorizes exactly one POST with no retry. This is
recorded as a disclosed entailment, **not** as a passed gate.

## 5. Preflight (inside the §3 harness; any divergence is a STOP)

1. `registry.revision` re-read from `origin/main` before each transition.
2. y9 baseline: 20 rows, **0** with `enrolledCount > 0`.
3. Upstream: `GET {ENROLLPRO_API}/integration/v1/sections` → 200 with 20 rows and all counted, single page.
4. Exactly one active, non-archived `EnrollProSchoolYearMirror` for school 1 with `enrollProSchoolYearId` 9.
5. Full pre-state signature captured: y9 mirror rows (incl. per-row `id`, `externalId`, `name`,
   `maxCapacity`, `enrolledCount`, `lastSyncedAt`, `preferredRoomId`, `homeRoomId`, `buildingZoneId`,
   `isStale`), the y8 hash, the out-of-scope `section_mirrors` hash, `section_snapshots`,
   `enrollpro_school_year_mirrors`, and the protected-domain counts + `audit_logs`.
6. `/api/v1/health/ready` reports `database: ok`.

## 6. Rollback

- The sync is idempotent over the same read-only upstream, so a **re-run** of the same single POST
  restores the reconciled state whenever the upstream row set is unchanged.
- A re-run is an *idempotent refresh*, **not** a restore for rows the route hard-deleted. If
  `removed != 0`, the exact prior values for the deleted rows are recoverable only from the
  pre-state y9 signature captured in §5.5 and committed as evidence.
- **Do NOT hand-edit `section_mirrors`.** Any restore is an application-path write under a separate
  reviewed packet.

## 7. Boundaries

One POST, one school (1), one year (9). Read-only ATLAS HTTP access is limited to `/api/v1/health`
and `/api/v1/health/ready`. No other ATLAS endpoint. Read-only database access is limited to
`findMany`/`count` on the tables named in §3. EnrollPro is **READ_ONLY**. The harness performs exactly
one preflight GET; the authorized POST itself then causes exactly two further upstream reads
(`section-adapter.ts:577` and `fetchEnrollProActiveSchoolYear` at `section.router.ts:137`). All three
are read-only. No rollover, term-cache apply, Teaching Load write, generation,
publication, migration, deployment or restart, task/environment change, or companion action. No
browser login.

## 8. Return contract

Pre-state signature table; the exact request (token redacted) and the response body; the acceptance
table with the y9 count total; the resulting mirror `syncStatus` (pre → post, disclosed as
non-gating); the full delta table; rollback statement; approval status; register state; push status;
worktree disposition; single next action; and the D1 deferral restated.

## 9. Registration annex (R3)

Registered via `ops/workflow/transition.mjs` from `origin/main` (CAS on `registry.revision`); the
stream row is `SYNC-SECTION-ENROLMENT-C01`, `PLANNED`, `HIGH`, register revision 260, and the
registration commit `9170126e` is pushed (`origin/main` contained it at `4deb9d9c`).

**Register contention (disclosed).** While this cycle was mid-flight, a concurrent planner cycle
(`SLOT-BREAK-AUTHORITY-C11R`) took the document: register revisions 262/263 added that stream as
`RUNNING` and moved `coordination` to `CYCLE_ACTIVE / SLOT-BREAK-AUTHORITY-C11R`, superseding this
cycle's activation line at revision 261. The `SYNC-SECTION-ENROLMENT-C01` stream row itself is
intact. Because the register has a single coordination slot, **this cycle performs no further
register writes until the C11R transition and the `WF-C10-TRANSITION-GUARD-HARDENING` recovery both
settle**; the R2 packet and its correction commit are therefore held unpushed on the cycle branch.
The superseded activation and the deferred register write are recorded as a continuity state, not
worked around by hand-editing state.

**Transition-surface gap (under-report, disclosed).** There is no `record-approval` or
`record-execution` transition on the current `origin/main`; those belong to WF-C10. Therefore
`approval.granted`, `approval.presentedReady`, and `approval.execution` remain `false`/`null` in the
machine record while the operator's grant is recorded in **committed evidence**
(`docs/reviews/sync-section-enrolment-c01/`). The structural rules still apply and are enforced by
the verifier: `HIGH_EXECUTION_WITHOUT_APPROVAL` and `HIGH_BOUNDARY_EXCEEDED` fire if
`approval.execution.performed` is ever set without a complete granted approval. Closure uses the
available transitions: `record-executor-return` → `record-qa-result` (`ACCEPT_READY`) →
`record-integration` → `record-audit` (`AUDIT_CLEAR`) → `close-cycle` (receipt) →
`record-remote-observation`.

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-09-17 | planner | Initial packet + stream spec authored (base `dd4f8552`) |
| 2026-09-17 | primary planner | **R1**: raised the risk tier to HIGH per the `AGENTS.md` non-downgradable live-data floor; pinned the verified live runtime identity (`54dce67b`, supervisor 4020 / server 13244 / host 13260); named the exact reviewed single-process execution harness and its read-only DB/env boundaries; reclassified the notification row as `DEFERRED_EXTERNAL`; corrected the audit row to an observable `audit_logs delta = 0`; added `skipped: 0` / `removed: 0` as blocking conditions for the documented hard-delete path; added the single-fetch uniformity row; documented the WF-C10 transition-surface under-report. Candidate `4deb9d9c`. |
| 2026-09-17 | primary planner | **R2** (candidate `3ceab907`), after the first fresh pre-action review returned `CORRECTION_REQUIRED` (MANDATORY_SOURCE 1/2, blocked 1). Fixes: **B1** the harness loaded the release-root Prisma stub, which throws at `new PrismaClient()`; it now loads the generated client from `…\atlas-server\node_modules\.prisma\client\`. **B2** L10 was a hard-coded `true`; it is now a real write-scope-isolation predicate (every `section_mirrors` row outside school 1 / year 9 byte-identical), with the `enrollProSchoolYearMirror.syncStatus` pre→post reported as an explicit non-gating disclosure because this route cannot change it. **B3** L5's "checksum changed" was unsound (the checksum is a pure function of the payload, so it is unchanged when upstream is unchanged) and would have thrown on an absent snapshot; L5 now asserts snapshot `fetchedAt` strictly after a harness-captured pre-POST clock, guarded for absence, and L6 reuses that guarded result. **N1** network reads now use a `getJson` helper that catches on `fetch` itself. **N3** §6 distinguishes an idempotent re-run from a restore of hard-deleted rows. **N4** §0 states the review base `19d4dbba` and R2 base `4deb9d9c`. **N5** the tally form is `passed/total, blocked, unperformed`. Plus the register-contention disclosure in §9. Docs-only; no product, test, or harness file. |
| 2026-09-17 | primary planner | **R3** (this revision), after a second fresh pre-action review returned `CORRECTION_REQUIRED` while confirming both mandatory classes (`MANDATORY_SOURCE 2/2, blocked 0, unperformed 0`) and verifying B1/B2/B3 fixed with `node --check` exit 0 and an independently reproduced failing-first control. Fixes: **F1** §2.1 wrongly asserted that the hard delete "is conditioned on a non-empty `externalIds` set"; the production `deleteMany` (`section.service.ts:283-289`) has no such guard and an empty `notIn` matches all 20 in-scope rows, so §2.1 now states the true semantics and attributes the protection to the preflight + L1, with the pre-state y9 signature as the only recovery source. **N-a** §0 names the R2 SHA `3ceab907` and states that the R3 tip is carried by the dispatch handoff. **N-c** §7 now states that the POST itself causes two further read-only upstream GETs. **N-d** §4 documents L3's fail-safe false-alarm path. Packet prose only: harness bytes, acceptance predicates, scope, rollback, and the D1 deferral are unchanged from R2. |
