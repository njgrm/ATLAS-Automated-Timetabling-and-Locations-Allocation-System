import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
	assertNoGlobalOverflow,
	loginAdmin,
	openDraftPlanningFromSimpleMore,
	openTimetableSimple,
} from './timetable-layout-helpers';

type DraftQueueItem = {
	entryKind: string;
	sectionId: number;
	sectionName: string;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	preferredRoomType?: string | null;
	cohortCode?: string | null;
	facultyOptions?: number[];
};

type DraftPlacement = {
	id: number;
	version: number;
	status: string;
	entryKind: string;
	sectionId: number;
	sectionName?: string;
	subjectId: number;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
};

type DraftBoard = {
	queue: DraftQueueItem[];
	placements: DraftPlacement[];
	classPeriodSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean }>;
};

type DraftBoardEnvelope = DraftBoard | { board: DraftBoard };

type Room = {
	id: number;
	name: string;
	type?: string | null;
	isTeachingSpace: boolean;
};

type PlacementInput = {
	entryKind: string;
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode: string | null;
	notes: string;
};

type SwapFixture = {
	schoolYearId: number;
	source: DraftPlacement;
	target: DraftPlacement;
	createdPlacementIds: number[];
	undoCount: number;
	initialSignature: string;
	sectionName: string;
	sectionId: number;
};

const SCHOOL_ID = 1;
const FIXTURE_NOTE = 'Codex reversible draft swap fixture';

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

async function apiDelete(request: APIRequestContext, path: string): Promise<void> {
	const response = await request.delete(path);
	expect(response.ok(), `DELETE ${path} failed with ${response.status()}: ${(await response.text()).slice(0, 500)}`).toBeTruthy();
}

async function activeSchoolYearId(request: APIRequestContext) {
	const context = await apiGet<{ activeSchoolYearId?: number }>(request, `/api/v1/runtime/context?schoolId=${SCHOOL_ID}`);
	expect(Number.isFinite(context.activeSchoolYearId), 'Runtime context must expose an active school year.').toBeTruthy();
	return Number(context.activeSchoolYearId);
}

function draftPath(schoolYearId: number, suffix = '') {
	return `/api/v1/generation/${SCHOOL_ID}/${schoolYearId}/pre-generation-drafts${suffix}`;
}

async function loadBoard(request: APIRequestContext, schoolYearId: number) {
	return apiGet<DraftBoard>(request, draftPath(schoolYearId));
}

async function loadTeachingRooms(request: APIRequestContext): Promise<Room[]> {
	const payload = await apiGet<{ buildings?: Array<{ rooms?: Room[] }> }>(request, `/api/v1/map/schools/${SCHOOL_ID}/buildings`);
	return (payload.buildings ?? []).flatMap((building) => building.rooms ?? []).filter((room) => room.isTeachingSpace);
}

function completePlacement(placement: DraftPlacement) {
	return placement.status === 'DRAFT'
		&& placement.facultyId != null
		&& placement.roomId != null
		&& Boolean(placement.day && placement.startTime && placement.endTime);
}

function placementSignature(board: DraftBoard) {
	return board.placements
		.filter((placement) => placement.status === 'DRAFT')
		.map((placement) => [
			placement.id,
			placement.version,
			placement.status,
			placement.entryKind,
			placement.sectionId,
			placement.subjectId,
			placement.facultyId,
			placement.roomId,
			placement.day,
			placement.startTime,
			placement.endTime,
			placement.cohortCode ?? '',
		].join(':'))
		.sort()
		.join('|');
}

function findRoomForItem(rooms: Room[], item: DraftQueueItem) {
	return rooms.find((room) => room.type === item.preferredRoomType) ?? rooms[0];
}

function minutes(value: string) {
	const [hour, minute] = value.split(':').map(Number);
	return (hour ?? 0) * 60 + (minute ?? 0);
}

function candidateSlots(board: DraftBoard) {
	const sorted = board.classPeriodSlots
		.filter((slot) => !slot.isSpecialEvent && slot.startTime >= '07:30')
		.filter((slot, index, slots) => slots.findIndex((candidate) => candidate.startTime === slot.startTime && candidate.endTime === slot.endTime) === index)
		.sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || minutes(a.endTime) - minutes(b.endTime));
	const selected: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean }> = [];
	for (const slot of sorted) {
		if (selected.every((candidate) => minutes(slot.startTime) >= minutes(candidate.endTime) || minutes(slot.endTime) <= minutes(candidate.startTime))) {
			selected.push(slot);
		}
		if (selected.length >= 6) break;
	}
	return selected;
}

function placementInput(item: DraftQueueItem, room: Room, slot: { startTime: string; endTime: string }, note: string): PlacementInput {
	const facultyId = item.facultyOptions?.[0];
	expect(Number.isFinite(facultyId), `Queue item ${item.subjectCode} ${item.sectionName} must have a faculty option.`).toBeTruthy();
	return {
		entryKind: item.entryKind,
		sectionId: item.sectionId,
		subjectId: item.subjectId,
		facultyId: Number(facultyId),
		roomId: room.id,
		day: 'MONDAY',
		startTime: slot.startTime,
		endTime: slot.endTime,
		cohortCode: item.cohortCode ?? null,
		notes: note,
	};
}

function findPlacementByInput(board: DraftBoard, input: PlacementInput, excludeIds = new Set<number>()) {
	return board.placements.find((placement) => !excludeIds.has(placement.id)
		&& placement.status === 'DRAFT'
		&& placement.entryKind === input.entryKind
		&& placement.sectionId === input.sectionId
		&& placement.subjectId === input.subjectId
		&& placement.facultyId === input.facultyId
		&& placement.roomId === input.roomId
		&& placement.day === input.day
		&& placement.startTime === input.startTime
		&& placement.endTime === input.endTime
		&& (placement.cohortCode ?? null) === input.cohortCode);
}

async function previewPlacement(request: APIRequestContext, schoolYearId: number, input: PlacementInput) {
	return apiPost<{ allowed?: boolean; hardViolations?: unknown[] }>(request, draftPath(schoolYearId, '/preview'), input);
}

async function commitPlacement(request: APIRequestContext, schoolYearId: number, input: PlacementInput) {
	const result = await apiPost<DraftBoardEnvelope>(request, draftPath(schoolYearId, '/commit'), { ...input, allowSoftOverride: true });
	return 'placements' in result ? result : result.board;
}

async function previewSwap(request: APIRequestContext, schoolYearId: number, source: DraftPlacement, target: DraftPlacement) {
	return apiPost<{ sourcePreview?: { hardViolations?: unknown[] }; displacedPreview?: { hardViolations?: unknown[] }; error?: string }>(
		request,
		draftPath(schoolYearId, '/swap/preview'),
		{
			sourcePlacementId: source.id,
			targetPlacementId: target.id,
			sourceExpectedVersion: source.version,
			targetExpectedVersion: target.version,
		},
	);
}

async function undoDraftAction(request: APIRequestContext, schoolYearId: number) {
	const result = await apiPost<DraftBoardEnvelope>(request, draftPath(schoolYearId, '/undo'), {});
	return 'placements' in result ? result : result.board;
}

async function swapPlacements(request: APIRequestContext, schoolYearId: number, source: DraftPlacement, target: DraftPlacement) {
	const result = await apiPost<DraftBoardEnvelope>(request, draftPath(schoolYearId, '/swap'), {
		sourcePlacementId: source.id,
		targetPlacementId: target.id,
		sourceExpectedVersion: source.version,
		targetExpectedVersion: target.version,
	});
	return 'placements' in result ? result : result.board;
}

async function createOrFindFixture(request: APIRequestContext): Promise<SwapFixture> {
	const schoolYearId = await activeSchoolYearId(request);
	const initialBoard = await loadBoard(request, schoolYearId);
	const initialSignature = placementSignature(initialBoard);
	const complete = initialBoard.placements.filter(completePlacement);
	for (let index = 0; index < complete.length; index += 1) {
		for (let other = index + 1; other < complete.length; other += 1) {
			const source = complete[index]!;
			const target = complete[other]!;
			if (source.id === target.id) continue;
			const preview = await previewSwap(request, schoolYearId, source, target);
			if (!preview.error && (preview.sourcePreview?.hardViolations?.length ?? 0) === 0 && (preview.displacedPreview?.hardViolations?.length ?? 0) === 0) {
				return {
					schoolYearId,
					source,
					target,
					createdPlacementIds: [],
					undoCount: 0,
					initialSignature,
					sectionName: source.sectionName ?? `Section ${source.sectionId}`,
					sectionId: source.sectionId,
				};
			}
		}
	}

	const rooms = await loadTeachingRooms(request);
	expect(rooms.length, 'At least one teaching room is required for the draft swap fixture.').toBeGreaterThan(0);
	const slots = candidateSlots(initialBoard);
	expect(slots.length, 'At least two ordinary class slots are required for the draft swap fixture.').toBeGreaterThanOrEqual(2);
	const queue = initialBoard.queue.filter((item) => (item.facultyOptions?.length ?? 0) > 0);
	expect(queue.length, 'At least two draft queue items with Teaching Load owners are required for the draft swap fixture.').toBeGreaterThanOrEqual(2);

	let board = initialBoard;
	const createdPlacementIds: number[] = [];
	for (let firstIndex = 0; firstIndex < Math.min(queue.length, 40); firstIndex += 1) {
		const first = queue[firstIndex]!;
		const second = queue.find((item, index) => index !== firstIndex && item.sectionId === first.sectionId && (item.facultyOptions?.length ?? 0) > 0)
			?? queue.find((item, index) => index !== firstIndex && (item.facultyOptions?.length ?? 0) > 0);
		if (!second) continue;
		const firstRoom = findRoomForItem(rooms, first);
		const secondRoom = findRoomForItem(rooms, second);
		const firstInput = placementInput(first, firstRoom, slots[0]!, `${FIXTURE_NOTE} A`);
		const secondInput = placementInput(second, secondRoom, slots[1]!, `${FIXTURE_NOTE} B`);
		const firstPreview = await previewPlacement(request, schoolYearId, firstInput);
		const secondPreview = await previewPlacement(request, schoolYearId, secondInput);
		if (!firstPreview.allowed || (firstPreview.hardViolations?.length ?? 0) > 0) continue;
		if (!secondPreview.allowed || (secondPreview.hardViolations?.length ?? 0) > 0) continue;

		let source: DraftPlacement | undefined;
		try {
			board = await commitPlacement(request, schoolYearId, firstInput);
			source = findPlacementByInput(board, firstInput);
			if (!source) {
				await undoDraftAction(request, schoolYearId).catch(() => null);
				throw new Error('Created source draft placement was not returned by the draft board.');
			}
			createdPlacementIds.push(source.id);

			board = await commitPlacement(request, schoolYearId, secondInput);
		} catch (error) {
			await undoDraftAction(request, schoolYearId).catch(() => null);
			throw error;
		}
		const target = findPlacementByInput(board, secondInput, new Set([source.id]));
		if (!target) {
			await undoDraftAction(request, schoolYearId).catch(() => null);
			await undoDraftAction(request, schoolYearId).catch(() => null);
			throw new Error('Created target draft placement was not returned by the draft board.');
		}
		createdPlacementIds.push(target.id);

		const swapPreview = await previewSwap(request, schoolYearId, source, target);
		if (!swapPreview.error && (swapPreview.sourcePreview?.hardViolations?.length ?? 0) === 0 && (swapPreview.displacedPreview?.hardViolations?.length ?? 0) === 0) {
			return {
				schoolYearId,
				source,
				target,
				createdPlacementIds,
				undoCount: 2,
				initialSignature,
				sectionName: first.sectionName,
				sectionId: first.sectionId,
			};
		}
		await undoDraftAction(request, schoolYearId).catch(() => null);
		await undoDraftAction(request, schoolYearId).catch(() => null);
		break;
	}
	throw new Error('No deterministic draft swap fixture could be created.');
}

async function restoreFixture(request: APIRequestContext, fixture: SwapFixture, undoCount: number) {
	for (let index = 0; index < undoCount; index += 1) {
		await undoDraftAction(request, fixture.schoolYearId).catch(() => null);
	}
	let board = await loadBoard(request, fixture.schoolYearId);
	for (const placementId of fixture.createdPlacementIds) {
		if (board.placements.some((placement) => placement.id === placementId && placement.status === 'DRAFT')) {
			await apiDelete(request, draftPath(fixture.schoolYearId, `/${placementId}`)).catch(() => null);
			board = await loadBoard(request, fixture.schoolYearId);
		}
	}
	const restoredSignature = placementSignature(await loadBoard(request, fixture.schoolYearId));
	expect(restoredSignature, 'Draft swap fixture cleanup must restore the original draft placement signatures.').toBe(fixture.initialSignature);
}

async function chooseSectionSchedule(page: Page, sectionName: string) {
	const switcher = page.getByTestId('timetable-simple-schedule-switcher');
	await expect(switcher).toBeVisible({ timeout: 20_000 });
	if ((await switcher.getAttribute('data-view-mode')) !== 'section') {
		await switcher.getByTestId('timetable-simple-view-mode-select').click();
		await page.getByRole('option', { name: /^Section$/i }).click();
	}
	await switcher.getByTestId('timetable-simple-entity-select').getByRole('combobox').click();
	const popover = page.locator('[data-radix-popper-content-wrapper]').last();
	await popover.locator('input').fill(sectionName);
	await popover.getByRole('button', { name: new RegExp(sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first().click();
}

async function ensureFixtureEntriesVisible(page: Page, fixture: SwapFixture) {
	const sourceEntry = page.locator(`[data-timetable-entry-id="draft-placement-${fixture.source.id}"]`).first();
	const targetEntry = page.locator(`[data-timetable-entry-id="draft-placement-${fixture.target.id}"]`).first();
	try {
		await expect(sourceEntry).toBeVisible({ timeout: 5_000 });
		await expect(targetEntry).toBeVisible({ timeout: 5_000 });
		return { sourceEntry, targetEntry };
	} catch {
		await chooseSectionSchedule(page, fixture.sectionName || `Section ${fixture.sectionId}`);
		await expect(sourceEntry).toBeVisible({ timeout: 30_000 });
		await expect(targetEntry).toBeVisible({ timeout: 30_000 });
		return { sourceEntry, targetEntry };
	}
}

async function entrySlot(page: Page, placementId: number) {
	return page.locator(`[data-timetable-entry-id="draft-placement-${placementId}"]`).evaluate((node) => {
		const cell = node.closest('td') as HTMLElement | null;
		return {
			day: cell?.dataset.day ?? '',
			startTime: cell?.dataset.startTime ?? '',
			endTime: cell?.dataset.endTime ?? '',
		};
	});
}

test.describe.serial('Timetable draft swap live reversible flow', () => {
	test('swaps two draft placements through the browser, verifies data, then reverts', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'desktop', 'desktop-only live fixture: mobile projects verify preview/discovery without repeated writes.');
		test.setTimeout(300_000);

		await page.context().clearCookies();
		await loginAdmin(page);
		let fixture: SwapFixture | null = null;
		let undoCount = 0;

		try {
			await openTimetableSimple(page);
			fixture = await createOrFindFixture(page.request);
			undoCount = fixture.undoCount;

			await openDraftPlanningFromSimpleMore(page);
			const { sourceEntry, targetEntry } = await ensureFixtureEntriesVisible(page, fixture);
			const sourceBefore = await entrySlot(page, fixture.source.id);
			const targetBefore = await entrySlot(page, fixture.target.id);

			await sourceEntry.click();
			await expect(page.getByTestId('simple-selected-primary-action')).toBeVisible({ timeout: 10_000 });
			await page.getByTestId('simple-selected-primary-action').click();
			await targetEntry.click();

			const dialog = page.getByTestId('draft-swap-review-dialog');
			await expect(dialog).toBeVisible({ timeout: 20_000 });
			await expect(dialog.getByTestId('swap-review-feedback')).toBeVisible();
			await expect(dialog.getByTestId('swap-review-feedback')).toContainText(/Ready|Checking|error|Saving|switch/i);
			const save = dialog.getByRole('button', { name: /^Swap sessions$/i });
			await expect(save).toBeEnabled({ timeout: 20_000 });
			await save.click();
			undoCount += 1;
			await expect(dialog).toBeHidden({ timeout: 45_000 });

			const swappedBoard = await loadBoard(page.request, fixture.schoolYearId);
			const sourceAfter = swappedBoard.placements.find((placement) => placement.id === fixture!.source.id);
			const targetAfter = swappedBoard.placements.find((placement) => placement.id === fixture!.target.id);
			expect(sourceAfter, 'Source placement should still exist after swap.').toBeTruthy();
			expect(targetAfter, 'Target placement should still exist after swap.').toBeTruthy();
			expect(`${sourceAfter!.day}:${sourceAfter!.startTime}:${sourceAfter!.endTime}`).toBe(`${fixture.target.day}:${fixture.target.startTime}:${fixture.target.endTime}`);
			expect(`${targetAfter!.day}:${targetAfter!.startTime}:${targetAfter!.endTime}`).toBe(`${fixture.source.day}:${fixture.source.startTime}:${fixture.source.endTime}`);

			await page.reload({ waitUntil: 'domcontentloaded' });
			await openDraftPlanningFromSimpleMore(page);
			await ensureFixtureEntriesVisible(page, fixture);
			const sourceAfterReload = await entrySlot(page, fixture.source.id);
			const targetAfterReload = await entrySlot(page, fixture.target.id);
			expect(sourceAfterReload).toEqual(targetBefore);
			expect(targetAfterReload).toEqual(sourceBefore);
			await assertNoGlobalOverflow(page);
		} finally {
			if (fixture) await restoreFixture(page.request, fixture, undoCount);
		}
	});

	test('mobile projects skip live draft-swap writes explicitly', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name === 'desktop', 'desktop project owns the live write/revert fixture.');
		await page.context().clearCookies();
		await loginAdmin(page);
		await openTimetableSimple(page);
		test.skip(true, 'desktop-only live fixture: mobile projects avoid repeated writes against the same live draft board.');
	});
});
