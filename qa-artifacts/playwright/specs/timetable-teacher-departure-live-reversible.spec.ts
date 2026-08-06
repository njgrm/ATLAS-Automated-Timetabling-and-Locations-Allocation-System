import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { assertNoGlobalOverflow, loginAdmin, openSelectedClassTeacherDeparture, openTimetableSimple } from './timetable-layout-helpers';

type Faculty = {
	id: number;
	firstName: string;
	lastName: string;
	isActiveForScheduling: boolean;
	version: number;
	advisedSectionName?: string | null;
};

type Entry = {
	entryId: string;
	facultyId: number | null;
	subjectId: number;
	sectionId: number;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	day: string;
	startTime: string;
	endTime: string;
};

type Draft = {
	runId: number;
	version: number;
	entries: Entry[];
};

type FixtureGroup = {
	subjectId: number;
	sectionId: number;
	entryId: string;
	count: number;
};

type Fixture = {
	schoolYearId: number;
	runId: number;
	runVersion: number;
	sourceFacultyId: number;
	sourceLabel: string;
	targetFacultyId: number;
	targetLabel: string;
	groups: FixtureGroup[];
	entryCount: number;
};

function facultyLabel(faculty: Faculty) {
	const adviserSuffix = faculty.advisedSectionName ? ` Â· Adviser ${faculty.advisedSectionName}` : '';
	return `${faculty.lastName}, ${faculty.firstName}${adviserSuffix}`;
}

function expectedFacultyVersions(faculty: Faculty[], ids: number[]) {
	const versionById = new Map(faculty.map((item) => [item.id, item.version]));
	return Object.fromEntries(ids.map((id) => [String(id), versionById.get(id)]).filter(([, version]) => typeof version === 'number'));
}

async function apiGet<T>(request: APIRequestContext, path: string): Promise<T> {
	const response = await request.get(path);
	expect(response.ok(), `GET ${path} failed with ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	return response.json() as Promise<T>;
}

async function apiPost<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
	const response = await request.post(path, { data });
	expect(response.ok(), `POST ${path} failed with ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	return response.json() as Promise<T>;
}

async function loadDraftAndFaculty(request: APIRequestContext, schoolYearId: number, runId: number | 'latest') {
	const [draft, facultyResponse] = await Promise.all([
		apiGet<Draft>(request, `/api/v1/generation/1/${schoolYearId}/runs/${runId}/draft`),
		apiGet<{ faculty: Faculty[] }>(request, '/api/v1/faculty?schoolId=1'),
	]);
	return { draft, faculty: facultyResponse.faculty };
}

function buildChanges(fixture: Pick<Fixture, 'sourceFacultyId' | 'targetFacultyId' | 'groups'>, reverse = false) {
	return fixture.groups.map((group) => ({
		kind: 'ENTRY' as const,
		entryId: group.entryId,
		subjectId: group.subjectId,
		sectionId: group.sectionId,
		fromFacultyId: reverse ? fixture.targetFacultyId : fixture.sourceFacultyId,
		toFacultyId: reverse ? fixture.sourceFacultyId : fixture.targetFacultyId,
	}));
}

async function previewRepair(request: APIRequestContext, fixture: Fixture, draft: Draft, faculty: Faculty[], reverse = false) {
	const changes = buildChanges(fixture, reverse);
	return apiPost<{
		errorCount?: number;
		hardViolations?: unknown[];
		softViolations?: unknown[];
	}>(
		request,
		`/api/v1/generation/1/${fixture.schoolYearId}/runs/${fixture.runId}/teaching-load-repairs/preview`,
		{
			changes,
			expectedRunVersion: draft.version,
			expectedFacultyVersions: expectedFacultyVersions(faculty, [fixture.sourceFacultyId, fixture.targetFacultyId]),
		},
	);
}

async function applyRepair(request: APIRequestContext, fixture: Fixture, draft: Draft, faculty: Faculty[], reverse = false) {
	const changes = buildChanges(fixture, reverse);
	return apiPost<{ draft: Draft }>(
		request,
		`/api/v1/generation/1/${fixture.schoolYearId}/runs/${fixture.runId}/teaching-load-repairs/apply`,
		{
			changes,
			expectedRunVersion: draft.version,
			expectedFacultyVersions: expectedFacultyVersions(faculty, [fixture.sourceFacultyId, fixture.targetFacultyId]),
			allowSoftOverride: true,
		},
	);
}

async function findReversibleFixture(request: APIRequestContext, visibleKeys?: Set<string>): Promise<Fixture> {
	const context = await apiGet<{ activeSchoolYearId: number }>(request, '/api/v1/runtime/context?schoolId=1');
	const schoolYearId = context.activeSchoolYearId;
	const { draft, faculty } = await loadDraftAndFaculty(request, schoolYearId, 'latest');
	const facultyById = new Map(faculty.map((item) => [item.id, item]));
	const activeFaculty = faculty.filter((item) => item.isActiveForScheduling);
	const busySlots = new Set(
		draft.entries
			.filter((entry) => entry.facultyId != null)
			.map((entry) => `${entry.facultyId}:${entry.day}:${entry.startTime}:${entry.endTime}`),
	);
	const groupsBySource = new Map<number, Map<string, { subjectId: number; sectionId: number; entries: Entry[] }>>();
	for (const entry of draft.entries) {
		if (!entry.facultyId || entry.entryKind === 'COHORT') continue;
		const sourceGroups = groupsBySource.get(entry.facultyId) ?? new Map<string, { subjectId: number; sectionId: number; entries: Entry[] }>();
		const key = `${entry.subjectId}:${entry.sectionId}:${entry.entryKind ?? 'SECTION'}:${entry.cohortCode ?? ''}`;
		const group = sourceGroups.get(key) ?? { subjectId: entry.subjectId, sectionId: entry.sectionId, entries: [] };
		group.entries.push(entry);
		sourceGroups.set(key, group);
		groupsBySource.set(entry.facultyId, sourceGroups);
	}

	const sources = Array.from(groupsBySource.entries())
		.map(([sourceFacultyId, groupMap]) => ({
			sourceFacultyId,
			groups: Array.from(groupMap.values()),
			entryCount: Array.from(groupMap.values()).reduce((sum, group) => sum + group.entries.length, 0),
		}))
		.filter((candidate) => candidate.groups.length <= 3)
		.sort((a, b) => a.groups.length - b.groups.length || a.entryCount - b.entryCount);

	for (const source of sources.slice(0, 80)) {
		const sourceFaculty = facultyById.get(source.sourceFacultyId);
		if (!sourceFaculty) continue;
		const sourceEntries = source.groups.flatMap((group) => group.entries);
		const freeTargets = activeFaculty
			.filter((target) => target.id !== source.sourceFacultyId)
			.filter((target) => sourceEntries.every((entry) => !busySlots.has(`${target.id}:${entry.day}:${entry.startTime}:${entry.endTime}`)))
			.slice(0, 20);

		for (const target of freeTargets) {
			const fixture: Fixture = {
				schoolYearId,
				runId: draft.runId,
				runVersion: draft.version,
				sourceFacultyId: source.sourceFacultyId,
				sourceLabel: facultyLabel(sourceFaculty),
				targetFacultyId: target.id,
				targetLabel: facultyLabel(target),
				groups: source.groups.map((group) => ({
					subjectId: group.subjectId,
					sectionId: group.sectionId,
					entryId: group.entries[0].entryId,
					count: group.entries.length,
				})),
				entryCount: source.entryCount,
			};
			if (visibleKeys && !fixture.groups.some((group) => visibleKeys.has(`${fixture.sourceFacultyId}:${group.subjectId}:${group.sectionId}`))) {
				continue;
			}
			const preview = await previewRepair(request, fixture, draft, faculty);
			if ((preview.errorCount ?? 0) === 0 && (preview.hardViolations?.length ?? 0) === 0) {
				return fixture;
			}
		}
	}
	throw new Error('No reversible teacher-departure fixture found.');
}

async function chooseSearchableSelectOption(page: Page, wrapperTestId: string, optionLabel: string) {
	const wrapper = page.getByTestId(wrapperTestId);
	await wrapper.getByRole('combobox').click();
	const popover = page.locator('[data-radix-popper-content-wrapper]').last();
	await popover.locator('input').fill(optionLabel);
	await popover.getByRole('button', { name: optionLabel }).click();
}

test.describe.serial('Timetable teacher departure live reversible flow', () => {
	test('reassigns a departing teacher through the browser, verifies grid/data, then reverts', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'desktop', 'Run the live write/revert fixture only once on desktop.');
		test.setTimeout(180_000);

		await page.context().clearCookies();
		await loginAdmin(page);
		let saved = false;
		let fixture: Fixture | null = null;

		try {
			await openTimetableSimple(page);
			const visibleKeys = new Set(await page.locator('[data-timetable-entry="true"][data-faculty-id]:not([data-faculty-id=""])').evaluateAll((nodes) =>
				nodes.map((node) => {
					const el = node as HTMLElement;
					return `${el.dataset.facultyId}:${el.dataset.subjectId}:${el.dataset.sectionId}`;
				}),
			));
			fixture = await findReversibleFixture(page.request, visibleKeys);
			const selectedEntry = page.locator(
				`[data-timetable-entry="true"][data-faculty-id="${fixture.sourceFacultyId}"][data-subject-id="${fixture.groups[0].subjectId}"][data-section-id="${fixture.groups[0].sectionId}"]`,
			).first();
			await expect(selectedEntry).toBeVisible({ timeout: 30_000 });
			await selectedEntry.click();
			const sheet = await openSelectedClassTeacherDeparture(page);
			await expect(sheet).toContainText(/Affected sessions/i);
			await expect(page.getByTestId('teacher-departure-show-affected-only')).toBeVisible();
			await page.getByTestId('teacher-departure-show-affected-only').click();
			await expect(page.getByTestId('teacher-departure-jump-first-affected')).toBeEnabled();
			await page.getByTestId('teacher-departure-jump-first-affected').click();
			await expect(page.getByTestId('teacher-departure-save-reason')).toBeVisible();
			await expect(page.getByTestId('teacher-departure-show-group-on-grid').first()).toBeVisible();
			await page.getByTestId('teacher-departure-show-group-on-grid').first().click();
			await expect(page.getByTestId('teacher-departure-grid-badge').first()).toBeVisible({ timeout: 10_000 });

			await page.getByTestId('teacher-departure-next-button').click();
			await chooseSearchableSelectOption(page, 'teacher-departure-replacement-select', fixture.targetLabel);
			await page.getByRole('button', { name: /^Use for all$/i }).click();
			await page.getByTestId('teacher-departure-next-button').click();
			await page.getByTestId('teacher-departure-preview-button').click();
			await expect(page.getByTestId('teacher-departure-save-reason')).toContainText(/Ready to save|Review and acknowledge/i, { timeout: 30_000 });
			const warningCheckbox = page.locator('label').filter({ hasText: /I reviewed the warnings/i }).getByRole('checkbox');
			if (await warningCheckbox.count()) {
				await warningCheckbox.first().check();
			}
			await expect(page.getByTestId('teacher-departure-save-button')).toBeEnabled({ timeout: 10_000 });
			await page.getByTestId('teacher-departure-save-button').click();
			await expect(sheet).toHaveCount(0, { timeout: 45_000 });
			saved = true;

			const { draft: changedDraft } = await loadDraftAndFaculty(page.request, fixture.schoolYearId, fixture.runId);
			const changedEntries = changedDraft.entries.filter((entry) =>
				fixture.groups.some((group) => group.subjectId === entry.subjectId && group.sectionId === entry.sectionId),
			);
			expect(changedEntries.length, 'Affected entries should still exist after save.').toBeGreaterThanOrEqual(fixture.entryCount);
			expect(changedEntries.every((entry) => entry.facultyId === fixture.targetFacultyId), 'Affected entries should move to the replacement teacher.').toBeTruthy();

			await page.reload({ waitUntil: 'domcontentloaded' });
			await expect(page.locator(`[data-timetable-entry="true"][data-faculty-id="${fixture.targetFacultyId}"][data-subject-id="${fixture.groups[0].subjectId}"][data-section-id="${fixture.groups[0].sectionId}"]`).first()).toBeVisible({ timeout: 45_000 });
			await assertNoGlobalOverflow(page);
		} finally {
			if (saved) {
				expect(fixture, 'Cleanup requires the saved fixture.').toBeTruthy();
				const savedFixture = fixture!;
				const { draft: currentDraft, faculty: currentFaculty } = await loadDraftAndFaculty(page.request, savedFixture.schoolYearId, savedFixture.runId);
				const reversePreview = await previewRepair(page.request, savedFixture, currentDraft, currentFaculty, true);
				expect(reversePreview.hardViolations?.length ?? 0, 'Reverse fixture must not create hard violations.').toBe(0);
				const reversed = await applyRepair(page.request, savedFixture, currentDraft, currentFaculty, true);
				const restoredEntries = reversed.draft.entries.filter((entry) =>
					savedFixture.groups.some((group) => group.subjectId === entry.subjectId && group.sectionId === entry.sectionId),
				);
				expect(restoredEntries.every((entry) => entry.facultyId === savedFixture.sourceFacultyId), 'Cleanup should restore original teacher ownership.').toBeTruthy();
			}
		}
	});
});
