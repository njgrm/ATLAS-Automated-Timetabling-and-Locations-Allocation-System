# D1–D3 — client-controlled constraint severity on the manual-edit write path: DECIDED

Date: 2026-09-26 (Asia/Manila) · Lane: A2 · Tier: **HIGH** (write-path authority; needs its own packet +
independent pre-action review + fresh post-action QA — this record decides *semantics*, it authorises no
change) · Supersedes: the three open questions in `docs/plans/live-state.md` and the D1–D3 wording of the
withdrawn packet R3 (`d8bf3f6d`).

Operator instruction, 2026-09-26: *"what is genuinely best and what you can recommend that won't hassle our
older scheduler users?"* — the decision is delegated to the planner with that constraint. This record
answers it.

## The one-sentence answer

**Keep every legitimate server-derived forgiveness exactly as it behaves today, and change only *who is
allowed to ask for it* and *whether the operator is told*.** Nothing that works stops working; what stops
is a client authorising its own exception, and a hard constraint being softened without a word.

## The three questions, answered in one line each

| # | Question | Answer |
| --- | --- | --- |
| Q1 | May a server-derived solver trial forgive a room-feature shortfall? | **Yes — but only server-owned, only with a recorded reason, and only if the operator is told in words.** See D2. |
| Q2 | Is the modular-pool exemption legitimate? | **Yes, the concept is sound — keep it, document it, and make it server-owned.** See D3. |
| Q3 | May the Teaching Load repair path carry client metadata at all? | **No.** It is a forwarder with no legitimate need, and it is why router-level stripping cannot work. |

D1 below is the cross-cutting decision the fix must satisfy; D2 and D3 carry Q1 and Q2.

## Verified evidence this rests on

Measured at `origin/main` `a1dcfc34`. Every claim below is a file:line, not a recollection.

**The boolean and its five writers / three readers** (`deferredRoomTypePreference`):

| Site | Role |
| --- | --- |
| `timetable-quick-place.service.ts:279` | writer — `room.type !== preferredRoomType`, stamped **before** validation |
| `timetable-quick-place.service.ts:347` | writer — `bestSlot.roomAssignmentReason === 'FALLBACK_ROOM_ASSIGNED'` |
| `timetable-teaching-load-repair.service.ts:314` | writer — `room.type !== preferredRoomType`, stamped **before** validation |
| `schedule-constructor.ts:3072` | writer — **redundant**, see D2 |
| `manual-edit.service.ts:1484` | writer — the blanket batch auto-defer, no reason recorded, no audit row |
| `constraint-validator.ts:838` | reader → `ROOM_TYPE_MISMATCH` severity |
| `constraint-validator.ts:869` | reader → **`ROOM_FEATURE_MISMATCH`** severity, i.e. a flag named for *type* forgives a *feature* |
| `manual-edit.service.ts:414` | reader → widens `allowedRoomTypes` in the candidate validator |
| `manual-edit.service.ts:692` | **the hole** — writes client `proposal.metadata` onto a new persisted entry |

**The principled mechanism already exists and is server-only.** `RoomAuthorityDeviationReason`
(`schedule-constructor.ts:1362`) is an **enumerated union** with five values, written only by the
constructor (`:2867`, `:2882`, `:2884`, `:2886`, `:2893`, `:3097`) and read at `constraint-validator.ts:827`.
One of those five values is literally `PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES`.

**The asymmetry that decides D2.** At `constraint-validator.ts:836-838` the **type** check is softened by
any *recorded reason* **or** the boolean. At `:869` the **feature** check is softened **only** by the
boolean or the modular-pool marker — so a server-recorded reason that says *"the preferred room was
unusable **because of missing required features**"* does **not** soften the feature check, while a bare
client-writable boolean does. **The enumerated mechanism is treated as less trustworthy than the boolean.
That inversion is the defect in one sentence.**

**Why the solvers genuinely need the forgiveness** (this is what R3 got wrong): both solvers stamp the
deferral *before* calling `validateHardConstraints` and then accept the slot only when
`hardViolations.length === 0` (`quick-place:286-289`, `repair:320-325`). The deferral is therefore what
makes a non-compliant room **considerable at all**. Make features HARD inside the trial and the solver
never considers such a room — so when no compliant room exists it returns "no slot", which is the
422 R3's D2 was probe-proven to cause. Both solvers also **score** by soft count
(`100 - softCount`, `+20` for the home room), so a deferred shortfall already costs score: the solver
*prefers* compliant rooms and only *settles* when it must. That is a preference, not a bypass — which is
exactly the behaviour a scheduler would exercise by hand.

**The batch auto-defer is different in kind.** `manual-edit.service.ts:1478-1487` iterates `newEntries`
— the whole post-batch list, not the batch's own `applied` edits (the code distinguishes them at `:1492`)
— and stamps on a **type** comparison alone (`:1481`), with no reason and no audit row. So one lenient
batch re-stamps pre-existing entries nobody touched, and via `:869` forgives their missing specialist
features too. This is the one that must go, and it is the one no legitimate flow depends on: the solvers
and the constructor all set their own metadata on the entries they create.

## D1 — Route choice must not change constraint severity

**Confirmed, unchanged from R3.** `/commit` and `/batch/commit` must return the same verdict for the same
edit. The flag is written only inside `commitManualEditBatch` (`:1484`) and read only by the shared
validator, so today the client picks the lenient route. This falls out of D3: with the blanket auto-defer
removed and the deferral derived per placement by the same code on both routes, there is nothing left to
differ.

## D2 — A server-derived deferral MAY forgive a room-feature shortfall, provided it is named and owned

**This reverses R3's D2, which was wrong, and here is the user-facing reasoning.**

*May it forgive?* **Yes.** A modular school does not own a chemistry laboratory with a fume hood. The
alternative is not a safer schedule, it is **no schedule** — the tool refuses to seat a real class, and
the scheduler is pushed back to a spreadsheet. That is precisely the "hassle" the operator asked me to
avoid, and it was measured, not assumed: R3's review probe-proved the HARD-features variant turns a
working Quick Place commit into `422 HARD_VIOLATION_BLOCK`.

*But three conditions, and they are the whole decision:*
1. **Server-owned.** The forgiveness must come from the solver that actually searched, never from a
   request body. Delete `proposal.metadata` from the wire type and stop writing it at `:692`; the client
   `ManualEditProposal` type does not even declare `metadata` (`types.ts:1384-1400`), so **no client author
   writes it deliberately** — there is no legitimate payload to preserve.
2. **Reason-bearing, not boolean.** Carry the enumerated `RoomAuthorityDeviationReason` vocabulary that
   already exists, so "settled for the best available room" is distinguishable from "modular pool" and from
   "home-room contract" — and so the *feature* case gets its own reason rather than borrowing the type one.
   This is also what lets `:869` stop treating an enumerated server reason as weaker than a boolean.
3. **Loud, not silent.** A deferral must surface to the operator **in words, naming the shortfall** —
   "placed in Lab 3, the best available room; Lab 3 has no fume hood" — not vanish into a generic SOFT
   warning list. Today the feature shortfall is softened with a message that describes the *home-room
   contract* (`:875`) whatever the real reason was, which is why nobody could tell this was happening.

**What I am explicitly *not* deciding:** whether a server-derived feature deferral should still block
**publication** while allowing the commit. I recommend **no** — keep it SOFT — because the operator's
standing rule is that generation and publication require zero HARD, and re-hardening this is exactly what
broke production. Conditions 1–3 give the operator the information to tighten it later without another
migration. If you want publication to block on a deferred feature shortfall, say so and it becomes part of
this change; it is a larger, new authority concept and I have not assumed it.

## D3 — The modular-pool exemption is legitimate; the blanket auto-defer is not

**Modular pool — keep, document, own it.** `isModularPoolAssignment` is
`roomAssignmentReason === 'MODULAR_POOL_ASSIGNED'` (`constraint-validator.ts:832`), written at scale by
`schedule-constructor.ts:3069`. A modular pool is *by design* a set of rooms allocated per slot, so a pool
room permanently lacking a specialist fixture is the normal case rather than an exception — the concept is
sound. It is simply **undocumented as an exemption and client-writable**, which is the actual defect.

**And a free simplification falls out:** `schedule-constructor.ts:3072` writes
`deferredRoomTypePreference: true` immediately after the `MODULAR_POOL_ASSIGNED` marker at `:3069`, but
`:869` already honours `isModularPoolAssignment` **on its own**. The boolean is therefore **redundant** for
the modular-pool path and can simply be deleted there — the feature exemption survives untouched.

**The blanket auto-defer — remove, do not narrow.** `manual-edit.service.ts:1478-1487` re-stamps the whole
draft on a type comparison with no reason and no audit row. Nothing legitimate depends on it: the solvers
and the constructor each set metadata on entries they create, at their own sites. Delete it.

## The third question answered — the Teaching Load repair path may NOT carry client metadata

**No — and this is the clearest of the three.** `timetable-teaching-load-repair.router.ts:134` forwards
`req.body`; `bindPlacementToUnassignedChange:623-628` returns `{ ...proposal }`, preserving `metadata`;
`:602-614`'s scope check does not cover `targetRoomId` / `targetDay` / times. It is a **forwarder, not a
producer** — it has no legitimate need for entry metadata, and it is the reason router-level stripping was
provably insufficient. One legitimate server producer exists (Quick Place), not two. Strip the placement
proposal's `metadata` at that router **and** close `:692` at the service choke point, because
`applyProposal` is private and reached only from `:767`, `:1116`, `:1323` — every path funnels through it.

## The fix, with the mechanism pinned (not left to the executor)

1. Delete the client-reachable `metadata` member from the wire proposal; stop writing `proposal.metadata` at
   `:692`. Close the `:134` repair forwarder too. *(D3-repair, and the original `:692` bypass)*
2. Replace the boolean with an enumerated, **server-only** deferral reason on an internal proposal/entry
   field, reusing `RoomAuthorityDeviationReason`; a **feature** shortfall gets its own reason value rather
   than borrowing the type one. Set it at `quick-place:279`/`:347` and `repair:314`; at
   `schedule-constructor.ts:3072` **delete** it as redundant.
3. Derive the deferral identically on `/commit` and `/batch/commit`; delete the blanket auto-defer at
   `manual-edit.service.ts:1478-1487`. *(D1)*
4. Split the consumption at `constraint-validator.ts:838`/`:869` so a **type** reason softens
   `ROOM_TYPE_MISMATCH` and only a **feature** reason softens `ROOM_FEATURE_MISMATCH`. *(D2)*
5. Name the real blocker at `timetable-teaching-load-repair.service.ts:343-348`, which currently reports
   *"No conflict-free slots found"* when the true reason is "no available room has the required feature" —
   a false operator-facing string, and one an older scheduler will act on wrongly.
6. Surface each deferral in plain words naming the shortfall. This reuses the `timetable-plain-language.ts`
   layer and the `warning-readability-c01` coverage guard, so a new code cannot ship unnamed.

## Controls that MUST exist (each one is a lesson already paid for)

- **Quick Place fallback preservation:** no home room, a single wrong-type room, subject requiring a feature
  the room lacks → **must still commit**, not 422. Pinned to that scenario, **not** to
  `timetable-scheduling-quality-c03.test.ts:672`, where the solver returns **0 proposals**
  (`placed=0, unplaced=1`) and the assertion would pass **vacuously**. R3's control was vacuous for exactly
  this reason. The default `requiredFeatures: []` fixture is equally vacuous.
- **TL repair preservation control** — no earlier version required one.
- **Client-cannot-downgrade control:** a `PLACE_UNASSIGNED` proposal carrying
  `metadata: { deferredRoomTypePreference: true }` or `roomAssignmentReason: 'MODULAR_POOL_ASSIGNED'` must
  leave `ROOM_FEATURE_MISMATCH` **HARD**.
- **Preview/commit parity control:** `previewManualEdit` reports `allowed` while ignoring soft violations
  (`:1167`), and `ManualEditPanel` no longer sends `allowSoftOverride` unconditionally (the client default
  is now `false`, `useTimetableMutations.ts:960`, `LockPanel.tsx:128` — an earlier claim that it did was
  stale). The preview must not report a commit that would then be refused, or the reverse.
- **Route-parity control:** identical edit, `/commit` vs `/batch/commit`, same verdict.
- **Whole-draft control:** a batch commit must not alter severity on entries it did not touch.

## Carried-forward corrections to the record this supersedes

- `manual_schedule_edits` has **0 rows** — no manual edit of any kind has ever been committed on this
  database, so **no data repair** is needed and the fix is forward-looking only.
- The earlier supporting figures "150 rows carrying a lone `roomAssignmentReason`" and "deferral keys only
  ever appear with server-written companions" were **asserted, not measured**, and are wrong: the reviewer
  measures ~13,800 draft entries and **3,000** carrying a lone `deferredRoomTypePreference`. The conclusion
  survives only because of the 0-rows signal above.
- Six body-carrying routes reach `:692`, not five: `manual-edit.router.ts:48`, `:78`, `:109`, `:139`, plus
  `timetable-teaching-load-repair.router.ts:118` (**preview**) and `:134` (**commit**).

## What is still owed before any of this ships

This record decides semantics. It is **not** a packet and authorises no edit. Per `AGENTS.md` §11 and §13 a
write-path authority change needs its own packet, an **independent** pre-action review, one executor, and
fresh post-action QA — and R1, R2 and R3 were each withdrawn at pre-action, so the reviewer must be fresh to
that failure mode. The one semantic choice I have flagged rather than taken is the publish-blocking
question in D2.
