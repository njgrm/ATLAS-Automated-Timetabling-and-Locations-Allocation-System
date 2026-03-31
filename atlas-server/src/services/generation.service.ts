/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import type { GenerationRunStatus } from '@prisma/client';

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
		// ── Placeholder worker (no algorithm yet) ──
		const summary: RunSummary = {
			classesProcessed: 0,
			assignedCount: 0,
			unassignedCount: 0,
			hardViolationCount: 0,
		};

		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();

		// Finalize as COMPLETED
		const completed = await prisma.generationRun.update({
			where: { id: run.id },
			data: {
				status: 'COMPLETED',
				finishedAt,
				durationMs,
				summary: summary as object,
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
