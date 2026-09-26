# EnrollPro developer handoff -- ATLAS `ATLAS_SYSTEM_TOKEN` rotation and faculty-sync trigger

**From:** ATLAS (Buru Degree / ATLAS Automated Timetabling) -- read-only from our side of your repo
**Date:** 2026-09-26
**No secret value appears in this document.** The new value is transmitted out of band, separately.

---

## 0. The one thing to read first

**Our documentation had your endpoint path wrong.** Both our `CHANGELOG.md` (2026-09-02, RR-10) and our
`docs/reference/atlas-runtime-source-of-truth-map.md` state that you call
`POST /api/v1/integration/atlas/sync-faculty`.

**That path has never existed in the ATLAS server.** `git log --all -S "sync-faculty" -- atlas-server` returns
nothing, and no integration router is mounted in `atlas-server/src/app.ts`. If you implemented against our
documented path, that call has been returning 404.

The endpoint that actually exists and actually accepts your credential is:

    POST /api/v1/faculty/sync

Evidence: `atlas-server/src/routes/faculty.router.ts:249-252`

    // Auth: POST /faculty/sync -- trigger sync from external source
    router.post('/sync', authenticateWithSystemToken, async (req, res, next) => {
        await handleFacultySync(req, res, next);
    });

mounted at `atlas-server/src/app.ts` under `/api/v1/faculty`. Note it is guarded by
`authenticateWithSystemToken` **only** -- it does not additionally require a privileged role.

Please confirm which path you are actually calling. If it is `/api/v1/faculty/sync`, item 2 below is a
configuration-only change. If you built a caller against the documented path, that is a bug on one side or the
other, and we would like to fix the documentation either way.

---

## 1. Why we are contacting you

The ATLAS shared secret `ATLAS_SYSTEM_TOKEN` was committed in plaintext in our public GitHub repository in a
changelog entry dated 2026-09-02, and remained there until 2026-09-26. **Treat the current value as compromised.**
We have removed it from the repository's current tree; we have deliberately not rewritten history.

We are rotating it. Because ATLAS *verifies* this value and your service *presents* it, we cannot rotate our copy
without your side changing too, so this needs a coordinated window. This is a security-rotation request, not a
feature request. **No code change is required on your side** -- only the value of one environment variable.

## 2. What we are asking for

**Item 2 -- the credential swap (needs a window, see section 4).**

Your `ATLAS_API_KEY` must equal ATLAS's `ATLAS_SYSTEM_TOKEN`, presented on every call as either:

    Authorization: Bearer <ATLAS_API_KEY>
    X-Integration-Key: <ATLAS_API_KEY>

Both are accepted (`atlas-server/src/middleware/authenticate.ts:127-136`). The comparison is a single
constant-time equality check against one configured value; **there is no grace window and no second accepted
value.**

We will send the new value out of band. Please:

1. Confirm you can make the change at a specific agreed time.
2. Acknowledge receipt of the new value by sending back a **read-back** -- the last 4 characters are enough.
   (The original mismatch happened because a value was abbreviated with an ellipsis in a message, so we now
   require an explicit read-back rather than assuming receipt.)
3. Do not paste the value into a ticket, chat log, or commit. Put it in your secret store / env only.

**Item 3 -- your local clone's database access (independent, no window needed).**

Your local `server/.env` connects to `postgresql://atlas_user@localhost:5432/enrollpro`. That is the **ATLAS**
database role. We rotated `atlas_user`'s password on 2026-09-26, and all `pg_hba.conf` rules are
`scram-sha-256`, so that connection will now fail to authenticate.

We recommend you stop using `atlas_user` for your own local EnrollPro database. Use a separate local role that
you own. That is least-privilege, and it decouples your local development from our credential rotations -- you
should not have to take an outage because we rotated ours. If you would rather we simply provision you a fresh
local role, say so and we will do it.

## 3. What we are NOT asking for

- No change to your repository from us. We treat EnrollPro as read-only (`AGENTS.md` section 4).
- No new endpoints, no schema changes, no code changes on your side.
- Nothing before the window. **We will not rotate until you confirm**, so nothing breaks for you in the meantime.

## 4. The window -- ordering that cannot fail

`isSystemTokenMatch` (`atlas-server/src/middleware/authenticate.ts:75-86`) compares the presented value against
exactly **one** configured value. There is no dual-accept and no previous-token path. Therefore **whichever side
changes first, the trigger fails until the second side changes.** This is why a coordinated window is required
rather than a silent change on our side.

Sequence (the failure mode is always visible and always recoverable):

| # | Who | Action | State of the trigger |
|---|---|---|---|
| 1 | EnrollPro | Receive new value, **do not apply yet** | working (old value) |
| 2 | ATLAS | Set new value, restart, verify health | **401 until step 3** |
| 3 | EnrollPro | Apply new value, restart if needed | working |
| 4 | EnrollPro | Re-run the faculty sync | working |
| 5 | both | Verify per section 5 | working |

**Rollback is symmetric and must be agreed before step 2:** restore the previous value on both sides and restart
on both sides. Keep the previous value retrievable for the duration of the window. If either side cannot complete
within the agreed window, roll back rather than leave the halves split -- a half-rotated credential is worse than
either consistent state.

**Budget:** step 2 takes a supervisor restart, which is a few seconds of unavailability on our side. Step 4 is
the only step that needs a human on your side.

## 5. Acceptance tests

Please run these after step 4 and send us the results. Do not treat a 401-only check as sufficient -- a successful
authentication proves nothing about whether the sync worked.

1. **Credential accepted.** The call returns **not** 401 and not `INVALID_SYSTEM_TOKEN`.
2. **Sync actually ran.** The response reports a real result -- active faculty processed and skipped counts are
   both present and plausible for your roster. (Our 2026-09-02 note recorded a real EnrollPro reconcile of 27
   active faculty, 0 skipped; your current numbers are yours to confirm, not ours to assume.)
3. **Old value rejected.** Replaying the previous value returns `401`. This is how we confirm the rotation
   actually took effect rather than both values being live.
4. **No collateral damage.** ATLAS `GET /api/v1/health` and `GET /api/v1/health/ready` both 200 with
   `database: "ok"`, and a database-backed read (e.g. `GET /api/v1/subjects?schoolId=<id>`) returns 200.
5. **Downstream agrees.** Faculty mirrors in ATLAS show the expected roster for the active year.

If any of these fail, roll back per section 4 and tell us which one and with what output.

## 6. Security notes

- The previous value is burned. It was public for 24 days in a public repository. Please do not reuse it anywhere,
  and remove it from any place you have cached it.
- Please do not include either value in a commit, ticket, screenshot, or log.
- Our guard for committed credentials does not currently detect a bare high-entropy secret embedded in prose; we
  have recorded that as a known gap on our side and are closing it. If you spot a credential pasted into
  documentation on either side, please tell us rather than editing our repository.

## 7. Evidence appendix

| Fact | Where |
|---|---|
| Token comparison, single value, no grace path | `atlas-server/src/middleware/authenticate.ts:70-86` |
| Accepted headers (`Authorization: Bearer`, `X-Integration-Key`) | `atlas-server/src/middleware/authenticate.ts:127-136` |
| Inbound sync endpoint | `atlas-server/src/routes/faculty.router.ts:249-252` |
| Router mount | `atlas-server/src/app.ts:120` -- `app.use('/api/v1/faculty', facultyRouter)`; 38 routers mounted, none for an integration path |
| `schoolId` required; `schoolYearId` optional | `atlas-server/src/routes/faculty.router.ts:146-170` |
| `prune` mode requires `confirmPrune: true` | `atlas-server/src/routes/faculty.router.ts:152-159` |
| Public exposure window | `CHANGELOG.md` 2026-09-02 entry (scrubbed at `8a0686cb`, 2026-09-26) |
| Repository revision at time of writing | `0e691a33` |

**Contact:** ATLAS planner, Lane A. If anything above is wrong about your deployment, say so -- we would rather
correct this document than have you configure against it.