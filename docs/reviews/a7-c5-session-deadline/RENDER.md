# A7-C5 rendered evidence — `/admin/year-setup`, 1366x768

Four PNGs, produced by the primary planner on 2026-09-29 08:5x–09:1x +08 with the
Playwright MCP (`browser_run_code_unsafe`), against two **loopback dev previews started only with**
`scripts/dev/start-preview.ps1` (never `vite preview` in the foreground, never a `Start-Process` server,
never `chrome.exe`):

| Port | ClientDir | Tree |
|---|---|---|
| 5296 | `E:\ATLAS-worktrees\lane-a7-school-year-setup\atlas-client` | **BEFORE** — base `967d521a`, clean, A7 c4 worktree |
| 5297 | `E:\ATLAS-worktrees\lane-a7-c5-exec\atlas-client` | **AFTER** — the A7-C5 candidate |

Both previews proxy the ATLAS API to **staging** (`VITE_ATLAS_API=http://127.0.0.1:5101`, set by
`start-preview.ps1`), so nothing here could read or write live.

## How the defect was reproduced (not simulated)

The client API base is absolute (`VITE_ATLAS_API`), so a session check is
`GET http://127.0.0.1:5101/auth/me`. Both previews were driven with

```js
await page.route('http://127.0.0.1:5101/**', async (route) => { await new Promise(() => {}); });
```

— every API request is **held and never answered**, which is what a stalled ATLAS server does and is
exactly the condition Codex recorded (`docs/reviews/codex-staging-train6-24e268fb/run2-report.md`).
A non-empty `atlas_local_token` was seeded in `localStorage` and `sessionStorage` so the app takes the
signed-in path; no credential, cookie or real account is involved.

## 1. The gate: before and after, both captured 12 s after mount

| | File | What it shows |
|---|---|---|
| BEFORE | `before-1-year-setup-stuck-12s.png` | Content: `Checking your access...`. Sidebar: `Verifying session…` / `Checking your sign-in`. **No deadline, no way forward** — the reported defect. |
| AFTER | `after-1-year-setup-recovered-12s.png` | One plain sentence, one **Try again**, one **Back to dashboard**; sidebar reads `Sign-in not confirmed`. The deadline is ~8 s, so by 12 s the promise has ended. |

## 2. The carry-over switches on the archive-shaped start

Both were captured with the same API held, plus explicit stubs for `/auth/me` (an admin), the
`/runtime/rollover-status` archive-shaped fixture (`drift.recommendedAction = RUN_ARCHIVE_AND_SYNC`
with one conflict — the only state in which the primary becomes the archive-shaped start),
`/runtime/rollover-archive/preview`, `/runtime/context` and the recovery classifier, each with CORS
headers for the loopback origin.

| | File | What it shows |
|---|---|---|
| BEFORE | `before-2-archive-start-no-switches.png` | The archive-shaped primary `Start 2024-2025 in ATLAS` with **no** switches: the operator cannot see that ATLAS will keep last year's setup, and cannot turn it off. |
| AFTER | `after-2-archive-start-with-switches.png` | The SAME primary with both switches — *Keep last year's scheduling rules*, *Keep last year's grade time windows and flag ceremonies* — **both on**, immediately above it. |

**Disclosed mock artefact:** the amber `ATLAS could not read the active school year` banner in both
frames comes from the `/runtime/context` stub not matching that resolver's real shape. It is identical
in the before and the after frame, so it neither favours nor hides the change, and it is a stub
limitation — not a product finding.

## The design question this evidence is for

`AdminYearSetup` renders **nothing** of its own when the deadline expires, so the recovery band is the
only thing on screen in frame 1-AFTER. That is deliberate (one sentence and one set of buttons in the
whole tree, §8 "one status per fact"), and the fresh QA is asked to rule on whether the result reads as
a deliberate "could not load" surface or as a blank one. That judgement is the gate, not the tests.
