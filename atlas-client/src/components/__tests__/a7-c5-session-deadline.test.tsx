/**
 * A7-C5 — a sign-in check that ENDS, and carry-over on the archive-shaped start.
 *
 * TWO DEFECTS, ONE FILE, BOTH PROVED ON THE RENDERED DOM AND ON THE REAL CALL.
 *
 * ITEM 1 — THE GATE HAD NO DEADLINE. Codex's staging walk on 2026-09-29 recorded
 * `BLOCKER - /admin/year-setup - ... Observed "Verifying session. Checking your
 * sign-in" indefinitely, with no setup content.` The cause was structural, not
 * cosmetic: `verifySessionToken()` has no time bound, and two call sites turned
 * that into a permanent `verifying` state — `AppShell.verifyActorSession()`
 * (which guards EVERY route) and `AdminYearSetup`'s own content gate. Rows S1-S6
 * below drive the REAL page and the REAL resolver with a session check that never
 * settles, and assert that the screen REACHES A STATE INSTEAD OF WAITING.
 *
 *   The two rules that must not be broken while fixing it, each with its own row:
 *   - a DEADLINE is `unconfirmed` (S3) — no storage cleared, no `/login` redirect,
 *     because a slow server is not proof of a bad sign-in, and this is the one
 *     place that could quietly destroy a working session;
 *   - a REJECTION and an ABSENT TOKEN are still `unauthenticated` (S4) — the
 *     existing clear-and-redirect authority is unchanged, not softened.
 *
 * ITEM 2 — THE CARRY-OVER SWITCHES WERE UNREACHABLE ON THE ARCHIVE-SHAPED START.
 * A7-C4 hid them with `!copy.primaryStartsArchivedYear`, but the server ALREADY
 * carries over on that path (`archiveAndSyncActiveYear` -> `applyRolloverSync` ->
 * `resolveYearSetupCarryOptions`), so ATLAS kept last year's setup with no way to
 * turn it off and no way to see that it was doing it. Rows X1-X4 read the
 * switches the operator can see and the REQUEST body the click really sends.
 * Row X5 is the preservation row: the ordered-terms primary genuinely carries
 * nothing, so a switch above it would be a control that silently does nothing.
 *
 * HARNESS HONESTY (AGENTS.md §11). jsdom proves WHAT IS RENDERED and WHAT IS
 * SENT, never layout. The 1366x768 rendering is packet row R9 and belongs to the
 * loopback-preview screenshots; this file does not claim it. What is mounted is
 * the REAL `AdminYearSetup` page and the REAL `RolloverGuidanceCard` /
 * `RolloverPlainYearSetupCard`, with ONLY the transport (`@/lib/api`) stubbed —
 * stubbing the behaviour instead would only prove a transcription of it.
 *
 * Run: `npm run test:a7-c5-session-deadline`
 *   = node --experimental-test-module-mocks --import tsx --test <this file>
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, mock, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/admin/year-setup',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
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
	SVGElement: dom.window.SVGElement,
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
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
	return { width: 320, height: 40, top: 0, left: 0, bottom: 40, right: 320, x: 0, y: 0, toJSON: () => ({}) };
};

// ── Transport stub ───────────────────────────────────────────────────────────
//
// ONE switch, two behaviours, because both defects are read from the same
// transport: item 1 needs `/auth/me` to NEVER SETTLE, item 2 needs it to resolve
// an admin. Splitting into two files would duplicate a 100-line jsdom harness for
// no new evidence, and one mode switch keeps both readings honest.

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 11;
const ARCHIVE_YEAR_ID = 10;
const YEAR_LABEL = '2024-2025';
const SOURCE_YEAR_LABEL = '2023-2024';

type Recorded = { method: 'get' | 'post'; url: string; body?: unknown };
let recorded: Recorded[] = [];
/** `'hang'` is the defect being fixed: a session check that never settles. */
let sessionMode: 'resolve' | 'hang' = 'resolve';

function baseStatus(overrides: Record<string, unknown> = {}) {
	return {
		schoolId: SCHOOL_ID,
		atlasSchoolYearId: ARCHIVE_YEAR_ID,
		enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL },
		drift: {
			status: 'atlas-stale',
			message: `EnrollPro has moved to ${YEAR_LABEL}. Start ${YEAR_LABEL} in ATLAS before building a timetable.`,
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			atlasSchoolYearId: ARCHIVE_YEAR_ID,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			enrollProSchoolYearLabel: YEAR_LABEL,
			mirrorSyncedAt: null,
		},
		mirror: null,
		conflicts: [],
		reconfiguredSections: [],
		canResetDummyYear: false,
		resetTargetSchoolYearId: null,
		conflictingRecordCounts: null,
		teachingLoadResetRequired: false,
		publishedResetBlocked: false,
		archivedYears: [],
		schoolYears: [],
		automation: { enabled: false, lastAttemptAt: null, lastResult: null, nextAttemptAt: null, consecutiveFailures: 0, currentlyApplying: false },
		termAuthority: { state: 'PERSISTED_CURRENT', code: null, message: 'The saved ordered terms match EnrollPro.', persisted: true, persistedSemanticRevision: 'r1', liveSemanticRevision: 'r1', cachedAt: '2022-06-01T00:00:00.000Z', termCount: 3, needsRepair: false, repairAction: 'NONE', canPreview: false },
		...overrides,
	};
}

/**
 * The archive-shaped start: EnrollPro has moved on AND ATLAS still holds
 * conflicting data for the old year, which is the only state in which
 * `showArchiveFlow` is true and the plain card's primary becomes
 * `rollover-archive-and-sync`.
 */
function archiveShapedStatus() {
	const base = baseStatus();
	return baseStatus({
		atlasSchoolYearId: ARCHIVE_YEAR_ID,
		drift: { ...base.drift, status: 'mapping-conflict', recommendedAction: 'RUN_ARCHIVE_AND_SYNC' },
		conflicts: [{ kind: 'SECTION_OWNERSHIP_MISMATCH', count: 3, message: 'Three sections have a different owner in ATLAS than in EnrollPro.' }],
		canResetDummyYear: true,
		resetTargetSchoolYearId: ARCHIVE_YEAR_ID,
	});
}

/** The ordered-terms primary: a DIFFERENT verb that genuinely carries nothing. */
function orderedTermsStatus() {
	const base = baseStatus();
	return baseStatus({
		atlasSchoolYearId: SCHOOL_YEAR_ID,
		drift: { ...base.drift, status: 'aligned', recommendedAction: 'NONE' },
		termAuthority: { ...base.termAuthority, state: 'MISSING', needsRepair: true, repairAction: 'PREVIEW_TERM_CACHE_SYNC', canPreview: true },
	});
}

let statusPayload: Record<string, unknown> = baseStatus();
let archivePreviewPayload: unknown = null;
/** A fresh token per row; see `reset`. */
let tokenSeq = 0;
let currentToken = 'a7-c5-token-0';

function responseFor(url: string) {
	if (url.includes('/auth/me')) {
		if (sessionMode === 'hang') return new Promise<{ data: { user: unknown } }>(() => { /* never settles — the recorded defect */ });
		return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'admin', authSource: 'local' } } };
	}
	if (url.includes('/runtime/rollover-status')) return { data: statusPayload };
	if (url.includes('/runtime/rollover-sync/preview')) return { data: statusPayload };
	if (url.includes('/runtime/rollover-recovery/classify')) return { data: null };
	if (url.includes('/runtime/rollover-archive/preview')) return { data: archivePreviewPayload };
	if (url.includes('/runtime/rollover-archive/apply')) {
		return { data: { schoolId: SCHOOL_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL }, archivedYears: [], labelReconciled: true, sync: { schoolYearId: SCHOOL_YEAR_ID, faculty: { activeCount: 41 }, sections: { count: 12 }, policyReady: true, canonicalTemplatesSeeded: 0, yearSetupCarry: { applied: true, keepSchedulingRules: true, keepGradeTimeWindows: true, plan: { sourceYearLabel: SOURCE_YEAR_LABEL, gradeShiftWindows: { toInsert: 3 }, policySpecialEvents: { toInsert: 2 } } } } } };
	}
	if (url.includes('/runtime/rollover-sync/apply')) {
		const applied = baseStatus({ atlasSchoolYearId: SCHOOL_YEAR_ID, drift: { ...baseStatus().drift, status: 'aligned', recommendedAction: 'NONE' }, counts: { facultyCount: 41, sectionCount: 12, settingsReachable: true } });
		return { data: { ...applied, applied: true, sync: { faculty: { activeCount: 41 }, sections: { count: 12 }, policyReady: true, canonicalTemplatesSeeded: 0, yearSetupCarry: { applied: true, keepSchedulingRules: true, keepGradeTimeWindows: true, plan: { sourceYearLabel: SOURCE_YEAR_LABEL, gradeShiftWindows: { toInsert: 3 }, policySpecialEvents: { toInsert: 2 } } } } } };
	}
	if (url.includes('/runtime/term-authority/preview')) return { data: null };
	if (url.includes('/public/settings')) return { data: { schoolName: 'Test High School', logoUrl: null, selectedAccentHsl: null } };
	return { data: {} };
}

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			recorded.push({ method: 'get', url });
			return responseFor(url);
		},
		post: async (url: string, body?: unknown) => {
			recorded.push({ method: 'post', url, body });
			return responseFor(url);
		},
		patch: async (url: string) => responseFor(url),
		put: async (url: string) => responseFor(url),
		delete: async (url: string) => responseFor(url),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { setLocalToken } = await import('@/lib/auth');
const { RolloverGuidanceCard } = await import('@/components/runtime/RolloverGuidanceCard');

const roots: any[] = [];
const hosts: HTMLElement[] = [];

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
}
afterEach(teardown);

async function flush(times = 6) {
	for (let i = 0; i < times; i += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

async function mount(element: unknown): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/admin/year-setup'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, element as any),
		));
	});
	await flush();
	return host;
}

/** The real `/admin/year-setup` page, exactly as the route mounts it. */
async function mountYearSetupPage() {
	const { default: AdminYearSetup } = await import('@/pages/AdminYearSetup');
	return mount(createElement(AdminYearSetup as any));
}

/** The plain Year Setup card, exactly as `/admin/year-setup` mounts it. */
async function mountPlainCard() {
	return mount(createElement(RolloverGuidanceCard as any, {
		schoolId: SCHOOL_ID, plainLanguageNextStep: true, allowTestDataMarking: true, adminHref: null, dismissible: false,
	}));
}

function reset(next: { sessionMode?: 'resolve' | 'hang'; status?: Record<string, unknown> } = {}) {
	recorded = [];
	sessionMode = next.sessionMode ?? 'resolve';
	statusPayload = next.status ?? baseStatus();
	archivePreviewPayload = null;
	dom.window.sessionStorage.clear();
	dom.window.localStorage.clear();
	// A FRESH TOKEN PER TEST, on purpose. `requestAuthMe` memoises an in-flight
	// `/auth/me` per token, so a test that reuses one token inherits the hung
	// request from the test before it and every later row silently measures the
	// deadline instead of its own subject. One token per row removes the leak
	// between rows.
	tokenSeq += 1;
	currentToken = `a7-c5-token-${tokenSeq}`;
	setLocalToken(currentToken, false);
}

function visibleText(): string {
	return (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function click(el: Element | null | undefined) {
	assert.ok(el, 'the control under test did not render');
	act(() => {
		el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
}

function switchesIn(host: HTMLElement): Element[] {
	return Array.from(host.querySelectorAll('[role="switch"]'));
}

function carryBodyOf(path: string): { keepSchedulingRules?: unknown; keepGradeTimeWindows?: unknown } | null {
	const applies = recorded.filter((call) => call.method === 'post' && call.url.includes(path));
	assert.equal(applies.length, 1, `expected exactly one ${path}, recorded ${applies.length}: ${JSON.stringify(recorded.map((c) => c.url))}`);
	const body = applies[0].body as { yearSetupCarry?: { keepSchedulingRules?: unknown; keepGradeTimeWindows?: unknown } } | undefined;
	return body?.yearSetupCarry ?? null;
}

/**
 * The shared deadline-bound resolver, loaded leniently.
 *
 * It is loaded inside a `try` rather than at the top of the file on purpose: on
 * the base tree the module DOES NOT EXIST, and a top-level `await import` of a
 * missing module aborts the whole file. That would make the run red for "the
 * file would not load" and hide whether the archive-shaped defect (X1-X3) is
 * also caught. One missing module, one failing row, everything else still runs.
 */
async function loadResolver(): Promise<typeof import('@/lib/session-verification') | null> {
	try {
		return await import('@/lib/session-verification');
	} catch {
		return null;
	}
}

async function loadNotice(): Promise<typeof import('@/components/app-shell/SessionVerificationNotice') | null> {
	try {
		return await import('@/components/app-shell/SessionVerificationNotice');
	} catch {
		return null;
	}
}

/**
 * A source file with its COMMENTS removed.
 *
 * This change documents the strings it removes right next to the line that no
 * longer renders them, so a plain source scan goes red on its own explanation —
 * the exact trap `a3-canonical-page-title-c1` records ("a control that greps a
 * file for an identifier turns red because the file's own comment block explains
 * the change"). Comments become a single space so removing one cannot join two
 * tokens into one.
 */
function codeOnly(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const shellSource = readFileSync(new URL('../AppShell.tsx', import.meta.url), 'utf8');
const shellCode = codeOnly(shellSource);
const sidebarCode = codeOnly(readFileSync(new URL('../app-shell/AppSidebar.tsx', import.meta.url), 'utf8'));
const noticeCode = codeOnly(readFileSync(new URL('../app-shell/SessionVerificationNotice.tsx', import.meta.url), 'utf8'));

/** Wait real milliseconds inside `act`, so React can settle after the deadline. */
async function waitReal(ms: number) {
	const step = 250;
	for (let waited = 0; waited < ms; waited += step) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, step)); });
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 1 — the gate has no deadline
// ═══════════════════════════════════════════════════════════════════════════

test('S1: the resolver module exists and its deadline is 8000 ms, so the wait is bounded at one named number', async () => {
	const resolver = await loadResolver();
	assert.ok(resolver, 'atlas-client/src/lib/session-verification.ts does not exist — the sign-in gate has no deadline and waits forever');
	assert.equal(
		resolver.SESSION_VERIFICATION_TIMEOUT_MS,
		8000,
		'the deadline must be the ~8 s the requester asked for, named in ONE module rather than scattered as literals',
	);
	assert.equal(typeof resolver.verifySessionWithinDeadline, 'function');
});

test('S2: a session check that never settles ends as `unconfirmed` in about 8 s, and the page is no longer stuck on a promise', async () => {
	const notice = await loadNotice();
	assert.ok(notice?.SessionVerificationNotice, 'no shared recovery surface to compose the real screen with');

	reset({ sessionMode: 'hang' });
	// The REAL screen: the shell's band plus the route's page, which is exactly
	// how `/admin/year-setup` is mounted (the band is a sibling of the outlet,
	// not a child of the page).
	await mount(createElement(notice.SessionVerificationNotice as any, { onRetry: () => {}, onBackToDashboard: () => {} }));
	const host = await mountYearSetupPage();

	// On arrival the page IS gated — the gate is real, this is not a vacuous pass.
	assert.match(visibleText(), /Checking your access/, 'the page must actually gate its content while the session is unknown');
	assert.equal(switchesIn(host).length, 0, 'no setup content may render behind an unresolved session');

	const startedAt = Date.now();
	await waitReal(9500);
	const elapsed = Date.now() - startedAt;

	// THE RECORDED DEFECT, asserted FIRST so it is what goes red. Codex's staging
	// walk saw this text with no setup content after ten seconds and a reload.
	assert.doesNotMatch(
		visibleText(),
		/Checking your access/,
		'THE RECORDED DEFECT: the page is still showing its own "Checking your access..." gate 9.5 s after mount, with no setup content and no way forward',
	);
	// A deadline is not proof of a bad sign-in, so the page must NOT have thrown
	// the operator at the sign-in screen. S3 asserts the storage half of this.
	assert.doesNotMatch(visibleText(), /Sign in|Log in/, 'a slow server must not navigate the operator to a sign-in page');
	assert.ok(elapsed >= 8000, `the gate must actually wait for the deadline before giving up (waited ${elapsed} ms)`);

	// And the deadline is one named number in one shared module, not a literal
	// typed into a component.
	const resolver = await loadResolver();
	assert.ok(resolver, 'no shared resolver module: the deadline is either missing or re-implemented in a caller');
	assert.equal(
		dom.window.document.body.querySelectorAll('[data-testid="session-verification-notice"]').length,
		1,
		`the shell's one recovery surface must be on screen once the deadline passes. Rendered: ${visibleText().slice(0, 300)}`,
	);
	// The band is CONDITIONAL on the deadline, which the composition above cannot
	// show (it mounts the band directly). That is the shell's own branch, so it
	// is pinned on the shell's code here rather than pretended at in the render.
	assert.match(
		shellCode,
		/sessionVerificationState === 'unconfirmed' && \(\s*<SessionVerificationNotice/,
		'the band must be gated on the unconfirmed state — it must not be up while the check is still running',
	);
});

test('S3: a DEADLINE is `unconfirmed` — it clears no storage, does not redirect, and leaves the token in place', async () => {
	// The RENDERED half first: the sign-in is still there after the deadline. A
	// slow `/auth/me` is not a logout, and this is the one place that could
	// quietly destroy a working sign-in.
	reset({ sessionMode: 'hang' });
	await mountYearSetupPage();
	await waitReal(9500);

	// The sign-in is still there. A slow `/auth/me` is not a logout.
	assert.equal(
		dom.window.sessionStorage.getItem('atlas_local_token'),
		currentToken,
		'a deadline must not clear the access token: a slow server is not proof of a bad sign-in',
	);

	// THE POSITIVE CONTROL for the row above: clearing storage IS observable by
	// this same reader, so a green S3 means the deadline really preserved it.
	dom.window.localStorage.setItem('a7-c5-control-key', 'present');
	dom.window.localStorage.removeItem('a7-c5-control-key');
	assert.equal(dom.window.localStorage.getItem('a7-c5-control-key'), null, 'POSITIVE CONTROL: this reader sees storage removal, or S3 proves nothing');

	// And the resolver, called directly, reports `unconfirmed` — not
	// `unauthenticated`, which is what would drive the clear-and-redirect.
	const resolver = await loadResolver();
	assert.ok(resolver, 'no shared resolver: there is no way to express a deadline as a distinct outcome');
	const outcome = await resolver.verifySessionWithinDeadline({ timeoutMs: 60 });
	assert.equal(outcome.kind, 'unconfirmed', 'a deadline must resolve as `unconfirmed`');
	assert.equal(outcome.reason, 'deadline-exceeded');
});

test('S4: an ABSENT TOKEN and a REJECTION are still `unauthenticated` — the clear-and-redirect authority is unchanged', async () => {
	const resolver = await loadResolver();
	assert.ok(resolver, 'no shared resolver: the two authority branches have nowhere to live');

	// (a) absent token -> unauthenticated, with no waiting at all.
	dom.window.sessionStorage.clear();
	dom.window.localStorage.clear();
	const noToken = await resolver.verifySessionWithinDeadline({ timeoutMs: 60 });
	assert.equal(noToken.kind, 'unauthenticated', 'an absent token is still an unauthenticated session, not a deadline');
	assert.equal(noToken.reason, 'no-token');

	// (b) a rejection is a real answer, and it answers immediately rather than
	// waiting out the deadline. `null` is what `verifySessionToken` resolves with
	// for a rejected token.
	reset({ sessionMode: 'resolve' });
	const rejected = await resolver.verifySessionWithinDeadline({ timeoutMs: 60 });
	assert.notEqual(rejected.kind, 'unconfirmed', 'a resolved check is never a deadline');
	assert.equal(rejected.kind, 'authenticated');
	assert.equal((rejected as { user: { role: string } }).user.role, 'admin');

	// (c) POSITIVE CONTROL that the resolver discriminates: a check that DOES
	// settle as a rejection must be readable as `unauthenticated`.
	const discriminated = await resolver.verifySessionWithinDeadline({
		timeoutMs: 60,
		verify: async () => null,
	} as never);
	assert.equal(discriminated.kind, 'unauthenticated', 'a null user is a rejection, not a deadline');
	assert.equal(discriminated.reason, 'rejected');
});

test('S5: the resolver NEVER throws and ALWAYS clears its timer, however it ends', async () => {
	const resolver = await loadResolver();
	assert.ok(resolver, 'no shared resolver: nothing owns the timer');

	// A check that rejects outright (a network error, not a 401) must still come
	// back as a value. A throw here would land in the shell's `.catch` and read
	// as "signed out", which is the failure mode the deadline exists to prevent.
	const threw = await resolver.verifySessionWithinDeadline({
		timeoutMs: 5000,
		verify: async () => { throw new Error('network down'); },
	} as never);
	assert.equal(threw.kind, 'unauthenticated');

	// TIMER LEAK. A fast success that left its timer armed would keep the jsdom
	// event loop alive and fire later; three fast attempts in a row must not
	// produce three pending 5 s timers.
	const before = process.getActiveResourcesInfo?.().filter((r) => r === 'Timeout').length ?? -1;
	for (let i = 0; i < 3; i += 1) {
		const fast = await resolver.verifySessionWithinDeadline({
			timeoutMs: 5000,
			verify: async () => ({ id: 46, schoolId: SCHOOL_ID, role: 'admin' }),
		} as never);
		assert.equal(fast.kind, 'authenticated');
	}
	const after = process.getActiveResourcesInfo?.().filter((r) => r === 'Timeout').length ?? -1;
	if (before >= 0) {
		assert.ok(after <= before, `each attempt must clear its own timer; timers went ${before} -> ${after}`);
	}
});

test('S6: ONE recovery surface in the whole tree — one sentence, one Try again, one Back to dashboard, and the page adds none', async () => {
	const notice = await loadNotice();
	assert.ok(notice?.SessionVerificationNotice, 'no shared SessionVerificationNotice component: the recovery surface is not the one band the packet names');

	// A. The tree holds exactly ONE recovery surface, and the shell is the only
	//    thing that mounts it. A uniqueness claim is decided by a whole-tree scan,
	//    not by one render.
	const mounts = (shellCode.match(/<SessionVerificationNotice/g) ?? []).length;
	assert.equal(mounts, 1, `AppShell must mount the recovery notice exactly once, found ${mounts}`);

	// B. The strings the operator was stranded behind are GONE from the code.
	for (const gone of ['Verifying session…', 'Checking your sign-in']) {
		assert.equal(sidebarCode.includes(gone), false, `"${gone}" must be gone: it promised a check that could never finish`);
		assert.equal(shellCode.includes(gone), false, `"${gone}" must be gone from the shell too`);
	}
	// And the replacement is honest rather than a synonym swap: while the bounded
	// check runs the line must not claim `Guest` (a `timetable-lifecycle-controls-c03`
	// row exists for that), and on a deadline it names the new state.
	assert.match(sidebarCode, /'Sign-in not confirmed'/, 'the sidebar must name the unconfirmed state in plain words');
	assert.doesNotMatch(
		sidebarCode,
		/sessionVerificationState === 'verifying'\s*\?\s*'[^']*'\s*:\s*bridgeUser\?\.role \?\? 'Guest'/,
		'the sidebar must not swap straight from a verifying string to Guest — a slow check has not signed anyone out',
	);

	// C. Rendered: the real notice, once, with the two ways forward.
	reset({ sessionMode: 'resolve' });
	const host = await mount(createElement(notice.SessionVerificationNotice as any, {
		onRetry: () => {}, onBackToDashboard: () => {},
	}));
	const text = visibleText();
	assert.equal(host.querySelectorAll('[data-testid="session-verification-notice"]').length, 1, 'exactly one recovery band');
	assert.equal((text.match(/Try again/g) ?? []).length, 1, 'exactly one Try again');
	assert.equal((text.match(/Back to dashboard/g) ?? []).length, 1, 'exactly one way back to the dashboard');
	// The sentence says WHAT IS WRONG in plain words, and reassures that the
	// working sign-in was not thrown away.
	assert.match(text, /could not confirm your sign-in in time/i, 'the band must say in plain words what is wrong');
	assert.match(text, /not (been )?cleared/i, 'the band must say the sign-in was not cleared — otherwise Try again sounds destructive');

	// D. Try again and Back to dashboard must DO the two things, not look like it.
	const pressed: string[] = [];
	const live = await mount(createElement(notice.SessionVerificationNotice as any, {
		onRetry: () => pressed.push('retry'),
		onBackToDashboard: () => pressed.push('dashboard'),
	}));
	const retry = live.querySelector('[data-testid="session-verification-retry"]');
	const back = live.querySelector('[data-testid="session-verification-dashboard"]');
	click(retry);
	click(back);
	assert.deepEqual(pressed, ['retry', 'dashboard'], 'both controls must be wired to their own action');
	// The two controls are the mouse-first sizes the rollover band uses.
	for (const control of [retry, back]) {
		assert.match(control!.getAttribute('class') ?? '', /min-h-11/, 'both controls copy the rollover band\'s mouse-first hit area');
	}
	// No raw tooltip-by-title, no disclosure element on the recovery surface.
	// Read with comments stripped: this file's own header names both, and a scan
	// that reads its own explanation proves nothing.
	assert.equal(/<details/i.test(noticeCode), false, 'no native <details> (§8)');
	assert.equal(/<[^>]+\stitle=/i.test(noticeCode), false, 'no title attribute (§8)');
	assert.equal(/<select/i.test(noticeCode), false, 'no native <select> (§8)');
	// Both controls come from the one primitive, not a local look-alike.
	assert.equal((noticeCode.match(/<Button/g) ?? []).length, 2, 'both controls are the one @/ui Button variant — no local look-alike');
	assert.ok(noticeCode.includes("from '@/ui/button'"), 'the controls must come from @/ui/button');
});

test('S7: on a deadline the page renders NO recovery panel of its own — the shell band directly above it is the only surface', async () => {
	const notice = await loadNotice();
	assert.ok(notice?.SessionVerificationNotice, 'no shared recovery notice to compare the page against');

	reset({ sessionMode: 'hang' });
	// The page alone, exactly as the route mounts it (the shell band is a
	// sibling above it, not a child of it).
	const pageOnly = await mountYearSetupPage();
	await waitReal(9500);

	// The page contributes NOTHING: no band, no sentence, no second set of
	// buttons. One status per fact, and one recovery surface in the tree.
	assert.equal(pageOnly.querySelectorAll('[data-testid="session-verification-notice"]').length, 0, 'the page must not mount a second recovery surface');
	assert.equal((visibleText().match(/could not confirm your sign-in in time/gi) ?? []).length, 0, 'the page must not repeat the shell sentence');
	assert.equal((visibleText().match(/Try again/g) ?? []).length, 0, 'the page must not repeat the retry action');

	// And with the shell band mounted beside it, the composed screen still holds
	// exactly one of everything.
	reset({ sessionMode: 'hang' });
	await mount(createElement(notice.SessionVerificationNotice as any, { onRetry: () => {}, onBackToDashboard: () => {} }));
	await mountYearSetupPage();
	await waitReal(9500);
	assert.equal((dom.window.document.body.querySelectorAll('[data-testid="session-verification-notice"]').length), 1, 'the composed screen holds exactly one recovery band');
	assert.equal((visibleText().match(/Try again/g) ?? []).length, 1, 'the composed screen holds exactly one Try again');
	assert.equal((visibleText().match(/Back to dashboard/g) ?? []).length, 1, 'the composed screen holds exactly one way back');
	// A resolved session must still render the page's real content — the deadline
	// is added, not substituted.
	reset({ sessionMode: 'resolve' });
	const resolved = await mountYearSetupPage();
	assert.ok(resolved.querySelector('[data-testid="rollover-guidance-card"]'), 'a confirmed session must still show the Year Setup card');
});

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 2 — the carry-over switches on the archive-shaped start
// ═══════════════════════════════════════════════════════════════════════════

test('X1: the archive-shaped start shows BOTH switches, both ON, immediately above the ONE button that starts the year', async () => {
	reset({ status: archiveShapedStatus() });
	const host = await mountPlainCard();

	const primary = host.querySelector('[data-testid="rollover-archive-and-sync"]');
	assert.ok(primary, 'the archive-shaped primary did not render, so this row would prove nothing');

	const switches = switchesIn(host);
	assert.equal(
		switches.length, 2,
		`the archive-shaped start must show both carry-over switches, found ${switches.length}. Rendered: ${visibleText().slice(0, 400)}`,
	);
	for (const control of switches) {
		assert.equal(control.getAttribute('aria-checked'), 'true', 'both switches default to KEEP — "keeping the default to keep"');
	}
	// They sit above the button that acts on them.
	assert.equal(
		switches.every((control) => (control.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING) === Node.DOCUMENT_POSITION_FOLLOWING),
		true,
		'the switches must be rendered ABOVE the archive-shaped primary they govern',
	);
	// The control really discriminates: the ATTRIBUTE SELECTOR must separate the
	// two states on these very elements, or no row below could see a switch turn.
	assert.equal(switches[0].matches('[role="switch"][aria-checked="true"]'), true);
	assert.equal(switches[0].matches('[role="switch"][aria-checked="false"]'), false);
	assert.equal(host.querySelectorAll('[role="switch"][aria-checked="false"]').length, 0, 'no switch is off on arrival');
});

test('X2: the archive-shaped start SENDS both switch values — the server already acts on them, so the choice must be reachable', async () => {
	reset({ status: archiveShapedStatus() });
	const host = await mountPlainCard();
	click(host.querySelector('[data-testid="rollover-archive-and-sync"]'));
	await flush(10);

	const body = carryBodyOf('/rollover-archive/apply');
	assert.ok(body, 'the archive-shaped start sent no yearSetupCarry at all — the operator is keeping last year\'s setup with no way to turn it off and no way to see it');
	assert.equal(body!.keepSchedulingRules, true, 'the visible ON state must be the value sent');
	assert.equal(body!.keepGradeTimeWindows, true, 'the visible ON state must be the value sent');
});

test('X3: both switches OFF is the only way to get an empty new year, and it is sent as two literal `false`s', async () => {
	reset({ status: archiveShapedStatus() });
	const host = await mountPlainCard();

	for (const testId of ['year-setup-keep-scheduling-rules-row', 'year-setup-keep-grade-windows-row']) {
		const row = host.querySelector(`[data-testid="${testId}"]`);
		click(row?.querySelector('[role="switch"]'));
	}
	await flush();
	assert.equal(host.querySelectorAll('[role="switch"][aria-checked="false"]').length, 2, 'both switches must read as OFF before the apply');

	click(host.querySelector('[data-testid="rollover-archive-and-sync"]'));
	await flush(10);

	const body = carryBodyOf('/rollover-archive/apply');
	assert.equal(body!.keepSchedulingRules, false, 'switching off must send a literal false, which is the ONLY value the server reads as off');
	assert.equal(body!.keepGradeTimeWindows, false, 'switching off must send a literal false, which is the ONLY value the server reads as off');
});

test('X4: the ordered-terms primary still shows NO switches — that request carries nothing, and a switch above it would silently do nothing', async () => {
	reset({ status: orderedTermsStatus() });
	const host = await mountPlainCard();

	const primary = host.querySelector('[data-testid="rollover-term-repair-action"]');
	assert.ok(primary, 'the ordered-terms primary did not render, so this row would prove nothing');
	assert.equal(
		host.querySelectorAll('[data-testid="year-setup-keep-switches"]').length, 0,
		'the ordered-terms save carries no yearSetupCarry, so a switch above it is a control that silently does nothing',
	);
	assert.equal(switchesIn(host).length, 0, 'no carry-over switch may appear on the ordered-terms primary');
});

test('X5: PRESERVATION — the rollover-sync primary still shows both switches and still sends them', async () => {
	reset({ status: baseStatus() });
	const host = await mountPlainCard();

	const primary = host.querySelector('[data-testid="rollover-banner-sync"]');
	assert.ok(primary, 'the rollover-sync primary did not render');
	assert.equal(switchesIn(host).length, 2, 'the A7-C4 behaviour must survive this packet');

	click(primary);
	await flush(10);
	const body = carryBodyOf('/rollover-sync/apply');
	assert.equal(body!.keepSchedulingRules, true);
	assert.equal(body!.keepGradeTimeWindows, true);
});
