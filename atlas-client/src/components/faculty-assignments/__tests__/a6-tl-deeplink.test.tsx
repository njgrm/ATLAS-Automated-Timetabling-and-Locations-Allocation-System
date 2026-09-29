/**
 * A6-TL-DEEPLINK — every entry into /teaching-load that names a target LANDS ON
 * the target once the data has loaded.
 *
 * WHY THIS FILE RENDERS. The defect is a navigation/focus behaviour: a deep link
 * or an in-page repair-queue button only *navigates*. The named teacher /
 * section / subject is never selected, scrolled into view, focused, or (for an
 * Assign entry) has its editor opened, and the URL intent is never CONSUMED, so
 * a later URL rewrite re-applies the entry target over whatever the operator has
 * since selected — the "I edited another teacher and it did not save" symptom.
 * A source-text assertion cannot see any of that. So every row below mounts the
 * REAL `pages/TeachingLoad` through jsdom, stubs ONLY the transport
 * (`@/lib/api`), drives the real entry URL or the real repair-queue button, and
 * reads the resulting DOM, selection state and dispatched PUTs.
 *
 * One row per entry E1–E9 in packet §3, plus X1 (intent consumed) and X2
 * (edit-another-then-save issues the PUT for the teacher edited, not the entry
 * target). `scrollIntoView` and `focus` are spied so R-b and R-c are asserted,
 * not assumed.
 *
 * Run: `npm run test:a6-tl-deeplink` (wired in atlas-client/package.json in the
 * same commit, and added to `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
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
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
	return { width: 320, height: 40, top: 0, left: 0, bottom: 40, right: 320, x: 0, y: 0, toJSON: () => ({}) };
};

// ── R-b / R-c spies: what was scrolled and what was focused ──────────────────
const scrollCalls: string[] = [];
const focusCalls: string[] = [];
const nativeFocus = dom.window.HTMLElement.prototype.focus;
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoViewSpy(this: HTMLElement) {
	scrollCalls.push(this.id || this.getAttribute('data-testid') || '');
};
dom.window.HTMLElement.prototype.focus = function focusSpy(this: HTMLElement, ...args: any[]) {
	focusCalls.push(this.id || this.getAttribute('data-testid') || '');
	return (nativeFocus as any).apply(this, args);
};

// ── The real, minimal service shape ─────────────────────────────────────────
const SCHOOL_ID = 1;
const YEAR_ID = 9;
const YEAR = '2030-2031';
const ISO = '2030-06-01T00:00:00.000Z';

const SUBJECT_MATH = 6;
const SUBJECT_SCI = 10;
const SECTION_A = 141; // Aguinaldo — MATH7 assigned to teacher 9
const SECTION_B = 142; // Bonifacio — MATH7 uncovered
const SECTION_C = 143; // Mabini — SCI7 assigned to teacher 12

const TEACHER_ENTRY = 9;    // E2/E3/E7 target (has MATH7 load)
const TEACHER_OTHER = 12;   // X2 edit target (has SCI7 load)
const TEACHER_NO_LOAD = 15; // E6/E9 target (no load)

function subject(id: number, code: string, name: string): any {
	return {
		id, schoolId: SCHOOL_ID, code, name, outputLabel: null, displayCode: code,
		ownerDepartment: 'Mathematics', allowedOwnerDepartments: ['Mathematics'],
		qualificationPriority: 'DEPARTMENT_FIRST',
		schedulingDisposition: 'SCHEDULED_TEACHING',
		rotationFamily: null, rotationTermIdentity: null, schedulingIssues: [],
		rotationTermRank: null, rotationTermLabel: null, rotationTermGroupId: null, rotationTermCount: null,
		minMinutesPerWeek: 300, preferredRoomType: 'CLASSROOM', gradeLevels: [7],
		isActive: true, isSeedable: true, interSectionEnabled: false, interSectionGradeLevels: [],
		programScopes: [], allowedSpecializations: [], requiredFeatures: [],
		createdAt: ISO, updatedAt: ISO,
	};
}

function assignmentRecord(id: number, subjectId: number, sectionId: number, subjectCode: string, subjectName: string): any {
	return {
		id, subjectId, gradeLevels: [7], sectionIds: [sectionId], sections: [],
		subject: { id: subjectId, name: subjectName, code: subjectCode, minMinutesPerWeek: 300 },
	};
}

function teacher(id: number, first: string, last: string, employeeId: string, assignments: any[]): any {
	const sectionCount = assignments.reduce((sum, a) => sum + a.sectionIds.length, 0);
	return {
		id, externalId: 1000 + id, employeeId, firstName: first, lastName: last,
		department: 'Mathematics', specialization: 'Mathematics',
		employmentStatus: 'REGULAR', isActiveForScheduling: true, isPlaceholder: false,
		isClassAdviser: false, advisedSectionId: null, advisedSectionName: null,
		advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0, canTeachOutsideDepartment: false,
		maxHoursPerWeek: 40, departmentCode: 'MATH', departmentLabel: 'Mathematics', departmentStatus: 'MAPPED',
		version: 1, subjectCount: assignments.length, sectionCount,
		assignedGradeLevels: assignments.length > 0 ? [7] : [],
		subjectHours: assignments.length * 5, sectionTeachingHours: sectionCount * 5,
		rotationFamilyOvercountHours: 0, rotationFamilyLoadDetails: [], rotationTermBreakdown: [],
		gradeTeachingHours: sectionCount * 5, advisoryHours: 0, ancillaryHours: 0,
		policyCreditedHours: sectionCount * 5, policyLoadPercentage: 0,
		actualTeachingHours: sectionCount * 5, teachingUtilizationPercent: null,
		teachingCapacityRemainingMinutes: null, excessTeachingMinutes: null, creditedWorkloadMinutes: null,
		syntheticCoverageHours: 0, loadSignalMode: 'STANDARD',
		assignments,
	};
}

function section(id: number, name: string, displayOrder: number): any {
	return {
		id, name, maxCapacity: 45, enrolledCount: 40, gradeLevelId: displayOrder, gradeLevelName: `Grade ${displayOrder}`,
		displayOrder, homeRoomId: null, buildingZoneId: null, programType: 'REGULAR', programCode: null,
		programName: null, upstreamProgramType: 'REGULAR', isSpecialProgram: false,
		tleProgramId: null, tleSpecialization: null, tleProgramCategory: null,
		adviserId: null, adviserName: null,
	};
}

function sectionClass(subjectId: number, subjectCode: string, subjectName: string, facultyId: number, facultyName: string): any {
	return {
		subjectId, subjectCode, subjectName, subjectDisplayLabel: subjectName, minMinutesPerWeek: 300,
		rotationFamily: null, rotationTermRank: null, rotationTermLabel: null, rotationTermGroupId: null, rotationTermCount: null,
		facultyId, facultyName, facultyDepartment: 'Mathematics', facultySpecialization: 'Mathematics',
		assignmentKind: 'REAL_OWNERSHIP', specializationCode: null, specializationLabel: null,
	};
}

function assignedIndex(): any {
	const classFor = (sectionId: number, classes: any[], unassigned: any[]): any => ({
		sectionId, sectionName: sectionId === SECTION_A ? 'Aguinaldo' : sectionId === SECTION_B ? 'Bonifacio' : 'Mabini',
		gradeLevel: sectionId === SECTION_C ? 9 : 7, programType: 'REGULAR', schoolYearId: YEAR_ID,
		classes, totals: { assignedClassCount: classes.length, rotationFamilyClassCount: 0, unassignedClassCount: unassigned.length },
		unassignedExpectedClasses: unassigned,
	});
	return {
		schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, fetchedAt: ISO,
		sections: [
			classFor(SECTION_A, [sectionClass(SUBJECT_MATH, 'MATH7', 'Mathematics 7', TEACHER_ENTRY, 'Dela Cruz, Maria')], []),
			classFor(SECTION_B, [], [{ subjectId: SUBJECT_MATH, subjectCode: 'MATH7', subjectName: 'Mathematics 7', subjectDisplayLabel: 'Mathematics 7', minMinutesPerWeek: 300, rotationFamily: null, rotationTermRank: null, rotationTermLabel: null, rotationTermGroupId: null, rotationTermCount: null }]),
			classFor(SECTION_C, [sectionClass(SUBJECT_SCI, 'SCI7', 'Science 7', TEACHER_OTHER, 'Alcantara, Roberto')], []),
		],
	};
}

function teacherSummary(): any {
	return {
		schoolYearId: YEAR_ID,
		faculty: [
			teacher(TEACHER_ENTRY, 'Maria', 'Dela Cruz', 'EMP-0009', [assignmentRecord(1, SUBJECT_MATH, SECTION_A, 'MATH7', 'Mathematics 7')]),
			teacher(TEACHER_OTHER, 'Roberto', 'Alcantara', 'EMP-0012', [assignmentRecord(2, SUBJECT_SCI, SECTION_C, 'SCI7', 'Science 7')]),
			teacher(TEACHER_NO_LOAD, 'Pedro', 'Santos', 'EMP-0015', []),
		],
		ownershipIndex: [],
		coverageTotals: { assignedPairs: 2, activeAssignedPairs: 2, realFacultyAssignedPairs: 2, syntheticPlaceholderPairs: 0, totalPairs: 2, unassignedPairs: 0 },
		integrityDiagnostics: undefined,
		workloadPolicy: null,
		workloadPolicyStatus: 'UNCONFIGURED',
		fetchedAt: ISO,
	};
}

function rolloverStatus(): any {
	return {
		schoolId: SCHOOL_ID, atlasSchoolYearId: YEAR_ID,
		enrollProActiveYear: { id: YEAR_ID, yearLabel: YEAR },
		drift: {
			status: 'aligned', message: `ATLAS is on ${YEAR}.`, recommendedAction: 'NONE',
			atlasSchoolYearId: YEAR_ID, enrollProSchoolYearId: YEAR_ID, enrollProSchoolYearLabel: YEAR, mirrorSyncedAt: ISO,
		},
		mirror: null,
		counts: { facultyCount: 3, sectionCount: 3, settingsReachable: true },
		conflicts: [], reconfiguredSections: [],
		canResetDummyYear: false, resetTargetSchoolYearId: null, conflictingRecordCounts: null,
		teachingLoadResetRequired: false, publishedResetBlocked: false,
		archivedYears: [], schoolYears: [],
		automation: { enabled: false, lastAttemptAt: null, lastResult: null, nextAttemptAt: null, consecutiveFailures: 0, currentlyApplying: false },
		termAuthority: {
			state: 'PERSISTED_CURRENT', code: null, message: 'The saved ordered terms match EnrollPro.',
			persisted: true, persistedSemanticRevision: 'r1', liveSemanticRevision: 'r1', cachedAt: ISO,
			termCount: 3, needsRepair: false, repairAction: 'NONE', canPreview: false,
		},
	};
}

type RecordedPut = { url: string; body: any };
let recordedPuts: RecordedPut[] = [];

function responseFor(url: string) {
	if (url.includes('/auth/me')) {
		return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'admin', authSource: 'local' } } };
	}
	if (url.includes('/runtime/context')) {
		return {
			data: {
				activeSchoolYearId: YEAR_ID,
				activeSchoolYearLabel: YEAR,
				activeTerm: {
					verified: true, termIndex: 1,
					orderedTerms: [
						{ order: 1, displayLabel: 'Term 1' },
						{ order: 2, displayLabel: 'Term 2' },
						{ order: 3, displayLabel: 'Term 3' },
					],
				},
			},
		};
	}
	if (url.includes('/runtime/rollover-status')) return { data: rolloverStatus() };
	if (url.includes('/faculty-assignments/summary')) return { data: teacherSummary() };
	if (url.includes('/faculty-assignments/authority-diagnostics')) return { data: null };
	if (url.includes('/sections/assigned-classes')) return { data: assignedIndex() };
	if (/\/sections\/summary\//.test(url)) {
		return {
			data: {
				schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, totalSections: 3, totalEnrolled: 120,
				byGradeLevel: { 7: 2, 9: 1 }, enrolledByGradeLevel: { 7: 80, 9: 40 },
				sections: [section(SECTION_A, 'Aguinaldo', 7), section(SECTION_B, 'Bonifacio', 8), section(SECTION_C, 'Mabini', 9)],
				gradeLevels: [{ gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, sections: [] }],
				source: 'enrollpro', contractWarnings: [], fetchedAt: ISO,
			},
		};
	}
	if (url.includes('/subjects')) return { data: { subjects: [subject(SUBJECT_MATH, 'MATH7', 'Mathematics 7'), subject(SUBJECT_SCI, 'SCI7', 'Science 7')] } };
	if (url.includes('/generation/')) return { data: { runs: [] } };
	return { data: {} };
}

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => responseFor(url),
		post: async (url: string) => responseFor(url),
		patch: async (url: string) => responseFor(url),
		put: async (url: string, body: any) => {
			recordedPuts.push({ url, body });
			return responseFor(url);
		},
		delete: async (url: string) => responseFor(url),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter, useSearchParams } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { setLocalToken } = await import('@/lib/auth');
const { default: TeachingLoad } = await import('@/pages/TeachingLoad');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
/** Rewrite the router URL from a test (the "later URL change" of X1). */
let rewriteUrl: ((next: URLSearchParams) => void) | null = null;

function UrlProbe() {
	const [, setSearchParams] = useSearchParams();
	rewriteUrl = (next: URLSearchParams) => setSearchParams(next, { replace: true });
	return null;
}

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	rewriteUrl = null;
}
afterEach(teardown);

async function flush() {
	for (let i = 0; i < 8; i += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

function reset() {
	recordedPuts = [];
	scrollCalls.length = 0;
	focusCalls.length = 0;
	dom.window.sessionStorage.clear();
	dom.window.localStorage.clear();
	setLocalToken('a6-tl-deeplink-token', false);
}

async function mount(entryUrl: string): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: [entryUrl] },
			createElement(
				TooltipProvider as any,
				{ delayDuration: 200 },
				createElement(TeachingLoad as any),
				createElement(UrlProbe as any),
			),
		));
	});
	await flush();
	return host;
}

function click(el: Element | null | undefined) {
	assert.ok(el, 'the control under test did not render');
	act(() => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function teacherRow(host: HTMLElement, id: number): HTMLElement | null {
	return host.querySelector(`#teaching-load-teacher-row-${id}`);
}
function sectionRow(host: HTMLElement, id: number): HTMLElement | null {
	return host.querySelector(`#teaching-load-section-row-${id}`);
}
/** The selected row is the one whose OUTER card carries the selected border. */
function isSelected(el: HTMLElement | null): boolean {
	return Boolean(el?.parentElement?.className.includes('border-primary/30'));
}
function focused(el: HTMLElement | null): boolean {
	return Boolean(el) && dom.window.document.activeElement === el;
}
function scrolled(el: HTMLElement | null): boolean {
	return Boolean(el) && scrollCalls.includes((el as HTMLElement).id);
}

// ── E1: a Sections deep link lands on the section ────────────────────────────
test('E1 ?sectionId=141 selects, scrolls and focuses the section row', async () => {
	reset();
	const host = await mount('/teaching-load?sectionId=141');
	const row = sectionRow(host, SECTION_A);
	assert.ok(row, 'E1: the section row did not render');
	assert.equal(host.querySelector('[data-testid="teaching-load-content-shell"]') != null, true, 'E1: the workspace rendered');
	const sectionRows = host.querySelectorAll('[data-testid="teaching-load-section-row"]');
	assert.ok(sectionRows.length > 0, 'E1: the coverage (sections) view is the active view');
	assert.ok(isSelected(row), 'E1: section 141 is selected (row expanded)');
	assert.ok(scrolled(row), `E1: section 141 was scrolled into view; scrolled=${JSON.stringify(scrollCalls)}`);
	assert.ok(focused(row), 'E1: section 141 is document.activeElement');
});

// ── E2: a teacher deep link lands on the teacher ─────────────────────────────
test('E2 ?facultyId=9 selects, scrolls and focuses the teacher row', async () => {
	reset();
	const host = await mount('/teaching-load?facultyId=9');
	const row = teacherRow(host, TEACHER_ENTRY);
	assert.ok(row, 'E2: the teacher row did not render');
	assert.ok(isSelected(row), 'E2: teacher 9 is selected');
	assert.ok(scrolled(row), `E2: teacher 9 was scrolled into view; scrolled=${JSON.stringify(scrollCalls)}`);
	assert.ok(focused(row), 'E2: teacher 9 is document.activeElement');
});

// ── E3: task=review is an Assign entry — the editor opens ────────────────────
test('E3 ?facultyId=9&task=review selects the teacher and opens the assign editor', async () => {
	reset();
	const host = await mount(`/teaching-load?facultyId=${TEACHER_ENTRY}&task=review`);
	const row = teacherRow(host, TEACHER_ENTRY);
	assert.ok(row && isSelected(row), 'E3: teacher 9 is selected');
	assert.ok(focused(row), 'E3: teacher 9 is focused');
	assert.ok(host.querySelector(`#teaching-load-assignment-editor-${TEACHER_ENTRY}`), 'E3: the assign editor for teacher 9 is open');
});

// ── E4: subjectId-only is no longer dropped ─────────────────────────────────
test('E4 ?subjectId=6 lands the coverage view on a section carrying the subject', async () => {
	reset();
	const host = await mount(`/teaching-load?subjectId=${SUBJECT_MATH}`);
	const grid = host.querySelector('[data-testid="teaching-load-content-shell"]');
	assert.ok(grid, 'E4: the workspace rendered');
	const carrying = Array.from(host.querySelectorAll<HTMLElement>('[id^="teaching-load-section-row-"]'))
		.filter((row) => (row.closest('[data-testid="teaching-load-section-row"]')?.getAttribute('data-subject-ids') ?? '').split(',').includes(String(SUBJECT_MATH)));
	assert.ok(carrying.length > 0, 'E4: the subject coverage view rendered the subject sections (was ignored at base)');
	const landed = carrying.find((row) => focused(row)) ?? null;
	assert.ok(landed, `E4: a section carrying subject 6 is focused; focusCalls=${JSON.stringify(focusCalls)}`);
	assert.ok(scrolled(landed), 'E4: and it was scrolled into view');
});

// ── E5: filter=missing-coverage is honoured ─────────────────────────────────
test('E5 filter=missing-coverage narrows the coverage view to the subject\'s uncovered sections', async () => {
	reset();
	const host = await mount(`/teaching-load?view=subjects&subjectId=${SUBJECT_MATH}&filter=missing-coverage`);
	const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-testid="teaching-load-section-row"]'));
	const ids = rows.map((row) => Number(row.getAttribute('data-section-id'))).sort((a, b) => a - b);
	// Subject 6 is covered in 141 and uncovered in 142; 143 does not carry it.
	assert.deepEqual(ids, [SECTION_B], `E5: only the uncovered section for subject 6 must render; saw ${JSON.stringify(ids)}`);
});

// ── E6: Class Schedule blocker — the class's teacher (and its editor) ────────
test('E6 ?facultyId=15&sectionId=142&subjectId=6&task=missing-load lands the teacher and opens the editor', async () => {
	reset();
	const host = await mount(`/teaching-load?facultyId=${TEACHER_NO_LOAD}&sectionId=${SECTION_B}&subjectId=${SUBJECT_MATH}&task=missing-load`);
	const row = teacherRow(host, TEACHER_NO_LOAD);
	assert.ok(row, 'E6: the teacher row did not render');
	assert.ok(isSelected(row), 'E6: the named (no-load) teacher is selected');
	assert.ok(focused(row), 'E6: the named teacher is focused');
	assert.ok(host.querySelector(`#teaching-load-assignment-editor-${TEACHER_NO_LOAD}`), 'E6: the assign editor for that teacher is open');
	assert.ok(host.querySelector(`#subject-${SUBJECT_MATH}`), 'E6: the named subject is in view inside the opened editor');
});

// ── E7: change-owner keeps the class and lands its own teacher ───────────────
test('E7 ?facultyId=9&sectionId=141&subjectId=6&task=change-owner lands its own teacher', async () => {
	reset();
	const host = await mount(`/teaching-load?facultyId=${TEACHER_ENTRY}&sectionId=${SECTION_A}&subjectId=${SUBJECT_MATH}&task=change-owner`);
	const row = teacherRow(host, TEACHER_ENTRY);
	assert.ok(row, 'E7: the class\'s own teacher row did not render');
	assert.ok(isSelected(row), 'E7: the class\'s own teacher is selected');
	assert.ok(focused(row), 'E7: and focused — the preserved change-owner intent still lands');
});

// ── E8: Audit findings — each named target is reached ───────────────────────
test('E8 Audit URLs (?facultyId&subjectId, ?subjectId, ?facultyId, ?sectionId&subjectId) each reach their target', async () => {
	const cases: Array<{ url: string; check: (host: HTMLElement) => boolean; label: string }> = [
		{ url: `/teaching-load?facultyId=${TEACHER_ENTRY}&subjectId=${SUBJECT_MATH}`, label: 'faculty+subject', check: (h) => focused(teacherRow(h, TEACHER_ENTRY)) },
		{ url: `/teaching-load?subjectId=${SUBJECT_MATH}`, label: 'subject', check: (h) => Array.from(h.querySelectorAll<HTMLElement>('[id^="teaching-load-section-row-"]')).some((r) => focused(r)) },
		{ url: `/teaching-load?facultyId=${TEACHER_ENTRY}`, label: 'faculty', check: (h) => focused(teacherRow(h, TEACHER_ENTRY)) },
		{ url: `/teaching-load?sectionId=${SECTION_A}&subjectId=${SUBJECT_MATH}`, label: 'section+subject', check: (h) => focused(sectionRow(h, SECTION_A)) },
	];
	for (const entry of cases) {
		reset();
		const host = await mount(entry.url);
		assert.equal(entry.check(host), true, `E8 (${entry.label}): ${entry.url} must land on its named target`);
		teardown();
	}
});

// ── E9: the in-page repair queue uses the SAME landing mechanism ─────────────
test('E9 the repair-queue Assign button selects, scrolls, focuses and opens the editor', async () => {
	reset();
	const host = await mount('/teaching-load');
	// The queue's one primary action for the no-load teacher.
	const primary = host.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLElement | null;
	assert.ok(primary, 'E9: the repair queue primary action did not render');
	assert.match(primary!.getAttribute('aria-label') ?? '', /Assign teaching load/, 'E9: precondition — the current repair item is the Assign entry');
	click(primary);
	await flush();
	const row = teacherRow(host, TEACHER_NO_LOAD);
	assert.ok(row, 'E9: the repaired teacher row did not render');
	assert.ok(isSelected(row), 'E9: the repaired teacher is selected');
	assert.ok(scrolled(row), 'E9: the repaired teacher was scrolled into view');
	assert.ok(focused(row), 'E9: the repaired teacher is focused');
	assert.ok(host.querySelector(`#teaching-load-assignment-editor-${TEACHER_NO_LOAD}`), 'E9: the Assign editor is open');
});

// ── X1: the URL intent is CONSUMED ──────────────────────────────────────────
test('X1 after E2 arrives, selecting another teacher is never overridden by the entry target across a render and a URL rewrite', async () => {
	reset();
	const host = await mount(`/teaching-load?facultyId=${TEACHER_ENTRY}`);
	assert.ok(isSelected(teacherRow(host, TEACHER_ENTRY)), 'X1: precondition — the entry target landed');

	// The operator edits ANOTHER teacher: the explicit `Edit assignments` control
	// selects it without opening the read-only profile.
	const otherRow = teacherRow(host, TEACHER_OTHER);
	assert.ok(otherRow, 'X1: the other teacher row did not render');
	click(otherRow!.closest('div')?.querySelector('[data-testid="teaching-load-edit-assignments"]'));
	await flush();
	assert.ok(isSelected(teacherRow(host, TEACHER_OTHER)), 'X1: the operator selected teacher 12');

	// A later render…
	await flush();
	assert.ok(isSelected(teacherRow(host, TEACHER_OTHER)), 'X1: a later render did not re-apply the entry target');

	// …and a URL rewrite back to the entry URL must NOT re-apply the entry target.
	assert.ok(rewriteUrl, 'X1: the URL rewriter is mounted');
	act(() => { rewriteUrl!(new URLSearchParams({ facultyId: String(TEACHER_ENTRY) })); });
	await flush();
	assert.ok(isSelected(teacherRow(host, TEACHER_OTHER)), 'X1: a URL rewrite did not re-apply the consumed entry target');
	assert.equal(isSelected(teacherRow(host, TEACHER_ENTRY)), false, 'X1: the entry target did not hijack the operator selection');
});

// ── X2: edit-another-then-save PUTs the teacher actually edited ─────────────
test('X2 arriving at facultyId=9, editing teacher 12 and saving issues PUT /faculty-assignments/12', async () => {
	reset();
	const host = await mount(`/teaching-load?facultyId=${TEACHER_ENTRY}`);
	const otherRow = teacherRow(host, TEACHER_OTHER);
	assert.ok(otherRow, 'X2: teacher 12 row did not render');
	click(otherRow!.closest('div')?.querySelector('[data-testid="teaching-load-edit-assignments"]'));
	await flush();
	const editor = host.querySelector(`#teaching-load-assignment-editor-${TEACHER_OTHER}`);
	assert.ok(editor, 'X2: the editor for teacher 12 opened');

	// Create a real draft for teacher 12: assign the uncovered MATH7 section 142.
	const unassignedCell = Array.from(editor!.querySelectorAll<HTMLElement>('[role="button"][aria-label]'))
		.find((el) => (el.getAttribute('aria-label') ?? '').includes('Bonifacio - not assigned'));
	assert.ok(unassignedCell, 'X2: the uncovered section cell did not render in teacher 12\'s editor');
	click(unassignedCell);
	await flush();

	// Save changes -> confirmation -> confirm.
	const save = Array.from(host.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === 'Save changes');
	assert.ok(save, 'X2: the Save changes control did not render');
	click(save);
	await flush();
	const confirm = Array.from(dom.window.document.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === 'Confirm & Save');
	assert.ok(confirm, 'X2: the confirmation did not render');
	click(confirm);
	await flush();

	const put = recordedPuts.find((entry) => entry.url.includes('/faculty-assignments/'));
	assert.ok(put, `X2: no faculty-assignment PUT was issued; saw ${JSON.stringify(recordedPuts.map((p) => p.url))}`);
	assert.equal(put!.url, '/faculty-assignments/12', `X2: the PUT must target the teacher actually edited; got ${put!.url}`);
	assert.equal(put!.url.includes('/faculty-assignments/9'), false, 'X2: the entry target did not hijack the save');
	assert.equal(put!.body.facultyId, TEACHER_OTHER, 'X2: the PUT body names teacher 12');
	assert.ok(
		put!.body.assignments.some((a: any) => a.subjectId === SUBJECT_MATH && a.sectionIds.includes(SECTION_B)),
		`X2: the edit (subject 6 -> section 142) is carried in the PUT; got ${JSON.stringify(put!.body.assignments)}`,
	);
});
