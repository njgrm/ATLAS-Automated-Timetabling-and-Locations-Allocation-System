# NOTIFICATION-INBOX-C01 — implementation packet (Lane A)

**Status:** `READY`. **Risk:** MEDIUM source (new Prisma model + migration source, new server routes, new
client surface). **Owner:** Lane A (primary planner).
**Spec:** `docs/prompts/notification-inbox-c01-2026-09-22.md` (the operator-facing gap statement). This
packet pins the contract; where they differ, **this packet governs**.

**Executor worktree (already provisioned by the planner — do not create another):**
`E:\ATLAS-worktrees\notification-inbox-c01`, branch `work/notification-inbox-c01`, base
`origin/main` = `72348902b015abdaa42c327a64b9ed4882d41a11`, clean.
`atlas-client` and `atlas-server` dependencies are installed; `prisma generate` was run against the
repo-root schema from `atlas-server`.

**Disposition:** `KEEP_ACTIVE` until the review completes.

---

## 0. Why — the measured gap

ATLAS has a live event stream and **no persistence**. `publishNotificationEvent`
(`atlas-server/src/services/notification-events.service.ts`) buffers events in memory (500 max) and
fans them to SSE subscribers; `atlas-client/src/hooks/useNotificationStream.ts` consumes them. A
notification raised while nobody is looking is **lost** — there is no unread count, no history, no
acknowledgement. `information_schema` finds no `%notif%` table.

The reference is **AIMS**, not SMART — READ_ONLY at `D:\AIMS` @ `2332d92e`:
`server/prisma/schema.prisma` → `model Notification`; `server/src/controllers/notification.controller.ts`
(`getNotifications`, `getUnreadCount`, `markRead`, `markAllRead`, `markViewed`);
`server/src/routes/notification.routes.ts`; `client/src/hooks/use-notifications.ts`;
`client/src/components/layout/NotificationBell.tsx`; `client/src/services/notification.api.ts`.
**Mirror the pattern, not the domain fields.** AIMS is READ_ONLY — read it, never edit, copy or
import from it.

## 1. Deliverables

### D1 — the persisted model

Add to the **repo-root** `prisma/schema.prisma` (this is the schema the client is generated from) a
model named `Notification`, mapped to table `notifications`:

| column | Prisma | SQL | notes |
| --- | --- | --- | --- |
| `id` | `Int @id @default(autoincrement())` | `SERIAL` | |
| `actorId` | `Int @map("actor_id")` | `INTEGER NOT NULL` | **the recipient** — `AtlasAuthAccount.id` |
| `schoolId` | `Int @map("school_id")` | `INTEGER NOT NULL` | |
| `schoolYearId` | `Int? @map("school_year_id")` | `INTEGER` | |
| `type` | `String @db.VarChar(64)` | `VARCHAR(64)` | the source event type, verbatim |
| `title` | `String @db.VarChar(200)` | `VARCHAR(200)` | |
| `body` | `String?` | `TEXT` | |
| `domain` | `String @db.VarChar(32)` | `VARCHAR(32)` | `NotificationDomain` |
| `severity` | `String @db.VarChar(16)` | `VARCHAR(16)` | `NotificationSeverity` |
| `resourceType` | `String? @map("resource_type") @db.VarChar(48)` | `VARCHAR(48)` | optional pointer to the thing it is about |
| `resourceId` | `String? @map("resource_id") @db.VarChar(64)` | `VARCHAR(64)` | |
| `data` | `Json?` | `JSONB` | |
| `dedupeKey` | `String @unique @map("dedupe_key") @db.VarChar(255)` | `VARCHAR(255) NOT NULL` | see D1b |
| `read` | `Boolean @default(false)` | `BOOLEAN NOT NULL DEFAULT false` | |
| `createdAt` | `DateTime @default(now()) @map("created_at")` | `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` | |

Relations: `actor AtlasAuthAccount @relation(fields: [actorId], references: [id], onDelete: Cascade)`
and `school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)`; add the
back-relations on `AtlasAuthAccount` and `School`. Indexes: `@@index([actorId, read, createdAt])` and
`@@index([actorId, createdAt])`. `@@map("notifications")`.

**D1b — the dedupe key is content-stable, not event-identity-stable.** A repeated sync tick must
collapse to one row. Compute it deterministically in one exported helper, in this exact shape:

```
dedupeKey = [schoolId, schoolYearId ?? 0, type, resourceType ?? '-', resourceId ?? '-', actorId].join(':')
```

Persist with a dedupe-on-conflict path (`createMany({ data, skipDuplicates: true })` or
`upsert` on `dedupeKey`) so re-raising the same delta writes **zero** new rows. Do not include the
in-memory `NotificationEvent.id` or a timestamp in the key.

### D1c — migration source, authored but NOT applied

Add `prisma/migrations/0004_notification_inbox/migration.sql` in the same style as
`prisma/migrations/0002_companion_sso_code/migration.sql` (`-- CreateTable` / `-- CreateIndex` /
`-- AddForeignKey`, quoted snake_case identifiers). **Do not run `prisma migrate dev`, `db push`, or
`migrate reset`.** Do not touch `migration_lock.toml`. The apply is a separate HIGH action
(`NOTIFICATION-INBOX-LIVE`) and is explicitly **not** part of this packet.

`test:server-db` builds its per-file template with `prisma migrate deploy`, so the new table will
exist in every disposable test database automatically — that is how D3/D4 are exercised.

### D2 — the API

New file `atlas-server/src/routes/notification-inbox.router.ts`, mounted at
`/api/v1/notification-inbox` in `atlas-server/src/app.ts`. **Do not add routes to
`notification.router.ts`** — that router owns the SSE paths and must keep its behaviour unchanged.

| method + path | returns |
| --- | --- |
| `GET /` | `{ items: Notification[], nextCursor: string \| null }` — newest first, `?limit=` default 20 / max 50, `?cursor=` keyset on `(createdAt, id)` |
| `GET /unread-count` | `{ count: number }` |
| `POST /:id/read` | `{ ok: true }` — idempotent; `404 NOTIFICATION_NOT_FOUND` when the id is not the actor's |
| `POST /read-all` | `{ marked: number }` |

**Authority — fail closed, no client-supplied identity.** Resolve the actor and the actor school
**only** from the authenticated token (reuse the existing `authenticate` middleware and the same
actor-school resolution the other actor-scoped routers use; `hasPrivilegedRole` lives in
`atlas-server/src/middleware/authorize.ts` — import it, never re-declare the role set). If the actor
or the actor school cannot be resolved, return a typed **403** (`NOTIFICATION_ACTOR_UNRESOLVED`) and
write nothing. **Never** accept `actorId` or `schoolId` from the body or the query string. Every
read and every write is constrained by `actorId = <resolved actor>`, so another actor's or another
school's row is never readable and never mutable.

### D3 — the first real producer (persist what the stream already carries)

New file `atlas-server/src/services/notification-inbox.service.ts` exporting:

- `resolveNotificationRecipients(event): Promise<number[]>` — the recipient actor ids:
  - `audience === 'FACULTY'` and `facultyId` set → active `AtlasAuthAccount` rows with that
    `schoolId` and `facultyId`;
  - `audience === 'FACULTY'` with `facultyIds[]` → the same, for each id;
  - `audience === 'PRIVILEGED'` → active `AtlasAuthAccount` rows in that school whose `role` passes
    `hasPrivilegedRole`;
  - `audience === 'ALL'` → every active `AtlasAuthAccount` row in that school.
  - **Hard cap 200 recipients.** Above the cap, persist nothing for that event and record a typed
    skip (log, no throw) — a single event must never be able to write an unbounded fan-out.
  - Never return an actor whose `schoolId` differs from `event.schoolId`.
- `persistNotificationEvent(event): Promise<{ inserted: number; skipped: boolean }>` — resolves
  recipients, builds one row per recipient via the D1b key, dedupes, inserts. Maps `resourceType` /
  `resourceId` / `title` from the event's `domain`, `type`, `message` and `metadata` (pick one
  documented mapping; e.g. `resourceType` from the domain, `resourceId` from the metadata's
  `runId`/`requestId`/`preferenceId` when present, `title` = the message). Keep it total and
  documented — no `any`, no silent field loss.
- A durable listener hook in `notification-events.service.ts`
  (`registerDurableNotificationListener(listener)`), invoked by `publishNotificationEvent` **after**
  the buffer push, fire-and-forget, with errors logged and swallowed — mirroring the RR-08 rule that
  a dead subscriber must never break the publish path. `publishNotificationEvent`'s signature and
  return type stay **unchanged**. `initializeNotificationEventBridges()` registers
  `persistNotificationEvent` as the durable listener.

`REFERENCE-SYNC-AND-TL-RECONCILIATION-C01` will plug into this same publisher when it exists; do not
build that stream here, and do not invent a fake producer.

### D4 — the bell

- `atlas-client/src/hooks/useNotificationInbox.ts` — list + unread count through the existing API
  client, bound to the authenticated token epoch and actor school the way the other actor-scoped
  client hooks are (no school-1 default; late responses from an obsolete epoch are discarded).
- `atlas-client/src/components/app-shell/NotificationBell.tsx` — a `@/ui` `Popover` trigger carrying
  the unread count, whose panel lists the persisted notifications newest-first, marks an item read on
  open, and routes to its resource via `resourceType`/`resourceId` when both are present (otherwise
  it is inert — never a dead link that pretends to navigate). A "Mark all read" action. **`@/ui`
  primitives only** — no raw unstyled `<button>`, no `title` attribute, no raw `<details>`.
- Mount it in `atlas-client/src/components/AppShell.tsx`.
- **The panel must not create a global scrollbar:** the list scrolls inside its own
  `max-h` + `overflow-auto` region; the no-scroll architecture
  (`flex flex-col h-[calc(100svh-3.5rem)]`) holds and
  `documentElement.scrollHeight === clientHeight` at 1366×768.
- Component files stay under the **1000 physical line** cap.
- **D5 — the stream keeps its job.** `useNotificationStream` stays exactly as it is for live in-page
  updates; on a new stream event the inbox query should simply be invalidated/refreshed so the bell
  updates live. Do not replace the stream with polling and do not delete the stream.

## 2. Boundaries — do not break

- **No live-data mutation.** No migration apply, no `db push`, no `migrate reset`, no `migrate dev`
  against the live database, no seed, no generation, no publication, no deployment, no runtime or
  supervisor action. `NOTIFICATION-INBOX-C01` is source-only; the apply and the deploy are separate
  HIGH actions.
- **No `docs/**` and no `CHANGELOG.md` edits.** No companion-repo edits (AIMS is READ_ONLY).
- Do not touch `atlas-server/src/routes/notification.router.ts`'s SSE behaviour, the actor-school
  middleware, the strict publication predicate, or ordered-term identity.
- No `docs/**`; no `.opencode/**`; no `ops/**`; no root `package.json` change other than what §3
  requires.
- The bell is actor-scoped end to end: a notification is **never** readable by another actor or school.

## 3. Test gates — run these and paste literal results

Run from `E:\ATLAS-worktrees\notification-inbox-c01`.

1. `atlas-server`: `npx prisma generate --schema ../prisma/schema.prisma` (must exit 0).
2. `atlas-server`: `npm run test:server-suite` (must be green; record the tally).
3. `atlas-server`: **add your new DB test file to the `test:server-db` script list**, then run the
   whole script: `npm run test:server-db` (record the tally and exit code).
4. `atlas-server`: `npm run build` (must exit 0; **Node must be able to start the built server** —
   prove the built entry loads, e.g. `node -e "import('./dist/app.js')"` or the established
   built-server smoke the repo already uses).
5. `atlas-client`: `npm run test:client-suite` (must be green; record the tally).
6. `atlas-client`: `npm run build` with `VITE_ENROLLPRO_URL` exported (the fail-closed guard exits 1
   without it).
7. `git diff --check` clean.

**Test files you must add, and they must be gated:**
- `atlas-server/src/__tests__/notification-inbox.test.ts` — hermetic. Dedupe-key determinism and
  content-stability (the same delta twice ⇒ the same key; a different resource ⇒ a different key);
  recipient resolution for each of the four audiences, including the cap refusal and the
  actor-school exclusion; the resolver never returns a foreign-school actor.
- `atlas-server/src/__tests__/notification-inbox-postgres.test.ts` — **add it to `test:server-db`.**
  Mounted disposable-PostgreSQL: acceptance tests 1–5 from the spec —
  (1) a notification created while the actor is not on the page is present after a fresh list read,
  with the correct unread count; (2) mark-one decrements and mark-all zeroes; (3) a notification is
  not visible to a different actor **or** a different school; (4) the same delta raised twice produces
  **one** row; (5) the item carries `resourceType`/`resourceId` for the client route.
  **Zero residue**: the suite must prove it left no rows behind and must not leak its database.
- `atlas-client/src/__tests__/notification-inbox.test.ts` — add a committed
  `test:notification-inbox` script to `atlas-client/package.json` and name the file there. Cover the
  unread-count badge, mark-read / mark-all, the resource routing target, and the no-global-scrollbar
  structural contract.

Both manifests are covered by the **inverse reachability guards**
(`atlas-client/src/lib/__tests__/gate-reachability.test.ts`,
`atlas-server/src/__tests__/gate-reachability.test.ts`), so a new test file that no script names will
fail the suite. That is the intended enforcement — do not disable it.

**Disposable database.** `test:server-db` refuses to run unless `DATABASE_URL` names a disposable
`atlas_restore_drill_<yyyymmdd>_<suffix>` database (it protects
`atlas_recovery_clean_rebuild_20260905` and fails closed otherwise). Derive it from the runtime env
file `D:\ATLAS-runtime-config\atlas-server.env` (read-only readable) by replacing **only** the
database name with `atlas_restore_drill_20260923_notifinbox` — **never print that file or the URL**.

**Fixtures come from the real surface.** Build test fixtures from the real `NotificationEvent`
shape and the real AIMS-inspired column set — do not invent a fixture that already contains the
expected text. Record the exact commands and literal results.

## 4. Evidence to return (one page, `REVIEW_REQUIRED`)

Base SHA · candidate SHA · exact changed paths · what changed per deliverable D1–D5 · the literal
command and result for every gate in §3, including the failing-first control for at least one
authority claim (the actor-scope rejection or the dedupe collapse) · known risks each marked
`BLOCKING` or `NON_BLOCKING` · verdict `REVIEW_REQUIRED`.

Do not amend or rebase after handing off. A correction is a new commit on the same branch.
