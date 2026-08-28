# Task: Complete the Teacher Profile Drawer by Removing Obsolete Specialization

## Context
The user requested: *"create the next prompt to complete the teacher profile drawer then"*.

Based on recent discoveries, the `specialization` field from the EnrollPro live API is mostly `null` because modern DepEd MATATAG scheduling relies on `department` and explicit designations rather than narrow specializations. In the "Teachers" page (specifically the `FacultyProfileSheet.tsx` drawer that opens when you click a teacher), the "Specialization" field currently renders as `-` (blank).

Following the rule from `GEMINI.md`: *"specialization mapping should be removed or demoted out of scheduler-facing workflow"*, we will remove the obsolete Specialization field from the Profile Sheet entirely and replace it with a more useful property that is provided by the API: `employmentStatus` (e.g., `PERMANENT`).

## Instructions
**1. `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`**
- Locate the "Roster identity" section in the drawer.
- Find the `div` containing the "Specialization" field:
  ```tsx
  <div className="space-y-1.5">
      <p className="text-[0.65rem] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <User className="size-3 opacity-50" /> Specialization
      </p>
      <p className="text-sm font-semibold pl-0.5">{faculty.specialization || '-'}</p>
  </div>
  ```
- Replace it with a new field for **Employment Status**:
  ```tsx
  <div className="space-y-1.5">
      <p className="text-[0.65rem] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <User className="size-3 opacity-50" /> Status
      </p>
      <p className="text-sm font-semibold pl-0.5">{faculty.employmentStatus || 'Unknown'}</p>
  </div>
  ```
- Also, double-check if there are any other `faculty.specialization` fallbacks in the same file and remove them if they are scheduler-facing. (The main one is in the "Roster identity" section).

**2. Build & Verify**
- Run `npm run build` in `atlas-client` to ensure your change compiles successfully.
- Verify that the Roster identity section looks clean and correctly displays the Employment Status instead of a blank Specialization.
