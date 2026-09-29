fix-1.2 · LIVE 0 · PENDING DEPLOY 0 · IN PROGRESS 0 · PARTLY 4 · NOT STARTED 4 · CONFLICT 1

24.2 — NOT STARTED. `3216d383` and `origin/main` both use `Faculty.tsx:666` to compute `nextTeacherNumber`; `components/faculty/rosterActionLabels.ts:52-56` renders `Create temporary teacher (Teacher ${nextTeacherNumber})` (not static `Teacher X`). Left: make the header action’s visible label exactly `+ Create temporary teacher (Teacher X)`.

35.1 — PARTLY. LIVE: `bcb564fb` is an ancestor of `3216d383`; `src/ui/tooltip.tsx:35-45` portals shared content and gives it `z-50`, so ancestor clipping is addressed. But `TeacherAttentionFilters.tsx:60` still passes `max-w-60`, while shared content is `whitespace-nowrap` (`tooltip.tsx:40`), not the requested wrapping/autosizing style. Left: global multiline, viewport-safe filter-pill styling and verify every named chip.

23.2 — PARTLY. LIVE: Subject coverage alone is resizeable (`c6759e28`, ancestor of `3216d383`; `SubjectCoverageSheet.tsx:103-124`, `resize: 'both'`, 500px/95vw/420px bounds). The shared wrapper remains fixed (`src/ui/dialog.tsx:26-42`); e.g. Create temporary teacher is `sm:max-w-[480px]` (`CreatePlaceholderDialog.tsx:151`). Left: universal resizable data/form-dialog contract and explicit fixed confirmation exceptions.

16.2 — PARTLY. LIVE: row Review and Edit handlers stop propagation (`TeacherGridMode.tsx:499-502,529`; `abe0153a` is an ancestor of `3216d383`). But Review/Edit are rendered before the load signals (`TeacherGridMode.tsx:492-537`), not at the far right after fixed metric columns, and the metrics are flexible rather than requested `w-36/w-20/w-20` slots. Left: reorder and pin the metrics/actions grid.

38.1 — CONFLICT. Newer 14:15 direction supersedes the requested `STAFF WORKLOAD AUDIT` roster: Load summary must be the prominent clickable staffing percentage and list classes still needing a teacher by subject, not total/underloaded/balanced/overloaded staff metrics. Active replacement packet: `docs/prompts/a6-c9-staffing-percent-2026-09-29.md`. Left: follow c9, not this roster-audit specification.

17.2 — PARTLY. LIVE: coverage dialog resize/centering is present (`c6759e28`, ancestor of `3216d383`; `SubjectCoverageSheet.tsx:103-124`). Its section chips remain compact (`SubjectCoverageSheet.tsx:260-263`: `gap-1.5 px-2.5 py-1`, grade `text-[10px] px-1.5`), below the requested sizes. Left: enlarge chip, grade badge, and section-name typography/wrapping.

7.2 — NOT STARTED. Main-only A9 change `86665f48`/integration `a59364c3` changes the page to problems-first, but `origin/main:RoomReadinessList.tsx:202-235` has only `showAllRooms`; it has no All/Ready/Needs Attention/Unavailable state filter, and room rendering is unsorted (`:286`). Left: status filter buttons, natural room-name ordering, and empty state.

36.2 — NOT STARTED. `origin/main:CampusMapEditor.tsx:280-285,318-330,396-400` calls `clampBuildingToCanvas`; `campusEditorCanvas.ts:164-166` clamps x/y to zero. Main-only `26b887c4` only fits the editor to free area. Left: centered virtual world plus left/top prepend-and-translate/scroll compensation.

10.2 — NOT STARTED. `origin/main:CampusMapOverview.tsx:722` still renders room names with `truncate`; no matching utility-bar inset exists. The A9 changes since live do not modify this building-details markup. Left: wrapping room labels/card height and `px-4 md:px-6` utility/viewer padding.
