# ROOM-SCHEDULES-TERM-C01 — live API evidence (Tailnet, deployed release `26f7c907`)

Date: 2026-09-26 (Asia/Manila) · Lane: A2 · Harness: authenticated browser session on the ATLAS Tailnet
origin · Mutating actions: **none** (read-only GETs and page reads).

## What this closes, and what it does not

Independent QA raised this as a residual it could not close:

> "if a client ever presents a *cached* verified term while the mirror is unpopulated, the Rooms request
> returns **409 `TERM_STRUCTURE_UNAVAILABLE`** and lands in the generic error branch… Verify the live cache
> before deploying this to the demo."

and as F7:

> "No committed test asserts the Rooms request actually contains `termIndex`… the headline fix's request
> shape rests on code reading only."

**This closes both.** The request shape is now measured against the live server, not inferred.

## Harness facts

| Fact | Value | How established |
| --- | --- | --- |
| Origin | `https://njgrm.buru-degree.ts.net` | asserted via `window.location.origin` |
| Session | present, **no seeding required** | `atlas_local_token` + `atlas:session-user:v1` + `userRole` in `localStorage`; authenticated shell renders with Officer/Admin |
| Release under test | `26f7c907` | the **deployed** release; the candidate is **not** deployed |
| Scope | school `1`, ATLAS `school_year_id` **`10`**, room `65` (`G10 Room 101`, one of 98 teaching spaces) | year id **verified in the database**, see the correction below |
| Mutations | none | read-only `GET` only; no generate, place, save, publish or delete |

## The measurement

Same room, same run, with and without the one term the client now sends:

| Request | HTTP | termIndexes in response | max entries in one cell | `entryCount` |
| --- | --- | --- | --- | --- |
| `?source=latest` — **what the deployed client sends today** | 200 | **[1, 2, 3]** | **3** | **6** |
| `?source=run&runId=318` — also sent today | 200 | **[1, 2, 3]** | **3** | **6** |
| `?source=run&runId=318&termIndex=1` | 200 | [1] | 1 | 2 |
| `?source=run&runId=318&termIndex=2` | 200 | [2] | 1 | 2 |
| `?source=run&runId=318&termIndex=3` | 200 | [3] | 1 | 2 |
| `?source=run&runId=318&termIndex=active` | 200 | [1] | 1 | 2 |

**This is the merge, measured on the live server.** With no `termIndex` the Rooms response carries **all
three terms** and stacks **3 entries in one cell**; with a term it carries exactly one term and one entry
per cell, and `entryCount` drops from 6 to 2. `termIndex=active` resolves to **T1**, which agrees with the
persisted mirror cache.

So the fix is not merely sound in source and unit terms: **the exact parameter the candidate now sends is
accepted by the deployed server and demonstrably collapses a three-term response to one.**

## A correction I owe the record

My first probe used **year `551`** and returned `404 RUN_NOT_FOUND` for run 318, `404 NO_RUNS` for
`source=latest`, and — the alarming part — **`409 TERM_STRUCTURE_UNAVAILABLE` for every `termIndex`**, plus
`501 TERM_FILTER_NOT_READY` for `termIndex=active`. Read at face value that says the candidate is
undeployable.

**It does not.** `551` is the **EnrollPro** school-year id (`enrollpro_school_year_mirrors.enrollpro_school_year_id`);
the route takes ATLAS's internal `school_year_id`, which is **`10`**. Verified read-only:

```
RUNS     (id | school | year | status)
  318    | 1      | 10   | COMPLETED
MIRRORS  (id | epYear | label     | active)
  551    | 10     | 2031-2032   | true
```

So every 404/409/501 above was an artifact of my own wrong identifier, produced by a scope that does not
exist. The lesson is the one this register keeps re-learning and I still walked into it: **never assert a
figure or a status you have not just derived.** Had I reported the first probe, I would have told the
operator the fix was unshippable on the strength of a typo.

## A refinement to the reported finding, stated honestly

The QA handoff reported **10 conflicts** on the Rooms page for G7 Room 103. This probe shows the Rooms
endpoint returning a three-term merge for room 65 while `conflictCount` and per-cell `conflict` both stayed
**0**. Those two facts are reconcilable, and the reconciliation matters:

- The `entries.length > 1 => conflict` rule lives in the **client** pivot
  (`src/lib/schedule-pivot.ts`), which is what the **Teachers** and **Sections** tabs use. There, a merged
  week necessarily manufactures conflicts.
- The **Rooms** tab is server-rendered and computes its own conflict flag, so a three-term response does not
  by itself imply a non-zero conflict count.

So the **merge is proven for all three tabs** (identical response shape, and the client pivot's rule is
committed source), while **conflict manufacturing is proven for the client-pivot tabs specifically**. For
room 103 the server's own rule evidently did fire; I did not reproduce that room's count and am not claiming
it. Recorded as a partial attribution, not a contradiction of the handoff.

## What is still UNPERFORMED, and why

- **Rendered-UI acceptance remains unperformed.** This is API- and response-level evidence. "The default
  opens the verified active term, switching T1/T2/T3 updates the visible grid and conflicts, and the user
  never sees an all-term merged weekly schedule" is decided by what a person sees, which requires the
  candidate to be **deployed**. Live browser evidence cannot prove undeployed source bytes
  (`AGENTS.md` §6, §12). It stays Lane C's row, and it stays a deployment-acceptance clause.
- **The Rooms tab on the deployed release was not walked** to a selected room with a conflict count; this
  cycle made no mutating interaction.
