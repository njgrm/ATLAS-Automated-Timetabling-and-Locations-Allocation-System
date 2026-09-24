import {
	AlignmentType, BorderStyle, Document, Footer, PageBreak, PageOrientation, Packer, Paragraph, Table,
	TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import type { ExportContext, ExportOptions } from './workbook-export.service.js';
import { assertRenderableExportEntries, loadExportContext } from './workbook-export.service.js';
import { applyTemplateSignatoryFallback, resolveExportSignatoryProfile } from './export-presentation.service.js';
import { resolveSpecialEventDay } from './workbook-export.service.js';

type Section = ExportContext['sections'][number];
type Interval = { startTime: string; endTime: string; eventName?: string; dayOfWeek?: string; isSpecialEvent?: boolean };
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDERS = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };

function text(value: string, bold = false, size = 18) {
	return new TextRun({ text: value, font: 'Arial Narrow', size, bold });
}

function cell(value: string, bold = false, width = 1200, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
	return new TableCell({
		width: { size: width, type: WidthType.DXA }, borders: BORDERS, verticalAlign: 'center' as any,
		children: [new Paragraph({ children: [text(value, bold)], alignment: align, spacing: { before: 0, after: 0 } })],
	});
}

function headerCell(value: string, width: number) {
	return cell(value, true, width, AlignmentType.CENTER);
}

function formattedTime(value: string) {
	const [hour, minute] = value.split(':').map(Number);
	const suffix = hour >= 12 ? 'PM' : 'AM';
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function minutes(slot: Interval) {
	const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
	return Math.max(0, toMinutes(slot.endTime) - toMinutes(slot.startTime));
}

function printableEntry(ctx: ExportContext, entry: ExportContext['entries'][number]) {
	const code = (ctx.subjectMap.get(entry.subjectId)?.code ?? '').trim().toUpperCase();
	return code !== 'HG' && code !== 'ARAL';
}

function allIntervals(ctx: ExportContext): Interval[] {
	const byKey = new Map<string, Interval>();
	for (const slot of ctx.displaySlots) byKey.set(`${slot.startTime}-${slot.endTime}-${slot.dayOfWeek ?? ''}`, slot);
	for (const entry of ctx.entries) {
		const key = `${entry.startTime}-${entry.endTime}-`;
		if (!byKey.has(key)) byKey.set(key, { startTime: entry.startTime, endTime: entry.endTime });
	}
	return [...byKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

function titleLines(ctx: ExportContext, title: string): Paragraph[] {
	const names = resolveBranding(ctx);
	const profile = (ctx as ExportContext & { presentationProfile?: Awaited<ReturnType<typeof resolveExportSignatoryProfile>> }).presentationProfile;
	return [
		...['Republic of the Philippines', profile?.headerLine ?? '', names.regionLine, names.divisionLine, names.districtLine, names.schoolName]
			.filter((line) => line.length > 0)
			.map((line) => new Paragraph({ children: [text(line, line === names.schoolName)], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 } })),
		new Paragraph({ children: [text(title, true, 24)], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }),
		new Paragraph({ children: [text(`School Year ${ctx.yearLabel}   |   Term ${ctx.termIndex ?? ''}   |   Run ${ctx.runId}`)], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 } }),
		new Paragraph({ children: [text(ctx.publication.isPublished ? 'PUBLISHED' : 'NOT PUBLISHED — DRAFT/REVIEW', true, 16)], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 } }),
	];
}

function resolveBranding(ctx: ExportContext) {
	const profile = (ctx as ExportContext & { presentationProfile?: Awaited<ReturnType<typeof resolveExportSignatoryProfile>> }).presentationProfile;
	return {
		schoolName: profile?.officialSchoolName || ctx.branding.schoolName,
		regionLine: profile?.regionLine ?? '',
		divisionLine: profile?.divisionLine ?? '',
		districtLine: profile?.districtLine ?? '',
	};
}

function approvalLines(ctx: ExportContext): Paragraph[] {
	const profile = (ctx as ExportContext & { presentationProfile?: Awaited<ReturnType<typeof resolveExportSignatoryProfile>> }).presentationProfile;
	const signatories = profile ?? null;
	const entries = [
		['Prepared by', ''],
		['Reviewed by', signatories?.psds.name ?? ''],
		['Recommending Approval', signatories?.cidChief.name ?? ''],
		['Approved by', signatories?.asds.name ?? signatories?.schoolHead.name ?? ''],
	];
	return [new Paragraph({ children: [text('SIGNATURES', true)], spacing: { before: 160, after: 80 } }),
		...entries.map(([role, name]) => new Paragraph({ children: [text(`${role}: ________________________________${name ? `  ${name}` : ''}`)], spacing: { before: 0, after: 80 } }))];
}

function documentSection(ctx: ExportContext, children: Array<Paragraph | Table>) {
	const profile = (ctx as ExportContext & { presentationProfile?: Awaited<ReturnType<typeof resolveExportSignatoryProfile>> }).presentationProfile;
	const footerText = profile?.footerText?.trim();
	return {
		properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 480, right: 480, bottom: 480, left: 480 } } },
		...(footerText ? { footers: { default: new Footer({ children: [new Paragraph({ children: [text(footerText)], alignment: AlignmentType.CENTER })] }) } } : {}),
		children,
	};
}

async function prepare(options: ExportOptions): Promise<ExportContext> {
	const ctx = await loadExportContext(options);
	assertRenderableExportEntries(ctx);
	const profile = await resolveExportSignatoryProfile({
		schoolId: options.schoolId, schoolYearId: options.schoolYearId,
		isPublished: ctx.publication.isPublished, publishedAt: ctx.publication.publishedAt, client: options.client,
	});
	(ctx as ExportContext & { presentationProfile?: typeof profile }).presentationProfile = applyTemplateSignatoryFallback(profile, ctx.schoolName);
	return ctx;
}

function sectionRoomLabel(ctx: ExportContext, sectionId: number) {
	const counts = new Map<number, number>();
	for (const entry of ctx.entries) if (entry.sectionId === sectionId && entry.roomId) counts.set(entry.roomId, (counts.get(entry.roomId) ?? 0) + 1);
	const roomId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
	const room = roomId == null ? null : ctx.roomMap.get(roomId);
	return room ? `${room.buildingName} / ${room.name}` : '';
}

function sectionTable(ctx: ExportContext, section: Section): Table {
	const intervals = allIntervals(ctx);
	const rows: TableRow[] = [new TableRow({ children: ['TIME', 'MINUTES', ...DAYS, 'TEACHER'].map((label, index) => headerCell(label, index < 2 ? 1500 : 1900)) })];
	const sectionEntries = ctx.entries.filter((entry) => entry.sectionId === section.externalId && printableEntry(ctx, entry));
	for (const slot of intervals) {
		const rowCells = [cell(`${formattedTime(slot.startTime)}–${formattedTime(slot.endTime)}`), cell(String(minutes(slot)))];
		for (const day of DAYS) {
			const eventDay = slot.isSpecialEvent ? resolveSpecialEventDay(slot.eventName, slot.dayOfWeek) : null;
			if (slot.isSpecialEvent && (!eventDay || eventDay === day)) {
				rowCells.push(cell(slot.eventName ?? 'Break', true));
				continue;
			}
			const entry = sectionEntries.find((candidate) => candidate.day === day && candidate.startTime === slot.startTime && candidate.endTime === slot.endTime);
			rowCells.push(cell(entry ? ctx.subjectMap.get(entry.subjectId)?.name ?? '' : ''));
		}
		const representative = sectionEntries.find((entry) => entry.startTime === slot.startTime && entry.endTime === slot.endTime);
		const teachers = [...new Set(sectionEntries.filter((entry) => entry.startTime === slot.startTime && entry.endTime === slot.endTime)
			.map((entry) => {
				const faculty = entry.facultyId ? ctx.facultyMap.get(entry.facultyId) : null;
				const name = faculty ? `${faculty.lastName ?? ''}, ${faculty.firstName ?? ''}`.trim().replace(/^, /, '') : 'Unassigned';
				return `${entry.day}: ${name}`;
			}))];
		rowCells.push(cell(teachers.join('\n')));
		rows.push(new TableRow({ children: rowCells }));
	}
	return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1500, 900, 1400, 1400, 1400, 1400, 1400, 1800] });
}

export async function exportGradeClassProgramDocx(options: ExportOptions & { gradeLevel: number }): Promise<Buffer> {
	if (!Number.isInteger(options.gradeLevel) || options.gradeLevel < 7 || options.gradeLevel > 10) throw new Error('INVALID_GRADE_LEVEL');
	const ctx = await prepare(options);
	const sections = ctx.sections.filter((section) => {
		const grade = Number(section.gradeLevelName?.match(/Grade\s+(\d+)/i)?.[1] ?? section.gradeLevelId);
		return grade === options.gradeLevel && (options.sectionId == null || section.externalId === options.sectionId);
	}).sort((a, b) => a.name.localeCompare(b.name));
	if (!sections.length) throw new Error(options.sectionId == null ? 'GRADE_NOT_FOUND' : 'SECTION_NOT_FOUND');
	const children: Array<Paragraph | Table> = [];
	for (const [index, section] of sections.entries()) {
		if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
		children.push(...titleLines(ctx, `GRADE ${options.gradeLevel} CLASS PROGRAM`));
		children.push(new Paragraph({ children: [text(`SECTION: ${section.name}    ADVISER: ${ctx.adviserMap.get(section.externalId) ?? ''}    BUILDING / ROOM: ${sectionRoomLabel(ctx, section.externalId)}`)], spacing: { before: 0, after: 80 } }));
		children.push(sectionTable(ctx, section), ...approvalLines(ctx));
	}
	return Packer.toBuffer(new Document({ creator: 'ATLAS', sections: [documentSection(ctx, children)] }));
}

async function exportEntityDocx(options: ExportOptions & { roomId?: number }, kind: 'section' | 'room'): Promise<Buffer> {
	const ctx = await prepare(options);
	const children: Array<Paragraph | Table> = [];
	if (kind === 'section') {
		const sections = ctx.sections.filter((section) => options.sectionId == null || section.externalId === options.sectionId).sort((a, b) => a.name.localeCompare(b.name));
		if (options.sectionId != null && !sections.length) throw new Error('SECTION_NOT_FOUND');
		for (const [index, section] of sections.entries()) {
			if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
			children.push(...titleLines(ctx, `CLASS PROGRAM — ${section.name}`));
			children.push(new Paragraph({ children: [text(`GRADE ${section.gradeLevelName ?? section.gradeLevelId}    SECTION ${section.name}    ADVISER ${ctx.adviserMap.get(section.externalId) ?? ''}    BUILDING / ROOM ${sectionRoomLabel(ctx, section.externalId)}`)], spacing: { before: 0, after: 80 } }));
			children.push(sectionTable(ctx, section), ...approvalLines(ctx));
		}
	} else {
		const roomIds = [...new Set(ctx.entries.filter((entry) => printableEntry(ctx, entry)).map((entry) => entry.roomId))].sort((a, b) => a - b);
		const selectedIds = options.roomId == null ? roomIds : roomIds.filter((id) => id === options.roomId);
		if (options.roomId != null && !ctx.roomMap.has(options.roomId)) throw new Error('ROOM_NOT_FOUND');
		if (!selectedIds.length) throw new Error(options.roomId == null ? 'EMPTY_SELECTED_TERM' : 'EMPTY_ROOM_SCHEDULE');
		for (const [index, roomId] of selectedIds.entries()) {
			if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
			const room = ctx.roomMap.get(roomId);
			children.push(...titleLines(ctx, `ROOM PROGRAM — ${room?.name ?? `Room ${roomId}`}`));
			children.push(new Paragraph({ children: [text(`ROOM: ${room?.name ?? roomId}    BUILDING: ${room?.buildingName ?? ''}`)], spacing: { before: 0, after: 80 } }));
			const rows = [new TableRow({ children: ['TIME', 'MINUTES', ...DAYS].map((label, col) => headerCell(label, col < 2 ? 1500 : 2200)) })];
			for (const slot of allIntervals(ctx)) {
				const cells = [cell(`${formattedTime(slot.startTime)}–${formattedTime(slot.endTime)}`), cell(String(minutes(slot)))];
				for (const day of DAYS) {
					if (slot.isSpecialEvent && (!resolveSpecialEventDay(slot.eventName, slot.dayOfWeek) || resolveSpecialEventDay(slot.eventName, slot.dayOfWeek) === day)) { cells.push(cell(slot.eventName ?? 'Break', true)); continue; }
					const entries = ctx.entries.filter((entry) => entry.roomId === roomId && entry.day === day && entry.startTime === slot.startTime && entry.endTime === slot.endTime && printableEntry(ctx, entry));
					const content = entries.map((entry) => {
						const section = ctx.sections.find((candidate) => candidate.externalId === entry.sectionId);
						const faculty = entry.facultyId ? ctx.facultyMap.get(entry.facultyId) : null;
						return `${ctx.subjectMap.get(entry.subjectId)?.name ?? ''}\n${section?.name ?? ''}\n${faculty ? `${faculty.lastName ?? ''}, ${faculty.firstName ?? ''}` : ''}`;
					}).join('\n');
					cells.push(cell(content));
				}
				rows.push(new TableRow({ children: cells }));
			}
			children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), ...approvalLines(ctx));
		}
	}
	return Packer.toBuffer(new Document({ creator: 'ATLAS', sections: [documentSection(ctx, children)] }));
}

export function exportSectionProgramDocx(options: ExportOptions) { return exportEntityDocx(options, 'section'); }
export function exportRoomProgramDocx(options: ExportOptions & { roomId?: number }) { return exportEntityDocx(options, 'room'); }
