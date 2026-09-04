import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { resolveCanonicalSlotsForPrograms, normalizeGradeLevelSync } from './class-program-slot.service.js';

type ExportOptions = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	termIndex?: number | 'active';
	specializationVisibility?: 'hidden' | 'visible';
};

type TimeSlot = {
	startTime: string;
	endTime: string;
	isSpecialEvent?: boolean;
	eventName?: string;
	isSpecialization?: boolean;
};

type ScheduledEntry = {
	entryId: string;
	facultyId: number | null;
	roomId: number;
	subjectId: number;
	sectionId: number;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
};

type RoomInfo = {
	id: number;
	name: string;
	type: string;
	floor: number | null;
	buildingId: number;
	buildingName: string;
};

type ExportContext = {
	schoolName: string;
	yearLabel: string;
	runId: number;
	subjectMap: Map<number, { id: number; name: string; code: string }>;
	facultyMap: Map<number, { id: number; lastName: string | null; firstName: string | null; advisedSectionId: number | null }>;
	roomMap: Map<number, RoomInfo>;
	adviserMap: Map<number, string>;
	displaySlots: TimeSlot[];
	entries: ScheduledEntry[];
};

function formatTime12h(time24: string): string {
	const [h, m] = time24.split(':').map(Number);
	const period = h >= 12 ? 'PM' : 'AM';
	const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function getBreakLabel(eventName: string | undefined): string {
	if (!eventName) return '';
	const upper = eventName.toUpperCase();
	if (upper.includes('RECESS') || upper.includes('BREAK')) return eventName.toUpperCase();
	if (upper.includes('LUNCH')) return 'LUNCH BREAK';
	if (upper.includes('FLAG')) return 'FLAG CEREMONY';
	return eventName;
}

function formatRoomLabel(room: RoomInfo | undefined): string {
	if (!room) return '';
	return `${room.buildingName} / ${room.name}`;
}

function resolveSectionGradeLevel(section: { gradeLevelId: number; gradeLevelName?: string | null }): number {
	const fromName = section.gradeLevelName?.match(/Grade\s+(\d+)/i);
	if (fromName) return parseInt(fromName[1], 10);
	return normalizeGradeLevelSync(section.gradeLevelId);
}

function isSpecializationSubject(subject: { name?: string | null; code?: string | null } | undefined): boolean {
	const code = (subject?.code ?? '').trim().toUpperCase();
	const name = (subject?.name ?? '').trim().toUpperCase();
	return code.includes('_SPEC')
		|| code.includes('SPECIALIZATION')
		|| name.includes('SPECIALIZATION')
		|| name.startsWith('SPECIAL PROGRAM ');
}

async function loadExportContext(options: ExportOptions): Promise<ExportContext> {
	const { schoolId, schoolYearId, runId } = options;

	const [run, school, schoolYearMirror] = await Promise.all([
		prisma.generationRun.findFirst({
			where: { id: runId, schoolId, schoolYearId },
			select: { id: true, status: true, summary: true, draftEntries: true },
		}),
		prisma.school.findUnique({
			where: { id: schoolId },
			select: { name: true },
		}),
		prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, enrollProSchoolYearId: schoolYearId },
			select: { yearLabel: true },
		}),
	]);

	if (!run) throw new Error('RUN_NOT_FOUND');
	if (run.status !== 'COMPLETED' && !(run.summary as Record<string, unknown>)?.isPublished) {
		throw new Error('RUN_NOT_COMPLETED');
	}

	const summary = run.summary as Record<string, unknown> | null;
	const displaySlots = (summary?.timetableDisplaySlots as TimeSlot[] | undefined) ?? [];
	let entries = (run.draftEntries ?? []) as unknown as ScheduledEntry[];

	// Term filtering for export
	if (options.termIndex !== undefined) {
		let resolvedTermIndex: number;

		if (options.termIndex === 'active') {
			try {
				const { fetchEnrollProActiveTerm } = await import('./active-term-adapter.service.js');
				const activeTermResult = await fetchEnrollProActiveTerm();
				if (!activeTermResult.verified || activeTermResult.termIndex === null) {
					throw new Error('TERM_FILTER_NOT_READY');
				}
				resolvedTermIndex = activeTermResult.termIndex;
			} catch {
				throw new Error('TERM_FILTER_NOT_READY');
			}
		} else {
			resolvedTermIndex = options.termIndex;
		}

		entries = entries.filter((entry) => {
			const entryTermIndex = (entry as any).termIndex;
			return entryTermIndex != null && entryTermIndex === resolvedTermIndex;
		});
	}

	// Collect unique room IDs from entries
	const roomIds = [...new Set(entries.map((e) => e.roomId).filter((id): id is number => id != null && id > 0))];

	// Load all reference data in parallel
	const [sections, faculty, subjects, rooms] = await Promise.all([
		prisma.sectionMirror.findMany({
			where: { schoolId, schoolYearId },
			select: { id: true, externalId: true, name: true, gradeLevelId: true },
		}),
		prisma.facultyMirror.findMany({
			where: { schoolId },
			select: { id: true, lastName: true, firstName: true, advisedSectionId: true },
		}),
		prisma.subject.findMany({
			where: { schoolId },
			select: { id: true, name: true, code: true },
		}),
		roomIds.length > 0
			? prisma.room.findMany({
				where: { id: { in: roomIds } },
				select: {
					id: true,
					name: true,
					type: true,
					floor: true,
					building: { select: { id: true, name: true } },
				},
			})
			: Promise.resolve([]),
	]);

	const subjectMap = new Map(subjects.map((s) => [s.id, s]));
	const facultyMap = new Map(faculty.map((f) => [f.id, f]));

	const roomMap = new Map<number, RoomInfo>();
	for (const r of rooms) {
		roomMap.set(r.id, {
			id: r.id,
			name: r.name,
			type: r.type,
			floor: r.floor,
			buildingId: r.building.id,
			buildingName: r.building.name,
		});
	}

	const adviserMap = new Map<number, string>();
	for (const f of faculty) {
		if (f.advisedSectionId) adviserMap.set(f.advisedSectionId, f.lastName ?? '');
	}

	return {
		schoolName: school?.name ?? '',
		yearLabel: schoolYearMirror?.yearLabel ?? '',
		runId,
		subjectMap,
		facultyMap,
		roomMap,
		adviserMap,
		displaySlots,
		entries,
	};
}

function buildEntryGrid(
	entries: ScheduledEntry[],
	subjectMap: Map<number, { id: number; name: string; code: string }>,
	facultyMap: Map<number, { id: number; lastName: string | null; firstName: string | null }>,
	roomMap: Map<number, RoomInfo>,
): Map<string, { teacher: string; subject: string; room: string; isSpecialization: boolean }> {
	const grid = new Map<string, { teacher: string; subject: string; room: string; isSpecialization: boolean }>();
	for (const entry of entries) {
		const key = `${entry.sectionId}-${entry.startTime}-${entry.endTime}`;
		if (grid.has(key)) continue;
		const subj = subjectMap.get(entry.subjectId);
		const fac = entry.facultyId ? facultyMap.get(entry.facultyId) : null;
		const room = entry.roomId ? roomMap.get(entry.roomId) : undefined;
		grid.set(key, {
			teacher: fac?.lastName ? (fac.firstName ? `${fac.lastName}, ${fac.firstName}` : fac.lastName) : 'Unassigned',
			subject: subj?.name ?? subj?.code ?? `Subject #${entry.subjectId}`,
			room: formatRoomLabel(room),
			isSpecialization: isSpecializationSubject(subj),
		});
	}
	return grid;
}

function interleaveSlots(periodSlots: TimeSlot[], breakSlots: TimeSlot[]): Array<{ type: 'period' | 'break'; slot: TimeSlot }> {
	const result: Array<{ type: 'period' | 'break'; slot: TimeSlot }> = [];
	let periodIdx = 0;
	let breakIdx = 0;
	while (periodIdx < periodSlots.length || breakIdx < breakSlots.length) {
		const nextPeriod = periodSlots[periodIdx];
		const nextBreak = breakSlots[breakIdx];
		if (!nextPeriod) {
			result.push({ type: 'break', slot: nextBreak });
			breakIdx++;
		} else if (!nextBreak) {
			result.push({ type: 'period', slot: nextPeriod });
			periodIdx++;
		} else if (nextPeriod.startTime <= nextBreak.startTime) {
			result.push({ type: 'period', slot: nextPeriod });
			periodIdx++;
		} else {
			result.push({ type: 'break', slot: nextBreak });
			breakIdx++;
		}
	}
	return result;
}

function addReportHeader(
	sheet: ExcelJS.Workbook['worksheets'][number],
	ctx: ExportContext,
	title: string,
) {
	const headerRow = sheet.getRow(1);
	headerRow.getCell(1).value = title;
	headerRow.getCell(1).font = { bold: true, size: 14 };

	const metaRow = sheet.getRow(2);
	metaRow.getCell(1).value = `School: ${ctx.schoolName}`;
	metaRow.getCell(1).font = { italic: true };
	metaRow.getCell(2).value = `Year: ${ctx.yearLabel}`;
	metaRow.getCell(2).font = { italic: true };
	metaRow.getCell(3).value = `Run: ${ctx.runId}`;
	metaRow.getCell(3).font = { italic: true };
	metaRow.getCell(4).value = `Generated: ${new Date().toISOString().split('T')[0]}`;
	metaRow.getCell(4).font = { italic: true };
}

export async function exportSummaryWorkbook(options: ExportOptions): Promise<Buffer> {
	const ctx = await loadExportContext(options);

	const allSlots = [...ctx.displaySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
	const periodSlots = allSlots.filter((s) => !s.isSpecialEvent);
	const breakSlots = allSlots.filter((s) => s.isSpecialEvent);

	const sections = await prisma.sectionMirror.findMany({
		where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
		select: { id: true, externalId: true, name: true, gradeLevelId: true },
	});

	const sortedSections = [...sections].sort((a, b) => {
		if (a.gradeLevelId !== b.gradeLevelId) return a.gradeLevelId - b.gradeLevelId;
		return a.name.localeCompare(b.name);
	});

	const entryGrid = buildEntryGrid(ctx.entries, ctx.subjectMap, ctx.facultyMap, ctx.roomMap);

	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'ATLAS';

	const MAX_SECTIONS = 12;
	const bands: Array<typeof sortedSections> = [];
	for (let i = 0; i < sortedSections.length; i += MAX_SECTIONS) {
		bands.push(sortedSections.slice(i, i + MAX_SECTIONS));
	}

	const sheet = workbook.addWorksheet('SUMMARY');
	addReportHeader(sheet, ctx, 'CLASS-MONITORING SUMMARY');

	const orderedSlots = interleaveSlots(periodSlots, breakSlots);

	for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
		const band = bands[bandIdx];
		// header(1) + meta(1) + blank(1) + section(1) + adviser(1) + data rows
		const dataStartRow = 4 + bandIdx * (orderedSlots.reduce((sum, item) => sum + (item.type === 'break' ? 1 : 2), 0) + 3);
		const startRow = bandIdx === 0 ? 4 : dataStartRow;

		// Section header
		const headerRow = sheet.getRow(startRow);
		headerRow.getCell(1).value = 'TIME';
		headerRow.getCell(1).font = { bold: true };
		band.forEach((sec, col) => {
			headerRow.getCell(col + 2).value = sec.name;
			headerRow.getCell(col + 2).font = { bold: true };
		});

		// Adviser row
		const adviserRow = sheet.getRow(startRow + 1);
		adviserRow.getCell(1).value = 'ADVISER';
		adviserRow.getCell(1).font = { bold: true };
		band.forEach((sec, col) => {
			adviserRow.getCell(col + 2).value = ctx.adviserMap.get(sec.externalId) ?? '';
		});

		let row = startRow + 2;
		for (const item of orderedSlots) {
			if (item.type === 'break') {
				const label = getBreakLabel(item.slot.eventName);
				const r = sheet.getRow(row);
				r.getCell(1).value = label;
				r.getCell(1).font = { bold: true };
				band.forEach((_, col) => { r.getCell(col + 2).value = label; });
				row++;
			} else {
				// Teacher row
				const teacherRow = sheet.getRow(row);
				teacherRow.getCell(1).value = `${formatTime12h(item.slot.startTime)}-${formatTime12h(item.slot.endTime)}`;
				band.forEach((sec, col) => {
					const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
					teacherRow.getCell(col + 2).value = entry?.teacher ?? '';
				});
				row++;

				// Subject row
				const subjectRow = sheet.getRow(row);
				subjectRow.getCell(1).value = '';
				band.forEach((sec, col) => {
					const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
					subjectRow.getCell(col + 2).value = entry?.subject ?? '';
				});
				row++;
			}
		}
	}

	sheet.columns.forEach((col) => { col.width = 18; });

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}

export async function exportClassProgramWorkbook(options: ExportOptions): Promise<Buffer> {
	const ctx = await loadExportContext(options);
	const visibility = options.specializationVisibility ?? 'hidden';

	const sections = await prisma.sectionMirror.findMany({
		where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
		select: { id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true, programType: true },
	});

	const sortedSections = [...sections].sort((a, b) => {
		const gradeA = resolveSectionGradeLevel(a);
		const gradeB = resolveSectionGradeLevel(b);
		if (gradeA !== gradeB) return gradeA - gradeB;
		return a.name.localeCompare(b.name);
	});

	const entryGrid = buildEntryGrid(ctx.entries, ctx.subjectMap, ctx.facultyMap, ctx.roomMap);

	// Build section -> home room lookup for BLDG./RM. band
	const sectionRoomMap = new Map<number, RoomInfo>();
	const roomCounts = new Map<number, Map<number, number>>();
	for (const entry of ctx.entries) {
		if (!entry.roomId) continue;
		const sec = sections.find((s) => s.externalId === entry.sectionId);
		if (!sec) continue;
		if (!roomCounts.has(sec.externalId)) roomCounts.set(sec.externalId, new Map());
		const counts = roomCounts.get(sec.externalId)!;
		counts.set(entry.roomId, (counts.get(entry.roomId) ?? 0) + 1);
	}
	for (const [secExtId, counts] of roomCounts) {
		let maxCount = 0;
		let bestRoomId = 0;
		for (const [roomId, count] of counts) {
			if (count > maxCount) {
				maxCount = count;
				bestRoomId = roomId;
			}
		}
		const room = ctx.roomMap.get(bestRoomId);
		if (room) sectionRoomMap.set(secExtId, room);
	}

	// Group sections by grade level for per-grade canonical slot rendering
	const gradeGroups = new Map<number, typeof sortedSections>();
	for (const sec of sortedSections) {
		const actualGrade = resolveSectionGradeLevel(sec);
		const arr = gradeGroups.get(actualGrade) ?? [];
		arr.push(sec);
		gradeGroups.set(actualGrade, arr);
	}

	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'ATLAS';

	const MAX_SECTIONS = 7;

	for (const [gradeLevel, gradeSections] of gradeGroups) {
		let sheetRow = 1;
		const hasSpecialProgram = gradeSections.some(s => s.programType && s.programType !== 'REGULAR');
		// Resolve the union of exact templates represented in this grade so mixed
		// regular/special-program sheets retain every stakeholder-defined row.
		const canonicalSlots = await resolveCanonicalSlotsForPrograms(
			options.schoolId,
			options.schoolYearId,
			gradeLevel,
			['REGULAR', ...gradeSections.map((section) => section.programType as any)],
		);

		// Build ordered slot list from canonical slots
		const classSlots = canonicalSlots
			.filter(s => s.rowKind === 'CLASS')
			.filter(s => !(visibility === 'hidden' && hasSpecialProgram && s.subjectLabel === 'Specialization'));
		const breakSlots = canonicalSlots
			.filter(s => s.rowKind === 'BREAK' || s.rowKind === 'CONFLICT');

		const orderedSlots = interleaveSlots(
			classSlots.map(s => ({
				startTime: s.startTime,
				endTime: s.endTime,
				isSpecialEvent: false,
				isSpecialization: visibility === 'visible' && s.subjectLabel === 'Specialization',
			})),
			breakSlots.map(s => ({ startTime: s.startTime, endTime: s.endTime, isSpecialEvent: true, eventName: s.subjectLabel ?? undefined })),
		);

		// Band sections
		const bands: Array<typeof gradeSections> = [];
		for (let i = 0; i < gradeSections.length; i += MAX_SECTIONS) {
			bands.push(gradeSections.slice(i, i + MAX_SECTIONS));
		}

		const sheetName = `Grade ${gradeLevel}`;
		const sheet = workbook.addWorksheet(sheetName);
		addReportHeader(sheet, ctx, `CLASS PROGRAM - Grade ${gradeLevel}`);

		for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
			const band = bands[bandIdx];
			const startRow = sheetRow === 1 ? 5 : sheetRow;

			// SECTION header
			const secRow = sheet.getRow(startRow);
			secRow.getCell(1).value = 'SECTION';
			secRow.getCell(1).font = { bold: true };
			band.forEach((sec, col) => {
				secRow.getCell(col + 2).value = sec.name;
				secRow.getCell(col + 2).font = { bold: true };
			});

			// ADVISER row
			const advRow = sheet.getRow(startRow + 1);
			advRow.getCell(1).value = 'ADVISER';
			advRow.getCell(1).font = { bold: true };
			band.forEach((sec, col) => {
				advRow.getCell(col + 2).value = ctx.adviserMap.get(sec.externalId) ?? '';
			});

			// BLDG./RM. row
			const bldgRow = sheet.getRow(startRow + 2);
			bldgRow.getCell(1).value = 'BLDG./RM.';
			bldgRow.getCell(1).font = { bold: true };
			band.forEach((sec, col) => {
				const room = sectionRoomMap.get(sec.externalId);
				bldgRow.getCell(col + 2).value = formatRoomLabel(room);
			});

			let row = startRow + 3;
			for (const item of orderedSlots) {
				if (item.type === 'break') {
					const label = getBreakLabel(item.slot.eventName);
					const r = sheet.getRow(row);
					r.getCell(1).value = label;
					r.getCell(1).font = { bold: true };
					band.forEach((_, col) => { r.getCell(col + 2).value = label; });
					row++;
				} else {
					// Teacher row
					const teacherRow = sheet.getRow(row);
				teacherRow.getCell(1).value = item.slot.isSpecialization
					? `SPECIALIZATION ${formatTime12h(item.slot.startTime)}-${formatTime12h(item.slot.endTime)}`
					: `${formatTime12h(item.slot.startTime)}-${formatTime12h(item.slot.endTime)}`;
					band.forEach((sec, col) => {
						const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
						teacherRow.getCell(col + 2).value = visibility === 'hidden' && entry?.isSpecialization ? '' : entry?.teacher ?? '';
					});
					row++;

					// Subject row
					const subjectRow = sheet.getRow(row);
					subjectRow.getCell(1).value = '';
					band.forEach((sec, col) => {
						const entry = entryGrid.get(`${sec.externalId}-${item.slot.startTime}-${item.slot.endTime}`);
						subjectRow.getCell(col + 2).value = visibility === 'hidden' && entry?.isSpecialization ? '' : entry?.subject ?? '';
					});
					row++;
				}
			}

			sheetRow = row + 1;
		}

		sheet.columns.forEach((col) => { col.width = 20; });
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
