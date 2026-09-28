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
 *     POST and the appeal-status PATCH with
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
import test from 'node:test';

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

const ROOM_PREFERENCES_ROUTE = '/faculty/room-preferences';
const ROOM_PREFERENCES_LABEL = 'Room Preferences';
const TEACHERS_AND_ROOMS_GROUP = 'Teachers and Rooms';

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

test('R1: an admin actor sees a /faculty/room-preferences nav item labelled exactly "Room Preferences"', () => {
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

// ── row 2: it lands in the right GROUP ──────────────────────────────────────

test('R2: the item sits in "Teachers and Rooms", the same group as /teachers and /faculty/concerns', () => {
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

// ── row 3: AUTHORITY PARITY with the server's PRIVILEGED_ROLES ──────────────

test('R3a: the item is adminOnly and carries NO schedulerAccess, matching server PRIVILEGED_ROLES', () => {
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

test('R3b: a scheduler with only timetable:read does NOT see the item, while officer/admin/SYSTEM_ADMIN DO', () => {
	assert.equal(
		itemsAt.length > 0,
		true,
		'sanity: the admin probe used by this file must be non-vacuous',
	);
	const schedulerSees = canSeeNavItem(scheduler, itemsAt(ROOM_PREFERENCES_ROUTE)[0]!);
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

// ── row 4: exactly ONE label reaches this route ────────────────────────────

test('R4: exactly one nav item anywhere resolves to /faculty/room-preferences', () => {
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

// ── row 5: sidebar / shell title / breadcrumb all agree ────────────────────

test('R5: sidebar label, route chrome title and breadcrumb leaf are all "Room Preferences"', () => {
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
