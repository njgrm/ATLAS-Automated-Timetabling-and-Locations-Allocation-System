# Faculty UX Expert Hardening Pass (Mandatory for “High-Bar” Completion)

Use this prompt when prior faculty UX work is **minimal, regressive, or below product bar**. It supersedes lightweight “shared component only” passes. Execute **after** reading `docs/prompts/faculty-ux-ui-refactor-execution-prompt.md`; this document **adds** non‑negotiable quality, Playwright evidence, Context7 design bar, room-request **map/building** polish, and **live conflict inspector** on **mobile and desktop**.

---

## Bar You Must Meet (Non‑Negotiable)

- **Expert / product-grade UX**: faculty flows must feel intentional, calm, and guided—not utilitarian patches. If the result still feels like “the same page with new banners,” treat the pass as **failed**.
- **Visible improvement**: every merged slice must produce **observable** layout, hierarchy, or interaction upgrades a non‑technical teacher can name (“I know what to tap next”).
- **No regression**: if any surface is worse (density, scroll traps, hidden primary actions, broken map/building pickers), **revert or fix** before claiming progress.

---

## Required References (Read Before Coding)

| Priority | Document |
|----------|----------|
| Authoritative | `docs/DESIGN.md` |
| Patterns | `docs/DESIGN-INSPIRATION.md` |
| Faculty blueprint | `docs/phases/faculty-mobile-wireframe-spec.md` |
| Execution plan | `docs/phases/faculty-ux-ui-refactor-execution-plan.md` |
| Context7 policy + IDs | `docs/context7-library-map.md` |

## Context7 — Expert Design Standards (Mandatory Preflight)

Before writing UI code:

1. Open `docs/context7-library-map.md` and resolve IDs for **at least**:
   - **Radix / shadcn** (Sheet, Dialog, ScrollArea, focus management) — implementation quality for drawers, sheets, and non–nested-scroll layouts.
   - **Motion** (`motion` / Framer Motion) — drawer/step transitions without layout jank.
   - **One** of: **Atlassian Design System** (guided flows), **Shopify Polaris** (empty states + action hierarchy), **Carbon** (responsive density) — for **design rationale**, not pixel‑copying.
   - **WAI-ARIA Authoring Practices** — keyboard, focus order, and sheet/dialog accessibility.
2. Pull **2–3** concrete references per concern (layout, motion, a11y).
3. In your summary, include **Applied pattern → surface → user outcome** for each major change.

**Automatic NO‑GO** if Context7 preflight block is missing or generic (“looked at React docs” without IDs and citations).

---

## Mandatory Skills (Order)

1. `atlas-design-system-enforcer`
2. `atlas-ux-audit-gate`
3. `atlas-faculty-usability-first`
4. `atlas-copy-and-microcopy`
5. `atlas-offline-realtime-reliability`
6. `atlas-shared-browser-qa`
7. `atlas-phase-gate-enforcer`

---

## Hardening Scope — `/my/room-preferences` (Map, Building, Conflict)

### Direction (keep)

- **Map view** and **building view** for choosing rooms on **mobile** are the right direction; **do not remove** them.

### Implementation (must improve)

1. **Map view**
   - Legible on small screens: pinch/zoom, tap targets, labels, and selected state must be obvious.
   - No dead-end states: loading, empty campus, and errors need plain-language recovery (see `DESIGN.md`).
2. **Building view**
   - Clear building → room hierarchy; search/filter must remain usable one‑handed on mobile.
3. **Live conflict inspector — mobile AND desktop**
   - Faculty must see **request-scoped** conflict preview **without** relying only on a hidden sheet on mobile.
   - **Mobile**: persistent **inline** or **docked** panel (e.g. collapsible summary + expand to full inspector), or a **bottom sheet** that defaults **open** when a target is selected and preview is available—**not** only after submit.
   - **Desktop**: conflict inspector remains visible in the workspace (existing multi‑pane direction is OK; **strengthen** so hard vs soft and “what to do next” are always visible when preview exists).
   - Reuse or extend `ConflictInspector` / preview payloads; **do not** duplicate incompatible conflict UX between mobile and desktop.

### Room-request steps

- Preserve **3‑step** mobile wizard semantics: **Select class → Choose target → Review & submit**.
- Ensure **step chips** and **primary CTA** stay visible; avoid banner stacks that push the CTA below the fold.

---

## Hardening Scope — `/my` and `/my/preferences`

- **`/my`**: Pin header stack must not bury the **dominant CTA** on mobile; consolidate notices or collapse to a single “Status” entry point if needed.
- **`/my/preferences`**: Step indicator must match real state (e.g. step 1 active while editing slots); sticky Save/Submit must remain obvious on long forms.

---

## Playwright — Full Faculty Screenshot Matrix (Repo Tooling)

You **must** run the **project Playwright** faculty matrix (not only Copilot’s native browser, if any). This repo provides:

```bash
npm run test:visual:install
npm run dev
# separate terminal:
npm run test:visual:faculty
```

- Spec: `qa-artifacts/playwright/specs/faculty-full-matrix.spec.ts`
- Outputs: `qa-artifacts/screenshots/faculty-ux-refactor/` (plus optional snapshot dir if `PLAYWRIGHT_ASSERT_SNAPSHOTS=1`)

**Required for gate:**

- All three routes × three viewports (**desktop**, **mobile-portrait**, **mobile-landscape**) **after faculty login**.
- Copy the best frames into evidence or attach Playwright report zip path in `docs/verification/evidence-log.md`.

**Optional baseline lock‑in:**

```bash
set PLAYWRIGHT_ASSERT_SNAPSHOTS=1
npm run test:visual:faculty
```

(Commit baselines only when UI is stable.)

---

## Manual Shared-Browser QA (Must Follow Instruction Files)

When running **manual** shared-browser QA, agents **must**:

1. Treat as required reading **before** testing:
   - `docs/DESIGN.md`
   - `docs/DESIGN-INSPIRATION.md`
   - `docs/context7-library-map.md`
2. Use **Context7** during QA when validating patterns (e.g. sheet focus trap, scroll containment) against current library docs.
3. Apply **`atlas-shared-browser-qa`**: desktop + mobile portrait + landscape; screenshot naming `YYYYMMDD-role-route-viewport-step-result.png` under `qa-artifacts/screenshots/faculty-ux-refactor/`.
4. Explicitly check: **map**, **building**, **list** room pickers; **conflict inspector visible** when preview exists; offline queue states.

---

## Verification Gates

### Automated

- `npm --prefix atlas-client run build`
- Relevant server tests (e.g. `npm --prefix atlas-server run test:phase2-regression` or phase scripts for touched APIs)
- **`npm run test:visual:faculty`** — **must PASS** (screenshots generated; snapshot assert optional)

### Manual / evidence

- Update `docs/verification/evidence-log.md` with:
  - Playwright command + result
  - Manual checklist outcome vs `DESIGN.md` / wireframe spec
  - Before/after notes if replacing subpar UI

---

## GO / NO‑GO (Stricter Than Prior Prompts)

- **NO‑GO** if Playwright faculty matrix was not run or artifacts are missing.
- **NO‑GO** if conflict inspector is sheet‑only on mobile with no “live” visibility during target selection.
- **NO‑GO** if map/building pickers are unchanged or still subpar with no measurable UX fix.
- **NO‑GO** if changes are primarily copy/component swaps without structural or interaction improvement.
- **GO** only if a neutral reviewer can complete **one room request** on **phone and desktop** without confusion, and screenshots prove it.

---

## Output Required From Implementer

1. Context7 preflight (IDs, 2–3 refs each, applied patterns).
2. File-by-file summary emphasizing **layout / interaction** changes, not imports.
3. Playwright: command, pass/fail, paths to screenshots.
4. Manual QA notes aligned with `DESIGN.md`.
5. Evidence log excerpt + **GO / NO‑GO**.
