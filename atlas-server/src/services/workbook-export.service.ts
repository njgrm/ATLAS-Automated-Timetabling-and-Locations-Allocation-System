import type ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { resolveCanonicalSlotsForPrograms, normalizeGradeLevelSync } from './class-program-slot.service.js';
import { resolvePublishedRun } from './published-schedule.service.js';
import { frozenCanonicalSlots, type PublishedIdentitySnapshot } from './published-identity-snapshot.service.js';

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
	publishedRunResolver?: (schoolId: number, schoolYearId: number) => Promise<{ source: { runId: number }; entries: ScheduledEntry[]; summary: Record<string, unknown> | null; snapshot?: PublishedIdentitySnapshot | null }>;
	/** Disposable workbook factory for layout contract tests (no XLSX dependency). */
	workbookFactory?: () => ExcelJS.Workbook | Promise<ExcelJS.Workbook>;
	/** Server-only, transient learner totals for the class-program paste-ready grid. */
	resolveLearnerCounts?: (sectionIds: number[]) => Promise<Map<number, { male: number; female: number; total: number }>>;
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

export function resolveSpecialEventDay(eventName: string | undefined, dayOfWeek: string | undefined): string | null {
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

/** C05 T4/M9 — configurable branding lines; unset values stay blank. */
export type ExportBranding = {
	schoolName: string;
	regionLine: string;
	divisionLine: string;
	districtLine: string;
};

export type ExportContext = {
	schoolName: string;
	yearLabel: string;
	runId: number;
	/** Resolved selected ordered term for this output, when bound. */
	termIndex: number | null;
	/** C05 T4/M9 — persisted/blank branding block above the title. */
	branding: ExportBranding;
	/** Persisted run publication state (C05 T10/M23). */
	publication: {
		isPublished: boolean;
		publishedAt: string | null;
		revisionId: number | null;
	};
	subjectMap: Map<number, { id: number; name: string; code: string }>;
	facultyMap: Map<number, { id: number; lastName: string | null; firstName: string | null; advisedSectionId: number | null }>;
	roomMap: Map<number, RoomInfo>;
	adviserMap: Map<number, string>;
	displaySlots: TimeSlot[];
	entries: ScheduledEntry[];
	/** C08 — the frozen publication snapshot for a published run, or null for a legacy/draft source. */
	frozenSnapshot: PublishedIdentitySnapshot | null;
	/** C08 — the section roster authority (frozen for a published run, live otherwise). */
	sections: Array<{ id: number; externalId: number; name: string; gradeLevelId: number; gradeLevelName?: string | null; programType?: string | null }>;
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

/**
 * C05 T9/M18 — resolve the persisted school-year label used in official output
 * filenames. Returns '' when no persisted label exists so the caller degrades to
 * a stable token instead of fabricating a school year.
 */
export async function resolveExportSchoolYearLabel(schoolId: number, schoolYearId: number, client?: any): Promise<string> {
	const db = (client ?? prisma) as typeof prisma;
	const mirror = await db.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		select: { yearLabel: true },
	});
	return typeof mirror?.yearLabel === 'string' ? mirror.yearLabel.trim() : '';
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
	let frozenSnapshot: PublishedIdentitySnapshot | null = null;

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
		// C08 — a frozen publication resolves every human-readable identity from
		// its snapshot; a legacy publication keeps live resolution.
		frozenSnapshot = published.snapshot ?? null;
	}
	const displaySlots = frozenSnapshot
		? frozenSnapshot.displaySlots.map((slot) => ({
			startTime: slot.startTime,
			endTime: slot.endTime,
			isSpecialEvent: slot.kind === 'SPECIAL_EVENT',
			eventName: slot.kind === 'SPECIAL_EVENT' ? slot.label : undefined,
			dayOfWeek: slot.dayOfWeek ?? undefined,
		}))
		: (summary?.timetableDisplaySlots as TimeSlot[] | undefined) ?? [];

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

	// C08 — frozen-first. For a published run, every human-readable identity is
	// resolved from the frozen snapshot; no output rehydrates labels from current
	// authority tables. Draft/unpublished exports keep live resolution.
	let sections: Array<{ id: number; externalId: number; name: string; gradeLevelId: number; gradeLevelName?: string | null; programType?: string | null }>;
	let subjectMap: Map<number, { id: number; name: string; code: string }>;
	let facultyMap: Map<number, { id: number; lastName: string | null; firstName: string | null; advisedSectionId: number | null }>;
	let roomMap: Map<number, RoomInfo>;
	let adviserMap: Map<number, string>;

	if (frozenSnapshot) {
		sections = Object.entries(frozenSnapshot.sections).map(([key, value]) => ({
			id: value.atlasId ?? Number(key),
			externalId: Number(key),
			name: value.name,
			gradeLevelId: value.gradeLevelId ?? 0,
			gradeLevelName: value.gradeLevelName ?? null,
			programType: value.programType ?? null,
		}));
		subjectMap = new Map(Object.entries(frozenSnapshot.subjects).map(([key, value]) => [Number(key), { id: Number(key), name: value.name, code: value.code }]));
		facultyMap = new Map(Object.entries(frozenSnapshot.faculty).map(([key, value]) => [Number(key), {
			id: Number(key),
			lastName: value.lastName,
			firstName: value.firstName,
			advisedSectionId: value.advisedSectionId ?? null,
		}]));
		roomMap = new Map<number, RoomInfo>();
		for (const [key, value] of Object.entries(frozenSnapshot.rooms)) {
			const id = Number(key);
			const floorNumber = value.floor != null && value.floor.trim().length > 0 ? Number(value.floor) : null;
			roomMap.set(id, {
				id,
				name: value.name,
				type: value.type,
				floor: Number.isFinite(floorNumber as number) ? floorNumber as number : null,
				buildingId: value.buildingId ?? 0,
				buildingName: value.buildingName ?? '',
			});
		}
		adviserMap = new Map<number, string>();
		for (const adviser of Object.values(frozenSnapshot.advisers ?? {})) {
			if (Number.isInteger(adviser.sectionId)) adviserMap.set(adviser.sectionId, adviser.lastName);
		}
	} else {
		const [liveSections, faculty, subjects, rooms] = await Promise.all([
			db.sectionMirror.findMany({
				where: { schoolId, schoolYearId },
				select: { id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true, programType: true },
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

		sections = liveSections;
		subjectMap = new Map(subjects.map((s) => [s.id, s]));
		facultyMap = new Map(faculty.map((f) => [f.id, f]));

		roomMap = new Map<number, RoomInfo>();
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

		adviserMap = new Map<number, string>();
		for (const f of faculty) {
			if (f.advisedSectionId) adviserMap.set(f.advisedSectionId, f.lastName ?? '');
		}
	}

	// C05 T10/M23 — publication state from the persisted run summary (the
	// revision-effective summary for a published run).
	const publicationRecord = (summary as Record<string, unknown> | null)?.publication as { revisionId?: unknown } | undefined;
	const revisionId = Number(publicationRecord?.revisionId);
	const publication = {
		isPublished: (summary as Record<string, unknown> | null)?.isPublished === true,
		publishedAt: typeof (summary as Record<string, unknown> | null)?.publishedAt === 'string'
			? ((summary as Record<string, unknown>).publishedAt as string)
			: null,
		revisionId: Number.isInteger(revisionId) && revisionId > 0 ? revisionId : null,
	};

	return {
		schoolName: school?.name ?? '',
		yearLabel: schoolYearMirror?.yearLabel ?? '',
		runId,
		termIndex: options.termIndex ?? null,
		branding: {
			// School identity comes from persisted configuration; region/division/
			// district have no persisted ATLAS source yet, so they stay blank and
			// are never invented (C05 contract §1.10).
			schoolName: school?.name ?? '',
			regionLine: '',
			divisionLine: '',
			districtLine: '',
		},
		publication,
		subjectMap,
		facultyMap,
		roomMap,
		adviserMap,
		displaySlots,
		entries,
		frozenSnapshot,
		sections,
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

/**
 * C05 T10/M23 — every official output identifies its publication state from the
 * run's persisted publication data. A draft/review run is never indistinguishable
 * from a published one.
 */
function publicationMarker(ctx: ExportContext): string {
	if (ctx.publication.isPublished) {
		const revision = ctx.publication.revisionId != null ? ` — Revision ${ctx.publication.revisionId}` : '';
		const publishedAt = ctx.publication.publishedAt ? ` (${ctx.publication.publishedAt.slice(0, 10)})` : '';
		return `PUBLISHED${revision}${publishedAt}`;
	}
	return 'NOT PUBLISHED — DRAFT/REVIEW';
}

/**
 * C05 T4/M9 — layout contract: rows 1..4 carry the configurable branding block
 * above the title, row 5 the title, row 6 the identity/publication meta row.
 * Section/grade blocks start at `EXPORT_FIRST_BLOCK_ROW`.
 */
export const EXPORT_HEADER_LAST_ROW = 6;
export const EXPORT_FIRST_BLOCK_ROW = EXPORT_HEADER_LAST_ROW + 2;

/**
 * C05 T4/M9 — branding block + identity/publication meta. Only persisted values
 * are printed; unset branding lines render as an empty string (never invented).
 */
export function addReportHeader(
	sheet: ExcelJS.Workbook['worksheets'][number],
	ctx: ExportContext,
	title: string,
) {
	const brandingLines = [
		ctx.branding.schoolName,
		ctx.branding.regionLine,
		ctx.branding.divisionLine,
		ctx.branding.districtLine,
	];
	brandingLines.forEach((line, index) => {
		const row = sheet.getRow(index + 1);
		row.getCell(1).value = line;
		row.getCell(1).font = index === 0 ? { bold: true, size: 12 } : { size: 10 };
	});

	const headerRow = sheet.getRow(5);
	headerRow.getCell(1).value = title;
	headerRow.getCell(1).font = { bold: true, size: 14 };

	const metaRow = sheet.getRow(EXPORT_HEADER_LAST_ROW);
	metaRow.getCell(1).value = `School: ${ctx.schoolName}`;
	metaRow.getCell(1).font = { italic: true };
	metaRow.getCell(2).value = `Year: ${ctx.yearLabel}`;
	metaRow.getCell(2).font = { italic: true };
	metaRow.getCell(3).value = `Term: ${ctx.termIndex != null ? `T${ctx.termIndex}` : ''}`;
	metaRow.getCell(3).font = { italic: true };
	metaRow.getCell(4).value = `Run: ${ctx.runId}`;
	metaRow.getCell(4).font = { italic: true };
	metaRow.getCell(5).value = `Generated: ${new Date().toISOString().split('T')[0]}`;
	metaRow.getCell(5).font = { italic: true };
	metaRow.getCell(6).value = publicationMarker(ctx);
	metaRow.getCell(6).font = { italic: true, bold: true };
}

/** C05 T4/M9 — landscape, fit-to-width print setup for every official sheet. */
export function applyLandscapePrintSetup(sheet: ExcelJS.Workbook['worksheets'][number]) {
	sheet.pageSetup = {
		paperSize: 9, // A4
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
	};
}

/** C05 T5/M8 — reference-only subjects never appear in any official output. */
function isReferenceOnlySubjectCode(code: string | null | undefined): boolean {
	const normalized = (code ?? '').trim().toUpperCase();
	return normalized === 'HG' || normalized === 'ARAL';
}

/**
 * C05 M16 — a completed run whose selected-term renderable entry set is empty
 * must never emit a header-only official file. "Renderable" is the set the
 * document would actually print: reference-only (HG/ARAL) rows are excluded
 * because they never become a cell/row. The distinct `EMPTY_SOURCE_RUN` /
 * `EMPTY_ROOM_SCHEDULE` failures owned by the matrix and room paths are
 * deliberately NOT replaced by this guard.
 */
export function assertRenderableExportEntries(ctx: ExportContext): void {
	const hasRenderable = ctx.entries.some(
		(entry) => !isReferenceOnlySubjectCode(ctx.subjectMap.get(entry.subjectId)?.code),
	);
	if (!hasRenderable) {
		const error = new Error('EMPTY_SELECTED_TERM');
		(error as Error & { code?: string }).code = 'EMPTY_SELECTED_TERM';
		throw error;
	}
}

/** C05 T5/M12 — ExcelJS sheet-name safety (31 chars, no `[]:*?/\`). */
function sanitizeSheetName(name: string): string {
	const cleaned = (name || 'SHEET').replace(/[\\/?*[\]:]/g, ' ').trim();
	return (cleaned.length > 0 ? cleaned : 'SHEET').slice(0, 31);
}

function uniqueSheetName(workbook: ExcelJS.Workbook, base: string): string {
	const candidate = sanitizeSheetName(base);
	let name = candidate;
	let suffix = 2;
	while (workbook.worksheets.some((sheet) => sheet.name === name)) {
		name = `${candidate.slice(0, 28)}_${suffix}`;
		suffix += 1;
	}
	return name;
}

export async function exportSummaryWorkbook(options: ExportOptions): Promise<Buffer> {
	const ctx = await loadExportContext(options);
	// C05 M16 — fail closed on an empty selected-term renderable set (zero bytes).
	assertRenderableExportEntries(ctx);

	const allSlots = [...ctx.displaySlots].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
	const periodSlots = allSlots.filter((s) => !s.isSpecialEvent);
	const breakSlots = allSlots.filter((s) => s.isSpecialEvent);

	// The injected test client is a partial read-only stub; keep the production
	// Prisma delegate typing for callbacks and query results.
	const db = (options.client ?? prisma) as typeof prisma;
	// C08 — a published export renders the frozen section roster; only a
	// draft/unpublished source reads the live mirror.
	const sections = ctx.frozenSnapshot
		? ctx.sections
		: await db.sectionMirror.findMany({
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
	const bandHeight = orderedSlots.reduce((sum, item) => sum + (item.type === 'break' ? 1 : 2), 0) + 3;

	let rowCursor = EXPORT_FIRST_BLOCK_ROW;
	for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
		const band = bands[bandIdx];
		const startRow = EXPORT_FIRST_BLOCK_ROW + bandIdx * bandHeight;

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
		rowCursor = row + 1;
	}

	// C05 T5/M12 — reconciliation totals from the same selected-term entries the
	// class program renders, so the summary and class program agree exactly.
	// Reference-only HG/ARAL entries never render a class-program cell and are
	// excluded here too.
	rowCursor += 1;
	const renderableEntries = ctx.entries.filter((entry) => {
		const code = ctx.subjectMap.get(entry.subjectId)?.code?.trim().toUpperCase();
		return code !== 'HG' && code !== 'ARAL';
	});
	const totalMinutes = renderableEntries.reduce((sum, entry) => {
		return sum + (entry.durationMinutes ?? Math.max(0, toMinutes(entry.endTime) - toMinutes(entry.startTime)));
	}, 0);
	const reconciliationRow = sheet.getRow(rowCursor);
	reconciliationRow.getCell(1).value = 'RECONCILIATION (SELECTED TERM)';
	reconciliationRow.getCell(1).font = { bold: true };
	reconciliationRow.getCell(2).value = `Entries: ${renderableEntries.length} — Total minutes: ${totalMinutes}`;
	reconciliationRow.getCell(2).font = { italic: true };

	sheet.columns.forEach((col) => { col.width = 18; });
	applyLandscapePrintSetup(sheet);

	// ─── Per-subject teacher sheets (reference workbook parity, C05 T5/M12) ───
	const subjectIds = [...new Set(ctx.entries.map((entry) => entry.subjectId))]
		.filter((id): id is number => typeof id === 'number' && id > 0)
		// C05 T5/M8 — a reference-only subject (HG/ARAL) must not produce a
		// subject sheet, panel, row, label, or placeholder anywhere.
		.filter((id) => !isReferenceOnlySubjectCode(ctx.subjectMap.get(id)?.code));
	for (const subjectId of subjectIds) {
		const subject = ctx.subjectMap.get(subjectId);
		if (!subject) continue;
		const subjectEntries = ctx.entries.filter((entry) => entry.subjectId === subjectId);
		const subjectSheet = workbook.addWorksheet(uniqueSheetName(workbook, subject.name));
		addReportHeader(subjectSheet, ctx, `SUBJECT: ${subject.name}`);
		subjectSheet.columns.forEach((col) => { col.width = 20; });

		// Panel-per-(section, teacher) mirroring the reference workbook structure.
		const panelKeys = new Map<string, { sectionId: number; facultyId: number | null }>();
		for (const entry of subjectEntries) {
			const key = `${entry.sectionId}-${entry.facultyId ?? 0}`;
			if (!panelKeys.has(key)) panelKeys.set(key, { sectionId: entry.sectionId, facultyId: entry.facultyId ?? null });
		}

		let panelRow = EXPORT_FIRST_BLOCK_ROW;
		for (const panel of panelKeys.values()) {
			const panelEntries = subjectEntries
				.filter((entry) => entry.sectionId === panel.sectionId && (entry.facultyId ?? null) === panel.facultyId)
				.sort((a, b) => a.day.localeCompare(b.day) || a.startTime.localeCompare(b.startTime));
			const section = sortedSections.find((s) => s.externalId === panel.sectionId);
			const sectionName = section?.name ?? `Section ${panel.sectionId}`;
			const faculty = panel.facultyId != null ? ctx.facultyMap.get(panel.facultyId) : null;
			const teacherName = faculty
				? [faculty.lastName, faculty.firstName].filter(Boolean).join(', ')
				: 'Unassigned';
			const adviserName = section ? ctx.adviserMap.get(section.externalId) ?? '' : '';

			const panelHeader = subjectSheet.getRow(panelRow);
			panelHeader.getCell(1).value = `SUBJECT: ${subject.name}`;
			panelHeader.getCell(1).font = { bold: true };
			panelHeader.getCell(2).value = `SECTION: ${sectionName}`;
			panelHeader.getCell(3).value = `TEACHER: ${teacherName}`;
			panelRow += 1;

			const columnHeader = subjectSheet.getRow(panelRow);
			['TIME', 'MINUTES', 'DAY', 'ROOM'].forEach((label, index) => {
				columnHeader.getCell(index + 1).value = label;
				columnHeader.getCell(index + 1).font = { bold: true };
			});
			panelRow += 1;

			let panelMinutes = 0;
			for (const entry of panelEntries) {
				const minutes = entry.durationMinutes ?? Math.max(0, toMinutes(entry.endTime) - toMinutes(entry.startTime));
				panelMinutes += minutes;
				const room = entry.roomId ? ctx.roomMap.get(entry.roomId) : undefined;
				const row = subjectSheet.getRow(panelRow);
				row.getCell(1).value = `${formatTime12h(entry.startTime)}-${formatTime12h(entry.endTime)}`;
				row.getCell(2).value = minutes;
				row.getCell(3).value = WEEKDAY_SHORT[entry.day] ?? entry.day;
				row.getCell(4).value = formatRoomLabel(room);
				panelRow += 1;
			}

			// Advisory / ancillary / total rows. Values are blank when no
			// authoritative source exists; nothing is invented.
			const advisoryRow = subjectSheet.getRow(panelRow);
			advisoryRow.getCell(1).value = 'ADVISORY';
			advisoryRow.getCell(1).font = { bold: true };
			advisoryRow.getCell(2).value = adviserName;
			panelRow += 1;
			const ancillaryRow = subjectSheet.getRow(panelRow);
			ancillaryRow.getCell(1).value = 'ANCILLARY';
			ancillaryRow.getCell(1).font = { bold: true };
			panelRow += 1;
			const totalRow = subjectSheet.getRow(panelRow);
			totalRow.getCell(1).value = 'TOTAL';
			totalRow.getCell(1).font = { bold: true };
			totalRow.getCell(2).value = panelMinutes;
			totalRow.getCell(2).font = { bold: true };
			panelRow += 2;
		}

		applyLandscapePrintSetup(subjectSheet);
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}

export async function exportClassProgramWorkbook(options: ExportOptions): Promise<Buffer> {
	const ctx = await loadExportContext(options);
	// C05 M16 — fail closed on an empty selected-term renderable set (zero bytes).
	assertRenderableExportEntries(ctx);
	const visibility = options.specializationVisibility ?? 'hidden';
	// The injected test client is a partial read-only stub; keep the production
	// Prisma delegate typing for callbacks and query results.
	const db = (options.client ?? prisma) as typeof prisma;

	// C08 — a published export renders the frozen section roster; only a
	// draft/unpublished source reads the live mirror.
	const sections = ctx.frozenSnapshot
		? ctx.sections
		: await db.sectionMirror.findMany({
			where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
			select: { id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true, programType: true },
		});

	const sortedSections = [...sections].sort((a, b) => {
		const gradeA = resolveSectionGradeLevel(a);
		const gradeB = resolveSectionGradeLevel(b);
		if (gradeA !== gradeB) return gradeA - gradeB;
		return a.name.localeCompare(b.name);
	});
	const learnerCounts = options.resolveLearnerCounts
		? await options.resolveLearnerCounts(sortedSections.map((section) => section.externalId))
		: new Map<number, { male: number; female: number; total: number }>();

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
		// C08 — a published export renders the FROZEN template rows; only a
		// draft/unpublished source re-reads `class_program_slots`.
		const canonicalSlots = ctx.frozenSnapshot
			? frozenCanonicalSlots(ctx.frozenSnapshot, gradeLevel, ['REGULAR', ...gradeSections.map((section) => section.programType)])
			: await resolveCanonicalSlotsForPrograms(
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
		const gradeFill: Record<number, string> = { 7: 'FFE2F0D9', 8: 'FFFFF2CC', 9: 'FFF4CCCC', 10: 'FFD9EAF7' };
		const gradeColor: Record<number, string> = { 7: '70AD47', 8: 'FFC000', 9: 'C00000', 10: '4472C4' };
		const fillArgb = gradeFill[gradeLevel];
		if (gradeColor[gradeLevel]) sheet.properties.tabColor = { argb: gradeColor[gradeLevel] };
		addReportHeader(sheet, ctx, `CLASS PROGRAM - Grade ${gradeLevel}`);
		sheet.columns.forEach((col) => { col.width = 16; });
		sheet.views = [{ state: 'frozen', ySplit: EXPORT_FIRST_BLOCK_ROW + 2 }];

		let rowCursor = EXPORT_FIRST_BLOCK_ROW;
		for (const section of gradeSections) {
			const sectionRow = sheet.getRow(rowCursor);
			sectionRow.getCell(1).value = `GRADE ${gradeLevel} — SECTION: ${section.name}`;
			sectionRow.getCell(1).font = { bold: true, size: 12 };
			if (fillArgb) sectionRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
			sectionRow.getCell(3).value = 'No. of Learners — MALE:';
			sectionRow.getCell(4).value = learnerCounts.get(section.externalId)?.male ?? '';
			sectionRow.getCell(5).value = 'FEMALE:';
			sectionRow.getCell(6).value = learnerCounts.get(section.externalId)?.female ?? '';
			sectionRow.getCell(7).value = 'TOTAL:';
			sectionRow.getCell(8).value = learnerCounts.get(section.externalId)?.total ?? '';
			rowCursor++;

			const identityRow = sheet.getRow(rowCursor);
			identityRow.getCell(1).value = `ADVISER: ${ctx.adviserMap.get(section.externalId) ?? ''}`;
			identityRow.getCell(3).value = `BLDG./RM.: ${formatRoomLabel(sectionRoomMap.get(section.externalId))}`;
			identityRow.getCell(6).value = `TERM: ${ctx.termIndex != null ? `T${ctx.termIndex}` : ''}`;
			rowCursor++;

			const headerRow = sheet.getRow(rowCursor);
			headerRow.getCell(1).value = 'TIME';
			headerRow.getCell(2).value = 'MINUTES';
			WEEKDAYS.forEach((day, dayIndex) => { headerRow.getCell(dayIndex + 3).value = day; });
			// C05 T4/M9 — unambiguous per-period teacher attribution column.
			headerRow.getCell(8).value = 'TEACHER';
			headerRow.font = { bold: true };
			if (fillArgb) {
				for (let column = 1; column <= 8; column += 1) {
					headerRow.getCell(column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
				}
			}
			rowCursor++;

			let dailyTotalMinutes = 0;
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

				if (item.type === 'break') {
					const eventDay = resolveSpecialEventDay(item.slot.eventName, item.slot.dayOfWeek);
					if (eventDay) {
						// C05 T4/M7 — a day-scoped break/event band (e.g. the
						// Monday-only Flag/HGP overlay) occupies only its own weekday;
						// the same interval stays teachable on the other weekdays.
						const dayIndex = (WEEKDAYS as readonly string[]).indexOf(eventDay);
						if (dayIndex >= 0) row.getCell(dayIndex + 3).value = getBreakLabel(item.slot.eventName);
					} else {
						// Keep the five weekday cells unmerged for reliable copy/paste.
						for (let dayIndex = 0; dayIndex < WEEKDAYS.length; dayIndex += 1) {
							row.getCell(dayIndex + 3).value = getBreakLabel(item.slot.eventName);
						}
					}
				} else {
					dailyTotalMinutes += Math.max(0, toMinutes(endTime) - toMinutes(startTime));
					const dayEntries: GridEntry[] = [];
					WEEKDAYS.forEach((day, dayIndex) => {
						const cell = row.getCell(dayIndex + 3);
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
						dayEntries.push(entry);
					});
					row.getCell(8).value = formatDayTaggedField(dayEntries, 'teacher');
				}
				rowCursor++;
			}

			// C05 T4/M9 — daily totals row with exact arithmetic reconciled to the
			// configured period structure (sum of the rendered class-period minutes).
			const totalsRow = sheet.getRow(rowCursor);
			totalsRow.getCell(1).value = 'TOTAL MINUTES PER DAY';
			totalsRow.getCell(1).font = { bold: true };
			totalsRow.getCell(2).value = dailyTotalMinutes;
			totalsRow.getCell(2).font = { bold: true };
			WEEKDAYS.forEach((_, dayIndex) => {
				totalsRow.getCell(dayIndex + 3).value = dailyTotalMinutes;
				totalsRow.getCell(dayIndex + 3).font = { bold: true };
			});
			rowCursor += 2; // blank separator between sections
		}

		// C05 T4/M9 — approval block after each grade sheet. Unset names render as
		// blank signature lines, never invented people.
		const approvalTitle = sheet.getRow(rowCursor);
		approvalTitle.getCell(1).value = 'APPROVAL';
		approvalTitle.getCell(1).font = { bold: true, size: 12 };
		rowCursor++;
		for (const role of ['Prepared by:', 'Reviewed by:', 'Recommending Approval:', 'Approved by:']) {
			const row = sheet.getRow(rowCursor);
			row.getCell(1).value = role;
			row.getCell(1).font = { bold: true };
			row.getCell(3).value = '________________________';
			rowCursor++;
		}
		const adviserRow = sheet.getRow(rowCursor);
		adviserRow.getCell(1).value = 'Adviser:';
		adviserRow.getCell(1).font = { bold: true };
		adviserRow.getCell(3).value = gradeSections
			.map((section) => ctx.adviserMap.get(section.externalId) ?? '')
			.filter((value) => value.length > 0)
			.join(', ') || '________________________';

		applyLandscapePrintSetup(sheet);
		sheet.pageSetup.printArea = `A1:H${rowCursor + 7}`;
		sheet.pageSetup.printTitlesRow = `1:${EXPORT_HEADER_LAST_ROW}`;
		sheet.pageMargins = { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 };
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
