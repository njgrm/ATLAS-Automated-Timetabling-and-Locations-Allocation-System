# Teaching Load — Swap Mechanism & Section Allocation UX Fix

**Active Phase/Stream:** Phase 3 generator-readiness support tasks (Teaching Load workspace correctness)  
**Scope Boundary:** `TeachingLoad.tsx`, `TeachingLoadModals.tsx`, `SectionGridMode.tsx`, `SubjectRow.tsx`, `useTeachingLoadUI.ts`, `App.tsx`  
**Out of Scope:** Backend API changes, auto-fill logic, schedule generation, any page outside `/teaching-load`

---

## Context

`FacultyAssignments.tsx` (old page) is orphaned and safe to delete. `App.tsx` creates a confusing alias:

```ts
// App.tsx line 13 — misleading alias name
const FacultyAssignments = lazy(() => import('./pages/TeachingLoad'));
```

`TeachingLoad.tsx` is the live page at `/teaching-load`. Its swap mechanism and section allocation popover have multiple UX bugs discovered in audit.

---

## Tasks (in order)

### Task 0 — Dead Code Cleanup

**0.1 Delete orphaned page**  
Delete `atlas-client/src/pages/FacultyAssignments.tsx`.  
Confirm nothing in `atlas-client/src/` imports this file directly (grep confirms only `App.tsx` references the alias name `FacultyAssignments`, which points to `TeachingLoad.tsx` — not to `FacultyAssignments.tsx`).

**0.2 Fix App.tsx confusing alias**  
In `atlas-client/src/App.tsx`, rename the lazy import variable from `FacultyAssignments` to `TeachingLoad`:
```ts
// Before
const FacultyAssignments = lazy(() => import('./pages/TeachingLoad'));
// After
const TeachingLoad = lazy(() => import('./pages/TeachingLoad'));
```
Update the JSX usage on the same line it's referenced:
```tsx
// Before
{ path: 'teaching-load', element: <FacultyAssignments /> }
// After
{ path: 'teaching-load', element: <TeachingLoad /> }
```

---

### Task 1 — Fix Swap Dialog Context (Critical)

**Problem:** The swap confirmation dialog shows a completely generic description. The user confirms a "Swap" without knowing what is being swapped, from whom, or to whom.

**Fix: Enrich `TeachingLoadModals` swap candidate type and description.**

**Step 1.1 — Update `swapCandidate` prop type in `TeachingLoadModals`.**

The modal must receive enough data to display human-readable context. Add the following resolved fields to the `swapCandidate` prop type:

```ts
// In TeachingLoadModals.tsx — update prop type
swapCandidate: {
  subjectId: number;
  sectionId: number;
  fromFacultyId: number;
  toFacultyId?: number | null;
  // Resolved display fields (to avoid prop-drilling lookups)
  subjectName?: string;
  subjectCode?: string;
  sectionName?: string;
  fromFacultyName?: string;
  toFacultyName?: string;
} | null;
```

**Step 1.2 — Resolve names at call site in `handleSwapRequest` (TeachingLoad.tsx).**

In `TeachingLoad.tsx`, `handleSwapRequest` currently sets the candidate with only IDs. Resolve the display names here by looking up from `data.subjects`, `data.sectionMap`, and `data.faculty`:

```ts
const handleSwapRequest = useCallback(
  (subjectId: number, sectionId: number, fromFacultyId: number, toFacultyId?: number) => {
    const subject = data.subjects.find(s => s.id === subjectId);
    const section = data.sectionMap.get(sectionId);
    const fromFaculty = data.faculty.find(f => f.id === fromFacultyId);
    const toFaculty = toFacultyId != null
      ? data.faculty.find(f => f.id === toFacultyId)
      : data.selected;

    ui.setSwapCandidate({
      subjectId,
      sectionId,
      fromFacultyId,
      toFacultyId: toFacultyId ?? null,
      subjectName: subject?.name,
      subjectCode: subject?.code,
      sectionName: section?.name,
      fromFacultyName: fromFaculty ? `${fromFaculty.lastName}, ${fromFaculty.firstName}` : undefined,
      toFacultyName: toFaculty ? `${toFaculty.lastName}, ${toFaculty.firstName}` : undefined,
    });
  },
  [data, ui],
);
```

**Step 1.3 — Update `TeachingLoadModals` swap dialog to show context.**

Replace the generic description with a contextual block:

```tsx
<ConfirmationModal
  open={Boolean(swapCandidate)}
  onOpenChange={(open) => {
    if (!open) onSwapCandidateChange(null);
  }}
  title="Transfer Section Ownership?"
  description={
    swapCandidate
      ? [
          swapCandidate.subjectCode && swapCandidate.subjectName
            ? `Subject: ${swapCandidate.subjectCode} — ${swapCandidate.subjectName}`
            : 'Subject: (unknown)',
          swapCandidate.sectionName
            ? `Section: ${swapCandidate.sectionName}`
            : 'Section: (unknown)',
          swapCandidate.fromFacultyName
            ? `From: ${swapCandidate.fromFacultyName}`
            : 'From: current owner',
          swapCandidate.toFacultyName
            ? `To: ${swapCandidate.toFacultyName}`
            : 'To: currently selected teacher',
          '',
          'This change is in draft mode and must be saved to persist.',
        ].join('\n')
      : ''
  }
  onConfirm={onSwapConfirm}
  confirmText="Transfer"
  variant="primary"
/>
```

> **Note:** If `ConfirmationModal` doesn't support newline-separated strings in `description`, render a custom `<div>` with separate `<p>` tags instead. Check `@/ui/confirmation-modal` prop signature before implementing.

---

### Task 2 — Fix Silent Abort in `executeSwap` (Critical)

**Problem:** When `toFacultyId` is null AND no teacher is currently selected (`data.selectedId` is null), `executeSwap` silently returns after the user already confirmed the dialog.

**Fix in `TeachingLoad.tsx` `executeSwap`:**

```ts
const executeSwap = useCallback(async () => {
  if (!ui.swapCandidate) return;
  const { subjectId, sectionId, fromFacultyId, toFacultyId } = ui.swapCandidate;
  const destinationFacultyId = toFacultyId ?? data.selectedId;

  // FIXED: surface the abort as an error instead of silent return
  if (!destinationFacultyId) {
    toast.error('Cannot swap: no destination teacher is selected. Select a teacher first, then retry the swap.');
    ui.setSwapCandidate(null);
    return;
  }

  // ... rest of swap logic unchanged
}, [data, ui]);
```

---

### Task 3 — Pass Target Teacher to SubjectRow Swap Button (Medium)

**Problem:** `SubjectRow.tsx` calls `onSwapSectionOwnership?.(subject.id, section.id, owner.facultyId)` with only 3 args. The 4th arg (target faculty ID) is never passed, forcing `executeSwap` to fall back to `data.selectedId`.

This is mechanically OK in Teacher Grid mode (the selected ID IS the target), but the dialog can't show "To: Teacher Name" because `toFacultyId` is null.

**Fix in `SubjectRow.tsx`:**

The `SubjectRow` already receives `selectedFacultyId` as a prop. Pass it as the 4th argument when the swap button is clicked:

```tsx
// Before
onClick={(e) => {
  e.stopPropagation();
  onSwapSectionOwnership?.(subject.id, section.id, owner.facultyId);
}}

// After
onClick={(e) => {
  e.stopPropagation();
  onSwapSectionOwnership?.(subject.id, section.id, owner.facultyId, selectedFacultyId);
}}
```

---

### Task 4 — Fix Stale Load% in SectionGridMode Popover (Medium)

**Problem:** The "Assign Teacher" Popover in `SectionGridMode` shows `f.policyLoadPercentage` which is the server-persisted value. Draft assignments made in the current session are not reflected.

**Fix in `SectionGridMode.tsx`:**

Derive a real-time load percentage from `effectiveAssignmentsByFaculty` (which includes draft state) rather than using the stale `policyLoadPercentage`.

In the candidate rendering inside the Popover, replace:
```ts
const loadPct = Math.round(f.policyLoadPercentage ?? 0);
```
With a computed value. Import `getFacultyComparableLoadHours` from `@/lib/faculty-assignment-helpers` (it computes from assignment data). The `effectiveAssignmentsByFaculty` is already available in `SectionGridModeProps`. Build the draft-aware load hours for each candidate:

```ts
// At the top of SectionGridMode (inside the candidates.map), replace loadPct calc:
import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';

// Inside the map:
const facultyEffectiveAssignments = effectiveAssignmentsByFaculty[f.id] ?? [];
// Use the server maxHoursPerWeek from the FacultySummary for % calculation:
const effectiveLoadHours = facultyEffectiveAssignments.reduce((sum, a) => sum + (a.sectionIds.length * /* subject minMinutes */ 0), 0) / 60;
// Simpler: fall back to server value if draft assignments are not computable without subject data
// Since SectionGridMode doesn't receive the subjects' minMinutesPerWeek mapped to assignments,
// use getFacultyComparableLoadHours(f) as a floor and add a "has draft" indicator instead:
const hasDraftChanges = Boolean(effectiveAssignmentsByFaculty[f.id]);
```

> **Pragmatic simplification:** Since `SectionGridMode` doesn't have full subject-minute data per assignment, the cleanest fix is to show a visual "Has draft changes" indicator next to the load% badge rather than computing exact draft hours. Mark teachers with pending draft assignments clearly:

```tsx
<span className={cn(
  "text-[10px] font-bold uppercase tracking-tighter",
  loadPct > 100 ? "text-rose-600" : loadPct > 80 ? "text-amber-600" : "text-emerald-600"
)}>
  {loadPct}% Load{hasDraftChanges ? ' *' : ''}
</span>
```
And add a legend line below the candidate list:
```tsx
{candidates.some(f => effectiveAssignmentsByFaculty[f.id]) && (
  <p className="px-3 py-1.5 text-[10px] font-semibold text-amber-700 italic border-t border-border/20">
    * Load% may be higher — draft changes are pending save.
  </p>
)}
```

---

### Task 5 — Prevent Cross-Mode Selection Bleed in `handleAssign` (Medium)

**Problem:** In Section Allocation mode, clicking "Assign Teacher" in the Popover calls `onSelectTeacher(facultyId)` inside `handleAssign`. This switches the Teacher Grid panel's selected teacher even though the user is currently in Section mode.

**Fix in `SectionGridMode.tsx` `handleAssign`:**

Only call `onSelectTeacher` in Section Grid mode if you actually want to focus the inspector. For the section-allocation flow, assigning via Popover should NOT change the Teacher Grid's selected teacher:

```ts
const handleAssign = (subjectId: number, sectionId: number, facultyId: number, currentOwnerId?: number) => {
  if (isReadOnlyMode || saving) return;
  
  if (currentOwnerId && currentOwnerId !== facultyId) {
    onSwapSectionOwnership?.(subjectId, sectionId, currentOwnerId, facultyId);
    return;
  }

  const teacherAssignments = effectiveAssignmentsByFaculty[facultyId] ?? [];
  const existingSubjectAssignment = teacherAssignments.find(a => a.subjectId === subjectId);
  
  let newSectionIds: number[] = [];
  if (existingSubjectAssignment) {
    newSectionIds = Array.from(new Set([...existingSubjectAssignment.sectionIds, sectionId]));
  } else {
    newSectionIds = [sectionId];
  }
  
  // REMOVED: onSelectTeacher(facultyId); — this bleeds into Teacher Grid mode
  onSetSections(subjectId, newSectionIds, facultyId);
};
```

> **Verify:** After removing `onSelectTeacher`, confirm that the section assignment still persists correctly in draft state by checking that `onSetSections` is wired to `handleSetSections` in `TeachingLoad.tsx` which already accepts an optional `facultyId`.

---

## Acceptance Criteria

| # | Criteria | Pass Condition |
|---|----------|----------------|
| AC-1 | Swap dialog context | Dialog shows subject name, section name, "from" teacher, "to" teacher before confirming |
| AC-2 | Silent abort eliminated | Confirming swap with no teacher selected shows a toast error; no silent no-op |
| AC-3 | Section alloc popover draft awareness | Teachers with pending draft changes show visual marker in Assign Teacher popover |
| AC-4 | No cross-mode bleed | Clicking "Assign Teacher" in Section Mode does not change Teacher Grid selection |
| AC-5 | Dead code removed | `FacultyAssignments.tsx` deleted; `App.tsx` alias renamed to `TeachingLoad` |
| AC-6 | No regressions | Teacher Grid mode section assignment (check/uncheck) continues to work; undo/redo continues to work; save flow unchanged |

---

## Files to Change

| File | Change |
|------|--------|
| `atlas-client/src/pages/FacultyAssignments.tsx` | **Delete** |
| `atlas-client/src/App.tsx` | Rename alias `FacultyAssignments` → `TeachingLoad` (2 sites) |
| `atlas-client/src/pages/TeachingLoad.tsx` | Enrich `handleSwapRequest` with resolved names; fix silent abort in `executeSwap` |
| `atlas-client/src/components/faculty-assignments/TeachingLoadModals.tsx` | Update `swapCandidate` prop type; show contextual swap description |
| `atlas-client/src/components/faculty-assignments/SubjectRow.tsx` | Pass `selectedFacultyId` as 4th arg to `onSwapSectionOwnership` |
| `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` | Remove `onSelectTeacher` from `handleAssign`; add draft-aware marker in Popover |

---

## Architecture Guardrails

- Preserve MVC/service-layer boundaries — all changes are view-layer only.
- No new API calls — all fixes use data already loaded in `useTeachingLoadData`.
- No new component files — fix in-place within existing files.
- Respect the 1000-line component file limit — no file in scope is near the limit, but do not introduce large blocks.
- Use `@/ui/*` primitives only — no raw `<select>`, no raw `<button>` without `variant`.

---

## Verification Steps

1. In Teacher Grid mode, select a teacher who has sections blocked (owned by another teacher).
2. Click the `ArrowLeftRight` swap button on a blocked section.
3. **Expected:** Dialog opens showing subject name, section name, current owner name, and the selected teacher as target.
4. **Expected:** "Transfer" button confirms the swap in draft mode with `toast.success`.
5. Close the dialog without confirming.
6. Deselect the current teacher (no selection active).
7. Attempt to trigger a swap again.
8. **Expected:** After confirming the dialog, a `toast.error` appears explaining no destination teacher is selected.
9. In Section Allocation mode, expand a section, open "Assign Teacher" popover.
10. **Expected:** Teacher with pending draft assignments shows `*` marker on load%.
11. **Expected:** Selecting a teacher does NOT change the Teacher Grid inspector panel state.
