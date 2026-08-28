# Task: Add Teaching Load Breakdown to Teacher Profile Drawer

## Context
The user requested: *"is it only status added? Is there no specialization like replacement? I think we should also place the teaching load breakdown along with the ancilliary tasks or anything that takes teaching load from EnrollPro"*.

We already replaced Specialization with Status in the previous task. Now, we need to improve the workload section of the Teacher Profile Drawer (`FacultyProfileSheet.tsx`) to explicitly show the components that make up the `Total weekly hours`. 

The total weekly hours (`faculty.policyCreditedHours`) comes from:
1. `sectionTeachingHours` (Class instruction)
2. `advisoryEquivalentHours` (Class advising, if `isClassAdviser` is true)
3. `ancillaryMinutesPerWeek` / 60 (Ancillary roles/tasks)

## Instructions
**1. `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`**
- In the "Workload Section", locate the existing "Includes Xh for class adviser duties" text:
  ```tsx
  {faculty.isClassAdviser && (
      <p className="text-xs font-bold opacity-70 mt-1 uppercase tracking-wider">Includes {faculty.advisoryEquivalentHours}h for class adviser duties</p>
  )}
  ```
- Replace it with a new `div` that breaks down the exact teaching load components. 
- You should calculate the ancillary hours as `Math.round((faculty.ancillaryMinutesPerWeek || 0) / 6) / 10`.
- Only show Advisory and Ancillary rows if they are greater than zero.

```tsx
<div className="mt-2 space-y-1.5 border-t border-current/10 pt-3">
    <div className="flex justify-between items-center text-xs font-bold opacity-80 uppercase tracking-wider">
        <span>Class instruction</span>
        <span>{faculty.sectionTeachingHours || 0}h</span>
    </div>
    {faculty.isClassAdviser && faculty.advisoryEquivalentHours > 0 && (
        <div className="flex justify-between items-center text-xs font-bold opacity-80 uppercase tracking-wider">
            <span>Class advising</span>
            <span>{faculty.advisoryEquivalentHours}h</span>
        </div>
    )}
    {faculty.ancillaryMinutesPerWeek > 0 && (
        <div className="flex justify-between items-center text-xs font-bold opacity-80 uppercase tracking-wider">
            <span>Ancillary tasks</span>
            <span>{Math.round(faculty.ancillaryMinutesPerWeek / 6) / 10}h</span>
        </div>
    )}
</div>
```

**2. Build & Verify**
- Run `npm run build` in `atlas-client` to ensure your change compiles successfully.
- Verify that the Workload section now displays a clear breakdown of where the hours are coming from.
