# NOTIFICATION-INBOX-C01 — a persisted notification bell, so a delta is never lost

**Status:** `PREPARED`. **Risk:** MEDIUM (new table + client surface; no live-data mutation).
**Owner:** Lane A.

## 0. The gap — measured, not assumed

The operator: *"We still don't have a working notification bell that can persist a notification bar like
AIMS and SMART does. We really need for things like this."*

**ATLAS has a live event stream and no persistence:**

| | ATLAS today |
| --- | --- |
| `atlas-server/src/routes/notification.router.ts` | only **two SSE endpoints** — `/:schoolId/events`, `/:schoolId/:schoolYearId/events` |
| notification table | **none** — `information_schema` finds no `%notif%` table |
| client | `atlas-client/src/hooks/useNotificationStream.ts` (a stream consumer) |
| bell / unread state / history | **none** |

So a notification is delivered only if someone is looking at the right page at the right moment. There is
no unread count, no history, no acknowledgement — which is exactly why the reference-sync reconciliation
(`REFERENCE-SYNC-AND-TL-RECONCILIATION-C01` D4/D6) has nowhere to land.

**The reference is AIMS, not SMART.** Inspected read-only at its recorded pin (`D:\AIMS` @ `2332d92e`):
SMART's mirror has **no** notification model or bell; AIMS has the whole pattern —

- `server/prisma/schema.prisma` → `model Notification`: `id`, `schoolId`, `userId`, `type`, `title`,
  `body?`, `resourceId?`, `data Json?`, **`read Boolean @default(false)`**, `createdAt`.
- `server/src/controllers/notification.controller.ts` → `getNotifications`, **`getUnreadCount`**,
  `markRead`, `markAllRead`, `markViewed`.
- `client/src/components/layout/NotificationBell.tsx`, `client/src/hooks/use-notifications.ts`,
  `client/src/services/notification.api.ts`.

That is a **persisted inbox with unread state** — the thing ATLAS lacks.

## 1. Deliverables

**D1 — a persisted notification model**, mirroring AIMS's shape but **ATLAS-scoped**: per **actor**
(not a global inbox), carrying `schoolId`, `schoolYearId` where relevant, `type`, `title`, `body`,
`data Json?`, `read`, `createdAt`, plus an optional `resourceType`/`resourceId` so a notification can
point at the thing it is about (a Teaching Load row, a run, a section). **Deduplicate by a stable key**
so the same delta does not produce two rows.

**D2 — the API.** `GET` list (paged, newest first), `GET` unread count, `POST` mark-read,
`POST` mark-all-read — actor-scoped and fail-closed on an unverifiable actor school, consistent with the
existing actor-scope rules.

**D3 — the bell.** A bell in `AppShell` showing the unread count, opening a panel with the persisted
list; opening an item marks it read and routes to its resource. `@/ui` primitives only (`Popover`), no
raw `<button>`, no `title`. It must not introduce a global scrollbar — the no-scroll architecture holds.

**D4 — the first producer.** Wire the reference-sync reconciliation delta
(`REFERENCE-SYNC-AND-TL-RECONCILIATION-C01`) as the first real producer, so the bell has genuine
content rather than a demo.

**D5 — the stream keeps its job.** The existing SSE stream stays for live in-page updates; the inbox is
the durable record. Do not replace one with the other — the stream is transient, the inbox persists.

## 2. Boundaries — do not break

- Actor-scoped: a notification is never readable by another actor or school. Fail closed on an
  unverifiable actor.
- No `docs/**`, `CHANGELOG.md`, or companion repo edits (AIMS is READ_ONLY reference only).
- No live-data mutation, generation, publication or deployment is unlocked by this packet.
- Keep the table small and honest: no notification without a real trigger, and dedupe so repeated sync
  ticks do not flood it.

## 3. Acceptance tests

1. A notification created while the user is **not** on the page is present after a reload, with the
   correct unread count.
2. Marking one read decrements the count; mark-all zeroes it.
3. A notification is **not** visible to a different actor or school.
4. The same delta raised twice produces **one** notification (dedupe).
5. Opening a notification routes to its resource.
6. The bell introduces no global scrollbar at 1366×768 and uses `@/ui` primitives only.

## 4. Ordering

`REFERENCE-SYNC-AND-TL-RECONCILIATION-C01` computes the delta; this packet gives it somewhere durable to
land. They can be built in either order, but **the reconciliation is not complete without this** — a
delta nobody sees is the same as no delta.
