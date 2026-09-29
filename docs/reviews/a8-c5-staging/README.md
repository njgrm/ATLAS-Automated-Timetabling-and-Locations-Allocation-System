# A8 c5 — planner's own rendered evidence on real staging data

Collected by Lane A8 (primary planner) on 2026-09-29. Origin: a loopback preview of the CANDIDATE
`19aa9598`, `scripts/dev/start-preview.ps1` on port 5231, which hard-proxies to the **staging** API
`http://127.0.0.1:5101/api/v1` and can never reach live 5001. Sign-in through `/__dev/staging-login`
(server-side staging sign-in). Viewport 1366x768 throughout. `window.location.origin` =
`http://127.0.0.1:5231` — an explicitly **isolated** check, never ATLAS acceptance.

## B1 — `/timetable` on real staging data: PASS on the reachable surface, and the row is only partly decidable

Screenshot `b1-timetable-term-required.png`. The staging timetable workspace **does not load**; it renders
the honest term-authority state:

> Term setup is required before the timetable can be loaded.
> `[Retry]` `[Open Year Setup ->]`

`Open Year Setup` was clicked (real navigation) and landed on the exact place it claims:
`b2-year-setup-after-fix-button.png` reads **"EnrollPro has moved to 2026-2027. Start 2026-2027 in ATLAS."**
with the two keep-rules and a single `Start 2026-2027 in ATLAS` action.

This is the cascade behaving exactly as the packet asks at the top of the chain: a named cause, a count-free
one-line explanation, and one button that opens the exact page that fixes it. It is also the answer to the
operator's question — *reachable and fixable* here, but the fix itself is a locked rollover apply.

`scripts/qa/ux-audit.js` on this screen, verbatim result:

```
major: 0   mojibake 0   moreFilters 0   overflowing 0   pageScrollsSideways false
smallText 2 (both 12.8px: "Retry", "Open Year Setup" — above the 12px major threshold)
smallTargets 14 (all pre-existing rail/topbar rows at 32px; not part of `major`)
```

`major: 0` — this screen passes the operator's rendered gate.

**Not decided on this row:** the generation blocker panel, the Generate dialog and the publish dialog cannot
be reached, because the workspace will not mount while the active year is 2023-2024 and EnrollPro has moved
to 2026-2027. Starting the new year is a rollover apply — a HIGH action this lane is not authorized to
perform. Recorded as `UNPERFORMED(reason)`, not as a pass and not as "not applicable".

## B2 — every fix button opens the exact page: PARTIAL

Decided for the one cause this surface presents: `Open Year Setup` → `/admin/year-setup`, with the guided
step for the real cause visible on arrival (screenshot above). The remaining causes (no room, no Teaching
Load owner, no time window) are unreachable behind the same workspace gate, so they are `UNPERFORMED` for
the reason given in B1, not passed.

## B3 — `/subjects` cold load: the behaviour passes; the type-scale gate does not

Screenshot `b3-subjects-saved-catalog.png`, real staging data, one navigation.

Measured in-page on first load:

| Measure | Value |
| --- | --- |
| `domContentLoaded` | 714 ms |
| `loadEventEnd` | 723 ms |
| first-contentful-paint | **968 ms** |
| subject rows painted | **22** |

The addendum 20:10 complaint was a 20.5 s first load that fell back to "Using saved data" and read as broken.
Measured now: **968 ms to first contentful paint with all 22 subjects on screen.** The receipt is specific
and names what was served and when:

> Using saved data. ATLAS is showing the saved subject catalog for this school. ATLAS is showing 22 subjects
> from the server, loaded at 01:04 today. Add a subject if the catalog is missing one, or open coverage for
> subjects at risk.

The page also states the outstanding term cause in words instead of hiding it:

> Term information needs updating before scheduling. ATLAS could not confirm the saved school year and terms,
> so it is not using them. Refresh the term data from EnrollPro, then try again before scheduling into a term.

**`scripts/ux-audit.js` on `/subjects`: `major: 17` — this row FAILS the operator's rendered gate and is
reported as a failure, not smoothed over.** The 17 are entirely sub-12px text:

| px | What | Owner |
| --- | --- | --- |
| 10.4 | `USING SAVED DATA` chip, the three banner chips, `Active` / `Archived` badges | pre-existing |
| 9.6 | grade chips `7 8 9 10` and program chips `BEC STE SPA SPS` | pre-existing |
| 11.2 | `Owned by …` spans in the coverage column | pre-existing |
| 12.8 | `Add subject`, `Help`, column-header buttons (not counted in `major`) | pre-existing |

**None of the 17 is introduced by this candidate**, and that is verifiable rather than asserted: the chip
components that carry those sizes are not in the range —

```
git -C D:/ATLAS diff --name-only f925045c..19aa9598 | Select-String "AdminWorkspace|SourceStateChip"
  -> no matches
git -C D:/ATLAS diff f925045c..19aa9598 -- atlas-client/src/components/admin-workspace/AdminWorkspace.tsx
  -> empty
```

These 9.6/10.4/11.2px arbitrary-rem sizes are exactly the debt the A7 c8 type-scale ratchet counts, and
A7 c9 owns the re-fit. The receipt this packet added rides on an existing chip, so it inherits that chip's
size; this candidate changed the chip's **content**, not its size class.

Row result: `B3 behaviour PASS` (measured, rendered, real data) · `B3 ux-audit gate FAIL(major: 17, all
pre-existing, owner A7 c9)`. The operator's rule is that `major` must be 0, so this page is **not** claimed
as a clean pass, and it is handed to Lane C with the owner named.

## Console

Three errors, none from this candidate:

- `502 http://127.0.0.1:5231/enrollpro-api/settings/public` (×2) — the EnrollPro proxy. The known live-env
  state; `ENROLLPRO-PROXY-RECOVERY-LIVE` is prepared and **not approved**. Not this lane's to fix.
- `404 .../uploads/campus-f638184b-….png` — a missing campus image asset.

## Not performed, with the reason (never "not applicable")

- **The generation blocker panel, the Generate dialog and the publish dialog on real staging data.** Blocked
  by the year gate in B1. A DEV row, a jsdom row, or a mock row is not a substitute: the packet's own rule is
  that a user-facing fix is done when it is **seen rendered**, and a source-text assertion is not evidence.
- **Forcing the top-4 blockers on a scratch year, and the generate step of B4.** Forcing is an ordinary UI
  mutation and would have been authorized; it is unreachable for the same reason. The **generate step is a
  generation run** — a HIGH action (§13) that no instruction in this cycle authorized. It goes to the operator.

## Preview lifecycle

Started detached as PID **53480** on port 5231, and stopped by `taskkill /T /F /PID 53480` — by the recorded
PID only, never by name or by port owner, because 5001/5174 (live) and 5101/5274 (staging) are node processes
too.
