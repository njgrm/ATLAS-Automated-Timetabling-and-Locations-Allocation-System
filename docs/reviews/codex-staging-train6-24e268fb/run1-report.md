A pass 1/5 · design: TL 3/2/2/3, TT 1/1/3/1, SUBJ 4/2/2/2, YS 1/1/1/1 · REJECT_UX: /teaching-load, /timetable, /subjects, /admin/year-setup

Part A
A1 FAIL — no “Guided mode” found, but Teaching Load has several competing header actions (“Load summary”, “Suggest assignments”, “Review subject coverage”) and the visible filter says “Sort: Lowes...”.
A2 PASS — 22 Subjects rows; subject codes are absent, programs are visible short chips (BEC, STE, SPA, SPS), no “OWNER_DEPT”, and filter reads “Grade: All”.
A3 FAIL — /subjects filters are consistent 36px-style controls; /teaching-load has unlike search, selects, switches and a visibly cut-off “Sort: Lowes...”. /sections and /teachers did not load their comparable controls.
A4 FAIL — 2022-2023 suggestion opened, then showed “More than one active, non-archived school-year mirror exists for this school. Resolve school-year authority before changing Teaching Load.” Apply was disabled; honest post-apply count could not be tested.
A5 FAIL — Faculty roster could not be counted: “Teacher roster is unavailable. ATLAS could not load the teacher roster. Reconnect, then sync from EnrollPro.” Thus Melchora Aquino, Apolinario Mabini, and Jose Rizal could not be recorded there (Teaching Load’s saved roster did show Aquino, Melchora and Mabini, Apolinario; Jose Rizal was absent in the final saved display).

Bugs
BLOCKER — /teaching-load — open S.Y. 2022-2023, click “Suggest assignments” — suggestion cannot complete and Apply remains disabled after “More than one active, non-archived school-year mirror exists for this school...” — expected a reviewable suggestion and, if applicable, an honest uncovered-class count.
BLOCKER — /teachers — open Faculty and wait 4 s — “NO SAVED DATA” then “Teacher roster is unavailable” — expected the 2022-2023 teacher list for review.
BLOCKER — /timetable — open route and wait 3.1 s — still “Loading timetable: navigation is ready now; the grid fills as soon as the latest run resolves.” — expected a usable schedule or a plain recoverable error.
BLOCKER — /admin/year-setup — open route and wait 3.7 s — remains “Verifying session… Checking your sign-in” — expected the read-only setup screen; no forbidden action was attempted.
MAJOR — /subjects — open catalog — warning exposes “TERM_CACHE_INVALID” and says “Refresh the term data from EnrollPro” while the catalog is still shown — expected plain language that says what the operator can safely do without sending them to an unavailable system.
MINOR — /teaching-load — at 1366px — filter visibly truncates “Sort: Lowes...” — expected “Sort: Lowest load” in full.

Older-user concerns
MAJOR — /teaching-load — exact: “CROSS-DEPT” and “UNMAPPED SPECIALIZATION”; fix: say “Show teachers from other subjects” and “Show teachers whose subject is not listed”.
MAJOR — /teaching-load — exact: “Unverified — EnrollPro is not reachable, so this figure is withheld.”; fix: lead with one plain next step and keep technical source status behind Help.
MAJOR — /timetable — exact: “Loading timetable: navigation is ready now; the grid fills as soon as the latest run resolves.”; fix: replace indefinite loading with a clear retry and last-known schedule choice.
MAJOR — /admin/year-setup — exact: “Verifying session…”; fix: time out to a plain explanation and a safe back button.
MAJOR — /subjects — exact: “TERM_CACHE_INVALID”; fix: hide the code from the main screen and say “Term information needs updating before scheduling.”
MINOR — /subjects — five filters plus a search field occupy the first work row; fix: keep Grade and Program visible, put the rest in “More filters”.
MINOR — /teaching-load — exact: “Sort: Lowes...” is cut off; fix: widen it or shorten to “Sort: Load”.
