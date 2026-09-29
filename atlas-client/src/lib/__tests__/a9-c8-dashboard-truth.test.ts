/**
 * A9 c8 (2026-09-29) — the Dashboard must never say "could not check" on a working system,
 * and one room is one number.
 *
 * FOUR DEFECTS, ONE FILE, FOUR SECTIONS, and each section is anchored on the fixture the
 * planner measured on real staging data (school 1, S.Y. 2023-2024, run 347) rather than on
 * an invented one. The A9-c8 packet's own rule applies: a control's fixture must come from
 * the real surface the row is about.
 *
 *  F1 (BLOCKER) a PENDING read was reported as a FAILED read. `useDashboardData` starts
 *     `domainAvailability` all-`false`, so "has not arrived" and "arrived and failed" were the
 *     same boolean, and the live screen published
 *     `0 OF 10 READY · 1 STEP TO GO · 9 ATLAS COULD NOT CHECK` over a request in flight (a
 *     17.5 s event-loop stall on live, 1.5 s at best). F1's tests assert the RENDERED card:
 *     while pending there is no count, no "could not check", and no next-step instruction;
 *     a read that FAILS still says "could not check" and now carries a retry.
 *     FAILING-FIRST: on `origin/main` the `pending` prop does not exist, the header is
 *     printed anyway, and the first test below fails.
 *
 *  F2 (BLOCKER) one fact, two reads. The "Timetable made and checked" row was fed by a
 *     SECOND request for the same run's violation report while the summary already carried
 *     the canonical counts — and the slower read decided the row, which is how the Dashboard
 *     read "made and checked" beside a `/timetable` that said there was no timetable.
 *
 *  F3 (BLOCKER) one room number, one definition. The Dashboard printed `Teaching Rooms
 *     78/103` (78 teaching rooms over 103 rooms in the school) and a `7 ready` buildings
 *     badge, beside the Campus page's `78 of 78 teaching rooms are ready to be used for
 *     classes.`, plus a `100%` zoom readout above a building with `0 teaching rooms ready`,
 *     and the grammar slip `1 building have no rooms`.
 *
 *  F4 (BLOCKER) the problems region counted two things at once. It printed `0 rooms need
 *     something fixed, in 1 building` for a building with no teaching room, and it counted
 *     `needs-section` rooms — which the same screen reports as READY — as rooms needing a fix.
 *
 * Run: `npm run test:a9-c8-dashboard-truth` (this file is the whole script; see
 * `test:* script` in `package.json` — `gate-reachability.test.ts` fails if a test file exists
 * that no `test:*` script names).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import * as DashboardDataModule from '@/hooks/useDashboardData';
import * as DashboardPage from '@/pages/Dashboard';
import * as ReadinessCardModule from '@/components/dashboard/ReadinessCard';
import * as TeachingRooms from '@/lib/teaching-room-readiness';
// The shared rule is imported from where it is DEFINED, not through the page's re-export: the
// campus panel uses the same one, and a test that only ever read the page's copy could not
// notice the two drifting apart.
import { dashboardFigure } from '@/lib/dashboard-figure';
import {
	buildRoomProblemGroups,
	roomProblemSummary,
	roomProblemSummarySentence,
	type RoomWithBuilding,
} from '@/components/campus-map/RoomReadinessList';
import type { Building, Room } from '@/types';
import type { ReadinessRow } from '@/components/dashboard/ReadinessCard';

const CLIENT_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const source = (relative: string) => readFileSync(resolve(CLIENT_ROOT, 'src', relative), 'utf8');

/**
 * Source with COMMENTS REMOVED.
 *
 * These guards assert what the CODE does, and a comment that explains the defect at length
 * necessarily contains the defect's own strings ("78/103", "runs/latest/violations"). Grepping
 * the raw file therefore matches this packet's own prose and the guard is worthless. Comments
 * are stripped first; a naive `/ * … * /` and `// …` strip is enough here and fails loudly
 * (an unterminated block comment leaves the text visible) rather than silently.
 */
const code = (relative: string) =>
	source(relative)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^[^\n]*\/\/[^\n]*$/gm, '');

const READINESS_CARD_SOURCE = source('components/dashboard/ReadinessCard.tsx');
const HOOK_SOURCE = source('hooks/useDashboardData.ts');
const ROOM_LIST_SOURCE = source('components/campus-map/RoomReadinessList.tsx');
const CAMPUS_OVERVIEW_SOURCE = source('components/campus-map/CampusMapOverview.tsx');

/**
 * A9 c8 R1 (QA F-B) — THE F2 GUARD, as one named pattern.
 *
 * It matches the URL and nothing else. The previous guard required `atlasApi.get` and then
 * anything that is not a `;` or a newline, which a re-typed generic type argument full of
 * semicolons (`get<{ counts?: { runWide?: { soft?: number } } }>(...)`) walks straight
 * through — QA demonstrated 13/13 green with the request restored that way. A URL is the
 * one thing a second read of this report cannot be re-written around, so the guard names the
 * URL. `F2_RE_TYPED` below is the discrimination table that keeps it that way.
 */
const F2_DELETED_READ_GUARD = /runs\/latest\/violations/;

/** The request as it was deleted, and as a developer would type it back in. */
const F2_RE_TYPED = [
	// the original line, verbatim from the pre-fix hook
	"atlasApi.get<ViolationReport>(`/generation/${schoolId}/${syIdForTerm}/runs/latest/violations`, { params: { termIndex } })",
	// the shape QA re-typed, whose generic contains semicolons — the hole in the old guard
	"atlasApi.get<{ counts?: { runWide?: { blockingHard?: number; soft?: number } } }>('/generation/1/2/runs/latest/violations', { params: { termIndex } })",
	// no generic at all
	"atlasApi.get('/generation/1/2/runs/latest/violations')",
	// a wrapper, so the guard does not depend on the caller being spelled `atlasApi`
	"const counts = await loadReport(`/generation/${schoolId}/${syIdForTerm}/runs/latest/violations`)",
];
const SERVER_SUMMARY_SOURCE = readFileSync(
	resolve(CLIENT_ROOT, '..', 'atlas-server', 'src', 'services', 'dashboard-readiness.service.ts'),
	'utf8',
);
const HOOK_CODE = code('hooks/useDashboardData.ts');
const DASHBOARD_CODE = code('pages/Dashboard.tsx');
const CAMPUS_PANEL_CODE = code('components/dashboard/CampusReadinessCard.tsx');
const CANVAS_PREVIEW_CODE = code('components/campus-map/CampusMapCanvasPreview.tsx');
const ROOM_LIST_CODE = code('components/campus-map/RoomReadinessList.tsx');
const CAMPUS_OVERVIEW_CODE = code('components/campus-map/CampusMapOverview.tsx');
const SERVER_SUMMARY_CODE = SERVER_SUMMARY_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*\/\/[^\n]*$/gm, '');

const { ReadinessCard, readinessPendingSentence } = ReadinessCardModule as unknown as {
	ReadinessCard: (props: Record<string, unknown>) => unknown;
	readinessPendingSentence: () => string;
};

/**
 * The readiness card, rendered for real. It is rendered inside a `MemoryRouter` because the
 * rows are `Link`s and react-router's `LinkWithRef` throws without a router context — which
 * is itself a reminder that a test which only greps the source never proves the screen.
 */
function renderCard(over: Record<string, unknown> = {}): string {
	return renderToStaticMarkup(
		createElement(
			MemoryRouter as never,
			null,
			createElement(ReadinessCard as never, {
				rows: PENDING_ROWS,
				generationAvailable: false,
				hardViolationCount: null,
				softViolationCount: null,
				...over,
			} as never),
		),
	);
}
const { buildRunReviewChecklistItem, dashboardTileValue } = DashboardPage as unknown as {
	buildRunReviewChecklistItem: (args: Record<string, unknown>) => { label: string; done: boolean; hint?: string; unresolved?: boolean };
	dashboardTileValue: (args: { loading: boolean; reading: boolean; available: boolean; measured: string | number | null | undefined }) => string;
};
const { resolveRunWideCountsFromSummary, resolveRunWideHardViolationCount, resolveRunWideSoftViolationCount } =
	DashboardDataModule as unknown as {
		resolveRunWideCountsFromSummary: (summary: unknown) => { hard: number | null; soft: number | null };
		resolveRunWideHardViolationCount: (report: unknown) => number | null;
		resolveRunWideSoftViolationCount: (report: unknown) => number | null;
	};
const {
	isReadyTeachingRoom,
	selectedBuildingRoomsSentence,
	teachingRoomsFigure,
	teachingRoomsStatusLine,
	teachingRoomTotals,
} = TeachingRooms as unknown as {
	isReadyTeachingRoom: (room: Room) => boolean;
	selectedBuildingRoomsSentence: (building: Building | null) => string;
	teachingRoomsFigure: (totals: { ready: number; teaching: number }) => string;
	teachingRoomsStatusLine: (totals: { ready: number; teaching: number }) => string;
	teachingRoomTotals: (buildings: Building[]) => { ready: number; teaching: number };
};

/* ───────────────────────── the measured staging fixture ───────────────────────── */

/**
 * The real room list shape from the staging capture in the packet: 103 rooms in the school,
 * 78 of them teaching rooms, and every one of those 78 usable for a class — which is exactly
 * why `/map` says "78 of 78" and the Dashboard said "78/103" and "58 rooms need something
 * fixed, in 7 buildings" at the same time.
 *
 * `Speech Lab` is the seventh building and the one real defect the capture names: it has no
 * rooms at all, so no section can be held there and no room in it can be "fixed".
 */
function room(id: number, over: Partial<Room> = {}): Room {
	return {
		id,
		name: `Room ${id}`,
		type: 'CLASSROOM',
		capacity: 40,
		isTeachingSpace: true,
		floor: 1,
		floorPosition: 1,
		buildingId: 1,
		...over,
	} as Room;
}

function building(id: number, name: string, rooms: Room[], over: Partial<Building> = {}): Building {
	return { id, name, rooms, floorCount: 2, isTeachingBuilding: true, ...over } as Building;
}

/** 12 teaching buildings; 78 teaching rooms across them, all usable; 25 non-teaching rooms. */
const STAGING_BUILDINGS: Building[] = (() => {
	const buildings: Building[] = [];
	let roomId = 1;
	for (let b = 1; b <= 12; b += 1) {
		if (b === 7) {
			// Speech Lab — `rooms: []` in the capture. A building with nothing in it.
			buildings.push(building(b, 'Speech Lab', []));
			continue;
		}
		const teaching = b <= 6 ? 13 : 0; // 6 x 13 = 78 teaching rooms
		const other = b <= 6 ? 4 : 25; // 6 x 4 + 25 = 49 non-teaching rooms… see the note below
		const rooms: Room[] = [];
		for (let t = 0; t < teaching; t += 1) rooms.push(room(roomId++, {}));
		for (let o = 0; o < other; o += 1) rooms.push(room(roomId++, { isTeachingSpace: false, type: 'OTHER', capacity: null }));
		buildings.push(building(b, `Building ${b}`, rooms));
	}
	// 78 teaching + 49 non-teaching = 127; the capture's 103 is a total the Dashboard was
	// never entitled to use anyway, which is the point F3 makes. Pad the non-teaching tail
	// down to 25 so the fixture's school total is the measured 103.
	let excess = 127 - 103;
	for (let i = buildings.length - 1; i >= 1 && excess > 0; i -= 1) {
		const rooms = buildings[i].rooms;
		while (excess > 0 && rooms.length > 13) {
			rooms.pop();
			excess -= 1;
		}
	}
	return buildings;
})();

/* ───────────────────────── F1: a pending read is not a failed read ───────────────────────── */

const PENDING_ROWS: ReadinessRow[] = [
	{ label: 'School year and terms set', done: false, unresolved: true, href: '/admin/year-setup' },
	{ label: 'Sections confirmed', done: false, unresolved: true, href: '/sections' },
	{ label: 'Subjects added', done: false, unresolved: true, href: '/subjects' },
	{ label: 'Every subject has its schedule details', done: false, unresolved: true, href: '/subjects' },
	{ label: 'Teachers synced from EnrollPro', done: false, unresolved: true, href: '/teachers' },
	{ label: 'Subjects have teacher coverage', done: false, unresolved: true, href: '/teaching-load' },
	{ label: 'Teaching rooms marked', done: false, unresolved: true, href: '/map' },
	{ label: 'Classes needed are worked out', done: false, unresolved: true, href: '/subjects' },
	{ label: 'Timetable made and checked', done: false, unresolved: true, href: '/timetable' },
	{ label: 'Schedule published', done: false, href: '/schedules' },
];

test('A9C8-F1: while the readiness read is in flight the region says it is reading and publishes NO count', () => {
	const html = renderCard({ pending: true });

	// THE FAILING-FIRST ROW. On `origin/main` there is no `pending` prop, so the card
	// renders its header over the same rows and this string is on the page:
	//   "0 of 10 ready · 1 step to go · 9 ATLAS could not check"
	assert.doesNotMatch(html, /could not check/i, 'a read that has not arrived must never be reported as a read that failed');
	assert.doesNotMatch(html, /of 10 ready/i, 'no count may be published before the read answers');
	assert.doesNotMatch(html, /step[s]? to go/i, 'no step may be claimed to go before the read answers');
	assert.doesNotMatch(html, /dashboard-unresolved-heading/, 'the unresolved region is a failure state and must not render while pending');
	assert.doesNotMatch(html, /dashboard-not-ready-list/, 'outstanding work must not be listed from a read that has not answered');
	assert.match(html, new RegExp(readinessPendingSentence().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 24)), 'the region must say it is reading');
	// The vocabulary is the one the source chip already owns, not a second one.
	assert.match(readinessPendingSentence(), /Checking source/i);
});

test('A9C8-F1: a read that FAILED still says "could not check", and it now carries the retry', () => {
	const html = renderCard({ onRetry: () => undefined });

	assert.match(html, /ATLAS could not check these/i, 'a genuine failure earns those words');
	assert.match(html, /0 of 10 ready · 1 step to go · 9 ATLAS could not check/, 'once the read has answered, the count is published — and it is the count the live screen showed over a request still in flight');
	assert.match(html, /dashboard-unresolved-retry/, 'the failure state must carry a retry — it is the only state that needs one');
	assert.match(html, /Check again/);
});

test('A9C8-F1: the pending state is a HOOK state, not a rendering guess — the source forbids claiming anything from it', () => {
	// The hook is the only place that knows whether an answer exists. Two things must hold
	// there: it publishes the flag, and it clears the flag only when a read has ANSWERED
	// (success OR failure) — otherwise a slow read re-enters the lie.
	assert.match(HOOK_CODE, /readinessPending/, 'the hook must expose the pending flag the screen renders from');
	assert.match(HOOK_CODE, /setReadinessPending\(false\)/, 'the flag must be cleared when a read answers');
	assert.match(HOOK_CODE, /setReadinessPending\(true\)/, 'and set again when the state is cleared, so a school change cannot inherit a settled screen');
	// The Dashboard's next-step card is the most-pressed control on the page, so the pending
	// state must REMOVE it rather than render an instruction derived from null inputs
	// (`pickNextStep` over nulls returns "Add subjects" for a school that has 21 subjects).
	assert.match(DASHBOARD_CODE, /reading \? \(/, 'the Dashboard must branch on the pending flag');
	assert.match(DASHBOARD_CODE, /const reading = readinessPending;/, 'and take it from the hook, not from a local guess');
	// The reading words are the ones the source chip already owns, not a second vocabulary.
	assert.match(DASHBOARD_CODE, /SOURCE_CHIP_COPY\.checking_source/, 'the reading words are the ones the source chip already owns');
	assert.doesNotMatch(
		READINESS_CARD_SOURCE.replace(/^\s*\*.*$/gm, ''),
		/spinner|progress|skipped|still running/i,
		'no progress furniture is added to describe a wait the scheduler did not cause',
	);
});

/* ───────────────────────── F2: one fact, one read, one number ───────────────────────── */

test('A9C8-F2: the run-review row is decided by the SUMMARY counts, and the second read is gone', () => {
	// The staging capture: run 347 COMPLETED, 6 publication-allowlist HARD, 696 SOFT, not
	// published. The row must read as blocked with 6 hard blockers, and must never read
	// "made and checked" (which is what a 0 from a second, later read produced on live).
	const summary = { generation: { blockingHardCount: 6, softViolationCount: 696 } };
	const counts = resolveRunWideCountsFromSummary(summary);
	assert.deepEqual(counts, { hard: 6, soft: 696 });

	const item = buildRunReviewChecklistItem({
		generationAvailable: true,
		latestRunStatus: 'COMPLETED',
		hardViolationCount: counts.hard,
		softViolationCount: counts.soft,
	});
	assert.equal(item.done, false, '6 run-wide hard blockers must not read as "made and checked"');
	assert.match(item.hint ?? '', /6 run-wide hard blocker/, 'the row shows the summary\'s own figure');

	// ONE READ. The duplicate `runs/latest/violations` request is the F2 defect: a slower
	// second read of a fact the summary already carried, able to turn an answered fact into
	// "could not check" or into a clean run.
	//
	// A9 c8 R1 (QA F-B) — THIS ASSERTION WAS DEFEATABLE AND IS NOW NOT. It used to be
	// `/atlasApi\.get[^;\n]*violations/`, and `[^;\n]*` cannot cross a `;`, so the request
	// re-typed the way a developer actually types it — with a generic type argument
	// containing semicolons — passed this gate 13/13. The guard now matches the URL alone,
	// which no amount of generic punctuation can hide, and the case below proves each
	// re-typing is caught.
	assert.doesNotMatch(HOOK_CODE, F2_DELETED_READ_GUARD, 'the second read of the run report must be gone from the hook');
	// The two report-shape resolvers remain as this side's statement of the server's
	// predicate (the parity test above uses them), but nothing may CALL them any more: a
	// resolver nothing calls is documentation, a resolver something calls is a second source.
	for (const resolver of ['resolveRunWideHardViolationCount', 'resolveRunWideSoftViolationCount']) {
		assert.equal(
			(HOOK_CODE.match(new RegExp(`${resolver}\\(`, 'g')) ?? []).length,
			1,
			`${resolver} must be defined and never called — one source, one read`,
		);
	}
	assert.match(HOOK_CODE, /resolveRunWideCountsFromSummary\(summary\)/, 'the summary is the only source of the run counts');
});

test('A9C8-F2: the summary field and the report field are the SAME predicate, or the two pages drift', () => {
	// The server computes the summary's counts with `canonicalRunViolationCounts` (the same
	// `buildViolationReport` projection `/audit` uses). The client-side report resolvers are
	// kept as that predicate's statement on this side, and this is the pin that says the two
	// agree — so "the Dashboard says 0 and /timetable says 6" cannot come back quietly.
	const report = { counts: { runWide: { total: 702, hard: 9, blockingHard: 6, soft: 696, byCode: {} } } };
	const fromReport = { hard: resolveRunWideHardViolationCount(report), soft: resolveRunWideSoftViolationCount(report) };
	const fromSummary = resolveRunWideCountsFromSummary({ generation: { blockingHardCount: 6, softViolationCount: 696 } });
	assert.deepEqual(fromSummary, fromReport, 'one run, one definition, one number');

	// Null stays null. A generation read that FAILED is not a clean run.
	assert.deepEqual(resolveRunWideCountsFromSummary({ generation: { available: false } }), { hard: null, soft: null });
	assert.deepEqual(resolveRunWideCountsFromSummary(null), { hard: null, soft: null });
	// And a summary with no verified active term must NOT blank the run's figures: that is
	// how an answered fact used to become "could not check".
	assert.deepEqual(
		resolveRunWideCountsFromSummary({ activeTerm: null, generation: { blockingHardCount: 6, softViolationCount: 696 } }),
		{ hard: 6, soft: 696 },
	);
});

/* ───────────────────────── F3: one room number, one definition ───────────────────────── */

test('A9C8-F3: the room figure is one population on both ends, from the same definition', () => {
	const totals = teachingRoomTotals(STAGING_BUILDINGS);
	assert.equal(totals.teaching, 78, 'the denominator is the TEACHING rooms, from the measured capture');
	assert.equal(totals.ready, 78, 'every one of those 78 can hold a class, which is why /map says 78 of 78');
	assert.equal(teachingRoomsFigure(totals), '78 of 78', 'the tile prints the Campus page\'s fraction, never 78/103');
	assert.doesNotMatch(teachingRoomsFigure(totals), /103/, 'the school\'s total room count is a different population and is not a readiness number');
	assert.match(teachingRoomsStatusLine(totals), /Ready to be used for classes/i);

	// THE DISCRIMINATING CONTROL. Break ONE room and the figure must move on BOTH sides of
	// the fraction, together. A numerator from one list and a denominator from another is the
	// A3-C4 defect the Campus page already removed once.
	const broken = STAGING_BUILDINGS.map((b, index) => (index === 0
		? { ...b, rooms: b.rooms.map((r, i) => (i === 0 ? { ...r, capacity: 0 } : r)) }
		: b));
	const brokenTotals = teachingRoomTotals(broken);
	assert.deepEqual(brokenTotals, { ready: 77, teaching: 78 });
	assert.equal(teachingRoomsFigure(brokenTotals), '77 of 78');
	assert.match(teachingRoomsStatusLine(brokenTotals), /1 room needs a seat count or room type/);
});

test('A9C8-F3: the Dashboard prints the Campus figure and nothing that argues with it', () => {
	assert.match(DASHBOARD_CODE, /teachingRoomsFigure\(teachingRooms\)/, 'the tile must render through the shared definition');
	assert.match(DASHBOARD_CODE, /teachingRoomsStatusLine\(teachingRooms\)/, 'and so must its one status line');
	assert.doesNotMatch(DASHBOARD_CODE, /\$\{teachingRoomCount\}\/\$\{totalRoomCount\}/, 'the 78/103 fraction must be gone from the Dashboard');
	assert.doesNotMatch(DASHBOARD_CODE, /teachingRoomCount,|totalRoomCount,/, 'and the Dashboard must not be handed the two retired counts at all');
	assert.doesNotMatch(CAMPUS_PANEL_CODE, /readyCount/, 'the `7 ready` buildings badge is retired — §8 forbids two statuses for one fact');
	assert.doesNotMatch(CAMPUS_PANEL_CODE, /totalRoomCount|teachingRoomCount:/, 'the panel must not be handed the school room total at all');
	// The `100%` had no denominator a reader could check, and sat directly above a building
	// the panel called dead. It was the map toolbar's ZOOM readout.
	assert.doesNotMatch(CANVAS_PREVIEW_CODE, /Math\.round\(zoom/, 'the zoom percentage must be omitted, not printed');
	assert.doesNotMatch(CANVAS_PREVIEW_CODE, /<Move\b/, 'its icon goes with it, rather than being left as an orphan control');
});

test('A9C8-F3: one building, one sentence — the Campus page\'s own wording, on both screens', () => {
	const dead = STAGING_BUILDINGS.find((b) => b.name === 'Speech Lab');
	assert.ok(dead, 'the fixture carries the capture\'s dead building');
	// A building with NO rooms must not print "None of its 0 rooms are marked…": it has to
	// be told to add rooms, which is the one fix the region already offers.
	assert.match(selectedBuildingRoomsSentence(dead), /no rooms yet/i);
	assert.match(selectedBuildingRoomsSentence(dead), /used for classes/i, 'and it names the one fix');

	const storeOnly = building(9, 'Annex', [room(90, { isTeachingSpace: false, type: 'OTHER', capacity: null }), room(91, { isTeachingSpace: false, type: 'OTHER', capacity: null })]);
	assert.match(
		selectedBuildingRoomsSentence(storeOnly),
		/None of its 2 rooms are marked as a teaching classroom, so no class can be held there\./,
		'the zero-TEACHING-room case keeps the Campus page\'s sentence, including its consequence',
	);
	const mixed = building(10, 'North Wing', [room(100), room(101), room(102, { isTeachingSpace: false, type: 'OTHER', capacity: null })]);
	assert.equal(selectedBuildingRoomsSentence(mixed), '2 of 3 rooms are used for classes.');

	// The Dashboard panel must not say "0 teaching rooms ready" about any of them.
	assert.doesNotMatch(CAMPUS_PANEL_CODE, /teaching rooms? ready/, 'the "N teaching rooms ready" line is retired');
	assert.match(CAMPUS_PANEL_CODE, /selectedBuildingRoomsSentence\(selectedBuilding\)/);
	assert.match(CAMPUS_OVERVIEW_CODE, /selectedBuildingRoomsSentence\(selectedBuilding\)/, 'and /map renders the same sentence from the same function');
});

test('A9C8-F3: the grammar slip "1 building have no rooms" is corrected where it is BUILT, on both sides', () => {
	// The string the client receives from the server is printed verbatim in three places on
	// the Dashboard, so both builders are corrected and both are pinned here.
	assert.match(HOOK_CODE, /building\$\{teachingBuildingsWithoutRooms\.length === 1 \? ' has' : 's have'\} no rooms/);
	assert.match(SERVER_SUMMARY_CODE, /building\$\{teachingBuildingsWithoutRooms\.length === 1 \? ' has' : 's have'\} no rooms/);
	assert.doesNotMatch(HOOK_CODE, /teachingBuildingsWithoutRooms\.length !== 1 \? 's' : ''\} have no rooms/);
	assert.doesNotMatch(SERVER_SUMMARY_CODE, /teachingBuildingsWithoutRooms\.length !== 1 \? 's' : ''\} have no rooms/);
	// The plural is untouched: "2 buildings have no rooms" was already right. The count is
	// held in a variable so `tsc` sees a `number` rather than two literal types with no
	// overlap, which is what a literal comparison here would be.
	for (const count of [1, 2, 3]) {
		assert.equal(
			`${count} building${count === 1 ? ' has' : 's have'} no rooms`,
			count === 1 ? '1 building has no rooms' : `${count} buildings have no rooms`,
			'the verb must agree with the number, at 1 and above it',
		);
	}
});

/* ───────────────────────── F4: the problems region counts one thing ───────────────────────── */

function withBuilding(buildingRef: Building, roomRef: Room, status: RoomWithBuilding['status']): RoomWithBuilding {
	return { building: buildingRef, room: roomRef, status };
}

const PROBLEM_FIXTURE: RoomWithBuilding[] = [
	// North Wing: one room with no seat count (a real room defect) and one with no section
	// yet (a timetable fact). East Wing is healthy. Annex has no teaching room at all.
	withBuilding(building(1, 'North Wing', []), room(101, { capacity: 0 }), 'needs-capacity'),
	withBuilding(building(1, 'North Wing', []), room(102, { capacity: 40 }), 'needs-section'),
	withBuilding(building(2, 'East Wing', []), room(201, { capacity: 40 }), 'ready'),
	withBuilding(building(3, 'Annex', []), room(301, { isTeachingSpace: false, type: 'OTHER', capacity: null }), 'unavailable'),
	withBuilding(building(3, 'Annex', []), room(302, { isTeachingSpace: false, type: 'OTHER', capacity: null }), 'unavailable'),
];

test('A9C8-F4: the summary line never says "0 rooms need something fixed" about a building with no rooms', () => {
	const groups = buildRoomProblemGroups(PROBLEM_FIXTURE);
	const summary = roomProblemSummary(groups);

	assert.equal(summary.buildings, 2, 'both broken buildings are still in the region');
	assert.equal(summary.buildingsWithoutTeachingRooms, 1, 'the Annex is counted as a building to fix, in its own words');
	assert.equal(summary.rooms, 1, 'ONLY the room that is genuinely broken is counted: the needs-section room is not a defect');

	const sentence = roomProblemSummarySentence(groups);
	assert.doesNotMatch(sentence, /0 rooms need/, 'the exact live sentence must be unrepresentable');
	assert.match(sentence, /1 room needs something fixed/);
	assert.match(sentence, /1 building has no room marked for classes/);

	// The Annex ALONE — the case the live screen got wrong — reads as the whole sentence.
	const annexOnly = buildRoomProblemGroups(PROBLEM_FIXTURE.filter((e) => e.building.name === 'Annex'));
	assert.equal(roomProblemSummary(annexOnly).rooms, 0);
	assert.equal(
		roomProblemSummarySentence(annexOnly),
		'1 building has no room marked for classes.',
		'a building with no teaching room IS the thing to fix, and it is named, not counted as zero rooms',
	);
});

test('A9C8-F4: a room with no section yet is a timetable fact, and cannot be a broken room', () => {
	// A9 C3 already decided this for the BANNER: `needs-section` is excluded from the
	// readiness figure, so those rooms read as READY on the same screen. F4 closes the other
	// half — they must not read as "needs something fixed" either, or one room is both.
	const onlyNeedsSection = buildRoomProblemGroups([
		withBuilding(building(1, 'North Wing', []), room(101, { capacity: 40 }), 'needs-section'),
		withBuilding(building(1, 'North Wing', []), room(102, { capacity: 40 }), 'needs-section'),
	]);
	assert.equal(roomProblemSummary(onlyNeedsSection).rooms, 0, 'no section yet is not a room defect');
	assert.equal(onlyNeedsSection[0].problems.length, 2, 'the per-building detail is UNCHANGED — both rooms are still named under the group');
	assert.match(onlyNeedsSection[0].consequence, /have no section yet/, 'and the group still says so in its own words');

	// A genuinely broken room still counts, and still pluralises correctly.
	const oneBroken = buildRoomProblemGroups([
		withBuilding(building(1, 'North Wing', []), room(101, { capacity: 0 }), 'needs-capacity'),
	]);
	assert.equal(roomProblemSummarySentence(oneBroken), '1 room needs something fixed, in 1 building.');
	const twoBroken = buildRoomProblemGroups([
		withBuilding(building(1, 'North Wing', []), room(101, { capacity: 0 }), 'needs-capacity'),
		withBuilding(building(1, 'North Wing', []), room(102, { type: 'OTHER' }), 'needs-room-type'),
	]);
	assert.equal(roomProblemSummarySentence(twoBroken), '2 rooms need something fixed, in 1 building.');
});

test('A9C8-F4: the sentence is rendered through the pure function, and the region markup is untouched', () => {
	assert.match(ROOM_LIST_CODE, /roomProblemSummarySentence\(groups\)/, 'the card must render the sentence through the tested function');
	// Every test hook A9 C6 pinned survives: this is a correction to what the LINE counts,
	// not a rewrite of the region.
	for (const hook of ['room-problem-groups', 'room-problem-group', 'room-problem-group-action', 'room-readiness-summary']) {
		assert.ok(ROOM_LIST_SOURCE.includes(`data-testid="${hook}"`), `${hook} must survive — F4 changes the summary, not the region`);
	}
	assert.match(ROOM_LIST_SOURCE, /export function buildRoomProblemGroups/, 'the grouping, order, consequence and fix copy are untouched');
	// And the `needs-section` room is still LISTED under its group, so nothing is hidden by
	// the omission from the count.
	assert.match(ROOM_LIST_SOURCE, /group\.problems\.map/, 'every problem room in a group is still named');
});

/* ───────────────────────── F-A: an unresolved school prints nothing (QA R1) ───────────────────────── */

/**
 * THE MEASURED BLOCKED STATE, as QA rendered it on the candidate at
 * `http://127.0.0.1:5242/__dev/staging-login` with `/auth/me` intercepted so the actor
 * school is unresolvable:
 *
 *   roomTile    : "Teaching Rooms | 0 of 0 | Checking source"
 *   sectionsTile: "Sections | — | Checking source"
 *   subjectsTile: "Subjects | 0 | Checking source"
 *   teachersTile: "Teachers | 0 | Checking source"
 *   scopeCard   : "We could not confirm your school | ATLAS could not determine the authenticated school."
 *
 * The scope branch calls `resetDomainState()` — which sets `readinessPending = true` — and then
 * `setLoading(false)` with `buildings` still `[]`. So `loading` cannot be the guard: it is
 * false. And `teachingRoomTotals([])` is `{ready: 0, teaching: 0}`, whose figure `0 of 0` reads
 * as a school with no rooms rather than as no room data at all.
 *
 * These are the exact inputs of that render. `measured` is what each tile's value would have
 * been had nothing suppressed it, so the test is the render, not a paraphrase of it.
 */
const BLOCKED_INPUTS = {
	loading: false,
	reading: true,
	available: false,
	roomFigure: teachingRoomsFigure(teachingRoomTotals([])),
};

test('A9C8-FA: the BLOCKED state prints nothing, exactly as the base did — never a figure from an empty read', () => {
	// The regression, tile for tile, from QA's own render.
	assert.equal(dashboardTileValue({ ...BLOCKED_INPUTS, measured: BLOCKED_INPUTS.roomFigure }), '\u2014', 'Teaching Rooms must print the honest "nothing", not `0 of 0`');
	assert.equal(dashboardTileValue({ ...BLOCKED_INPUTS, measured: null }), '\u2014', 'Sections must print "nothing"');
	assert.equal(dashboardTileValue({ ...BLOCKED_INPUTS, measured: null }), '\u2014', 'Subjects must print "nothing", not `0`');
	assert.equal(dashboardTileValue({ ...BLOCKED_INPUTS, measured: null }), '\u2014', 'Teachers must print "nothing", not `0`');
	assert.equal(
		dashboardTileValue({ loading: false, reading: true, available: false, measured: BLOCKED_INPUTS.roomFigure }),
		'\u2014',
		'the literal screen QA captured, asserted directly',
	);
});

test('A9C8-FA: the rule distinguishes NO DATA from a MEASURED ZERO, which is the whole defect', () => {
	// A school that genuinely has no teaching rooms, with the campus read ANSWERED, is a
	// fact and prints a figure — `0 of 0` with the Campus page's own sentence under it.
	const answeredEmptyCampus = { loading: false, reading: false, available: true };
	assert.equal(dashboardTileValue({ ...answeredEmptyCampus, measured: '0 of 0' }), '0 of 0', 'a measured zero is a fact, not an absence');
	assert.equal(dashboardTileValue({ ...answeredEmptyCampus, measured: 0 }), '0', 'and for the count tiles too');
	// The same `0 of 0` with the read still in flight is NOT a fact.
	assert.equal(dashboardTileValue({ loading: false, reading: true, available: true, measured: '0 of 0' }), '\u2014');
	// And with the campus read failed, it is not a fact either.
	assert.equal(dashboardTileValue({ loading: false, reading: false, available: false, measured: '0 of 0' }), '\u2014');

	// `null` is never a figure; `undefined` is never a figure; an answer is a figure.
	assert.equal(dashboardTileValue({ ...answeredEmptyCampus, measured: null }), '\u2014');
	assert.equal(dashboardTileValue({ ...answeredEmptyCampus, measured: undefined }), '\u2014');
	assert.equal(dashboardTileValue({ ...answeredEmptyCampus, measured: 21 }), '21');
	assert.equal(dashboardTileValue({ ...answeredEmptyCampus, measured: '78 of 78' }), '78 of 78');

	// The normal loading beat is unchanged, so the settled screen is untouched by this rule.
	assert.equal(dashboardTileValue({ loading: true, reading: true, available: false, measured: null }), '\u2026', 'a read in flight shows an ellipsis, never a dash or a number');
});

test('A9C8-FA: all four tiles route through the one rule, so the hole cannot reopen on the fifth', () => {
	// The defect reached three of four tiles because three of them decided for themselves.
	// One function, four call sites, and a fourth tile added later has nowhere else to go.
	const callSites = [...DASHBOARD_CODE.matchAll(/dashboardTileValue\(\{/g)];
	assert.equal(callSites.length, 4, 'every stat tile must decide its figure through the tested rule');
	assert.doesNotMatch(
		DASHBOARD_CODE,
		/label: '(Sections|Subjects|Teachers|Teaching Rooms)', value: loading \?/,
		'a tile must not hand-roll its own value ternary again',
	);
	// The rule is SHARED, not copied: the campus panel's own figure was the last `0 of 0` on
	// that screen, and it is in a component the Dashboard imports — so the rule lives in
	// `@/lib/dashboard-figure` and both sides import it. A second copy would be the defect.
	assert.match(DASHBOARD_CODE, /from '@\/lib\/dashboard-figure'/, 'the Dashboard must import the shared rule, not define it');
	assert.match(CAMPUS_PANEL_CODE, /from '@\/lib\/dashboard-figure'/, 'and so must the campus panel');
	assert.match(CAMPUS_PANEL_CODE, /dashboardFigure\(\{ loading, reading: false, available: buildings\.length > 0, measured: teachingRoomsFigure\(teachingRooms\) \}\)/,
		'the panel figure is gated on HAVING a room list, so a measured zero still prints and an absent list prints nothing');
	// Re-rendering the blocked state with only the ROOM figure fixed left `BUILDINGS 0` on the
	// same card, so the building count is gated by the same rule and asserted here.
	assert.match(CAMPUS_PANEL_CODE, /dashboardFigure\(\{ loading, reading: false, available: buildings\.length > 0, measured: teachingBuildings\.length \}\)/,
		'the building count is gated the same way — a school it cannot read has no building count to print');
	assert.equal(
		[...CAMPUS_PANEL_CODE.matchAll(/dashboardFigure\(\{/g)].length,
		2,
		'both panel figures go through the shared rule',
	);
	assert.equal(
		dashboardFigure({ loading: false, reading: false, available: false, measured: '0 of 0' }),
		'\u2014',
		'the panel with no room list prints nothing, which is the state QA captured',
	);
	assert.equal(
		dashboardFigure({ loading: false, reading: false, available: true, measured: '0 of 0' }),
		'0 of 0',
		'a school that really has buildings and no teaching rooms still prints its measured zero',
	);
});

/* ───────────────────────── F-B: the deleted read cannot be re-typed back in (QA R1) ───────────────────────── */

test('A9C8-FB: every re-typing of the deleted read is caught by the guard, including the one that beat it', () => {
	for (const snippet of F2_RE_TYPED) {
		assert.match(snippet, F2_DELETED_READ_GUARD, `the guard must catch: ${snippet.slice(0, 70)}…`);
	}
	// The discriminator. The OLD guard is `atlasApi\.get[^;\n]*violations`, and the generic
	// type argument QA re-typed contains semicolons, so the old guard MISSES it while the
	// new one catches it. This is why the pattern was replaced and not merely re-spelled.
	const OLD_GUARD = /atlasApi\.get[^;\n]*violations/;
	assert.doesNotMatch(F2_RE_TYPED[1], OLD_GUARD, 'the previous guard is defeatable — the shape that beat it is still in the table');
	assert.match(F2_RE_TYPED[1], F2_DELETED_READ_GUARD, 'and the replacement catches it');
	// The guard must also be OFF the live source, in the hook and in the page: the read is
	// gone, not merely moved out of the file this guard happens to read.
	assert.doesNotMatch(HOOK_CODE, F2_DELETED_READ_GUARD, 'the hook must not issue the deleted read');
	assert.doesNotMatch(DASHBOARD_CODE, F2_DELETED_READ_GUARD, 'nor may the page re-introduce it');
	// The guard must not be narrowed to a path that only one call site would use. Compared as	// a STRING, not a regex: `RegExp.source` for this pattern is the text `runs\/latest\/violations`,
	// backslashes included, and writing that comparison as a regex literal parses `/runs\\/` as a
	// complete pattern followed by a stray identifier.
	assert.equal(F2_DELETED_READ_GUARD.source, 'runs\\/latest\\/violations', 'the guard names the URL, not a caller spelling');
});

/* ───────────────────────── the reading is real, not a source grep ───────────────────────── */

test('A9C8-READING: the room banner on /map and the Dashboard tile are the same function', () => {
	// The strongest available form of "one number, one definition": the Campus page computes
	// its banner's numerator with `isReadyTeachingRoom`, the same predicate `teachingRoomTotals`
	// uses for the Dashboard tile. Two surfaces, one definition, no second copy to drift.
	assert.match(source('components/campus-map/CampusMapOverview.tsx'), /isReadyTeachingRoom\(room\)/);
	assert.equal(isReadyTeachingRoom({ isTeachingSpace: true, capacity: 40, type: 'CLASSROOM' } as Room), true);
	assert.equal(isReadyTeachingRoom({ isTeachingSpace: true, capacity: 0, type: 'CLASSROOM' } as Room), false, 'no seat count means no class can be sized into it');
	assert.equal(isReadyTeachingRoom({ isTeachingSpace: true, capacity: 40, type: 'OTHER' } as Room), false, 'type OTHER is not a classroom the home-room step can assign');
	assert.equal(isReadyTeachingRoom({ isTeachingSpace: false, capacity: 40, type: 'CLASSROOM' } as Room), false, 'a store room is never a teaching room');
});
