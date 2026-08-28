# Task: Fix "GENERAL" Department Fallback Misunderstanding in UI

## Context
The user raised an issue: *"I also just realized that all the teacher say GENERAL, instead of their actual department? Why is this? What is the mismatch with EnrollPro?"*

Investigation revealed that there is **no mismatch with EnrollPro**. The ATLAS backend correctly fetches departments (e.g., `FIL`, `MATH`, `TLE`). 

The problem is a purely frontend display issue: the UI currently renders `{member.specialization || 'General'}` as a subtitle under the teacher's name in `TeacherGridMode.tsx` and `TeacherIdentityStrip.tsx`. Because `specialization` is `null` for most teachers in EnrollPro, this falls back to `'General'`. The user is mistaking this specialization fallback for the teacher's department.

According to `GEMINI.md`: 
*"qualification baseline should be department-first; specialization mapping should be removed or demoted out of scheduler-facing workflow"*.

## Instructions
Please fix the UI components to demote `specialization` and correctly rely on `department`, using `departmentLabel` from `@/lib/deped-glossary` to render scheduler-friendly department names (e.g., `Filipino` instead of `FIL`).

**1. `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`**
- Import `departmentLabel` from `@/lib/deped-glossary`.
- Replace the line containing `<span className="text-foreground/70">{selected.specialization || 'General'}</span>` and the subsequent asterisk and department spans.
- It should now just cleanly render: `<span className="text-foreground/70">{departmentLabel(selected.department)}</span>`. Remove the asterisk and the second `<span>` entirely.

**2. `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`**
- Import `departmentLabel` from `@/lib/deped-glossary`.
- Locate the subtitle under the teacher's name: `<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">{member.specialization || 'General'}</p>`
- Change it to render: `{departmentLabel(member.department)}`.
- Locate the `<SelectContent>` for the Department filter dropdown (`departmentOptions.map`).
- Wrap the rendered `{dept}` with `departmentLabel`: `<SelectItem key={dept} value={dept} ...>{departmentLabel(dept)}</SelectItem>`
- **Important:** Also locate where `departmentOptions` is mapped to group the grid headers: `groupedFaculty.map(([dept, members]) => ...` and wrap the `{dept}` in `departmentLabel(dept)` inside the `<span className="truncate">{dept}</span>` of the grouping header.

**3. `atlas-client/src/components/faculty-assignments/RosterSidebar.tsx`**
- Import `departmentLabel` from `@/lib/deped-glossary`.
- Locate the secondary info line below the teacher name: `<span className="truncate text-xs text-muted-foreground/80 font-bold flex-1">{member.specialization || member.department || 'General'}</span>`
- Change it to: `{departmentLabel(member.department)}`.
- Locate the `departmentOptions.map` inside `<SearchableSelect>` and update the label field: `label: departmentLabel(department)`.
- Locate the grouping header in `groupedFaculty.map(([departmentName, members])` and wrap the `{departmentName}` with `departmentLabel(departmentName)`.

Verify the frontend builds successfully after these changes.
