# Prompt 02 — Teaching Load Subject Shortage View

## Role

You are the ATLAS Teaching Load UX executor. Implement only this prompt after Prompt 01 is GO.

## Problem

When Dashboard says a subject still needs a teacher, Teaching Load opens with `Teachers` and `Sections` only. The operator cannot immediately tell which subject is missing coverage. Teaching Load needs a visible subject-first shortage view using the Prompt 01 coverage contract.

## Target files

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadRepairQueue.ts`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`
- New focused component under `atlas-client/src/components/faculty-assignments/` if needed, for example `SubjectCoverageMode.tsx`
- Existing Teaching Load tests or UX guardrails where appropriate

## Out of scope

- New backend write endpoints.
- Replacing Teacher or Section modes.
- Rewriting the entire Teaching Load page.
- Changing canonical ownership semantics.

## Requirements

- Teaching Load shall expose three visible modes: `Teachers`, `Sections`, and `Subjects`.
- When opened with `?view=subjects` or `?task=missing-load`, Teaching Load shall show the subject coverage view.
- The subject coverage view shall sort missing coverage first by `uncoveredSectionCount desc`.
- The subject coverage view shall show, for each subject:
  - subject code and name;
  - covered vs required sections, for example `19/20 covered`;
  - uncovered section count;
  - placeholder coverage count if present;
  - exact uncovered section labels when available.
- A row with uncovered sections shall provide an action to focus the first uncovered section in the existing section assignment workflow.
- A row with full coverage shall be visually quieter than a missing row.
- The repair queue `missing-load` primary action shall switch to the subject coverage view rather than leaving users in a generic teacher list.
- Existing Section mode shall remain available for assigning owners.
- Existing Teacher mode and inspector behavior shall remain available.

## UI requirements

- Use `Tabs`/`TabsTrigger` from `@/ui/tabs`.
- Use standard `Card`, `Badge`, `Button`, `Tooltip`, and existing Teaching Load layout primitives.
- Preserve root `h-[calc(100svh-3.5rem)]` and local `flex-1 min-h-0 overflow-auto` behavior.
- Avoid a large warning banner. Use a compact status strip or table/list rows.
- Do not introduce raw native buttons or native selects.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Tailnet browser checks:

1. Login as admin.
2. Open `/teaching-load?view=subjects&filter=missing-coverage`.
3. Confirm `Subjects` tab is selected.
4. Confirm missing subjects appear above fully covered subjects.
5. Confirm a missing row shows exact uncovered section labels when Prompt 01 provides them.
6. Click the row action and confirm the existing assignment workflow focuses the relevant section/subject without creating an unintended draft.
7. Switch back to `Teachers` and `Sections`; confirm both remain usable.
8. Check desktop `1366x768`, mobile portrait, and mobile landscape for no global overflow.

## Acceptance criteria

- Operators can identify the missing subject without opening every teacher.
- Operators can identify at least the first uncovered section for a missing subject.
- The repair queue routes to the subject shortage view.
- No new write path bypasses existing Teaching Load draft/save controls.
- Prompt 03 can proceed.

## Final report required

Report route behavior, visual mode behavior, exact query parameters supported, command results, Tailnet screenshots or measurements, and any remaining caveats.
