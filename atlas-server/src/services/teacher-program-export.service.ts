/**
 * Teacher Program Export Workload Service
 *
 * Produces the export-ready data shape for the official teacher-program DOCX.
 * Separates actual teaching minutes from credited non-teaching minutes (ancillary, advisory, ARAL).
 */

import { prisma } from '../lib/prisma.js';
import type { GenerationRun, FacultyMirror, Subject, SectionMirror } from '@prisma/client';

// ─── Types ───

export type WorkloadRowKind =
	| 'TEACHING'
	| 'BREAK'
	| 'ANCILLARY'
	| 'ADVISORY'
	| 'ARAL';

export interface TeacherProgramWorkloadRow {
	kind: WorkloadRowKind;
	/** Display label for the row (e.g. subject name, "Lunch Break", "Advisory Class") */
	label: string;
	/** Grade and section display (e.g. "Grade 7 - Rizal") */
	gradeAndSection: string | null;
	/** Day of week (MONDAY-FRIDAY) */
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

export interface TeacherProgramWorkloadSummary {
	/** Total ancillary credited minutes per week */
	ancillaryMinutes: number;
	/** Ancillary role labels */
	ancillaryLabels: string[];
	/** Advisory credited minutes per week (from advisory equivalent hours) */
	advisoryMinutes: number;
	/** Advisory section label */
	advisorySectionLabel: string | null;
	/** ARAL Program credited minutes per week */
	aralMinutes: number;
	/** ARAL source status */
	aralSource: 'CONFIGURED' | 'NOT_CONFIGURED';
	/** Actual teaching minutes per week (sum of teaching entry durations) */
	actualTeachingMinutes: number;
	/** Total teaching load (teaching + ancillary + advisory + ARAL) */
	totalTeachingLoad: number;
	/** Daily breakdown: day -> total minutes */
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
	};
	schoolYear: {
		id: number;
		label: string;
	};
	rows: TeacherProgramWorkloadRow[];
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

function sortRowsByDayAndTime(rows: TeacherProgramWorkloadRow[]): TeacherProgramWorkloadRow[] {
	return [...rows].sort((a, b) => {
		const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
		if (dayDiff !== 0) return dayDiff;
		return a.timeSlot.localeCompare(b.timeSlot);
	});
}

function formatTime12h(time24: string): string {
	const [h, m] = time24.split(':').map(Number);
	const period = h >= 12 ? 'PM' : 'AM';
	const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function minutesBetween(start: string, end: string): number {
	const [sh, sm] = start.split(':').map(Number);
	const [eh, em] = end.split(':').map(Number);
	return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

// ─── Main Function ───

export async function buildTeacherProgramExportShape(params: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	facultyId: number;
}): Promise<TeacherProgramExportShape> {
	const { schoolId, schoolYearId, runId, facultyId } = params;

	// 1. Load faculty mirror
	const faculty = await prisma.facultyMirror.findFirst({
		where: { id: facultyId, schoolId, isStale: false },
	});
	if (!faculty) throw new Error('FACULTY_NOT_FOUND');

	const fullName = [faculty.lastName, faculty.firstName].filter(Boolean).join(', ');

	// 2. Load generation run
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, summary: true, draftEntries: true },
	});
	if (!run) throw new Error('RUN_NOT_FOUND');

	const isPublished = (run.summary as Record<string, unknown> | null)?.isPublished === true;
	if (run.status !== 'COMPLETED' && !isPublished) throw new Error('RUN_NOT_COMPLETED');

	// 3. Load school year label
	const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		select: { yearLabel: true },
	});

	// 4. Load scheduling policy for break configuration
	const policy = await prisma.schedulingPolicy.findFirst({
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
		},
	});

	const runSummary = run.summary as Record<string, unknown> | null;
	const displaySlots = (runSummary?.timetableDisplaySlots as Array<{
		startTime: string;
		endTime: string;
		isSpecialEvent?: boolean;
		eventName?: string;
	}> | undefined) ?? [];

	// 5. Load reference maps
	const [subjects, rooms, buildings] = await Promise.all([
		prisma.subject.findMany({
			where: { schoolId, isActive: true },
			select: { id: true, name: true, code: true },
		}),
		prisma.room.findMany({
			where: { building: { schoolId } },
			select: { id: true, name: true, building: { select: { name: true } } },
		}),
		prisma.building.findMany({
			where: { schoolId },
			select: { id: true, name: true },
		}),
	]);

	const subjectMap = new Map(subjects.map(s => [s.id, s]));
	const roomMap = new Map(rooms.map(r => [r.id, { name: r.name, buildingName: r.building.name }]));
	const buildingMap = new Map(buildings.map(b => [b.id, b.name]));

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
	};

	// For published runs, resolve revision-effective entries via the published schedule service.
	// Do NOT fall back to draftEntries — published schedule resolution failures must be explicit.
	let facultyEntries: RunEntry[];
	if (isPublished) {
		const { getPublishedFacultySchedule } = await import('./published-schedule.service.js');
		const published = await getPublishedFacultySchedule(schoolId, facultyId, schoolYearId);
		facultyEntries = (published.entries ?? []) as unknown as RunEntry[];
	} else {
		const allEntries = (run.draftEntries ?? []) as unknown as RunEntry[];
		facultyEntries = allEntries.filter(e => e.facultyId === facultyId);
	}

	// 7. Load section mirrors for grade/section labels
	const sectionIds = [...new Set(facultyEntries.map(e => e.sectionId).filter((id): id is number => id != null))];
	const sections = sectionIds.length > 0
		? await prisma.sectionMirror.findMany({
			where: { id: { in: sectionIds }, schoolId, schoolYearId },
			select: { id: true, name: true, gradeLevelName: true },
		})
		: [];
	const sectionMap = new Map(sections.map(s => [s.id, s]));

	// 8. Build rows
	const rows: TeacherProgramWorkloadRow[] = [];
	const warnings: string[] = [];

	// 8a. Break rows from display slots — only on weekdays where school is in session
	// Breaks apply to all 5 weekdays unless policy specifies otherwise
	const breakSlots = displaySlots.filter(s => s.isSpecialEvent);
	const schoolDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
	for (const slot of breakSlots) {
		for (const day of schoolDays) {
			rows.push({
				kind: 'BREAK',
				label: slot.eventName ?? 'Break',
				gradeAndSection: null,
				day,
				timeSlot: `${formatTime12h(slot.startTime)} - ${formatTime12h(slot.endTime)}`,
				minutes: minutesBetween(slot.startTime, slot.endTime),
				room: null,
				source: 'SCHEDULING_POLICY',
			});
		}
	}

	// 8b. Teaching entries
	for (const entry of facultyEntries) {
		const subject = entry.subjectId ? subjectMap.get(entry.subjectId) : null;
		const section = entry.sectionId ? sectionMap.get(entry.sectionId) : null;
		const room = entry.roomId ? roomMap.get(entry.roomId) : null;

		const gradeSection = section
			? `${section.gradeLevelName} - ${section.name}`
			: null;
		const roomLabel = room
			? `${room.buildingName} / ${room.name}`
			: null;

		rows.push({
			kind: 'TEACHING',
			label: subject?.name ?? 'Unknown Subject',
			gradeAndSection: gradeSection,
			day: entry.day,
			timeSlot: `${formatTime12h(entry.startTime)} - ${formatTime12h(entry.endTime)}`,
			minutes: entry.durationMinutes,
			room: roomLabel,
			source: `GENERATION_RUN_${runId}`,
		});
	}

	// 8c. Ancillary rows — weekly-only credited work, not scheduled time slots
	const ancillaryRoles = faculty.ancillaryRoles ?? [];
	const ancillaryMinutesPerWeek = faculty.ancillaryMinutesPerWeek ?? 0;

	if (ancillaryMinutesPerWeek > 0) {
		const labels = ancillaryRoles.length > 0 ? ancillaryRoles : ['Ancillary Work'];
		// Distribute ancillary minutes equally across labels
		const minutesPerRole = Math.floor(ancillaryMinutesPerWeek / labels.length);
		const remainder = ancillaryMinutesPerWeek % labels.length;

		for (let i = 0; i < labels.length; i++) {
			const roleMinutes = minutesPerRole + (i < remainder ? 1 : 0);
			if (roleMinutes <= 0) continue;
			rows.push({
				kind: 'ANCILLARY',
				label: labels[i],
				gradeAndSection: null,
				day: 'WEEKLY', // Weekly-only credited work, not assigned to a specific day
				timeSlot: '',
				minutes: roleMinutes,
				room: null,
				source: faculty.ancillaryLoadSource === 'HR' ? 'ENROLLPRO_HR' : 'LOCAL_ENTRY',
			});
		}
		if (ancillaryRoles.length === 0) {
			warnings.push('Ancillary minutes exist but no role labels were provided.');
		}
	}

	// 8d. Advisory duty — weekly credited work from adviser assignment
	const advisoryMinutesPerWeek = (faculty.advisoryEquivalentHours ?? 0) * 60;
	if (advisoryMinutesPerWeek > 0 && faculty.isClassAdviser) {
		const sectionLabel = faculty.advisedSectionName ?? 'Advisory Class';
		rows.push({
			kind: 'ADVISORY',
			label: `Advisory Class: ${sectionLabel}`,
			gradeAndSection: sectionLabel,
			day: 'WEEKLY', // Weekly credited work, not a scheduled time slot
			timeSlot: '',
			minutes: advisoryMinutesPerWeek,
			room: null,
			source: 'ADVISORY_EQUIVALENT_HOURS',
		});
	}

	// 8e. ARAL Program — no data source exists
	const aralMinutes = 0;
	const aralSource: 'CONFIGURED' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';

	// 9. Compute summary
	const teachingMinutes = facultyEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
	const totalTeachingLoad = teachingMinutes + ancillaryMinutesPerWeek + advisoryMinutesPerWeek + aralMinutes;

	// Daily totals: teaching + break minutes per day
	const dailyTotals: Record<string, number> = {};
	for (const row of rows) {
		if (row.kind === 'TEACHING' || row.kind === 'BREAK') {
			dailyTotals[row.day] = (dailyTotals[row.day] ?? 0) + row.minutes;
		}
	}

	const workloadSummary: TeacherProgramWorkloadSummary = {
		ancillaryMinutes: ancillaryMinutesPerWeek,
		ancillaryLabels: ancillaryRoles,
		advisoryMinutes: advisoryMinutesPerWeek,
		advisorySectionLabel: faculty.advisedSectionName ?? null,
		aralMinutes,
		aralSource,
		actualTeachingMinutes: teachingMinutes,
		totalTeachingLoad,
		dailyTotals,
		warnings,
	};

	return {
		teacher: {
			id: faculty.id,
			fullName,
			employeeId: faculty.employeeId,
			plantillaPosition: faculty.plantillaPosition ?? null,
			designationTitle: faculty.designationTitle ?? null,
			undergraduateDegree: faculty.undergraduateDegree ?? null,
			postgraduateDegree: faculty.postgraduateDegree ?? null,
		},
		schoolYear: {
			id: schoolYearId,
			label: mirror?.yearLabel ?? String(schoolYearId),
		},
		rows: sortRowsByDayAndTime(rows),
		summary: workloadSummary,
	};
}
