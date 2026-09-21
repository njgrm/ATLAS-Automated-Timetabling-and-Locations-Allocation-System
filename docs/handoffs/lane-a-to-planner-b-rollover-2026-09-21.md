# Lane A → Planner B — `ROLLOVER-YEAR-IDENTITY-C01`: the crux decision, answered with evidence

2026-09-21. Read this before your pre-action review closes. Everything here is read-only source
analysis at `origin/main` plus one read-only live probe; Lane A touched no code.

## 1. The decision you are weighing — answered: **yes, the year can be proven before the mutation**

**Your correction should be the strong form** (prevent the side effect), not only the follow-on
suppression — because a read-only year resolver already exists and is already wired to a sibling
route.

Evidence:

1. **`previewRolloverSync(schoolId, authToken)` is a read-only resolver.** It is
   `getRolloverStatus(schoolId, authToken, { includeCounts: true })`
   (`atlas-server/src/services/enrollpro-rollover.service.ts:1087`), and its body contains **no**
   `.create(`, `.update(`, `.updateMany(`, `.delete(`, `.upsert(`, `$transaction` or `getOrCreate`
   call. The sibling route `POST /rollover-sync/preview` (`runtime.router.ts:279`) already calls it
   and returns it. **So the year is provable without mutating.**
2. **Both dangerous sites read the year from the result of the mutation:**
   - `runtime.router.ts:288` (`/rollover-sync/apply`):
     `Number(result.enrollProActiveYear?.id ?? 1)` → then
     `publishNotificationEvent(ROLLOVER_SYNC_COMPLETED, schoolYearId)` **and**
     `getOrCreateTeachingLoadCycleSource(schoolId, schoolYearId)`.
   - `runtime.router.ts:341` (`/rollover-sync/reset-dummy-year`): a four-level chain ending `?? 1`.
   **`getOrCreateTeachingLoadCycleSource` is a get-or-create — a write.** So the fallback does not
   merely mislabel a notification: it **creates a Teaching Load cycle for year 1**.
3. **`applyRolloverSync` takes no year argument** (`enrollpro-rollover.service.ts:1505`) — it
   resolves the year itself. That is precisely why the route has nothing to fall back on but `?? 1`.

## 2. Recommended correction shape — for your packet to justify, not to assume

- **Primary defence:** resolve the year read-only **before** entering the apply — reuse the existing
  preview resolver rather than inventing a second year-resolution path — and reject with a typed
  error (e.g. `409 ACTIVE_YEAR_UNRESOLVED`) **before any mutation** when the identity is absent.
- **Residual defence, do not skip:** the upstream can change between the pre-check and the apply, so
  keep a post-apply guard. If `result.enrollProActiveYear?.id` is still absent: **do not** fabricate
  a year, **do not** publish a year-scoped notification, and **do not** call
  `getOrCreateTeachingLoadCycleSource`. Report the typed failure and skip the follow-ons.
- **Do not claim the rollover was undone.** By the time the post-apply guard can fire, the rollover
  may have partially applied — say so explicitly rather than implying a safe revert.
- **Remove `?? 1` at both sites.** A fabricated year is never the safe default for a write.

## 3. Scope

`runtime.router.ts` is yours — Lane A holds no edits there and will not take any. Agreed on leaving
`faculty.router.ts` / `section.router.ts` year fallbacks to a separate inventory.

## 4. One thing you do NOT need to work on: the public ×3 duplication is verified fixed

Live read-only probe, 2026-09-21, against `https://njgrm.buru-degree.ts.net/api/v1`:

| Request | Result |
| --- | --- |
| `/schools/1/schedules/published` (no term selector) | **200**, **920** entries, distinct `termIndex` = **[1]** |
| `?termIndex=1` | 200, 920 entries, term 1 only |
| `?termIndex=2` | 200, 920 entries, term 2 only |

The payload is always **one term's** entries — never 2,760 = 920 × 3. The route resolves a single
active-year mirror and rejects an ambiguous one with `409 ACTIVE_SCHOOL_YEAR_AMBIGUOUS`
(`atlas-server/src/routes/published-schedule.router.ts:93-130`), and `requireActiveTermSelection`
scopes the payload to one term. **The 3× term duplication is gone by construction.** Do not spend a
lane on it.

Minor observation, **not** a defect and not yours unless you want it: an **absent** term selector
defaults to term 1 while a **malformed** one is a typed `400 INVALID_TERM_INDEX`. That asymmetry is
worth a line in a successor list, nothing more.

## 5. Handover

When your candidate is accepted, hand it to Lane A: `runtime.router.ts` is server source, so it
ships only in a release, and releases are Lane A's boundary. Expect the release packet to open with
the unreviewed-delta gate (`AGENTS.md` §11) if your lane integrates its own work.
