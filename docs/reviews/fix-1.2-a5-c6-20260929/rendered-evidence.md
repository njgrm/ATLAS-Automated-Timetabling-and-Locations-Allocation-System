# A5 c6 — fix-1.2 items 24.2 / 35.1 / 23.2 / 17.2 — rendered evidence

Lane A5, 2026-09-29. Candidate `b4ad75d6` over base `7d008db7`, branch
`work/a5-c6-fix12-20260929`, worktree `E:/ATLAS-worktrees/lane-a5-c6-fix12`.

## WHAT THIS EVIDENCE IS, AND WHAT IT IS NOT

This file now has **two** sections of evidence, in this order:

1. **REAL STAGING DATA** (the deciding evidence) — the actual `/teachers` and
   `/subjects` pages, signed in through the dev server's `/__dev/staging-login`
   (which authenticates against the **staging** API on `:5101` server-side), at
   1366x768, origin `http://127.0.0.1:5255`. See "REAL STAGING DATA" below.
   This is what the packet asked for and it closes all four items.
2. **ISOLATED** (the earlier pass, kept because it is what proved the F1
   scrollback case) — the real shared primitives mounted in a synthetic harness.
   A real browser at 1366x768 against a loopback preview of this candidate.

**A correction worth keeping.** The isolated pass originally reported the
staging rows BLOCKED because this session is denied `read` on
`D:\ATLAS-runtime-config\atlas-staging-qa.env`, and a credential-relay workaround
was rejected by the same policy. That reasoning was sound but it was the wrong
conclusion: **the staging QA env file is not needed at all.** The dev server
serves `/__dev/staging-login`, which signs in to staging server-side and
redirects to `/` — documented in `docs/handoffs/lane-c-to-a2.md` and stated in the
agent operating rules. Reaching for the credential file first cost about twenty
minutes and would have produced a false "blocked". **If a preview needs a
staging session, use `/__dev/staging-login`; do not read the env file.**

The harness files (`atlas-client/a5c6-harness.html`, `atlas-client/a5c6-harness.tsx`)
are **untracked scratch and were never committed** (`git ls-files` does not know
them, so they cannot travel a merge). QA round 2 caught this file claiming they
"were deleted after this pass" while they were still on disk; the claim was
false at the time it was written, and the files are removed at the close of the
cycle. Consequence worth stating plainly: **the renders are not reproducible from
the committed tree** — re-creating the harness is part of the work, not a
checkout away.

**A trap worth recording:** the first capture came out **completely unstyled** —
the harness had never imported `@/index.css`, so Tailwind never processed a
single utility class. The page "rendered" and every visual judgement taken from
it would have been worthless. `import '@/index.css'` fixed it. A proof artefact
must be checked for discriminating power before it is believed.

## 24.2 — the header action label

`a5c6-1-pills-chips.png`, green primary button, one line, not clipped:

> `+ Create temporary teacher (Teacher X)`

A **literal capital X**. The rendered button text is byte-identical to the
operator's string; no roster number appears.

## 35.1 — the five /teachers quick-filter helpers

Rendered at 1366x768. Measured on the visible painted node (not Radix's 1x1
measurement duplicates, which are a real measurement trap — the first pass
grabbed one and reported `whiteSpace: nowrap`):

| Pill | Bubble w | Lines | Full text painted | Clipped | h-scroll |
|---|---|---|---|---|---|
| No subjects assigned | 341 | 1 | yes | no | no |
| Above weekly max | 384 | **2** | yes | no | no |
| No sections assigned | 267 | 1 | yes | no | no |
| Temporary teachers | 384 | **2** | yes | no | no |
| All teachers | 289 | 1 | yes | no | no |

Computed style on the live bubble: `white-space: normal`,
`overflow-wrap: break-word`, `max-width: 384px` (`md:max-w-sm` at this
viewport). The two sentence-length helpers wrap to exactly two lines and are
read in full; none is ellipsised or cut. `a5c6-2-tooltip-wraps.png` is the
`Above weekly max` bubble open.

## 17.2 — Subject coverage chips

`a5c6-1-pills-chips.png`: pill `px-3 py-1.5 gap-2 rounded-xl`; grade badge
`text-xs font-semibold px-2 py-0.5` on the ONE shared DepEd palette — GR7 green,
GR8 yellow, GR9 red, GR10 blue; section name `text-sm font-medium`. Row is
`flex flex-wrap`, so the chips lay out on fewer lines as the dialog widens.

## 23.2 — the shared dialog, and QA F1

`a5c6-3-dialog-tall.png` and `a5c6-4-dialog-scrolled.png` show a **tall body that
owns no scroll region** — the exact shape of `CoverShortageDialog.tsx`, which was
the BLOCKING finding.

Measured on the live element:

| Property | Value | Expected |
|---|---|---|
| `overflow-y` | `auto` | the F1 fix — a resizable dialog keeps its scrollbar |
| scrollable | yes, `scrollHeight` 1488 vs `clientHeight` 651 | content below the cap is reachable |
| footer after scrolling | "Footer action: Close coverage", inside the dialog, on screen | reachable |
| page scroll during it | `window.scrollY === 0` | one scroll region, not global (§8) |
| `max-height` | 652.8px | 85vh of 768 |
| `min-width` | 480px | the operator's floor |
| `max-width` | 1297.7px | 95vw of 1366 |
| horizontally centred | true | flex parent, not the translate anchor |
| drag handles | 2, 6px wide, `cursor: ew-resize` | visible and clickable-looking |

At `e54e649f` this dialog rendered with `overflow-y: visible`: row 17 was cut at
the cap and the footer could not be reached at all. `b4ad75d6` moves
`overflow-y-auto` onto the base class list, and a surface that owns its own
scroller still passes `overflow-hidden` last, which wins in tailwind-merge.

---

# REAL STAGING DATA — the deciding evidence

Preview `:5255` (loopback, from this worktree), staging API `:5101`, session via
`/__dev/staging-login`. Viewport **1366x768**, asserted origin
`http://127.0.0.1:5255`. Active year 2023-2024; `/teachers` reports 20 active
teachers; `/subjects` reports 21 active subjects. Both pages carry the
`USING SAVED DATA` chip, i.e. the numbers are the real saved snapshot, not mocks.

## 24.2 — `/teachers` header action, REAL

`a5c6-5-teachers-real.png`. Read off the live DOM, not inferred from a class:

```json
{ "createLabel": "Create temporary teacher (Teacher X)",
  "dataLabel":  "Create temporary teacher (Teacher X)",
  "hasLiteralX": true, "hasAnyDigitsInParen": false }
```

A literal capital X, one line, not clipped, sitting in the header beside
`Update teacher list` and `Help`.

## 35.1 — the five quick-filter helpers, REAL

Hovered each of the five real pills at 1366x768 and measured the painted
bubble. Computed style on every one: `white-space: normal`,
`overflow-wrap: break-word`, `max-width: 384px` (`md:max-w-sm`).

| Pill | Bubble w x h | Lines | On screen | h-scroll | Text wider than box |
|---|---|---|---|---|---|
| No subjects assigned | 360 x 24 | 1 | yes | no | no |
| Above weekly max | 384 x 40 | **2** | yes | no | no |
| No sections assigned | 280 x 24 | 1 | yes | no | no |
| Temporary teachers | 384 x 40 | **2** | yes | no | no |
| All teachers | 299 x 24 | 1 | yes | no | no |

`a5c6-6-tooltip-real.png` is the `Temporary teachers` bubble on the real page,
read in full over two lines:

> Placeholder records for teachers who have not been hired yet.
> Replace before publishing.

**Measurement trap, recorded so it is not repeated:** Radix renders a second
`aria-hidden` copy of the content for measurement, at **1x1 px**. Querying
`[role="tooltip"]` returns THAT node, and it reports `white-space: nowrap` and a
1-pixel box — which reads as "the fix did not land". The bubble to measure is
the one inside `[data-radix-popper-content-wrapper]` carrying the
`rounded-md bg-slate-900` classes. Line counts derived from that node's height
(24px = one 16px line + 8px padding, 40px = two) are the reliable signal.

## 17.2 — Subject coverage chips, REAL

`a5c6-7-subjects-coverage-real.png`, English coverage sheet, **16 real section
chips** under real teachers (RAMOS, CAMILLE JOY at 100% Load). Measured off the
live DOM:

```json
{ "pillCount": 16, "rowWraps": true,
  "pill":   "flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5",
  "badge":  "rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100/80 text-green-700",
  "name":   "text-sm font-medium text-slate-700" }
```

Grade badges carry the ONE shared DepEd palette — GR7 `bg-green-100/80
text-green-700`, GR8 `bg-yellow-100/80 text-yellow-700`, GR9 `bg-red-100/80
text-red-700`, GR10 blue — and the row is `flex-wrap`, visible in the screenshot
as the chips reflowing across two and three lines. Real names: Aguinaldo, Rizal,
Makatao, Matapat, Daisy, Bonifacio, Maka-Diyos, Makakalikasan, Orchid,
Sampaguita, Tulip, Gold.

## 23.2 — the shared dialog, REAL

Same sheet, measured live: `data-resizable="true"`, 672 x 615,
`min-width: 480px` (the operator's floor), `max-width: 1297.7px` (95vw of 1366),
`max-height: 652.8px` (85vh of 768), horizontally centred by the flex parent,
**2** drag handles present, and `overflow-y: hidden` — which is the F1 fix
working as designed on a surface that owns its own scroll region: the
page-owned value wins over the shared default rather than fighting it.
