/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import type { GenerationRunStatus } from '@prisma/client';
import {
	validateHardConstraints,
	type ValidatorContext,
	type ScheduledEntry,
	type ValidationResult,
	type Violation,
} from './constraint-validator.js';
import { constructBaseline, type ConstructorInput } from './schedule-constructor.js';
import { sectionAdapter } from './section-adapter.js';

// ─── Helpers ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

// ─── Types ───

export interface RunSummary {
	classesProcessed: number;
	assignedCount: number;
	unassignedCount: number;
	hardViolationCount: number;
	violationCounts?: Record<string, number>;
}

// ─── Trigger ───

export async function triggerGenerationRun(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
) {
	// Create run as QUEUED
	const run = await prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			triggeredBy: actorId,
			status: 'QUEUED',
		},
	});

	// Transition to RUNNING
	const startedAt = new Date();
	await prisma.generationRun.update({
		where: { id: run.id },
		data: { status: 'RUNNING', startedAt },
	});

	try {
		// ── Fetch all input data for construction ──
		const [sectionsByGrade, faculty, facultySubjects, rooms, subjects, preferences] = await Promise.all([
			sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId),
			prisma.facultyMirror.findMany({
				where: { schoolId, isActiveForScheduling: true },
				select: { id: true, maxHoursPerWeek: true },
			}),
			prisma.facultySubject.findMany({
				where: { schoolId },
				select: { facultyId: true, subjectId: true, gradeLevels: true },
			}),
			prisma.room.findMany({
				where: { building: { schoolId } },
				select: { id: true, type: true, isTeachingSpace: true },
			}),
			prisma.subject.findMany({
				where: { schoolId, isActive: true },
				select: { id: true, minMinutesPerWeek: true, preferredRoomType: true, gradeLevels: true },
			}),
			prisma.facultyPreference.findMany({
				where: { schoolId, schoolYearId },
				select: {
					facultyId: true,
					status: true,
					timeSlots: { select: { day: true, startTime: true, endTime: true, preference: true } },
				},
			}),
		]);

		// ── Run baseline constructor ──
		const constructorInput: ConstructorInput = {
			schoolId,
			schoolYearId,
			sectionsByGrade,
			subjects,
			faculty,
			facultySubjects,
			rooms,
			preferences: preferences.map((p) => ({
				facultyId: p.facultyId,
				status: p.status,
				timeSlots: p.timeSlots.map((ts) => ({
					day: ts.day,
					startTime: ts.startTime,
					endTime: ts.endTime,
					preference: ts.preference,
				})),
			})),
		};
		const result = constructBaseline(constructorInput);

		// ── Validate constructed entries ──
		const validatorCtx: ValidatorContext = {
			schoolId, schoolYearId, runId: run.id,
			entries: result.entries, faculty, facultySubjects, rooms, subjects,
		};
		const validationResult = validateHardConstraints(validatorCtx);

		const summary: RunSummary = {
			classesProcessed: result.classesProcessed,
			assignedCount: result.assignedCount,
			unassignedCount: result.unassignedCount,
			hardViolationCount: validationResult.counts.total,
			violationCounts: validationResult.counts.byCode,
		};

		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();

		// Finalize as COMPLETED with draft entries
		const completed = await prisma.generationRun.update({
			where: { id: run.id },
			data: {
				status: 'COMPLETED',
				finishedAt,
				durationMs,
				summary: summary as object,
				violations: validationResult.violations as unknown as object[],
				draftEntries: result.entries as unknown as object[],
			},
		});

		// Audit log
		await prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'GENERATION_RUN_COMPLETED',
				actorId,
				targetIds: [run.id],
				metadata: { durationMs, summary } as object,
			},
		});

		return completed;
	} catch (error) {
		// Finalize as FAILED
		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();
		const errorMessage = error instanceof Error ? error.message : String(error);

		const failed = await prisma.generationRun.update({
			where: { id: run.id },
			data: {
				status: 'FAILED',
				finishedAt,
				durationMs,
				error: errorMessage,
			},
		});

		await prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'GENERATION_RUN_FAILED',
				actorId,
				targetIds: [run.id],
				metadata: { durationMs, error: errorMessage } as object,
			},
		});

		return failed;
	}
}

// ─── Queries ───

export async function getRunById(runId: number, schoolId: number, schoolYearId: number) {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
	return run;
}

export async function getLatestRun(schoolId: number, schoolYearId: number) {
	const run = await prisma.generationRun.findFirst({
		where: { schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
	});
	if (!run) throw err(404, 'NO_RUNS', 'No generation runs found for this school/year.');
	return run;
}

export async function listRuns(schoolId: number, schoolYearId: number, limit: number = 20) {
	return prisma.generationRun.findMany({
		where: { schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
		take: limit,
	});
}

// ─── Violation queries ───

export interface ViolationReport {
	runId: number;
	status: string;
	violations: Violation[];
	counts: {
		total: number;
		byCode: Record<string, number>;
	};
}

export async function getRunViolations(runId: number, schoolId: number, schoolYearId: number): Promise<ViolationReport> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, violations: true, summary: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	const violations = (run.violations ?? []) as unknown as Violation[];
	const summary = (run.summary ?? {}) as Record<string, unknown>;
	const violationCounts = (summary.violationCounts ?? {}) as Record<string, number>;

	return {
		runId: run.id,
		status: run.status,
		violations,
		counts: {
			total: violations.length,
			byCode: violationCounts,
		},
	};
}

export async function getLatestRunViolations(schoolId: number, schoolYearId: number): Promise<ViolationReport> {
	const run = await prisma.generationRun.findFirst({
		where: { schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
		select: { id: true, status: true, violations: true, summary: true },
	});
	if (!run) throw err(404, 'NO_RUNS', 'No generation runs found for this school/year.');

	const violations = (run.violations ?? []) as unknown as Violation[];
	const summary = (run.summary ?? {}) as Record<string, unknown>;
	const violationCounts = (summary.violationCounts ?? {}) as Record<string, number>;

	return {
		runId: run.id,
		status: run.status,
		violations,
		counts: {
			total: violations.length,
			byCode: violationCounts,
		},
	};
}

// ─── Draft queries ───

export interface DraftReport {
	runId: number;
	status: string;
	entries: ScheduledEntry[];
	summary: RunSummary | null;
}

export async function getRunDraft(runId: number, schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, draftEntries: true, summary: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	return {
		runId: run.id,
		status: run.status,
		entries: (run.draftEntries ?? []) as unknown as ScheduledEntry[],
		summary: (run.summary ?? null) as RunSummary | null,
	};
}

export async function getLatestRunDraft(schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const run = await prisma.generationRun.findFirst({
		where: { schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
		select: { id: true, status: true, draftEntries: true, summary: true },
	});
	if (!run) throw err(404, 'NO_RUNS', 'No generation runs found for this school/year.');

	return {
		runId: run.id,
		status: run.status,
		entries: (run.draftEntries ?? []) as unknown as ScheduledEntry[],
		summary: (run.summary ?? null) as RunSummary | null,
	};
}
