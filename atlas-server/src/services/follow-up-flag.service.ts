import { prisma } from '../lib/prisma.js';

function err(statusCode: number, code: string, message: string): Error {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

/** Verify the generation run exists in the given school/year scope. */
async function verifyRunScope(runId: number, schoolId: number, schoolYearId: number): Promise<void> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
}

/** List all follow-up flags for a generation run (scope-verified). */
export async function listByRun(runId: number, schoolId: number, schoolYearId: number) {
	await verifyRunScope(runId, schoolId, schoolYearId);
	return prisma.followUpFlag.findMany({
		where: { runId },
		orderBy: { createdAt: 'desc' },
	});
}

/** Toggle a follow-up flag: create if absent, delete if present. Returns the new state. */
export async function toggleFlag(
	runId: number,
	entryId: string,
	createdBy: number,
	schoolId: number,
	schoolYearId: number,
): Promise<{ flagged: boolean }> {
	await verifyRunScope(runId, schoolId, schoolYearId);

	const existing = await prisma.followUpFlag.findUnique({
		where: { runId_entryId: { runId, entryId } },
	});

	if (existing) {
		await prisma.followUpFlag.delete({ where: { id: existing.id } });
		return { flagged: false };
	}

	await prisma.followUpFlag.create({
		data: { runId, entryId, createdBy },
	});
	return { flagged: true };
}

/** Remove a specific follow-up flag (scope-verified). */
export async function removeFlag(runId: number, entryId: string, schoolId: number, schoolYearId: number) {
	await verifyRunScope(runId, schoolId, schoolYearId);
	return prisma.followUpFlag.deleteMany({
		where: { runId, entryId },
	});
}
