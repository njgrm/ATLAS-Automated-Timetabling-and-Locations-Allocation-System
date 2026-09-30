# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Schedulers and registrars** of a DepEd public high school (Grades 7–10). Many are older and mouse-first, and
  work on a school-office laptop (1366×768). Their job: set up the school year, assign teaching loads, generate and
  hand-fix the class schedule, check it, publish it, and print official programs.
- **Teachers** read their own schedule and set preferences in the faculty portal (`/my`).

## Product Purpose
ATLAS builds the school's class schedule from EnrollPro's sections and terms and the school's teaching loads,
explains every problem in plain words, and publishes and prints the official class, teacher and room programs.
Success: a scheduler publishes a correct timetable without outside help and always knows what the system did.

## Positioning
The scheduling companion in the SMART family of EnrollPro systems (EnrollPro, SMART, ATLAS, AIMS, MRF). It
schedules from the same school data SMART grades from, and shows what it did at every step.

## Operating Context
- EnrollPro is the hub: school years, terms, sections, rosters and branding flow one way into ATLAS (read-only).
- The yearly flow: School Setup → Teachers and Rooms → Class Schedule → Review and Publish → Audit.
- Official outputs are printed DepEd-style programs (class, teacher, room) on white paper.

## Capabilities and Constraints
- Generator with manual draft editing (move, swap, place unassigned classes, undo), a publish gate of must-fix
  items, and warnings.
- Locked product decisions live in `docs/plans/operator-decisions.md`; the visual system lives in `DESIGN.md`.
- Live data is school test data; publishing needs the operator's approval.

## Brand Commitments
- Tenant branding (primary colour, logo, school name) comes from EnrollPro at runtime. Never hard-code a school colour.
- Visual parity with SMART (see DESIGN.md §2). Fonts are Inter + Poppins today; a move to SMART's DM Sans is an open decision.
- Voice: plain, short, calm. Receipts for every automated action.

## Product Principles
1. Communication over decoration: the scheduler must always see what the system did, how many, and what's next.
2. Less is more: one primary action and one prominent number per view; details behind "Details".
3. Nothing breaks at 1366×768: no clipping, no overflow, no third header row.
4. Calm and restrained, never flashy: no bold/delight/overdrive treatments, decorative motion, or novelty visuals.
5. The same controls look and behave the same on every page.

## Accessibility & Inclusion
Older users: text at least 14px for anything they must read, strong contrast, clickable things that look clickable,
colour never the only signal, and keyboard focus visible.
