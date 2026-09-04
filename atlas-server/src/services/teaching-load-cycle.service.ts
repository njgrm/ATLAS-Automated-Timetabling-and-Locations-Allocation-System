import { prisma } from '../lib/prisma.js';

export type TeachingLoadCycleSource = {
	schoolId: number;
	schoolYearId: number;
	state: 'EMPTY' | 'POPULATED';
	version: number;
	initializedAt: string;
	updatedAt: string;
};

export async function ensureTeachingLoadCycle(schoolId: number, schoolYearId: number) {
	const ownershipCount = await prisma.subjectSectionOwnership.count({
		where: { schoolId, schoolYearId },
	});
	const expectedState = ownershipCount > 0 ? 'POPULATED' : 'EMPTY';
	const existing = await prisma.teachingLoadCycle.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	if (!existing) {
		return prisma.teachingLoadCycle.create({
			data: { schoolId, schoolYearId, state: expectedState },
		});
	}
	if (existing.state === expectedState) {
		return existing;
	}
	return prisma.teachingLoadCycle.update({
		where: { id: existing.id },
		data: { state: expectedState, version: { increment: 1 } },
	});
}

export async function getTeachingLoadCycle(schoolId: number, schoolYearId: number) {
	return prisma.teachingLoadCycle.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
}

export async function getOrCreateTeachingLoadCycleSource(schoolId: number, schoolYearId: number): Promise<TeachingLoadCycleSource> {
	const cycle = await ensureTeachingLoadCycle(schoolId, schoolYearId);
	return {
		schoolId,
		schoolYearId,
		state: cycle.state,
		version: cycle.version,
		initializedAt: cycle.initializedAt.toISOString(),
		updatedAt: cycle.updatedAt.toISOString(),
	};
}

export async function refreshTeachingLoadCycle(schoolId: number, schoolYearId: number) {
	const ownershipCount = await prisma.subjectSectionOwnership.count({
		where: { schoolId, schoolYearId },
	});
	return prisma.teachingLoadCycle.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		create: { schoolId, schoolYearId, state: ownershipCount > 0 ? 'POPULATED' : 'EMPTY' },
		update: {
			state: ownershipCount > 0 ? 'POPULATED' : 'EMPTY',
			version: { increment: 1 },
		},
	});
}

export function serializeTeachingLoadCycle(cycle: {
	schoolId: number;
	schoolYearId: number;
	state: 'EMPTY' | 'POPULATED';
	version: number;
	initializedAt: Date;
	updatedAt: Date;
}): TeachingLoadCycleSource {
	return {
		schoolId: cycle.schoolId,
		schoolYearId: cycle.schoolYearId,
		state: cycle.state,
		version: cycle.version,
		initializedAt: cycle.initializedAt.toISOString(),
		updatedAt: cycle.updatedAt.toISOString(),
	};
}
