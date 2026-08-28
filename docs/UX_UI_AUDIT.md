# Complete UX/UI Audit of the ATLAS System

## Overview
This document serves as a comprehensive audit of the UX/UI across the ATLAS system. It outlines current weaknesses based on established ATLAS SMART-family layout rules, constraints defined in the project configuration, and the objective of aligning with the **SMART** sister system (`D:\ATLAS\external-references\FINAL-CAPSTONE-SMART`).

## Current Objective: Aligning with SMART
Our primary UX/UI objective is to reflect the design philosophy of the SMART system. 
This means prioritizing:
1. **Clear, System-Driven Banners**: Utilizing distinct notification banners (Blue for Info, Amber for Warning, Red for Urgent) for system statuses like deadlines or sync states (e.g., "EnrollPro Connected").
2. **KISS Principle (Keep It Simple, Stupid)**: Rejecting complex custom UI solutions in favor of clean, out-of-the-box Radix UI primitives (`shadcn/ui`).
3. **Data Authenticity**: Avoiding dense walls of fake data. If data is not available, showing a graceful empty state instead of mock activities.
4. **Calm Visual Hierarchy**: Reducing badge spam, using grouped controls, and distinctly separating everyday actions from destructive ones.
5. **Progressive Disclosure**: Using `Sheet`, `Dialog`, or `Popover` for deep dives instead of cramming all details into table rows or fragile native tooltips.

---

## Identified Developer/Architecture UX/UI Weaknesses

### 1. Excessive Micro-Text Usage (`text-[10px]` / `text-[11px]`)
**Rule Violation**: ATLAS guidelines strictly state to avoid micro-text and treat `text-[0.6rem]`, `text-[0.625rem]`, etc., as a smell.
**Findings**: Widespread use of `text-[10px]` and `text-[11px]` across critical pages such as `Subjects.tsx` and `Dashboard.tsx`. 
**Improvement**: Upgrade these to `text-xs` (or `text-sm`) with a muted color (`text-muted-foreground` or `opacity-80`) to de-emphasize text without shrinking it to unreadable sizes.

### 2. Native HTML Tooltips (`title="..."`)
**Rule Violation**: Native tooltips (`title` attribute) or raw `<details>` tags are prohibited. 
**Findings**: Hardcoded `title=` attributes are being used in `SpecializationMapping.tsx`, `MySchedule.tsx`, etc.
**Improvement**: Replace all native `title=` attributes with the central `@/ui/tooltip` component.

### 3. Native Form Controls and Buttons
**Rule Violation**: Native HTML `<select>` and raw styled `<button className="...">` inputs are strictly prohibited. 
**Findings**: Native `<button>` tags without the `@/ui/button` primitive are still lingering in `OfficerRoomPreferences.tsx` and `Login.tsx`.
**Improvement**: Convert all raw `<button>` elements to `<Button variant="...">` from `@/ui/button`.

### 4. Overly Large Component Files
**Rule Violation**: No single React component file shall exceed 1,000 lines of code.
**Findings**: Files like `Sections.tsx` (~44KB) and `Subjects.tsx` (~42KB) are dangerously large.
**Improvement**: Extract logical sub-components into a `src/components/` directory.

### 5. Naming Convention and Glossary Drift
**Rule Violation**: Must use canonical ATLAS surface naming and strict DepEd semantic color coding.
**Findings**: Remnants of `G7`, `G8`, `G9`, and `G10` in `GradeLevelBadge.tsx`. 
**Improvement**: Update to the strict `GR7`, `GR8`, `GR9`, and `GR10` naming convention. 

---

## Identified End-User Facing Visual UX Weaknesses

These are issues that the *actual end-user (scheduler operator)* will see and experience on the screen, directly violating the SMART system design language.

### 1. "Badge Spam" Creating Visual Clutter
**Rule Violation**: The ATLAS guidelines explicitly demand a "calm visual hierarchy" and warn against "badge spam."
**Findings**: In `Subjects.tsx` (specifically inside the Coverage Drawer), there are nested flex containers rendering multiple badges side-by-side for a single subject:
```tsx
<Badge>{coverageSubject.code}</Badge>
<Badge>Rotating</Badge>
<Badge>Term X</Badge>
```
Furthermore, the assigned teachers list maps over grades and renders a `<Badge>` for every single grade level. When viewed by a user, this creates an overwhelming "skittles" effect of colorful pills that degrades readability.
**Improvement**: Condense information into text strings or standard `<p>` tags with muted colors. Reserve the `<Badge>` component only for primary status indicators (e.g., Active vs. Archived). 

### 2. Hiding Critical Operational Info in Tooltips
**Rule Violation**: "Important operational information must not live only in hover state."
**Findings**: In the `Subjects.tsx` coverage drawer, the explanation for a "Rotating Term" is hidden inside a `<TooltipContent>`. Because a scheduler needs to know *why* a subject is rotating to effectively assign teachers, hiding this behind a hover interaction on a tiny `<Info>` icon creates a frustrating experience, especially on tablets where hover is non-existent.
**Improvement**: Use progressive disclosure properly. If term rotation is complex, add an explicit "Term Details" button that opens a `Popover` or `Dialog` with a clear explanation, or simply print the helper text directly on the screen if space permits.

### 3. Highly Dense Table Layouts
**Rule Violation**: Progressive disclosure over dense walls of detail.
**Findings**: The `Subjects.tsx` data table presents 7 columns of dense text ("Subject & Code", "Weekly time", "Room need", "Grades", "Programs and owner", "Status", "Actions"). For schedulers, scanning this matrix requires immense cognitive load. 
**Improvement**: Reduce the table to 4-5 core columns (e.g., Code, Name, Time, Status). Move secondary properties (like allowed specializations, room features, and program scope) into an "Inspect" or "View Details" `<Sheet>` component.

### 4. Overbearing Workflow Alerts
**Rule Violation**: Keep visual hierarchy calm; separate routine actions from destructive/repair work.
**Findings**: In `TeachingLoad.tsx`, the `splitBrainNeedsAttention` alert injects a large, brightly colored `bg-amber-50` banner above the main workspace. While the system needs to warn the user, pushing the primary workspace down disrupts the operator's daily flow.
**Improvement**: Move integrity/repair warnings into a dedicated "Diagnostics & Repair" side-panel or a modal that must be dismissed, rather than permanently altering the vertical layout of the main workspace. Maintain the "No-Scroll Architecture" rule by protecting the main `flex-1 min-h-0` container.
