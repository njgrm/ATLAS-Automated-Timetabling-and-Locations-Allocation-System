# Phase 3 Sections Room Picker Follow-Up Audit - 2026-05-26

## Scope

Verify the current `Sections` home-room picker against the latest live user concerns:

- the room combobox cannot be comfortably scrolled inside the viewport
- the page falls back to `Working from saved data` again after navigation even when EnrollPro has already recovered
- `Browse in Campus Map` kicks the scheduler out of the current workflow and is landing on the wrong route

## Files Inspected

- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- `atlas-client/src/components/sections/SectionRow.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/App.tsx`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`

## Findings

### 1. The current room picker is not viewport-safe enough

Confirmed in `SectionRoomPicker.tsx`:

- `PopoverContent` has fixed width but no viewport-aware height guard
- only the list region has `max-h-[320px] overflow-y-auto`
- the overall picker still adds header chrome plus the `Browse in Campus Map` row above that list
- the picker therefore grows beyond the comfortable visible area near the lower part of the page

This matches the user complaint that the combobox reaches below the visible workspace.

### 2. The room picker regressed into raw controls

Confirmed in `SectionRoomPicker.tsx`:

- raw `<input>`
- raw list `<button>` rows
- raw anchor link used as the map shortcut

This violates the project rule that interactive controls must stay within the `@/ui/*` primitive family.

### 3. The saved-data banner can come back falsely after navigation

Confirmed in `Sections.tsx` and `enrollpro-public-settings.ts`:

- `resolveActiveSchoolYearContext()` intentionally returns `source: "cache"` when a fresh local active-school-year cache exists
- `Sections.tsx` uses that warm cache immediately on reopen
- when cached section summary + cached home rooms are present, the page sets:
  - `dataSource = "atlas-mirror"` while online
  - `cacheNotice = "Refreshing live section data..."`
- the visible page state can therefore revert to `Working from saved data` before the fresh runtime and summary fetch complete

This is not a backend outage. It is a front-end reopen-state honesty problem.

### 4. `Browse in Campus Map` is wired to the wrong route

Confirmed in `SectionRoomPicker.tsx`:

- the link is `href="/map-editor" target="_blank"`

Confirmed in `App.tsx`:

- the actual route is `/map`
- there is no `/map-editor` route

So the current shortcut is wrong even before evaluating whether route-out navigation is the right workflow.

### 5. Route-out map navigation is the wrong interaction model for this task

The user wants to keep schedulers inside `Sections` and choose a home room with section context still visible.

Current behavior is weaker because it:

- opens another route in another tab/window
- loses the current row workflow
- does not show a section-scoped "pick this room" interaction
- does not visibly reinforce which sections already have a home room after save

The better interaction is an in-page map modal or sheet.

### 6. Existing section detail surface is not the place to solve this

`SectionDetailsSheet.tsx` already exists for assigned classes.

That drawer should remain class-focused.
The home-room map workflow should be a separate lightweight room-selection surface rather than overloading the class drawer.

## Conclusion

The user's three reported issues are real.

The follow-up should do four things together:

1. make the room picker viewport-safe and internally scrollable
2. stop showing a false saved-data state on page re-entry when live verification is merely pending
3. replace the broken route-out `Browse in Campus Map` shortcut with an in-page room-picking map modal
4. restore design-system compliance by removing the raw picker controls
