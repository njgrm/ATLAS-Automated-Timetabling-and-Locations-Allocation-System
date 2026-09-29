/**
 * A7 C8 SLICE 1 — the type-scale / control-size ratchet.
 *
 * Operator, 2026-09-29 16:40 and 16:48: *"There is a lot of text that is too small,
 * which fails accessibility. Lock in."* and *"Our default text and sizes should
 * naturally be bigger."* Audience: older, mouse-first schedulers.
 *
 * This file is the gate that makes that a LOCK rather than a change. It is wired
 * into `atlas-client/package.json` twice on purpose — a named script
 * (`test:ux-type-scale-a7c8`) AND an entry in `test:client-suite`'s file list —
 * because AGENTS.md §11: "A test no gate runs is not evidence." A test reachable
 * from only one of the two would survive a well-meaning edit to either.
 *
 * A7C8-4 IS A REAL COMPILE, NOT A SOURCE-TEXT ASSERTION. A grep for `--text-xs` in
 * `index.css` proves a string exists; it does not prove Tailwind emitted it, that
 * the `@theme` block was the one Tailwind reads, or that the paired line height
 * survived. So this row compiles the REAL `src/index.css` with the real candidate
 * classes through `@tailwindcss/node` and then asks a real CSS engine what
 * `text-xs` and `text-sm` COMPUTE to. The same harness
 * `timetable-header-collapse-c01.test.tsx` already uses, for the same reason.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compile, optimize } from '@tailwindcss/node';

const here = fileURLToPath(new URL('.', import.meta.url));
const clientRoot = resolve(here, '..', '..', '..');
const srcRoot = join(clientRoot, 'src');

const SOURCE_EXT = /\.(tsx?|jsx?)$/;
/** A test file is evidence, not product: the ratchet is about what ships. */
const isTestFile = (abs: string) =>
	abs.includes(`${sep}__tests__${sep}`) || /\.(test|spec)\.(tsx?|jsx?)$/.test(abs);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			// `node_modules` never appears under `src`, but a future build output
			// directory would silently become "production source" without this.
			if (entry.name === 'node_modules' || entry.name === 'dist') continue;
			walk(abs, out);
		} else if (SOURCE_EXT.test(entry.name) && statSync(abs).isFile()) {
			out.push(abs);
		}
	}
	return out;
}

const PRODUCTION_FILES = walk(srcRoot).filter((f) => !isTestFile(f));

/**
 * Remove JSX/JS comments before matching a LITERAL.
 *
 * This has to be right, and the way it was got wrong first is worth recording: a
 * rule that counts a mention inside a comment is a rule that names files which only
 * talk about the string. On the base commit, `More filters` appears in ELEVEN
 * production files and in only TWO of them as anything a user can see — the other
 * nine are prose in a design note explaining why the disclosure is being deleted.
 * An allowlist built from the un-stripped text would have recorded nine files that
 * no user will ever see and would have let a real third occurrence through.
 */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			if (
				trimmed.startsWith('//') ||
				trimmed.startsWith('*') ||
				trimmed.startsWith('/*')
			) {
				return '';
			}
			const i = line.indexOf('//');
			// A trailing `//` starts a comment unless it is a URL scheme (`https://`).
			return i > 0 && line[i - 1] !== ':' ? line.slice(0, i) : line;
		})
		.join('\n');
}

const rel = (abs: string) => relative(srcRoot, abs).split(sep).join('/');

/** Every production file whose COMMENT-STRIPPED text contains `needle`, with lines. */
function findInProduction(needle: RegExp): { file: string; line: number; text: string }[] {
	const hits: { file: string; line: number; text: string }[] = [];
	for (const abs of PRODUCTION_FILES) {
		const lines = stripComments(readFileSync(abs, 'utf8')).split('\n');
		lines.forEach((text, i) => {
			needle.lastIndex = 0;
			if (needle.test(text)) hits.push({ file: rel(abs), line: i + 1, text: text.trim() });
		});
		needle.lastIndex = 0;
	}
	return hits;
}

test('A7C8-1: no production file declares an arbitrary sub-14px type size', () => {
	// The 137 occurrences this slice removed were all one of these four. The gate is
	// on the TOKEN, not on a count, so a reintroduction of any of them fails and a
	// legitimate `text-[0.8125rem]` is untouched.
	const hits = findInProduction(/text-\[(?:9|10|11|12)px\]/);
	assert.deepEqual(
		hits.map((h) => `${h.file}:${h.line}  ${h.text}`),
		[],
		'A7C8-1: `text-[9px]`/`[10px]`/`[11px]`/`[12px]` are 9-12px and are all below the ' +
			'14px floor this slice set. Use `text-xs` (now 14px) or a named size. The operator ' +
			'asked for larger default text; this row is what stops it shrinking back.',
	);
});

// ═══════════════════════════════════════════════════════════════════════════
// A7C8-1 .. A7C8-4 ABOVE WERE THE SLICE'S ORIGINAL GATE. A7C8-1 IS A HARD FAIL
// ON THE `text-[9|10|11|12]px]` VALUES AND IT STAYS EXACTLY AS IT WAS — IT IS NOT
// PART OF ANY ALLOWLIST, AND NOTHING BELOW WEAKENS IT.
//
// WHAT WAS WRONG WITH IT, AND WHY 5 AND 6 EXIST. The planner rendered Sections,
// Subjects and Teachers on real staging data at 1366x768 after this slice landed
// and measured text at 9.6-11.2px with a ux-audit MAJOR count of 17/21/15. The
// tokens were right — `text-xs` computed to 14px — but those pages are still
// broken, because the sizes that are actually on them are written in REM:
// `text-[0.65rem]` (10.4px), `text-[0.625rem]` (10px), `text-[0.6875rem]` (11px),
// `text-[0.8rem]` (12.8px). A7C8-1 matches a PX LITERAL only, so it reported a
// clean page while that page was rendering 10px type.
//
// A GATE THAT CERTIFIES "NO TEXT UNDER 14px" WHILE IGNORING AN ENTIRE UNIT CLASS
// IS FALSE ASSURANCE — WORSE THAN NO GATE, because it converts an unfixed
// operator complaint into a green tick. So the detection rule below is UNIT-SAFE
// AND GENERAL: it parses the numeric value and converts it (rem/em x16, pt x4/3,
// px as written) before comparing against the floor. Nothing here enumerates the
// values that happen to exist today.
// ═══════════════════════════════════════════════════════════════════════════

/** The operator's floor: "There is a lot of text that is too small" — nothing under 14px. */
const MIN_TEXT_PX = 14;
/** Tailwind's initial root font size; the same 16px A7C8-4 derives rem against. */
const ROOT_FONT_PX = 16;

/**
 * One `text-[<length>]` arbitrary font size, unit optional.
 *
 * THE SHAPE IS DELIBERATE: the bracket content must be a bare number with an
 * optional unit, so `text-[#0f172a]`, `text-[rgb(2_6_23)]` and `text-[50%]` do not
 * match. Those are colours and relative sizes, not type sizes, and flagging them
 * would be noise that trains people to ignore the row. A `%` font-size is
 * genuinely not comparable to a px floor without knowing its parent's size, so it
 * is left out rather than guessed at; see `arbitraryFontSizePx`.
 */
const ARBITRARY_SIZE_TOKEN = /text-\[\s*(\d*\.?\d+)(px|rem|em|pt)?\s*\]/;
const ARBITRARY_SIZE_SCAN = new RegExp(ARBITRARY_SIZE_TOKEN.source, 'g');

/**
 * The px a `text-[...]` token computes to, or `undefined` when it is not a font
 * size at all / not comparable to a px floor.
 *
 * Returning `undefined` rather than a guess is the point: a detector that invents
 * a number for a value it cannot resolve becomes a gate that is wrong in the
 * direction nobody notices.
 */
function arbitraryFontSizePx(token: string): number | undefined {
	const m = ARBITRARY_SIZE_TOKEN.exec(token);
	if (!m) return undefined;
	const n = Number.parseFloat(m[1]);
	switch (m[2]) {
		// A bare number is CSS-invalid, so Tailwind treats it as px. Match that.
		case undefined:
		case 'px':
			return n;
		// `em` resolves against the ELEMENT's own inherited size, which is not
		// knowable here. Treating it as the root is the closest safe reading and it
		// still errs toward flagging, which is the correct direction for a floor.
		case 'rem':
		case 'em':
			return n * ROOT_FONT_PX;
		case 'pt':
			return (n * 96) / 72;
		default:
			return undefined;
	}
}

/**
 * A7C8-5 — THE PARSER IS GENERAL, NOT A LIST OF TODAY'S VALUES.
 *
 * This is the row that stops the rule rotting back into an enumeration. It feeds
 * the detector values the repository does NOT contain (`text-[0.3rem]`, `text-[8px]`,
 * `text-[1pt]`) plus the non-type arbitrary values it must NOT flag, so a future
 * slice cannot satisfy the gate by editing the allowlist when a NEW sub-14px value
 * appears — the arithmetic itself is pinned here.
 */
test('A7C8-5: arbitrary font sizes are detected in px, rem and pt, and non-sizes are not', () => {
	/** [token, expected px or undefined] */
	const cases: [string, number | undefined][] = [
		// px — including values below the floor that no longer exist in production.
		['text-[9px]', 9],
		['text-[13px]', 13],
		['text-[14px]', 14],
		['text-[8px]', 8],
		['text-[22px]', 22],
		// rem at the 16px root — the values that are actually breaking the three pages.
		['text-[0.5rem]', 8],
		['text-[0.5625rem]', 9],
		['text-[0.625rem]', 10],
		['text-[0.65rem]', 10.4],
		['text-[0.6875rem]', 11],
		['text-[0.7rem]', 11.2],
		['text-[0.75rem]', 12],
		['text-[0.8rem]', 12.8],
		['text-[0.8125rem]', 13],
		// rem at and above the floor must NOT be flagged.
		['text-[0.875rem]', 14],
		['text-[1rem]', 16],
		// A value the repo has never had, to prove nothing is enumerated.
		['text-[0.3rem]', 4.8],
		// pt is a real authored unit for a font size and must convert, not be ignored.
		['text-[1pt]', 96 / 72],
		['text-[0.5pt]', 48 / 72],
		// Whitespace inside the bracket is legal and must not hide the value.
		['text-[ 0.65rem ]', 10.4],
		// NOT font sizes — a colour, a ratio, a relative size, and a text colour.
		['text-[#0f172a]', undefined],
		['text-[rgb(2_6_23)]', undefined],
		['text-[50%]', undefined],
		['text-[length:var(--x)]', undefined],
		// Not the font-size utility at all.
		['text-slate-400', undefined],
		['text-xs', undefined],
	];

	const wrong = cases
		.map(([token, want]) => ({ token, want, got: arbitraryFontSizePx(token) }))
		.filter((c) => c.got !== c.want);
	assert.deepEqual(
		wrong,
		[],
		'A7C8-5: the arbitrary font-size parser mis-resolved a token:\n  ' +
			wrong.map((c) => `${c.token} -> ${String(c.got)} (expected ${String(c.want)})`).join('\n  '),
	);

	// The floor itself, stated once, from the parser — so "does it detect rem" and
	// "is the floor 14px" cannot drift apart.
	for (const token of ['text-[0.65rem]', 'text-[10px]', 'text-[9pt]']) {
		const px = arbitraryFontSizePx(token);
		assert.ok(
			px !== undefined && px < MIN_TEXT_PX,
			`A7C8-5: ${token} must resolve below the ${MIN_TEXT_PX}px floor, got ${px}`,
		);
	}
	for (const token of ['text-[0.875rem]', 'text-[14px]', 'text-[11pt]']) {
		const px = arbitraryFontSizePx(token);
		assert.ok(
			px !== undefined && px >= MIN_TEXT_PX,
			`A7C8-5: ${token} must resolve at or above the ${MIN_TEXT_PX}px floor, got ${px}`,
		);
	}
});

/**
 * A7C8-6 — THE SUB-14px RATCHET OVER THE PRE-EXISTING POPULATION. READ THIS
 * BEFORE "FIXING" IT, AND BEFORE ADDING TO IT.
 *
 * THE PACKET ASKED FOR A HARD FAIL HERE AND A HARD FAIL IS NOT AVAILABLE TODAY.
 * 264 production occurrences of an arbitrary font-size that computes below 14px
 * are real, still-shipped, user-visible text — 255 of them in rem. They are not
 * this slice's: this slice removed exactly 137 (401 -> 264 in production), and
 * every one of those 137 was a px literal. A hard-fail gate on `main` right now
 * is a RED `main`, which is not landable and trains everyone to ignore the gate.
 *
 * SO: a RATCHET WITH A NAMED, DATED, OWNER-TAGGED ALLOWLIST, the same shape as
 * A7C8-2 above. The allowlist is keyed by `<file>|text-[<value>]` -> OCCURRENCE
 * COUNT, not by line number. Line numbers would be the more obvious key and the
 * worse one: a single unrelated edit above a site shifts its line and the gate
 * fails for no reason, which is how ratchets get deleted. Keying on file+value
 * survives line drift, and carrying the COUNT is what stops `text-[0.6875rem]`
 * being added twenty more times to a file that already has twenty.
 *
 * IT FAILS IN ALL THREE DIRECTIONS:
 *   - a NEW file or a NEW value appears            -> fails (no new sub-14px text)
 *   - an EXISTING count goes UP                     -> fails (no growth)
 *   - a recorded site is REMOVED, i.e. a site is FIXED -> ALSO fails, deliberately
 * The last one is the point: fixing a site has to be a RECORDED event in which the
 * owner edits this list in the same commit, so the retirement is visible in the
 * diff instead of a silent drift nobody can audit. A gate that only fails on new
 * violations rewards nobody for fixing anything.
 *
 *   ALLOWLIST RECORDED 2026-09-29 (A7 C8 slice 1) — 89 keys, 264 occurrences,
 *   57 files. 255 occurrences are rem; 9 are `text-[13px]` (pre-existing, in
 *   `components/faculty-dashboard/` and `components/faculty-shared/`). Both
 *   populations are in here because BOTH are real sub-14px text and leaving the
 *   px ones out would reintroduce exactly the px-only blind spot this row exists
 *   to close.
 *
 *   OWNER: A7 C8 RE-FIT PASS (the next slice), which raises these to 14px and
 *   re-fits each surface. Several of these sites sit in FIXED-HEIGHT boxes, so a
 *   blind bump to `text-xs` clips them — that is why this is its own slice with
 *   rendered proof per surface, and why this commit does not touch them.
 *   Per-file inventory: docs/reviews/a7-c8-type-scale/sub-14px-rem-inventory.md
 *
 *   DO NOT ADD AN ENTRY. An entry is not a permission slip; it is a claim that
 *   this sub-14px text is intended and still needed. If a new site is unavoidable,
 *   say so in review rather than in this map.
 */
const UNDER_14PX_ALLOWLIST_2026_09_29: Record<string, number> = {
	'components/BuildingPanel.tsx|text-[0.6875rem]': 23,
	'components/BuildingPanel.tsx|text-[0.72rem]': 5,
	'components/BuildingPanel.tsx|text-[0.8125rem]': 1,
	'components/CampusMapEditor.tsx|text-[0.65rem]': 2,
	'components/CampusMapEditor.tsx|text-[0.7rem]': 2,
	'components/CampusMapEditor.tsx|text-[0.75rem]': 1,
	'components/ConflictInspectorSheet.tsx|text-[0.625rem]': 2,
	'components/ConflictInspectorSheet.tsx|text-[0.6875rem]': 2,
	'components/ExplainabilityDrawer.tsx|text-[0.625rem]': 6,
	'components/LockPanel.tsx|text-[0.5rem]': 2,
	'components/LockPanel.tsx|text-[0.5625rem]': 4,
	'components/LockPanel.tsx|text-[0.625rem]': 20,
	'components/LockPanel.tsx|text-[0.6875rem]': 11,
	'components/ManualEditPanel.tsx|text-[0.55rem]': 5,
	'components/ManualEditPanel.tsx|text-[0.5625rem]': 5,
	'components/ManualEditPanel.tsx|text-[0.625rem]': 9,
	'components/ManualEditPanel.tsx|text-[0.65rem]': 4,
	'components/ManualEditPanel.tsx|text-[0.6875rem]': 6,
	'components/PolicyImpactSummary.tsx|text-[0.5625rem]': 1,
	'components/PolicyImpactSummary.tsx|text-[0.625rem]': 3,
	'components/PolicyImpactSummary.tsx|text-[0.6875rem]': 1,
	'components/SchedulingPolicyPane.tsx|text-[0.625rem]': 2,
	'components/SchedulingPolicyPane.tsx|text-[0.6875rem]': 8,
	'components/TutorialOverlay.tsx|text-[0.625rem]': 1,
	'components/admin-workspace/AdminDataTable.tsx|text-[0.7rem]': 5,
	'components/admin-workspace/AdminWorkspace.tsx|text-[0.65rem]': 3,
	'components/audit/AuditFindingsPanel.tsx|text-[0.68rem]': 2,
	'components/campus-map/BuildingGradeScopeControl.tsx|text-[0.6875rem]': 2,
	'components/campus-map/BuildingGradeScopeControl.tsx|text-[0.72rem]': 1,
	'components/campus-map/BuildingPlacementFields.tsx|text-[0.6875rem]': 4,
	'components/campus-map/BuildingPlacementFields.tsx|text-[0.72rem]': 1,
	'components/dashboard/LifecycleSummary.tsx|text-[0.6875rem]': 1,
	'components/dashboard/NextActionPanel.tsx|text-[0.65rem]': 1,
	'components/dashboard/RoomSchedulePreview.tsx|text-[0.5625rem]': 2,
	'components/dashboard/RoomSchedulePreview.tsx|text-[0.625rem]': 4,
	'components/dashboard/RoomSchedulePreview.tsx|text-[0.6875rem]': 2,
	'components/dashboard/SetupChecklist.tsx|text-[0.625rem]': 1,
	'components/faculty-assignments/AutoFillSummaryModal.tsx|text-[0.7rem]': 3,
	'components/faculty-assignments/SubjectRow.tsx|text-[0.75rem]': 1,
	'components/faculty-dashboard/ActionQueue.tsx|text-[13px]': 1,
	'components/faculty-dashboard/FacultyObjectiveStateCard.tsx|text-[13px]': 1,
	'components/faculty-dashboard/MobileDashboardLayout.tsx|text-[13px]': 3,
	'components/faculty-dashboard/TeachingIdentityPanel.tsx|text-[13px]': 3,
	'components/faculty-shared/FacultyGlobalHeader.tsx|text-[13px]': 1,
	'components/faculty/FacultyProfileSheet.tsx|text-[0.65rem]': 5,
	'components/faculty/FacultyProfileSheet.tsx|text-[0.7rem]': 7,
	'components/faculty/FacultyRow.tsx|text-[0.6rem]': 3,
	'components/faculty/FacultyRow.tsx|text-[0.65rem]': 6,
	'components/room-schedules/OccupancyTemplatePreview.tsx|text-[0.625rem]': 1,
	'components/scheduling-policy/PolicyPaneConstraintWeights.tsx|text-[0.6875rem]': 1,
	'components/scheduling-policy/PolicyPanePrimitives.tsx|text-[0.5625rem]': 1,
	'components/scheduling-policy/PolicyPanePrimitives.tsx|text-[0.625rem]': 2,
	'components/scheduling-policy/PolicyPanePrimitives.tsx|text-[0.6875rem]': 2,
	'components/scheduling-policy/PolicyPaneSchedulingMode.tsx|text-[0.6875rem]': 2,
	'components/scheduling-policy/SchedulingPolicyDialogs.tsx|text-[0.6875rem]': 4,
	'components/scheduling-policy/ShiftSettingsEditor.tsx|text-[0.6875rem]': 4,
	'components/sections/SectionDetailsSheet.tsx|text-[0.6875rem]': 11,
	'components/sections/SectionDetailsSheet.tsx|text-[0.7rem]': 2,
	'components/sections/SectionRow.tsx|text-[0.6875rem]': 5,
	'components/smart/AccessibleInfo.tsx|text-[0.65rem]': 1,
	'components/subjects/ProgramScopeChips.tsx|text-[0.6rem]': 1,
	'components/subjects/SubjectFormModal.tsx|text-[0.7rem]': 1,
	'components/subjects/SubjectMobileCard.tsx|text-[0.65rem]': 2,
	'components/subjects/SubjectMutationDetailPopover.tsx|text-[0.65rem]': 1,
	'components/subjects/SubjectRow.tsx|text-[0.6rem]': 1,
	'components/subjects/SubjectRow.tsx|text-[0.65rem]': 2,
	'components/subjects/SubjectRow.tsx|text-[0.7rem]': 3,
	'components/subjects/SyncPreviewSheet.tsx|text-[0.6rem]': 1,
	'components/subjects/SyncPreviewSheet.tsx|text-[0.65rem]': 1,
	'components/timetable/GeneratedRunRailPanels.tsx|text-[0.6875rem]': 2,
	'components/timetable/ScheduleReviewWorkspaceHeader.tsx|text-[0.68rem]': 1,
	'components/timetable/ScheduleReviewWorkspaceTaskModes.tsx|text-[0.65rem]': 1,
	'components/timetable/SimplePublishReadinessSheet.tsx|text-[0.625rem]': 1,
	'components/timetable/SimplePublishReadinessSheet.tsx|text-[0.65rem]': 2,
	'components/timetable/TacticalSandboxDock.parts.tsx|text-[0.65rem]': 1,
	'components/timetable/TeacherDepartureRecoverySheet.tsx|text-[0.6rem]': 1,
	'components/timetable/TeacherDepartureRecoverySheet.tsx|text-[0.64rem]': 1,
	'components/timetable/TimetableStatusLegend.tsx|text-[0.68rem]': 1,
	'components/timetable/TimetableTaskDrawer.tsx|text-[0.65rem]': 1,
	'components/timetable/TimetableTaskDrawer.tsx|text-[0.68rem]': 4,
	'components/timetable/TimetableTaskDrawer.tsx|text-[0.7rem]': 1,
	'components/timetable/UnassignedInsertionWorkflow.tsx|text-[0.7rem]': 1,
	'components/timetable/modals/ReviewActionSheet.tsx|text-[0.68rem]': 1,
	'components/timetable/modals/TimetablePlacementDialogs.tsx|text-[0.68rem]': 1,
	'components/timetable/simple/SimpleTaskDrawerHelpers.tsx|text-[0.625rem]': 1,
	'components/timetable/simple/SimpleTaskDrawerHelpers.tsx|text-[0.6875rem]': 2,
	'pages/HowItWorks.tsx|text-[0.6875rem]': 1,
	'pages/SpecializationMapping.tsx|text-[0.65rem]': 1,
	'ui/button-variants.ts|text-[0.8rem]': 1,
};

test('A7C8-6: no arbitrary sub-14px font size outside the dated, owner-tagged ratchet', () => {
	// Scan production, comment-stripped, counting EVERY match on a line (not one per
	// line) so `text-[0.625rem] text-[0.6875rem]` counts twice, as it renders.
	const counts = new Map<string, number>();
	for (const abs of PRODUCTION_FILES) {
		stripComments(readFileSync(abs, 'utf8'))
			.split('\n')
			.forEach((line) => {
				ARBITRARY_SIZE_SCAN.lastIndex = 0;
				let m: RegExpExecArray | null;
				while ((m = ARBITRARY_SIZE_SCAN.exec(line)) !== null) {
					const token = m[0].replace(/\s+/g, '');
					const px = arbitraryFontSizePx(token);
					if (px === undefined || px >= MIN_TEXT_PX) continue;
					const key = `${rel(abs)}|${token}`;
					counts.set(key, (counts.get(key) ?? 0) + 1);
				}
			});
	}

	const found = [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	const recorded = Object.entries(UNDER_14PX_ALLOWLIST_2026_09_29).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	);

	const added = found.filter(([k]) => !UNDER_14PX_ALLOWLIST_2026_09_29[k]);
	const removed = recorded.filter(([k]) => !counts.has(k));
	const grown = found.filter(([k, c]) => UNDER_14PX_ALLOWLIST_2026_09_29[k] < c);

	assert.deepEqual(
		added,
		[],
		'A7C8-6: NEW sub-14px arbitrary font size(s) in production.\n  ' +
			added.map(([k, c]) => `${k}  x${c}  (${arbitraryFontSizePx(k.split('|')[1])}px)`).join('\n  ') +
			'\n  The floor is 14px and `text-xs` IS 14px, so there is no reason to reach for ' +
			'an arbitrary value. Use a named size, or fix the box the text is overflowing.',
	);
	assert.deepEqual(
		grown,
		[],
		'A7C8-6: a recorded site GREW — the ratchet counts occurrences, not just files.\n  ' +
			grown.map(([k, c]) => `${k}  was ${UNDER_14PX_ALLOWLIST_2026_09_29[k]}, now ${c}`).join('\n  '),
	);
	assert.deepEqual(
		removed,
		[],
		'A7C8-6: a recorded site is GONE, which also fails on purpose.\n  ' +
			removed.map(([k]) => k).join('\n  ') +
			'\n  A fix has to be a recorded event: delete the matching entry from ' +
			'UNDER_14PX_ALLOWLIST_2026_09_29 in the SAME commit that removes the site, so the ' +
			'retirement is reviewable. Do not silence this row; shorten the list.',
	);

	// The totals are pinned, not just the membership, so a silent deletion or an
	// off-by-one in the count cannot hide behind a matching set of keys.
	assert.equal(
		recorded.length,
		89,
		'A7C8-6: the allowlist must hold exactly 89 keys (recorded 2026-09-29).',
	);
	assert.equal(
		found.reduce((a, [, c]) => a + c, 0),
		264,
		'A7C8-6: production must hold exactly 264 sub-14px arbitrary font-size ' +
			'occurrences (255 rem + 9 text-[13px]). Update this number and the ' +
			'inventory doc in the same commit that changes it.',
	);
});

/**
 * A7C8-2 — THE `More filters` RATCHET. READ THIS BEFORE "FIXING" IT.
 *
 * THE PACKET ASKED FOR A HARD FAIL AND A HARD FAIL IS NOT AVAILABLE TODAY. The
 * packet's own two production occurrences of the literal `More filters` are real,
 * still-shipped user-visible text, and they belong to A5 C8 — the filter-bar work
 * that deletes every "More filters" disclosure so filters are always inline. A5
 * has not landed. A hard-fail gate on `main` right now is a RED `main`, which is
 * not landable and would train everyone to ignore the gate.
 *
 * SO THIS IS A RATCHET WITH A NAMED, DATED ALLOWLIST, not a silent narrowing: the
 * row asserts the SET of production files carrying the string is EXACTLY these two.
 * Adding a third file fails. Reintroducing the string inside either of these two
 * after A5 C8 lands fails. Deleting the string from either file — which is what
 * A5 C8 will do — ALSO fails, which is deliberate: the allowlist has to be edited
 * in the same commit that removes the occurrence, so the retirement is a recorded
 * event rather than a silent drift.
 *
 *   ALLOWLIST (recorded 2026-09-29, A7 C8 SLICE 1)
 *     1. components/admin-workspace/AdminWorkspace.tsx
 *        - a help-tour step whose body names the control in prose
 *        - the rendered `More filters` trigger label
 *     2. components/subjects/SubjectFilterToolbar.tsx
 *        - the `moreFiltersLabel` variable (`More filters` / `More filters (n)`)
 *   OWNER: A5 C8 (work/a5-c7-subjects-filters-action-header), which deletes every
 *   `More filters` disclosure in favour of always-inline filters. When A5 C8 lands,
 *   DELETE BOTH ENTRIES HERE in that same commit and this row becomes a hard fail
 *   on the empty set. Do not widen this list.
 */
const MORE_FILTERS_ALLOWLIST_2026_09_29 = [
	'components/admin-workspace/AdminWorkspace.tsx',
	'components/subjects/SubjectFilterToolbar.tsx',
];

test('A7C8-2: `More filters` exists only in its two recorded A5-C8-owned files', () => {
	const hits = findInProduction(/More filters/);
	const files = [...new Set(hits.map((h) => h.file))].sort();
	assert.deepEqual(
		files,
		[...MORE_FILTERS_ALLOWLIST_2026_09_29].sort(),
		'A7C8-2: the set of production files containing `More filters` changed.\n' +
			'  found: ' +
			JSON.stringify(files) +
			'\n  recorded 2026-09-29 (A7 C8 slice 1): ' +
			JSON.stringify(MORE_FILTERS_ALLOWLIST_2026_09_29) +
			'\n  Owner: A5 C8, which deletes every `More filters` disclosure. A NEW file ' +
			'must never be added — filters are always inline, there is no disclosure to ' +
			'put behind. If A5 C8 has landed, delete the matching entry from the ' +
			'allowlist in the same commit and this row becomes a hard fail on the empty set.',
	);
	// Every occurrence is named, so a reviewer can see WHICH line is the live one
	// rather than being handed a file name and asked to go look.
	assert.ok(
		hits.every((h) => MORE_FILTERS_ALLOWLIST_2026_09_29.includes(h.file)),
		'A7C8-2: an occurrence sits outside the allowlist: ' +
			JSON.stringify(hits.filter((h) => !MORE_FILTERS_ALLOWLIST_2026_09_29.includes(h.file))),
	);
});

/**
 * A7C8-3: no `truncate` in the shared picker / menu-item primitives.
 *
 * WHY THIS ROW EXISTS AT ALL. The operator's standing instruction for this slice
 * is that a bigger label is allowed to overflow or wrap and be REPORTED, and that
 * `truncate` must not be added to make it fit — an ellipsis is how "Program: All
 * departments" becomes "Program: All depart…" with no way to recover the rest. The
 * four files below are where that would be introduced, because they are the shared
 * control chrome every page adopts (§8 "One look per control"), so one `truncate`
 * here spreads to every filter on every page.
 *
 * SCOPE IS THE FOUR NAMED FILES, and that is deliberate. `@/ui/searchable-select`
 * is NOT in it: its option list keeps one `truncate` on the menu item
 * (`searchable-select.tsx:393`), which A2 HEADER-BUDGET re-pinned on purpose to
 * bound a long option label inside the popover, where there is width to spare and
 * no header row to protect. Folding that file in would demand reverting a decision
 * another slice recorded, on the strength of a rule written about a different file.
 * It is reported in the A7 C8 handoff instead.
 */
const NO_TRUNCATE_PRIMITIVES = [
	'ui/select.tsx',
	'ui/filter-picker.tsx',
	// `picker-trigger` is a `.ts` module (it exports class-name constants, no JSX).
	'ui/picker-trigger.ts',
	'ui/dropdown-menu.tsx',
];

test('A7C8-3: the shared picker and menu-item primitives never truncate their label', () => {
	const offenders: string[] = [];
	for (const relPath of NO_TRUNCATE_PRIMITIVES) {
		const abs = join(srcRoot, relPath);
		readFileSync(abs, 'utf8')
			.split('\n')
			.forEach((line, i) => {
				const s = line.trim();
				// Ignore prose: a comment that NAMES `truncate` while explaining that
				// it was removed is the opposite of a violation, and this file's own
				// comments do exactly that.
				if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return;
				if (/(^|[\s"'`])truncate([\s"'`]|$)/.test(line)) {
					offenders.push(`${relPath}:${i + 1}  ${s.slice(0, 120)}`);
				}
			});
	}
	assert.deepEqual(
		offenders,
		[],
		'A7C8-3: `truncate` is banned in the shared picker/menu primitives.\n' +
			'  ' +
			offenders.join('\n  ') +
			'\n  A bigger label may overflow or wrap and be reported for the re-fit pass. ' +
			'An ellipsis is not a fit: it hides the value the scheduler came to read, with ' +
			'no way to recover it.',
	);
});

/**
 * A7C8-4: the tokens COMPUTE to 14px and 15px.
 *
 * This is the row that makes the slice's central claim checkable, and it is a real
 * Tailwind COMPILE rather than a grep. Asserting the string `--text-xs: 0.875rem`
 * appears in `index.css` would pass just as happily if the declaration sat in the
 * wrong block, inside a comment, or was shadowed by a later one. Compiling proves
 * Tailwind read it and emitted it.
 *
 * WHY IT RESOLVES THE CHAIN BY HAND INSTEAD OF ASKING JSDOM. The first version of
 * this row did ask jsdom (`getComputedStyle(...).fontSize`) and it returned `NaN`.
 * That is a real limitation, not a flake: Tailwind emits `.text-xs{font-size:var(--text-xs)}`
 * and jsdom does not substitute custom properties in computed styles. Reporting a
 * jsdom number here would have been reporting a limitation as a measurement, so
 * instead this row does the substitution itself, over the REAL compiled output:
 *
 *   1. read `--text-xs` / `--text-sm` and their `--line-height` companions out of
 *      the compiled `:root` theme block — proof the tokens were emitted at all;
 *   2. assert the `.text-xs` / `.text-sm` UTILITIES actually reference those custom
 *      properties — proof the tokens are WIRED to the class, which is precisely the
 *      link a source-text assertion cannot check and a Tailwind upgrade could break;
 *   3. convert rem -> px against the 16px initial root font size.
 *
 * This is a derivation over real build output, not a browser layout measurement. The
 * rendered check is the planner's row, and this row is what stops the claim rotting.
 */
test('A7C8-4: text-xs computes to 14px and text-sm to 15px in a real Tailwind build', async () => {
	const themeCss = readFileSync(resolve(clientRoot, 'src/index.css'), 'utf8');
	const candidates = ['text-xs', 'text-sm', 'text-base', 'p-4'];
	const compiled = await compile(themeCss, { base: clientRoot, onDependency: () => {} });
	const css = optimize(compiled.build(candidates), { minify: true }).code;

	/** The `--<name>` value as emitted in the compiled root theme block. */
	const themeVar = (name: string): string | undefined =>
		new RegExp(`--${name}:([^;}]+)`).exec(css)?.[1]?.trim();

	/**
	 * The `font-size`/`line-height` declarations the UTILITY rule emits for a class.
	 * This is the wiring assertion: it is what proves the class is driven by the
	 * theme token rather than by a hard-coded length of its own.
	 */
	const utilityDecl = (cls: string, prop: string): string | undefined => {
		const rule = new RegExp(`\\.${cls}\\{([^}]*)\\}`).exec(css)?.[1];
		if (!rule) return undefined;
		return new RegExp(`${prop}:([^;]+)`).exec(rule)?.[1]?.trim();
	};

	/** rem -> px at the 16px initial root font size the same block establishes. */
	const toPx = (value: string): number => {
		assert.match(
			value,
			/^[\d.]+rem$/,
			`expected a rem length to resolve, got "${value}"`,
		);
		return Number.parseFloat(value) * 16;
	};

	const xs = themeVar('text-xs');
	const xsLh = themeVar('text-xs--line-height');
	const sm = themeVar('text-sm');
	const context = `\n  compiled theme: --text-xs=${xs} --text-xs--line-height=${xsLh} --text-sm=${sm}`;

	assert.ok(xs && xsLh && sm, `A7C8-4: the type tokens were not emitted at all.${context}`);

	// The utilities must be driven BY the tokens.
	assert.equal(
		utilityDecl('text-xs', 'font-size'),
		'var(--text-xs)',
		`A7C8-4: .text-xs is not wired to the --text-xs theme token.${context}`,
	);
	assert.equal(
		utilityDecl('text-sm', 'font-size'),
		'var(--text-sm)',
		`A7C8-4: .text-sm is not wired to the --text-sm theme token.${context}`,
	);

	assert.equal(
		toPx(xs),
		14,
		`A7C8-4: text-xs must COMPUTE to 14px — it is the class 137 arbitrary sizes were ` +
			`replaced with, so if this is still 12px the operator sees no change at all.${context}`,
	);
	assert.equal(
		toPx(sm),
		15,
		`A7C8-4: text-sm must COMPUTE to 15px.${context}`,
	);

	// The paired line height has to be real too: without `--text-xs--line-height`,
	// Tailwind emits a bare `font-size` and the element inherits whatever line box
	// its parent had, which is how a LARGER xs silently clips inside a fixed-height row.
	//
	// The emitted declaration is `var(--tw-leading,var(--text-xs--line-height))`, not
	// a bare `var(--text-xs--line-height)`: `--tw-leading` is Tailwind's hook for an
	// explicit `leading-*` utility, and its FALLBACK is the theme token. So the claim
	// to assert is that the token is the fallback — a `text-xs` carrying no `leading-*`
	// must resolve to the paired height rather than inheriting its parent's. Asserting
	// the exact string here would have failed on a correct build and taught the next
	// reader that the row is about Tailwind's internal spelling.
	const xsLineHeightDecl = utilityDecl('text-xs', 'line-height') ?? '';
	assert.match(
		xsLineHeightDecl,
		/var\(--text-xs--line-height\)/,
		`A7C8-4: .text-xs must carry its OWN line height as the fallback, not inherit its ` +
			`parent's. Emitted: "${xsLineHeightDecl}".${context}`,
	);
	assert.equal(
		toPx(xsLh),
		20,
		`A7C8-4: the text-xs line height must COMPUTE to 20px for a 14px face.${context}`,
	);

	// `text-base` is the one size this slice must NOT have moved.
	assert.equal(
		toPx(themeVar('text-base') ?? ''),
		16,
		`A7C8-4: text-base stays at the 16px default; this slice raised the two steps ` +
			`BELOW it, not this one.${context}`,
	);
});
