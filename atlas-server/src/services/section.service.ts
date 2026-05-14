/**
 * Section service — Wave 5 Durable Mirroring
 * Bridges to section adapter and maintains a local SectionMirror
 * for high availability and local overrides.
 */

import { prisma } from '../lib/prisma.js';
import { sectionAdapter, type SectionSummary, type SectionFetchResult } from './section-adapter.js';

export async function syncSectionsFromExternal(
	schoolId: number,
	schoolYearId: number,
	authToken?: string
): Promise<{ synced: boolean; count: number; removed: number; source: string; fetchedAt: Date }> {
	let result: SectionFetchResult;
	try {
		result = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
	} catch (err) {
		// Auto-fallback to snapshot is handled by adapter.
		// If it still fails, we'll re-throw or return false.
		throw err;
	}

	const externalSections = result.gradeLevels.flatMap(gl => gl.sections);
	const externalIds = new Set(externalSections.map(s => s.id));

	// Upsert into mirror
	for (const gl of result.gradeLevels) {
		for (const s of gl.sections) {
			await prisma.sectionMirror.upsert({
				where: {
					schoolId_schoolYearId_externalId: {
						schoolId,
						schoolYearId,
						externalId: s.id,
					}
				},
				update: {
					name: s.name,
					gradeLevelId: gl.gradeLevelId,
					gradeLevelName: gl.gradeLevelName,
					displayOrder: gl.displayOrder,
					maxCapacity: s.maxCapacity,
					enrolledCount: s.enrolledCount,
					programType: s.programType,
					programCode: s.programCode,
					programName: s.programName,
					isSpecialProgram: s.isSpecialProgram ?? false,
					lastSyncedAt: result.fetchedAt,
					isStale: false,
					staleReason: null,
				},
				create: {
					externalId: s.id,
					schoolId,
					schoolYearId,
					name: s.name,
					gradeLevelId: gl.gradeLevelId,
					gradeLevelName: gl.gradeLevelName,
					displayOrder: gl.displayOrder,
					maxCapacity: s.maxCapacity,
					enrolledCount: s.enrolledCount,
					programType: s.programType,
					programCode: s.programCode,
					programName: s.programName,
					isSpecialProgram: s.isSpecialProgram ?? false,
					lastSyncedAt: result.fetchedAt,
				}
			});
		}
	}

	// Hard-delete sections that no longer exist in EnrollPro.
	// EnrollPro is the source of truth — stale rows must not persist.
	const { count: deletedCount } = await prisma.sectionMirror.deleteMany({
		where: {
			schoolId,
			schoolYearId,
			externalId: { notIn: Array.from(externalIds) },
		},
	});

	return {
		synced: true,
		count: externalSections.length,
		removed: deletedCount,
		source: result.source,
		fetchedAt: result.fetchedAt,
	};
}

export async function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary> {
	// For Wave 5, we prefer reading from the Mirror first to ensure speed, 
	// but we might want to auto-sync if the mirror is empty.
	
	let mirrors = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
	});

	if (mirrors.length === 0) {
		// Initial sync
		await syncSectionsFromExternal(schoolId, schoolYearId, authToken);
		mirrors = await prisma.sectionMirror.findMany({
			where: { schoolId, schoolYearId, isStale: false },
			orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
		});
	}

	const byGradeLevel: Record<number, number> = {};
	const enrolledByGradeLevel: Record<number, number> = {};
	const sections: SectionSummary['sections'] = [];
	let totalEnrolled = 0;

	// Group mirrors by grade level to reconstruct the gradeLevels array
	const glMap = new Map<number, any>();

	for (const m of mirrors) {
		if (!glMap.has(m.gradeLevelId)) {
			glMap.set(m.gradeLevelId, {
				gradeLevelId: m.gradeLevelId,
				gradeLevelName: m.gradeLevelName,
				displayOrder: m.displayOrder,
				sections: []
			});
		}
		
		const sec = {
			id: m.externalId,
			name: m.name,
			maxCapacity: m.maxCapacity,
			enrolledCount: m.enrolledCount,
			gradeLevelId: m.gradeLevelId,
			gradeLevelName: m.gradeLevelName,
			displayOrder: m.displayOrder,
			programType: m.programType as any,
			programCode: m.programCode,
			programName: m.programName,
			isSpecialProgram: m.isSpecialProgram,
		};
		
		glMap.get(m.gradeLevelId).sections.push(sec);
		sections.push(sec);
		
		byGradeLevel[m.displayOrder] = (byGradeLevel[m.displayOrder] || 0) + 1;
		enrolledByGradeLevel[m.displayOrder] = (enrolledByGradeLevel[m.displayOrder] || 0) + m.enrolledCount;
		totalEnrolled += m.enrolledCount;
	}

	const gradeLevels = Array.from(glMap.values()).sort((a, b) => a.displayOrder - b.displayOrder);

	return {
		schoolId,
		schoolYearId,
		totalSections: sections.length,
		totalEnrolled,
		byGradeLevel,
		enrolledByGradeLevel,
		gradeLevels,
		sections,
		source: 'enrollpro', // Re-evaluate if we want to track 'cached' here
		fetchedAt: mirrors[0]?.lastSyncedAt ?? new Date(),
		isStale: false,
	};
}
