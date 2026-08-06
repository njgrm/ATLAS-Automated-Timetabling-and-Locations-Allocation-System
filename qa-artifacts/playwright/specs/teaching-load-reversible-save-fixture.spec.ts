import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { assertNoGlobalOverflow, loginAdmin } from './timetable-layout-helpers';

type Assignment = {
	subjectId: number;
	gradeLevels?: number[];
	sectionIds: number[];
};

type Faculty = {
	id: number;
	firstName: string;
	lastName: string;
	department: string | null;
	isActiveForScheduling: boolean;
	isPlaceholder: boolean;
	maxHoursPerWeek: number;
	policyCreditedHours?: number;
	subjectHours?: number;
	version: number;
	assignments: Assignment[];
};

type Subject = {
	id: number;
	code: string;
	name: string;
	ownerDepartment?: string | null;
	allowedOwnerDepartments?: string[];
	minMinutesPerWeek?: number;
	isActive?: boolean;
};

type Section = {
	id: number;
	name: string;
	displayOrder: number;
};

type FacultyAssignmentResponse = {
	version: number;
	assignments: Assignment[];
};

type Fixture = {
	schoolYearId: number;
	subjectId: number;
	subjectLabel: string;
	sectionId: number;
	sectionName: string;
	sourceFacultyId: number;
	sourceLabel: string;
	targetFacultyId: number;
	targetLabel: string;
	sourceOriginal: Assignment[];
	targetOriginal: Assignment[];
};

const reportRoot = path.join(process.cwd(), 'qa-artifacts', 'teaching-load-reversible-save-fixture');

async function attachReport(testInfo: TestInfo, name: string, data: unknown) {
	fs.mkdirSync(reportRoot, { recursive: true });
	const filePath = path.join(reportRoot, `${testInfo.project.name}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	await testInfo.attach(name, { path: filePath, contentType: 'application/json' });
}

async function apiGet<T>(request: APIRequestContext, pathName: string): Promise<T> {
	const response = await request.get(pathName);
	expect(response.ok(), `GET ${pathName} failed with ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	return response.json() as Promise<T>;
}

async function apiPut<T>(request: APIRequestContext, pathName: string, data: unknown): Promise<T> {
	const response = await request.put(pathName, { data });
	expect(response.ok(), `PUT ${pathName} failed with ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	return response.json() as Promise<T>;
}

function facultyLabel(member: Pick<Faculty, 'firstName' | 'lastName'>) {
	return `${member.lastName}, ${member.firstName}`;
}

function normalizeDepartmentCode(value: string | null | undefined): string {
	const normalized = (value ?? '').trim().toUpperCase();
	const table: Record<string, string> = {
		SCIENCE: 'SCI',
		SCI: 'SCI',
		MATHEMATICS: 'MATH',
		MATH: 'MATH',
		ENGLISH: 'ENG',
		ENG: 'ENG',
		FILIPINO: 'FIL',
		FIL: 'FIL',
		MAPEH: 'MAPEH',
		ESP: 'ESP',
		VALUES: 'ESP',
		'VALUES EDUCATION': 'ESP',
		AP: 'AP',
		'SOCIAL STUDIES': 'AP',
		'ARALING PANLIPUNAN': 'AP',
		TLE: 'TLE',
		LANGUAGES: 'ENG',
		SPA: 'SPA',
		SPS: 'SPS',
	};
	return table[normalized] ?? normalized;
}

function matchesOwnershipDepartment(facultyDepartment: string | null | undefined, subject: Subject): boolean {
	const ownerDepartments = [
		...(subject.ownerDepartment ? [subject.ownerDepartment] : []),
		...(subject.allowedOwnerDepartments ?? []),
	]
		.map((value) => normalizeDepartmentCode(value))
		.filter(Boolean);
	const normalizedFaculty = normalizeDepartmentCode(facultyDepartment);
	if (ownerDepartments.length > 0) {
		if (!normalizedFaculty) return false;
		if (ownerDepartments.includes(normalizedFaculty)) return true;
		if ((ownerDepartments.includes('ENG') || ownerDepartments.includes('FIL')) && normalizedFaculty === 'ENG') return true;
		return false;
	}
	return normalizedFaculty.length > 0;
}

function normalizeAssignments(assignments: Assignment[]) {
	return assignments
		.map((assignment) => ({
			subjectId: Number(assignment.subjectId),
			gradeLevels: [...(assignment.gradeLevels ?? [])].map(Number).sort((a, b) => a - b),
			sectionIds: [...(assignment.sectionIds ?? [])].map(Number).sort((a, b) => a - b),
		}))
		.filter((assignment) => Number.isFinite(assignment.subjectId) && assignment.sectionIds.length > 0)
		.sort((left, right) => left.subjectId - right.subjectId);
}

function assignmentSignature(assignments: Assignment[]) {
	return JSON.stringify(normalizeAssignments(assignments));
}

function hasOwnership(assignments: Assignment[], subjectId: number, sectionId: number) {
	return assignments.some((assignment) => assignment.subjectId === subjectId && assignment.sectionIds.includes(sectionId));
}

function cloneAssignments(assignments: Assignment[]) {
	return normalizeAssignments(assignments).map((assignment) => ({
		subjectId: assignment.subjectId,
		gradeLevels: assignment.gradeLevels,
		sectionIds: assignment.sectionIds,
	}));
}

async function getFacultyAssignments(request: APIRequestContext, facultyId: number, schoolYearId: number) {
	return apiGet<FacultyAssignmentResponse>(request, `/api/v1/faculty-assignments/${facultyId}?schoolYearId=${schoolYearId}`);
}

async function putFacultyAssignments(
	request: APIRequestContext,
	facultyId: number,
	schoolYearId: number,
	version: number,
	assignments: Assignment[],
) {
	return apiPut<FacultyAssignmentResponse>(request, `/api/v1/faculty-assignments/${facultyId}`, {
		schoolId: 1,
		schoolYearId,
		version,
		assignments: cloneAssignments(assignments),
	});
}

async function restoreFixtureIfNeeded(request: APIRequestContext, fixture: Fixture) {
	const [currentSource, currentTarget] = await Promise.all([
		getFacultyAssignments(request, fixture.sourceFacultyId, fixture.schoolYearId),
		getFacultyAssignments(request, fixture.targetFacultyId, fixture.schoolYearId),
	]);

	const sourceMatches = assignmentSignature(currentSource.assignments) === assignmentSignature(fixture.sourceOriginal);
	const targetMatches = assignmentSignature(currentTarget.assignments) === assignmentSignature(fixture.targetOriginal);
	if (sourceMatches && targetMatches) {
		return { restored: false, reason: 'already-original' };
	}

	if (!targetMatches) {
		await putFacultyAssignments(request, fixture.targetFacultyId, fixture.schoolYearId, currentTarget.version, fixture.targetOriginal);
	}
	if (!sourceMatches) {
		const freshSource = await getFacultyAssignments(request, fixture.sourceFacultyId, fixture.schoolYearId);
		await putFacultyAssignments(request, fixture.sourceFacultyId, fixture.schoolYearId, freshSource.version, fixture.sourceOriginal);
	}

	const [restoredSource, restoredTarget] = await Promise.all([
		getFacultyAssignments(request, fixture.sourceFacultyId, fixture.schoolYearId),
		getFacultyAssignments(request, fixture.targetFacultyId, fixture.schoolYearId),
	]);
	expect(assignmentSignature(restoredSource.assignments), 'Cleanup must restore source teacher assignments exactly.').toBe(assignmentSignature(fixture.sourceOriginal));
	expect(assignmentSignature(restoredTarget.assignments), 'Cleanup must restore target teacher assignments exactly.').toBe(assignmentSignature(fixture.targetOriginal));
	return { restored: true, reason: 'restored-original' };
}

async function findSafeFixture(request: APIRequestContext): Promise<Fixture> {
	const runtime = await apiGet<{ activeSchoolYearId: number; source?: string; stale?: boolean }>(request, '/api/v1/runtime/context?schoolId=1');
	const schoolYearId = runtime.activeSchoolYearId;
	const [summary, subjectsResponse, sectionsResponse] = await Promise.all([
		apiGet<{ faculty: Faculty[] }>(request, `/api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=${schoolYearId}`),
		apiGet<{ subjects: Subject[] }>(request, '/api/v1/subjects?schoolId=1'),
		apiGet<{ sections: Section[] }>(request, `/api/v1/sections/summary/${schoolYearId}?schoolId=1`),
	]);

	const currentOwners = summary.faculty.filter((member) => member.isActiveForScheduling);
	const realTargets = summary.faculty.filter((member) => member.isActiveForScheduling && !member.isPlaceholder);
	const subjectsById = new Map(subjectsResponse.subjects.filter((subject) => subject.isActive !== false).map((subject) => [subject.id, subject]));
	const sectionsById = new Map(sectionsResponse.sections.map((section) => [section.id, section]));
	const candidates = currentOwners
		.flatMap((source) => source.assignments.flatMap((assignment) => assignment.sectionIds.map((sectionId) => ({ source, assignment, sectionId }))))
		.filter(({ assignment, sectionId }) => subjectsById.has(assignment.subjectId) && sectionsById.has(sectionId))
		.sort((left, right) => left.source.assignments.length - right.source.assignments.length);

	for (const { source, assignment, sectionId } of candidates) {
		const subject = subjectsById.get(assignment.subjectId)!;
		const section = sectionsById.get(sectionId)!;
		const subjectHours = Math.max(0, subject.minMinutesPerWeek ?? 0) / 60;
		const targets = realTargets
			.filter((target) => target.id !== source.id)
			.filter((target) => matchesOwnershipDepartment(target.department, subject))
			.filter((target) => !hasOwnership(target.assignments, assignment.subjectId, sectionId))
			.filter((target) => ((target.policyCreditedHours ?? target.subjectHours ?? 0) + subjectHours) <= target.maxHoursPerWeek)
			.sort((left, right) => (left.policyCreditedHours ?? left.subjectHours ?? 0) - (right.policyCreditedHours ?? right.subjectHours ?? 0));

		for (const target of targets) {
			const [sourceSnapshot, targetSnapshot] = await Promise.all([
				getFacultyAssignments(request, source.id, schoolYearId),
				getFacultyAssignments(request, target.id, schoolYearId),
			]);
			if (!hasOwnership(sourceSnapshot.assignments, assignment.subjectId, sectionId)) continue;
			if (hasOwnership(targetSnapshot.assignments, assignment.subjectId, sectionId)) continue;
			return {
				schoolYearId,
				subjectId: assignment.subjectId,
				subjectLabel: `${subject.code} — ${subject.name}`,
				sectionId,
				sectionName: section.name,
				sourceFacultyId: source.id,
				sourceLabel: facultyLabel(source),
				targetFacultyId: target.id,
				targetLabel: facultyLabel(target),
				sourceOriginal: cloneAssignments(sourceSnapshot.assignments),
				targetOriginal: cloneAssignments(targetSnapshot.assignments),
			};
		}
	}
	throw new Error('NO-GO fixture unavailable: no active source owner and same-department real target pair can move one owned section without exceeding the target weekly cap.');
}

async function openTeachingLoadForFixture(page: Page, fixture: Fixture) {
	await page.goto(`/teaching-load?sectionId=${fixture.sectionId}&task=missing-load`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('teaching-load-repair-queue')).toBeVisible({ timeout: 45_000 });
	const advancedToggle = page.getByTestId('teaching-load-advanced-grid-toggle').last();
	if (await page.getByText(/Guided mode is active/i).isVisible().catch(() => false)) {
		await advancedToggle.click();
	}
	await expect(page.getByTestId('teaching-load-section-row').first()).toBeVisible({ timeout: 45_000 });
}

async function transferOwnerThroughBrowser(page: Page, fixture: Fixture) {
	const sectionRow = page.locator(`[data-testid="teaching-load-section-row"][data-section-id="${fixture.sectionId}"]`);
	await expect(sectionRow).toBeVisible({ timeout: 45_000 });
	await sectionRow.scrollIntoViewIfNeeded();
	if (!(await sectionRow.locator(`[data-testid="teaching-load-section-subject-row"][data-subject-id="${fixture.subjectId}"]`).isVisible().catch(() => false))) {
		await sectionRow.click();
	}
	const subjectRow = sectionRow.locator(`[data-testid="teaching-load-section-subject-row"][data-subject-id="${fixture.subjectId}"]`);
	await expect(subjectRow).toBeVisible({ timeout: 20_000 });
	await expect(subjectRow).toContainText(fixture.sourceLabel);
	await subjectRow.getByTestId('teaching-load-owner-picker-trigger').click();
	const targetOption = page.locator(`[data-testid="teaching-load-owner-option"][data-faculty-id="${fixture.targetFacultyId}"]`);
	await expect(targetOption).toBeVisible({ timeout: 20_000 });
	await targetOption.scrollIntoViewIfNeeded();
	await targetOption.click();
	const transferDialog = page.getByRole('dialog', { name: /Transfer Section Ownership/i });
	await expect(transferDialog).toBeVisible({ timeout: 20_000 });
	await expect(transferDialog).toContainText(fixture.sourceLabel);
	await expect(transferDialog).toContainText(fixture.targetLabel);
	await transferDialog.getByRole('button', { name: /^Transfer$/i }).click();
	await expect(page.getByTestId('teaching-load-draft-action-bar')).toContainText(/draft/i, { timeout: 20_000 });
}

async function saveDraftThroughBrowser(page: Page, fixture: Fixture) {
	const sourceSave = page.waitForResponse((response) =>
		response.url().includes(`/api/v1/faculty-assignments/${fixture.sourceFacultyId}`) && response.request().method() === 'PUT',
		{ timeout: 60_000 },
	);
	const targetSave = page.waitForResponse((response) =>
		response.url().includes(`/api/v1/faculty-assignments/${fixture.targetFacultyId}`) && response.request().method() === 'PUT',
		{ timeout: 60_000 },
	);
	await page.getByTestId('teaching-load-draft-action-bar').getByRole('button', { name: /^Save draft$/i }).click();
	const warningConfirm = page.getByRole('button', { name: /Confirm and Save/i });
	if (await warningConfirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
		await warningConfirm.click();
	}
	const responses = await Promise.all([sourceSave, targetSave]);
	for (const response of responses) {
		expect(response.ok(), `Save response failed with ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
	}
	await expect(page.getByTestId('teaching-load-draft-action-bar')).toContainText(/Saved Teaching Load|Saved 2 Teaching Load draft changes/i, { timeout: 45_000 });
}

test.describe.serial('Teaching Load reversible draft save fixture', () => {
	test('moves one section owner through the browser, saves, verifies persistence, and restores original data', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'desktop', 'Run the live write/revert fixture only once on desktop.');
		test.setTimeout(210_000);

		await page.context().clearCookies();
		await loginAdmin(page);
		let fixture: Fixture | null = null;

		try {
			fixture = await findSafeFixture(page.request);
			await attachReport(testInfo, 'selected-fixture', {
				schoolYearId: fixture.schoolYearId,
				subject: fixture.subjectLabel,
				section: fixture.sectionName,
				from: fixture.sourceLabel,
				to: fixture.targetLabel,
			});

			await openTeachingLoadForFixture(page, fixture);
			await transferOwnerThroughBrowser(page, fixture);
			await expect(page.getByTestId('teaching-load-draft-save-reason')).toHaveCount(0);
			await saveDraftThroughBrowser(page, fixture);

			const [changedSource, changedTarget] = await Promise.all([
				getFacultyAssignments(page.request, fixture.sourceFacultyId, fixture.schoolYearId),
				getFacultyAssignments(page.request, fixture.targetFacultyId, fixture.schoolYearId),
			]);
			expect(hasOwnership(changedSource.assignments, fixture.subjectId, fixture.sectionId), 'Saved source teacher should no longer own the moved section-subject pair.').toBe(false);
			expect(hasOwnership(changedTarget.assignments, fixture.subjectId, fixture.sectionId), 'Saved target teacher should own the moved section-subject pair.').toBe(true);

			await page.reload({ waitUntil: 'domcontentloaded' });
			await expect(page.getByTestId('teaching-load-content-shell')).toBeVisible({ timeout: 45_000 });
			await assertNoGlobalOverflow(page);
		} finally {
			if (fixture) {
				const cleanup = await restoreFixtureIfNeeded(page.request, fixture);
				await attachReport(testInfo, 'cleanup-proof', cleanup);
			}
		}

		expect(fixture, 'The fixture should be selected and cleaned up.').toBeTruthy();
		const restoredSource = await getFacultyAssignments(page.request, fixture!.sourceFacultyId, fixture!.schoolYearId);
		const restoredTarget = await getFacultyAssignments(page.request, fixture!.targetFacultyId, fixture!.schoolYearId);
		expect(assignmentSignature(restoredSource.assignments), 'Final source assignment state must equal the original snapshot.').toBe(assignmentSignature(fixture!.sourceOriginal));
		expect(assignmentSignature(restoredTarget.assignments), 'Final target assignment state must equal the original snapshot.').toBe(assignmentSignature(fixture!.targetOriginal));
	});
});
