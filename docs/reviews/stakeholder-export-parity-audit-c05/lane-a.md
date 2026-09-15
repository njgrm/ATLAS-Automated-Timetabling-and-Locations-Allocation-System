# LANE A — Stakeholder Artifact Analyst
## STAKEHOLDER-EXPORT-PARITY-AUDIT-C05

Audit SHA: origin/main = 84dd537bb2a2c045b8518c35b3a5372142e0080c
Frozen worktree: E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 (branch audit/stakeholder-export-parity-c05), HEAD = 84dd537b, worktree clean
Directive: origin/main:AGENTS.md LF-normalized SHA-256 = 5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5
Lane type: planner-authorized READ-ONLY artifact/source audit (no QA verdict).
Temp root: %TEMP%\opencode\stakeholder-export-parity-c05\lane-a

Hard-constraint compliance summary
- No writes in any repository/worktree. Only read-only git (rev-parse/status). Verified final: audit worktree HEAD 84dd537b, `git status --short` empty.
- All outputs under the temp lane dir. stakeholderFiles copied before opening; source files never modified.
- No package installs. No browser. No login. No database. No live/runtime probe.
- Host side effect: Word/Excel COM renderer processes started and fully terminated (0 remaining). Default printer was restored to its original `POS58 Printer(3)`.

All 14 pinned artifact SHA-256 values were independently recomputed and MATCHED (see 1.0).

---

# 1. RENDERED EVIDENCE INVENTORY

## 1.0 Hash pin verification (all MATCH)
| Artifact | SHA-256 | Pin vs actual |
|---|---|---|
| DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx | 9FDAC0942E9899D462BB1D81B0C8BC1CA484392373FF869A8FF1F5DB4E09EED0 | MATCH |
| aral-prog_G7_Class-Program_SY2026-2027docx.docx | A83A09F6375B4109D7FD0684B5400BCDD6C50BFF2AAEBA0AC5AD28B9B8954D3A | MATCH |
| Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx | 79AEC6435D6BB718BF54760B7ADCECEBB23762F77BFCCA48C6262EAF6D1A3BF9 | MATCH |
| CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx | 16668493464F5B25895487B27CBD3725DFBEC2DBE874CBB386DCE4FD13F0BD32 | MATCH |
| quarter-3_grade-10-schedule-monitoring.xlsx | 474AA6802F3540AFC5A2C53F560E92CA61947612FE064E7C46288FFABADEE183 | MATCH |
| root-reference/Teachers-PROGRAM.docx | 44DBDD52E478FD2D75CB5055CA06A496409135606A4D381E1BE95938260E6D77 | MATCH |
| root-reference/CLASS-PROGRAM-v2.docx | C44ACAC1D65EE74248AE2E2DC289010EDEF03748CB27566FCB878F374EFD260B | MATCH |
| root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx | 63DB8E9A953591FC64154BF1C99DEED28DE4B2711AE2E7B74630C77779D0B3B3 | MATCH |
| root-reference/40-minutes.xlsx | C5396FE06AC092BFD5A3F9A069C54CECBF580CF7CFBF3CF3434CA6B879F4D962 | MATCH |
| CamScanner-04-16-2026-14.38.pdf | 1C907A86BC2A1ED7916D29F0E398111BC578B1ED373DF343E25DD833123FDDDE | MATCH |
| GRADE-7-OCCUPANCY-PLAN.pdf | CB321E7BAD4D8BAA6280EFB24A5FC4E67BFB8C18C95860A7227D82CEAEEEA368 | MATCH |
| D:/ATLAS/teacherSched+LoadActual.png | 359E6E4D3DD6D227302B829FEF74B99B4F27348B75B0F5A6F576C994EB3AD34C | MATCH |
| D:/ATLAS/teacher2Sched+LoadActual.png | 7C9766368AE21C50E0CA1EF415DC738C2F7EE1084796DB8B5AA8BD7236B43919 | MATCH |
| 793160024_1434242008568461_1094142971457100287_n.jpg | 1FDD01C4109A703A6C78891303CD2F6CA4BE1DDE069DF59D5AD8548318E18D05 | MATCH |

Additional artifacts hashed this lane (not pre-pinned):
- BLDG3-BLDG-9-occupancy-plan-2023-24.docx = 7CE045D7BC839AB8EAF84233D1EE22A0F2A8E0F383078250E018ADBC1F23C179
- GARDE-8-OCCUPANCY-PLAN.docx = E0A0EC51FEA5E03AB2A10C0F88196A0305A6E36291A49A5CBEE20334D1C120D8
- OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx = 93DB576A3D282F3598F31D1626B879540F9AD9C6E06426D002A60A6009ECCE9E
- root-reference/Curio_Gilera_Gromea_ATLAS_BSIT3B.pdf = 7D0F8CA2BEB0278AA9C3FB38B622AD700E9B468AF9B6D76F4E022485C05965D9
- root-reference/question_prompt.pdf = 23828E1E08E968ED42962F0326A7C25CF392A08DB92399D9E2B1B2CC2CBCCC3D
- D:/EnrollPro/docs/HNHS.pdf = AB831B0355421B0509646D2D90443F8EEC9123251B3F520859B3770897D99FE3 (READ_ONLY companion; not modified)

## 1.1 DOCX — structural render performed; VISUAL RENDER BLOCKED (Word PDF export broken on host)
Every DOCX was copied to the temp lane, unblocked (Mark-of-the-Web removed on the COPY), opened read-only in Word COM, and measured. Export to PDF was NOT possible (see 5.1). Page counts marked (*) were obtained before export hung.
| Artifact | Pages (Word stats) | Visual pages inspected | Outputs |
|---|---|---|---|
| DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx | 4 (*) | 0 (renderer blocked) | extract/DNO-...txt |
| aral-prog_G7_Class-Program_SY2026-2027docx.docx | 5 (*) | 0 (renderer blocked) | extract/aral-prog_...txt |
| Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx | not obtained (Word open timed out) | 0 (renderer blocked); content seen via 2 root PNG photos | extract/Teachers-PROGRAM_SPEC-...txt |
| root-reference/Teachers-PROGRAM.docx | not obtained | 0 | extract/Teachers-PROGRAM-root.txt |
| root-reference/CLASS-PROGRAM-v2.docx | not obtained | 0 | extract/CLASS-PROGRAM-v2.txt |
| BLDG3 / GARDE-8 / OCCUPANCY-IN-4-STOREY (2023-24) | not obtained | 0 | extract/*.txt (historical; time-boxed) |

DOCX render attempts (all produced the same hang, log `docx2pdf.log`, `probe2..7.log`): Documents.Open OK + ComputeStatistics OK; then ExportAsFixedFormat hangs; SaveAs2(pdf,17) hangs; PrintOut(PrintToFile, "Microsoft Print to PDF") hangs; python docx2pdf hangs (>=120 s); a TRIVIAL new blank document also hangs at export. Excel COM export works on the same host, so the failure is Word's PDF-export subsystem, not the printer.

## 1.2 XLSX — every sheet rendered to PDF then PNG (renders worked)
Per-sheet PDFs: xlsx-pdf/*.pdf ; PNGs: pdf-png/*.png (1600 px width/page). Sheet-level visual coverage noted as VIS / STRUCT.
| Workbook | Sheets | Rendered | Visually inspected |
|---|---|---|---|
| root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx | 10 (all visible; none hidden) | 10/10 sheets -> PDF -> PNG | 7/10 VIS: SUMMARY (2), SUMMARY, SCIENCE, MATH, MAPEH, ESPGMRC, TLE. STRUCT only: ENGLISH, FIL, AP |
| root-reference/40-minutes.xlsx | 3 (Sheet1/Sheet2/Sheet3, all visible) | 3/3 sheets (39 PDF pages) | VIS: Sheet1 p1, p7; Sheet2 p1; Sheet3 p1 (4 of 39 pages) |
| CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx | 14 (all visible) | 14/14 sheets | VIS: SUMMARY Q1 PAGE1 (1 of 14) |
| quarter-3_grade-10-schedule-monitoring.xlsx | 11 (all visible) | 11/11 sheets | VIS: schedule summary p1 (1 of 11) |

What the rendered workbook pages show (one line per inspected page):
- SUMMARY workbook · 'SUMMARY' p1: "GRADE 8 CLASS MONITORING / SY 2026-2027" grid. Columns = 12 second-cohort sections (Mapagmahal..Magalang); rows = SUMMARY TIME/ADVISER + slots 6:00-6:45..11:30-12:15, 12:15-1:00 LUNCH BREAK, 1:00-1:45 ARAL 1, 1:45-2:30 ARAL 2; each cell has teacher-name line + subject line; RECESS row. No minutes column, no day columns, no learner counts, no branding, no signatories in the printed area.
- SUMMARY workbook · 'SUMMARY (2)' p1: byte-for-byte same content as 'SUMMARY' (duplicate sheet).
- SUMMARY workbook · 'SCIENCE' p1: per-teacher panels (header = surname) with SUBJECT|SECTION columns, time rows 6:00-6:45..1:45-2:30, then ADVISORY CLASS / ANCILLARY TASK / TOTAL rows. TOTAL = section count (6,6,2,6...). Colored highlights on special cases (green ENVISCI/STE7, amber APPLIED P/STE10).
- SUMMARY workbook · 'MATH' p1: same panel layout; maths teachers DE LOS SANTOS, MONTINOLA, PATRIMONIO, TUBONGBANUA, GARCESA; TOTAL 6,6,6,5,5.
- SUMMARY workbook · 'MAPEH' p1: same layout; includes a literal placeholder teacher "MAPEH X" (red header, TOTAL 3) and subject text "PS SPECIALIZATION".
- SUMMARY workbook · 'ESPGMRC' p1: same layout; includes literal placeholder teacher "ESP X" (red header, TOTAL 2).
- SUMMARY workbook · 'TLE' p1: same layout; TLE teachers ROPERO, GAREZA, SALUSA, MACAM, JUAREZ, DE LA CRUZ, VILLAMOR, MONTENEO, TRINIDAD, PINEDA, BERTIZ; TOTAL 3,3,1,3,3,3,3,4,1,2,4.
- 40-minutes · Sheet1 p1: "GRADE 9 CLASS PROGRAM, SY 2025-2026" WITH full DepEd/HNHS branding (DepEd seal, "Republic of the Philippines / Department of education / NEGROS ISLAND REGION / SCHOOLS DIVISION OF NEGROS OCCIDENTAL / DISTRICT OF HINIGARAN - I / HINIGARAN NATIONAL HIGH SCHOOL"), TIME/ADVISER/BLDG.-RM. rows, sections 9-QUISUMBING, 9-FE DEL MUNDO, 9-SPA NICANOR ABELARDO(A), 9-SPA ANTONIO MOLINA(B); slots 10:00-10:45..5:15-6:00 with 11:20-12:15 LUNCH BREAK, 3:15-3:30 HEALTH BREAK, and a 3:30-3:45 class slot; DepEd MATATAG + BAGONG PILIPINAS + school-seal logos and address/contact line.
- 40-minutes · Sheet1 p7: continuation sections 9-(14) LILY..9-(18) JASMINE with merged "ARAL" block (10:00-10:40 / 10:20-11:20 / 11:20-12:15) and the Prepared-by/Checked-by/Noted-by/Recommending-Approval/Approved signature block (SITCHON, COLMENARES, BUENCOCHILLO, TORNEA, MONJUAN, NONATO, ENGLIS, BEDAURE, FELICANO).
- 40-minutes · Sheet2 p1: color-coded GRADE 9 grid (no branding, no signatories); DIFFERENT time grid from Sheet1 (lunch 11:30-12:15; slots 3:15-4:00, 4:00-4:45, 4:45-5:30, 5:30-6:15; no 3:30-3:45 slot).
- 40-minutes · Sheet3 p1: another color-coded GRADE 9 variant, VERY wide (A1:BG78) with a repeated right-hand TIME/ADVISER/BLDG.-RM. block; yet another time grid (10:00-10:45, 10:45-11:30, 11:30-12:15 LUNCH, ..., 3:15-3:30 HEALTH BREAK, 3:30-4:15, 5:45-6:30).
- CLASS-PROGRAM-SY-2025-2026-GRADE-8 · 'SUMMARY Q1 PAGE1' p1: "GRADE 8 CLASS PROGRAM FOR SY 2025-2026" with DepEd Region VI-Western Visayas branding; columns = 4 sections (STE8-WILLIAM PADOLINA, STE 8-DIOSCORO UMALI, SPA 8-LUCRESIA KASILAG, SPA 8-FRANCISCA AQUINO); TIME/ADVISER rows; 7:00-7:30 FLAG CEREMONY; 9:45-10:00 RECESS; 11:30-1:00 LUNCH BREAK; each cell = teacher line + subject line; placeholder "TEACHER X" appears twice; full signatory block; NOTE this is SY 2025-2026 = HISTORICAL.
- quarter-3 · 'schedule summary' p1: "Q3 SPECIAL PROGRAM" panel for 10 AGAPITO FLORES (B3/2F/R1, adviser SAMSON JR, ERWIN): 40-min periods 10:00-10:40 APPLIED PHYSICS (COLMENARES, JOHNRY), 10:40-11:20 MAPEH (MONGCAL, JO MARIE), 11:20-12:00 LUNCH BREAK, 12:00-12:40 SCIENCE (BEBOSO, REYART), 12:40-1:20 TLE (VILLALUNA, ANDERSON), 1:20-2:00 RESEARCH 10 (CANALIJA, ELEONOR), 2:00-2:40 ARAL PAN (GARRATON, RODELITA), 2:40-3:20 ENGLISH (FLORETE, ERLFRED), 3:20-3:30 RECESS, 3:30-4:10 FILIPINO (ENRILE, GEORGIE), 4:10-4:50 (JUGUAN, MA. LOURDES). Sheet title says 2025-2026 = HISTORICAL. The workbook also contains 'monitoring sheet' (Q3 GRADE 10 MONITORNG SHEET [sic], 18 sections, interleaved "Monitor's Signature" rows, ARAL PROGRAM rows) and 'occupancy' (BUILDING 9 OCCUPANCY PLAN / GRADE 10 floor-by-floor room->section->adviser map, incl. GUIDANCE OFFICE and GRADE 8 MAHINHIN non-section rooms).

## 1.3 PDFs rendered to PNG (Windows.Data.Pdf, 1600 px) and visually sampled
| Artifact | Pages | PNGs | Visually inspected |
|---|---|---|---|
| CamScanner-04-16-2026-14.38.pdf | 7 | pdf-png/CamScanner-...p1..p7.png | VIS p1, p2, p4, p6 (4/7) |
| GRADE-7-OCCUPANCY-PLAN.pdf | 4 | pdf-png/GRADE-7-OCCUPANCY-PLAN-p1..p4.png | VIS p2 (1/4) |
| D:/EnrollPro/docs/HNHS.pdf (READ_ONLY) | 27 | pdf-png/HNHS-EnrollPro-docs-p1..p27.png | VIS p1, p10, p14, p20 (4/27) |
| root-reference/Curio_Gilera_Gromea_ATLAS_BSIT3B.pdf | 97 | pdf-png/Curio_...-p1..p97.png | VIS p1, p30, p55 (3/97) |
| root-reference/question_prompt.pdf | 5 | pdf-png/question_prompt-p1..p5.png | VIS p1 (1/5) |

Page content seen:
- CamScanner p1: "Annex B / THREE-TERM SCHOOL CALENDAR IN BASIC EDUCATION FOR SCHOOL YEAR (SY) 2026-2027"; EOSY 2025-2026 (April-May 2026) then SY 2026-2027 "TERM 1 June 8 - September 15, 2026"; Term 1 opening block June 8-11 2026.
- CamScanner p2: Term 1 continuation (July/Aug 2026: first/second teacher-made summative tests, MFAT, Term 1 Examination Aug 28), September: "2-15 End-of-Term Block", "2-8 ARAL Program, Computation of Grades...".
- CamScanner p4: December 2026 (Term 2 Examination 3-4, End of Term 2 Dec 18, 2026); header "TERM 3 January 4 - April 8, 2026" [source typo: should read 2027].
- CamScanner p6: April 2027 (End-of-Term Block 1-8; End of Term 3 = April 8, 2027), May 2027, June 2027 (Brigada Eskwela / Enrollment Period 7-11).
- GRADE-7-OCCUPANCY-PLAN p2: "OCCUPANCY PLAN FOR GRADE 7 BUILDING", Building No. 10, elevation with rooms 1-20 highlighted, table Room No./Section/Name of Adviser; CLINIC (R1), MATH LRC (R4), FILIPINO LRC (R7) are non-section rooms; Prepared by ZEA MAY G. CORONEL.
- HNHS p1: "SYSTEM PROPOSAL / Hinigaran National High School", BSIT 3-B, April 6 2026, presenter roster. p10: "A.T.L.A.S. Objectives" (drag-and-drop portal; configurable priority; mobile faculty auth + preference submission). p14: "A.T.L.A.S. Limitations" (no enrollment/grades/attendance; no student preferences; students view-only). p20: "A.I.M.S. Scope" (a different system in the same deck).
- Curio p1: capstone title page "A.T.L.A.S. ... A Web-Based Academic Scheduling Application", Carlos Hilado Memorial State University, May 2026. p30: methodology text (prototype cycle / testing / implementation). p55: ERD tables (Schools Table, Buildings Table with x/y/width/height/rotation/floor_count/is_teaching_building).
- question_prompt p1: "QUESTIONSSSSSSSS:" — panel-defense Q&A on the algorithm, 28-table architecture, teacher_mirrors/section_mirrors, locked_sessions, JWT auth. NOT a layout artifact.

## 1.4 Root images — viewed directly (copied to temp first)
- teacherSched+LoadActual.png (359E6E4D...): TEACHER'S PROGRAM "SY 2026-2027"; columns Time | No. of min | Subject | Grade and section | Day | Bldg/Room #; teacher photo present ("Picture"); Name REYART P. BEBOSO, Position TEACHER I, Bachelor's, Post Graduate "42 UNITS MASTER OF ARTS..."; Science 10 rows with rooms BLDG.3 RM.22 / BLDG.9 1ST/3RD/2ND FLOOR; Lunch Break 11:30-12:15; Health Break 3:15-3:30; Ancillary Work rows; "Total minutes per day 225 mins. (Monday-Friday)" + "45 mins Inclusive of HGP/PEACE Campaign (Monday)"; Class Advising Duty 60 mins / Actual Teaching Load 225 mins / ARAL Program 0 min / Total Teaching Load 285 mins.
- teacher2Sched+LoadActual.png (7C976636...): TEACHER'S PROGRAM "SY 2026-2027"; photo; Name BON LISTER M. FACTORIN, Position TEACHER IV, BSED Biological Sciences, Post Grad N/A; Science 10 + Biotechnology 8 rows with Bldg/Room; 3 Ancillary Work rows; Class Advising Duty 60 / Actual 225 / ARAL Program 0 min / Total 285.
- 793160024_...jpg (1FDD01C4...): photo of a printed CLASS PROGRAM "Grade 9 Enhanced K to 10 for SY 2026-2027", Grade 9, Section FE DEL MUNDO, "Number of Learners: Male: 14 Female: 20 TOTAL: 34"; columns Time | No. of min. | Monday-Friday | Teacher; Adviser RUSSEL ANN G. PEREZ; "Total minutes per day 510 / Friday 495"; Prepared by JUDY ANN B. NONATO (Principal), Reviewed by EMILIA L. ENGLIS (PSDS), Recommending Approval ARCH. NELSON G. BEDAURE PhD (CID-Chief), Approved by JULITO L. FELICANO CESE (ASDS). Row "9:45-10:30 / 60 / Science (45min)" contains an internal 45-vs-60 minute inconsistency.

---

# 2. BENEFICIARY FIELD / LAYOUT MATRIX

Status legend: PRESENT / ABSENT / UNCLEAR. "Content vs decorative" = C (carries schedule meaning) or D (brand/decoration).

## 2.1 SECTION / CLASS PROGRAM
Shapes observed: **(A) day-column matrix** rows=time, cols=Mon-Fri (DNO, jpg photo, CLASS-PROGRAM-v2) and **(B) section-column matrix** rows=time, cols=sections (aral-prog, 40-minutes, CLASS-PROGRAM-2025-2026, quarter-3). The audit must decide whether one export renders both.

| Field / layout element | Status | Exact evidence | C/D | Notes |
|---|---|---|---|---|
| School / DepEd branding region | PRESENT | DNO header paras 1-4 + long underscore rule (extract L6); aral-prog header adds HINIGARAN NATIONAL HIGH SCHOOL (L6); 40-min Sheet1 p1 (seal + 6 header lines + MATATAG/BAGONG PILIPINAS/school-seal logos + address/contact); CLASS-PROGRAM-2025-2026 p1 (Region VI-Western Visayas) | D | DNO/aral-prog are text-only (inline_shapes=0); only 40-min Sheet1 is brand-rich w/ logos |
| School year | PRESENT | DNO title "SY 2026-2027" x4; aral-prog "SY 2026-2027"; CLASS-PROGRAM-v2 "SY 2025-2026"; jpg "SY 2026-2027"; 40-min Sheet1 "SY 2025-2026" | C | — |
| Grade | PRESENT | DNO "Grade: 7"/"Grade: 9"; aral-prog "GRADE 7"; jpg "Grade: 9"; 40-min "GRADE 9"; CLASS-PROGRAM-2025-2026 "GRADE 8" | C | — |
| Section | PRESENT | DNO blank rule "Section: ___________"; aral-prog col headers (STE DEL ROSARIO, STE SANTIAGO, SPA CAYABYAB, SPA CELERIO, SPS REYES...); jpg "FE DEL MUNDO"; quarter-3 21 section columns | C | DNO template leaves section blank |
| Learners Male/Female/Total | PRESENT (only jpg) | jpg "Male: 14 Female: 20 TOTAL: 34"; DNO has editable blanks; all other artifacts ABSENT | C | Only the jpg evidences learner counts |
| Time column | PRESENT | DNO col0; aral-prog col0 (vMerge 2 rows); jpg; 40-min; quarter-3 | C | — |
| No. of minutes column | PRESENT | DNO col1 (45/15/60); jpg "No. of min."; CLASS-PROGRAM-v2 col1. ABSENT in aral-prog, 40-min, CLASS-PROGRAM-2025-2026, quarter-3 | C | Export must support a minutes column optionally |
| Monday-Friday columns | PRESENT (shape A) | DNO cols2-6; CLASS-PROGRAM-v2 cols2-6; jpg Mon-Fri | C | Shape B (aral-prog/40-min/quarter-3) has NO weekday columns — a single implicit day |
| Teacher column | PRESENT | DNO col7 "Teacher" (BRIAN TORNEA); jpg "Teacher" col; aral-prog teacher row under each subject per section; 40-min/CLASS-PROGRAM-2025-2026 teacher embedded in cell line | C | Two renderings: dedicated column vs embedded 2nd line |
| Morning / afternoon shift window | PRESENT | DNO G7 6:00-2:00 & 6:00-3:30; DNO G9 11:15-6:30; aral-prog 6:00-12:15; jpg 9:45-?; 40-min 10:00-6:00; CLASS-PROGRAM-2025-2026 7:00-4:45; quarter-3 10:00-5:30 | C | No single canonical shift; "AFTERNOON" appears in a filename |
| Lunch / health breaks - merged band? | PRESENT (merged, inconsistent geometry) | DNO Health Break gridSpan=5 (Mon-Fri) at 9:00-9:15; Lunch gridSpan=5 in G7 tables but gridSpan=6 (through Teacher col) in G9 tables; aral-prog HEALTH BREAK span=7 + LUNCH span=8; CLASS-PROGRAM-v2 "Health Break" span=5 at 11:30-1:00; 40-min LUNCH BREAK full row + HEALTH BREAK row; quarter-3 LUNCH BREAK + RECESS rows | C | Same document family uses two different merge widths |
| Monday-only Flag Ceremony/HGP overlay + Tue-Fri underlying period in the SAME slot | PRESENT | DNO row 6:00-6:45 = Monday "Flag Ceremony/HGP", Tue-Fri "TLE" (one shared slot, day-scoped); CLASS-PROGRAM-v2 row 7:30-8:15 Monday cell "HGP\nESPANOLA" vs Tue-Fri "TLE\nESPANOLA" | C | Matches the day-scoped-Monday-only requirement; also rendered as a full 5-day FLAG row elsewhere (see conflict C13) |
| AP row | PRESENT | DNO "AP" (10:00-10:45); jpg "Araling Panlipunan"; CLASS-PROGRAM-v2 "ARAL PAN"; aral-prog "ARAL PAN"; 40-min "AP 9"; quarter-3 "ARAL PAN" | C | — |
| HG standalone row | ABSENT | HGP appears only as overlay/note ("HGP" Monday cell; "45 mins Inclusive of HGP..." note) | - | No standalone HG row found in any artifact |
| ARAL Program row | PRESENT (and inconsistent) | DNO "ARAL-Reading English/Filipino/Math" 60 min row, Friday "TLE *45 min only"; CLASS-PROGRAM-v2 "ARAL Program" merged Mon-Thu + "ASSESSMENT" Fri; 40-min merged "ARAL" block; quarter-3 "ARAL PROGRAM" 10:20-11:20; SUMMARY workbook "ARAL 1"/"ARAL 2" rows; teacher program "ARAL Program 0 min/60 min" | C | Conflict C1/C2 - product decision says ARAL is excluded/beneficiary-managed |
| Daily minute totals per day + totals row/column | PRESENT (inconsistent) | DNO "Total minutes per day" row = 420/405 (G7) and 510/495 (G9); jpg 510/495; CLASS-PROGRAM-v2 single merged "420 mins. (Mon-Friday) Inclusive of HGP"; teacher prog "225 mins. (Monday-Friday)"; ABSENT in aral-prog, 40-min, SUMMARY workbook | C | Shape-B artifacts have no totals row |
| Adviser | PRESENT | DNO "Adviser: BRIAN F. TORNEA"; aral-prog ADVISER row; jpg "Adviser: RUSSEL ANN G. PEREZ"; 40-min ADVISER row; quarter-3 ADVISER row | C | — |
| Prepared by / Reviewed by / Recommending Approval / Approved by | PRESENT | DNO paras P5-P9; aral-prog P16-P43; jpg (NONATO/ENGLIS/BEDAURE/FELICANO); 40-min Sheet1 (SITCHON/COLMENARES/BUENCOCHILLO/TORNEA/MONJUAN/NONATO/ENGLIS/BEDAURE/FELICANO); CLASS-PROGRAM-2025-2026 | C | NOTE: in the SUMMARY workbook these sit in cols AA/AF OUTSIDE print-area B40:N77 |
| Page orientation | PRESENT | DNO LANDSCAPE 11x8.5in (sect L=900430 R=247015 T=180340 B=31115 EMU); aral-prog LANDSCAPE A4 11.69x8.27; CLASS-PROGRAM-v2 PORTRAIT A4; quarter-3 sheet1 orient=1 (portrait), sheet2 orient=2 (landscape) | - | Orientation is not uniform across the family |
| One-term presentation | PRESENT (flat) | No artifact carries a term column/index; CamScanner calendar is the only term-authority artifact (3 terms) | C | Conflict C7 (term vs quarter) |
| Rotating subject/teacher/room representation | UNCLEAR | DNO "TLE *45 min only" Friday; "Specialization" rows; 40-min "SPECIALIZATION SPA" merged cells; quarter-3 "SPECIALIZATION 1/2" + "ARAL PROGRAM"; CLASS-PROGRAM-2025-2026 "SPA SPECIALIZATION 1" | C | No explicit rotation/term-index representation anywhere |

## 2.2 TEACHER PROGRAM
Sources: Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx (SY 2026-2027), root Teachers-PROGRAM.docx (SY 2025-2026), teacherSched+LoadActual.png, teacher2Sched+LoadActual.png.

| Field / layout element | Status | Exact evidence | C/D | Notes |
|---|---|---|---|---|
| Teacher name | PRESENT | SPEC "Name: BRIAN F. TORNEA"; root Name blank; PNGs BEBOSO / FACTORIN | C | Root doc has no name |
| Photo | ABSENT in DOCX / PRESENT in PNGs | SPEC & root inline_shapes=0; PNGs show portrait labelled "Picture" | D | Export must decide photo or not |
| Position | PRESENT | TEACHER II (SPEC), TEACHER I (root), TEACHER I (BEBOSO), TEACHER IV (FACTORIN) | C | — |
| Bachelor's degree | PRESENT | "BACHELOR IN SECONDARY EDUCATION MAJOR IN MATHEMATICS" / "BSCED ... BIOLOGICAL SCIENCES" | C | — |
| Postgraduate degree | PRESENT | "N/A" (SPEC, FACTORIN) / "42 UNITS MASTER OF ARTS..." (BEBOSO) | C | — |
| Time | PRESENT | col0 all sources | C | — |
| Minutes ("No. of min") | PRESENT | SPEC col1; root col1; PNGs "No. of min" | C | — |
| Subject | PRESENT | SPEC "Research 10"/"Filipino 10"/"Ancillary Work"; root "Science (Physics)"; PNGs "Science 10"/"Biotechnology 8" | C | — |
| Grade & section | PRESENT | "Grade 10 STE - Felix Maramba", "Grade 8 - Masipag", "Grade 10 - ONYX", "Grade 8-DISCURO UMALI" | C | — |
| Day columns | PRESENT (as a Day value column) | "Day" col = "Monday to Friday" (single value); NO per-weekday columns | C | Teacher program is not a Mon-Fri matrix |
| Building / Room | PRESENT (column) | "Bldg/Room #" col (SPEC & root header, values empty); PNGs show "BLDG.3 RM.22", "Bldg 9, 4F, Rm. 4" | C | DOCX templates leave the column empty |
| Ancillary work | PRESENT | SPEC "Ancillary Work" rows 1:45-2:30, 2:30-3:15, 3:30-4:15, 5:45-6:30; PNGs Ancillary Work rows | C | — |
| Lunch / health rows | PRESENT | SPEC 11:30-12:15 Lunch Break; 3:15-3:30 Health Break; root 9:45-10:00 RECESS + 11:30-1:00 LUNCH BREAK; PNGs Lunch Break + Health Break | C | — |
| Advising duty | PRESENT | "Class Advising Duty" 0 mins (SPEC) / 60 mins (PNGs) / 45 mins (root) | C | — |
| Actual teaching load | PRESENT | 315 mins (SPEC) / 225 mins (PNGs) / 225 mins (root) | C | — |
| ARAL Program handling | PRESENT as a load row | "ARAL Program" 0 min (SPEC, PNGs, 2026-2027) / 60 mins (root 2025-2026) | C | Conflict C1/C2 |
| Total load | PRESENT | "Total Teaching Load" 315 / 285 / 285 / 330 mins | C | Root 330 > 285 because ARAL=60 is counted |
| Term-specific notes | ABSENT | no term column/notes; only "45 mins Inclusive of HGP/PEACE Campaign (Monday)" | C | No per-term teacher-load variant |
| Print orientation | PRESENT | SPEC & root PORTRAIT A4 (8.27x11.69in) | - | PNGs are portrait photos |

## 2.3 ROOM PROGRAM (no standalone per-room weekly program exists)
Room identity appears only as a row/column inside class programs and as occupancy maps.

| Field | Status | Exact evidence | C/D | Notes |
|---|---|---|---|---|
| Room / building identity | PRESENT | aral-prog "BLDG 10 / ROOM 19", "BLDG 3 / ROOM 301"; 40-min "BLD 18 2ND FLOOR R3", "BLDG./RM." row; quarter-3 "B3/2F/R1", "B9/2F/R3"; GRADE-7-OCCUPANCY "Room 1..20" | C | DNO class-program template has NO BLDG/ROOM row (conflict C10) |
| Weekday / time | PRESENT only via the class grid | room row sits above the time rows; occupancy sheets have no weekday/time | C | No room-by-weekday matrix exists |
| Subject | PRESENT | subject rows adjacent to the room row | C | — |
| Section | PRESENT | quarter-3 'occupancy': B4 = "BERYL (17) Glory Grace C. Yap"; GRADE-7-OCCUPANCY table room->section+adviser | C | — |
| Teacher / adviser | PRESENT | room->adviser in occupancy sheets ("ROOM 1 CLINIC", "Room 11 BONIFACIO ROSELEN M. BRILLANTES") | C | — |

## 2.4 SUMMARY WORKBOOK (root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx)
| Element | Status | Exact evidence | C/D | Notes |
|---|---|---|---|---|
| Sheet names | PRESENT | SUMMARY (2), SUMMARY, SCIENCE, MATH, ENGLISH, FIL, AP, ESPGMRC, MAPEH, TLE | C | 'SUMMARY (2)' duplicates 'SUMMARY' |
| Hidden sheets | ABSENT | ws.sheet_state = 'visible' for all 10 (openpyxl) | - | — |
| Subject-level teacher schedule summary layout | PRESENT | panel per teacher: header row = surname; cols SUBJECT|SECTION; time rows 6:00-6:45..1:45-2:30; then ADVISORY CLASS / ANCILLARY TASK / TOTAL. Verified visually on SCIENCE/MATH/MAPEH/ESPGMRC/TLE p1 | C | Summary is a load/section allocator, not a timetable |
| Headings / filters | PARTIAL | Row1 "GRADE 8 CLASS MONITORING", row2 "SY 2026-2027", "TIME" cell B3/B41; no autofilter; freeze_panes = None | C | No filter/freeze support |
| Per-term structure | ABSENT | no term column/sheet; single flat sheet per subject | C | Conflict C7 |
| Totals | PRESENT | "TOTAL" row per teacher panel = section count (6/6/2/6, 5, 3...) NOT minutes | C | A number w/o unit = ambiguous "load" |
| Print setup | PRESENT | SUMMARY print_area B40:N77 (cols B-N only, rows 40-77 only), landscape, paper 14, scale 80; SCIENCE A4 landscape scale 56; MATH 74; ENGLISH 67 (no print_area); FIL 78; AP 66; ESPGMRC PORTRAIT 61; MAPEH 62; TLE 56 | C | Print area omits the first cohort, column O and the AA/AF signatories (conflict C8) |
| Signatories | PRESENT but outside print area | AA15/AA16/AA19/AA20 & AF15/AF19/AF20 (SITCHON, COLMENARES) | C | Would not appear in a print/PDF export |

---

# 3. EXPLICIT CONFLICTS / AMBIGUITIES
Each item names artifact evidence and whether it appears to need an operator product decision (DECISION_REQUIRED candidate).

- **C1 - ARAL Program present in beneficiary artifacts vs the product decision that ARAL creates no demand/export row.** DNO template contains a first-class "ARAL-Reading English/Filipino/Math" row (DNO table1 row11, table2 row13, table3 row1, table4 row1); CLASS-PROGRAM-v2 has an "ARAL Program" merged row; 40-minutes Sheet1 has a merged "ARAL" block; quarter-3 has "ARAL PROGRAM" (10:20-11:20) and the SUMMARY workbook has "ARAL 1"/"ARAL 2" rows; yet the teacher programs carry "ARAL Program 0 min". -> **DECISION_REQUIRED candidate**: does the section/class-program export render an ARAL row (display-only, zero demand), or omit it entirely?
- **C2 - "ARAL Program" vs "ARAL PAN" vs "ARAL-Reading".** Three distinct spellings/semantics in one artifact family: ARAL Program (load line / merged block), ARAL PAN = Araling Panlipunan (a normal subject), and "ARAL-Reading English/Filipino/Math" (a remedial reading block). The file `aral-prog_G7_Class-Program_SY2026-2027docx.docx` contains **ARAL PAN**, not ARAL Program. -> **DECISION_REQUIRED candidate**: canonical label + whether ARAL-Reading is display-only.
- **C3 - Break bands merged with two different geometries.** DNO Grade-7 tables: Health Break gridSpan=5 and Lunch Break gridSpan=5; DNO Grade-9 tables: Lunch Break gridSpan=6 (swallows the Teacher column). aral-prog: HEALTH BREAK span=7, LUNCH span=8. Teacher program: break merges cover Subject..Bldg/Room. -> No single break-merge contract; export must pin one geometry (or render unmerged per-cell).
- **C4 - Minutes math inconsistencies (content-level).** (a) jpg (Grade 9, SY 2026-2027) row "9:45 - 10:30" carries minutes "60" while the subject cell reads "Science (45min)" and the span is 45 min. (b) DNO daily totals are 420/510 Mon-Thu but 405/495 Friday because Friday ARAL (60) becomes "TLE *45 min only". (c) 40-minutes contains three mutually inconsistent time grids: Sheet1 (lunch 11:20-12:15; class slot 3:30-3:45; ends 5:15-6:00), Sheet2 (lunch 11:30-12:15; slots 3:15-4:00...5:30-6:15), Sheet3 (10:00-10:45...5:45-6:30). (d) quarter-3 uses 40-minute periods (10:00-10:40) with a 9:30-10:45 overlap row on Sheet3 of 40-minutes. -> **DECISION_REQUIRED candidate** for the authoritative period length + ARAL/Friday rule.
- **C5 - Break mislabelling.** CLASS-PROGRAM-v2 labels the 11:30-1:00 band (90 min) "Health Break"; DNO/40-minutes/quarter-3 use "Lunch Break" for the midday band and a short "Health Break"/"RECESS". -> Label contract needed.
- **C6 - Placeholder teacher identities leak into beneficiary artifacts.** Literal names "TEACHER X" (40-minutes Sheet1 Q14; CLASS-PROGRAM-2025-2026 SUMMARY Q1 PAGE1 rows 3:15-4:00 and 4:00-4:45), "ESP X" and "MAPEH X" (SUMMARY workbook per-subject panels, red headers). -> Export must not surface unresolved placeholders; needs a rule (exclude or render placeholder).
- **C7 - Term model vs quarter model.** The only three-term evidence is the CamScanner DepEd calendar (SY 2026-2027: T1 Jun 8 - Sep 15 2026; T2 Sep 16 - Dec 18 2026; T3 Jan 4 - Apr 8 2027; the Term 3 banner prints "2026" - a source typo). Conversely the historical workbooks are quarter-based (CLASS-PROGRAM-SY-2025-2026 sheets "SUMMARY Q1 PAGE1/2/3", "Q1-BIOLOGY".."Q4-PHYSICS"; quarter-3 workbook titled "Q3 ... 2025-2026"). Every export artifact is single-term/flat with no term column. -> **DECISION_REQUIRED candidate**: the ordered-term contract must govern exports; quarter labels must not reappear.
- **C8 - Print-area truncation in the SUMMARY workbook.** 'SUMMARY' print_area = `$B$40:$N$77` renders only the second cohort (cols C-N), drops column O, drops the first cohort (rows 1-38) and drops the AA/AF signatories. A PDF/print export of this sheet is materially incomplete. -> An export defect, not just a doc quirk.
- **C9 - Hidden content inside beneficiary workbooks.** 40-minutes Sheet1 rows 16-19 hidden; CLASS-PROGRAM-SY-2025-2026 hidden column P (w=1.71, hidden=True). -> Export must define hidden-row/column behaviour.
- **C10 - Room field missing from the class-program template.** DNO-CLASS-PROGRAM-TEMPLATE-2026-2027 has no BLDG/ROOM row, while aral-prog, 40-minutes, quarter-3 occupancy and BOTH 2026-2027 teacher programs carry Bldg/Room. -> Export must decide room inclusion in the class program.
- **C11 - Learner counts present only in the jpg.** DNO leaves Male/Female/Total as blanks; the only populated instance is the Grade 9 FE DEL MUNDO photo (14/20/34). -> Whether the export must render learner counts is unclear.
- **C12 - No canonical shift model.** Morning (DNO G7 6:00-14:00), afternoon (DNO G9 from 11:15; 40-minutes 10:00-18:00; "SPEC-PROG-AFTERNOON"), and 7:00-16:45 (CLASS-PROGRAM-2025-2026) all appear. -> Export must not hard-code one shift.
- **C13 - Flag/HGP rendered two different ways.** Day-scoped overlay sharing the period (DNO 6:00-6:45 Mon Flag / Tue-Fri TLE; CLASS-PROGRAM-v2 Monday HGP inside the 7:30-8:15 slot) vs a dedicated 5-day FLAG CEREMONY row (CLASS-PROGRAM-2025-2026 7:00-7:30; 40-minutes shows no flag row). -> Pin the Monday-only overlay contract.
- **C14 - Class-program "No. of minutes" column absent in shape-B artifacts.** aral-prog, 40-minutes, CLASS-PROGRAM-2025-2026 and quarter-3 have no minutes column while DNO/jpg/CLASS-PROGRAM-v2 do. -> Export field set must be explicit.

---

# 4. HISTORICAL-ONLY CLASSIFICATION
Classified as HISTORICAL LAYOUT / ROOM EVIDENCE ONLY (never the 2026-2027 contract):
- `CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx` - SY 2025-2026; quarter sheets Q1-Q4. Rendered; VIS = SUMMARY Q1 PAGE1 only.
- `quarter-3_grade-10-schedule-monitoring.xlsx` - sheet titles "Q3 SPECIAL PROGRAM SCHEDULE OF CLASSES 2025-2026" and "Q3 GRADE 10 MONITORNG SHEET"; SY 2025-2026. Rendered; VIS = 'schedule summary' p1.
- `root-reference/40-minutes.xlsx` - "GRADE 9 CLASS PROGRAM, SY 2025-2026" (Sheet1). Highest-fidelity layout+branding reference, but prior-year. Rendered; VIS 4/39 pages.
- `root-reference/Teachers-PROGRAM.docx` - "SY 2025-2026"; ARAL Program 60 mins (contrast: 2026-2027 = 0 min).
- `root-reference/CLASS-PROGRAM-v2.docx` - "SY 2025-2026"; Grade 7 AGONCILLO.
- `BLDG3-BLDG-9-occupancy-plan-2023-24.docx` (7CE045D7...), `GARDE-8-OCCUPANCY-PLAN.docx` (E0A0EC51...), `OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx` (93DB576A...) - 2023-2024 occupancy; HISTORICAL ROOM EVIDENCE ONLY (not rendered - time-boxed).
- `GRADE-7-OCCUPANCY-PLAN.pdf` (CB321E7B...) - no SY on the face; room/adviser occupancy layout (Building 10). Treat as layout/room evidence, not a term contract.
NOT stakeholder schedule layouts (product/technical context only):
- `root-reference/Curio_Gilera_Gromea_ATLAS_BSIT3B.pdf` - capstone manuscript (ERD/methodology). Sampled p1/p30/p55.
- `root-reference/question_prompt.pdf` - defense Q&A. Sampled p1.
- `D:/EnrollPro/docs/HNHS.pdf` (READ_ONLY) - system proposal deck covering ATLAS/AIMS. Sampled p1/p10/p14/p20.
CURRENT-CONTRACT evidence (2026-2027):
- `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx`, `aral-prog_G7_Class-Program_SY2026-2027docx.docx`, `Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx` (SY 2026-2027), the 3 root images (2 teacher programs + 1 Grade 9 class-program photo, all SY 2026-2027), and the CamScanner three-term calendar.
- `root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx` - SY 2026-2027 (current), though its SUMMARY sheet still duplicates and truncates.

---

# 5. LIMITATIONS

## 5.1 BLOCKING renderer limitation
- `EXTERNALLY_BLOCKED(RENDERER_UNAVAILABLE)` for **every DOCX visual render**. Word 16.0 COM opens documents and reports page/page/word counts, but PDF export hangs indefinitely. Reproduced on: ExportAsFixedFormat, SaveAs2(pdf,17), PrintOut(PrintToFile=true, "Microsoft Print to PDF"), and python `docx2pdf`. A **trivial blank document** also hangs, proving it is not the source DOCX. Excel 16.0 COM export works on the same host (38/38 sheets produced PDFs), so the spooler/printer stack is functional. Consequently all DOCX layout claims in section 2 come from structural extraction (gridSpan / vMerge / section geometry / header-footer / table order) plus the two teacher-program photos and the class-program photo, NOT from a rendered DOCX page. This must be closed by another renderer before any visual-fidelity acceptance.

## 5.2 Non-blocking coverage limitations
- DOCX page counts obtained only for DNO (4 pages) and aral-prog (5 pages); the batch page-count pass timed out, so Teachers-PROGRAM_SPEC, Teachers-PROGRAM-root, CLASS-PROGRAM-v2 and the three 2023-2024 occupancy DOCX have no page count recorded.
- 2023-2024 occupancy DOCX/PDF not rendered (historical, time-boxed).
- Curio (97 pp) and HNHS (27 pp) were sampled (3-4 pages each) to classify relevance; no page-by-page review was attempted.
- CLASS-PROGRAM-SY-2025-2026 (14 sheets) and quarter-3 (11 sheets) had 1 sheet each visually inspected; all sheets were rendered to PNG and structurally extracted, but the remaining sheets were not individually eyeballed (time-boxed classification).
- SUMMARY workbook: 7/10 sheets visually inspected (ENGLISH, FIL, AP are STRUCT-only).
- 40-minutes: 4 of 39 rendered pages visually inspected (historical).
- `quarter-3_grade-10-schedule-monitoring.xlsx` fails `openpyxl.load_workbook` ("could not read worksheets ... invalid XML"); structural data was instead taken via read-only Excel COM open (11 sheets, used ranges, print areas, orientation, cell dump) plus the rendered PDFs. No write/save was performed.
- Excel/Word COM automation is host-global; only one lane may use it at a time. This lane serialized its own use and left zero WINWORD/EXCEL processes.

## 5.3 Side effects performed and reverted
- Word/Excel COM instances started for rendering (all terminated).
- The host default printer changed during Word probing; it was restored to its original value `POS58 Printer(3)` (verified).
- No repository file was created, modified or deleted; no branch/ref/commit/index change was made.

---

# 6. EXACT COMMANDS RUN (compact)
Read-only git / identity:
- `git -C D:/ATLAS rev-parse origin/main`
- `git -C E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 rev-parse HEAD`
- `git -C E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 status --short`
- `git -C D:/ATLAS status --porcelain=v2`
Hashing (PowerShell `Get-FileHash -Algorithm SHA256`) for the 14 pinned + 6 extra artifacts.
Copy to temp: `Copy-Item` of stakeholderFiles/*, root images, EnrollPro/docs/HNHS.pdf into `<lane>\src`; `Unblock-File` on the temp copies.
Structural extraction (scripts in `<lane>\scripts`, outputs in `<lane>\extract`):
- `python scripts\xlsx_extract.py src extract` (openpyxl: sheet states, dimensions, merged ranges, print_area, orientation, freeze, col/row hidden+size, formulas vs cached)
- `python scripts\docx_extract.py src extract` (python-docx: section geometry, headers/footers, inline_shapes, block order, tables with gridSpan/vMerge)
DOCX render attempts (all logged, all blocked):
- `powershell scripts\docx2pdf.ps1` (ExportAsFixedFormat, 17) -> hang
- `powershell scripts\probe2.ps1` (SaveAs2 17) -> hang
- `powershell scripts\probe3.ps1` (ActivePrinter "Microsoft Print to PDF") -> hang
- `powershell scripts\probe4.ps1` (PrintOut PrintToFile) -> hang
- `powershell scripts\probe6.ps1` (trivial new doc export) -> hang
- `python -c "from docx2pdf import convert; convert(...)"` -> hang >= 120 s
Word measurement only (open + ComputeStatistics): `powershell scripts\docxpages.ps1`
XLSX render (worked): `powershell scripts\xlsx2pdf.ps1` (Excel COM, `ws.ExportAsFixedFormat(0, pdf)` per sheet)
quarter-3 structural via Excel COM (read-only): `powershell scripts\q3struct.ps1`
PDF -> PNG: `powershell scripts\pdf2png.ps1` (Windows.Data.Pdf, DestinationWidth=1600)
Printer restore: `(New-Object -ComObject WScript.Network).SetDefaultPrinter("POS58 Printer(3)")`

Temp evidence paths (all under `%TEMP%\opencode\stakeholder-export-parity-c05\lane-a\`):
- `src\` - byte-identical copies of the 20 opened artifacts
- `docx-pdf\` - empty/partial (Word export blocked)
- `xlsx-pdf\` - 38 per-sheet PDFs (no quarter-3 ... yes, 11 quarter-3 + 10 SUMMARY + 3 x 40-minutes + 14 CLASS-PROGRAM = 38)
- `pdf-png\` - 272 PNGs (all PDFs and all workbook sheets)
- `extract\` - 4 workbook + 8 DOCX structural dumps
- `scripts\` - extraction/render scripts
- `report.md` - this report
- logs: `docx2pdf.log`, `probe2..7.log`, `xlsx2pdf.log`, `pdf2png.log`, `q3struct.log`

# 7. LANE CONCLUSION
Artifact and layout evidence is complete and pinned: all 14 hashes MATCH; 38/38 workbook sheets rendered; 272 PDF pages converted to PNG; 29 images visually inspected across workbooks, PDFs and root photos; quarter-3 recovered structurally via Excel COM after an openpyxl XML failure. The single gap is DOCX visual rendering, which is `EXTERNALLY_BLOCKED(RENDERER_UNAVAILABLE(Word PDF export))` and must be closed before any visual-fidelity acceptance of the class-program/teacher-program DOCX templates. Fourteen cross-artifact conflicts (C1-C14) are recorded above; C1, C2, C4, C7, C11, C12, C13 are the strongest DECISION_REQUIRED candidates for the primary planner.
