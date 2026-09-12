import type ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { resolveCanonicalSlotsForPrograms, normalizeGradeLevelSync } from './class-program-slot.service.js';
import { resolvePublishedRun } from './published-schedule.service.js';

export type ExportOptions = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	/** Resolved numeric term index from the verified ordered-term authority (1..termCount). */
	termIndex?: number;
	specializationVisibility?: 'hidden' | 'visible';
	/** Disposable read-only client for source-level export contract tests. */
	client?: any;
	/** Disposable published-run resolver for source-level export contract tests. */
	publishedRunResolver?: (schoolId: number, schoolYearId: number) => Promise<{ source: { runId: number }; entries: ScheduledEntry[]; summary: Record<string, unknown> | null }>;
	/** Disposable workbook factory for layout contract tests (no XLSX dependency). */
	workbookFactory?: () => ExcelJS.Workbook | Promise<ExcelJS.Workbook>;
};

type TimeSlot = {
	startTime: string;
	endTime: string;
	isSpecialEvent?: boolean;
	eventName?: string;
	dayOfWeek?: string;
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

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const WEEKDAY_SHORT: Record<string, string> = {
	MONDAY: 'MON',
	TUESDAY: 'TUE',
	WEDNESDAY: 'WED',
	THURSDAY: 'THU',
	FRIDAY: 'FRI',
};

/** One effective cell identity: (day, interval, section, subject, faculty, room). */
type GridEntry = {
	day: string;
	teacher: string;
	subject: string;
	room: string;
	isSpecialization: boolean;
	minutes: number;
};

function toMinutes(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

function resolveSpecialEventDay(eventName: string | undefined, dayOfWeek: string | undefined): string | null {
	const explicit = (dayOfWeek ?? '').trim().toUpperCase();
	if (explicit) return explicit;
	if ((eventName ?? '').toUpperCase().includes('FLAG')) return 'MONDAY';
	return null;
}

/** The day-scoped special event that occupies a class interval on a weekday, if any. */
function specialEventLabelForSlot(
	events: TimeSlot[],
	day: string,
	startTime: string,
	endTime: string,
): string | null {
	const slotStart = toMinutes(startTime);
	const slotEnd = toMinutes(endTime);
	for (const event of events) {
		const eventDay = resolveSpecialEventDay(event.eventName, event.dayOfWeek);
		if (eventDay && eventDay !== day) continue;
		if (toMinutes(event.startTime) < slotEnd && slotStart < toMinutes(event.endTime)) {
			return event.eventName ?? 'Special Event';
		}
	}
	return null;
}

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

async function createWorkbook(options?: ExportOptions): Promise<ExcelJS.Workbook> {
	if (options?.workbookFactory) return options.workbookFactory();
	const { default: ExcelJSRuntime } = await import('exceljs');
	return new ExcelJSRuntime.Workbook();
}

function formatTime12h(time24: string): string {
	const [h, m] = time24.split(':').map(Number);
	const period = h >= 12 ? 'PM' : 'AM';
	const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function getBreakLabel(eventName: string | undefined, dayOfWeek?: string): string {
	if (!eventName) return '';
	const upper = eventName.toUpperCase();
	const label = upper.includes('RECESS') || upper.includes('BREAK')
		? eventName.toUpperCase()
		: upper.includes('LUNCH')
			? 'LUNCH BREAK'
			: upper.includes('FLAG')
				? 'FLAG CEREMONY'
				: eventName;
	return dayOfWeek ? `${dayOfWeek} - ${label}` : label;
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

export async function loadExportContext(options: ExportOptions): Promise<ExportContext> {
	const { schoolId, schoolYearId, runId } = options;
	// The injected test client is a partial read-only stub; keep the production
	// Prisma delegate typing for callbacks and query results.
	const db = (options.client ?? prisma) as typeof prisma;

	const [run, school, schoolYearMirror] = await Promise.all([
		db.generationRun.findFirst({
			where: { id: runId, schoolId, schoolYearId },
			select: { id: true, status: true, summary: true, draftEntries: true },
		}),
		db.school.findUnique({
			where: { id: schoolId },
			select: { name: true },
		}),
		db.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, enrollProSchoolYearId: schoolYearId },
			select: { yearLabel: true },
		}),
	]);

	if (!run) throw new Error('RUN_NOT_FOUND');
	if (run.status !== 'COMPLETED' && !(run.summary as Record<string, unknown>)?.isPublished) {
		throw new Error('RUN_NOT_COMPLETED');
	}

	let summary = run.summary as Record<string, unknown> | null;
	let entries = (run.draftEntries ?? []) as unknown as ScheduledEntry[];

	// A published export must use the revision-effective published source, not
	// the pre-revision draft JSON stored on the generation run. The public
	// resolver also enforces the immutable publication binding and applies all
	// effective revisions before we shape workbook cells.
	if (summary?.isPublished === true) {
		const resolvePublished = options.publishedRunResolver ?? resolvePublishedRun;
		const published = await resolvePublished(schoolId, schoolYearId);
		if (published.source.runId !== runId) {
			// The export URL is run-scoped; never silently substitute the latest
			// published run when a caller asks for a different published identity.
			throw new Error('RUN_NOT_FOUND');
		}
		entries = published.entries as ScheduledEntry[];
		summary = published.summary;
	}
	const displaySlots = (summary?.timetableDisplaySlots as TimeSlot[] | undefined) ?? [];

	// Term filtering for export. The caller resolves `active` through the
	// persisted verified EnrollPro term authority before reaching this service,
	// so only an explicit contract-validated numeric index arrives here.
	if (options.termIndex !== undefined) {
		const resolvedTermIndex = options.termIndex;
		if (entries.some((entry) => (entry as ScheduledEntry & { termIndex?: number }).termIndex == null)) {
			throw new Error('TERM_FILTER_NOT_READY');
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
		db.sectionMirror.findMany({
			where: { schoolId, schoolYearId },
			select: { id: true, externalId: true, name: true, gradeLevelId: true },
		}),
		db.facultyMirror.findMany({
			where: { schoolId },
			select: { id: true, lastName: true, firstName: true, advisedSectionId: true },
		}),
		db.subject.findMany({
			where: { schoolId },
			select: { id: true, name: true, code: true },
		}),
		roomIds.length > 0
			? db.room.findMany({
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

export function buildEntryGrid(
	entries: ScheduledEntry[],
	subjectMap: Map<number, { id: number; name: string; code: string }>,
	facultyMap: Map<number, { id: number; lastName: string | null; firstName: string | null }>,
	roomMap: Map<number, RoomInfo>,
): Map<string, GridEntry> {
	const grid = new Map<string, GridEntry>();
	for (const entry of entries) {
		// Weekday is part of the cell identity: a Monday entry must never populate
		// Tuesday-Friday, and same-interval entries on different days coexist.
		const key = `${entry.sectionId}-${entry.day}-${entry.startTime}-${entry.endTime}`;
		if (grid.has(key)) continue;
		const subj = subjectMap.get(entry.subjectId);
		const subjectCode = subj?.code?.trim().toUpperCase();
		if (subjectCode === 'HG' || subjectCode === 'ARAL') continue;
		const fac = entry.facultyId ? facultyMap.get(entry.facultyId) : null;
		const room = entry.roomId ? roomMap.get(entry.roomId) : undefined;
		grid.set(key, {
			day: entry.day,
			teacher: fac?.lastName ? (fac.firstName ? `${fac.lastName}, ${fac.firstName}` : fac.lastName) : 'Unassigned',
			subject: subj?.name ?? subj?.code ?? `Subject #${entry.subjectId}`,
			room: formatRoomLabel(room),
			isSpecialization: isSpecializationSubject(subj),
			minutes: entry.durationMinutes ?? Math.max(0, toMinutes(entry.endTime) - toMinutes(entry.startTime)),
		});
	}
	return grid;
}

/** Collect the day-distinct grid entries that share one section + interval. */
function collectDayEntries(
	grid: Map<string, GridEntry>,
	sectionId: number,
	startTime: string,
	endTime: string,
): GridEntry[] {
	const collected: GridEntry[] = [];
	for (const day of WEEKDAYS) {
		const entry = grid.get(`${sectionId}-${day}-${startTime}-${endTime}`);
		if (entry) collected.push(entry);
	}
	return collected;
}

/**
 * Internal grade-monitoring cell text. Never silently drops a weekday: when the
 * same interval holds different day entries, each is day-tagged.
 */
function formatDayTaggedField(entries: GridEntry[], field: 'teacher' | 'subject'): string {
	const values = entries
		.map((entry) => ({ day: entry.day, value: field === 'teacher' ? entry.teacher : entry.subject }))
		.filter((item) => item.value);
	if (values.length === 0) return '';
	if (new Set(values.map((item) => item.day)).size === 1) return values[0].value;
	return values.map((item) => `${WEEKDAY_SHORT[item.day] ?? item.day}: ${item.value}`).join(' / ');
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

	const allSlots = [...ctx.displaySlots].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
	const periodSlots = allSlots.filter((s) => !s.isSpecialEvent);
	const breakSlots = allSlots.filter((s) => s.isSpecialEvent);

	// The injected test client is a partial read-only stub; keep the production
	// Prisma delegate typing for callbacks and query results.
	const db = (options.client ?? prisma) as typeof prisma;
	const sections = await db.sectionMirror.findMany({
		where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
		select: { id: true, externalId: true, name: true, gradeLevelId: true },
	});

	const sortedSections = [...sections].sort((a, b) => {
		if (a.gradeLevelId !== b.gradeLevelId) return a.gradeLevelId - b.gradeLevelId;
		return a.name.localeCompare(b.name);
	});

	const entryGrid = buildEntryGrid(ctx.entries, ctx.subjectMap, ctx.facultyMap, ctx.roomMap);

	const workbook = await createWorkbook(options);
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
				const label = getBreakLabel(item.slot.eventName, item.slot.dayOfWeek);
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
					const dayEntries = collectDayEntries(entryGrid, sec.externalId, item.slot.startTime, item.slot.endTime);
					teacherRow.getCell(col + 2).value = formatDayTaggedField(dayEntries, 'teacher');
				});
				row++;

				// Subject row
				const subjectRow = sheet.getRow(row);
				subjectRow.getCell(1).value = '';
				band.forEach((sec, col) => {
					const dayEntries = collectDayEntries(entryGrid, sec.externalId, item.slot.startTime, item.slot.endTime);
					subjectRow.getCell(col + 2).value = formatDayTaggedField(dayEntries, 'subject');
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
	// The injected test client is a partial read-only stub; keep the production
	// Prisma delegate typing for callbacks and query results.
	const db = (options.client ?? prisma) as typeof prisma;

	const sections = await db.sectionMirror.findMany({
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

	const workbook = await createWorkbook(options);
	workbook.creator = 'ATLAS';

	// Per-section beneficiary layout: one five-weekday block per section. The
	// grade-wide section-by-time matrix remains only in the SUMMARY sheet.
	for (const [gradeLevel, gradeSections] of gradeGroups) {
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
			breakSlots.map(s => ({ startTime: s.startTime, endTime: s.endTime, isSpecialEvent: true, eventName: s.subjectLabel ?? undefined, dayOfWeek: s.dayOfWeek ?? undefined })),
		);

		const specialEventSlots = ctx.displaySlots.filter((slot) => slot.isSpecialEvent);

		const sheetName = `Grade ${gradeLevel}`;
		const sheet = workbook.addWorksheet(sheetName);
		addReportHeader(sheet, ctx, `CLASS PROGRAM - Grade ${gradeLevel}`);
		sheet.columns.forEach((col) => { col.width = 16; });

		let rowCursor = 4;
		for (const section of gradeSections) {
			const sectionRow = sheet.getRow(rowCursor);
			sectionRow.getCell(1).value = `SECTION: ${section.name}`;
			sectionRow.getCell(1).font = { bold: true, size: 12 };
			sectionRow.getCell(4).value = `ADVISER: ${ctx.adviserMap.get(section.externalId) ?? ''}`;
			sectionRow.getCell(7).value = `BLDG./RM.: ${formatRoomLabel(sectionRoomMap.get(section.externalId))}`;
			rowCursor++;

			const headerRow = sheet.getRow(rowCursor);
			headerRow.getCell(1).value = 'TIME';
			headerRow.getCell(2).value = 'MINUTES';
			WEEKDAYS.forEach((day, dayIndex) => { headerRow.getCell(dayIndex + 3).value = day; });
			headerRow.font = { bold: true };
			rowCursor++;

			for (const item of orderedSlots) {
				const row = sheet.getRow(rowCursor);
				const startTime = item.slot.startTime;
				const endTime = item.slot.endTime;
				row.getCell(1).value = item.type === 'break'
					? getBreakLabel(item.slot.eventName)
					: item.slot.isSpecialization
						? `SPECIALIZATION ${formatTime12h(startTime)}-${formatTime12h(endTime)}`
						: `${formatTime12h(startTime)}-${formatTime12h(endTime)}`;
				row.getCell(2).value = Math.max(0, toMinutes(endTime) - toMinutes(startTime));

				WEEKDAYS.forEach((day, dayIndex) => {
					const cell = row.getCell(dayIndex + 3);
					if (item.type === 'break') {
						const eventDay = resolveSpecialEventDay(item.slot.eventName, item.slot.dayOfWeek);
						cell.value = eventDay && eventDay !== day ? '' : getBreakLabel(item.slot.eventName);
						return;
					}
					// A Monday-only Flag/HGP event occupies only Monday's cell; the
					// same interval stays an ordinary class period on other weekdays.
					const eventLabel = specialEventLabelForSlot(specialEventSlots, day, startTime, endTime);
					if (eventLabel) {
						cell.value = eventLabel;
						return;
					}
					const entry = entryGrid.get(`${section.externalId}-${day}-${startTime}-${endTime}`);
					if (!entry) { cell.value = ''; return; }
					if (visibility === 'hidden' && entry.isSpecialization) { cell.value = ''; return; }
					cell.value = entry.teacher ? `${entry.subject}\n${entry.teacher}` : entry.subject;
				});
				rowCursor++;
			}

			rowCursor += 1; // blank separator between sections
		}
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
