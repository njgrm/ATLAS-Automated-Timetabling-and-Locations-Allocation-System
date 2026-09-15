/**
 * Teacher Program Export Workload Service
 *
 * Produces the export-ready data shape for the official teacher-program DOCX.
 *
 * BENEFICIARY-EXPORT-PARITY-C05R1 contract:
 *  - Rows are a teacher-day projection over the selected term's resolved
 *    timetable entries plus the canonical shift intervals
 *    (`ClassProgramSlot` class/break rows and effective `PolicySpecialEvent`
 *    rows; the persisted run display slots remain a canonical fallback).
 *  - For every canonical shift interval and weekday:
 *      assigned class        -> teaching row;
 *      configured break/event -> that event row;
 *      ordinary gap          -> `Ancillary Work`.
 *  - `Ancillary Work` is an export-only presentation of an unoccupied teacher
 *    period. It is never persisted into the generation run, carries no room /
 *    conflict authority, and contributes ZERO teaching-load minutes.
 *  - `ARAL Program` and `Homeroom Guidance` are absent from rows and load
 *    arithmetic; `Araling Panlipunan` stays an ordinary subject.
 *  - Load arithmetic: `Actual Teaching Load` = teaching minutes only;
 *    `Total Teaching Load` = actual teaching minutes + effective adviser
 *    credit for a real adviser assignment. Breaks, ancillary, HG and ARAL
 *    contribute zero.
 */

import { prisma } from '../lib/prisma.js';
import { getDataContext } from '../lib/data-context.js';
import { normalizeGradeLevelSync } from './class-program-slot.service.js';
import { resolveExportSignatoryProfile, type TeacherProgramSignatoryProfile } from './export-presentation.service.js';

// ─── Types ───

export type WorkloadRowKind = 'TEACHING' | 'BREAK' | 'ANCILLARY' | 'ADVISORY';

export interface TeacherProgramWorkloadRow {
	kind: WorkloadRowKind;
	/** Display label for the row (e.g. subject name, "Lunch Break", "Ancillary Work") */
	label: string;
	/** Grade and section display (e.g. "Grade 7 - Rizal") */
	gradeAndSection: string | null;
	/** Representative (earliest) day of week for the row */
	day: string;
	/** Time slot display (e.g. "7:30 AM - 8:30 AM") */
	timeSlot: string;
	/** Duration in minutes */
	minutes: number;
	/** Building / Room label (e.g. "Building A / Room 101") */
	room: string | null;
	/** Source of the row for audit trail */
	source: string;
}

export interface TeacherProgramExportRow extends TeacherProgramWorkloadRow {
	/** Weekdays (Mon-Fri) this row truthfully covers. */
	days: string[];
	/** Compacted day label, e.g. "Monday to Friday". */
	dayLabel: string;
	/** True for export-only presentation rows (ancillary/break) that are never persisted. */
	presentationOnly: boolean;
	/** True when the row is a configured break / policy special event. */
	isEvent: boolean;
	/** Canonical shift interval identity (24h), when the row came from a shift interval. */
	intervalStart: string | null;
	intervalEnd: string | null;
}

export interface TeacherProgramWorkloadSummary {
	/** Ancillary credited minutes per week. Always zero-contribution by contract. */
	ancillaryMinutes: number;
	/** Ancillary role labels (metadata only, never added to load totals). */
	ancillaryLabels: string[];
	/** Effective adviser credit minutes per week. */
	advisoryMinutes: number;
	/** Advisory section label */
	advisorySectionLabel: string | null;
	/** Actual teaching minutes per week (sum of teaching entry durations). */
	actualTeachingMinutes: number;
	/**
	 * Total teaching load. C05R1 operator contract:
	 * `Total = actual teaching load + effective adviser credit`; ancillary,
	 * breaks, HG and ARAL carry zero.
	 */
	totalTeachingLoad: number;
	/** Daily teaching-only totals: day -> teaching minutes. */
	dailyTotals: Record<string, number>;
	/** Warnings generated during workload assembly */
	warnings: string[];
}

export interface TeacherProgramExportShape {
	teacher: {
		id: number;
		fullName: string;
		employeeId: string | null;
		plantillaPosition: string | null;
		designationTitle: string | null;
		undergraduateDegree: string | null;
		postgraduateDegree: string | null;
		/** Existing faculty image value (if any); the DOCX embeds it only when usable. */
		avatarUrl: string | null;
	};
	schoolYear: {
		id: number;
		label: string;
	};
	/** Configurable branding; unset lines render as blank-line placeholders. */
	branding: {
		schoolName: string;
		regionLine: string;
		divisionLine: string;
		districtLine: string;
	};
	/** Resolved selected ordered term; null only for legacy unscoped callers. */
	term: {
		index: number | null;
		label: string;
	};
	/** Persisted run publication state (C05 T10/M23). */
	publication: {
		isPublished: boolean;
		publishedAt: string | null;
		revisionId: number | null;
	};
	/** Conditioned conventions derived from persisted scheduling policy. */
	notes: {
		/** True when policy defines the Monday HGP/PEACE window. */
		hgpPeaceIncluded: boolean;
	};
	/** Editable, year-scoped signatory profile resolved for this export. */
	signatories: TeacherProgramSignatoryProfile;
	rows: TeacherProgramExportRow[];
	summary: TeacherProgramWorkloadSummary;
}

// ─── Helpers ───

const DAY_ORDER: Record<string, number> = {
	MONDAY: 1,
	TUESDAY: 2,
	WEDNESDAY: 3,
	THURSDAY: 4,
	FRIDAY: 5,
};

export const SCHOOL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const DAY_LABELS: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
};

function displayTimeToMinutes(timeSlot: string): number {
	const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
	if (!match) return Number.MAX_SAFE_INTEGER;
	let hour = Number(match[1]);
	const minute = Number(match[2]);
	const period = match[3].toUpperCase();
	if (period === 'AM' && hour === 12) hour = 0;
	if (period === 'PM' && hour < 12) hour += 12;
	return hour * 60 + minute;
}

export function sortTeacherProgramWorkloadRows(rows: TeacherProgramWorkloadRow[]): TeacherProgramWorkloadRow[] {
	return [...rows].sort((a, b) => {
		const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
		if (dayDiff !== 0) return dayDiff;
		const timeDiff = displayTimeToMinutes(a.timeSlot) - displayTimeToMinutes(b.timeSlot);
		if (timeDiff !== 0) return timeDiff;
		return a.label.localeCompare(b.label)
			|| (a.gradeAndSection ?? '').localeCompare(b.gradeAndSection ?? '')
			|| (a.room ?? '').localeCompare(b.room ?? '')
			|| a.source.localeCompare(b.source);
	});
}

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

function minutesBetween(start: string, end: string): number {
	return Math.max(0, toMinutes(end) - toMinutes(start));
}

/** `Monday to Friday` when all five weekdays share the row; otherwise explicit days. */
export function compactDayLabel(days: string[]): string {
	const sorted = [...new Set(days)].sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99));
	if (sorted.length === 5 && sorted.every((day, index) => day === SCHOOL_DAYS[index])) {
		return 'Monday to Friday';
	}
	return sorted.map((day) => DAY_LABELS[day] ?? day).join(', ');
}

function parseGradeNumber(section: { gradeLevelId?: number | null; gradeLevelName?: string | null }): number | null {
	const fromName = section.gradeLevelName?.match(/Grade\s+(\d+)/i);
	if (fromName) return Number.parseInt(fromName[1], 10);
	if (typeof section.gradeLevelId === 'number' && Number.isFinite(section.gradeLevelId)) {
		return normalizeGradeLevelSync(section.gradeLevelId);
	}
	return null;
}

// ─── Canonical shift intervals ───

type CanonicalInterval = {
	startTime: string;
	endTime: string;
	kind: 'CLASS' | 'EVENT';
	label: string | null;
	dayOfWeek: string | null;
};

/**
 * Resolve the teacher's canonical shift from the immutable shift authorities:
 * `ClassProgramSlot` class/break rows for the grades the teacher teaches,
 * effective `PolicySpecialEvent` rows, and the persisted run display slots
 * (the persisted canonical union used when class-program slots are absent).
 */
async function resolveCanonicalIntervals(params: {
	db: any;
	schoolId: number;
	schoolYearId: number;
	grades: number[];
	displaySlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string }>;
}): Promise<CanonicalInterval[]> {
	const { db, schoolId, schoolYearId, grades, displaySlots } = params;
	const intervals = new Map<string, CanonicalInterval>();
	const add = (interval: CanonicalInterval) => {
		const key = `${interval.startTime}-${interval.endTime}`;
		const existing = intervals.get(key);
		// A CLASS classification wins over an EVENT classification for the same
		// interval so a teaching-capable period is never mislabelled as a break.
		if (!existing || (existing.kind === 'EVENT' && interval.kind === 'CLASS')) {
			intervals.set(key, interval);
		}
	};

	// 1. Persisted class-program slots (canonical shift template).
	if (grades.length > 0 && db.classProgramSlot?.findMany) {
		try {
			const slots = await db.classProgramSlot.findMany({
				where: { schoolId, schoolYearId, isActive: true },
				select: { startTime: true, endTime: true, rowKind: true, subjectLabel: true, dayOfWeek: true, gradeLevel: true },
			});
			for (const slot of slots ?? []) {
				if (!grades.includes(slot.gradeLevel)) continue;
				if (slot.rowKind === 'CLASS') {
					add({ startTime: slot.startTime, endTime: slot.endTime, kind: 'CLASS', label: null, dayOfWeek: null });
				} else if (slot.rowKind === 'BREAK') {
					add({
						startTime: slot.startTime,
						endTime: slot.endTime,
						kind: 'EVENT',
						label: slot.subjectLabel ?? 'Break',
						dayOfWeek: slot.dayOfWeek ?? null,
					});
				}
			}
		} catch {
			// An injected read-only fixture may omit the delegate; fall through to
			// the persisted display slots below.
		}
	}

	// 2. Effective policy special events.
	if (db.policySpecialEvent?.findMany) {
		try {
			const events = await db.policySpecialEvent.findMany({
				where: { schoolId, schoolYearId, enabled: true },
				select: { label: true, startTime: true, endTime: true, dayOfWeek: true },
			});
			for (const event of events ?? []) {
				add({
					startTime: event.startTime,
					endTime: event.endTime,
					kind: 'EVENT',
					label: event.label ?? 'Special Event',
					dayOfWeek: event.dayOfWeek ?? null,
				});
			}
		} catch {
			// Optional authority for fixture clients.
		}
	}

	// 3. Persisted run display slots (canonical union fallback).
	for (const slot of displaySlots) {
		if (slot.isSpecialEvent) {
			add({
				startTime: slot.startTime,
				endTime: slot.endTime,
				kind: 'EVENT',
				label: slot.eventName ?? 'Break',
				dayOfWeek: slot.dayOfWeek ?? null,
			});
		} else {
			add({ startTime: slot.startTime, endTime: slot.endTime, kind: 'CLASS', label: null, dayOfWeek: null });
		}
	}

	return [...intervals.values()].sort(
		(left, right) => toMinutes(left.startTime) - toMinutes(right.startTime) || toMinutes(left.endTime) - toMinutes(right.endTime),
	);
}

/** Day scope for a configured break/event interval. Monday-only FLAG resolves to Monday. */
function eventDays(label: string | null, dayOfWeek: string | null): string[] {
	const explicit = (dayOfWeek ?? '').trim().toUpperCase();
	if (explicit && (SCHOOL_DAYS as readonly string[]).includes(explicit)) return [explicit];
	if ((label ?? '').toUpperCase().includes('FLAG')) return ['MONDAY'];
	return [...SCHOOL_DAYS];
}

// ─── Main Function ───

export async function buildTeacherProgramExportShape(params: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	facultyId: number;
	/** Resolved numeric ordered-term index from the verified term authority. */
	termIndex?: number;
	/** Disposable read-only client for source-level export contract tests. */
	client?: any;
	/** Disposable published-schedule resolver for source-level export contract tests. */
	publishedScheduleResolver?: (schoolId: number, facultyId: number, schoolYearId: number) => Promise<{
		entries?: unknown[];
		source?: { runId?: number } | null;
	}>;
}): Promise<TeacherProgramExportShape> {
	const { schoolId, schoolYearId, runId, facultyId, termIndex, client, publishedScheduleResolver } = params;
	const db = (client ?? getDataContext() ?? prisma) as any;

	// 1. Load faculty mirror
	const faculty = await db.facultyMirror.findFirst({
		where: { id: facultyId, schoolId, isStale: false },
	});
	if (!faculty) throw new Error('FACULTY_NOT_FOUND');

	const fullName = [faculty.lastName, faculty.firstName].filter(Boolean).join(', ');

	// 2. Load generation run
	const run = await db.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, summary: true, draftEntries: true },
	});
	if (!run) throw new Error('RUN_NOT_FOUND');

	const isPublished = (run.summary as Record<string, unknown> | null)?.isPublished === true;
	if (run.status !== 'COMPLETED' && !isPublished) throw new Error('RUN_NOT_COMPLETED');

	// 3. Load school year label
	const mirror = await db.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		select: { yearLabel: true },
	});

	// 4. Load scheduling policy (breaks + effective advisory-credit policy)
	const policy = await db.schedulingPolicy.findFirst({
		where: { schoolId, schoolYearId },
		select: {
			lunchStartTime: true,
			lunchEndTime: true,
			recessStartTime: true,
			recessEndTime: true,
			flagCeremonyStartTime: true,
			flagCeremonyEndTime: true,
			enableRecess: true,
			enableFlagCeremony: true,
			advisoryCreditMinutes: true,
		},
	});

	const runSummary = run.summary as Record<string, unknown> | null;
	const displaySlots = (runSummary?.timetableDisplaySlots as Array<{
		startTime: string;
		endTime: string;
		isSpecialEvent?: boolean;
		eventName?: string;
		dayOfWeek?: string;
	}> | undefined) ?? [];

	// 5. Load reference maps
	const [subjects, rooms, buildings, school] = await Promise.all([
		db.subject.findMany({
			where: { schoolId, isActive: true },
			select: { id: true, name: true, code: true },
		}),
		db.room.findMany({
			where: { building: { schoolId } },
			select: { id: true, name: true, building: { select: { name: true } } },
		}),
		db.building.findMany({
			where: { schoolId },
			select: { id: true, name: true },
		}),
		db.school.findUnique({
			where: { id: schoolId },
			select: { name: true },
		}),
	]);

	const subjectMap = new Map<number, { id: number; name: string | null; code: string | null }>(
		subjects.map((s: any) => [s.id, s]),
	);
	const roomMap = new Map<number, { name: string; buildingName: string }>(
		rooms.map((r: any) => [r.id, { name: r.name, buildingName: r.building.name }]),
	);
	const buildingMap = new Map<number, string>(buildings.map((b: any) => [b.id, b.name]));
	void buildingMap;

	// 6. Extract teaching entries for this faculty from the run
	type RunEntry = {
		entryId: string;
		facultyId: number | null;
		roomId: number | null;
		subjectId: number | null;
		sectionId: number | null;
		day: string;
		startTime: string;
		endTime: string;
		durationMinutes: number;
		termIndex?: number | null;
	};

	// For published runs, resolve revision-effective entries via the published schedule service.
	// Do NOT fall back to draftEntries — published schedule resolution failures must be explicit.
	let facultyEntries: RunEntry[];
	if (isPublished) {
		const resolvePublished = publishedScheduleResolver ?? (async (resolvedSchoolId: number, resolvedFacultyId: number, resolvedSchoolYearId: number) => {
			const { getPublishedFacultySchedule } = await import('./published-schedule.service.js');
			return getPublishedFacultySchedule(resolvedSchoolId, resolvedFacultyId, resolvedSchoolYearId);
		});
		const published = await resolvePublished(schoolId, facultyId, schoolYearId);
		// BENEFICIARY-EXPORT-PARITY-C05 T2/M4 — the export URL is run-scoped and
		// published; never silently substitute the latest published run when the
		// authoritative published identity for this scope differs from the
		// requested run. This mirrors workbook-export.service.ts exactly.
		if (published.source?.runId !== runId) {
			throw new Error('RUN_NOT_FOUND');
		}
		facultyEntries = (published.entries ?? []).map((entry) => {
			const value = entry as {
				entryId?: string;
				day?: string;
				startTime?: string;
				endTime?: string;
				durationMinutes?: number;
				subject?: { id?: number | null };
				section?: { externalId?: number | null; id?: number | null };
				faculty?: { id?: number | null };
				room?: { id?: number | null };
				termIndex?: number | null;
			};
			return {
				entryId: value.entryId ?? `published-${facultyId}-${value.day ?? 'UNKNOWN'}-${value.startTime ?? 'UNKNOWN'}`,
				facultyId: value.faculty?.id ?? facultyId,
				roomId: value.room?.id ?? null,
				subjectId: value.subject?.id ?? null,
				sectionId: value.section?.externalId ?? value.section?.id ?? null,
				day: value.day ?? 'UNKNOWN',
				startTime: value.startTime ?? '',
				endTime: value.endTime ?? '',
				durationMinutes: value.durationMinutes ?? minutesBetween(value.startTime ?? '', value.endTime ?? ''),
				termIndex: value.termIndex ?? null,
			};
		});
	} else {
		const allEntries = (run.draftEntries ?? []) as unknown as RunEntry[];
		facultyEntries = allEntries.filter((e) => e.facultyId === facultyId);
	}

	// Selected ordered-term export: one committed term never mixes another term's
	// rotating subject/teacher/room. Missing term identity fails closed.
	if (termIndex !== undefined) {
		if (facultyEntries.some((entry) => entry.termIndex == null)) {
			const error = new Error('TERM_FILTER_NOT_READY');
			(error as Error & { code?: string }).code = 'TERM_FILTER_NOT_READY';
			throw error;
		}
		facultyEntries = facultyEntries.filter((entry) => entry.termIndex === termIndex);
	}

	// Reference-only rows are never printable teaching output. Generation
	// preflight rejects these subjects, but keep exports fail-closed for older
	// or manually edited runs that still contain a stale HG/ARAL entry.
	facultyEntries = facultyEntries.filter((entry) => {
		const code = entry.subjectId != null ? subjectMap.get(entry.subjectId)?.code?.trim().toUpperCase() : null;
		return code !== 'HG' && code !== 'ARAL';
	});

	// C05 M16 — an empty selected-term renderable set must never emit a
	// header-only teacher program (zero bytes).
	if (facultyEntries.length === 0) {
		const error = new Error('EMPTY_SELECTED_TERM');
		(error as Error & { code?: string }).code = 'EMPTY_SELECTED_TERM';
		throw error;
	}

	// 7. Load section mirrors for grade/section labels
	const sectionIds = [...new Set(facultyEntries.map((e) => e.sectionId).filter((id): id is number => id != null))];
	const sections = sectionIds.length > 0
		? await db.sectionMirror.findMany({
			where: {
				OR: [
					{ externalId: { in: sectionIds }, schoolId, schoolYearId },
					{ id: { in: sectionIds }, schoolId, schoolYearId },
				],
			},
			select: { id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true, programType: true },
		})
		: [];
	const sectionByExternalId = new Map(sections.filter((s: any) => s.externalId != null).map((s: any) => [s.externalId, s]));
	const sectionByLocalId = new Map(sections.map((s: any) => [s.id, s]));
	function resolveSection(sectionId: number | null): any | null {
		if (sectionId == null) return null;
		return sectionByExternalId.get(sectionId) ?? sectionByLocalId.get(sectionId) ?? null;
	}

	// 8. Canonical shift intervals for the grades the teacher actually teaches.
	const grades: number[] = [...new Set(
		(sections as any[])
			.map((section: any) => parseGradeNumber(section))
			.filter((grade): grade is number => typeof grade === 'number' && Number.isFinite(grade)),
	)];
	const canonicalIntervals = await resolveCanonicalIntervals({ db, schoolId, schoolYearId, grades, displaySlots });
	const intervalsByKey = new Map<string, CanonicalInterval>(
		canonicalIntervals.map((interval) => [`${interval.startTime}-${interval.endTime}`, interval]),
	);

	// 9. Build the per-weekday teacher-day projection
	type ProjectedRow = TeacherProgramExportRow;
	const projected: ProjectedRow[] = [];
	const warnings: string[] = [];

	const pushProjected = (row: {
		kind: WorkloadRowKind;
		label: string;
		gradeAndSection: string | null;
		minutes: number;
		room: string | null;
		source: string;
		startTime: string;
		endTime: string;
		days: string[];
		presentationOnly: boolean;
		isEvent: boolean;
	}) => {
		const sortedDays = [...new Set(row.days)].sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99));
		projected.push({
			kind: row.kind,
			label: row.label,
			gradeAndSection: row.gradeAndSection,
			day: sortedDays[0] ?? 'MONDAY',
			days: sortedDays,
			dayLabel: compactDayLabel(sortedDays),
			timeSlot: row.startTime && row.endTime ? `${formatTime12h(row.startTime)} - ${formatTime12h(row.endTime)}` : '',
			minutes: row.minutes,
			room: row.room,
			source: row.source,
			presentationOnly: row.presentationOnly,
			isEvent: row.isEvent,
			intervalStart: row.startTime || null,
			intervalEnd: row.endTime || null,
		});
	};

	// 9a. Teaching entries -> exact intervals; index by interval+day.
	const teachingByIntervalDay = new Map<string, RunEntry[]>();
	const unmatchedTeaching: RunEntry[] = [];
	for (const entry of facultyEntries) {
		const key = `${entry.startTime}-${entry.endTime}`;
		if (intervalsByKey.has(key)) {
			const bucket = teachingByIntervalDay.get(key) ?? [];
			bucket.push(entry);
			teachingByIntervalDay.set(key, bucket);
		} else {
			unmatchedTeaching.push(entry);
		}
	}

	for (const interval of canonicalIntervals) {
		const key = `${interval.startTime}-${interval.endTime}`;
		const entries = teachingByIntervalDay.get(key) ?? [];
		const daysWithClass = new Set(entries.map((entry) => entry.day));
		const teachingDays: string[] = [];
		const ancillaryDays: string[] = [];
		const eventDaysForInterval = eventDays(interval.label, interval.dayOfWeek);

		for (const day of SCHOOL_DAYS) {
			if (daysWithClass.has(day)) {
				teachingDays.push(day);
			} else if (interval.kind === 'EVENT' && eventDaysForInterval.includes(day)) {
				// configured break/event row
			} else {
				ancillaryDays.push(day);
			}
		}

		// Group teaching entries that share the same truthful identity.
		const teachingGroups = new Map<string, { entry: RunEntry; days: string[] }>();
		for (const entry of entries) {
			const subject = entry.subjectId ? subjectMap.get(entry.subjectId) : null;
			const section = resolveSection(entry.sectionId);
			const room = entry.roomId ? roomMap.get(entry.roomId) : null;
			const gradeSection = section ? `${section.gradeLevelName} - ${section.name}` : null;
			const roomLabel = room ? `${room.buildingName} / ${room.name}` : null;
			const groupKey = [entry.subjectId ?? '', gradeSection ?? '', roomLabel ?? '', entry.durationMinutes].join('|||');
			const existing = teachingGroups.get(groupKey);
			if (existing) {
				existing.days.push(entry.day);
			} else {
				teachingGroups.set(groupKey, { entry, days: [entry.day] });
			}
		}
		for (const { entry, days } of teachingGroups.values()) {
			const subject = entry.subjectId ? subjectMap.get(entry.subjectId) : null;
			const section = resolveSection(entry.sectionId);
			const room = entry.roomId ? roomMap.get(entry.roomId) : null;
			pushProjected({
				kind: 'TEACHING',
				label: subject?.name ?? 'Unknown Subject',
				gradeAndSection: section ? `${section.gradeLevelName} - ${section.name}` : null,
				minutes: entry.durationMinutes,
				room: room ? `${room.buildingName} / ${room.name}` : null,
				source: `GENERATION_RUN_${runId}`,
				startTime: entry.startTime,
				endTime: entry.endTime,
				days,
				presentationOnly: false,
				isEvent: false,
			});
		}

		if (interval.kind === 'EVENT') {
			const label = interval.label ?? 'Break';
			const scopedDays = eventDaysForInterval.filter((day) => !daysWithClass.has(day));
			if (scopedDays.length > 0) {
				pushProjected({
					kind: 'BREAK',
					label,
					gradeAndSection: null,
					minutes: minutesBetween(interval.startTime, interval.endTime),
					room: null,
					source: 'SCHEDULING_POLICY',
					startTime: interval.startTime,
					endTime: interval.endTime,
					days: scopedDays,
					presentationOnly: true,
					isEvent: true,
				});
			}
		}

		if (ancillaryDays.length > 0) {
			pushProjected({
				kind: 'ANCILLARY',
				label: 'Ancillary Work',
				gradeAndSection: null,
				minutes: minutesBetween(interval.startTime, interval.endTime),
				room: null,
				// Export-only projection: never persisted into the generation run.
				source: 'EXPORT_PROJECTION',
				startTime: interval.startTime,
				endTime: interval.endTime,
				days: ancillaryDays,
				presentationOnly: true,
				isEvent: false,
			});
		}
	}

	// 9b. Teaching entries outside the canonical shift still render (authoritative).
	for (const entry of unmatchedTeaching) {
		const subject = entry.subjectId ? subjectMap.get(entry.subjectId) : null;
		const section = resolveSection(entry.sectionId);
		const room = entry.roomId ? roomMap.get(entry.roomId) : null;
		pushProjected({
			kind: 'TEACHING',
			label: subject?.name ?? 'Unknown Subject',
			gradeAndSection: section ? `${section.gradeLevelName} - ${section.name}` : null,
			minutes: entry.durationMinutes,
			room: room ? `${room.buildingName} / ${room.name}` : null,
			source: `GENERATION_RUN_${runId}`,
			startTime: entry.startTime,
			endTime: entry.endTime,
			days: [entry.day],
			presentationOnly: false,
			isEvent: false,
		});
	}

	// 9c. Ancillary metadata (no load effect). Kept for reporting only.
	const ancillaryRoles: string[] = Array.isArray(faculty.ancillaryRoles) ? faculty.ancillaryRoles : [];
	const ancillaryMinutesPerWeek = Number(faculty.ancillaryMinutesPerWeek ?? 0) || 0;
	if (ancillaryMinutesPerWeek > 0 && ancillaryRoles.length === 0) {
		warnings.push('Ancillary minutes exist but no role labels were provided.');
	}
	if (ancillaryMinutesPerWeek > 0) {
		warnings.push('Ancillary reported minutes are metadata only and contribute zero to teaching load.');
	}

	// 9d. Adviser credit — only through the persisted advisory-credit policy and
	// a real adviser assignment. ARAL/HG carry zero.
	const isRealAdviser = faculty.isClassAdviser === true
		&& (faculty.advisedSectionId != null || (faculty.advisedSectionName ?? '').trim().length > 0);
	const policyAdvisoryCredit = typeof policy?.advisoryCreditMinutes === 'number' && Number.isFinite(policy.advisoryCreditMinutes)
		? Math.max(0, Math.round(policy.advisoryCreditMinutes))
		: 0;
	const advisoryMinutesPerWeek = isRealAdviser ? policyAdvisoryCredit : 0;

	// 10. Compute summary
	const teachingMinutes = facultyEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
	const totalTeachingLoad = teachingMinutes + advisoryMinutesPerWeek;

	const dailyTotals: Record<string, number> = {};
	for (const row of projected) {
		if (row.kind !== 'TEACHING') continue;
		for (const day of row.days) {
			dailyTotals[day] = (dailyTotals[day] ?? 0) + row.minutes;
		}
	}

	const workloadSummary: TeacherProgramWorkloadSummary = {
		ancillaryMinutes: 0,
		ancillaryLabels: ancillaryRoles,
		advisoryMinutes: advisoryMinutesPerWeek,
		advisorySectionLabel: isRealAdviser ? (faculty.advisedSectionName ?? null) : null,
		actualTeachingMinutes: teachingMinutes,
		totalTeachingLoad,
		dailyTotals,
		warnings,
	};

	// 11. Publication state + resolved signatory profile
	const publicationRecord = runSummary?.publication as { revisionId?: unknown } | undefined;
	const revisionId = Number(publicationRecord?.revisionId);
	const publication = {
		isPublished: runSummary?.isPublished === true,
		publishedAt: typeof runSummary?.publishedAt === 'string' ? runSummary.publishedAt : null,
		revisionId: Number.isInteger(revisionId) && revisionId > 0 ? revisionId : null,
	};

	const signatories = await resolveExportSignatoryProfile({
		schoolId,
		schoolYearId,
		isPublished: publication.isPublished,
		publishedAt: publication.publishedAt,
		client: db,
	});

	// Deterministic interval ordering: start, end, kind weight, label.
	const KIND_WEIGHT: Record<string, number> = { TEACHING: 0, BREAK: 1, ANCILLARY: 2, ADVISORY: 3 };
	const rows = [...projected].sort((a, b) => {
		const startDiff = (a.intervalStart ? toMinutes(a.intervalStart) : Number.MAX_SAFE_INTEGER)
			- (b.intervalStart ? toMinutes(b.intervalStart) : Number.MAX_SAFE_INTEGER);
		if (startDiff !== 0) return startDiff;
		const endDiff = (a.intervalEnd ? toMinutes(a.intervalEnd) : 0) - (b.intervalEnd ? toMinutes(b.intervalEnd) : 0);
		if (endDiff !== 0) return endDiff;
		const kindDiff = (KIND_WEIGHT[a.kind] ?? 9) - (KIND_WEIGHT[b.kind] ?? 9);
		if (kindDiff !== 0) return kindDiff;
		return a.label.localeCompare(b.label) || (a.gradeAndSection ?? '').localeCompare(b.gradeAndSection ?? '');
	});

	return {
		teacher: {
			id: faculty.id,
			fullName,
			employeeId: faculty.employeeId,
			plantillaPosition: faculty.plantillaPosition ?? null,
			designationTitle: faculty.designationTitle ?? null,
			undergraduateDegree: faculty.undergraduateDegree ?? null,
			postgraduateDegree: faculty.postgraduateDegree ?? null,
			avatarUrl: faculty.avatarUrl ?? null,
		},
		schoolYear: {
			id: schoolYearId,
			label: mirror?.yearLabel ?? String(schoolYearId),
		},
		branding: {
			schoolName: school?.name ?? '',
			regionLine: '',
			divisionLine: '',
			districtLine: '',
		},
		term: {
			index: termIndex ?? null,
			label: termIndex != null ? `T${termIndex}` : '',
		},
		publication,
		notes: {
			hgpPeaceIncluded: policy?.enableFlagCeremony === true,
		},
		signatories,
		rows,
		summary: workloadSummary,
	};
}
