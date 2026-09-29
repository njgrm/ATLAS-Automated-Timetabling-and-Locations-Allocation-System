# A7 c6 — layout note (written before any JSX, per the AGENTS.md design judgement gate)

## The user and the feeling

An older, mouse-first school scheduler walks into a live demo. They must always
know **where the setup stands** and **what to do next**, in this order:

School Year -> Subjects -> Teachers -> Teacher Concerns -> Teaching Load ->
make the Timetable -> look up & print schedules.

Success feels like: they glance at the Dashboard, see **one** clear next step,
and every story step is reachable from the side menu by its plain noun. Calmer
and shorter than today — not a denser status board.

## The problem with today's Dashboard (counted, not guessed)

The page carries **four** independent status systems over the same facts:

1. the hero (page name + up to three chips + "Open Timetable" button),
2. the **Your next step** card,
3. the **Scheduling lifecycle** card (current phase, a *second* copy of the
   next-step CTA, a "Before generation" 4-tile blocker grid, a 5-bar phase rail),
4. the **Setup readiness** card (10 rows, a duplicated count badge, and a
   mobile-only "View all setup steps" toggle),
5. plus the 4 stat tiles and the campus card.

System 3 is the problem: **every fact it shows is already shown by system 2 or
system 4**, and it adds the worst jargon on the page ("Phase 3/5", "Algorithm
run", "Publish locked"). It also renders the next-step CTA a second time, so
the page has two competing primary actions.

## What stays

- The **hero** (page name, one status chip set, "Check for updates"). Accepted
  tests pin the hero `<h1>`, the subtitle sentence, and the one `overflow-auto`
  region — the hero is not in scope for surgery.
- The **Your next step** card — this is the one obvious next step, and it
  becomes the top of the story.
- The **Setup readiness** card — this is the count + what is not ready.
- The 4 stat tiles (they carry the *numbers* the checklist does not).
- The campus readiness card (A9 c3 owns it).

## What goes

- **The whole "Scheduling lifecycle" card.** Every fact it carried survives:
  "where am I" = the next-step title; "what's blocking" = the readiness list
  rows `Subjects have teacher coverage`, `Buildings and rooms ready`,
  `Timetable generated and reviewed`, `Schedule published`; the 5-phase rail is
  a third status language and goes. This deletes ~85 lines of JSX, one
  duplicate CTA, the "Phase N/5" badge, and four duplicate blocker tiles.
- **The hero's "Open Timetable" button.** The story puts "make the Timetable"
  sixth. A permanent primary button to `/timetable` in the hero competes with
  the one next step, and `§8` allows one primary action per region.
- **The duplicate readiness count.** The header said "6 of 10 ready" *and* a
  "6/10" badge. One count survives, in the header line.
- **The duplicate `readinessSourceMessage` line** in the next-step card. The
  source-decision sentence is already the hero chip's popover and the degraded
  banner's body. One status per fact.
- **The mobile-only "View all setup steps" toggle** and its `useState`. It
  existed only to un-hide rows 4+, which the not-ready-first structure no
  longer needs.

## What moves behind a disclosure

- **The done readiness rows** move under a `@/ui` Accordion trigger reading
  "6 already done". This is the subtraction that pays for the new "not ready"
  list: in the not-ready state the card shows 4 named links instead of 10 rows;
  in the ready state it shows "Nothing left to do" and 0 rows.
- **Constraint weights / policy tuning** move under an "Advanced" fold on
  `/timetabling/how-it-works` (`@/ui/accordion`, never a raw `<details>`).

> **Round 2 correction (QA F1b).** Only the ALREADY-DONE rows may sit behind a
> disclosure. The outstanding names are the rows directly under the header,
> expanded and visible, each one a link to the page that fixes that step — that
> is what the packet asked for, and hiding them behind a click would be worse
> than the defect this note set out to fix.

## What the count now says

The header is the count plus how many steps are outstanding plus how many ATLAS
could not read: "1 of 10 ready · 6 steps to go · 3 ATLAS could not check". It
does **not** enumerate the names. Round 1 did, and at 1366x768 that was seven
lines of ALL-CAPS that pushed the actionable rows to the viewport edge and
repeated every name as a row immediately below (QA F1).

**A step whose reading never arrived is a third state** (QA F2). It is not done
and it is not outstanding work: the data established only that it could not be
read. Those rows get their own visible list, their own honest wording, and no
amber next-task ring. Before this correction an unresolved count was promoted
into "not ready", so a screen could read "NOT READY: TIMETABLE MADE AND CHECKED"
beside "Schedule is published" — which tells an older scheduler their published
timetable is broken when the truth is that ATLAS does not know.

## Words that change (plain, and never a claim the data does not support)

| Today | After | Why |
| --- | --- | --- |
| `Hard-violation count unavailable` | `ATLAS could not count the problems that must be fixed. Open the timetable to check.` | says what is unavailable **and** what to check |
| `Hard-violation count is unavailable — open the timetable to confirm` | same plain sentence | one wording, one place |
| `Derived demand prepared (input milestone)` | `Classes needed are worked out` | plain words; the hint keeps the real numbers and still says it is a starting point, not the finished timetable |
| `N subject-section pairs · M sessions — inputs only, not final generation approval` | `N classes · M lessons a week. A starting point — you still check the timetable before it goes out.` | same truth, no jargon |
| `Constraint weights` / `(0–100)` | moves under **Advanced** | technical tuning |
| `soft-violation score` | `how many preferences the draft could not meet` | the packet's exact wording |
| `COMMIT` | `Apply this change` | the packet's exact wording |

## Side menu (story order)

`School Year` -> `/admin/year-setup` joins `setupNav` **first** (before
Subjects), `adminOnly: true` — which is exactly `AdminYearSetup`'s own
`ADMIN_ROLES = {admin, SYSTEM_ADMIN, officer}` guard, so nav visibility and page
authority agree. The lookup/print entry is relabelled **"Look up & print
schedules"**; its `to` (`/schedules`) is not a route-target change. The
**Timetable** entry is not touched: A2 c13 has ruled that "Class Schedule" stays.

## §8 self-check

- No native `<select>`, no raw `<details>`, no raw unstyled `<button>`: the two
  folds are `@/ui/accordion`.
- **No page-local `className` that changes a `@/ui` primitive's look.** The
  `AccordionTrigger`s carry **layout classes only** — `py-3` on the Dashboard,
  `px-6 py-4` on How Scheduling Works. Round 1 briefly added typography and
  colour overrides (`text-sm font-semibold text-muted-foreground` and
  `text-sm font-bold text-foreground`) to those two triggers; QA F4 caught that
  this gave two disclosures two extra looks that differ from each other and from
  every other `AccordionTrigger` in the product. Both overrides are removed, so
  both triggers render the primitive's own `text-xs font-medium` base. A bolder
  disclosure, if one is ever wanted, belongs in `ui/accordion.tsx` as a variant
  so every page gets it.
- Picker primitive: no new picker is introduced.
- Header budget: unchanged hero (one row of title + chips + one action).
- File size: `Dashboard.tsx` is **975 lines** on this correction and was **918**
  at base `955d2e7a` — a small net *increase*, not the 966 -> "well under 1000"
  this note originally claimed (that 966 was a miscount; QA measured the real
  base as 918 and measured three methods). The honest statement is about
  **visible chrome, not line count**: an entire card, a hero button, a
  duplicated status line, a duplicated count badge, a 10-row always-expanded
  list, a mobile-only toggle and its `useState` are all gone, replaced by a
  counted header, an outstanding list, a "could not check" list and a collapsed
  done list. `HowItWorks.tsx` is 344 lines. Both are under the 1000-line cap.
- No-scroll architecture: the root and the single `overflow-auto` region are
  untouched (pinned by `a3-c4-dashboard-one-name-no-scroll`).
