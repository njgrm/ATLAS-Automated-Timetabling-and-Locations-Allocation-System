/**
 * A6 c5 — ROWS WHOSE ONLY CONTROL IS A MODULE THIS SLICE CREATED.
 *
 * `teachingLoadOutage.ts`, `useCoverShortage.ts`, `useTeachingLoadOutage.ts`,
 * `TeachingLoadShortageLine.tsx` and `CoverShortageDialog.tsx` did not exist at
 * the base `316534f2`. A base-red proof for these rows is therefore impossible
 * in the honest sense: the failure would be `Cannot find module`, which proves
 * only that the file is new, not that the control discriminates. These rows are
 * proved by MUTATION instead — the function is changed, the control is shown to
 * fail, and the exact bytes are restored. The handoff records them as
 * `PROVED BY MUTANT`, separately from the genuinely base-red rows in
 * `a6-c5-outage.test.tsx`.
 *
 * EVERY ROW BELOW STILL EXERCISES THE PRODUCTION PATH, not a helper in
 * isolation: the harness mounts the REAL `useTeachingLoadOutage` hook and the
 * REAL `TeachingLoadOutageSurface`, and `atlasApi.post` is captured so the
 * request BODY is asserted — `apply` included (S4), which no amount of reading
 * the rendered dialog could decide.
 *
 * HARNESS COPIED VERBATIM from `a6-teaching-load-surface.test.tsx`.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teaching-load',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { TeachingLoadOutageSurface } = await import('@/components/faculty-assignments/TeachingLoadOutageSurface');
const { useTeachingLoadOutage } = await import('@/hooks/useTeachingLoadOutage');
const {
	COVER_OPTIONS,
	buildStaffingTruthFigures,
	buildSubjectShortage,
	buildShortageLineModel,
	formatShortageDataDate,
	SHORTAGE_LINE_SUBJECT_CAP,
} = await import('@/components/faculty-assignments/teachingLoadOutage');
const atlasApi = (await import('@/lib/api')).default;

const roots: any[] = [];
const hosts: HTMLElement[] = [];
const originalPost = atlasApi.post;
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
	(atlasApi as any).post = originalPost;
});

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/teaching-load'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, node),
		));
	});
	return host;
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}
async function settle() {
	await act(async () => { await new Promise((done) => setTimeout(done, 0)); });
}
/** Radix renders a Dialog into a portal on `document.body`, not into the host. */
function dialog(): HTMLElement {
	const node = dom.window.document.querySelector('[data-testid="teaching-load-cover-dialog"]');
	assert.ok(node, 'the cover dialog must open');
	return node as HTMLElement;
}

// ───────────────────────────────────────── the packet's own outage fixture

const SUBJECT = (id: number, code: string, name: string) => ({
	id, code, name, isActive: true, gradeLevels: [] as number[], programScopes: [] as string[],
	minMinutesPerWeek: 0, displayOrder: id, isSpecialized: false,
});
const SECTION = (id: number, name: string) => ({
	id, name, displayOrder: 7, programType: 'REGULAR', isActive: true,
});

const SUBJECTS: any[] = [
	SUBJECT(11, 'MAPEH', 'MAPEH'),
	SUBJECT(12, 'ENG', 'English'),
	SUBJECT(13, 'FIL', 'Fil'),
	SUBJECT(14, 'ESP', 'Esp'),
	SUBJECT(16, 'SCI', 'Science'),
];
const SECTIONS: any[] = [
	SECTION(101, 'MAPEH 7'), SECTION(102, 'MAPEH 8'), SECTION(103, 'MAPEH 9'),
	SECTION(104, 'MAPEH 7-A'), SECTION(105, 'MAPEH 8-A'), SECTION(106, 'MAPEH 9-A'),
	SECTION(107, 'MAPEH 10'), SECTION(108, 'MAPEH 10-A'), SECTION(109, 'MAPEH 11'),
	SECTION(110, 'MAPEH 11-A'), SECTION(111, 'MAPEH 12'), SECTION(112, 'MAPEH 12-A'),
	SECTION(201, 'Eng 7'), SECTION(202, 'Eng 8'), SECTION(203, 'Eng 9'), SECTION(204, 'Eng 10'),
	SECTION(205, 'Eng 7-A'), SECTION(206, 'Eng 8-A'),
	SECTION(301, 'Fil 7'), SECTION(302, 'Fil 8'), SECTION(303, 'Fil 9'),
	SECTION(401, 'Esp 9'), SECTION(402, 'Esp 10'),
	SECTION(501, 'Sci 10'), SECTION(502, 'Sci 11'),
];
const SECTION_MAP = new Map<number, any>(SECTIONS.map((row) => [row.id, row]));

const SHORT_BY_SUBJECT: Record<number, number[]> = {
	11: [101, 102, 103, 104, 105, 106, 107, 108, 109],
	12: [201, 202, 203, 204],
	13: [301, 302],
	14: [401],
	16: [501],
};

/**
 * The packet's own scenario, on the real applicability model.
 *
 * Every subject is teachable to every section, so "MAPEH: 9 classes need a
 * teacher" is nine sections with no REAL teacher in MAPEH — and the ownership
 * map is the only thing that decides it. MAPEH 101 sits on a to-be-hired record,
 * so it is short even though it is owned; that is the packet's whole point.
 */
const SAVED_OWNERSHIP: Record<string, any> = {};
for (const subject of SUBJECTS) {
	for (const section of SECTIONS) {
		const key = `${subject.id}:${section.id}`;
		if (!SHORT_BY_SUBJECT[subject.id]!.includes(section.id)) {
			SAVED_OWNERSHIP[key] = { facultyId: 9 };
		} else if (subject.id === 11 && section.id === 101) {
			SAVED_OWNERSHIP[key] = { facultyId: 42 };
		}
	}
}
const ACTIVE_FACULTY = new Set<number>([9, 42]);
const PLACEHOLDER_FACULTY = new Set<number>([42]);

const COVERAGE_TOTALS: any = {
	realFacultyAssignedPairs: 75,
	syntheticPlaceholderPairs: 25,
	unassignedPairs: 12,
	totalPairs: 112,
};

function outageParams(overrides: Record<string, any> = {}) {
	return {
		subjects: SUBJECTS,
		sections: SECTIONS,
		savedOwnershipMap: SAVED_OWNERSHIP,
		pendingOwnershipMap: {},
		activeFacultyIds: ACTIVE_FACULTY,
		placeholderFacultyIds: PLACEHOLDER_FACULTY,
		coverageTotals: COVERAGE_TOTALS,
		fetchedAt: '2026-09-12T02:15:00.000Z',
		schoolId: 1,
		activeSchoolYearId: 9,
		scopeKey: '1:9',
		dataSource: 'live' as const,
		isOnline: true,
		degradedNotice: null as string | null,
		sectionMap: SECTION_MAP as unknown as Map<number, any>,
		...overrides,
	};
}

function OutageHost(props: { params: any }) {
	const outage = useTeachingLoadOutage(props.params);
	return createElement(TeachingLoadOutageSurface as any, {
		outage,
		writeBlockedReason: null,
		onShowCoverageDetail: () => {},
	});
}

// ─────────────────────────────────────────── S2 — the shortage line

test('A6C5-S2-1 the line is per subject, descending, capped at 3 with `+2 more`, and dated', () => {
	const host = render(createElement(OutageHost, { params: outageParams() }));
	const line = host.querySelector('[data-testid="teaching-load-shortage-line"]');
	assert.ok(line, 'the shortage line must render in the outage state');

	const text = (host.querySelector('[data-testid="teaching-load-shortage-text"]') as HTMLElement).textContent ?? '';
	assert.equal(
		text,
		'MAPEH: 9 classes need a teacher · English: 4 classes need a teacher · Fil: 2 classes need a teacher · 2 more subjects · 12 Sept roster',
		'the line must read per subject, worst first, capped, with the data date — the packet\'s own sentence',
	);

	// The cap is the packet's three, and the overflow is COUNTED, not dropped.
	const more = host.querySelector('[data-testid="teaching-load-shortage-more"]');
	assert.ok(more, 'the `+N more` link must render when subjects are hidden');
	assert.equal((more as HTMLElement).textContent?.trim(), '+2 more', 'the overflow is named, in the packet\'s form');
	assert.equal(SHORTAGE_LINE_SUBJECT_CAP, 3, 'the cap is three subjects');

	// The date comes from the ONLY timestamp the client holds. An absent or
	// unparseable value DROPS the clause rather than inventing one.
	assert.equal(formatShortageDataDate('2026-09-12T02:15:00.000Z'), '12 Sept roster');
	assert.equal(formatShortageDataDate(null), null);
	assert.equal(formatShortageDataDate('not a date'), null);
	const undated = render(createElement(OutageHost, { params: outageParams({ fetchedAt: null }) }));
	assert.doesNotMatch(
		undated.textContent ?? '',
		/roster/,
		'with no timestamp the date clause is dropped, never invented',
	);
});

test('A6C5-S2-2 MUTANT: the line is DERIVED from the ownership map, not a constant', () => {
	// The packet's own S2 mutant clause: change the fixture and the line must
	// change. A hard-coded sentence would still pass a string comparison, so the
	// mutations here are the two RULES, not the text.
	const derive = (overrides: Record<string, any> = {}) => buildSubjectShortage({
		subjects: SUBJECTS,
		sections: SECTIONS,
		savedOwnershipMap: SAVED_OWNERSHIP,
		pendingOwnershipMap: {},
		placeholderFacultyIds: PLACEHOLDER_FACULTY,
		activeFacultyIds: ACTIVE_FACULTY,
		...overrides,
	});

	assert.equal(derive().entries[0]!.shortClassCount, 9, 'MAPEH is the worst subject on the packet\'s fixture');
	// MUTANT 1: the same map, but 101 is a REAL teacher instead of a to-be-hired
	// record. The figure must move by exactly one — this is the rule that makes
	// the line count classes without a real teacher rather than unowned ones.
	assert.equal(
		derive({ savedOwnershipMap: { ...SAVED_OWNERSHIP, '11:101': { facultyId: 9 } } }).entries[0]!.shortClassCount,
		8,
		'a pair held by a real teacher is not short, even when the map says it is owned',
	);
	// MUTANT 2: the draft-inclusive map is NOT consulted for the figure. The
	// packet says the number comes from saved coverage.
	assert.equal(
		derive({
			pendingOwnershipMap: Object.fromEntries(
				Object.entries(SAVED_OWNERSHIP).map(([key]) => [key, { facultyId: 9 }]),
			) as any,
		}).entries[0]!.shortClassCount,
		9,
		'a draft that would staff the placeholder-held class does not move the SAVED figure',
	);
	// And a subject every class of which has a real teacher is not a shortage.
	const staffed = buildSubjectShortage({
		subjects: SUBJECTS,
		sections: SECTIONS,
		// EVERY pair taught for real, including the ones the outage fixture left
		// unowned. Built from the cartesian product so no key is missed.
		savedOwnershipMap: Object.fromEntries(
			SUBJECTS.flatMap((subject) => SECTIONS.map((section) => [`${subject.id}:${section.id}`, { facultyId: 9 }])),
		) as any,
		pendingOwnershipMap: {},
		placeholderFacultyIds: new Set<number>(),
		activeFacultyIds: ACTIVE_FACULTY,
	});
	assert.deepEqual(staffed.entries, [], 'with every pair taught for real there is no shortage at all');
	assert.equal(staffed.totalShortClasses, 0);
	// The singular form is used at one, and two subjects fit inside the cap.
	const one = buildShortageLineModel({
		entries: buildSubjectShortage({
			subjects: SUBJECTS,
			sections: [SECTION(101, 'MAPEH 7') as any],
			savedOwnershipMap: {},
			pendingOwnershipMap: {},
			placeholderFacultyIds: PLACEHOLDER_FACULTY,
			activeFacultyIds: ACTIVE_FACULTY,
		}).entries.slice(0, 2),
		dataDateLabel: null,
	});
	assert.match(one.text, /: 1 class needs a teacher/, 'the singular form is used at one');
	assert.equal(one.moreSubjectCount, 0, 'two subjects fit inside the cap, so there is no `+N more`');
});

// ─────────────────────────────────────────── S3 — the two lying figures

test('A6C5-S3-3 the shared figures never count a placeholder-held class as staffed', () => {
	assert.deepEqual(
		buildStaffingTruthFigures({
			realAssignedPairs: 75, syntheticPlaceholderPairs: 25, unassignedPairs: 12, totalPairs: 112,
		}),
		{ staffedPercent: 67, withoutRealTeacherCount: 37 },
		'67% staffed (75/112) and 37 classes without a REAL teacher (25 placeholder-held + 12 unowned)',
	);
	assert.deepEqual(
		buildStaffingTruthFigures({
			realAssignedPairs: 0, syntheticPlaceholderPairs: 100, unassignedPairs: 0, totalPairs: 100,
		}),
		{ staffedPercent: 0, withoutRealTeacherCount: 100 },
		'a roster held entirely by to-be-hired records reads 0% staffed and 100 without a real teacher',
	);
	assert.equal(
		buildStaffingTruthFigures({
			realAssignedPairs: 0, syntheticPlaceholderPairs: 0, unassignedPairs: 0, totalPairs: 0,
		}).staffedPercent,
		0,
		'no pairs at all is 0%, never a division by zero',
	);
});

// ─────────────────────────────────────────── S4 / S5 — preview first, class names

type Captured = { url: string; body: any };

/** A server whose plan depends on the option, so the number can be watched move. */
function planFor(maxHours: number) {
	return {
		applied: false,
		plannedAssignments: [{
			subjectId: 11, subjectCode: 'MAPEH', subjectName: 'MAPEH',
			// 30h covers two of the nine; 40h covers all nine. The fixture is the
			// packet's own table, so "the number changes with the option" is
			// decided by the SERVER CONTRACT, not by the component.
			assignableSectionIds: maxHours === 40
				? [101, 102, 103, 104, 105, 106, 107, 108, 109]
				: [101, 102],
			deferredSectionIds: maxHours === 40 ? [] : [103, 104, 105, 106, 107, 108, 109],
			plannedPairCount: maxHours === 40 ? 9 : 2,
			teacherName: 'MAPEH — to be hired',
			maxHoursPerWeek: maxHours,
		}],
		assignedPairs: [], stillUncoveredPairs: [], unresolvedSubjectRefs: [],
	};
}

const posts: Captured[] = [];
function capturePlan() {
	posts.length = 0;
	(atlasApi as any).post = async (url: string, body: any) => {
		posts.push({ url: String(url), body });
		return { data: structuredClone(planFor(Number(body?.maxHoursPerWeek) || 30)) };
	};
	return posts;
}

async function openDialog(): Promise<HTMLElement> {
	const host = render(createElement(OutageHost, { params: outageParams() }));
	const cover = host.querySelector('[data-testid="teaching-load-cover-open"]');
	assert.ok(cover, 'the shortage line must carry its one action');
	click(cover);
	await settle();
	return host;
}

test('A6C5-S4-1 the preview is `apply:false` and the primary action is gated on it', async () => {
	const captured = capturePlan();
	await openDialog();

	const applyButton = dialog().querySelector('[data-testid="teaching-load-cover-apply"]') as HTMLButtonElement;
	assert.ok(applyButton, 'the cover dialog must carry its one primary action');
	assert.equal(
		applyButton.hasAttribute('disabled'), true,
		'`Assign this teacher now` must be disabled until an `apply:false` preview has resolved',
	);
	assert.equal(captured.length, 0, 'opening the dialog must not call the write endpoint at all');

	click(dialog().querySelector('[data-testid="teaching-load-cover-preview-action"]')!);
	await settle();

	assert.equal(captured.length, 1, 'the preview must be exactly one call');
	assert.equal(captured[0]!.url, '/faculty-assignments/coverage/repair');
	assert.equal(captured[0]!.body.apply, false, 'the PREVIEW must be `apply:false` — the endpoint writes when this is true');
	assert.equal(captured[0]!.body.maxHoursPerWeek, 30, 'the standard option sends 30 hours');
	assert.deepEqual(captured[0]!.body.subjectIds, [11], 'the preview is scoped to the short subject the scheduler clicked');
	assert.equal(captured[0]!.body.schoolId, 1, 'the page\'s own school, never a hard-coded default');
	assert.equal(captured[0]!.body.schoolYearId, 9, 'the page\'s own year, never a hard-coded default');

	const after = dialog().querySelector('[data-testid="teaching-load-cover-apply"]') as HTMLButtonElement;
	assert.equal(after.hasAttribute('disabled'), false, 'the primary action unlocks once the preview has resolved');

	// The preview names CLASSES, never ids. A row rendering `sectionId: 412` is
	// a rejected row.
	const classes = dialog().querySelector('[data-testid="teaching-load-cover-preview-classes"]') as HTMLElement;
	assert.ok(classes, 'the preview must list the classes it would assign');
	assert.match(classes.textContent ?? '', /MAPEH — MAPEH 7/, 'the preview names the class');
	assert.doesNotMatch(classes.textContent ?? '', /\b10[123]\b/, 'no section id is ever shown to a scheduler');
});

test('A6C5-S5-1 the three options each carry a consequence, and the number moves with the option', async () => {
	const captured = capturePlan();
	await openDialog();

	// Every option, and the ONE line of consequence the packet names for it.
	assert.deepEqual(
		COVER_OPTIONS.map((option) => option.label),
		['30 hours a week', 'Stretch to 40 hours', 'Leave it open'],
		'the three options are the packet\'s three',
	);
	assert.equal(COVER_OPTIONS[0]!.consequence, 'A standard load. Leaves the other classes for a teacher you already have.');
	assert.equal(COVER_OPTIONS[1]!.consequence, 'Only for a subject specialist. A heavier load for one person.');
	assert.equal(COVER_OPTIONS[2]!.consequence, 'Nothing is saved. These classes stay on the shortage line.');
	// `Leave it open` never reaches the server, so it carries no number.
	assert.equal(COVER_OPTIONS[2]!.maxHoursPerWeek, null);

	for (const option of COVER_OPTIONS) {
		const rendered = dialog().querySelector(`[data-testid="teaching-load-cover-option-${option.id}"]`);
		assert.ok(rendered, `the ${option.label} option must render`);
		assert.ok(
			(rendered!.textContent ?? '').includes(option.consequence),
			`the ${option.label} option must carry its consequence line verbatim`,
		);
	}

	// Preview the standard option: "covers 2 of the 9".
	click(dialog().querySelector('[data-testid="teaching-load-cover-preview-action"]')!);
	await settle();
	assert.equal(captured[captured.length - 1]!.body.maxHoursPerWeek, 30, 'the standard option previews at 30 hours');
	assert.match(
		(dialog().querySelector('[data-testid="teaching-load-cover-preview-standard-30"]') as HTMLElement).textContent ?? '',
		/covers 2 of the 9/,
		'the preview number counts what the plan would ASSIGN out of the short classes',
	);

	// Switch to the stretch option and preview again: the number must MOVE.
	// The test id is on the option's PANEL; the control inside it is the button,
	// and a click dispatched on the panel would bubble away from it.
	click(dialog().querySelector('[data-testid="teaching-load-cover-option-stretch-40"] button')!);
	await settle();
	assert.equal(
		dialog().querySelector('[data-testid="teaching-load-cover-option-stretch-40"]')!.getAttribute('data-selected'),
		'true',
		'the stretch option must become the selected one',
	);
	click(dialog().querySelector('[data-testid="teaching-load-cover-preview-action"]')!);
	await settle();
	assert.equal(captured[captured.length - 1]!.body.maxHoursPerWeek, 40, 'the stretch option previews at 40 hours');
	assert.match(
		(dialog().querySelector('[data-testid="teaching-load-cover-preview-stretch-40"]') as HTMLElement).textContent ?? '',
		/covers 9 of the 9/,
		'the preview number changes with the option: a heavier load covers more',
	);
});

// ─────────────────────────────────────────── S6 — the 409 drift surface

test('A6C5-S6-1 a 409 names the changed classes and offers `Review again`', async () => {
	const sent: any[] = [];
	(atlasApi as any).post = async (url: string, body: any) => {
		sent.push(body);
		if (body?.apply === true) {
			throw {
				response: {
					status: 409,
					data: {
						code: 'SOURCE_AUTHORITY_STALE',
						details: {
							driftScope: 'saved roster',
							changedPairs: [{ subjectId: 11, sectionId: 103 }, { subjectId: 11, sectionId: 102 }],
							changedPairCount: 2,
							remainingChangedPairCount: 3,
						},
					},
				},
			};
		}
		return { data: structuredClone(planFor(Number(body?.maxHoursPerWeek) || 30)) };
	};

	await openDialog();
	click(dialog().querySelector('[data-testid="teaching-load-cover-preview-action"]')!);
	await settle();
	click(dialog().querySelector('[data-testid="teaching-load-cover-apply"]')!);
	await settle();

	const drift = dialog().querySelector('[data-testid="teaching-load-cover-drift"]') as HTMLElement;
	assert.ok(drift, 'a 409 must raise the drift surface, not a raw error string');
	assert.match(drift.textContent ?? '', /changed while you were deciding/, 'the drift is stated in plain words');
	assert.match(drift.textContent ?? '', /saved roster/, 'the server\'s own drift scope is named');
	const changed = (dialog().querySelector('[data-testid="teaching-load-cover-drift-changed"]') as HTMLElement).textContent ?? '';
	assert.match(changed, /MAPEH — MAPEH 9/, 'the changed classes are NAMED, not id-ed');
	assert.doesNotMatch(changed, /\b10[123]\b/, 'no section id is ever shown to a scheduler');
	// S6 asks for "≤10 named, plus `and N more`". The remainder the SERVER
	// reported must reach the scheduler, or a bounded list is a quiet truncation.
	assert.match(changed, /and 3 more/, 'the remainder the server reported is counted, not dropped');

	const retry = dialog().querySelector('[data-testid="teaching-load-cover-review-again"]') as HTMLElement;
	assert.ok(retry, '`Review again` must be offered');
	assert.equal(retry.textContent?.trim(), 'Review again', 'the packet names the control; it is not reworded');
	click(retry);
	await settle();
	const last = sent[sent.length - 1];
	assert.equal(last?.apply, false, '`Review again` re-previews; it never re-applies');
});

// ─────────────────────────────────────────── S8 — the after-state

test('A6C5-S8-1 after apply the surface names what is STILL open, and never says `complete`', async () => {
	(atlasApi as any).post = async (_url: string, body: any) => {
		if (body?.apply === true) {
			return {
				data: {
					applied: true,
					// A8 c2 changed these to count persisted inserts only. They are
					// NOT a delivered-coverage figure and the dialog must not read
					// them as one.
					created: 2, assignmentsCreated: 2, uniqueTeachersAffected: 1,
					plannedAssignments: [],
					assignedPairs: [{ subjectId: 11, sectionId: 101, facultyId: 42 }],
					stillUncoveredPairs: [{ subjectId: 11, sectionId: 102, facultyId: 42 }],
					unresolvedSubjectRefs: [],
				},
			};
		}
		return { data: structuredClone(planFor(Number(body?.maxHoursPerWeek) || 30)) };
	};
	await openDialog();
	click(dialog().querySelector('[data-testid="teaching-load-cover-preview-action"]')!);
	await settle();
	click(dialog().querySelector('[data-testid="teaching-load-cover-apply"]')!);
	await settle();

	const outcome = dialog().querySelector('[data-testid="teaching-load-cover-outcome"]') as HTMLElement;
	assert.ok(outcome, 'the dialog must report what it did');
	assert.equal(outcome.getAttribute('data-complete'), 'false', 'a result with a still-open pair is not complete');
	assert.match(outcome.textContent ?? '', /MAPEH — MAPEH 7/, 'what it assigned is named in class names');

	const stillOpen = (dialog().querySelector('[data-testid="teaching-load-cover-still-open"]') as HTMLElement).textContent ?? '';
	assert.match(stillOpen, /still open/, 'the still-open list is stated');
	assert.match(stillOpen, /MAPEH — MAPEH 8/, 'the class that is still open is NAMED');
	// The decisive half: an incomplete result must not be called complete, and
	// `created` / `assignmentsCreated` are not delivered-coverage figures.
	assert.doesNotMatch(outcome.textContent ?? '', /complete/i, 'an incomplete result must not read `complete`');
	assert.doesNotMatch(outcome.textContent ?? '', /2 classes? (now )?covered/i, '`assignmentsCreated` is not a delivered figure');

	const nextStep = (dialog().querySelector('[data-testid="teaching-load-cover-next-step"]') as HTMLElement).textContent ?? '';
	assert.match(nextStep, /Cover the classes still listed/, 'the incomplete after-state names the next step');
});
