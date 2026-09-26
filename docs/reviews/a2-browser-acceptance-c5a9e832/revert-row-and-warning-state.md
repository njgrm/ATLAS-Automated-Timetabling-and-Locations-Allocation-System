# Browser acceptance part 2 — the `REVERT` row, 2026-09-27 05:53–05:56 +08

**Authorised under `AGENTS.md` §12 as an ordinary UI mutation** (`save`/`apply`) on a **draft**, not a
publication. Verified first: **Runs shows 8 runs — run 321 is the current draft ("Latest", Reviewing); run 320 is the
published one.** The test therefore touched the draft only. **Publication was not touched and remains HIGH.**

**Public surface verified unaffected after the test:** `?date=` 2026-09-26 → 200 run **319** (895 entries,
fallback true); 2026-09-27 → 200 run **320** (895 entries, fallback false). No 409. `/health/ready` `ready`.

## What was done

A clean two-class swap on **draft run 321, GR7 - Luna**: Class A **MAPEH Mon 7:30–8:15** (I. GARCIA, 1 warning) ↔
Class B **ESP Mon 8:15–9:00** (J. Cruz). Pre-state recorded before the write.

| Step | Observed |
|---|---|
| Preview | "Safe to review"; commit button **"Swap + move 1 class"**; disclosure *"These two classes will exchange their scheduled times. Each teacher stays with their class."* |
| **Commit** | **warnings 159 → 68**; *Schedule history* went from disabled to **"Schedule history (1)"** |
| **SWAP row** | "Swapped two sessions 9/27/2026, 5:54:10 AM" · "Changed by a signed-in account. This record does not show which person." · **"Revert this edit"** present (correct for a SWAP row) · **no `warnings: N` / `All serious problems: N` line** — the fabricated count is gone |
| **Revert** | clicked "Revert this edit" on the SWAP row |
| **REVERT row** | **"Undone change"** · **"Undid: Swapped two sessions · 9/27/2026, 5:54:10 AM"** · **"This undo cannot be undone."** · **no "Revert this edit" on this row** · **no "Redo" anywhere** · no stale counts |

**`D9` row 3 — PASS.** The statement renders, it names the edit it undid with that row's own timestamp, the
misleading affordance is gone, and no control is offered that the server would refuse. Screenshots:
`a2-history-swap-row-c5a9e832.png`, `a2-history-revert-row-c5a9e832.png`.

## Finding — the revert restored the pair but NOT the warning state

**This is a real acceptance finding and it is not glossed.**

```
pre-swap        159 warnings
after swap       68 warnings   (the auto-fix)
after revert     69 warnings   <- NOT 159
```

The revert **did** what it was asked to do: it restored both halves of the recorded pair, and it wrote a truthful
history row. But the **warning state was not returned to its pre-swap value**, so the draft is ~90 warnings better
than it started.

**Most likely cause, consistent with a trace I filed as a successor in September and have NOT proven in this
session:** the swap committed an **auto-move** — the preview said so ("Committing also relocates…"), and the button
said so ("Swap + move 1 class") — but a `SWAP_ENTRIES` history payload records **only `entryIdA` and `entryB`**. The
auto-move's effect on anything outside that pair is therefore **not in the history at all**, so no revert of this row
can restore it. That is the "record the auto-move" successor, and this test is the first direct evidence that the
gap has a **user-visible consequence**.

**Status: `CORRECTION_REQUIRED` on the revert contract, NON_BLOCKING for release `c5a9e832`** — the shipped code did
exactly what it claims, truthfully, and disclosed the move before commit. What it cannot do is undo a move its own
history does not record. Fixing that is a payload-contract change (record the auto-moved entries in
`beforePayload`/`afterPayload`, then extend the `SWAP_ENTRIES` restore to them), and it is a **separate candidate**.

## Residue disclosure

**Draft run 321 is left at 69 warnings, not the 159 it started at.** The swap-plus-revert pair was net-non-neutral
on the draft. This is the cost of the acceptance test and it is stated here rather than left for someone to find.
**The published run 320 and the whole public surface are untouched** (verified above), so no parent, student or
teacher saw any change. Restoring the draft to 159 would require either a regeneration (HIGH, not authorised here)
or a corrective edit; **that decision is owed and is not mine to take silently.**

Console throughout: **2 errors, both EnrollPro proxy 502s** — the separate `ENROLLPRO-PROXY-RECOVERY` stream.
