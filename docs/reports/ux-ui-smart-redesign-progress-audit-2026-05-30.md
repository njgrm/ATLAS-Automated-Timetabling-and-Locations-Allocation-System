# UX/UI SMART Redesign Progress Audit - 2026-05-30

## Verdict

Overall redesign status: **NO-GO for full SMART redesign closure**.

The shell and dashboard work made real progress. HNHS/Tailnet maroon tokens are now active, the admin dashboard reads from runtime phase evidence, and true mobile faculty pages do render the mobile app shell with bottom navigation.

The remaining blockers are narrower but still important: public and faculty schedule pages still expose schedule-version/reference text in the main path, public schedules still use a native `<details>` control, faculty room requests still ship browser `title` attributes on controls, faculty mobile pages create global page scroll, and the current design/prompt docs still contain stale emerald-first guidance that conflicts with the newer token-driven SMART contract.

## Evidence Sources

- Live Tailnet URL: `https://njgrm.buru-degree.ts.net/`
- SMART reference branch: `LATEST-SMART-PRE-ORAL-DONE-29-05-2026-4-25PM`
- SMART reference commit: `408f60c LATEST SMART (PRE ORAL DONE) 29/05/2026 4:25PM`
- Shared browser desktop audit screenshots: `qa-artifacts/playwright/20260530-ux-audit-progress-*.png`
- Headless true-mobile screenshots: `qa-artifacts/playwright/20260530-headless-*.png`
- Headless true-mobile viewport proof: `innerWidth=390`, `matchMedia('(max-width: 1023px)').matches=true`
- Shared browser limitation discovered during audit: requested `390px` viewport stayed at `innerWidth=1128`, so the earlier shared-browser mobile captures were desktop-width evidence and should not be used as mobile proof.

## Confirmed Progress

### Shell And Global Identity

- `AppShell.tsx` is below the 1000-line ceiling and now functions as a shell orchestrator.
- True mobile faculty pages show the hamburger top bar and `FacultyMobileBottomNav`.
- Desktop shell uses grouped navigation and HNHS school identity.
- Route transitions include reduced-motion handling.
- HNHS token proof remains valid: `--primary = 360 75% 30%`, `--accent = 360 75% 30%`.

Remaining shell prompt gap: prompt 01 required `MobileTopBar.tsx`, `SchoolYearSelector.tsx`, `AppRouteTransition.tsx`, and `UserMenu.tsx`; source currently implements some of that behavior inline or under different filenames. This is not a user-facing blocker by itself, but it means prompt-compliance is partial.

### Admin Dashboard

- Dashboard now shows HNHS maroon identity instead of fixed SMART green.
- Dashboard lifecycle is runtime-derived and currently shows Review phase and blockers.
- Mobile dashboard at 390px renders the mobile top bar, hides the sidebar, and avoids global scrollbar in the headless audit.
- Desktop `/teachers` preserved the no-scroll table architecture in the shared-browser audit.

Dashboard status: **mostly aligned**, with only visual polish risk. It should not be the next major redesign target unless new screenshot evidence shows a concrete regression.

### Faculty Mobile Shell

The first shared-browser pass falsely suggested mobile faculty pages still rendered desktop navigation. A targeted check showed the shared browser was actually `innerWidth=1128`. Headless Playwright at `390x844` confirmed:

- `/my`: bottom nav visible, sidebar hidden.
- `/my/schedule`: bottom nav visible, sidebar hidden.
- `/my/preferences`: bottom nav visible, sidebar hidden.
- `/my/room-preferences`: bottom nav visible, sidebar hidden.

This means the faculty mobile shell is materially working. The remaining mobile failures are page-level polish and layout rules, not a missing mobile shell.

## Findings

### Critical - Public And Faculty Schedule Pages Still Expose Technical Schedule Version Text

Routes:

- `/public/schedules`
- `/my/schedule`

Evidence:

- Public schedule mobile audit: `rawVersionText=true`, `nativeDetailsCount=1`, visible copy includes `Schedule version` and `reference #126`.
- Faculty schedule mobile audit: `rawVersionText=true`, visible copy includes `Version reference #126`.
- Prompt 02 GO condition explicitly requires no first-viewport faculty/public copy to expose raw run/source IDs.

Impact:

- This keeps the public/student and faculty schedule surfaces feeling like an internal scheduler/debug view instead of a SMART-family user surface.
- Low-tech users do not need run references to understand whether a schedule is official.

Required correction:

- Remove schedule-version/reference copy from the main path.
- If version provenance remains useful, move it behind a shadcn/Radix disclosure pattern with plain copy such as `Schedule details`, not native `<details>` and not `reference #126` in the first viewport.

### Major - Public Schedule Still Uses Native `<details>`

Route: `/public/schedules`

Evidence:

- True-mobile audit: `nativeDetailsCount=1`.
- Visible screenshot shows `Schedule version` as a native disclosure row.

Impact:

- Violates the ATLAS frontend rule against raw/native disclosure controls for user-facing explanations.
- Looks less like SMART and less like the local shadcn/Radix control language.

Required correction:

- Replace native `<details>` with an approved primitive such as `Popover`, `HoverCard`, `Accordion`, or a controlled shadcn-style disclosure component.
- Keep the public first viewport search-first and nontechnical.

### Major - Faculty Room Requests Still Carries Desktop/Technical Control Artifacts

Route: `/my/room-preferences`

Evidence:

- True-mobile audit: `titleAttrs=["Zoom Out", "Zoom In", "Reset"]`.
- Screenshot shows the tour/modal overlay active on first mobile load, dimming the page and blocking the primary task.
- `globalScrollbar=true` on the mobile audit.
- Fixed bars include both the bottom nav and `Choose Target`, increasing bottom-of-screen competition.

Impact:

- Native `title` attributes are banned in the design rules; use `Tooltip`/accessible labels instead.
- First-load tutorial overlay makes the mobile app feel less direct and less SMART-like because the user cannot immediately act.
- Competing fixed bottom elements may crowd small screens.

Required correction:

- Replace `title` attributes with approved tooltip/aria-label patterns.
- Make the tutorial opt-in or persistently dismissible rather than blocking first use.
- Recheck bottom action spacing against the faculty bottom nav and safe-area inset.

### Major - Faculty Mobile Pages Create Global Scroll

Routes:

- `/my`
- `/my/schedule`
- `/my/preferences`
- `/my/room-preferences`

Evidence:

- True-mobile audit reports `globalScrollbar=true` for all four faculty mobile routes.
- Public and admin mobile routes did not report global scroll in the same pass.

Impact:

- Violates the no-scroll architecture expectation for app-like shells unless the page intentionally owns the single scroll region.
- In practice, it risks hiding content under the bottom nav or creating browser-chrome scroll behavior instead of a native-app feel.

Required correction:

- Ensure faculty mobile content scrolls inside the intended `flex-1 min-h-0 overflow-auto` region.
- Keep bottom nav and fixed action bars outside the scrolling content and reserve padding for both.

### Major - Faculty Preferences Copy Still Surfaces Sensitive Support Terms Too Loudly

Route: `/my/preferences`

Evidence:

- True-mobile text sample still includes `Pregnancy support` as a visible support heading.
- Prompt 02 required privacy-aware language and avoidance of sensitive terms as loud headings.

Impact:

- The surface is much improved, but this wording can feel too exposed on a phone in a shared school environment.

Required correction:

- Reword sensitive categories into calmer, optional support language.
- Keep detailed explanations visible only after explicit selection or in helper text.

### Major - Faculty Dashboard Desktop Uses Hover-Only Row Actions

Route: `/my` desktop

Evidence:

- Source-level inspection found `Request move` links hidden by `opacity-0 group-hover:opacity-100` in `DesktopDashboardLayout.tsx`.

Impact:

- Keyboard and touch users can miss the action.
- Violates the faculty usability-first rule that important actions must be visible and obvious.

Required correction:

- Make row actions visible, keyboard-focus visible, or move them into an explicit action column/menu using project primitives.

### Major - Prompt And Design Docs Are Now Stale

Files:

- `docs/DESIGN.md`
- `docs/prompts/ux-rehaul-01-shell-and-global-identity-refactor-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-02-faculty-public-smart-aligned-one-shot-prompt.md`

Evidence:

- `docs/DESIGN.md` still defines the primary brand color as emerald and the page wash as a fixed emerald gradient.
- Prompt 01 still says active nav should use `theme/emerald accent`.
- Prompt 02 still says `Use emerald/theme accent for primary actions and active state`.
- Newer correction prompt 05 superseded this direction by requiring token-driven SMART identity and HNHS maroon on Tailnet.

Impact:

- New agents can reintroduce the exact over-green mistake the user already corrected.
- Prompt 01/02 should not be reused as-is.

Required correction:

- Update `docs/DESIGN.md` and prompt sequence language so SMART-family means token architecture, surface rhythm, typography, and interaction pattern.
- Preserve emerald only for universal success/correctness states, not school brand identity.

### Minor - Prompt 01 Extraction Checklist Is Only Partially Met

Evidence:

- `MobileNavigationDrawer.tsx`, `AppSidebar.tsx`, `FacultyMobileBottomNav.tsx`, and `navigation.ts` exist.
- `MobileTopBar.tsx` does not exist.
- Some shell behavior remains inline inside `AppShell.tsx`.

Impact:

- Current line count is safe, but future shell edits may drift back toward a large orchestrator.

Required correction:

- Extract the remaining shell pieces when the shell is touched again, especially the mobile top bar.

## Route Status Matrix

| Route | Status | Notes |
|---|---|---|
| `/` dashboard | Mostly aligned | Token-driven, runtime phase, no mobile global scroll in headless proof. |
| `/teachers` | Mostly aligned | Desktop no-scroll table preserved. |
| `/public/schedules` | NO-GO | Search-first improved, but native `<details>` and schedule-version/reference copy remain. |
| `/my` | Partial GO | True mobile app shell works; desktop hover-only row actions and mobile global scroll remain. |
| `/my/schedule` | NO-GO | Mobile day cards render, but raw version/reference text remains. |
| `/my/preferences` | Partial GO | Mobile shell works; privacy wording and mobile global scroll need another pass. |
| `/my/room-preferences` | NO-GO | Mobile step flow exists, but first-load overlay, title attrs, fixed action crowding, and global scroll remain. |

## Prompt Freshness Recommendation

Do not run prompt 01 or prompt 02 again verbatim.

Use a smaller follow-up prompt that targets only the remaining blockers:

1. Remove technical schedule provenance from public/faculty main paths.
2. Replace native `<details>` and `title` attributes with approved primitives.
3. Fix faculty mobile global scroll and bottom-action spacing.
4. Make room-request tutorial opt-in or non-blocking.
5. Reword privacy-sensitive preference labels.
6. Update `docs/DESIGN.md` and the prompt sequence so token-driven SMART identity is authoritative.

## Evidence Artifacts

- `qa-artifacts/playwright/20260530-headless-faculty-my-mobile.png`
- `qa-artifacts/playwright/20260530-headless-faculty-schedule-mobile.png`
- `qa-artifacts/playwright/20260530-headless-faculty-preferences-mobile.png`
- `qa-artifacts/playwright/20260530-headless-faculty-room-requests-mobile.png`
- `qa-artifacts/playwright/20260530-headless-public-schedules-mobile.png`
- `qa-artifacts/playwright/20260530-headless-admin-dashboard-mobile.png`
- `qa-artifacts/playwright/20260530-ux-audit-progress-admin-dashboard-desktop.png`
- `qa-artifacts/playwright/20260530-ux-audit-progress-admin-teachers-desktop.png`
- `qa-artifacts/playwright/20260530-ux-audit-progress-public-schedules-desktop.png`

## GO / NO-GO

Prompt 01 shell/global identity: **conditional GO** for user-facing shell behavior, **partial GO** for extraction checklist.

Prompt 02 faculty/public SMART alignment: **NO-GO** until public/faculty schedule metadata, native controls, room-request mobile polish, and faculty mobile scroll behavior are corrected.

Phase closure: **NO-GO**. Current evidence supports a focused repair prompt, not further broad redesign.