pass 7 / fail 2 / unperformed 1

H1 | PASS | At 1366x768, 2 visual rows sit between the portal bar and grid; 5 clipped sentences have no hover/title for full text.
H2 | PASS | "See what to fix" shows Must fix 0, serious problems 0, and Warnings to review 149 with plain-language explanation.
D | UNPERFORMED | Draft strip showed Draft, Edit draft, and Discard draft; edit preview found 4 hard conflicts, and discard/published-return was not performed.
A1 | PASS | Accessibility tree exposes the readable name "Schedule for: GR7 - Luna".
P | FAIL | Loaded-grid section switches took 1.169s, 1.039s, and 0.823s versus the 0.4s target.
T1 | PASS | At 1366x768 and 1920x1080 document width equalled viewport width (1366/1366 and 1920/1920); no page or row scrollbar was visible.
T2 | PASS | At both viewports, header sentences and actions remained visually separate with no overlap.
T3 | PASS | Load summary was fully visible as one vertical list at 1366x768 and 1920x1080.
T4 | PASS | Searching zzqa-no-such-section showed exactly "No sections match 'zzqa-no-such-section'".
T5 | FAIL | EnrollPro was unreachable and two amber lines were visible (saved-data status plus Next step), not exactly one; no derived count was shown beside either.

New defects

- Teaching Load main content was blank for 30.2s after navigation before it rendered; no retry was needed.
- P: section changes were 0.423-0.769s above the 0.4s target.
- T5: duplicate amber EnrollPro-unreachable status lines.
- No React crash or console errors observed; origin remained http://127.0.0.1:5274.
