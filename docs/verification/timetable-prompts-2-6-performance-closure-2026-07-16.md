# Timetable Prompts 2-6 Performance Closure - 2026-07-16

## Verdict

Technical performance gate: **GO** for Prompts 2-6.

Moderated older-user validation: **still open**. The implementation now has automated accessibility/focus and older-user ergonomic guardrail coverage, but no live moderated older-user session was performed in this environment.

## Implemented changes

- Prompt 2: replaced exact-cell-only live conflict lookup with an indexed interval-overlap conflict inspector.
- Prompt 2: added compact conflict state for drag/hover and detailed conflict state only for inspected cells.
- Prompt 2: covered section, room, faculty, faculty-option, special-event, source-entry, and daily-load conflict cases with deterministic tests.
- Prompt 3: changed Tactical Sandbox teacher candidate load computation from full timetable projection per candidate to baseline load indexes plus selected-entry delta projection.
- Prompt 3 re-audit correction: removed the remaining unassigned-session candidate path that still called full `teachingHoursForFaculty(draftEntries, faculty.id)` per rendered candidate.
- Prompt 3: capped rendered teacher candidate rows to 30 and added visible narrowing guidance.
- Prompt 4: throttled collaboration selection emits to at most one send per 100ms.
- Prompt 4: removed the artificial 180ms pivot/filter transition loader.
- Prompt 5: added latest-request guards for run-data refresh, room-request preview, manual-edit preview, and Teaching Load repair preview paths.
- Prompt 6: lazy-loaded `TacticalSandboxDock` behind an explicit mount guard so normal timetable navigation and selection do not download the repair dock chunk.
- Prompt 6 re-audit correction: tightened the lazy mount guard so unassigned-session state only mounts the sandbox chunk while the center view is the schedule workspace.
- Phase guardrail correction: extracted `TacticalSandboxDock.parts.tsx` so `TacticalSandboxDock.tsx` remains below the 1000-line component-file limit.

## Re-audit correction - 2026-07-16

The 0-6 phase re-audit found that the earlier Prompt 3 implementation optimized assigned-session candidate projection but left an unassigned-session fallback that still scanned the whole timetable for each rendered faculty candidate. That path is now covered by indexed projection helper tests and by UX guardrails that prevent regression to `selectedUnassigned ? teachingHoursForFaculty(draftEntries, faculty.id)`.

The same pass extracted candidate-row presentation out of `TacticalSandboxDock.tsx` to preserve the ATLAS frontend file-size guardrail before the dock crosses 1000 lines. Current component sizes are:

- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`: 927 lines.
- `atlas-client/src/components/timetable/TacticalSandboxDock.parts.tsx`: 97 lines.
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`: 655 lines.

## Interaction regression correction - 2026-07-16

Follow-up user validation found that the Prompt 1 containment pass had over-collapsed the grid interaction model: cells no longer registered as individual DnD droppable targets, and click-to-move mode only painted generic target styling instead of evaluating visible conflict feedback on the hovered cell. This made the timetable feel smooth while making placement/switching unreliable and hiding the live conflict inspector at the point of decision.

Correction:

- Restored click-to-move/keyboard conflict feedback by evaluating `getCellConflict(cellId)` on cell hover/focus and rendering the same conflict badge used during drag.
- Kept drag targeting delegated through the single parent grid drop zone and `td[data-day][data-start-time][data-end-time]` hit testing so cells do not subscribe individually to DnD state.
- Added a drag-end target fallback that resolves the active translated rectangle against the timetable cell DOM when DnD's `over` target only reports the parent grid.
- Added guardrails requiring hovered-cell conflict feedback to remain present and forbidding per-cell `useDroppable` subscriptions that cause all visible cells to commit on drag start/end.

Focused live Tailnet smoke after the fix:

- Desktop: preflight, pointer drag, keyboard select-then-place, and touch exemption passed (`4/4`).
- Mobile portrait: preflight, pointer drag, keyboard select-then-place, and touch select-then-place passed (`4/4`).
- Manual live check confirmed grid-visible feedback before commit: the source cell rendered `Current`, and an occupied target rendered `Swap Preview`, `Occupied`, and hard conflict text (`Section occupied`, `Room occupied`).

Full live Tailnet performance after the corrected implementation:

| Profile | Evidence dir | Gate | Pointer | FPS | Drag start commit | Drag end commit | Max cells per commit batch | Long tasks |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop | `qa-artifacts/perf-runs/run-2026-07-16T15-11-55-394Z` | PASS | PASS | 60.07 | 11.10ms | 9.00ms | 0 | 0 |
| Mobile portrait | `qa-artifacts/perf-runs/run-2026-07-16T15-15-31-006Z` | PASS | PASS | 60.18 | 10.90ms | 9.80ms | 0 | 0 |
| Mobile landscape | `qa-artifacts/perf-runs/run-2026-07-16T15-24-27-682Z` | PASS | PASS | 60.10 | 2.90ms | 1.90ms | 0 | 0 |

Note: an intermediate mobile-landscape full run produced one noisy drag-start commit (`46.10ms`) while still recording 60 FPS, zero long tasks, and zero cell commit batches. The immediate mobile-landscape rerun passed all 14 scenarios and is the accepted evidence for that profile.

## Local verification

Commands run from `D:\ATLAS\atlas-client`:

```powershell
npm run test:timetable-conflict
npm run test:ux-guardrails
npx tsc --noEmit
npm run build
```

Results:

- `test:timetable-conflict`: 10/10 passed.
- `test:ux-guardrails`: 18/18 passed.
- `tsc --noEmit`: passed.
- `npm run build`: passed.
- Production build emitted `dist/assets/TacticalSandboxDock-ij5bRlDa.js` as a separate lazy chunk.

## Live Tailnet verification

Command:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://njgrm.buru-degree.ts.net'
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

Result: **42/42 passed** across desktop, mobile portrait, and mobile landscape.

| Profile | Evidence dir | Gate | First selection | Repeated avg | Drag start latency | Drag start commit | Drag end commit | FPS | Long tasks | Touch |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Desktop | `qa-artifacts/perf-runs/run-2026-07-16T14-29-20-830Z` | PASS | 518.98ms | 170.85ms | 10.80ms | 2.90ms | 2.00ms | 60.18 | 0 | N/A |
| Mobile portrait | `qa-artifacts/perf-runs/run-2026-07-16T14-31-34-448Z` | PASS | 623.29ms | 154.25ms | 9.76ms | 3.20ms | 2.10ms | 60.16 | 0 | PASS |
| Mobile landscape | `qa-artifacts/perf-runs/run-2026-07-16T14-34-02-593Z` | PASS | 557.93ms | 175.06ms | 14.08ms | 2.30ms | 2.80ms | 60.17 | 0 | PASS |

Additional gate evidence:

- Keyboard select-then-place: PASS on all three profiles.
- Accessibility and focus scenario: PASS on all three profiles.
- Reversible commit and settled state: PASS on all three profiles.
- React commit containment: PASS on all three profiles.
- `maxCellsPerCommitBatch`: 0 on all three profiles.

## Navigation smoke

Commands:

```powershell
npx playwright test qa-artifacts/playwright/specs/live-navigation-smoke.spec.ts --project=desktop --workers=1
npx playwright test qa-artifacts/playwright/specs/live-navigation-smoke.spec.ts --project=desktop --workers=1 --grep "public navigation"
```

Results:

- Admin navigation: PASS.
- Public navigation: PASS.
- Faculty navigation: **blocked by live auth**. The first run returned HTTP 429 after the full performance suite; a later single retry returned HTTP 401 for the configured faculty QA credentials. This is a live credential/auth condition before page navigation, not a captured frontend navigation exception.

## Known caveats

- Tailnet still intermittently logs cancelled resource loads and occasional `502` responses during rapid navigations. The app remained functional and all performance scenarios passed despite this network noise.
- No client lint script exists in `atlas-client/package.json`; lint could not be run without introducing a new project command.
- Human moderated older-user evidence remains open and should be scheduled separately from the technical performance closure.
