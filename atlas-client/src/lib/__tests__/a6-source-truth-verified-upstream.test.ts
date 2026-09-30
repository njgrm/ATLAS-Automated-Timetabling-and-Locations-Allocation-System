/**
 * A6-TEACHING-LOAD SOURCE TRUTH (2026-09-30) — the verified-upstream predicate.
 *
 * THE LIVE DEFECT (operator report, train `a46505ce`). Teaching Load read
 * "Using the sections last copied from EnrollPro. EnrollPro is connected."
 * while Teachers read "ATLAS is showing the last safe teacher roster snapshot.
 * Reconnect or sync before relying on this roster" — on a school where EnrollPro
 * was reachable and the active year verified. One root cause, both pages: the
 * app's only "EnrollPro is connected and the active year is verified" predicate
 * was `isUpstreamBackedSchoolYearSource(source)` over the resolved context's
 * `source`. That is false whenever the SWR cache answers, even when the cached
 * record carries a just-verified ordered active term, and it is `atlas-persisted`
 * for any caller that never asked the server to verify (`Faculty.tsx`).
 *
 * THE FIX. `ActiveSchoolYearContext` gains `verifiedUpstream: boolean`, true only
 * when the answer came from a verified EnrollPro read: the runtime-context
 * network path whose `source` is upstream-backed, the EnrollPro public-settings
 * fallback, or a cache answer handed to a caller that asked for verification and
 * whose cached active term passed the canonical verified-ordered-term gate. Both
 * pages now read `verifiedUpstream`, and Teaching Load accepts the ATLAS mirror
 * (`atlas-mirror`) of the year it just verified, while still downgrading `stub`,
 * `cached-enrollpro`, and an empty/missing sections payload.
 *
 * WHY THIS FILE RENDERS. The live shapes are driven through the REAL production
 * seams: the real `resolveActiveSchoolYearContext` over the real cache, the real
 * `useTeachingLoadData` hook, and the real `pages/Faculty.tsx` mounted in JSDOM.
 * A source-text assertion cannot see the defect this file exists for.
 *
 * ROWS (live shapes, from the planner's Step 0 evidence):
 *  R1  fails on base — `verifyUpstream:true` + an admissible cached record
 *      (`source:'cache'`, activeTerm verified+ordered) resolves verified-upstream,
 *      so Teaching Load is `live` with NO banner.
 *  R2  fails on base — a `/runtime/context` that returns `enrollpro-verified` ONLY
 *      when asked (`verifyUpstream=true`, exactly like the live server) leaves
 *      Teachers on `verified-live`.
 *  R3  preservation — an unverified context still shows the saved-data banner
 *      with the existing copy (`atlas-persisted`, and a stale-cache fallback).
 *  R4  preservation — a `cached-enrollpro` / `stub` sections summary still
 *      downgrades.
 *  R5  preservation — a zero/missing sections payload is still degraded, never
 *      "verified".
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { act, createElement, useEffect } from 'react';
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
	sessionStorage: dom.window.sessionStorage,
	localStorage: dom.window.localStorage,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');

const atlasApi = (await import('@/lib/api')).default;
const { ATLAS_LOCAL_TOKEN_KEY } = await import('@/lib/auth');
const {
	activeSchoolYearCacheKey,
	cacheActiveSchoolYearContext,
	invalidateActiveSchoolYearContext,
	isUpstreamBackedSchoolYearSource,
	resolveActiveSchoolYearContext,
} = await import('@/lib/enrollpro-public-settings');
const { useTeachingLoadData } = await import('@/hooks/useTeachingLoadData');
const FacultyPage = (await import('@/pages/Faculty')).default;

const SCHOOL_ID = 1;
const ACTIVE_YEAR = 5;

const ORDERED_TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
];

/** The active term EnrollPro reported: verified, ordered, index 1 of 3. */
const VERIFIED_ACTIVE_TERM = {
	source: 'enrollpro',
	reachable: true,
	verified: true,
	activeTerm: 'T1',
	termIndex: 1,
	schoolYearId: ACTIVE_YEAR,
	matchedSchoolYear: true,
	code: null,
	message: 'ATLAS is aligned with EnrollPro active term T1.',
	orderedTerms: ORDERED_TERMS,
	termFormat: 'TRIMESTER' as const,
	termCount: 3,
};

/** The same year, but the caller did NOT ask EnrollPro to verify the term. */
const UNVERIFIED_ACTIVE_TERM = {
	source: 'atlas-unverified',
	reachable: true,
	verified: false,
	activeTerm: null,
	termIndex: null,
	schoolYearId: ACTIVE_YEAR,
	matchedSchoolYear: null,
	code: null,
	message: 'Active term verification not requested.',
	orderedTerms: ORDERED_TERMS,
	termFormat: 'TRIMESTER' as const,
	termCount: 3,
};

function verifiedRuntimePayload() {
	return {
		schoolId: SCHOOL_ID,
		activeSchoolYearId: ACTIVE_YEAR,
		activeSchoolYearLabel: '2026-2027',
		source: 'enrollpro-verified',
		stale: false,
		resolvedAt: '2026-09-30T00:00:00.000Z',
		evidence: [],
		activeTerm: VERIFIED_ACTIVE_TERM,
	};
}

function persistedRuntimePayload() {
	return {
		schoolId: SCHOOL_ID,
		activeSchoolYearId: ACTIVE_YEAR,
		activeSchoolYearLabel: '2026-2027',
		source: 'atlas-persisted',
		stale: false,
		resolvedAt: '2026-09-30T00:00:00.000Z',
		evidence: [],
		activeTerm: UNVERIFIED_ACTIVE_TERM,
	};
}

type RuntimeMode = 'honor-verify' | 'always-persisted' | 'throw';
type SectionsMode = 'enrollpro' | 'cached-enrollpro' | 'stub' | 'missing';

const state: {
	runtimeMode: RuntimeMode;
	sections: SectionsMode;
	runtimeCalls: Array<Record<string, unknown> | undefined>;
} = { runtimeMode: 'honor-verify', sections: 'enrollpro', runtimeCalls: [] };

const TEACHER = {
	id: 9,
	firstName: 'Maria',
	lastName: 'Dela Cruz',
	department: 'Mathematics',
	employmentStatus: 'REGULAR',
	employeeId: 'EMP-0009',
	isActiveForScheduling: true,
	isClassAdviser: false,
	isPlaceholder: false,
	maxHoursPerWeek: 40,
	policyCreditedHours: 24,
	sectionTeachingHours: 20,
	actualTeachingHours: 20,
	subjectCount: 2,
	sectionCount: 2,
	advisoryEquivalentHours: 0,
	ancillaryMinutesPerWeek: 0,
	advisedSectionName: null,
	version: 1,
	// The nested `subject` / `sections` shape the real roster cell reads
	// (`FacultyRow.buildSubjectSummaries`), copied from the accepted
	// `a6-teachers-header-profile` fixture.
	assignments: [
		{
			id: 1,
			subject: { id: 5, code: 'FIL', name: 'Filipino', minMinutesPerWeek: 180 },
			sections: [{ id: 11, name: 'FIL 7 - Section A', displayOrder: 7 }],
		},
		{
			id: 2,
			subject: { id: 6, code: 'DEVL_READING', name: 'Reading Development', minMinutesPerWeek: 120 },
			sections: [{ id: 12, name: 'DEVL Reading 8 - Section B', displayOrder: 8 }],
		},
	],
};

function sectionsPayload() {
	if (state.sections === 'missing') return {};
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: ACTIVE_YEAR,
		totalSections: 2,
		totalEnrolled: 0,
		byGradeLevel: { 7: 2 },
		enrolledByGradeLevel: {},
		source: state.sections,
		sourceMode: state.sections === 'stub' ? 'stub' : 'enrollpro',
		sections: [
			{ id: 11, name: 'Grade 7 - A', gradeLevel: 7, displayOrder: 1, schoolId: SCHOOL_ID },
			{ id: 12, name: 'Grade 7 - B', gradeLevel: 7, displayOrder: 2, schoolId: SCHOOL_ID },
		],
		fetchedAt: '2026-09-30T00:00:00.000Z',
	};
}

async function apiGet(url: string, config?: { params?: Record<string, unknown> }) {
	if (url.includes('/auth/me')) {
		return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'SCHEDULER', activeSchoolYearId: ACTIVE_YEAR, activeSchoolYearLabel: '2026-2027' } } };
	}
	if (url.includes('/runtime/context')) {
		state.runtimeCalls.push(config?.params);
		if (state.runtimeMode === 'throw') throw new Error('ENROLLPRO_UNREACHABLE');
		const asked = config?.params?.verifyUpstream === 'true';
		if (state.runtimeMode === 'always-persisted') return { data: persistedRuntimePayload() };
		return { data: asked ? verifiedRuntimePayload() : persistedRuntimePayload() };
	}
	if (url.includes('/runtime/rollover-status')) {
		return { data: { drift: { status: 'enrollpro-unreachable' }, canResetDummyYear: false } };
	}
	if (url.includes('/faculty-assignments/authority-diagnostics')) return { data: null };
	if (url.includes('/faculty-assignments/summary')) {
		return { data: { faculty: [TEACHER], ownershipIndex: [], fetchedAt: '2026-09-30T00:00:00.000Z' } };
	}
	if (url.includes('/sections/summary/')) return { data: sectionsPayload() };
	if (url.includes('/sections/assigned-classes')) return { data: { sections: [] } };
	if (url.includes('/subjects')) return { data: { subjects: [{ id: 101, code: 'MATH', name: 'Mathematics', schoolId: SCHOOL_ID, isActive: true }] } };
	if (url.includes('/homeroom-hint')) return { data: { subjectId: 101, sectionId: null } };
	return { data: {} };
}

(atlasApi as any).get = (url: string, config?: { params?: Record<string, unknown> }) => apiGet(String(url), config);
(atlasApi as any).post = async () => ({ data: {} });
(atlasApi as any).patch = async () => ({ data: {} });
(atlasApi as any).put = async () => ({ data: {} });
(atlasApi as any).delete = async () => ({ data: {} });

const roots: any[] = [];
const hosts: HTMLElement[] = [];

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
}

afterEach(() => {
	teardown();
	hookHandle = null;
});

beforeEach(() => {
	dom.window.sessionStorage.setItem(ATLAS_LOCAL_TOKEN_KEY, 'a6-source-truth-token');
	invalidateActiveSchoolYearContext(SCHOOL_ID);
	state.runtimeMode = 'honor-verify';
	state.sections = 'enrollpro';
	state.runtimeCalls = [];
});

function inRouter(node: any) {
	return createElement(
		MemoryRouter as any,
		{ initialEntries: ['/'] },
		createElement(TooltipProvider as any, { delayDuration: 0 }, node),
	);
}

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(inRouter(node)); });
	return host;
}

async function flush() {
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

/* ------------------------------------------------------------------ *
 * The REAL Teaching Load hook, publishing the two values the page
 * renders: `dataSource` (the header's source state) and
 * `degradedNotice` (the banner copy; the page passes it as
 * `dataSourceNotice` and derives `upstreamVerified = degradedNotice === null`).
 * ------------------------------------------------------------------ */
let hookHandle: {
	dataSource: string;
	degradedNotice: string | null;
	facultyCount: number;
	sectionCount: number;
	loading: boolean;
} | null = null;

function TeachingLoadSourceTruthHost() {
	const data = useTeachingLoadData();
	useEffect(() => {
		hookHandle = {
			dataSource: data.dataSource,
			degradedNotice: data.degradedNotice,
			facultyCount: data.faculty.length,
			sectionCount: data.allKnownSections.length,
			loading: data.loading,
		};
	});
	return null;
}

async function settleHook() {
	for (let i = 0; i < 40; i += 1) {
		await flush();
		if (hookHandle && !hookHandle.loading && hookHandle.facultyCount > 0) return;
	}
	assert.ok(hookHandle, 'the Teaching Load hook host must publish a handle');
}

/* ================================================================== *
 * R1 — the defect: a verified cache answer is verified-upstream.
 * ================================================================== */

test('R1 a verified ordered cached year resolves verified-upstream, so Teaching Load is live with NO banner', async () => {
	// The live shape: a record written by a verified EnrollPro read within the
	// 10-minute window, whose active term is verified and ordered.
	cacheActiveSchoolYearContext(SCHOOL_ID, ACTIVE_YEAR, '2026-2027', VERIFIED_ACTIVE_TERM, false);

	// (a) The context itself. `source` stays `cache`, so the OLD predicate cannot
	// see the verified provenance; the NEW field records it.
	const context = await resolveActiveSchoolYearContext({
		schoolId: SCHOOL_ID,
		verifyUpstream: true,
		allowEnrollProFallback: false,
	});
	assert.equal(context.source, 'cache', 'the answer is a cache answer, unchanged');
	assert.equal(
		isUpstreamBackedSchoolYearSource(context.source),
		false,
		'the OLD predicate is false for a verified cache answer — this is the defect',
	);
	assert.equal(context.verifiedUpstream, true, 'the NEW field records the verified provenance');

	// (b) The page. The real hook resolves the same verified cache and must settle
	// on the verified state with no saved-data banner.
	render(createElement(TeachingLoadSourceTruthHost));
	await settleHook();
	assert.equal(
		hookHandle!.dataSource,
		'live',
		`a verified upstream year must read as live; saw ${JSON.stringify(hookHandle)}`,
	);
	assert.equal(
		hookHandle!.degradedNotice,
		null,
		'no saved-data / connected-but-saved banner may be shown for a verified year',
	);
});

/* ================================================================== *
 * R2 — Teachers: the page must ask the server to verify.
 * ================================================================== */

async function settlePage() {
	for (let round = 0; round < 12; round += 1) {
		await flush();
	}
}

async function mountRealRosterPage() {
	const host = render(createElement(FacultyPage as any, {}));
	await settlePage();
	return host;
}

test('R2 the real Teachers page asks with verifyUpstream and renders verified-live', async () => {
	const host = await mountRealRosterPage();

	// The server returns `enrollpro-verified` ONLY for a verified ask (exactly the
	// live server). The page must have asked.
	assert.ok(
		state.runtimeCalls.some((params) => params?.verifyUpstream === 'true'),
		`Teachers must pass verifyUpstream:true; calls were ${JSON.stringify(state.runtimeCalls)}`,
	);
	assert.ok(
		host.querySelector('[data-source-state="verified-live"]'),
		'Teachers must render the verified-live source state',
	);
	assert.equal(
		host.querySelector('[data-source-state="saved-data"]'),
		null,
		'the saved-data state must be gone once the year is verified',
	);
	const summary = host.querySelector('[data-testid="admin-source-truth-summary"]')?.textContent ?? '';
	assert.doesNotMatch(
		summary,
		/last safe teacher roster snapshot/,
		'the saved-data banner copy must not be rendered',
	);
});

/* ================================================================== *
 * R3 — preservation: an unverified context still shows saved data.
 * ================================================================== */

test('R3 an unverified (`atlas-persisted`) context still shows the saved-data banner', async () => {
	state.runtimeMode = 'always-persisted';
	render(createElement(TeachingLoadSourceTruthHost));
	await settleHook();
	assert.equal(
		hookHandle!.dataSource,
		'cached',
		'an unverified context must not read as live',
	);
	assert.equal(
		hookHandle!.degradedNotice,
		'EnrollPro could not be reached, so ATLAS is using the last saved sections. Recent changes in EnrollPro may be missing.',
		'the existing unverified copy must be byte-identical',
	);
});

test('R3b a stale-cache fallback is never verified-upstream', async () => {
	invalidateActiveSchoolYearContext(SCHOOL_ID);
	// A STALE record (older than the 10-minute window) carrying a verified term.
	localStorage.setItem(
		activeSchoolYearCacheKey(SCHOOL_ID),
		JSON.stringify({
			activeSchoolYearId: ACTIVE_YEAR,
			activeSchoolYearLabel: '2026-2027',
			activeTerm: VERIFIED_ACTIVE_TERM,
			cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
		}),
	);
	state.runtimeMode = 'throw';

	const stale = await resolveActiveSchoolYearContext({
		schoolId: SCHOOL_ID,
		verifyUpstream: true,
		allowEnrollProFallback: false,
	});
	assert.equal(stale.source, 'cache', 'the stale fallback is a cache answer');
	assert.equal(stale.stale, true, 'and it is honestly flagged stale');
	assert.equal(stale.verifiedUpstream, false, 'a stale fallback is never verified-upstream');
});

/* ================================================================== *
 * R4 — preservation: a non-live sections summary still downgrades.
 * ================================================================== */

for (const source of ['cached-enrollpro', 'stub'] as const) {
	test(`R4 a '${source}' sections summary still downgrades`, async () => {
		state.sections = source;
		render(createElement(TeachingLoadSourceTruthHost));
		await settleHook();
		assert.notEqual(
			hookHandle!.dataSource,
			'live',
			`a '${source}' sections summary must not read as live`,
		);
		assert.ok(
			hookHandle!.degradedNotice,
			`a '${source}' sections summary must carry a degraded notice`,
		);
	});
}

/* ================================================================== *
 * R5 — preservation: an empty/missing sections payload is degraded.
 * ================================================================== */

test('R5 a missing sections payload is still degraded, never verified', async () => {
	state.sections = 'missing';
	render(createElement(TeachingLoadSourceTruthHost));
	await settleHook();
	assert.notEqual(
		hookHandle!.dataSource,
		'live',
		'a payload that declares no sections source must never read as live',
	);
	assert.ok(hookHandle!.degradedNotice, 'and it must carry a degraded notice');
});
