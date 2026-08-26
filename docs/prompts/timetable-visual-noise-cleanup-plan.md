# Implementation Plan: Timetable Visual Noise and Badge Spam Cleanup

**Requirements doc:** `docs/prompts/timetable-visual-noise-cleanup-requirements.md`
**Active phase:** UX overlay (cross-phase, approved 2026-07-12)

---

## Step 1: Remove Textual Preview Labels from Grid Cells (FR-01)

**File:** `atlas-client/src/components/timetable/TimetableGrid.tsx`

### 1a. Remove the React-rendered `previewLabel` badge (lines 395-412)

Delete the JSX block that renders the preview label div:

```tsx
// DELETE lines 395-412:
{dropFeedbackMode && activeInfo?.kind !== 'self' && previewLabel && (
  <div
    className={cn(
      'mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
      previewStatus === 'blocked'
        ? 'bg-red-100 text-red-800'
        : previewStatus === 'warning'
          ? 'bg-amber-100 text-amber-800'
          : dropFeedbackMode === 'swap'
      ? 'bg-amber-100 text-amber-800'
          : 'bg-emerald-100 text-emerald-800',
    )}
    data-cell-preview-label={dropFeedbackMode}
    data-cell-status-label={previewStatus}
  >
    {previewLabel}
  </div>
)}
```

### 1b. Remove the `Occupied` badge (lines 413-417)

Delete the JSX block that renders the occupied count:

```tsx
// DELETE lines 413-417:
{hasPlacementSource && cellEntries.length > 0 && (
  <div className="mb-0.5 inline-flex items-center rounded-sm bg-muted px-1 py-0.5 text-xs text-muted-foreground">
    Occupied ({cellEntries.length})
  </div>
)}
```

### 1c. Remove unused variables

After removing the JSX, the `previewLabel` and `previewStatus` variables (lines 285-298) become dead code. Remove them to keep the file clean.

**Verify:** The `dropFeedbackMode` variable is still used by the `isActive` logic and `hasPlacementSource` — do NOT remove it.

---

## Step 2: Remove DOM-Injected Pointer Preview Labels (FR-02)

**File:** `atlas-client/src/components/timetable/TimetableGrid.tsx`

### 2a. Remove label creation from `decoratePointerPreview` (lines 746-770)

Inside the `decorateBatch` function within `decoratePointerPreview`, delete the block that creates and prepends the textual label div:

```tsx
// DELETE lines 746-770:
const label = document.createElement('div');
label.dataset.pointerPreviewLabel = 'true';
label.dataset.cellPreviewLabel = mode;
label.dataset.cellStatusLabel = status;
label.className = [
  'pointer-events-none',
  'mb-1',
  // ... full class list ...
].join(' ');
label.textContent = labelText;
cell.prepend(label);
```

Also remove the `labelText` variable computation (lines 728-734) since it is only used by the deleted label creation.

### 2b. Keep the guard condition

The line at 717 checks for existing labels:
```tsx
if (!day || !startTime || !endTime || cell.querySelector('[data-pointer-preview-label="true"]')) continue;
```

Since no labels will be created, this guard becomes harmless but redundant. Remove the `[data-pointer-preview-label="true"]` check from the condition for cleanliness:

```tsx
if (!day || !startTime || !endTime) continue;
```

### 2c. Keep `cleanupPointerPreview` as-is

The cleanup function (lines 683-699) that removes `[data-pointer-preview-label="true"]` elements should remain as a safety net for any residual elements from prior sessions.

---

## Step 3: Fix Dotted Borders on Soft-Warning Class Cards (FR-03)

**File:** `atlas-client/src/components/timetable/TimetableGrid.tsx`

### 3a. Change the soft-severity border class (line 457)

Change:
```tsx
cellClass += ' border-amber-500 border-dashed';
```

To:
```tsx
cellClass += ' border-amber-400';
```

This removes `border-dashed` and uses a solid amber border. The `border-amber-400` is slightly softer than `border-amber-500` to visually distinguish soft warnings from hard conflicts (which use `border-red-500`).

---

## Step 4: Consolidate Draft Placement Dialog Warnings (FR-04)

**File:** `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`

### 4a. Merge the occupied-slot warning into the main "Blocks" section (lines 445-479)

Current structure:
1. `confirmDisplacedPlacement` → separate "Blocks" section with occupied-slot warning
2. Main "Blocks" section with conflict check results

New structure: Single "Blocks" section that conditionally shows:
1. Occupied-slot swap prompt (if `confirmDisplacedPlacement` is truthy)
2. Conflict check loading/error/success/blocked states

```tsx
<ReviewActionSection
  title="Blocks"
  tone={/* combine: displacedPlacement warn + preview bad/good/neutral */}
>
  {/* Occupied-slot swap prompt (if applicable) */}
  {confirmDisplacedPlacement ? (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-semibold">This slot is occupied.</p>
      <p className="mt-1">Review the visual switch before replacing anything.</p>
      <Button className="mt-2" size="sm" variant="outline" onClick={() => openSwapPrompt()}>
        Review switch
      </Button>
    </div>
  ) : null}

  {/* Conflict check results */}
  {confirmPreviewLoading ? (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Checking placement...
    </p>
  ) : null}
  {confirmPreviewError ? (
    <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{confirmPreviewError}</p>
  ) : null}
  {confirmPreview && confirmPreview.hardViolations.length === 0 ? (
    <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
      <CheckCircle2 className="size-4 shrink-0" />
      No blocking conflicts for this owner, room, and slot.
    </p>
  ) : null}
  {confirmPreview && confirmPreview.hardViolations.length > 0 ? (
    <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      This placement is blocked. Use another slot or repair the source data before saving.
    </p>
  ) : null}
  {confirmPreview ? conflictSummary(confirmPreview) : conflictGuidance()}
</ReviewActionSection>
```

### 4b. Compute combined tone for the unified section

The tone should be:
- `'bad'` if `confirmPreviewError` or `confirmPreview?.hardViolations.length > 0`
- `'warn'` if `confirmDisplacedPlacement` (and not bad)
- `'good'` if `confirmPreview` and no hard violations and no displaced placement
- `'neutral'` otherwise (loading or no preview yet)

---

## Step 5: Simplify Footer Feedback Text (FR-05)

**File:** `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`

### 5a. Shorten generated placement footer feedback (lines 362-369)

Replace the full `generatedPlacementFeedback.message` with a short status. The existing `generatedPlacementFeedback` object already has `message` and `tone` — trim the messages:

| State | Current message | New message |
|-------|----------------|-------------|
| saving | "Saving placement now." | "Saving..." |
| missing_owner | "Fix the Teaching Load owner before saving." | "Fix owner before saving" |
| missing_room | "Choose or repair the room source before saving." | "Choose a room" |
| checking_conflicts | "Waiting for the conflict check to finish." | "Checking conflicts..." |
| preview_failed | (dynamic error text) | "Fix issues before saving" |
| blocked_by_conflict | "Choose another slot or repair the blocker before saving." | "Blocked: Fix issues" |
| ready | "Ready to save. ATLAS will update the draft after you confirm." | "Ready to save" |

### 5b. Shorten draft placement footer feedback (lines 496-503)

Apply the same trimming to `draftPlacementSaveState.message`:

| State | Current message | New message |
|-------|----------------|-------------|
| saving | "Saving draft placement now." | "Saving..." |
| missing_owner | "Fix the Teaching Load owner before saving." | "Fix owner before saving" |
| missing_room | "Choose or repair the room source before saving." | "Choose a room" |
| checking_conflicts | "Waiting for the conflict check to finish." | "Checking conflicts..." |
| preview_failed | (dynamic error text) | "Fix issues before saving" |
| blocked_by_conflict | "Choose another slot or repair the blocker before saving." | "Blocked: Fix issues" |
| ready | "Ready to save. ATLAS will update the draft after you confirm." | "Ready to save" |

Note: The `getDraftPlacementSaveState` function returns the `message` field, so update it there.

---

## Step 6: Localize ConflictBadgeWithTooltip (FR-06)

**File:** `atlas-client/src/components/timetable/TimetableGrid.tsx`

### 6a. Verify current behavior

The `ConflictBadgeWithTooltip` currently renders at lines 418-425:
```tsx
{isActive && activeInfo && (activeInfo.kind === 'hard' || activeInfo.kind === 'soft') && (
  <ConflictBadgeWithTooltip ... />
)}
```

The `isActive` flag is derived from `activeInfo !== null` (line 282), which is `info ?? kbConflictInfo ?? fullPreviewInfo`. During pointer drag, `info` comes from `useGridCellDragState(cellId)` which only returns non-null for the single active cell. During keyboard mode, `kbConflictInfo` is only set on the hovered cell. During full preview (`fullPreviewInfo`), ALL cells get the badge.

### 6b. Restrict during full preview mode

When `fullPreviewInfo` is the source of `activeInfo` (i.e., during keyboard mode full preview), the badge renders on every cell with a conflict. This contributes to badge spam. Restrict to only render when `info` (from drag state) or `kbConflictInfo` (from keyboard hover) is the active source, NOT when `fullPreviewInfo` is the source.

Change the condition to:
```tsx
{isActive && activeInfo && (activeInfo.kind === 'hard' || activeInfo.kind === 'soft') && (info !== null || kbConflictInfo !== null) && (
  <ConflictBadgeWithTooltip ... />
)}
```

This ensures the badge only appears on the single actively hovered/dragged cell, not on all cells during full keyboard preview.

---

## Verification

### Step V1: TypeScript check

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
```

### Step V2: Production build

```bash
cd D:\ATLAS\atlas-client
npm run build
```

### Step V3: UX guardrail tests

```bash
cd D:\ATLAS\atlas-client
npx vitest run --reporter=verbose src/__tests__/ux-guardrails.spec.ts
```

### Step V4: Timetable conflict tests

```bash
cd D:\ATLAS\atlas-client
npx vitest run --reporter=verbose src/__tests__/timetable-conflict.spec.ts
```

---

## Files Changed

| File | Change |
|------|--------|
| `atlas-client/src/components/timetable/TimetableGrid.tsx` | Remove preview labels, Occupied badge, DOM label injection; fix soft border; restrict ConflictBadge |
| `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx` | Consolidate Blocks sections; shorten footer feedback |
| `docs/prompts/timetable-visual-noise-cleanup-requirements.md` | New requirements document |

---

## Commit Message

```
refactor(timetable): remove badge spam and consolidate placement dialog warnings

Remove textual preview labels (Blocked/Warning/Can swap/Can place) and
Occupied badge from grid cells during placement mode. Remove DOM-injected
pointer preview labels from decoratePointerPreview. Change soft-violation
class card border from dashed to solid amber. Consolidate duplicate Blocks
sections in draft placement dialog. Shorten footer feedback text.
Restrict ConflictBadgeWithTooltip to single active cell only.
```
