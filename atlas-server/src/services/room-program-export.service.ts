/**
 * Room Program official export service (BENEFICIARY-EXPORT-PARITY-C05 T7/T10).
 *
 * Produces the selected-term official room program workbook from the same
 * `loadExportContext` entries the class program renders. One sheet per room with
 * entries; `roomId` scopes a single room. Layout per output contract §3.3:
 * room/building + year + term header; TIME | minutes | Monday–Friday; cells carry
 * Subject + Section + Teacher; breaks banded; ARAL Program absent (the shared
 * entry grid never emits HG/ARAL); print setup; publication-state marker.
 *
 * Read-only: no run creation, no audit rows, no policy writes.
 */

import type ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import {
	loadExportContext,
	addReportHeader,
	applyLandscapePrintSetup,
	EXPORT_FIRST_BLOCK_ROW,
	type ExportOptions,
	type ExportContext,
} from './workbook-export.service.js';
import { resolveSpecialEventDay } from './workbook-export.service.js';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/** Reference-only subjects are never printable in any official output. */
function isReferenceOnlySubject(ctx: ExportContext, subjectId: number): boolean {
	const code = ctx.subjectMap.get(subjectId)?.code?.trim().toUpperCase();
	return code === 'HG' || code === 'ARAL';
}

type RoomProgramOptions = ExportOptions & {
	/** Scope one room; omit for every room with entries in the selected term. */
	roomId?: number;
};

function toMinutes(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

function formatTime12h(time24: string): string {
	const [h, m] = time24.split(':').map(Number);
	const period = h >= 12 ? 'PM' : 'AM';
	const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function sanitizeSheetName(name: string): string {
	const cleaned = (name || 'ROOM').replace(/[\\/?*[\]:]/g, ' ').trim();
	return (cleaned.length > 0 ? cleaned : 'ROOM').slice(0, 31);
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

async function createWorkbook(options?: ExportOptions): Promise<ExcelJS.Workbook> {
	if (options?.workbookFactory) return options.workbookFactory();
	const { default: ExcelJSRuntime } = await import('exceljs');
	return new ExcelJSRuntime.Workbook();
}

/**
 * C05 T7/M11 — build the official room program workbook. Throws
 * `ROOM_NOT_FOUND` / `EMPTY_ROOM_SCHEDULE` (typed 4xx, zero bytes) when the
 * requested room is outside the school or has no selected-term entries.
 */
export async function exportRoomProgramWorkbook(options: RoomProgramOptions): Promise<Buffer> {
	const ctx: ExportContext = await loadExportContext(options);
	const db = (options.client ?? prisma) as typeof prisma;

	const sections = await db.sectionMirror.findMany({
		where: { schoolId: options.schoolId, schoolYearId: options.schoolYearId },
		select: { id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true },
	});
	const sectionNameByExternalId = new Map<number, string>();
	for (const section of sections) {
		if (section.externalId != null) sectionNameByExternalId.set(section.externalId, section.name);
	}

	// C05 T7/M13 — the period structure must cover every selected-term entry
	// interval. `displaySlots` is the policy/canonical view; the union guarantees
	// a persisted session can never be dropped from the official room program
	// merely because the run has no display-slot metadata (or the interval is not
	// part of the configured structure).
	const slotByInterval = new Map<string, (typeof ctx.displaySlots)[number]>();
	for (const slot of ctx.displaySlots) {
		slotByInterval.set(`${slot.startTime}-${slot.endTime}`, slot);
	}
	for (const entry of ctx.entries) {
		const key = `${entry.startTime}-${entry.endTime}`;
		if (!slotByInterval.has(key)) {
			slotByInterval.set(key, { startTime: entry.startTime, endTime: entry.endTime, isSpecialEvent: false });
		}
	}
	const allSlots = [...slotByInterval.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
	const periodSlots = allSlots.filter((slot) => !slot.isSpecialEvent);
	const breakSlots = allSlots.filter((slot) => slot.isSpecialEvent);
	const orderedSlots: Array<{ type: 'period' | 'break'; slot: (typeof allSlots)[number] }> = [];
	{
		let periodIdx = 0;
		let breakIdx = 0;
		while (periodIdx < periodSlots.length || breakIdx < breakSlots.length) {
			const nextPeriod = periodSlots[periodIdx];
			const nextBreak = breakSlots[breakIdx];
			if (!nextPeriod) { orderedSlots.push({ type: 'break', slot: nextBreak }); breakIdx++; }
			else if (!nextBreak) { orderedSlots.push({ type: 'period', slot: nextPeriod }); periodIdx++; }
			else if (nextPeriod.startTime <= nextBreak.startTime) { orderedSlots.push({ type: 'period', slot: nextPeriod }); periodIdx++; }
			else { orderedSlots.push({ type: 'break', slot: nextBreak }); breakIdx++; }
		}
	}

	const roomIds = [...new Set(ctx.entries.map((entry) => entry.roomId).filter((id): id is number => typeof id === 'number' && id > 0))]
		.sort((a, b) => a - b);
	const scopedRoomIds = options.roomId != null
		? roomIds.filter((id) => id === options.roomId)
		: roomIds;

	if (options.roomId != null) {
		if (!ctx.roomMap.has(options.roomId)) throw new Error('ROOM_NOT_FOUND');
		if (scopedRoomIds.length === 0) throw new Error('EMPTY_ROOM_SCHEDULE');
	}
	if (scopedRoomIds.length === 0) throw new Error('EMPTY_ROOM_SCHEDULE');

	const workbook = await createWorkbook(options);
	workbook.creator = 'ATLAS';

	for (const roomId of scopedRoomIds) {
		const room = ctx.roomMap.get(roomId);
		const roomLabel = room ? `${room.buildingName} / ${room.name}` : `Room #${roomId}`;
		const sheet = workbook.addWorksheet(uniqueSheetName(workbook, `Room ${room?.name ?? roomId}`));
		addReportHeader(sheet, ctx, `ROOM PROGRAM — ${roomLabel}`);
		sheet.columns.forEach((col) => { col.width = 18; });

		const identityRow = sheet.getRow(EXPORT_FIRST_BLOCK_ROW);
		identityRow.getCell(1).value = `ROOM: ${room?.name ?? roomId}`;
		identityRow.getCell(1).font = { bold: true };
		identityRow.getCell(3).value = `BUILDING: ${room?.buildingName ?? ''}`;
		identityRow.getCell(5).value = `YEAR: ${ctx.yearLabel}`;
		identityRow.getCell(7).value = `TERM: ${ctx.termIndex != null ? `T${ctx.termIndex}` : ''}`;

		const headerRow = sheet.getRow(EXPORT_FIRST_BLOCK_ROW + 1);
		headerRow.getCell(1).value = 'TIME';
		headerRow.getCell(2).value = 'MINUTES';
		WEEKDAYS.forEach((day, dayIndex) => { headerRow.getCell(dayIndex + 3).value = day; });
		headerRow.font = { bold: true };

		let rowCursor = EXPORT_FIRST_BLOCK_ROW + 2;
		// C05 T7/M13 — occupied minutes are accumulated per weekday from the
		// renderable entries, so the totals row states each day's real occupancy
		// instead of repeating one aggregate across five columns.
		const dailyMinutes: Record<string, number> = {};
		for (const item of orderedSlots) {
			const row = sheet.getRow(rowCursor);
			const startTime = item.slot.startTime;
			const endTime = item.slot.endTime;
			row.getCell(1).value = item.type === 'break' ? (item.slot.eventName ?? 'Break') : `${formatTime12h(startTime)}-${formatTime12h(endTime)}`;
			row.getCell(2).value = Math.max(0, toMinutes(endTime) - toMinutes(startTime));

			if (item.type === 'break') {
				const eventDay = resolveSpecialEventDay(item.slot.eventName, item.slot.dayOfWeek);
				if (eventDay) {
					const dayIndex = (WEEKDAYS as readonly string[]).indexOf(eventDay);
					if (dayIndex >= 0) row.getCell(dayIndex + 3).value = item.slot.eventName ?? 'Break';
				} else {
					row.getCell(3).value = item.slot.eventName ?? 'Break';
					sheet.mergeCells(rowCursor, 3, rowCursor, 7);
				}
			} else {
				const intervalMinutes = Math.max(0, toMinutes(endTime) - toMinutes(startTime));
				WEEKDAYS.forEach((day, dayIndex) => {
					const cell = row.getCell(dayIndex + 3);
					// Room-scoped cell built directly from the selected-term entries so
					// Subject + Section + Teacher are unambiguous and never cross-term.
					const dayEntries = ctx.entries.filter((candidate) =>
						candidate.roomId === roomId
						&& candidate.day === day
						&& candidate.startTime === startTime
						&& candidate.endTime === endTime
						// C05 T7/M8 — ARAL Program is absent and HG is excluded from every
						// official output, exactly like the class-program entry grid.
						&& !isReferenceOnlySubject(ctx, candidate.subjectId));
					if (dayEntries.length === 0) { cell.value = ''; return; }
					cell.value = dayEntries
						.map((candidate) => {
							const subject = ctx.subjectMap.get(candidate.subjectId)?.name ?? `Subject #${candidate.subjectId}`;
							const sectionName = sectionNameByExternalId.get(candidate.sectionId) ?? `Section ${candidate.sectionId}`;
							const faculty = candidate.facultyId != null ? ctx.facultyMap.get(candidate.facultyId) : null;
							const teacher = faculty ? [faculty.lastName, faculty.firstName].filter(Boolean).join(', ') : 'Unassigned';
							return `${subject}\n${sectionName}\n${teacher}`;
						})
						.join('\n---\n');
					dailyMinutes[day] = (dailyMinutes[day] ?? 0) + intervalMinutes;
				});
			}
			rowCursor++;
		}

		const totalsRow = sheet.getRow(rowCursor);
		totalsRow.getCell(1).value = 'TOTAL MINUTES PER DAY';
		totalsRow.getCell(1).font = { bold: true };
		const weekMinutes = WEEKDAYS.reduce((sum, day) => sum + (dailyMinutes[day] ?? 0), 0);
		totalsRow.getCell(2).value = weekMinutes;
		totalsRow.getCell(2).font = { bold: true };
		WEEKDAYS.forEach((day, dayIndex) => {
			totalsRow.getCell(dayIndex + 3).value = dailyMinutes[day] ?? 0;
			totalsRow.getCell(dayIndex + 3).font = { bold: true };
		});

		applyLandscapePrintSetup(sheet);
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
