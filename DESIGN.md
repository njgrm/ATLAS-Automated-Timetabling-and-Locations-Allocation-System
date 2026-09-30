# ATLAS — DESIGN.md

The design system every agent follows when it touches ATLAS UI. Read it before any UI packet. Where it conflicts
with a packet, `docs/plans/operator-decisions.md` wins, then this file, then the packet.

## 1. Who ATLAS is for, and what it must feel like

- **Users:** school schedulers and registrars of a DepEd public high school (Grades 7–10), many of them older and
  mouse-first, plus teachers (`/my`) who read their own schedule. Reference screen: a **1366×768 laptop**.
- **Job:** build, check, and publish the school's class schedule, and show what the system did.
- **Feel:** calm, plain, task-first. A school office tool, not a product showcase. One clear next step per screen.
- **Identity:** "ATLAS is pure communication of what it does." Every automated action shows a receipt.
- **Family:** ATLAS belongs to the **SMART family** of EnrollPro companions (§2). It should look like a sibling
  of SMART, with its own denser scheduling surfaces.

## 2. SMART family identity (the shared look)

Source: `D:/smart-final-capstone` (read-only) and its `SMART DESIGN HANDOFF TO ENROLLPRO, ATLAS, AIMS, and SORT.md`.
For ATLAS the handoff prescribes §2.3 (variable names), §3 (tokens), §4 (components), §5.2 (header chrome) and
§6 (parity QA). ATLAS already has EnrollPro branding, so it does not re-implement SMART's branding pipeline.

### 2.1 Ecosystem rules
- **EnrollPro is the hub.** Branding (primary/secondary/accent, logo, school name), school years and terms flow one
  way from EnrollPro. ATLAS never writes them back. Companion order in "Integrated systems": **AIMS, SMART, ATLAS,
  MRF**. ATLAS is marked "Current system"; the others are disabled until federation.
- **Tenant colour drives the brand.** The EnrollPro primary is applied at runtime (`atlas-client/src/lib/settings.ts`
  writes `--accent`, `--primary`, `--ring`, `--sidebar-*`). Never hard-code the school colour; use `primary` /
  `accent` tokens. Test with a light primary and a dark primary (contrast text flips between `#1f2937` and white).
- **Pixel-grid backdrop.** A faint brand-tinted grid behind the app (80×80 pattern, brand stroke at ~8% opacity).
  ATLAS has it in `AppShell.tsx` (`pixel-grid-app-layout`). Content sits on white cards above it.

### 2.2 Portal chrome (SMART §5.2 — the frozen family header)
| Element | Family spec |
|---|---|
| Sidebar | Fixed left, ~280px (collapsed 70px, `lg` and up), light surface, thin right border, soft shadow. Mobile: drawer. |
| Logo block | School logo tile (white, rounded-lg, 1px border) + school name in brand colour, bold, uppercase, small. |
| Nav groups | Tiny uppercase group labels (e.g. `OPERATIONS`, `MANAGEMENT`), 60% ink. |
| Nav item | **Rounded-full pill**, 14px medium, 20px icon. Active = brand fill + white text + soft shadow. Inactive = ink, hover = white/80. |
| Top bar | Sticky, **h-16**, bottom border. Left: menu button + two lines (tiny uppercase portal name over bold page name). Right: notification bell → **S.Y. badge** → user name + role chip → avatar. |
| Content | `p-4 lg:p-8`, page root `space-y-6`. |

### 2.3 Teacher portal patterns (SMART `/teacher` → ATLAS `/my` faculty portal)
- Nav groups: **OPERATIONS** (Dashboard, Schedule), **ACADEMICS** (class records, attendance), **MANAGEMENT** (My Advisory).
  ATLAS's teacher side mirrors the first group: My Dashboard + My Schedule, nothing a teacher cannot act on.
- Header: translucent white (`bg-white/80 backdrop-blur-md`); role chip tinted with the brand colour ("Teacher").
- **Deadline/urgency banners** use one ladder: info (blue) → warn (amber, dismissible) → urgent (orange) →
  critical (rose, pulsing icon) → overdue (red, expandable detail). Only the mildest level can be dismissed; lock
  and deadline states stay visible.
- **List → detail**: a card list of the teacher's classes opens a full view (ClassRecordsList → ClassRecordView). The
  teacher sees their own things first, with one primary action per card.
- Numbers: one big figure per stat card (`text-2xl font-bold`), a small label above, `tabular-nums`.

### 2.4 Registrar portal patterns (SMART `/registrar` → ATLAS admin/scheduler pages)
ATLAS's scheduler and admin pages are closest to SMART's **registrar** portal: record-keeping, official output,
closing operations.
- Nav groups by **workflow stage**, not by data type: **OPERATIONS** (Dashboard), **OFFICIAL ENROLLMENT** (Section
  Roster), **CLOSING OPERATIONS** (Remedial, EOSY), **MANAGEMENT** (Student Records, Transferees, Former Students,
  School Forms). ATLAS's equivalent stages are School Setup → Teachers and Rooms → Class Schedule → Review and
  Publish → Audit (`components/app-shell/navigation.ts`). Keep that order: it is the scheduler's year.
- Header: **solid white** (not blurred); role chip in blue.
- **Table-first pages**: `PageHeader` (title `text-2xl font-bold tracking-tight`, one-line description, actions on
  the right) → one card holding the toolbar (search + inline filters + actions) and the table → pagination footer
  (hidden at ≤10 rows; 10/25/50/100 per page). Table head: 11px semibold uppercase, wide tracking, muted. Cells:
  `text-sm`, `py-3.5 px-4`, row hover `bg-muted/50`. Empty cells show a faint em dash, never blank.
- **Three table states**, always: loading skeleton shaped like the data, empty state (search-aware: `No results for
  "term"`), error state with a Retry button.
- **Registrar modal language** (SMART `AppModal`): a brand-coloured **icon tile** + title + one-line description;
  body built from `InfoCard`, `StatTile` (tinted, tabular numbers), `AlertBanner` (danger/warning/info), `StepCards`
  (numbered 3-up); footer with one confirm button in the brand colour (red when destructive). Sizes sm/md/lg/xl.
  ATLAS rule on top: dialogs open at about **42rem** centered (decision 10), and there is no second confirmation
  after a review dialog (decision 11).
- **Official forms print exactly.** SMART renders DepEd school forms (SF1/SF5/SF9/SF10) to match the Excel
  templates, outside the token system. ATLAS's printed class, teacher and room programs follow the same rule:
  the print output matches the official template and prints on a white page (Print Reports).
- **Sync freshness is visible.** Registrars see when data last synced (fresh/stale). ATLAS shows EnrollPro term and
  roster freshness the same way, with a plain receipt.

### 2.5 Feedback (family-wide)
- Toasts: **Sonner**, `richColors`, top-right, default 4s; `toast.success / error / info` only.
- Notification bell: badge caps at `9+`, empty state "You're all caught up".
- Errors: page-level error block (destructive icon circle, message, "Try Again"); never a blank screen.
- Loading: skeletons shaped like the content; a spinner only for whole-page loads.

### 2.6 Family drift to NOT copy
SMART's own audit lists drift: raw `zinc`/`blue` in its select, raw `gray` tooltip, hard-coded `#0F1729`/`slate-*`
sidebar chrome, the double `--accent` in its dark block, and the unused `App.css`. Copy the intent (semantic tokens),
not these.

## 3. ATLAS tokens (binding; source `atlas-client/src/index.css`)

Tailwind v4, CSS-first (`@theme`), shadcn-style primitives in `atlas-client/src/ui/`. Use tokens; no raw palette
classes (`gray-*`, `zinc-*`, `slate-*`, hex) in new code except the status colours below.

| Role | Token (HSL) | Use |
|---|---|---|
| Brand | `--accent` 158 64% 29% (runtime-overridden by EnrollPro) → `--primary`, `--ring`, `--sidebar-primary` | primary buttons, active nav, focus rings |
| Brand tint | `--accent-muted` 152 81% 92% | selected rows, active chips |
| Surface | `--background` white, `--card` white, `--muted` 220 14% 96% | page, cards, header bands |
| Ink | `--foreground` 222 47% 11%, `--muted-foreground` 215 16% 42% | text; muted text never below 14px |
| Lines | `--border` / `--input` 220 13% 91% | 1px borders |
| Danger | `--destructive` 0 84% 44% | errors, destructive actions |
| Warning | `--warning` 35 76% 33%, `--warning-muted` 44 92% 96%, `--warning-border` 41 78% 50% | "needs review" |
| Radius | `--radius` 0.75rem (sm .6×, md .8×, lg 1×, xl 1.4×) | buttons/inputs `rounded-lg`, cards/dialogs `rounded-xl`, chips `rounded-full` |
| Shadow | SMART ladder `--shadow-xs … --shadow-xl`, `.shadow-soft` | cards `shadow-soft`; menus/dialogs `shadow-lg` |
| Type | `--font-sans` Inter Variable; `--font-heading` Poppins 600 | body Inter; headings Poppins |
| Breakpoint | `--breakpoint-wide` **85.375rem (=1366px)**, never `1366px` (Tailwind orders units as strings) | the header collapse |

**Font note:** SMART uses **DM Sans**; ATLAS uses Inter + Poppins. Moving ATLAS to DM Sans is an open operator
decision. Do not change fonts inside a feature packet.

Status colours (the only sanctioned raw palette): success emerald-600, warning amber, danger red-600, info blue,
matching SMART's banner ladder. Always pair colour with an icon and a word; colour is never the only signal.

## 4. Layout rules (from ATLAS incidents)

1. **1366×768 is the test screen.** Everything important fits without horizontal scroll; the /timetable grid is the
   one sanctioned horizontal scroller, inside its own container.
2. **Headers stay short.** The /timetable header is at most two rows. A notice goes on its own line under the header
   (`timetable-simple-header-change-row`), never in the filter row. Filters never get pushed to the right edge.
3. **No clipping or "…" on names, labels, or dropdown options.** Names wrap (`flex-wrap`, `break-words`); `truncate`
   only on decorative secondary text, and then with a `title`.
4. **Grids and printable areas sit on white** (`bg-white`), not on the pixel-grid backdrop.
5. **Filters are inline and look the same on every page** (`ui/filter-bar.tsx`); no "More filters" overflow menus.
6. **Chips never wrap inside themselves**: `shrink-0 whitespace-nowrap`; long reasons go in the tooltip.
7. **One primary button per view**, brand-filled; everything else outline or ghost.
8. **Page ownership:** shared chrome (app shell, navigation, shared header helpers) changes only through the manager.

## 5. Communication rules (the ATLAS voice)

- **Plain words for older schedulers.** "5 classes need a time slot", not codes or internal terms. No jargon, no raw
  IDs such as `TLE_7` when a subject name exists.
- **Less is more.** Aim for ≤ 25 words before the primary action in a dialog; details go behind "Details".
- **One prominent number** per status, with an icon and colour. Don't write paragraphs of status.
- **Receipts for every automated action** (generate, auto-assign, sync, publish, preferences used): what was done,
  how many, what wasn't done and why, and the next step, shown on the action page and the affected page.
- **Clickable looks clickable**: a button shape (border or fill), a verb or chevron, a pointer, hover and focus
  states. Read-only figures must not look pressable.
- Sentence case for labels; the page name matches the sidebar label (e.g. "Print Reports" in both).
- Dates `en-PH` long form; term labels from EnrollPro (`Term 1`, or the school's own labels).

## 6. Components (use these before writing new ones)

`atlas-client/src/ui/`: accordion, badge, breadcrumb, button, card, checkbox, confirmation-modal, dialog, dropdown-menu,
**filter-bar**, **filter-picker**, input, label, popover, resizable, scroll-area, **searchable-select**, select,
separator, sheet, sidebar, skeleton, slider, switch, tabs, textarea, tooltip. Page scaffolding: `app-shell/PageHeader`,
`smart/SmartPageShell`, `smart/AccessibleInfo` (help icon; should open on click — backlog item). A new shared primitive goes in `src/ui/`,
owned by the manager.

## 7. Before you report a UI change (checklist)

- [ ] Screenshot of the changed screen at **1366×768** (and 375px wide if the page is mobile-facing), attached to the
      report.
- [ ] No clipping, "…", overflow, wrapped chips, or a third header row; `npm run test:encoding` (repo root) passes (no mojibake
      like "ΓÇö").
- [ ] Tokens only (no new raw palette or hex); brand still correct with a light and a dark EnrollPro primary.
- [ ] Words counted: the dialog is under 25 words before its action; there is one primary button.
- [ ] A receipt exists for any automated action; clickable things look clickable.
- [ ] Run the design audit (`/impeccable audit` in OpenCode) on the changed screen and fix what it finds, or say why
      not.
