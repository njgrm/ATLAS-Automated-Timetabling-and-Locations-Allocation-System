/**
 * A3-C8 / S3 — ROOM-PREFERENCES REACHABILITY.
 *
 * ## The defect this pins
 *
 * `/faculty/room-preferences` is a real, fully built, SERVER-AUTHORISED review
 * queue that no operator could reach:
 *
 *   - `App.tsx:325` registered the route and rendered `OfficerRoomPreferences`.
 *   - `pages/OfficerRoomPreferences.tsx` is 620 lines and complete: it reads
 *     `/room-preferences/{school}/{year}/latest/summary`, filters by
 *     status/decision, opens the collaboration socket, and offers preview then
 *     review per request plus reviewer notes. Not a stub.
 *   - `navigation.ts` already carried a chrome override for it
 *     (`group: 'Teachers and Rooms', title: 'Room Preferences'`) — which is a
 *     BREADCRUMB/TITLE map, NOT a nav item. That is precisely why the page
 *     rendered a correct shell title while having zero inbound links.
 *   - `atlas-server/src/routes/room-preference.router.ts` guards the review
 *     PATCH and the appeal-status PATCH with
 *     `PRIVILEGED_ROLES = {admin, officer, SYSTEM_ADMIN}`, answering
 *     403 FORBIDDEN / "Only admin, officer, or SYSTEM_ADMIN can review room
 *     preferences."
 *
 * So: a working privileged queue behind no door handle. A false errand in the
 * exact class this lane exists to remove. The decision recorded is LINK IT.
 *
 * ## The load-bearing omission
 *
 * The nav item is `adminOnly: true` and carries NO `schedulerAccess: true`, on
 * purpose. `canSeeNavItem` resolves an `adminOnly` item with no
 * `schedulerAccess` to exactly `admin` / `officer` / `SYSTEM_ADMIN` — the same
 * three roles the server enforces. That is nav/server authority PARITY, and row
 * 3 pins the BEHAVIOUR (who can actually see it), not merely the field, so a
 * later "consistency" edit that adds `schedulerAccess: true` goes red instead
 * of quietly advertising an approve/reject queue to a scheduler the server
 * will 403.
 *
 * ## Why the label is not a new name
 *
 * The route chrome title, the `PageHeader` in the page, and the sidebar now all
 * say 'Room Preferences'. Offering one destination under two labels is the
 * duplicate-link defect lane c6 removed; row 5 pins the three-way agreement and
 * row 4 pins that exactly one label resolves to this route.
 *
 * ## Discriminating power (AGENTS.md §11)
 *
 * `schedulerAccessViolations` is a pure function, so row 6 can hand it a
 * FABRICATED nav array carrying a raw `schedulerAccess: true` item at this
 * route and assert it is detected. A test that cannot fail is not evidence.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	breadcrumbGroups,
	canSeeNavItem,
	getVisibleNavigation,
	navigationNav,
	resolveRouteChrome,
	teachersAndRoomsNav,
	type NavItemDef,
	type NavigationActor,
} from '@/components/app-shell/navigation';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../../..');

function source(relativePath: string): string {
	return readFileSync(resolve(CLIENT_ROOT, relativePath), 'utf8');
}

const ROOM_PREFERENCES_ROUTE = '/faculty/room-preferences';
const ROOM_PREFERENCES_LABEL = 'Room Preferences';
const TEACHERS_AND_ROOMS_GROUP = 'Teachers and Rooms';
const FACULTY_PREFERENCES_ROUTE = '/faculty/preferences';
/**
 * A3 c15 — the ONE page, its real route, and its one name. `/faculty/preferences`
 * is the mounted page route now, so the sidebar item and both redirects point
 * here; `/faculty/concerns` is the retired alias that redirects to it.
 */
const CONCERNS_ROUTE = FACULTY_PREFERENCES_ROUTE;
const CONCERNS_LABEL = 'Teacher Preferences';
const RETIRED_CONCERNS_ROUTE = '/faculty/concerns';

/* ═══════════════════════════════════════════════════════════════════════════
 * A3 c13 — SUPERSESSION RECORD (added 2026-09-29). Rows R1-R5 below are the
 * original A3-C8 assertions, kept VERBATIM and kept PRESENT, but they now run
 * through `assertSuperseded` instead of standing as the live contract.
 *
 * WHY THE PREMISE IS SUPERSEDED, not broken. A3-C8 recorded one defect: a
 * fully built 692-line `OfficerRoomPreferences` review queue sat behind a
 * registered route with zero inbound links, so no operator could reach it. The
 * recorded decision was LINK IT, and for that surface that was right.
 *
 * A3 c13 folded that queue INTO Teacher Preferences, per the operator direction
 * ("room preferences should not be a different page, it should be folded into
 * teacher preferences so there is only one page the scheduler will fill out when
 * speaking to a teacher"). `pages/OfficerRoomPreferences.tsx` is now
 * `<Navigate to="/faculty/preferences" replace />`, and the queue's two real
 * capabilities are both present on the selected teacher's form: the ZERO-WRITE
 * preview and the one button that applies through the existing review PATCH.
 *
 * So the A3-C8 PREMISE ("a fully built page must have a nav item") no longer
 * applies to this route: the page is not hidden, it is folded, and no operator
 * loses access to anything. A nav item pointing at a route that immediately
 * redirects would be a second name for one destination — the duplicate-link
 * defect A3-C6 removed elsewhere on this very lane.
 *
 * NOTHING WAS DELETED OR WEAKENED. Every original assertion survives inside the
 * `legacy` callback of its row, and the row now proves the retirement
 * DELIBERATELY: it requires the old contract to have stopped holding. That
 * makes each row a tripwire — if a later change re-adds the nav item, R1-R5
 * turn RED again, because the retired surface has been resurrected and someone
 * must decide whether the fold is still intended. The replacement contract is
 * pinned by R7 at the end of this file.
 * ═══════════════════════════════════════════════════════════════════════════ */

const SUPERSEDED_ON = '2026-09-29';
const SUPERSESSION_REASON =
	'A3 c13 folded the room-request review queue into /faculty/preferences; the route now redirects and the sidebar shows one label.';

/**
 * Run a legacy assertion and require it to have STOPPED holding, naming the
 * date and reason. The callback is never edited or removed — it is the record.
 */
function assertSuperseded(row: string, legacy: () => void): void {
	let stillHolds = true;
	let failure = '';
	try {
		legacy();
	} catch (error) {
		stillHolds = false;
		failure = error instanceof Error ? error.message : String(error);
	}
	assert.equal(
		stillHolds,
		false,
		`${row} was retired on ${SUPERSEDED_ON} — ${SUPERSESSION_REASON} The legacy contract now HOLDS again, so the retired ${ROOM_PREFERENCES_ROUTE} surface has been resurrected. Either the fold is no longer wanted, or this file needs a new decision.`,
	);
	assert.ok(failure.length > 0, `${row} must fail for a real reason, not silently pass`);
}

/** The three roles the server's PRIVILEGED_ROLES set accepts. */
const PRIVILEGED_ROLES = ['admin', 'officer', 'SYSTEM_ADMIN'] as const;

const admin: NavigationActor = { role: 'admin' };
const officer: NavigationActor = { role: 'officer' };
const systemAdmin: NavigationActor = { role: 'SYSTEM_ADMIN' };
/** A scheduler: non-admin, holds ONLY `timetable:read`. */
const scheduler: NavigationActor = { role: 'faculty', capabilities: ['timetable:read'] };

function itemsAt(route: string): NavItemDef[] {
	return getVisibleNavigation(admin).filter((item) => item.to === route);
}

function groupLabelFor(route: string): string | undefined {
	return breadcrumbGroups.find((group) => group.items.some((item) => item.to === route))?.label;
}

/**
 * PURE detector for the load-bearing omission. Returns every item at the room
 * preferences route that would be visible to a non-privileged scheduler, i.e.
 * every way the nav could advertise a queue the server answers 403 FORBIDDEN.
 *
 * Extracted as a function (not inlined) so row 6 can prove it fires on a
 * fabricated array rather than only on the real one.
 */
function schedulerAccessViolations(items: readonly NavItemDef[]): string[] {
	return items
		.filter((item) => item.to === ROOM_PREFERENCES_ROUTE)
		.filter((item) => item.schedulerAccess === true)
		.filter((item) => canSeeNavItem(scheduler, item))
		.map((item) => item.label);
}

// ── row 1: an admin can SEE it, under the agreed label ──────────────────────
// SUPERSEDED 2026-09-29 by A3 c13 (see the record above). The assertions below
// are unchanged; the row now requires them to have stopped holding.

test('R1 [SUPERSEDED 2026-09-29]: an admin actor sees a /faculty/room-preferences nav item labelled exactly "Room Preferences"', () => {
	assertSuperseded('R1', () => {
		const found = itemsAt(ROOM_PREFERENCES_ROUTE);
		assert.equal(
			found.length,
			1,
			`expected exactly one visible nav item at ${ROOM_PREFERENCES_ROUTE} for an admin, found ${found.length}`,
		);
		assert.equal(
			found[0]!.label,
			ROOM_PREFERENCES_LABEL,
			'the sidebar label must match the route chrome title and the page PageHeader exactly',
		);
	});
});

// ── row 2: it lands in the right GROUP ──────────────────────────────────────
// SUPERSEDED 2026-09-29 by A3 c13. Assertions unchanged.

test('R2 [SUPERSEDED 2026-09-29]: the item sits in "Teachers and Rooms", the same group as /teachers and /faculty/concerns', () => {
	assertSuperseded('R2', () => {
		assert.equal(
			groupLabelFor(ROOM_PREFERENCES_ROUTE),
			TEACHERS_AND_ROOMS_GROUP,
			'a link in the wrong group is still a false errand — it must be findable where teachers and rooms live',
		);
		assert.equal(groupLabelFor('/teachers'), TEACHERS_AND_ROOMS_GROUP, '/teachers group baseline');
		assert.equal(groupLabelFor('/faculty/concerns'), TEACHERS_AND_ROOMS_GROUP, '/faculty/concerns group baseline');
		assert.equal(
			groupLabelFor(ROOM_PREFERENCES_ROUTE),
			groupLabelFor('/teachers'),
			'room preferences must share the group of /teachers, not merely a plausible one',
		);
		assert.ok(
			teachersAndRoomsNav.some((item) => item.to === ROOM_PREFERENCES_ROUTE),
			'the item must be a member of the exported teachersAndRoomsNav array itself',
		);
	});
});

// ── row 3: AUTHORITY PARITY with the server's PRIVILEGED_ROLES ──────────────
// SUPERSEDED 2026-09-29 by A3 c13. The authority FACT these rows established is
// unchanged and still carried by R7c: the server 403s every role outside
// {admin, officer, SYSTEM_ADMIN} on the review PATCH.

test('R3a [SUPERSEDED 2026-09-29]: the item is adminOnly and carries NO schedulerAccess, matching server PRIVILEGED_ROLES', () => {
	assertSuperseded('R3a', () => {
		const [item] = itemsAt(ROOM_PREFERENCES_ROUTE);
		assert.ok(item, `no visible nav item at ${ROOM_PREFERENCES_ROUTE}`);
		assert.equal(item!.adminOnly, true, 'the queue is privileged, so the item must be adminOnly');
		assert.notEqual(
			item!.schedulerAccess,
			true,
			'schedulerAccess must stay ABSENT: the server 403s every role outside {admin, officer, SYSTEM_ADMIN}, so advertising the queue to a scheduler would be a NEW false errand',
		);
		assert.deepEqual(
			schedulerAccessViolations(teachersAndRoomsNav),
			[],
			'the real nav array must contain no scheduler-visible room-preferences item',
		);
	});
});

test('R3b [SUPERSEDED 2026-09-29]: a scheduler with only timetable:read does NOT see the item, while officer/admin/SYSTEM_ADMIN DO', () => {
	assertSuperseded('R3b', () => {
		// Non-vacuity, for real. The previous form of this row asserted
		// `itemsAt.length > 0`, which is the helper's ARITY and is therefore always
		// true — it did not check what its message claimed (§11: a control must
		// discriminate). This asserts the admin probe actually resolves the item,
		// so a failure below can only mean the authority check flipped, never that
		// the probe silently found nothing.
		const adminProbe = itemsAt(ROOM_PREFERENCES_ROUTE);
		assert.equal(
			adminProbe.length,
			1,
			'sanity: the admin probe used by this file must resolve exactly one item, or the authority assertion below is vacuous',
		);
		const schedulerSees = canSeeNavItem(scheduler, adminProbe[0]!);
		assert.equal(
			schedulerSees,
			false,
			'a scheduler holding only timetable:read must not be shown an approve/reject queue the server 403s',
		);
		assert.equal(
			getVisibleNavigation(scheduler).some((item) => item.to === ROOM_PREFERENCES_ROUTE),
			false,
			'and the scheduler must not reach it through the flattened visible navigation either',
		);
		// The server's own role set must be able to act on everything it is shown.
		for (const role of PRIVILEGED_ROLES) {
			assert.equal(
				canSeeNavItem({ role }, itemsAt(ROOM_PREFERENCES_ROUTE)[0]!),
				true,
				`${role} is in the server PRIVILEGED_ROLES set and must be able to reach the queue it may review`,
			);
		}
		// And a scheduler is NOT silently excluded from the neighbours it legitimately owns.
		assert.equal(
			canSeeNavItem(scheduler, teachersAndRoomsNav.find((item) => item.to === '/teaching-load')!),
			true,
			'control: the scheduler capability path is still live for items that DO opt in, so R3b is not passing because canSeeNavItem ignores capabilities',
		);
	});
});

// ── row 4: exactly ONE label reaches this route ────────────────────────────
// SUPERSEDED 2026-09-29 by A3 c13. Its INTENT — one destination, one label —
// survives and is re-pinned against the new single destination in R7a.

test('R4 [SUPERSEDED 2026-09-29]: exactly one nav item anywhere resolves to /faculty/room-preferences', () => {
	assertSuperseded('R4', () => {
		const everyItem = breadcrumbGroups.flatMap((group) => group.items);
		const matches = everyItem.filter((item) => item.to === ROOM_PREFERENCES_ROUTE);
		assert.equal(
			matches.length,
			1,
			`one destination must carry one label; found ${matches.length} items at ${ROOM_PREFERENCES_ROUTE}`,
		);
		assert.equal(
			navigationNav.some((item) => item.to === ROOM_PREFERENCES_ROUTE),
			false,
			'the queue must not be duplicated into the primary Navigation group',
		);
		// No OTHER label may resolve to the same route.
		const otherLabels = everyItem
			.filter((item) => item.to !== ROOM_PREFERENCES_ROUTE)
			.map((item) => item.label)
			.filter((label) => label === ROOM_PREFERENCES_LABEL);
		assert.deepEqual(
			otherLabels,
			[],
			`label "${ROOM_PREFERENCES_LABEL}" must identify exactly one destination, never two`,
		);
	});
});

// ── row 5: sidebar / shell title / breadcrumb all agree ────────────────────
// SUPERSEDED 2026-09-29 by A3 c13. The three-way agreement it pinned is now
// re-pinned for the destination that replaced it, in R7b.

test('R5 [SUPERSEDED 2026-09-29]: sidebar label, route chrome title and breadcrumb leaf are all "Room Preferences"', () => {
	assertSuperseded('R5', () => {
		const chrome = resolveRouteChrome(ROOM_PREFERENCES_ROUTE);
		assert.equal(chrome.title, ROOM_PREFERENCES_LABEL, 'shell title must match the sidebar label');
		assert.deepEqual(
			chrome.breadcrumbs,
			[TEACHERS_AND_ROOMS_GROUP, ROOM_PREFERENCES_LABEL],
			`breadcrumbs must read Teachers and Rooms > ${ROOM_PREFERENCES_LABEL}, got ${JSON.stringify(chrome.breadcrumbs)}`,
		);
		// The three-way agreement: sidebar label === chrome title === breadcrumb leaf.
		const [item] = itemsAt(ROOM_PREFERENCES_ROUTE);
		assert.equal(item!.label, chrome.title, 'sidebar label and shell title must be one name, not two');
		assert.equal(
			chrome.breadcrumbs[chrome.breadcrumbs.length - 1],
			item!.label,
			'the breadcrumb leaf must equal the sidebar label',
		);
	});
});

// ── row 6: DISCRIMINATING CONTROL — the detector can actually fail ──────────

test('R6: the detector flags a fabricated schedulerAccess:true item at this route', () => {
	// Sanity on the REAL array first: it must be clean, or rows above are vacuous.
	assert.deepEqual(schedulerAccessViolations(teachersAndRoomsNav), [], 'real array must be clean before the control means anything');

	// The fabricated mutant: the exact "fix" this row forbids.
	const fabricated: NavItemDef[] = [
		{ label: 'Room Preferences', to: ROOM_PREFERENCES_ROUTE, icon: teachersAndRoomsNav[0]!.icon, adminOnly: true, schedulerAccess: true },
	];
	const detected = schedulerAccessViolations(fabricated);
	assert.equal(
		detected.length,
		1,
		`the detector MUST fire on a raw schedulerAccess:true item at ${ROOM_PREFERENCES_ROUTE}`,
	);
	assert.deepEqual(detected, [ROOM_PREFERENCES_LABEL], 'it must name the offending label');
	// And the field-level pin from R3a must also reject the mutant.
	const [mutant] = fabricated;
	assert.equal(mutant!.schedulerAccess, true, 'mutant really does carry the forbidden flag');
	assert.equal(
		canSeeNavItem(scheduler, mutant!),
		true,
		'and the mutant really would be shown to the scheduler — which is why R3b has to hold',
	);
	// A different route at the same flag is NOT this lane's finding; the detector is route-scoped.
	assert.deepEqual(
		schedulerAccessViolations([{ label: 'Teaching Load', to: '/teaching-load', icon: teachersAndRoomsNav[0]!.icon, adminOnly: true, schedulerAccess: true }]),
		[],
		'the detector is scoped to the room-preferences route and must not flag unrelated items',
	);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * row 7: the REPLACEMENT contract (added 2026-09-29 by A3 c13).
 *
 * This is the row that decides the lane now. R1-R5 are the record of what was
 * true; this is what is true. It is written to discriminate: every "no item"
 * claim is paired with a positive probe that the same helper DOES find the
 * replacement item, so these cannot pass by finding nothing at all.
 * ═══════════════════════════════════════════════════════════════════════════ */

test('R7a: the sidebar offers ONE teacher-preferences destination, labelled "Teacher Preferences", and no item for either retired route', () => {
	// Positive control FIRST: the same probe must find the replacement, or every
	// "zero items" assertion below is vacuous.
	const concernsItems = itemsAt(CONCERNS_ROUTE);
	assert.equal(concernsItems.length, 1, `sanity: the probe must resolve ${CONCERNS_ROUTE}, found ${concernsItems.length}`);
	assert.equal(
		concernsItems[0]!.label,
		CONCERNS_LABEL,
		'the one teacher-preferences destination carries exactly this name — one destination, one label',
	);

	// The fold: A3 c15 retired `/faculty/concerns` as this page's alias, so
	// neither it nor the room queue may advertise itself anywhere in the nav.
	for (const route of [ROOM_PREFERENCES_ROUTE, RETIRED_CONCERNS_ROUTE]) {
		assert.deepEqual(itemsAt(route), [], `${route} must not be advertised in the sidebar; it folds into ${CONCERNS_ROUTE}`);
		assert.equal(
			teachersAndRoomsNav.some((item) => item.to === route),
			false,
			`${route} must not be a member of teachersAndRoomsNav`,
		);
		assert.equal(
			navigationNav.some((item) => item.to === route),
			false,
			`${route} must not be duplicated into the primary Navigation group`,
		);
		assert.equal(
			breadcrumbGroups.flatMap((group) => group.items).some((item) => item.to === route),
			false,
			`${route} must not appear in any nav group`,
		);
	}

	// The retired LABELS must identify nothing at all — a label that survives on
	// another row is the duplicate-link defect this lane exists to remove, and
	// "Teacher Concerns" is the name A3 c15 retired outright.
	const everyLabel = breadcrumbGroups.flatMap((group) => group.items).map((item) => item.label);
	for (const retired of [ROOM_PREFERENCES_LABEL, 'Faculty Preferences', 'Teacher Concerns']) {
		assert.equal(
			everyLabel.includes(retired),
			false,
			`"${retired}" must identify no destination at all now that the page is folded`,
		);
	}
});

test('R7b: the page and both retired URLs resolve the chrome of the page they land on, so neither flashes the generic "ATLAS" title', () => {
	// This is the A3-C13 correction of the ux-r01 shared-chrome row: a URL that
	// still exists — even one whose component is a redirect — must resolve a
	// specific title. `resolveRouteChrome` falls through to 'ATLAS' on a miss,
	// which is the generic flash that row forbids.
	for (const route of [ROOM_PREFERENCES_ROUTE, RETIRED_CONCERNS_ROUTE, CONCERNS_ROUTE]) {
		const chrome = resolveRouteChrome(route);
		assert.notEqual(chrome.title, 'ATLAS', `${route} must not fall through to the generic ATLAS title`);
		assert.equal(chrome.title, CONCERNS_LABEL, `${route} lands on the teacher form, so it must name it`);
		assert.deepEqual(
			chrome.breadcrumbs,
			[TEACHERS_AND_ROOMS_GROUP, CONCERNS_LABEL],
			`${route} breadcrumbs must read ${TEACHERS_AND_ROOMS_GROUP} > ${CONCERNS_LABEL}, got ${JSON.stringify(chrome.breadcrumbs)}`,
		);
		assert.equal(
			new Set(chrome.breadcrumbs).size,
			chrome.breadcrumbs.length,
			`${route} must not repeat a breadcrumb label`,
		);
	}
});

test('R7c: both folded pages redirect to the teacher form, and the fold kept the server authority boundary intact', () => {
	// The redirect itself, read from the real page source: these components must
	// carry the redirect and nothing else. `OfficerRoomPreferences` is still the
	// mounted element for its route; `OfficerPreferences` and the A3 c15 alias are
	// the retained redirect records for paths that no longer mount a page.
	for (const page of [
		'src/pages/OfficerRoomPreferences.tsx',
		'src/pages/OfficerPreferences.tsx',
		'src/pages/TeacherConcernsAlias.tsx',
	]) {
		const text = source(page);
		assert.match(
			text,
			/<Navigate\s+to=["']\/faculty\/preferences["']\s+replace\s*\/>/,
			`${page} must render <Navigate to="/faculty/preferences" replace />`,
		);
		// The retired review queue must not be resurrected behind the redirect.
		assert.doesNotMatch(text, /useState|useEffect|atlasApi/, `${page} must be a redirect only, with no data fetching left behind`);
	}

	/*
	 * The A3-C8 authority finding SURVIVES the fold and is the reason the apply
	 * button is allowed to answer 403 rather than pretending. A scheduler holding
	 * only `timetable:read` can reach the concerns page and RECORD a room need —
	 * `assertFacultyOwnerOrOfficer` admits any admin/officer/SYSTEM_ADMIN for any
	 * teacher — but the APPLY is the review PATCH, which the server guards with
	 * PRIVILEGED_ROLES. So the nav must not claim more than the server grants.
	 */
	assert.deepEqual(
		schedulerAccessViolations(teachersAndRoomsNav),
		[],
		'no scheduler-visible item may sit at the room-preferences route',
	);
	for (const role of PRIVILEGED_ROLES) {
		assert.equal(
			canSeeNavItem({ role }, itemsAt(CONCERNS_ROUTE)[0]!),
			true,
			`${role} is in the server PRIVILEGED_ROLES set and must be able to reach the page carrying the room apply`,
		);
	}
	// The scheduler capability path still works for the item that legitimately opts
	// in, so R7c cannot pass because canSeeNavItem ignores capabilities entirely.
	assert.equal(
		canSeeNavItem(scheduler, itemsAt(CONCERNS_ROUTE)[0]!),
		true,
		'a scheduler records room needs on this page, so the capability path must still admit it',
	);
	assert.equal(
		canSeeNavItem(scheduler, teachersAndRoomsNav.find((item) => item.to === '/teaching-load')!),
		true,
		'control: the scheduler capability path is live for items that opt in',
	);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * A3 c15 — the RENAME. The operator asked for one word: the page called Teacher
 * Concerns is now called Teacher Preferences, at `/faculty/preferences`.
 *
 * These three rows are ADDED, never substituted for anything above: R1-R5 stay
 * as the superseded record and R7a-R7c stay as the folded-route contract. They
 * pin the three facts a rename can quietly get wrong — which path MOUNTS the
 * page, which path merely redirects to it, and whether the old word survives
 * anywhere a scheduler can read it.
 * ═══════════════════════════════════════════════════════════════════════════ */

const PAGES_NOT_NAMING_CONCERN = [
	'src/pages/TeacherConcerns.tsx',
	'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
	'src/components/timetable/ScheduleReviewWorkspaceHeader.tsx',
	'src/components/timetable/timetableDriftRouting.ts',
] as const;

/**
 * Persisted wire format, NOT copy. `teacher-concern-helpers.ts` stores these two
 * headings inside the frozen `notes` column, so they must survive the rename
 * byte-identically or every already-saved teacher record stops parsing. They are
 * masked out below, and the row that reads them proves they are untouched.
 */
const PERSISTED_NOT_HEADINGS = ['Notes for the scheduler', 'Room requests'] as const;

/**
 * Return the prose a scheduler could actually READ, with everything that is not
 * prose removed: block and line comments, `data-testid` attribute values (stable
 * test hooks, never rendered as copy), and module specifiers (paths, not text).
 *
 * Identifiers are deliberately NOT stripped — stripping them would also remove
 * JSX text and make the control vacuous. Instead a hit is judged by its word
 * boundary, so `describeSavedConcern` and `loadConcern` are identifiers while a
 * standalone "concern" or "concerns" is a word on screen.
 */
function readableProse(sourceText: string): string {
	return sourceText
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1')
		.replace(/\b(?:data-testid|testId|data-testid)\s*=\s*(['"`])[^'"`]*\1/g, 'data-testid=@')
		.replace(/(['"])[.@/][^'"]*\1/g, '"@"');
}

test('A3C15-1: /faculty/preferences MOUNTS the page and the two retired paths redirect to it with replace', () => {
	const app = source('src/App.tsx');
	assert.match(
		app,
		/path: 'faculty\/preferences',\s*\n\s*element: <TeacherConcerns \/>/,
		`${CONCERNS_ROUTE} must mount the page itself, not a redirect`,
	);
	assert.doesNotMatch(
		app,
		/path: 'faculty\/preferences',\s*\n\s*element: <OfficerPreferences \/>/,
		'the folded Faculty Preferences page must no longer be mounted at the real route',
	);
	assert.match(
		app,
		/path: 'faculty\/concerns',\s*\n\s*element: <TeacherConcernsAlias \/>/,
		`${RETIRED_CONCERNS_ROUTE} must mount the redirect alias, not a second page`,
	);
	assert.match(app, /path: 'faculty\/room-preferences',\s*\n\s*element: <OfficerRoomPreferences \/>/);

	for (const page of ['src/pages/TeacherConcernsAlias.tsx', 'src/pages/OfficerRoomPreferences.tsx']) {
		assert.match(
			source(page),
			/<Navigate\s+to=["']\/faculty\/preferences["']\s+replace\s*\/>/,
			`${page} must redirect to ${CONCERNS_ROUTE} with replace`,
		);
	}
	// Discrimination: the alias must be a redirect and nothing else, or the retired
	// path would render a second copy of the page under the old name.
	const alias = source('src/pages/TeacherConcernsAlias.tsx');
	assert.doesNotMatch(alias, /TeacherConcerns(?!Alias)\b(?!Workspace)/, 'the alias must not import or mount the page itself');
	assert.doesNotMatch(alias, /useState|useEffect|atlasApi/, 'the alias must carry no data fetching');
});

test('A3C15-2: exactly ONE sidebar item points at /faculty/preferences, and none points at either retired path', () => {
	// Positive control first, so the zero rows below cannot pass vacuously.
	const items = itemsAt(CONCERNS_ROUTE);
	assert.equal(items.length, 1, `sanity: exactly one item must resolve ${CONCERNS_ROUTE}, found ${items.length}`);
	assert.equal(items[0]!.label, CONCERNS_LABEL, 'one destination, one name');

	for (const route of [RETIRED_CONCERNS_ROUTE, ROOM_PREFERENCES_ROUTE]) {
		assert.deepEqual(
			breadcrumbGroups.flatMap((group) => group.items).filter((item) => item.to === route),
			[],
			`${route} is a redirect, so no nav item may point at it`,
		);
	}
	assert.equal(
		breadcrumbGroups.flatMap((group) => group.items).filter((item) => item.to === CONCERNS_ROUTE).length,
		1,
		'the one page is advertised exactly once across every nav group',
	);
});

test('A3C15-3: no user-visible string on the page, the More menu, the timetable header link or the drift card says "concern"', () => {
	for (const page of PAGES_NOT_NAMING_CONCERN) {
		const prose = readableProse(source(page));
		const hits = prose.match(/(?<![A-Za-z0-9_$])concerns?(?![A-Za-z0-9_$])/gi) ?? [];
		assert.deepEqual(
			hits,
			[],
			`${page} still shows the retired word to a scheduler: ${JSON.stringify(hits)}\n${prose
				.split('\n')
				.filter((line) => /concern/i.test(line))
				.join('\n')}`,
		);
	}
	// The control must discriminate: masking data-testid values and identifiers is
	// what lets it see prose, so prove it still catches a real sentence.
	const control = readableProse(`<Badge data-testid='concern-save-state'>Save</Badge> Your concern was recorded.`);
	assert.deepEqual(
		control.match(/(?<![A-Za-z0-9_$])concerns?(?![A-Za-z0-9_$])/gi),
		['concern'],
		'the readable-prose probe must catch a sentence and ignore the data-testid value',
	);

	// The persisted headings the rename deliberately did NOT touch: their VALUES
	// are byte-identical, because they are saved inside the frozen `notes` column.
	const helpers = source('src/components/faculty-shared/teacher-concern-helpers.ts');
	for (const heading of PERSISTED_NOT_HEADINGS) {
		assert.ok(
			helpers.includes(`= '${heading}'`),
			`the persisted heading "${heading}" must survive the rename byte-identically`,
		);
		assert.equal(/concern/i.test(heading), false, 'a persisted heading is data, so it carries no retired word anyway');
	}
});
