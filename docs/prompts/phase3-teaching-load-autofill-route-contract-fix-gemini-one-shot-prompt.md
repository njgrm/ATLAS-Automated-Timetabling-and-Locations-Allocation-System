# Gemini Execution Prompt: Phase 3 Teaching Load Auto-Fill Route Contract Fix

## Mission

Finish the remaining Teaching Load unblock by fixing the current auto-fill client contract bug.

The read/write unblock is now effectively landed:

- manual save is available again
- split-brain is warning-only, not blocking

But the `AUTO-FILL` action still fails because the current `TeachingLoad` page is calling the wrong backend route and using the wrong request body field.

This is a tiny frontend integration repair, not a broad redesign pass.

---

## Scope

### In Scope
- Fix the Teaching Load auto-fill request path and payload contract
- Verify the auto-fill button works again on the current Teaching Load page
- Update evidence and prompt index docs

### Out Of Scope
- backend scheduling math
- Teaching Load layout redesign
- split-brain policy changes
- MAPEH redistribution logic
- timetabling generator changes

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-server/src/routes/faculty-assignment.router.ts`

---

## Current Verified Bug

This is already verified:

1. `TeachingLoad.tsx` currently posts auto-fill to:
   - `/faculty-assignments/autofill`
2. The real server route is:
   - `POST /api/v1/faculty-assignments/auto-fill`
3. The current client also sends:
   - `mode: ui.coverageMode`
4. The server expects:
   - `coverageMode`

Manual save and split-brain warning state are no longer the main blocker.
The remaining failure is this frontend route/payload mismatch.

---

## Required Fix

### 1. Correct the auto-fill endpoint path

Required outcome:

- `TeachingLoad.tsx` must post to `/faculty-assignments/auto-fill`
- not `/faculty-assignments/autofill`

### 2. Correct the request body field

Required outcome:

- the request body must send `coverageMode: ui.coverageMode`
- not `mode: ui.coverageMode`

### 3. Preserve current preflight behavior

Required outcome:

- keep the current reconcile-first behavior when `splitBrainNeedsReconcile` is true
- do not regress the current manual save or warning-only unlocked state

---

## Verification Requirements

You must verify all of the following:

1. `npm --prefix atlas-client run build` passes
2. The `AUTO-FILL` button on Teaching Load no longer fails because of the route/payload mismatch
3. The request reaches the correct backend route
4. The current workspace remains writable after the fix

If you test on Tailnet:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Record whether auto-fill:
- succeeds fully
- or reaches the backend and then fails for a deeper business reason

That distinction matters.

---

## Documentation Updates

Update:

- `docs/verification/evidence-log.md`

Append only.

The evidence entry must state:

- old broken route
- corrected route
- old wrong request field
- corrected request field
- whether auto-fill now succeeds end-to-end

---

## Completion Rule

This pass is `GO` only if the current remaining auto-fill failure is removed as a frontend contract bug.
