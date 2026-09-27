/**
 * A3-C6 — `/faculty/concerns` truthfulness (lane concerns, inventory row 40).
 *
 * This page is one an operator will click in a demo. Four defects made it lie
 * about what it could do. Each has a control here that DISCRIMINATES: every one
 * of them fails on the pre-fix tree and passes on the fixed tree, and the four
 * mutant controls recorded in the handoff each turn a specific assertion red.
 *
 *  C1  With no teacher selected the main panel was empty — a title, a picker,
 *      and nothing else. Now it carries an honest empty state that names the
 *      next step and implies no data exists. There is deliberately NO concerns
 *      LIST: `faculty-availability.router.ts` exposes get/put/post/patch, all
 *      per-faculty, and no endpoint lists concerns, so a list would need a new
 *      server route this lane does not own.
 *  C2  "Published revisions" linked to `/schedules`, which mounts
 *      `RoomSchedules` — a room/teacher/section browser with no revision
 *      concept. The revision surface was PROVEN reachable from `/timetable`
 *      (App.tsx -> ScheduleReview -> ScheduleReviewWorkspace ->
 *      CenterWorkspace -> TacticalSandboxDock -> PublishedRevisionDialog), so
 *      the honest link goes to Class Schedule instead of a dead destination.
 *  C3  The freshness badge rendered the raw enum FRESH / STALE / UNKNOWN. The
 *      tone was already there; the words were jargon. The badge tone is
 *      unchanged — only the label became plain.
 *  C4  With `changedDomains: ['availability']` "Open owning setup" resolved to
 *      `/faculty/concerns`, the page the operator was already on. With
 *      `['policy']` it resolved to `/timetable`, byte-identical to "Review &
 *      regenerate" — the same destination under two labels on one screen.
 *      A3-C6R1: the ACTION links are de-duplicated by destination, and the
 *      changed-domain CHIPS keep navigating to each domain's canonical home.
 *      De-duplicating the action must never cost a route, so the distinct-
 *      destination rule is scoped to the action set, and two preservation rows
 *      pin that every named domain still reaches its home.
 *
 * Run: `npm run test:a3-c6-concerns`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import type { GenerationInputComparison } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../../..');
const CONCERN_ROUTE = '/faculty/concerns';

function source(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

// --- JSDOM harness -----------------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/a3-c6-concerns',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	NodeFilter: dom.window.NodeFilter,
	SVGElement: dom.window.SVGElement,
	HTMLImageElement: dom.window.HTMLImageElement,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	getComputedStyle: dom.window.getComputedStyle,
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
	scrollTo: () => {},
	IS_REACT_ACT_ENVIRONMENT: true,
});

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { MemoryRouter } = await import('react-router-dom');

const { default: RunAvailabilityDriftCard } = await import('../RunAvailabilityDriftCard');
const { resolveConcernDriftView, resolveConcernDriftLinks, concernDriftStatusLabel, CONCERN_ROUTE: HELPER_CONCERN_ROUTE } =
	await import('../teacher-concern-helpers');
const { default: TeacherConcerns } = await import('@/pages/TeacherConcerns');
const { default: TeacherConcernWorkspace } = await import('../TeacherConcernWorkspace');

/**
 * Render, then SNAPSHOT the HTML into a detached node before unmounting.
 * Unmounting clears the live host, so the markup has to be copied out first or
 * every assertion reads an empty string and passes vacuously.
 */
async function renderAndUnmount(node: unknown, path = CONCERN_ROUTE): Promise<HTMLDivElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	try {
		await act(async () => {
			root.render(createElement(MemoryRouter, { initialEntries: [path] }, node as never));
		});
		await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
		const snapshot = dom.window.document.createElement('div');
		snapshot.innerHTML = host.innerHTML;
		return snapshot;
	} finally {
		await act(async () => { root.unmount(); });
		dom.window.document.body.removeChild(host);
	}
}

function anchors(host: HTMLElement): HTMLAnchorElement[] {
	return Array.from(host.querySelectorAll('a'));
}

function hrefs(host: HTMLElement): string[] {
	return anchors(host).map((a) => a.getAttribute('href') ?? '');
}

function linkTexts(host: HTMLElement): string[] {
	return anchors(host).map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim());
}

/**
 * A3-C6R1 — the card has two kinds of link, and the C4 rules differ by kind.
 *
 * The ACTION links (`Open Class Schedule`, `Open owning setup`) are the errands
 * the card asks the operator to perform, so no two of them may name the same
 * destination and none may be a self-link. The CHIPS are the information layer:
 * each names a changed domain and links to that domain's canonical home, which
 * may legitimately be a destination an action also reaches (`policy` is home at
 * `/timetable`). So "distinct destination" is a property of the ACTION set, and
 * "every named domain is reachable" is a property of the chips.
 */
function actionAnchors(host: HTMLElement): HTMLAnchorElement[] {
	return anchors(host).filter((a) => a.getAttribute('data-testid') === 'concern-drift-link');
}

function actionHrefs(host: HTMLElement): string[] {
	return actionAnchors(host).map((a) => a.getAttribute('href') ?? '');
}

/** The changed-domain chips: every anchor that is not an action link. */
function chipAnchors(host: HTMLElement): HTMLAnchorElement[] {
	return anchors(host).filter((a) => a.getAttribute('data-testid') !== 'concern-drift-link');
}

function inputState(over: Partial<GenerationInputComparison>): GenerationInputComparison {
	return {
		status: 'STALE',
		message: 'Some setup inputs differ from the ones this run was built from.',
		actionHint: 'Open Class Schedule to review the run inputs.',
		changedDomains: [],
		checkedAt: '2026-09-28T00:00:00.000Z',
		...over,
	} as unknown as GenerationInputComparison;
}

/* ══════════════════════════════ C1 — honest empty state ══════════════════════════════ */

test('C1: with no teacher selected the main panel carries an honest empty state', async () => {
	const host = await renderAndUnmount(createElement(TeacherConcerns));
	const empty = host.querySelector('[data-testid="concern-no-teacher-empty-state"]');
	assert.ok(empty, 'no empty state rendered for the no-teacher-selected case');
	const text = (empty!.textContent ?? '').replace(/\s+/g, ' ').trim();

	// It says what the page is for.
	assert.match(text, /availability/i, 'empty state does not describe what the page records');
	// It names the next step the operator can perform from here.
	assert.match(text, /choose a teacher|select a teacher|pick a teacher/i, 'empty state names no next step');
	assert.match(text, /teacher/i);
});

test('C1: the empty state does not mount a class grid and does not fabricate a list or count', async () => {
	const host = await renderAndUnmount(createElement(TeacherConcerns));
	const empty = host.querySelector('[data-testid="concern-no-teacher-empty-state"]');
	assert.ok(empty);
	const text = (empty!.textContent ?? '').replace(/\s+/g, ' ').trim();

	// The dead "class grid" component's own empty-state wording must not appear.
	assert.doesNotMatch(text, /scheduled classes/i, 'empty state reuses WeeklyScheduleGrid wording');
	assert.equal(host.querySelectorAll('ul, ol, li').length, 0, 'empty state rendered a list');
	// No invented count. There is no endpoint that lists concerns.
	assert.doesNotMatch(text, /\b\d+\s+(concerns?|teachers?|records?)\b/i, 'empty state states a fabricated count');
});

test('C1: the page never mounts the zero-consumer WeeklyScheduleGrid component', async () => {
	const host = await renderAndUnmount(createElement(TeacherConcerns));
	assert.doesNotMatch(host.innerHTML, /No scheduled classes found/i);
	const pageSource = source('src/pages/TeacherConcerns.tsx');
	assert.doesNotMatch(pageSource, /WeeklyScheduleGrid/, 'the page references the dead class-grid component');
});

/* ═════════════════════════ C2 — the published-revisions false errand ═════════════════════════ */

test('C2: no rendered link claims a published-revisions destination', async () => {
	for (const domains of [['availability'], ['policy'], ['rooms', 'subjects']] as const) {
		const host = await renderAndUnmount(
			createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: [...domains] }), facultyName: 'Dela Cruz, Juan' }),
		);
		const labels = linkTexts(host);
		for (const label of labels) {
			assert.doesNotMatch(label, /published revisions?/i, `link "${label}" names a revisions destination`);
		}
		// /schedules mounts RoomSchedules, which has no revision concept at all.
		assert.ok(
			!anchors(host).some((a) => a.getAttribute('href') === '/schedules'),
			`a /schedules link is still offered for changedDomains ${JSON.stringify(domains)}`,
		);
		// No link may carry a revisions promise in an accessible name either.
		assert.doesNotMatch(host.innerHTML, /published revisions/i);
	}
});

test('C2: the concern layer no longer exports a /schedules revisions destination', async () => {
	assert.equal(HELPER_CONCERN_ROUTE, '/faculty/concerns');
	/*
	 * Supersedes the pre-fix `revisionHref: '/schedules'` producer, which pinned
	 * the false errand. The view now exposes no second href at all: one Class
	 * Schedule link covers both regenerating a draft and revising a published
	 * run, because the revision surface is reachable from there.
	 */
	for (const domains of [['availability'], ['policy'], ['rooms'], ['subjects'], ['teachingLoad']] as const) {
		const view = resolveConcernDriftView(inputState({ changedDomains: [...domains] }));
		assert.equal('revisionHref' in view, false, `a revisions href is produced again for ${JSON.stringify(domains)}`);
		const hrefsFromView = [view.regenerateHref, view.drift.primaryHref];
		assert.ok(!hrefsFromView.includes('/schedules'), `a /schedules href is produced again for ${JSON.stringify(domains)}`);

		const host = await renderAndUnmount(
			createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: [...domains] }), facultyName: 'Dela Cruz, Juan' }),
		);
		assert.ok(!hrefs(host).includes('/schedules'), `a /schedules link renders again for ${JSON.stringify(domains)}`);
	}
});

test('C2: the Class Schedule link points at /timetable, the proven revision surface', async () => {
	const host = await renderAndUnmount(
		createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: ['rooms'] }), facultyName: 'Dela Cruz, Juan' }),
	);
	const links = anchors(host).map((a) => ({ href: a.getAttribute('href'), text: (a.textContent ?? '').replace(/\s+/g, ' ').trim() }));
	assert.ok(
		links.some((l) => l.href === '/timetable' && /class schedule/i.test(l.text)),
		`no Class Schedule link to /timetable; got ${JSON.stringify(links)}`,
	);
	// The reachability proof this decision rests on, pinned so a future deletion
	// of the dock chain is caught here rather than in a demo.
	const chain = [
		['src/App.tsx', /path: 'timetable'[\s\S]{0,200}element: <ScheduleReview \/>/],
		['src/pages/ScheduleReview.tsx', /ScheduleReviewWorkspace/],
		['src/components/timetable/ScheduleReviewWorkspaceBody.tsx', /<CenterWorkspace/],
		['src/components/timetable/CenterWorkspace.tsx', /<TacticalSandboxDock/],
		['src/components/timetable/TacticalSandboxDock.tsx', /<PublishedRevisionDialog/],
	] as const;
	for (const [path, pattern] of chain) {
		assert.match(source(path), pattern, `published-revision chain broken at ${path}`);
	}
});

/* ══════════════════════════════ C3 — plain-language status ══════════════════════════════ */

test('C3: the freshness badge renders plain words for all three statuses', async () => {
	const expected = { FRESH: 'Up to date', STALE: 'Out of date', UNKNOWN: 'Not yet compared' } as const;
	for (const [status, label] of Object.entries(expected) as [keyof typeof expected, string][]) {
		const host = await renderAndUnmount(
			createElement(RunAvailabilityDriftCard, {
				inputState: inputState({ status, changedDomains: ['rooms'] }),
				facultyName: 'Dela Cruz, Juan',
			}),
		);
		const badge = host.querySelector('[data-testid="concern-drift-status"]');
		assert.ok(badge, `no status badge for ${status}`);
		assert.equal((badge!.textContent ?? '').trim(), label, `status ${status} did not render plain words`);
	}
});

/**
 * The trimmed text of every LEAF element.
 *
 * `textContent` concatenates adjacent nodes with no separator, so the base
 * card's badge reads "...in the current runSTALESome setup..." and a
 * `\bSTALE\b` probe matches nothing — that is how a control for this very
 * defect passed vacuously on the unfixed tree. Leaf text keeps each rendered
 * string in its own right, which is what the badge is actually compared on.
 */
function leafTexts(host: HTMLElement): string[] {
	return Array.from(host.querySelectorAll('*'))
		.filter((el) => el.children.length === 0)
		.map((el) => (el.textContent ?? '').trim())
		.filter((t) => t.length > 0);
}

test('C3: no raw enum token appears anywhere in the rendered drift card', async () => {
	for (const status of ['FRESH', 'STALE', 'UNKNOWN'] as const) {
		const host = await renderAndUnmount(
			createElement(RunAvailabilityDriftCard, { inputState: inputState({ status, changedDomains: ['rooms'] }), facultyName: 'Dela Cruz, Juan' }),
		);
		const leaves = leafTexts(host);
		assert.ok(leaves.length > 0, 'the card rendered no text at all — the control would be vacuous');
		for (const token of ['FRESH', 'STALE', 'UNKNOWN']) {
			for (const leaf of leaves) {
				assert.doesNotMatch(leaf, new RegExp(`\\b${token}\\b`), `raw enum ${token} leaked into the card as "${leaf}"`);
			}
		}
	}
});

test('C3: the plain-label map covers all three statuses and keeps the badge tone', async () => {
	assert.equal(concernDriftStatusLabel('FRESH'), 'Up to date');
	assert.equal(concernDriftStatusLabel('STALE'), 'Out of date');
	assert.equal(concernDriftStatusLabel('UNKNOWN'), 'Not yet compared');

	// The tone must still be derived from the status. Proven from the rendered
	// class, not a source grep: three statuses must produce three distinct
	// badge treatments, so "only the word changed" is observable.
	const classes: string[] = [];
	for (const status of ['FRESH', 'STALE', 'UNKNOWN'] as const) {
		const host = await renderAndUnmount(
			createElement(RunAvailabilityDriftCard, { inputState: inputState({ status, changedDomains: ['rooms'] }), facultyName: 'Dela Cruz, Juan' }),
		);
		const badge = host.querySelector('[data-testid="concern-drift-status"]');
		assert.ok(badge, `no status badge for ${status}`);
		classes.push(badge!.getAttribute('class') ?? '');
	}
	assert.equal(new Set(classes).size, 3, `badge tone no longer varies by status: ${JSON.stringify(classes)}`);
});

/* ═════════════════════ C4 — no self-link, no duplicate destination ═════════════════════ */

test('C4: availability drift renders no ACTION link back to this page', async () => {
	const host = await renderAndUnmount(
		createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: ['availability'] }), facultyName: 'Dela Cruz, Juan' }),
	);
	// Scoped to the ACTION set: the availability chip itself links to
	// `/faculty/concerns`, which is this domain's canonical home, and that
	// navigation is a preserved affordance rather than an errand.
	assert.ok(
		!actionHrefs(host).includes('/faculty/concerns'),
		`self-link action to the current page: ${JSON.stringify(actionHrefs(host))}`,
	);
	assert.doesNotMatch(host.innerHTML, /Open owning setup/i, 'a self-link is still labelled "Open owning setup"');
});

test('C4: policy drift does not offer the same destination under two ACTION labels', async () => {
	const host = await renderAndUnmount(
		createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: ['policy'] }), facultyName: 'Dela Cruz, Juan' }),
	);
	const toTimetable = actionAnchors(host).filter((a) => a.getAttribute('href') === '/timetable');
	assert.equal(
		toTimetable.length,
		1,
		`expected exactly one /timetable ACTION, got ${toTimetable.length}: ${JSON.stringify(linkTexts(host))}`,
	);
	// Removing the duplicate action must not remove the route: `/timetable` is
	// policy's canonical home, so it stays reachable from the card.
	assert.ok(
		hrefs(host).includes('/timetable'),
		`/timetable became unreachable for policy drift: ${JSON.stringify(hrefs(host))}`,
	);
});

test('C4: every rendered ACTION link has a distinct destination across the drift matrix', async () => {
	const matrix = [['availability'], ['policy'], ['rooms'], ['rooms', 'subjects'], ['teachingLoad', 'rooms'], []] as const;
	for (const domains of matrix) {
		const host = await renderAndUnmount(
			createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: [...domains] }), facultyName: 'Dela Cruz, Juan' }),
		);
		const list = actionHrefs(host);
		assert.equal(new Set(list).size, list.length, `duplicate ACTION destination for ${JSON.stringify(domains)}: ${JSON.stringify(list)}`);
		assert.ok(!list.includes('/faculty/concerns'), `self-link ACTION for ${JSON.stringify(domains)}`);
		assert.ok(!list.includes('/schedules'), `dead /schedules link for ${JSON.stringify(domains)}`);
	}
});

test('C4: the link resolver drops the self-link and both duplicates, and keeps the unmapped fallback', () => {
	const availability = resolveConcernDriftView(inputState({ changedDomains: ['availability'] }));
	assert.deepEqual(resolveConcernDriftLinks(availability).map((l) => l.href), ['/timetable']);

	const policy = resolveConcernDriftView(inputState({ changedDomains: ['policy'] }));
	assert.deepEqual(resolveConcernDriftLinks(policy).map((l) => l.href), ['/timetable']);

	// `rooms` is a mapped domain, so the Rooms chip already carries `/map` and
	// the owning-setup action would only restate it.
	const rooms = resolveConcernDriftView(inputState({ changedDomains: ['rooms'] }));
	assert.deepEqual(resolveConcernDriftLinks(rooms).map((l) => l.href), ['/timetable']);

	// The unmapped-fallback case is where the owning-setup link must SURVIVE:
	// an unmapped domain renders no chip, so `/admin/year-setup` is the only
	// route to the umbrella repair.
	const unmapped = resolveConcernDriftView(
		inputState({ changedDomains: ['mysteryDomain'] as unknown as GenerationInputComparison['changedDomains'] }),
	);
	assert.deepEqual(resolveConcernDriftLinks(unmapped).map((l) => l.href), ['/timetable', '/admin/year-setup']);
});

/* ══════════ Domain chips name a changed domain AND link to its home ══════════ */

test('domain chips are links to each changed domain canonical home, and keep naming it', async () => {
	const changed = ['availability', 'rooms', 'teachingLoad'] as const;
	const host = await renderAndUnmount(
		createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: [...changed] }), facultyName: 'Dela Cruz, Juan' }),
	);
	// The canonical hrefs/labels come from the shared drift mapping, so this
	// row cannot drift from `DOMAIN_META` and does not restate it.
	const expected = resolveConcernDriftView(inputState({ changedDomains: [...changed] })).drift.domains;
	assert.equal(expected.length, changed.length, 'the shared mapping dropped a changed domain');

	const chips = chipAnchors(host);
	assert.equal(chips.length, changed.length, `expected ${changed.length} chip links, got ${chips.length}`);
	for (const domain of expected) {
		const chip = chips.find((a) => a.getAttribute('href') === domain.href);
		assert.ok(chip, `no chip link to ${domain.href} for changed domain ${domain.domain}`);
		const label = (chip!.textContent ?? '').replace(/\s+/g, ' ').trim();
		assert.equal(label, domain.label, `the ${domain.href} chip does not name ${domain.domain}`);
	}
});

/**
 * A3-C6R1 preservation — the affordance an over-broad de-duplication deletes.
 *
 * A previous correction removed the chips' navigation to remove duplicate
 * destinations. That silently made `/map` unreachable from this card while the
 * card still rendered the label "Rooms": a card naming a domain it cannot route
 * to is the same false-errand class this lane exists to remove. This row pins
 * the affordance so it cannot be deleted again silently.
 */
test('preservation: for two mapped changed domains BOTH canonical homes stay reachable', async () => {
	const host = await renderAndUnmount(
		createElement(RunAvailabilityDriftCard, { inputState: inputState({ changedDomains: ['teachingLoad', 'rooms'] }), facultyName: 'Dela Cruz, Juan' }),
	);
	const list = hrefs(host);
	for (const href of ['/teaching-load', '/map']) {
		assert.ok(list.includes(href), `${href} is unreachable from the card: ${JSON.stringify(list)}`);
	}
	// The card still names both domains, so both must be routeable.
	const text = (host.textContent ?? '').replace(/\s+/g, ' ');
	assert.match(text, /Teaching Load/i);
	assert.match(text, /Rooms/i);
});

/* ══════════════════════ the page's own sentence grammar ══════════════════════ */

test('the availability prompt does not produce a double possessive', async () => {
	const host = await renderAndUnmount(
		createElement(TeacherConcernWorkspace, {
			facultyName: 'Dela Cruz, Juan',
			availability: null,
			pickerSlots: [],
			onPickerChange: () => {},
			notes: '',
			onNotesChange: () => {},
			roomRequests: '',
			onRoomRequestsChange: () => {},
			reviewerNotes: '',
			onReviewerNotesChange: () => {},
			writesDisabled: true,
			saving: false,
			onSaveDraft: () => {},
			onSubmitForReview: () => {},
			onReview: () => {},
		}),
	);
	const text = (host.textContent ?? '').replace(/\s+/g, ' ');
	// The base template rendered "Paint the teacher's Dela Cruz, Juan's weekly
	// windows." — the two possessives collided.
	assert.doesNotMatch(text, /teacher's Dela Cruz/i, 'the rendered prompt still has a double possessive');
	assert.doesNotMatch(text, /teacher&#39;s Dela Cruz/i);
	assert.match(text, /Dela Cruz, Juan's weekly windows/i, 'the prompt does not name the selected teacher once');
});
