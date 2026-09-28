/**
 * A7-C4 — the two year-setup carry switches on `/admin/year-setup`, proved on the
 * RENDERED DOM.
 *
 * WHY A RENDERED TEST AND NOT A SOURCE SCAN (AGENTS.md §11, "done means seen").
 * The defect this cycle exists to remove is what a school scheduler READS when
 * they start a new year: a page that says nothing about what carries over. A
 * source-text assertion would pass while the two switches, their labels and their
 * one short line were absent from the screen, which is exactly the failure
 * recorded on 2026-09-27/28. So every row below drives the REAL components
 * through jsdom and reads the text and the REQUEST a person would see and make.
 *
 * What is mounted: the REAL `RolloverGuidanceCard`, the REAL
 * `RolloverPlainYearSetupCard` it renders, the REAL `RolloverConfirmationDialogs`
 * sibling, and the REAL `applyRolloverSync` path — with ONLY the transport
 * (`@/lib/api`) stubbed. The same shape `a7-year-setup-plain-words.test.tsx` uses,
 * for the same reason: stubbing the transport proves the wiring, and stubbing the
 * behaviour would only prove a transcription of it.
 *
 * SCOPE LIMIT, STATED UP FRONT. A browser-row rendered proof at 1366x768 is
 * packet R9 and belongs to the loopback/staging pass and then to Lane C on
 * `https://njgrm.buru-degree.ts.net` after A4 deploys — A7 never deploys. jsdom
 * proves WHAT IS RENDERED and WHAT IS SENT; it proves no layout, and this file
 * does not claim any.
 *
 * Run: `npm run test:a7-year-setup-carry-switches`
 *   = node --experimental-test-module-mocks --import tsx --test <this file>
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 11;
const YEAR_LABEL = '2024-2025';
const SOURCE_YEAR_LABEL = '2023-2024';

type Recorded = { method: 'get' | 'post'; url: string; body?: unknown };
let recorded: Recorded[] = [];
type Scenario = ReturnType<typeof makeScenario>;
let scenario: Scenario = makeScenario();

function baseStatus(overrides: Record<string, unknown> = {}) {
	return {
		schoolId: SCHOOL_ID,
		atlasSchoolYearId: 10,
		enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL },
		drift: {
			status: 'atlas-stale',
			message: `EnrollPro has moved to ${YEAR_LABEL}. Start ${YEAR_LABEL} in ATLAS before building a timetable.`,
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			atlasSchoolYearId: 10,
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

function makeScenario(overrides: { status?: Record<string, unknown>; classification?: unknown; termPreview?: unknown; carry?: unknown } = {}) {
	return {
		status: baseStatus(overrides.status ?? {}),
		classification: overrides.classification ?? null,
		termPreview: overrides.termPreview ?? null,
		carry: overrides.carry ?? {
			plan: {
				sourceYearId: 10,
				sourceYearLabel: SOURCE_YEAR_LABEL,
				schedulingPolicy: { source: 1, targetExisting: 0, toInsert: 1 },
				gradeShiftWindows: { source: 3, targetExisting: 0, toInsert: 3 },
				policySpecialEvents: { source: 2, targetExisting: 0, toInsert: 2 },
			},
			applied: true,
			auditLogId: 4242,
			keepSchedulingRules: true,
			keepGradeTimeWindows: true,
		},
	};
}

function statusAfterApply() {
	return baseStatus({
		atlasSchoolYearId: SCHOOL_YEAR_ID,
		drift: { ...baseStatus().drift, status: 'aligned', message: `ATLAS is on ${YEAR_LABEL}, the same school year as EnrollPro.`, recommendedAction: 'NONE', atlasSchoolYearId: SCHOOL_YEAR_ID },
		counts: { facultyCount: 41, sectionCount: 12, settingsReachable: true },
	});
}

function responseFor(url: string) {
	if (url.includes('/auth/me')) return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'admin', authSource: 'local' } } };
	if (url.includes('/runtime/rollover-status')) return { data: scenario.status };
	if (url.includes('/runtime/rollover-sync/preview')) return { data: scenario.status };
	if (url.includes('/runtime/rollover-recovery/classify')) return { data: scenario.classification };
	if (url.includes('/runtime/rollover-archive/preview')) return { data: null };
	if (url.includes('/runtime/rollover-sync/apply')) {
		const carry = scenario.carry;
		scenario = makeScenario({ status: statusAfterApply(), carry });
		return { data: { ...statusAfterApply(), applied: true, sync: { faculty: {}, sections: {}, policyReady: true, canonicalTemplatesSeeded: 0, yearSetupCarry: carry } } };
	}
	if (url.includes('/runtime/term-authority/preview')) return { data: scenario.termPreview };
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
const { RolloverConfirmationDialogs } = await import('@/components/runtime/RolloverConfirmationDialogs');
const copy = await import('@/components/runtime/rollover-plain-copy');

const roots: any[] = [];
const hosts: HTMLElement[] = [];

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
}
afterEach(teardown);

async function flush() {
	for (let i = 0; i < 6; i += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

async function renderCard(props: Record<string, unknown>): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/admin/year-setup'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, createElement(RolloverGuidanceCard as any, { schoolId: SCHOOL_ID, ...props })),
		));
	});
	await flush();
	return host;
}

/** The plain Year Setup mount, exactly as `/admin/year-setup` mounts it. */
function renderPlainCard() {
	return renderCard({ plainLanguageNextStep: true, allowTestDataMarking: true, adminHref: null, dismissible: false });
}

function reset() {
	recorded = [];
	scenario = makeScenario();
	dom.window.sessionStorage.clear();
	dom.window.localStorage.clear();
	setLocalToken('a7-year-setup-carry-switches-token', false);
}

/** Every word the operator can read, read from `document.body` (Radix portals). */
function visibleText(): string {
	return (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function click(el: Element | null | undefined) {
	assert.ok(el, 'the control under test did not render');
	act(() => {
		el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
}

/** The two switches, by role — the same way a person and an AT find them. */
function switchesIn(host: HTMLElement): Element[] {
	return Array.from(host.querySelectorAll('[role="switch"]'));
}

function carryOptionOfLastApply(): { keepSchedulingRules?: unknown; keepGradeTimeWindows?: unknown } | null {
	const applies = recorded.filter((call) => call.method === 'post' && call.url.includes('/rollover-sync/apply'));
	assert.equal(applies.length, 1, `expected exactly one apply, recorded ${applies.length}: ${JSON.stringify(recorded.map((c) => c.url))}`);
	const body = applies[0].body as { yearSetupCarry?: { keepSchedulingRules?: unknown; keepGradeTimeWindows?: unknown } } | undefined;
	return body?.yearSetupCarry ?? null;
}

// ── C1: both switches render ON by default ───────────────────────────────────

test('C1: both switches render on the plain card, and both are ON by default', async () => {
	reset();
	const host = await renderPlainCard();

	const card = host.querySelector('[data-testid="rollover-guidance-card"]');
	assert.ok(card, `the plain status card did not render. Rendered: ${visibleText().slice(0, 400)}`);
	const block = host.querySelector('[data-testid="year-setup-keep-switches"]');
	assert.ok(block, 'the two switches did not render on the plain card');

	const switches = switchesIn(host);
	assert.equal(switches.length, 2, `expected exactly two switches, found ${switches.length}: ${visibleText().slice(0, 400)}`);
	for (const control of switches) {
		assert.equal(control.getAttribute('aria-checked'), 'true', 'both switches must be ON by default — "Both defaulted as don\'t reset"');
		assert.equal((control as HTMLButtonElement).disabled, false, 'a switch must not be disabled on a state the operator can act on');
	}

	// POSITIVE CONTROL: the reader really discriminates on/off. Asserting
	// "aria-checked is true" twice proves nothing, so prove the ATTRIBUTE SELECTOR
	// separates the two states on the very element under test.
	assert.equal(switches[0].matches('[role="switch"][aria-checked="true"]'), true, 'a checked switch must match the checked selector');
	assert.equal(switches[0].matches('[role="switch"][aria-checked="false"]'), false, 'a checked switch must NOT match the unchecked selector, or C3 could not see a switch turn off');
	assert.equal(
		host.querySelectorAll('[role="switch"][aria-checked="false"]').length,
		0,
		'no switch is off on arrival',
	);

	// The switches sit immediately above the ONE primary action — that is the
	// moment the choice is made (packet §3.3).
	const primary = host.querySelector('[data-testid="rollover-banner-sync"]');
	assert.ok(primary, 'the rollover-sync primary action did not render, so the switches govern nothing');
	const switchesBeforePrimary = switches.every((control) => (
		(control.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING) === Node.DOCUMENT_POSITION_FOLLOWING
	));
	assert.equal(switchesBeforePrimary, true, 'the switches must be rendered ABOVE the primary action they govern');
});

// ── C2: the labels are the operator's own, byte for byte ─────────────────────

test('C2: the two labels are byte-identical to the packet\'s §4, and each carries its one short line', async () => {
	reset();
	const host = await renderPlainCard();
	const text = visibleText();

	// The operator's own words, quoted from the packet's §4 table. They are
	// asserted as literals HERE as well as in `rollover-plain-copy.ts`, so a copy
	// edit that changes one side but not the other is caught.
	const EXPECTED = [
		["Keep last year's scheduling rules", 'Your school day, teaching hours and break times stay exactly as you set them last year.'],
		["Keep last year's grade time windows and flag ceremonies", 'Each grade keeps its own start and finish times, and your flag ceremonies and special days come with it.'],
	] as const;

	for (const [label, line] of EXPECTED) {
		assert.ok(text.includes(label), `the label is missing or reworded: "${label}". Rendered: ${text.slice(0, 600)}`);
		assert.ok(text.includes(line), `the one short line is missing or reworded: "${line}". Rendered: ${text.slice(0, 600)}`);
		assert.equal(
			label,
			label === "Keep last year's scheduling rules" ? copy.PLAIN_KEEP_SCHEDULING_RULES_LABEL : copy.PLAIN_KEEP_GRADE_WINDOWS_LABEL,
			'the rendered label and the exported constant must be the same string',
		);
	}

	// Each row carries its OWN line, in its own row element — so a reader can
	// tell the two sides apart (R7), rather than one line floating under both.
	const ruleRow = host.querySelector('[data-testid="year-setup-keep-scheduling-rules-row"]');
	const windowRow = host.querySelector('[data-testid="year-setup-keep-grade-windows-row"]');
	assert.ok(ruleRow && windowRow, 'the two switch rows are not separately addressable');
	assert.ok((ruleRow!.querySelector('[data-testid$="-line"]')!.textContent ?? '').includes('school day'));
	assert.ok((windowRow!.querySelector('[data-testid$="-line"]')!.textContent ?? '').includes('start and finish times'));

	// The off-state sentence exists, and is NOT shown while the switches are on.
	assert.equal(copy.PLAIN_KEEP_SWITCH_OFF_LINE, 'The new year starts empty for this.');
	assert.equal(text.includes(copy.PLAIN_KEEP_SWITCH_OFF_LINE), false, 'the off-state sentence is showing while both switches are on');
});

// ── C3: turning one off sends false for that part only ────────────────────────

test('C3: turning one switch off sends false for that part only, and the other is still true', async () => {
	reset();
	const host = await renderPlainCard();
	const [first, second] = switchesIn(host);

	click(first);
	await flush();
	assert.equal(first.getAttribute('aria-checked'), 'false', 'the first switch did not turn off');
	assert.equal(second.getAttribute('aria-checked'), 'true', 'turning the first switch off must not touch the second');

	// The off-state sentence REPLACES the line, in place, and never sits beside it.
	const firstLine = host.querySelector('[data-testid="year-setup-keep-scheduling-rules-row"] [data-testid$="-line"]')!;
	assert.equal(firstLine.textContent?.trim(), copy.PLAIN_KEEP_SWITCH_OFF_LINE, 'turning a switch off must replace its line, not add a second sentence');
	const secondLine = host.querySelector('[data-testid="year-setup-keep-grade-windows-row"] [data-testid$="-line"]')!;
	assert.ok((secondLine.textContent ?? '').includes('flag ceremonies'), 'the other switch keeps its own line');

	click(host.querySelector('[data-testid="rollover-banner-sync"]'));
	await flush();

	const sent = carryOptionOfLastApply();
	assert.deepEqual(sent, { keepSchedulingRules: false, keepGradeTimeWindows: true }, 'the request must state the choice per part, not as a single on/off');
});

test('C3b: both switches off sends both false, per part, and nothing else about the request changes', async () => {
	reset();
	const host = await renderPlainCard();
	for (const control of switchesIn(host)) {
		click(control);
		await flush();
	}
	click(host.querySelector('[data-testid="rollover-banner-sync"]'));
	await flush();

	assert.deepEqual(carryOptionOfLastApply(), { keepSchedulingRules: false, keepGradeTimeWindows: false });
});

test('C3c: the post-apply confirmation says what was kept, with honest 0/1/n counts and no id', async () => {
	reset();
	const host = await renderPlainCard();
	click(host.querySelector('[data-testid="rollover-banner-sync"]'));
	await flush();

	// The line the page's confirmation renders is the one this production
	// derivation produces. Asserting it here — against the real function, on the
	// server's own response shape — is what makes the wording falsifiable; the
	// rendered page itself is covered by `test:a7-year-setup-plain-words` (row 5)
	// and, at 1366x768 on the live origin, by Lane C (packet R9).
	const summary = copy.plainYearSetupCarrySummary({
		sync: {
			yearSetupCarry: {
				plan: {
					sourceYearId: 10,
					sourceYearLabel: SOURCE_YEAR_LABEL,
					schedulingPolicy: { source: 1, targetExisting: 0, toInsert: 1 },
					gradeShiftWindows: { source: 3, targetExisting: 0, toInsert: 3 },
					policySpecialEvents: { source: 2, targetExisting: 0, toInsert: 2 },
				},
				applied: true,
				auditLogId: 4242,
				keepSchedulingRules: true,
				keepGradeTimeWindows: true,
			},
		},
	});
	assert.ok(summary, 'the apply response must be readable as a carry summary');
	const lines = copy.plainStartedCopy({
		yearLabel: YEAR_LABEL,
		sectionCount: 12,
		facultyCount: 41,
		keptYearLabels: [],
		yearSetupCarry: summary,
	});
	assert.ok(
		lines.includes(`Kept from ${SOURCE_YEAR_LABEL}: your school day rules, 3 grade start and finish times, and 2 flag ceremonies and special days.`),
		`the confirmation does not say what was kept: ${JSON.stringify(lines)}`,
	);
	for (const line of lines) {
		assert.equal(/#\d+/.test(line), false, `the confirmation renders a raw id: ${line}`);
	}

	// The honest 0 and 1 forms. A count of 1 is not "1 times", and a count of 0
	// is not hidden — the one line has to be able to say all three truthfully.
	assert.equal(
		copy.plainYearSetupKeptLine({
			applied: true,
			keepSchedulingRules: true,
			keepGradeTimeWindows: true,
			plan: { sourceYearLabel: SOURCE_YEAR_LABEL, gradeShiftWindows: { toInsert: 1 }, policySpecialEvents: { toInsert: 0 } },
		}),
		`Kept from ${SOURCE_YEAR_LABEL}: your school day rules, 1 grade start and finish time, and 0 flag ceremonies and special days.`,
	);
	// Nothing copied, with a switch on: the line says exactly that.
	assert.equal(
		copy.plainYearSetupKeptLine({
			applied: false,
			keepSchedulingRules: true,
			keepGradeTimeWindows: true,
			plan: { sourceYearLabel: SOURCE_YEAR_LABEL, gradeShiftWindows: { toInsert: 0 }, policySpecialEvents: { toInsert: 0 } },
		}),
		'Nothing needed keeping — this year already had all of it.',
	);
	// BOTH switches off and nothing copied: NO line, because "this year already
	// had all of it" would be a false claim — the operator asked for an empty
	// year and got one. (Packet §4: "only when something was kept".)
	assert.equal(
		copy.plainYearSetupKeptLine({
			applied: false,
			keepSchedulingRules: false,
			keepGradeTimeWindows: false,
			plan: { sourceYearLabel: null, gradeShiftWindows: { toInsert: 0 }, policySpecialEvents: { toInsert: 0 } },
		}),
		null,
		'with both switches off the confirmation must not claim the year already had everything',
	);
	// And an absent carry adds nothing at all.
	assert.equal(copy.plainYearSetupKeptLine(null), null);
	assert.equal(copy.plainYearSetupKeptLine(undefined), null);
	assert.equal(copy.plainYearSetupCarrySummary(null), null);
	assert.equal(copy.plainYearSetupCarrySummary({}), null);
	assert.equal(copy.plainYearSetupCarrySummary({ sync: {} }), null);
	assert.equal(copy.plainYearSetupCarrySummary({ sync: { yearSetupCarry: null } }), null);
	// POSITIVE CONTROL: the reader is not a no-op that always returns null.
	assert.ok(
		copy.plainYearSetupCarrySummary({ sync: { yearSetupCarry: { applied: true, keepSchedulingRules: true, keepGradeTimeWindows: true, plan: { sourceYearLabel: SOURCE_YEAR_LABEL, gradeShiftWindows: { toInsert: 2 }, policySpecialEvents: { toInsert: 1 } } } } }),
		'a real carry response must produce a summary',
	);
});

// ── C4: the jargon guard ─────────────────────────────────────────────────────

const BANNED = ['sync', 'synced', 'mirror', 'election', 'drift', 'archive', 'archived', 'carry-forward', 'dummy', 'carry', 'hard cap'] as const;
const RAW_ID = /#\d+/;

test('C4: every string the two switches add passes the existing jargon guard', async () => {
	reset();
	const host = await renderPlainCard();
	const text = visibleText();
	// Not vacuous: the row below would pass on an empty page otherwise.
	assert.ok(text.length > 80, `the page rendered ${text.length} characters, so the ban below would pass vacuously`);

	for (const word of BANNED) {
		const hit = new RegExp(`\\b${word}\\b`, 'i').exec(text);
		assert.equal(hit, null, `the page shows the word "${word}"${hit ? `: …${text.slice(Math.max(0, hit.index - 60), hit.index + 60)}…` : '.'}`);
	}
	assert.equal(RAW_ID.exec(text), null, `the page renders a raw id: ${text}`);

	// POSITIVE CONTROL: the same detector, fed the pre-fix lines, must bite. A
	// ban that cannot go red is not a ban.
	for (const legacy of [
		'Automatic year sync is off. Sync stays manual.',
		'Archive the old school year and sync the new one',
		'Preview carry-forward',
		'Over hard cap: 3 → 1',
	]) {
		const hit = BANNED.find((word) => new RegExp(`\\b${word}\\b`, 'i').test(legacy));
		assert.ok(hit, `the detector missed the pre-fix copy "${legacy}"`);
	}
	assert.ok(RAW_ID.test('2020-2021 (#7) as read-only history'), 'the raw-id detector must bite');
	assert.equal(RAW_ID.test('2020-2021 as read-only history'), false, 'the raw-id detector must not fire on a year with no id');
});

// ── C5: the other five mounts are byte-identical to the base tree ─────────────

/**
 * C5 — `RolloverGuidanceCard` is also mounted on Dashboard, Sections, Faculty,
 * TeachingLoad and two timetable surfaces that OTHER LANES OWN. Those five mounts
 * do not pass `plainLanguageNextStep`, so they must render the base tree's DOM
 * byte for byte. This is proved by a SHA-256 PIN over the rendered text of the
 * non-plain card, with the literal counting method recorded, plus a positive
 * control so the pin is known to discriminate.
 *
 * THE PIN'S PROVENANCE, so a reviewer can re-derive it: the digest below was taken
 * from the BASE tree (`d0cda4ee`) with this exact scenario — `RolloverGuidanceCard`
 * mounted with `schoolId: 1` and NO other prop, status `atlas-stale` /
 * `RUN_ROLLOVER_SYNC` — reading `document.body.textContent` collapsed to single
 * spaces and trimmed. That literal read was:
 *   "New year needs setupEnrollPro 2024-2025EnrollPro has moved to 2024-2025. Start
 *    2024-2025 in ATLAS before building a timetable.Open year setup to sync from
 *    EnrollPro, then review sections and Teaching Load.Automatic year sync is off.
 *    Sync stays manual.PreviewSync nowYear setup"
 * Re-deriving it needs the base tree; a reviewer on the candidate cannot, so the
 * rendered text is quoted above and the digest is checked against it.
 */
const BASE_NON_PLAIN_RENDER_SHA256 = '6582252a6e2eb9646571b611525a196b5e4f4fd7504fa8260e5d5617d08ee980';

/** THE LITERAL COUNTING METHOD: the file's bytes split on LF, trailing newline dropped. */
function sha256OfText(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

test('C5: the five non-plain mounts render byte-identically to the base tree — the switches are year-setup only', async () => {
	reset();
	const host = await renderCard({});
	const text = visibleText();

	// 1. The switches are NOT on the non-plain card at all.
	assert.equal(host.querySelector('[data-testid="year-setup-keep-switches"]'), null, 'the switches leaked onto a mount that other lanes own');
	assert.equal(switchesIn(host).length, 0, 'no switch may render on a non-plain mount');
	// …and their labels are absent, not merely unmounted.
	for (const label of [copy.PLAIN_KEEP_SCHEDULING_RULES_LABEL, copy.PLAIN_KEEP_GRADE_WINDOWS_LABEL]) {
		assert.equal(text.includes(label), false, `"${label}" reached a non-plain mount`);
	}

	// 2. The rendered text is the base tree's, byte for byte.
	assert.equal(
		sha256OfText(text),
		BASE_NON_PLAIN_RENDER_SHA256,
		`the non-plain card's rendered text changed.\n  got:  ${sha256OfText(text)}\n  want: ${BASE_NON_PLAIN_RENDER_SHA256}\n  text: ${text}`,
	);

	// 3. The strings those five mounts are known by are still there.
	for (const legacy of ['Automatic year sync is off. Sync stays manual.', 'Preview', 'Year setup']) {
		assert.ok(text.includes(legacy), `the non-plain card lost "${legacy}". Dashboard, Sections, Faculty, TeachingLoad and the two timetable banners mount it without the prop and must not change.`);
	}

	// 4. POSITIVE CONTROL: the pin discriminates. A one-character change must
	// change the digest, or row 2 above would pass for a broken hash.
	assert.notEqual(sha256OfText(`${text} `), BASE_NON_PLAIN_RENDER_SHA256, 'the digest cannot see a single added space, so the pin is vacuous');
	assert.notEqual(sha256OfText(text.replace('Preview', 'Peek')), BASE_NON_PLAIN_RENDER_SHA256, 'the digest cannot see a changed word, so the pin is vacuous');
});

/**
 * THE PACKET'S SUBTRACTION. The plain card's `rollover-automation-line` ("Nothing
 * changes in ATLAS until you press the button") is removed from THAT CARD ONLY:
 * the two switches now make the pre-press state visible, so the reassurance line
 * said the same thing twice in two places, and the design gate (AGENTS.md §11)
 * does not allow a region to gain words without giving as much back. It stays on
 * the other five mounts, untouched — and both halves are asserted.
 */
test('SUBTRACTION: the redundant automation line is gone from the plain card and still on the non-plain mounts', async () => {
	reset();
	const plain = await renderPlainCard();
	assert.equal(
		plain.querySelector('[data-testid="rollover-automation-line"]'),
		null,
		'the plain card still renders the automation line; the two switches made it redundant',
	);
	assert.equal(
		visibleText().includes('Nothing changes in ATLAS until you press the button.'),
		false,
		'the reassurance line is still on screen next to the switches',
	);

	reset();
	const nonPlain = await renderCard({});
	// The non-plain card's automation paragraph never carried a `data-testid` —
	// only the plain card's did — so the surviving half is asserted on the WORDS,
	// which is what the five mounts actually show.
	assert.ok(
		visibleText().includes('Automatic year sync is off. Sync stays manual.'),
		'the automation line was removed from the non-plain mounts too; five other lanes\' pages keep it',
	);
	// POSITIVE CONTROL: the plain card really did carry a testid for it before the
	// subtraction, so this is a real removal and not a line that never existed.
	assert.ok(
		readFileSync(new URL('../runtime/RolloverPlainYearSetupCard.tsx', import.meta.url), 'utf8').includes('rollover-automation-line'),
		'the plain card source must still document the removed line, so the subtraction is traceable',
	);
	// The DECLARATION must be gone — a prose mention in the removal note is
	// expected and is not a live string.
	assert.equal(
		/export (const|function) PLAIN_AUTOMATION_OFF|\bfunction plainAutomationLine\b/.test(
			readFileSync(new URL('../runtime/rollover-plain-copy.ts', import.meta.url), 'utf8'),
		),
		false,
		'the unreachable reassurance string and its helper must be gone from the copy table, or someone will put the line back',
	);
});

// ── C6: the file-size cap, and the extracted dialogs still render ─────────────

/**
 * C6 — `RolloverGuidanceCard.tsx` stood at 1008 physical lines against the
 * AGENTS.md §8 limit of 1000, over the cap BEFORE this packet added anything to
 * it. The three confirmation dialogs were extracted into one sibling so the file
 * could take the two switches and still end at or below 1000.
 *
 * COUNTING METHOD, LITERAL, because §11 warns that a count taken two different
 * ways reads as two different numbers: the committed file's bytes are read as
 * UTF-8, split on a single LF, and the trailing empty element produced by a
 * final newline is dropped. Blank lines and comments COUNT.
 */
function physicalLineCount(relativePath: string): number {
	const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
	const lines = source.split('\n');
	if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines.length;
}

test('C6: RolloverGuidanceCard.tsx is at or below 1000 physical lines, by the recorded method', () => {
	const count = physicalLineCount('../runtime/RolloverGuidanceCard.tsx');
	assert.ok(count <= 1000, `RolloverGuidanceCard.tsx is ${count} physical lines, over the AGENTS.md §8 limit of 1000`);

	// The method is pinned by a fixture, so a future reviewer cannot read this
	// number a different way and report a mismatch. `"a\nb\n\nc\n"` is FOUR
	// physical lines — a, b, a blank, c — plus the trailing empty element the
	// final newline produces, which the method drops.
	assert.equal('a\nb\n\nc\n'.split('\n').length, 5, 'the split must yield the four lines plus one trailing empty element');
	assert.equal('a\nb\n\nc\n'.split('\n').length - 1, 4, 'the counting method must drop exactly the trailing empty element');
	assert.equal(physicalLineCount('../runtime/RolloverConfirmationDialogs.tsx') > 0, true, 'the extracted sibling must be a non-empty file');
});

test('C6b: all three extracted dialogs still render, with their testids and their typed-confirmation gates', async () => {
	reset();
	// 1. The ordered-terms dialog.
	scenario = makeScenario({
		status: {
			termAuthority: { state: 'MISSING', code: null, message: 'The school year is current, but its ordered terms have not been saved in ATLAS yet.', persisted: false, persistedSemanticRevision: null, liveSemanticRevision: 'r2', cachedAt: null, termCount: 3, needsRepair: true, repairAction: 'PREVIEW_TERM_CACHE_SYNC', canPreview: true },
		},
		termPreview: {
			schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL, mirrorId: 5,
			state: 'READY', code: null, message: "Saving stores only this school year\u2019s ordered terms. It does not bring in teachers, sections, or Teaching Load.",
			format: 'TRIMESTER',
			terms: [
				{ identity: 'Q-A', displayLabel: 'Opening Cycle', order: 1, startDate: null, endDate: null },
				{ identity: 'Q-B', displayLabel: 'Second Cycle', order: 2, startDate: null, endDate: null },
			],
			liveSemanticRevision: 'r2', persistedSemanticRevision: 'r1', cachedAt: null,
			activeTermAvailability: 'NO_TERM_FOR_DATE', fingerprint: 'fp-2',
			confirmationText: 'SAVE_TERM_AUTHORITY_1_9', zeroWrite: true,
		},
	});
	const terms = await renderPlainCard();
	click(terms.querySelector('[data-testid="rollover-term-repair-action"]'));
	await flush();
	const termsDialog = dom.window.document.body.querySelector('[data-testid="rollover-term-repair-dialog"]');
	assert.ok(termsDialog, 'the ordered-terms dialog did not render after the extraction');
	assert.equal(
		termsDialog!.querySelector('[data-testid="rollover-term-repair-code"]')!.textContent!.trim(),
		'SAVE_TERM_AUTHORITY_1_9',
		'the typed-confirmation PHRASE changed; that is not this lane\'s decision (A7-C2 R5)',
	);
	assert.equal(
		(termsDialog!.querySelector('#term-repair-confirmation') as HTMLInputElement).getAttribute('placeholder'),
		'SAVE_TERM_AUTHORITY_1_9',
		'the typed confirmation must still be compared against the server phrase',
	);
	assert.equal(
		(dom.window.document.body.querySelector('[data-testid="rollover-term-repair-apply"]') as HTMLButtonElement).disabled,
		true,
		'the apply must stay unreachable until the phrase is typed',
	);
	teardown();

	// 2. The test-data recovery confirmation.
	reset();
	scenario = makeScenario({
		status: {
			drift: { ...baseStatus().drift, status: 'mapping-conflict', message: 'ATLAS has leftover section data for this school year. Mark the year as test data to clear it.', recommendedAction: 'RESET_DUMMY_YEAR' },
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'ATLAS already has section data for this school year, but it does not match EnrollPro.' }],
		},
		classification: { classification: 'TEST_DATA_RECOVERY_AVAILABLE', schoolId: SCHOOL_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL }, atlasSchoolYearId: 10, conflictCode: 'SECTION_ID_COLLISION', artifactCounts: { sectionMirrors: 5 }, blockers: [], confirmationText: 'RESET_DUMMY_SCHOOL_YEAR_1', message: 'ATLAS has leftover section data for this school year.', canClearTestData: true, testDataMarked: false },
	});
	const recovery = await renderPlainCard();
	click(recovery.querySelector('[data-testid="rollover-banner-clear-test-data"]'));
	await flush();
	const recoveryApply = dom.window.document.body.querySelector('[data-testid="recovery-confirm-apply"]') as HTMLButtonElement | null;
	assert.ok(recoveryApply, 'the recovery confirmation did not render after the extraction');
	assert.equal(recoveryApply!.disabled, true, 'the typed confirmation must still gate the recovery apply');
	teardown();

	// 3. The mark-as-test-data confirmation.
	reset();
	scenario = makeScenario({
		status: {
			drift: { ...baseStatus().drift, status: 'mapping-conflict', message: 'ATLAS has leftover section data for this school year. Mark the year as test data to clear it.', recommendedAction: 'RESET_DUMMY_YEAR' },
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'ATLAS already has section data for this school year, but it does not match EnrollPro.' }],
		},
		classification: { classification: 'TEST_DATA_RECOVERY_BLOCKED', schoolId: SCHOOL_ID, enrollProActiveYear: { id: SCHOOL_YEAR_ID, yearLabel: YEAR_LABEL }, atlasSchoolYearId: 10, conflictCode: 'SECTION_ID_COLLISION', artifactCounts: { sectionMirrors: 5 }, blockers: [], confirmationText: 'RESET_DUMMY_SCHOOL_YEAR_1', message: 'ATLAS has leftover section data for this school year.', canClearTestData: false, testDataMarked: false },
	});
	const marking = await renderPlainCard();
	click(marking.querySelector('[data-testid="rollover-banner-mark-test-data"]'));
	await flush();
	const markDialog = dom.window.document.body.querySelector('[data-testid="rollover-mark-test-data-confirm"]') as HTMLButtonElement | null;
	assert.ok(markDialog, 'the mark-as-test-data confirmation did not render after the extraction');
	assert.equal(
		(dom.window.document.body.querySelector('[data-testid="rollover-mark-test-data-confirm"]') as HTMLButtonElement).disabled,
		true,
		'the mark-test-data apply must still be gated on the acknowledgement',
	);
	teardown();

	// 4. The sibling really is a component of its own and the card really uses
	// it — so "the dialogs render" is not a second, drifting copy in the card.
	const sibling = readFileSync(new URL('../runtime/RolloverConfirmationDialogs.tsx', import.meta.url), 'utf8');
	const card = readFileSync(new URL('../runtime/RolloverGuidanceCard.tsx', import.meta.url), 'utf8');
	assert.ok(sibling.includes('export function RolloverConfirmationDialogs('), 'the extracted sibling must export the dialogs');
	assert.ok(card.includes('<RolloverConfirmationDialogs'), 'the card must RENDER the sibling, not keep a second copy of the dialogs');
	for (const testid of ['rollover-term-repair-dialog', 'recovery-confirm-apply', 'rollover-mark-test-data-confirm']) {
		assert.equal(
			(card.match(new RegExp(testid.replace(/-/g, '\\-'), 'g')) ?? []).length,
			0,
			`the card still contains a copy of the "${testid}" dialog; the extraction is incomplete`,
		);
		assert.ok(sibling.includes(testid), `the sibling must own "${testid}"`);
	}
	assert.equal(typeof RolloverConfirmationDialogs, 'function', 'the sibling must be a real exported component');
});
