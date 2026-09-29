/**
 * A3 (truthful numbers) — the fabricated room-utilisation `0%`, and the colour
 * ramp that had to survive the fix.
 *
 * THE DEFECT THIS EXISTS TO PROVE ABSENT. `roomUtilization` is a
 * `Map<number, number>` populated only when `pivotDraftToView` returns `ok`
 * (`if (!result.ok) continue;`), and the memo returns an EMPTY map outright when
 * there is no schedule report or the verified term index is unresolved. So a
 * room with no entry means "we could not compute this". Every read site wrote
 * `?? 0`, so that refusal rendered as a confident `0%` — a fail-closed case
 * displayed as a measured zero, which is worse than a missing number because a
 * zero is a claim.
 *
 * THE FIXTURE IS THE REAL SURFACE, not an invented one. The map is built by
 * calling the production `pivotDraftToView` and applying the production memo's
 * own rule, so the refusal that produces an absent entry is the real refusal.
 * A test that hand-built a Map and asserted on it would pass whether or not the
 * production refusal still exists — which is precisely the question.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pivotDraftToView } from '../schedule-pivot';
import {
	ROOM_UTILIZATION_UNKNOWN_FILL,
	ROOM_UTILIZATION_UNKNOWN_LABEL,
	ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT,
	buildingScheduleState,
	isRoomUtilizationKnown,
	readRoomUtilization,
	roomUtilizationBarPercent,
	roomUtilizationColor,
	roomUtilizationCompactLabel,
	roomUtilizationLabel,
} from '../room-utilization-display';
import type { DraftReport, ScheduledEntry } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');
const source = (relative: string) => readFileSync(resolve(CLIENT_ROOT, relative), 'utf8');

const SUBJECTS = new Map([[11, 'AP']]);
const ROOM_501 = { id: 501, name: 'Room 501', subtitle: 'Grade 9 Building' };
const ROOM_502 = { id: 502, name: 'Room 502', subtitle: 'Grade 9 Building' };

function entry(termIndex: number | undefined, overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
	return {
		entryId: `ap-${termIndex ?? 'none'}`,
		sectionId: 701,
		facultyId: 901,
		roomId: 501,
		subjectId: 11,
		durationMinutes: 45,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '08:45',
		...(termIndex === undefined ? {} : { termIndex }),
		...overrides,
	};
}

/** A draft whose entries all carry a term identity. */
const IDENTIFIED_REPORT = {
	runId: 318,
	status: 'COMPLETED',
	createdAt: '2031-01-01T00:00:00.000Z',
	finishedAt: '2031-01-01T00:01:00.000Z',
	entries: [entry(1)],
	summary: { timetableDisplaySlots: [{ startTime: '08:00', endTime: '08:45' }] },
} as DraftReport;

/**
 * The production memo, transcribed: `CampusMapOverview` and
 * `CampusReadinessCard` both build the map with exactly these four lines. It is
 * transcribed rather than imported because it lives inside a component body, and
 * it is the omission rule under test — so the control states it outright instead
 * of trusting that production still says it.
 */
function buildProductionRoomUtilization(
	report: DraftReport | null,
	verifiedTermIndex: number | null,
	roomIds: readonly number[],
): Map<number, number> {
	const utilization = new Map<number, number>();
	if (!report || verifiedTermIndex == null) return utilization;
	for (const roomId of roomIds) {
		const result = pivotDraftToView(report, 'rooms', roomId, { id: roomId, name: `Room ${roomId}` }, verifiedTermIndex, SUBJECTS);
		if (!result.ok) continue;
		utilization.set(roomId, Math.min(100, result.view.summary.utilizationPercent));
	}
	return utilization;
}

/* ───────────────────────── the refusal is real, not assumed ───────────────────────── */

test('A2 control: the production refusal is what leaves a room out of the map, and that is unknown, not 0%', () => {
	// No term identity anywhere in the draft: the real pivot refuses.
	const untermmed = { ...IDENTIFIED_REPORT, entries: [entry(undefined)] } as DraftReport;
	const refused = pivotDraftToView(untermmed, 'rooms', 501, ROOM_501, 1, SUBJECTS);
	assert.equal(refused.ok, false, 'precondition: the real pivot refuses a draft with no term identity');
	if (refused.ok) return;
	assert.equal(refused.reason, 'TERM_IDENTITY_UNAVAILABLE');

	// An unresolved verified term is the far more common route to an empty map
	// — this is the state the planner's earlier acceptance rows were blocked in.
	for (const [label, report, term] of [
		['no report at all', null, 1],
		['unresolved term index', IDENTIFIED_REPORT, null],
	] as const) {
		const map = buildProductionRoomUtilization(report as DraftReport | null, term as number | null, [501, 502]);
		assert.equal(map.size, 0, `precondition (${label}): nothing is measurable, so the map is empty`);
		for (const roomId of [501, 502]) {
			assert.equal(isRoomUtilizationKnown(map, roomId), false, `${label}: room ${roomId} must not be reported as known`);
			assert.equal(
				roomUtilizationLabel(map, roomId),
				ROOM_UTILIZATION_UNKNOWN_LABEL,
				`${label}: an unmeasurable room must not render a percentage`,
			);
			// THE DEFECT, stated as the assertion the pre-fix code would fail:
			// `map.get(id) ?? 0` produced "0%" here.
			assert.notEqual(roomUtilizationLabel(map, roomId), '0%', `${label}: "0%" is the fabricated figure`);
		}
	}
});

test('A2 control: a measured 0% still renders 0% — the fix does not swallow a real zero', () => {
	// Room 502 has no entries at all, and the pivot still succeeds: that is a
	// REAL measurement of zero, and it is the case a lazy "hide anything falsy"
	// fix would silently convert into "not available".
	const map = buildProductionRoomUtilization(IDENTIFIED_REPORT, 1, [501, 502]);
	assert.equal(map.has(501), true, 'precondition: the scheduled room is measurable');
	assert.equal(isRoomUtilizationKnown(map, 501), true);
	assert.equal(isRoomUtilizationKnown(map, 502), true, 'precondition: the unscheduled room is measured, not unknown');
	assert.equal(roomUtilizationLabel(map, 502), '0%', 'a genuinely measured 0% must render as 0%');
	assert.notEqual(roomUtilizationLabel(map, 502), ROOM_UTILIZATION_UNKNOWN_LABEL);
	assert.equal(roomUtilizationBarPercent(map, 502), 0, 'a measured zero has no bar extent, as before');
	assert.equal(roomUtilizationCompactLabel(map, 502), '0%');
});

test('A2 control: a measured non-zero figure is unchanged', () => {
	const map = buildProductionRoomUtilization(IDENTIFIED_REPORT, 1, [501]);
	const reading = readRoomUtilization(map, 501);
	assert.equal(reading.kind, 'measured');
	if (reading.kind !== 'measured') return;
	assert.equal(roomUtilizationLabel(map, 501), `${Math.round(reading.percent)}%`);
	assert.equal(roomUtilizationBarPercent(map, 501), reading.percent);
	assert.equal(roomUtilizationCompactLabel(map, 501), `${Math.round(reading.percent)}%`);
});

test('A2 control: the unknown state is distinct in both wordings, and neither is a figure', () => {
	const map = buildProductionRoomUtilization(IDENTIFIED_REPORT, null, [501, 502]);
	assert.equal(roomUtilizationCompactLabel(map, 501), ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT);
	assert.equal(ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT, 'n/a');
	assert.equal(ROOM_UTILIZATION_UNKNOWN_LABEL, 'Not available');
	// A token, never a percentage: `n/a` and `Not available` must not be
	// readable as a number by a screen reader or by a glance.
	assert.doesNotMatch(ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT, /%/, 'the compact unknown marker must not look like a percentage');
	assert.doesNotMatch(ROOM_UTILIZATION_UNKNOWN_LABEL, /%/, 'the unknown label must not look like a percentage');
	// The neutral fill is NOT the green-at-zero the ramp produces, so an unknown
	// card is not coloured like a measured zero.
	assert.notEqual(
		ROOM_UTILIZATION_UNKNOWN_FILL,
		roomUtilizationColor(0),
		'an unknown readout must not wear the measured-zero colour',
	);
});

/* ───────────────────────── building-level tri-state (line 296) ───────────────────────── */

test('A2 control: "has a timetable" never claims no timetable when nothing was measurable', () => {
	const emptyMap = buildProductionRoomUtilization(IDENTIFIED_REPORT, null, [501, 502]);
	assert.equal(
		buildingScheduleState(emptyMap, [501, 502]),
		'unknown',
		'an unresolved term must not be reported as "no timetable"',
	);

	// A resolved term where every teaching room measures zero IS a real empty
	// answer, and the existing honest copy must still be reachable.
	const measuredEmpty = buildProductionRoomUtilization(IDENTIFIED_REPORT, 1, [502]);
	assert.equal(buildingScheduleState(measuredEmpty, [502]), 'empty');

	// Any measured room above zero is a timetable.
	const scheduled = buildProductionRoomUtilization(IDENTIFIED_REPORT, 1, [501, 502]);
	assert.equal(buildingScheduleState(scheduled, [501, 502]), 'scheduled');

	// A building with no rooms at all is unknown, not empty: nothing was looked at.
	assert.equal(buildingScheduleState(scheduled, []), 'unknown');

	// Mixed: one measurable room above zero settles it, whatever the others are.
	const mixed = new Map([[501, 40], [502, 0]]);
	assert.equal(buildingScheduleState(mixed, [502, 501]), 'scheduled');
});

/* ───────────────────────── the six read sites ───────────────────────── */

const READ_SITES: ReadonlyArray<{ file: string; what: string }> = [
	{ file: 'src/components/BuildingView.tsx', what: 'Building view room card' },
	{ file: 'src/components/campus-map/CampusMapOverview.tsx', what: 'campus map' },
	{ file: 'src/components/dashboard/CampusReadinessCard.tsx', what: 'dashboard readiness card' },
];

test('A2 control: no read site collapses an absent measurement into a zero', () => {
	const offenders: string[] = [];
	for (const { file } of READ_SITES) {
		const text = source(file);
		// The literal fabrication. `?? 0` on a `roomUtilization` read is exactly
		// the shape that turned a refusal into "0%", so none may survive.
		for (const m of text.matchAll(/roomUtilization[^;\n]*?\?\?\s*0/g)) {
			offenders.push(`${file}: roomUtilization read still defaults to 0 -> ${m[0].trim()}`);
		}
		// The display sites must go through the tri-state label, so a measured
		// zero and an unknown can never render the same string again.
		if (/Math\.round\((?:roomUtilization|utilization)[^)]*\)/.test(text)) {
			offenders.push(`${file}: a utilisation figure is still rounded straight from the raw value`);
		}
	}
	assert.deepEqual(offenders, [], `the fabricated zero must not survive:\n${offenders.join('\n')}`);

	// Both duplicated map components must actually adopt the tri-state, or the
	// two screens will disagree again — the reason this file exists twice.
	for (const { file } of READ_SITES.filter((s) => s.file !== 'src/components/BuildingView.tsx')) {
		const text = source(file);
		assert.match(text, /roomUtilizationLabel\(/, `${file} must render the tri-state label`);
		assert.match(text, /isRoomUtilizationKnown\(/, `${file} must know which rooms are measured`);
		assert.match(text, /data-utilization=/, `${file} must mark a measured vs unknown track`);
	}
	assert.match(
		source('src/components/BuildingView.tsx'),
		/roomUtilizationCompactLabel\(/,
		'BuildingView must render the tri-state label',
	);
	assert.match(
		source('src/components/campus-map/CampusMapOverview.tsx'),
		/buildingScheduleState\(/,
		'CampusMapOverview must use the tri-state for its "has a timetable" label',
	);
});

test('A2 control: the frozen room-card geometry is untouched by this change', () => {
	// Other work depends on these numbers (fix 07/11 disjoint-rectangle budget
	// and the fit-scale controls), so the unknown state was given its own
	// wording INSIDE the existing box rather than a wider one.
	const text = source('src/components/BuildingView.tsx');
	assert.match(text, /export const ROOM_UTILIZATION_TEXT_BOX = \{ x: 4, y: 66, width: 36, height: 14 \} as const;/);
	assert.match(text, /export const ROOM_UTILIZATION_BAR_BOX = \{ x: 78, y: 5, width: 10, height: 62 \} as const;/);
	// The compact unknown token must fit that 36-unit box at 11px. 3 glyphs at
	// 11px is ~18 units, so it fits with room to spare where "Not available"
	// would wrap out of the box and collide with the program badge.
	assert.ok(
		ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT.length <= 4,
		`the compact unknown marker must stay within the 36-unit box, got "${ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT}"`,
	);
});

/* ───────────────────────── A3: the colour ramp survived verbatim ───────────────────────── */

test('A3 control: the utilisation colour ramp output is byte-identical to the pre-move body', () => {
	// Expected values are transcribed from the ORIGINAL `getUtilizationColor`
	// body that lived in BuildingView / CampusMapOverview / CampusReadinessCard
	// and were computed by hand, NOT by calling the moved function — a test that
	// recomputes the expectation with the same code proves nothing. Each was
	// cross-checked by running the base body (md5 4f7e63ee7577a075a675217988f53913,
	// identical in all three original files) over the same inputs.
	const expected: ReadonlyArray<[number, string]> = [
		[0, 'rgb(34,197,94)'],
		[25, 'rgb(134,188,51)'],
		[50, 'rgb(234,179,8)'],
		[75, 'rgb(227,109,23)'],
		[100, 'rgb(220,38,38)'],
		// Clamping is part of the original contract.
		[-40, 'rgb(34,197,94)'],
		[180, 'rgb(220,38,38)'],
	];
	for (const [input, want] of expected) {
		assert.equal(roomUtilizationColor(input), want, `ramp output changed at ${input}%`);
	}
	// The two branch knees are pinned by the 0 / 50 / 100 rows above. A
	// "discontinuity at the knee" assertion would be wrong: the original ramp is
	// continuous across 50 (both branches meet at rgb(234,179,8)), so 49.9 and
	// 50.1 legitimately round alike. What must not move is the branch BOUNDARY,
	// which is observable as the 50% row being the green-ramp endpoint.
	assert.equal(roomUtilizationColor(50), 'rgb(234,179,8)');
	assert.equal(roomUtilizationColor(50.1) !== roomUtilizationColor(0), true);
	// The shape the callers rely on: red RISES to the 50% knee and then FALLS
	// (234 -> 220), because the ramp is a green->yellow->red hue shift, not a
	// darkening. Asserting monotonic red across the knee would be wrong; the
	// knee at 50 is the maximum, and moving it is exactly what A3 must not do.
	const redAt = (p: number) => Number(/rgb\((\d+),/.exec(roomUtilizationColor(p))![1]);
	const below = [0, 10, 20, 30, 40].map(redAt);
	const above = [60, 70, 80, 90, 100].map(redAt);
	for (let i = 1; i < below.length; i += 1) {
		assert.ok(below[i] > below[i - 1], `red must rise below the knee (step ${i})`);
	}
	for (let i = 1; i < above.length; i += 1) {
		assert.ok(above[i] < above[i - 1], `red must fall above the knee (step ${i})`);
	}
	assert.ok(redAt(50) > below[below.length - 1] && redAt(50) > above[0], 'the knee must be the red maximum');
	// Green is the inverse, which is what makes the ramp read as green -> red.
	const greenAt = (p: number) => Number(/rgb\(\d+,(\d+),/.exec(roomUtilizationColor(p))![1]);
	assert.ok(greenAt(0) > greenAt(50) && greenAt(50) > greenAt(100), 'green must fall across the whole ramp');
});

test('A3 control: exactly one colour-ramp definition exists in the client source', () => {
	// The duplication was the defect A3 was allowed to leave alone. It was NOT
	// left alone: the three byte-identical bodies now live in one module, so the
	// two duplicated map components cannot drift. A second definition would
	// reintroduce exactly the risk the extraction removed.
	const offenders: string[] = [];
	for (const { file } of READ_SITES) {
		const text = source(file);
		// A definition looks like `function getUtilizationColor` / `roomUtilizationColor`
		// with a body, not the `const getUtilizationColor = roomUtilizationColor;`
		// alias each caller now uses.
		for (const m of text.matchAll(/function\s+(?:getUtilizationColor|roomUtilizationColor)\s*\(/g)) {
			offenders.push(`${file}: ${m[0]}`);
		}
	}
	assert.deepEqual(offenders, [], `the ramp must not be re-defined per file:\n${offenders.join('\n')}`);
	for (const { file } of READ_SITES) {
		assert.match(
			source(file),
			/const getUtilizationColor = roomUtilizationColor;/,
			`${file} must call the shared ramp`,
		);
	}
	// And the shared ramp lives in the module, not in one of the callers.
	assert.match(source('src/lib/room-utilization-display.ts'), /export function roomUtilizationColor\(/);
});

/* ───────────────────────── C1: one word for the empty floor ───────────────────────── */

test('C1 control: the empty-room-list state is one word, and it is "Empty"', () => {
	const text = source('src/components/BuildingView.tsx');
	const emptyMarkers = [...text.matchAll(/text="([^"]*)"/g)].map((m) => m[1]);
	assert.ok(emptyMarkers.includes('Empty'), 'the empty-floor marker must render the word "Empty"');
	assert.ok(
		!emptyMarkers.includes('Empty floor'),
		'"Empty floor" is the two-word form this control retired',
	);
	// "floor" was redundant: the marker is already drawn inside that floor's own
	// band, to the right of its `F<n>` tag.
	assert.match(text, /x=\{FLOOR_LABEL_W \+ FLOOR_PAD_X\}/, 'the marker stays inside the floor band beside the F<n> tag');
	// The word chosen is the one the repo already uses for an empty container, so
	// inventory rows 249/250 settle without editing that other file.
	assert.match(
		source('src/components/room-schedules/OccupancyTemplatePreview.tsx'),
		/>Empty</,
		'the sibling empty-container surface must already use the same word, so it needs no edit',
	);
});

/* ───────────────────────── §8: the 11px floor in the files this stream touched ───────────────────────── */

test('A3 control: no sub-11px text was introduced in the files this change owns', () => {
	// `TeacherGridMode.tsx` is deliberately NOT scanned here, and the reason has
	// changed. When this control was written, that file carried a `text-[10px]`
	// department-count Badge that predated the change and was out of scope; listing it
	// would have made this control fail on a pre-existing condition and trained the
	// next reader to ignore it. A7 C8 SLICE 1 (2026-09-29) has since replaced every
	// `text-[9-12px]` in production — that Badge included — with `text-xs` at 14px, so
	// the exception this comment used to justify no longer describes anything. The
	// file stays out of the scan list because this control does not own it, not
	// because it holds small text.
	const owned = [
		...READ_SITES.map((s) => s.file),
		'src/lib/room-utilization-display.ts',
		'src/components/faculty-assignments/TeacherLoadReadout.tsx',
	];
	const offenders: string[] = [];
	for (const file of owned) {
		const text = source(file);
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
			if (Number(m[1]) < 11) offenders.push(`${file}: text-[${m[1]}px]`);
		}
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)rem\]/g)) {
			if (Number(m[1]) * 16 < 11) offenders.push(`${file}: text-[${m[1]}rem]`);
		}
	}
	assert.deepEqual(offenders, [], `sub-11px text must not remain: ${offenders.join(', ')}`);

	// The A1 label is the one new type size this change introduces, so it is
	// pinned directly rather than left to the scan above.
	// RE-PINNED BY A7 C8 SLICE 1 (2026-09-29). This asserted `text-[11px]` and called
	// 11px "the house floor". The operator's 2026-09-29 ruling ("There is a lot of text
	// that is too small, which fails accessibility. Lock in." / "Our default text and
	// sizes should naturally be bigger.") RAISED the floor: every `text-[9-12px]` in
	// production became `text-xs`, and `--text-xs` itself went 12px -> 14px. The label
	// is therefore now `text-xs` at 14px — 3px LARGER than the pin it replaces, which is
	// the point of the change and not a regression.
	//
	// The 11px row is RETAINED as a superseded record and a stronger row is added
	// beside it, because AGENTS.md §16 forbids closing a finding by deleting its control.
	const readout = source('src/components/faculty-assignments/TeacherLoadReadout.tsx');
	assert.doesNotMatch(
		readout,
		/text-\[11px\]/,
		'SUPERSEDED-BY-A7C8-1 PIN, RETAINED AS A RECORD: the A3 11px house-floor pin. The ' +
			'label moved to `text-xs` (14px) under A7 C8 slice 1, which RAISED the floor from ' +
			'11px rather than lowering it. If this fires, an arbitrary 11px size is back.',
	);
	assert.match(
		readout,
		/\btext-xs\b/,
		'A7C8-REPIN (replaces the 11px pin above): the utilisation label must be `text-xs`, ' +
			'which A7 C8 slice 1 raised to 14px.',
	);
	assert.doesNotMatch(
		readout,
		/text-\[(?:[0-9]|1[0-3])px\]/,
		'A7C8-REPIN: the label must not be an arbitrary sub-14px size. `text-xs` is 14px.',
	);
	// And the token itself, so a future lowering of `--text-xs` cannot quietly undo the
	// label's apparent size. This is the assertion the 11px pin could not make.
	assert.match(
		source('src/index.css'),
		/--text-xs:\s*0\.875rem/,
		'A7C8-REPIN: `--text-xs` must stay 0.875rem (14px). Lowering it makes every ' +
			'`text-xs` in the product — including this label — smaller again, which is the ' +
			'exact regression the operator asked to be locked in.',
	);
});
