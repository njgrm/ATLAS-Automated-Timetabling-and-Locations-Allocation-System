# A7 packet — year setup carries forward by default (operator 2026-09-29)

Fresh session, after A7 c2. Operator: "setting that up is a real hassle. It shouldn't reset … policies and grade shifts
shouldn't unless stated otherwise … add in year-setup? One toggle for policy and grade shift? Both defaulted as don't reset."

Evidence: after the EnrollPro reset, year 2022-2023 (mirror 1) had 0 `grade_shift_windows` and 0 `policy_special_events`
while year 10 had 20 and 2; the scheduling policy did carry. Lane C filled year 1 at 00:18 with
`atlas-server/src/scripts/copy-year-setup-shift-windows-events.mjs` (receipt `D:/ATLAS-runtime-config/backups/year-setup-copy-20260929/receipt-year1.json`).
Until this packet is live, **Lane C runs that script after every rollover** — do not change its CLI.

Build:
1. When a school year becomes known/active in ATLAS (rollover sync or activation), copy last year's per-year setup into
   the new year **only where the new year is empty** (never overwrite): scheduling policy, grade time windows, flag
   ceremony/special events. Idempotent, one audit row, same transaction. Reuse the script's SQL logic.
2. School Year Setup, plain words, two switches, both ON by default:
   `Keep last year's scheduling rules` and `Keep last year's grade time windows and flag ceremonies`.
   Off = the new year starts empty for that part. Say what each switch keeps in one short line. No jargon.
3. Tests failing-first: carry on empty target, no overwrite on non-empty, switch off = no copy, idempotent re-run.
This writes live data on sync → HIGH tier: `atlas-reviewer-high` pre-merge (AGENTS §11/§13). Rendered proof at 1366x768.
Push to main after review; post ready-for-release. Do not end the run to wait for Lane C.
