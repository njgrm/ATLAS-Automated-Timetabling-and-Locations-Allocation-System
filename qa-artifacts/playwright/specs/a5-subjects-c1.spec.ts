import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

/**
 * A5 / `a5-subjects-c1` — ISOLATED rendered-UI evidence for operator items
 * 34, 35, 9.1, 41 and 17.1.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISOLATED — NOT ATLAS ACCEPTANCE (AGENTS.md §12).
 * These rows run against a **loopback preview of this candidate's own built
 * client** at `http://127.0.0.1:5203` (see `playwright.a5-subjects.config.ts`),
 * with **every `/api/v1/**` request mocked in-process**. Nothing here reaches
 * the live runtime, the shared 5001/5174 listeners, or a database. The ATLAS
 * origin is `https://njgrm.buru-degree.ts.net`; a loopback origin is a
 * different origin and asserting it proves nothing about ATLAS acceptance. The
 * session is seeded with a FAKE token through `addInitScript` — no credential
 * is typed, echoed, or logged.
 *
 * WHY THIS SPEC EXISTS: the jsdom suite (`a5-subjects-c1.test.tsx`) proved
 * *structure* — where the bubble is mounted, which classes and props are set.
 * jsdom has **no layout engine and no paint**, so it could not prove the two
 * things the operator actually complained about: that the tooltip is **not
 * clipped** by the table's scroll box, and that it is **legible** (dark
 * background, white text). It equally could not prove the filter row is
 * genuinely ONE row, nor that a resize grip actually resizes and stays
 * centred. Every assertion below is a rendered one — real hover, real mouse
 * drag, `getComputedStyle`, `getBoundingClientRect`, `elementFromPoint`,
 * pairwise rectangle intersection.
 *
 * NO WRITES: any `POST`/`PUT`/`PATCH`/`DELETE` to `/api/v1/**` is fulfilled
 * with `500 UNEXPECTED_MUTATION` and recorded, and the final row asserts the
 * recorded list is empty. The browser never attempts a write.
 */

// ───────────────────────────────── fixtures ─────────────────────────────────

type SubjectFixture = Record<string, unknown>;

function subjectFixture(overrides: SubjectFixture): SubjectFixture {
	return {
		id: 41,
		schoolId: 1,
		code: 'SCI10',
		displayCode: 'SCI10',
		outputLabel: null,
		name: 'Earth Science',
		ownerDepartment: 'SCI',
		allowedOwnerDepartments: [],
		qualificationPriority: 'DEPARTMENT_FIRST',
		schedulingDisposition: 'SCHEDULED_TEACHING',
		specializationSource: 'NONE',
		rotationFamily: null,
		rotationTermRank: null,
		rotationTermLabel: null,
		rotationTermGroupId: null,
		rotationTermCount: null,
		modularGroupId: null,
		modularOrder: null,
		termGroupId: null,
		termCount: null,
		programType: 'REGULAR',
		minMinutesPerWeek: 225,
		preferredRoomType: 'CLASSROOM',
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		interSectionEnabled: false,
		interSectionGradeLevels: [],
		programScopes: ['REGULAR'],
		allowedSpecializations: [],
		requiredFeatures: [],
		createdAt: '2026-09-01T00:00:00.000Z',
		updatedAt: '2026-09-27T00:00:00.000Z',
		...overrides,
	};
}

const SUBJECTS = [
	// Room-constrained (LABORATORY) AND missing coverage — exercises both axes
	// of the merged `All Status` dropdown.
	subjectFixture({ id: 41, code: 'SCI10', name: 'Earth Science', gradeLevels: [9, 10], preferredRoomType: 'LABORATORY' }),
	// Fully covered, plain classroom, grade 7-8.
	subjectFixture({ id: 42, code: 'FIL10', name: 'Filipino', gradeLevels: [7, 8], ownerDepartment: 'FIL' }),
	// STE program, zero coverage, grade 9 only.
	subjectFixture({ id: 43, code: 'ESP10', name: 'Espanol', gradeLevels: [9], programType: 'STE', programScopes: ['REGULAR', 'STE'], ownerDepartment: 'ESP' }),
	// Archived — the row `Active` must remove.
	subjectFixture({ id: 44, code: 'OLD10', name: 'Legacy Araling', gradeLevels: [7], isActive: false, ownerDepartment: 'FIL' }),
];

function section(id: number, name: string, grade: number) {
	return {
		id,
		name,
		gradeLevel: grade,
		gradeLevelId: grade,
		gradeLevelName: `Grade ${grade}`,
		displayOrder: grade,
		maxCapacity: 40,
		enrolledCount: 30,
		programType: 'REGULAR',
	};
}

function teacher(id: number, lastName: string, firstName: string, loadPercentage: number, sections: ReturnType<typeof section>[]) {
	return {
		id,
		externalId: 7000 + id,
		employeeId: null,
		lastName,
		firstName,
		department: 'SCI',
		specialization: null,
		employmentStatus: 'REGULAR',
		isActiveForScheduling: true,
		isPlaceholder: false,
		isClassAdviser: false,
		advisedSectionId: null,
		advisedSectionName: null,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: 0,
		canTeachOutsideDepartment: false,
		maxHoursPerWeek: 40,
		departmentCode: 'SCI',
		departmentLabel: 'Science',
		departmentStatus: 'MAPPED',
		version: 1,
		subjectCount: 1,
		sectionCount: sections.length,
		assignedGradeLevels: [...new Set(sections.map((s) => s.gradeLevel))],
		subjectHours: 4,
		sectionTeachingHours: 4,
		gradeTeachingHours: 4,
		advisoryHours: 0,
		ancillaryHours: 0,
		policyCreditedHours: 4,
		policyLoadPercentage: loadPercentage,
		loadPercentage,
		actualTeachingHours: 4,
		teachingUtilizationPercent: loadPercentage,
		teachingCapacityRemainingMinutes: 600,
		excessTeachingMinutes: null,
		creditedWorkloadMinutes: 240,
		syntheticCoverageHours: 0,
		loadSignalMode: 'STANDARD',
		// The assignment the coverage dialog reads.
		assignments: [
			{
				id: 900 + id,
				subjectId: 41,
				gradeLevels: [...new Set(sections.map((s) => s.gradeLevel))],
				sectionIds: sections.map((s) => s.id),
				assignmentKind: 'REAL_OWNERSHIP',
				sections,
				subject: {
					id: 41,
					name: 'Earth Science',
					code: 'SCI10',
					minMinutesPerWeek: 225,
					rotationFamily: null,
					rotationTermRank: null,
					rotationTermLabel: null,
					programType: 'REGULAR',
				},
			},
		],
	};
}

/** Three assigned teachers whose sections span GR7, GR9 and GR10. */
const FACULTY = [
	teacher(7, 'FERNANDEZ', 'JANELLA MARIE', 79, [section(1, 'Bonifacio', 9)]),
	teacher(8, 'SANTOS', 'MIGUEL', 55, [section(2, 'Luna', 7), section(3, 'Rizal', 7)]),
	teacher(9, 'REYES', 'ANA', 91, [section(4, 'Tulip', 9), section(5, 'Gold', 10), section(6, 'Silver', 10)]),
];

const COVERAGE_SUMMARY = {
	rows: [
		{
			subjectId: 41,
			subjectCode: 'SCI10',
			subjectName: 'Earth Science',
			isActive: true,
			relevantSectionCount: 6,
			ownedSectionCount: 6,
			ownedByPlaceholderCount: 0,
			ownedByRealFacultyCount: 3,
			// > 0 is what the `Missing teacher coverage` axis filters on.
			uncoveredSectionCount: 1,
			uncoveredSections: [{ sectionId: 99, sectionName: 'Mabini', gradeLevel: 9, programType: 'REGULAR' }],
			coveragePercent: 83,
			status: 'PARTIAL',
			placeholderFacultyIds: [],
		},
		{
			subjectId: 42,
			subjectCode: 'FIL10',
			subjectName: 'Filipino',
			isActive: true,
			relevantSectionCount: 2,
			ownedSectionCount: 2,
			ownedByPlaceholderCount: 0,
			ownedByRealFacultyCount: 1,
			uncoveredSectionCount: 0,
			uncoveredSections: [],
			coveragePercent: 100,
			status: 'FULL',
			placeholderFacultyIds: [],
		},
		{
			subjectId: 43,
			subjectCode: 'ESP10',
			subjectName: 'Espanol',
			isActive: true,
			relevantSectionCount: 2,
			ownedSectionCount: 0,
			ownedByPlaceholderCount: 0,
			ownedByRealFacultyCount: 0,
			uncoveredSectionCount: 2,
			uncoveredSections: [
				{ sectionId: 21, sectionName: 'Sampaguita', gradeLevel: 9, programType: 'STE' },
				{ sectionId: 22, sectionName: 'Narra', gradeLevel: 9, programType: 'STE' },
			],
			coveragePercent: 0,
			status: 'ZERO',
			placeholderFacultyIds: [],
		},
		{
			subjectId: 44,
			subjectCode: 'OLD10',
			subjectName: 'Legacy Arling',
			isActive: false,
			relevantSectionCount: 1,
			ownedSectionCount: 0,
			ownedByPlaceholderCount: 0,
			ownedByRealFacultyCount: 0,
			uncoveredSectionCount: 1,
			uncoveredSections: [{ sectionId: 31, sectionName: 'Legacy', gradeLevel: 7, programType: 'REGULAR' }],
			coveragePercent: 0,
			status: 'ZERO',
			placeholderFacultyIds: [],
		},
	],
	zeroCoverageSubjectCodes: ['ESP10'],
	partiallyCoveredSubjectCodes: ['SCI10'],
	fullyCoveredSubjectCodes: ['FIL10'],
};

const AUTH_USER = { user: { userId: 1, role: 'officer', schoolId: 1, email: 'a5@atlas.local', authSource: 'local' } };

/** The real `EnrollProSettings` shape (`atlas-client/src/lib/settings.ts:93`). */
const ENROLLPRO_SETTINGS = {
	schoolName: 'ATLAS A5 School',
	logoUrl: null,
	colorScheme: null,
	selectedAccentHsl: null,
	activeSchoolYearId: 9,
	activeSchoolYearLabel: '2026-2027',
};

const RUNTIME_CONTEXT = {
	schoolId: 1,
	activeSchoolYearId: 9,
	activeSchoolYearLabel: '2026-2027',
	source: 'enrollpro-verified',
	stale: false,
	resolvedAt: '2026-09-27T00:00:00.000Z',
	evidence: [],
	upstream: { reachable: true, verified: true, matched: true, activeSchoolYearId: 9, activeSchoolYearLabel: '2026-2027' },
};

/** VERIFIED_LIVE, so the routine banner renders nothing (A3-C10 / item 9.1(1)). */
const TERM_AUTHORITY = {
	state: 'VERIFIED_LIVE',
	source: 'enrollpro',
	degraded: false,
	code: null,
	message: null,
	contract: {
		format: 'TRIMESTER',
		schoolYear: { yearLabel: '2026-2027' },
		terms: [
			{ identity: 'T1', displayLabel: 'Term 1' },
			{ identity: 'T2', displayLabel: 'Term 2' },
			{ identity: 'T3', displayLabel: 'Term 3' },
		],
		activeTerm: { identity: 'T1' },
	},
};

/** Every write the page attempted, in order. Must stay empty. */
const attemptedMutations: string[] = [];

/**
 * Every `/api/v1/**` or `/enrollpro-api/**` request that reached the catch-all
 * but had no explicit fixture, i.e. was answered with a bare `{}`.
 *
 * This exists because a request that escapes every mock does not fail these
 * rows: it is answered `{}`, the component shrugs, and the row still passes —
 * which is how a "the green strip is gone" row can go green because the
 * EnrollPro settings fetch FAILED rather than because terms are verified. Every
 * unmocked request is therefore recorded here and asserted empty at the end, so
 * the isolation claim is measured rather than assumed.
 */
const unmockedRequests: string[] = [];

async function installMocks(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.sessionStorage.setItem('atlas_local_token', 'a5-isolated-fake-token');
		window.localStorage.setItem(
			'atlas:session-user:v1',
			JSON.stringify({
				cachedAt: new Date().toISOString(),
				user: { userId: 1, role: 'officer', schoolId: 1, email: 'a5@atlas.local', authSource: 'local' },
			}),
		);
	});

	await page.route(/\/api\/settings\/public/, async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ schoolName: 'ATLAS A5 School', colorScheme: null, selectedAccentHsl: null }),
		});
	});

	// EnrollPro's OWN origin is a different proxy path (`/enrollpro-api/**`), not
	// `/api/v1/**`. It is mocked from the real shapes in `lib/settings.ts` so the
	// client shell boots in its normal, healthy state: an unmocked request here
	// would reach the vite proxy and be refused by 127.0.0.1:5000, which is an
	// escape from the isolation these rows claim.
	await page.route(/\/enrollpro-api\//, async (route: Route) => {
		const url = route.request().url();
		const path = url.replace(/^https?:\/\/[^/]+/, '');
		if (path.startsWith('/enrollpro-api/settings/public')) {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ENROLLPRO_SETTINGS) });
			return;
		}
		if (path.startsWith('/enrollpro-api/school-years')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ years: [{ id: 9, yearLabel: '2026-2027', status: 'ACTIVE', isActive: true }], schoolYears: [{ id: 9, yearLabel: '2026-2027', status: 'ACTIVE', isActive: true }] }),
			});
			return;
		}
		unmockedRequests.push(`GET ${path}`);
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
	});

	await page.route(/\/api\/v1\//, async (route: Route) => {
		const request = route.request();
		const url = request.url();
		const method = request.method().toUpperCase();
		if (method === 'OPTIONS') {
			await route.fulfill({
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-headers': '*',
					'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
				},
			});
			return;
		}
		// NO WRITES. Loud, recorded, and impossible to miss.
		if (method !== 'GET' && method !== 'HEAD') {
			attemptedMutations.push(`${method} ${url}`);
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ code: 'UNEXPECTED_MUTATION', message: `The A5 UI attempted a write: ${method} ${url}` }),
			});
			return;
		}

		const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

		if (url.includes('/auth/me')) return json(AUTH_USER);
		if (url.includes('/runtime/context')) return json(RUNTIME_CONTEXT);
		if (url.includes('/runtime/rollover-status')) {
			return json({
				schoolId: 1,
				atlasSchoolYearId: 9,
				enrollProActiveYear: { id: 9, yearLabel: '2026-2027' },
				drift: {
					status: 'aligned',
					message: 'Aligned with EnrollPro.',
					recommendedAction: 'NONE',
					atlasSchoolYearId: 9,
					enrollProSchoolYearId: 9,
					enrollProSchoolYearLabel: '2026-2027',
					mirrorSyncedAt: '2026-09-01T00:00:00.000Z',
				},
				mirror: null,
				counts: { facultyCount: 3, sectionCount: 6, settingsReachable: true },
				conflicts: [],
				reconfiguredSections: [],
				automation: null,
				canResetDummyYear: false,
				resetTargetSchoolYearId: null,
				conflictingRecordCounts: null,
				teachingLoadResetRequired: false,
				publishedResetBlocked: false,
				archivedYears: [],
			});
		}
		if (url.includes('/subjects/scheduling-authority')) {
			return json({ subjects: SUBJECTS, termAuthority: TERM_AUTHORITY });
		}
		if (url.includes('/subjects')) return json({ subjects: SUBJECTS });
		if (url.includes('/faculty-assignments/coverage/summary')) return json(COVERAGE_SUMMARY);
		// App-shell chrome the subject and faculty pages also mount. These are
		// unrelated to the rows under test, but they are still FIXTURED rather
		// than absorbed by the `{}` catch-all: an absorbed request is exactly
		// how a component can be green in a degraded state it never meets in
		// production. Shapes are taken from `useNotificationInbox.ts:116`,
		// `useNotificationStream.ts:201` and `FacultyRow.tsx:276`.
		if (url.includes('/notification-inbox/unread-count')) return json({ count: 0 });
		if (url.includes('/notification-inbox/')) return json({ items: [] });
		if (/\/notifications\/[^/]+\/(\d+\/)?events/.test(url)) {
			// An SSE stream. Closed immediately with no events, which is the
			// shape a scheduler with no live events sees.
			await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
			return;
		}
		if (url.includes('/faculty/grade-preferences')) return json({ preferences: [] });
		if (url.includes('/faculty-assignments/summary')) {
			return json({
				faculty: FACULTY,
				items: FACULTY,
				page: 1,
				pageSize: 25,
				total: FACULTY.length,
				totalPages: 1,
				departments: [],
				rosterStats: {
					totalCount: FACULTY.length,
					activeCount: FACULTY.length,
					assignedCount: FACULTY.length,
					unassignedCount: 0,
					overCapCount: 1,
				},
				fetchedAt: '2026-09-27T00:00:00.000Z',
			});
		}
		// An un-fixtured request is RECORDED, not silently absorbed. Answering a
		// bare `{}` lets a component shrug and the row still pass, so the
		// isolation claim is only honest if this list is empty at the end.
		unmockedRequests.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
		return json({});
	});
}

test.beforeEach(async ({ page }) => {
	await installMocks(page);
});

// ─────────────────────────── rendered measurements ───────────────────────────

type Box = { x: number; y: number; width: number; height: number; top: number; left: number; right: number; bottom: number };
type BubbleReading = {
	text: string;
	backgroundColor: string;
	color: string;
	zIndex: string;
	box: Box;
	/** Centre hit-test with the bubble temporarily made hit-testable. */
	hitTestInsideBubble: boolean;
	hitTestElement: string;
	/** The same hit-test at a point 2px inside the bubble's top-left corner —
	 *  the exact region the operator saw cut off. */
	cornerHitTestInsideBubble: boolean;
	/** Is EVERY pixel of the bubble inside the region its clipping ancestors
	 *  actually paint? False means part of the box is cut away. */
	fullyInsideClipRegion: boolean;
	clipRegion: Box;
	insideScrollContainer: boolean;
	insideTable: boolean;
	clippedAncestorClass: string | null;
	visible: boolean;
};

const OVERFLOW_CLIPPING = /^(hidden|auto|scroll|clip)$/;

async function readBubble(page: Page): Promise<BubbleReading> {
	return page.evaluate((overflowRe) => {
		const clipping = new RegExp(overflowRe);
		// Radix renders a visually hidden `role="tooltip"` accessibility span
		// INSIDE the styled bubble; the bubble is its parent.
		const hidden = Array.from(document.querySelectorAll('[role="tooltip"]')).find((el) => (el as HTMLElement).style.clip);
		const bubble = (hidden?.parentElement ?? null) as HTMLElement | null;
		if (!bubble) {
			return {
				text: '', backgroundColor: '', color: '', zIndex: '',
				box: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
				hitTestInsideBubble: false, hitTestElement: '', cornerHitTestInsideBubble: false,
				fullyInsideClipRegion: false,
				clipRegion: { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
				insideScrollContainer: false,
				insideTable: false, clippedAncestorClass: null, visible: false,
			};
		}
		const style = getComputedStyle(bubble);
		const rect = bubble.getBoundingClientRect();
		const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };

		// The table's scroll container: the nearest ancestor of the table whose
		// COMPUTED overflow actually clips. This is `AdminTableShell`'s
		// `flex-1 min-h-0 overflow-auto` box, discovered rather than assumed.
		const table = bubble.closest('table') ?? document.querySelector('table');
		let scrollContainer: Element | null = null;
		if (table) {
			let cursor: Element | null = table.parentElement;
			while (cursor) {
				const overflowY = getComputedStyle(cursor).overflowY;
				if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
					scrollContainer = cursor;
					break;
				}
				cursor = cursor.parentElement;
			}
		}

		// Any ancestor that can clip, between the bubble and `document.body`,
		// and the region those ancestors actually PAINT (their boxes,
		// intersected). A bubble whose box leaves that region is cut off.
		let clippedAncestorClass: string | null = null;
		let clip = { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
		let cursor: Element | null = bubble.parentElement;
		while (cursor && cursor !== document.body) {
			const s = getComputedStyle(cursor);
			if (clipping.test(s.overflowY) || clipping.test(s.overflowX)) {
				if (clippedAncestorClass === null) clippedAncestorClass = cursor.className || cursor.tagName;
				const r = cursor.getBoundingClientRect();
				clip = {
					top: Math.max(clip.top, r.top),
					left: Math.max(clip.left, r.left),
					right: Math.min(clip.right, r.right),
					bottom: Math.min(clip.bottom, r.bottom),
				};
			}
			cursor = cursor.parentElement;
		}
		const fullyInsideClipRegion =
			rect.top >= clip.top - 0.5 && rect.left >= clip.left - 0.5 && rect.right <= clip.right + 0.5 && rect.bottom <= clip.bottom + 0.5;

		// THE PAINT PROOF. The shipped bubble is `pointer-events-none` BY
		// DESIGN (a tooltip must not eat clicks), and a pointer-events-none
		// element is skipped by hit testing entirely — so a hit test against it
		// would ALWAYS return the element underneath and would prove nothing.
		// The probe therefore enables hit testing on the bubble for the
		// duration of the measurement and restores the inline style afterwards.
		// The geometry being measured — the box, the clip region, the paint
		// order — is identical either way; only the hit-testability changes.
		const previousPointerEvents = bubble.style.pointerEvents;
		bubble.style.pointerEvents = 'auto';
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const hit = document.elementFromPoint(cx, cy);
		// The corner nearest the top-left — the exact region the operator
		// reported as "cut in half" by the container's top boundary.
		const cornerX = rect.left + 2;
		const cornerY = rect.top + 2;
		const cornerHit = document.elementFromPoint(cornerX, cornerY);
		bubble.style.pointerEvents = previousPointerEvents;

		const rawText = (bubble.textContent ?? '').trim();
		const visibleSpan = Array.from(bubble.childNodes)
			.filter((n) => !(n instanceof HTMLElement && (n as HTMLElement).style.clip))
			.map((n) => n.textContent ?? '')
			.join('')
			.trim();

		return {
			text: visibleSpan || rawText,
			backgroundColor: style.backgroundColor,
			color: style.color,
			zIndex: style.zIndex,
			box,
			hitTestInsideBubble: Boolean(hit && (hit === bubble || bubble.contains(hit))),
			hitTestElement: hit ? `${hit.tagName.toLowerCase()}.${(hit.className || '').toString().split(' ')[0]}` : 'none',
			cornerHitTestInsideBubble: Boolean(cornerHit && (cornerHit === bubble || bubble.contains(cornerHit))),
			fullyInsideClipRegion,
			clipRegion: { x: clip.left, y: clip.top, width: clip.right - clip.left, height: clip.bottom - clip.top, top: clip.top, left: clip.left, right: clip.right, bottom: clip.bottom },
			insideScrollContainer: Boolean(scrollContainer && scrollContainer.contains(bubble)),
			insideTable: Boolean(bubble.closest('table')),
			clippedAncestorClass,
			visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0',
		};
	}, OVERFLOW_CLIPPING.source);
}

/** Relative luminance of a computed `rgb()`/`rgba()` colour, 0 = black. */
function parseRgb(value: string): { r: number; g: number; b: number; a: number } {
	const nums = value.match(/[\d.]+/g)?.map(Number) ?? [];
	if (value.startsWith('color(')) {
		// `color(srgb r g b / a)` — channels are 0..1 there.
		return { r: (nums[0] ?? 0) * 255, g: (nums[1] ?? 0) * 255, b: (nums[2] ?? 0) * 255, a: nums[3] ?? 1 };
	}
	return { r: nums[0] ?? 0, g: nums[1] ?? 0, b: nums[2] ?? 0, a: nums.length > 3 ? nums[3] : 1 };
}

function luminance(value: string): number {
	const { r, g, b } = parseRgb(value);
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Open a sortable column header's tooltip with a REAL hover, and read it. */
async function hoverHeaderAndRead(page: Page, trigger: Locator): Promise<BubbleReading> {
	await trigger.scrollIntoViewIfNeeded();
	await trigger.hover();
	await expect(page.locator('[role="tooltip"]').first()).toBeAttached();
	await page.waitForFunction(() => {
		const hidden = Array.from(document.querySelectorAll('[role="tooltip"]')).find((el) => (el as HTMLElement).style.clip);
		return Boolean(hidden?.parentElement);
	});
	return readBubble(page);
}

async function gotoSubjects(page: Page): Promise<void> {
	await page.goto('/subjects');
	await expect(page.getByPlaceholder('Search name or code...')).toBeVisible();
	// Readiness is the DESKTOP table, not any text: the mobile card view
	// renders the same subject names but is `md:hidden`, so a text match can
	// resolve to a hidden node and report a false "no data".
	// The Subjects sortable columns are `name` / `gradeLevels` /
	// `minMinutesPerWeek` / `preferredRoomType`; `name` is the first of them.
	await expect(page.locator('th[data-sort-field="name"]')).toBeVisible();
	await expect(page.locator('table tbody tr').first()).toBeVisible();
}

// ──────────────────────────────── item 34 ────────────────────────────────────

test('A5-34 RENDERED: the /subjects sortable header tooltip is dark, legible, unclipped, and paints above the table', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await gotoSubjects(page);

	// The Subjects table's own sortable header (`Code`), hovered for real.
	const trigger = page.locator('th[data-sort-field="name"] button');
	await expect(trigger).toBeVisible();
	const bubble = await hoverHeaderAndRead(page, trigger);

	// (2) LEGIBLE — COMPUTED colours, not class names. Before the fix this was a
	// `bg-popover text-popover-foreground` white pill on a white card.
	expect(luminance(bubble.backgroundColor), `background ${bubble.backgroundColor} is not dark`).toBeLessThan(0.3);
	expect(luminance(bubble.color), `text colour ${bubble.color} is not light`).toBeGreaterThan(0.8);
	// PARITY WITH THE DESIGN SYSTEM'S OWN TOKENS, resolved by this browser.
	// Comparing against a hard-coded `rgb(15 23 42)` would be a guess about the
	// Tailwind version; asking the page what `bg-slate-900` and `text-white`
	// actually paint is the operator's "the application's standard dark tooltip
	// style" stated as a measurement.
	const tokens = await page.evaluate(() => {
		const probe = document.createElement('div');
		document.body.appendChild(probe);
		const read = (cls: string) => {
			probe.className = cls;
			const s = getComputedStyle(probe);
			return { background: s.backgroundColor, color: s.color };
		};
		const slate900 = read('bg-slate-900');
		const white = read('text-white');
		probe.remove();
		return { slate900, white };
	});
	expect(bubble.backgroundColor, `the bubble background is ${bubble.backgroundColor}, not the app's slate-900 (${tokens.slate900.background})`).toBe(tokens.slate900.background);
	expect(bubble.color, `the bubble text is ${bubble.color}, not white (${tokens.white.color})`).toBe(tokens.white.color);

	// (3) Explicit elevation.
	expect(bubble.zIndex).toBe('50');

	// (4) NOT CLIPPED — the operator's "the top boundary cuts the bubble in half".
	// The structural half: the bubble is not a descendant of the table's own
	// scroll container, and nothing between it and `document.body` can clip.
	expect(bubble.insideScrollContainer, 'the bubble is inside the table scroll container, so the container clips it').toBe(false);
	expect(bubble.insideTable, 'the bubble is still inside the table').toBe(false);
	expect(bubble.clippedAncestorClass, `a clipping ancestor still sits above the bubble: ${bubble.clippedAncestorClass}`).toBeNull();
	// The paint half — the one that actually falsifies "clipped": the topmost
	// element at the bubble's own centre IS the bubble.
	expect(bubble.fullyInsideClipRegion, `the bubble box ${JSON.stringify(bubble.box)} leaves the painted region ${JSON.stringify(bubble.clipRegion)} — part of it is cut off`).toBe(true);
	expect(bubble.hitTestInsideBubble, `elementFromPoint at the bubble centre returned ${bubble.hitTestElement} — the bubble is painted over or clipped away`).toBe(true);
	expect(bubble.cornerHitTestInsideBubble, 'the bubble top-left corner is not painted — this is the "cut in half" the operator reported').toBe(true);
	// It has real size and sits inside the viewport.
	expect(bubble.box.width).toBeGreaterThan(20);
	expect(bubble.box.height).toBeGreaterThan(10);
	expect(bubble.box.top).toBeGreaterThanOrEqual(0);
	expect(bubble.box.left).toBeGreaterThanOrEqual(0);
	expect(bubble.box.right).toBeLessThanOrEqual(1366);
	expect(bubble.box.bottom).toBeLessThanOrEqual(768);
	expect(bubble.visible).toBe(true);

	// (5) The visible text names the column and the sort action.
	expect(bubble.text).toContain('Subject');
	expect(bubble.text.toLowerCase()).toContain('sort');

	// The active-sort state shows the action, not just the column.
	const codeHeader = page.locator('th[data-sort-field="name"] button');
	await page.mouse.move(10, 10);
	await expect(page.locator('[role="tooltip"]').first()).toBeHidden();
	await codeHeader.click();
	const active = await hoverHeaderAndRead(page, page.locator('th[data-sort-field="name"] button'));
	expect(active.text).toMatch(/Sort ascending by Subject/);
	expect(active.hitTestInsideBubble).toBe(true);
	expect(active.fullyInsideClipRegion).toBe(true);
	expect(active.zIndex).toBe('50');
});

// ──────────────────────────────── item 35 ────────────────────────────────────

test('A5-35 RENDERED: the /teachers table header tooltip is dark and unclipped too — no file on that route was changed', async ({ page }) => {
	// NO SOURCE ON THIS ROUTE WAS TOUCHED. The entire fix for the operator's
	// `/teachers` report is `atlas-client/src/ui/tooltip.tsx` (the Portal) plus
	// the dark bubble classes. These rows are the rendered proof that the shared
	// primitive reached this table.
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto('/teachers');
	const trigger = page.locator('th[data-column-id="teacher"] button');
	await expect(trigger).toBeVisible({ timeout: 30_000 });
	const bubble = await hoverHeaderAndRead(page, trigger);

	expect(luminance(bubble.backgroundColor), `background ${bubble.backgroundColor} is not dark`).toBeLessThan(0.3);
	expect(luminance(bubble.color), `text colour ${bubble.color} is not light`).toBeGreaterThan(0.8);
	const tokens = await page.evaluate(() => {
		const probe = document.createElement('div');
		document.body.appendChild(probe);
		probe.className = 'bg-slate-900';
		const background = getComputedStyle(probe).backgroundColor;
		probe.className = 'text-white';
		const color = getComputedStyle(probe).color;
		probe.remove();
		return { background, color };
	});
	expect(bubble.backgroundColor, `the /teachers bubble background is ${bubble.backgroundColor}, not slate-900 (${tokens.background})`).toBe(tokens.background);
	expect(bubble.color, `the /teachers bubble text is ${bubble.color}, not white (${tokens.color})`).toBe(tokens.color);
	expect(bubble.zIndex).toBe('50');
	expect(bubble.insideScrollContainer, 'the Teachers bubble is inside the table scroll container').toBe(false);
	expect(bubble.clippedAncestorClass, `a clipping ancestor still sits above the Teachers bubble: ${bubble.clippedAncestorClass}`).toBeNull();
	expect(bubble.fullyInsideClipRegion, `the /teachers bubble leaves the painted region ${JSON.stringify(bubble.clipRegion)}`).toBe(true);
	expect(bubble.hitTestInsideBubble, `elementFromPoint returned ${bubble.hitTestElement} on /teachers`).toBe(true);
	expect(bubble.cornerHitTestInsideBubble, 'the /teachers bubble corner is not painted').toBe(true);
	expect(bubble.box.top).toBeGreaterThanOrEqual(0);
	expect(bubble.box.width).toBeGreaterThan(20);
	expect(bubble.text).toContain('Teacher');
});

// ───────────────────────── items 9.1 + 41, as rendered ────────────────────────

type RowReading = { y: number; x: number; width: number; height: number; text: string; fontSize: string };

async function readFilterRow(page: Page): Promise<{ search: RowReading; triggers: RowReading[]; clusterHeight: number; distinctBaselines: number }> {
	return page.evaluate(() => {
		const input = document.querySelector('input[placeholder="Search name or code..."]') as HTMLInputElement;
		const cluster = document.querySelector('[data-testid="subjects-filter-cluster"]') as HTMLElement;
		const read = (el: Element): { y: number; x: number; width: number; height: number } => {
			const r = el.getBoundingClientRect();
			return { y: r.y, x: r.x, width: r.width, height: r.height };
		};
		const triggers = Array.from(cluster.querySelectorAll('[role="combobox"]')) as HTMLElement[];
		const rows = triggers.map((t) => {
			const r = read(t);
			const s = getComputedStyle(t);
			return { ...r, text: (t.textContent ?? '').trim(), fontSize: s.fontSize };
		});
		const searchStyle = getComputedStyle(input);
		const searchBox = read(input);
		const baselines = new Set(rows.map((r) => Math.round(r.y)));
		baselines.add(Math.round(searchBox.y));
		return {
			search: { ...searchBox, text: input.placeholder, fontSize: searchStyle.fontSize },
			triggers: rows,
			clusterHeight: read(cluster).height,
			distinctBaselines: baselines.size,
		};
	});
}

test('A5-9.1/41 RENDERED: at 1366x768 the filter row is ONE row, measured by geometry, and the controls are the operator dimensions', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await gotoSubjects(page);

	const row = await readFilterRow(page);
	// (1) ONE ROW, PROVED BY GEOMETRY. Every control shares the search input's
	// baseline, and the whole cluster is a single ~36px line.
	expect(row.triggers.length, 'expected 5 direct filters (Status, Grades, Programs, Room Types, Term)').toBe(5);
	for (const trigger of row.triggers) {
		expect(
			Math.abs(trigger.y - row.search.y),
			`control "${trigger.text}" is on a different line (y=${trigger.y} vs search y=${row.search.y}) :: ${JSON.stringify(row)}`,
		).toBeLessThanOrEqual(1);
	}
	expect(row.distinctBaselines, 'the controls are not on a single line').toBe(1);
	expect(row.clusterHeight, `the cluster is ${row.clusterHeight}px tall, so the row is not compact :: ${JSON.stringify(row)}`).toBeLessThan(50);

	// (2) OPERATOR DIMENSIONS, MEASURED.
	expect(Math.abs(row.search.width - 240), `the search box is ${row.search.width}px wide, not 240`).toBeLessThanOrEqual(1);
	expect(Math.abs(row.search.height - 36), `the search box is ${row.search.height}px tall, not 36`).toBeLessThanOrEqual(1);
	expect(parseFloat(row.search.fontSize), `the search box font-size is ${row.search.fontSize}, not 12`).toBe(12);
	expect(row.search.text).toBe('Search name or code...');
	for (const trigger of row.triggers) {
		expect(Math.abs(trigger.height - 36), `trigger "${trigger.text}" is ${trigger.height}px tall, not 36`).toBeLessThanOrEqual(1);
		expect(parseFloat(trigger.fontSize), `trigger "${trigger.text}" font-size is ${trigger.fontSize}, not 12`).toBe(12);
	}

	// (3) DEDUP, AS A HUMAN SEES IT: one status-looking control, no disclosure.
	const statusish = row.triggers.filter((t) => /status/i.test(t.text));
	expect(statusish.length, `expected exactly one status control, found ${statusish.length}: ${row.triggers.map((t) => t.text).join(' | ')}`).toBe(1);
	expect(statusish[0].text).toBe('All Status');
	const bodyText = await page.locator('body').innerText();
	expect(bodyText.toLowerCase()).not.toContain('more filters');
	expect(bodyText).not.toContain('All statuses');
	// Item 9.1(1): the green EnrollPro notice strip is gone. The load-bearing
	// form of this row is the ELEMENT, not a sentence: `SubjectTermAuthorityBanner`
	// returns null for `VERIFIED_LIVE` (the state this fixture serves, from
	// `/subjects/scheduling-authority`), so the banner node must not exist at all.
	// Asserting on the old copy string instead would be vacuous — that sentence
	// no longer exists anywhere in production source, so it could never appear.
	expect(await page.locator('[data-testid="subject-term-authority"]').count(), 'the routine EnrollPro strip is back on /subjects').toBe(0);
	// NO EVIDENCE IS DROPPED: the routine term contract moved to the quiet footer
	// affordance, so that must still be present and still name the active term.
	const contract = page.getByTestId('subject-term-contract-trigger');
	await expect(contract).toBeVisible();
	await expect(contract).toHaveAttribute('aria-label', /S\.Y\. 2026-2027/);
	await expect(contract).toHaveAttribute('aria-label', /Term 1 active/);
	const tableCard = await page.evaluate(() => {
		const toolbar = document.querySelector('[data-testid="admin-search-filter-toolbar"]') as HTMLElement;
		const table = document.querySelector('table') as HTMLElement;
		const t = toolbar.getBoundingClientRect();
		const b = table.getBoundingClientRect();
		return { toolbarBottom: t.bottom, tableTop: b.top };
	});
	expect(tableCard.tableTop, 'the table card is not directly beneath the filter bar').toBeGreaterThanOrEqual(tableCard.toolbarBottom - 1);

	// (4) NO BLOWOUT at 1366x768.
	const blowout = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(blowout.scrollWidth, `the page has a horizontal scrollbar (${blowout.scrollWidth} > ${blowout.clientWidth})`).toBeLessThanOrEqual(blowout.clientWidth);
});

test('A5-9.1/41 RENDERED: the one All Status dropdown really reaches BOTH axes, and Reset restores everything', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await gotoSubjects(page);

	// The catalog rows, read from the DESKTOP table. Row text is what the
	// operator reads, so the assertions below are on the rendered strings.
	const visibleSubjectCodes = async () =>
		(await page.locator('table tbody tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

	// Unfiltered: four catalog rows, including the archived one.
	expect((await visibleSubjectCodes()).length).toBe(4);

	// Axis 1 — the subject LIFECYCLE.
	await page.getByRole('combobox', { name: 'Filter by subject status' }).click();
	await page.getByRole('option', { name: 'Active', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Filter by subject status' })).toContainText('Active');
	const activeRows = await visibleSubjectCodes();
	expect(activeRows.length, 'choosing Active did not filter the table').toBe(3);
	expect(activeRows.join('|')).not.toContain('OLD10');

	// Axis 2 — COVERAGE ATTENTION, the capability the merged control used to
	// live in a second dropdown for. This is the row that fails if the merge
	// dropped a predicate.
	await page.getByRole('combobox', { name: 'Filter by subject status' }).click();
	await page.getByRole('option', { name: 'Missing teacher coverage' }).click();
	const coverageRows = await visibleSubjectCodes();
	expect(coverageRows.length, 'choosing "Missing teacher coverage" did not filter the table').toBe(2);
	expect(coverageRows.join('|')).toContain('SCI10');
	expect(coverageRows.join('|')).toContain('ESP10');
	expect(coverageRows.join('|')).not.toContain('FIL10');

	// The third axis, the room-constrained predicate, also still works.
	await page.getByRole('combobox', { name: 'Filter by subject status' }).click();
	await page.getByRole('option', { name: 'Room-constrained subjects' }).click();
	const roomRows = await visibleSubjectCodes();
	expect(roomRows.length, 'choosing the room-constrained axis did not filter the table').toBe(1);
	expect(roomRows.join('|')).toContain('SCI10');

	// Reset restores the whole catalog.
	await page.getByTestId('subjects-reset-filters').click();
	await expect(page.getByRole('combobox', { name: 'Filter by subject status' })).toContainText('All Status');
	expect((await visibleSubjectCodes()).length).toBe(4);
});

test('A5-9.1/41 RENDERED: the row wraps cleanly at 900px with no overlapping controls and still no page scrollbar', async ({ page }) => {
	// ONE LINE AT THE OPERATOR'S VIEWPORT, FIRST — the same measurement the
	// previous row proves, taken before the viewport is narrowed, so "the row
	// grew" is a comparison against a real single-line baseline.
	await page.setViewportSize({ width: 1366, height: 768 });
	await gotoSubjects(page);
	const wide = await readFilterRow(page);
	expect(wide.clusterHeight, 'the row is not a single line at 1366px, so there is no single-line baseline to wrap from').toBeLessThan(50);

	await page.setViewportSize({ width: 900, height: 768 });
	await page.waitForTimeout(200);
	const narrow = await readFilterRow(page);

	// It genuinely wrapped: the cluster is taller than one line.
	expect(narrow.clusterHeight, `the cluster did not grow (${wide.clusterHeight} -> ${narrow.clusterHeight}px), so the row did not wrap`).toBeGreaterThan(wide.clusterHeight);

	// No two controls overlap — a real rectangle-intersection sweep.
	const boxes = [
		{ label: 'search', ...narrow.search },
		...narrow.triggers.map((t) => ({ label: t.text, ...t })),
	];
	for (let i = 0; i < boxes.length; i += 1) {
		for (let j = i + 1; j < boxes.length; j += 1) {
			const a = boxes[i];
			const b = boxes[j];
			const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
			const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
			expect(
				overlapX > 1 && overlapY > 1,
				`controls "${a.label}" and "${b.label}" overlap at 900px (${overlapX.toFixed(1)}x${overlapY.toFixed(1)}px)`,
			).toBe(false);
		}
	}

	const blowout = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(blowout.scrollWidth, `the page blows out horizontally at 900px (${blowout.scrollWidth} > ${blowout.clientWidth})`).toBeLessThanOrEqual(blowout.clientWidth);
});

// ──────────────────────────────── item 17.1 ──────────────────────────────────

/** The shared compact grade labels the dialog must render. */
const GRADE_PILL_EXPECTED: Record<number, { label: string }> = {
	7: { label: 'GR7' },
	9: { label: 'GR9' },
	10: { label: 'GR10' },
};

async function openCoverageDialog(page: Page): Promise<void> {
	await gotoSubjects(page);
	// The SUBJECT that has assigned teachers in the fixture (SCI10), located by
	// its rendered trigger text — not by row position, which is sort-dependent.
	await page.getByRole('button', { name: 'Review teacher coverage for Earth Science' }).click();
	await expect(page.getByTestId('subject-coverage-dialog')).toBeVisible();
	await expect(page.getByTestId('subject-coverage-dialog')).toContainText('FERNANDEZ, JANELLA MARIE');
	await waitForDialogSettled(page);
}

/**
 * Wait until the dialog's open animation has finished.
 *
 * `animate-modal-in` in `src/index.css` runs `scale(0.9) -> scale(1)`, so a box
 * measured while it is still running is 10% smaller than the settled box — and
 * a drag started from a mid-animation box lands somewhere else entirely. Every
 * measurement below is taken on a settled dialog.
 */
async function waitForDialogSettled(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const dialog = document.querySelector('[data-testid="subject-coverage-dialog"]') as HTMLElement | null;
		if (!dialog) return false;
		const transform = getComputedStyle(dialog).transform;
		// `matrix(1, 0, 0, 1, tx, ty)` — the scale has reached 1.
		return /^matrix\(1,\s*0,\s*0,\s*1,/.test(transform);
	});
	await page.waitForTimeout(50);
}

async function dialogBox(page: Page): Promise<Box> {
	return page.evaluate(() => {
		const dialog = document.querySelector('[data-testid="subject-coverage-dialog"]') as HTMLElement;
		const r = dialog.getBoundingClientRect();
		return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
	});
}

test('A5-17.1(1) RENDERED: the coverage dialog is resizable, and a REAL mouse drag grows it while it stays centred', async ({ page }) => {
	// 1440x1200 on purpose. At 900px tall this dialog's CONTENT already fills the
	// `max-h-[90vh]` clamp (810px), so a downward drag cannot grow it and the row
	// would be measuring a constraint rather than the resize behaviour. The
	// centre assertions below are taken against THIS viewport.
	const VIEWPORT = { width: 1440, height: 1200 };
	await page.setViewportSize(VIEWPORT);
	await openCoverageDialog(page);

	await waitForDialogSettled(page);
	const before = await dialogBox(page);
	const computed = await page.evaluate(() => {
		const dialog = document.querySelector('[data-testid="subject-coverage-dialog"]') as HTMLElement;
		const scroller = document.querySelector('[data-testid="subject-coverage-scroll"]') as HTMLElement;
		const grip = document.querySelector('[data-testid="subject-coverage-resize-grip"]') as HTMLElement;
		const d = getComputedStyle(dialog);
		const g = grip ? getComputedStyle(grip) : null;
		const gr = grip?.getBoundingClientRect();
		const dr = dialog.getBoundingClientRect();
		return {
			resize: d.resize,
			overflowY: getComputedStyle(scroller).overflowY,
			scrollerIsFlex: getComputedStyle(scroller).flexGrow,
			gripVisible: Boolean(gr && gr.width > 0 && gr.height > 0 && g?.visibility !== 'hidden' && g?.display !== 'none'),
			gripOffsetFromDialogRight: gr ? dr.right - gr.right : null,
			gripOffsetFromDialogBottom: gr ? dr.bottom - gr.bottom : null,
			minWidthPx: parseFloat(d.minWidth),
			maxWidthPx: parseFloat(d.maxWidth),
			minHeightPx: parseFloat(d.minHeight),
			maxHeightPx: parseFloat(d.maxHeight),
		};
	});

	// (2) The computed contract, not the class list.
	expect(computed.resize).toBe('both');
	expect(computed.minWidthPx).toBe(500);
	expect(computed.maxWidthPx).toBeCloseTo(VIEWPORT.width * 0.95, 0);
	expect(computed.minHeightPx).toBe(420);
	expect(computed.maxHeightPx).toBeCloseTo(VIEWPORT.height * 0.9, 0);
	expect(computed.overflowY).toBe('auto');
	expect(computed.scrollerIsFlex).not.toBe('0');
	// (5) The grip is visible, in the bottom-right corner, and near the card edge.
	expect(computed.gripVisible).toBe(true);
	expect(computed.gripOffsetFromDialogRight).toBeLessThan(24);
	expect(computed.gripOffsetFromDialogBottom).toBeLessThan(24);

	// (3) THE REAL DRAG. Move to the resize corner, press, drag outward, release.
	const gripX = before.right - 3;
	const gripY = before.bottom - 3;
	await page.mouse.move(gripX, gripY);
	await page.mouse.down();
	await page.mouse.move(gripX + 180, gripY + 140, { steps: 12 });
	await page.mouse.up();
	await waitForDialogSettled(page);
	const after = await dialogBox(page);

	expect(after.width, `the dialog did not grow: ${before.width} -> ${after.width}`).toBeGreaterThan(before.width + 100);
	expect(after.height, `the dialog did not grow: ${before.height} -> ${after.height}`).toBeGreaterThan(before.height + 60);

	// STILL CENTRED — the operator's "without breaking dialog centering". The
	// primitive's `left/top 50%` + the `animate-modal-in` translate re-centres
	// the box at its new size with no JavaScript.
	const centreX = after.left + after.width / 2;
	const centreY = after.top + after.height / 2;
	expect(Math.abs(centreX - VIEWPORT.width / 2), `horizontal centre drifted to ${centreX}`).toBeLessThanOrEqual(3);
	expect(Math.abs(centreY - VIEWPORT.height / 2), `vertical centre drifted to ${centreY}`).toBeLessThanOrEqual(3);

	// (4) CLAMPING: drag far past the corner.
	const farX = after.right - 3;
	const farY = after.bottom - 3;
	await page.mouse.move(farX, farY);
	await page.mouse.down();
	await page.mouse.move(farX + 2000, farY + 2000, { steps: 10 });
	await page.mouse.up();
	await waitForDialogSettled(page);
	const clamped = await dialogBox(page);
	expect(clamped.width, `the dialog did not clamp at 95vw (${clamped.width}px)`).toBeLessThanOrEqual(VIEWPORT.width * 0.95 + 1);
	expect(clamped.height, `the dialog did not clamp at 90vh (${clamped.height}px)`).toBeLessThanOrEqual(VIEWPORT.height * 0.9 + 1);
	expect(clamped.width, 'the dialog shrank below its minimum width').toBeGreaterThanOrEqual(500);
	const scroll = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(scroll.scrollWidth, 'a page scrollbar appeared while resizing').toBeLessThanOrEqual(scroll.clientWidth);
});

test('A5-17.1(2)+(3) RENDERED: every assigned teacher shows name + load, no duplicate grade row, no Assigned Sections, and [GRx pill][name] chips', async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 900 });
	await openCoverageDialog(page);

	const dialogText = (await page.getByTestId('subject-coverage-dialog').innerText()).replace(/\s+/g, ' ');
	// (2) Essentials kept, duplication gone.
	expect(dialogText).toContain('FERNANDEZ, JANELLA MARIE');
	expect(dialogText).toContain('79% Load');
	expect(dialogText).toContain('55% Load');
	expect(dialogText).toContain('91% Load');
	expect(dialogText.toLowerCase()).not.toContain('assigned sections');

	// The chips are the operator's own container, read from the live DOM. The
	// DepEd colours are compared by PROBE PARITY: the browser is asked what
	// `bg-green-100/80`, `bg-red-100/80` and `bg-blue-100/80` actually paint in
	// this build. Hand-parsing the computed string would have to guess both the
	// colour space (Chrome returns `oklab(...)` for these tokens, not `rgb()`)
	// and the exact values, and would have silently mis-read the very thing this
	// row exists to prove.
	const chips = await page.evaluate(() => {
		const probe = document.createElement('div');
		document.body.appendChild(probe);
		const probeColour = (cls: string) => {
			probe.className = cls;
			return getComputedStyle(probe).backgroundColor;
		};
		const depedColours = {
			7: probeColour('bg-green-100/80'),
			9: probeColour('bg-red-100/80'),
			10: probeColour('bg-blue-100/80'),
		};
		probe.remove();
		const dialog = document.querySelector('[data-testid="subject-coverage-dialog"]') as HTMLElement;
		// Selected by the operator's own chip class, matched on the class string
		// rather than through a CSS selector: the token contains a `/`, and
		// escaping that inside an evaluated selector is exactly the kind of
		// fragility that makes a control silently match nothing.
		const chips = Array.from(dialog.querySelectorAll('div')).filter((d) => (d.className || '').includes('border-slate-200/80')).map((chip) => {
			const spans = Array.from(chip.querySelectorAll('span')) as HTMLElement[];
			const pill = spans.find((s) => /rounded-full/.test(s.className));
			const name = spans.find((s) => s !== pill);
			return {
				pillText: pill?.textContent?.trim() ?? null,
				pillBackground: pill ? getComputedStyle(pill).backgroundColor : null,
				pillVisible: pill ? pill.getBoundingClientRect().width > 0 : false,
				nameText: name?.textContent?.trim() ?? null,
			};
		});
		return { chips, depedColours };
	});

	// One chip per assigned section, across ALL three teachers.
	expect(chips.chips.length, `expected 6 section chips across 3 teachers, got ${chips.chips.length}`).toBe(6);

	const seenGrades = new Set<string>();
	const seenColours = new Set<string>();
	for (const chip of chips.chips) {
		expect(chip.pillVisible, 'a grade pill rendered with no width').toBe(true);
		const label = chip.pillText ?? '';
		const grade = Number(label.replace('GR', ''));
		expect(GRADE_PILL_EXPECTED[grade], `"${label}" is not a shared compact grade label`).toBeTruthy();
		// (6) The pill's COMPUTED background is the DepEd colour for that grade,
		// decided by the browser's own resolved token.
		const expectedColour = (chips.depedColours as Record<number, string>)[grade];
		expect(expectedColour, `no DepEd colour resolved for GR${grade}`).toBeTruthy();
		expect(chip.pillBackground, 'the grade pill has no computed background').toBeTruthy();
		expect(chip.pillBackground, `GR${grade} pill paints ${chip.pillBackground}, not the DepEd ${expectedColour}`).toBe(expectedColour);
		seenColours.add(chip.pillBackground as string);
		seenGrades.add(label);
		// THE DISCRIMINATING ROW: the name is the NAME ONLY. Before the fix the
		// chip text was the whole display string `GR7 Bonifacio`, so the grade
		// was printed twice per section.
		expect(chip.nameText, 'a section chip has no name').toBeTruthy();
		expect(chip.nameText).not.toMatch(/^GR\d/);
		expect(chip.nameText).toMatch(/^[A-Z][a-z]+$/);
	}
	// Three DIFFERENT colours, so "the pill is coloured" cannot pass by every
	// pill being the same tint.
	expect(seenColours.size, `all ${chips.chips.length} pills share ${seenColours.size} colour(s)`).toBe(3);
	// All three DepEd colours were actually exercised.
	expect([...seenGrades].sort()).toEqual(['GR10', 'GR7', 'GR9']);
});

// ─────────────────────────── the no-write guarantee ─────────────────────────

test('A5 ISOLATED: the browser never requested a write, nothing escaped the mocks, and the run stayed on loopback', async ({ page, baseURL }) => {
	expect(baseURL, 'this spec must run against the loopback preview, not a live origin').toContain('127.0.0.1');
	// Every row above ran first (workers: 1, in file order), so this is the
	// cumulative record, not a single page's.
	expect(
		attemptedMutations,
		`the client attempted writes: ${attemptedMutations.join(' | ')}`,
	).toEqual([]);
	// Full isolation, measured: a request answered by the catch-all `{}` means
	// some surface was reading a shape this fixture never supplied, and the rows
	// above could have been green for the wrong reason.
	expect(
		[...new Set(unmockedRequests)],
		`these requests escaped every fixture and were answered {}: ${[...new Set(unmockedRequests)].join(' | ')}`,
	).toEqual([]);
});
