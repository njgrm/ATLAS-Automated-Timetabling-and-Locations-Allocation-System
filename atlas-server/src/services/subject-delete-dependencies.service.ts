/**
 * Shared dependency collector for subject deletion.
 *
 * Both preview and apply use the same collector to ensure they see
 * the exact same dependency graph. This eliminates the TOCTOU gap
 * where preview and apply could use different, incomplete checks.
 *
 * The collector is transaction-aware: it accepts a Prisma client
 * (or transaction client) so apply can use it inside a transaction.
 *
 * Uses set-based queries to avoid N+1 problems.
 */

import type { PrismaClient } from '@prisma/client';

/**
 * A single dependency row in the deletion manifest.
 * Contains enough identity and state to detect drift.
 */
export type DeleteDependencyRow = {
	type: string;
	id: number;
	/** Stable composite key for types without a single numeric id */
	compositeKey?: string;
	classification: 'ACTIVE' | 'HISTORICAL' | 'BLOCKING' | 'IMMUTABLE';
	description: string;
	/** School ownership where relevant */
	schoolId?: number;
	/** Current lifecycle/state fields */
	state?: Record<string, unknown>;
	/** Version or updatedAt where available */
	version?: string;
	/** The proposed action for this dependency */
	action: 'DELETE' | 'KEEP' | 'BLOCKS_DELETION';
	/** The subject identifier this dependency belongs to */
	subjectId: number;
};

/**
 * The complete dependency graph for a subject deletion.
 * Contains exact row-level data for fingerprinting.
 */
export type DeleteDependencyGraph = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	actorSchoolId: number;
	subjectVersion: string;
	subjectIsActive: boolean;
	dependencies: DeleteDependencyRow[];
	/** Summary counts for presentation */
	summary: {
		activeCount: number;
		historicalCount: number;
		blockingCount: number;
		immutableCount: number;
		deletable: boolean;
		blockingReasons: string[];
	};
};

/**
 * Collect the complete dependency graph for a subject.
 * Uses the provided prisma client/tx for all reads.
 *
 * This is the SINGLE source of truth for what depends on a subject.
 * Both preview and apply MUST use this function.
 *
 * Uses set-based queries to avoid N+1 problems.
 */
export async function collectDeleteDependencies(
	prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
	subjectId: number,
	actorSchoolId: number,
): Promise<DeleteDependencyGraph | { error: { status: number; code: string; message: string } }> {
	// 1. Read the subject itself
	const subject = await prisma.subject.findUnique({
		where: { id: subjectId },
		select: {
			id: true,
			schoolId: true,
			code: true,
			name: true,
			isActive: true,
			updatedAt: true,
		},
	});

	if (!subject) {
		return { error: { status: 404, code: 'NOT_FOUND', message: 'Subject not found.' } };
	}
	if (subject.schoolId !== actorSchoolId) {
		return { error: { status: 403, code: 'CROSS_SCHOOL_DENIED', message: 'Subject belongs to another school.' } };
	}

	const dependencies: DeleteDependencyRow[] = [];

	// 2. FacultySubject — direct FK (set-based)
	const facultySubjects = await prisma.facultySubject.findMany({
		where: { subjectId },
		select: {
			id: true,
			facultyId: true,
			sectionIds: true,
			updatedAt: true,
			faculty: {
				select: {
					isActiveForScheduling: true,
					isStale: true,
					schoolId: true,
				},
			},
		},
	});

	for (const fs of facultySubjects) {
		const isActive = fs.faculty.isActiveForScheduling && !fs.faculty.isStale && fs.sectionIds.length > 0;
		dependencies.push({
			type: 'FacultySubject',
			id: fs.id,
			classification: isActive ? 'ACTIVE' : 'HISTORICAL',
			description: `Faculty ${fs.facultyId} assignment (${isActive ? 'active' : 'historical'}, ${fs.sectionIds.length} sections)`,
			schoolId: fs.faculty.schoolId,
			state: {
				facultyId: fs.facultyId,
				sectionCount: fs.sectionIds.length,
				isActiveForScheduling: fs.faculty.isActiveForScheduling,
				isStale: fs.faculty.isStale,
			},
			version: fs.updatedAt.toISOString(),
			action: isActive ? 'BLOCKS_DELETION' : 'DELETE',
			subjectId,
		});
	}

	// 3. SubjectSectionOwnership — direct FK (set-based)
	const ownerships = await prisma.subjectSectionOwnership.findMany({
		where: { subjectId },
		select: {
			id: true,
			sectionId: true,
			schoolYearId: true,
			schoolId: true,
			updatedAt: true,
		},
	});

	for (const own of ownerships) {
		dependencies.push({
			type: 'SubjectSectionOwnership',
			id: own.id,
			classification: 'ACTIVE',
			description: `Section ${own.sectionId} ownership (year ${own.schoolYearId})`,
			schoolId: own.schoolId,
			state: {
				sectionId: own.sectionId,
				schoolYearId: own.schoolYearId,
			},
			version: own.updatedAt.toISOString(),
			action: 'BLOCKS_DELETION',
			subjectId,
		});
	}

	// 4. ClassTemplateSubject — direct FK (set-based)
	const templateBindings = await prisma.classTemplateSubject.findMany({
		where: { subjectId },
		select: {
			id: true,
			templateId: true,
			createdAt: true,
		},
	});

	for (const tb of templateBindings) {
		dependencies.push({
			type: 'ClassTemplateSubject',
			id: tb.id,
			classification: 'BLOCKING',
			description: `Template ${tb.templateId} binding`,
			state: { templateId: tb.templateId },
			version: tb.createdAt.toISOString(),
			action: 'BLOCKS_DELETION',
			subjectId,
		});
	}

	// 5. GenerationRun references — use set-based JSON query
	// Find all runs that reference this subject in one query
	// Use safe JSONB construction with bound parameters
	const subjectIdJson = JSON.stringify([{ subjectId }]);
	const runsWithRefs = await prisma.$queryRaw<Array<{
		id: number;
		status: string;
		updatedAt: Date;
		isPublished: boolean;
	}>>`
		SELECT
			gr.id,
			gr.status,
			gr."updatedAt" as "updatedAt",
			COALESCE((gr.summary->>'isPublished')::boolean, false) as "isPublished"
		FROM generation_runs gr
		WHERE gr.school_id = ${actorSchoolId}
		AND (
			gr.draft_entries @> ${subjectIdJson}::jsonb
			OR gr.unassigned_items @> ${subjectIdJson}::jsonb
		)
	`;

	for (const run of runsWithRefs) {
		const isPublished = run.isPublished === true;
		dependencies.push({
			type: 'GenerationRun',
			id: run.id,
			classification: isPublished ? 'IMMUTABLE' : 'HISTORICAL',
			description: `Generation run ${run.id} (${run.status}) references this subject`,
			state: { status: run.status, isPublished },
			version: run.updatedAt.toISOString(),
			// All generation runs that reference the subject block deletion
			// Historical runs preserve evidence; published runs are immutable
			action: 'BLOCKS_DELETION',
			subjectId,
		});
	}

	// 6. Published schedule references — only runs that reference the subject
	// This is already covered by the query above (isPublished = true)

	// 7. Compute summary
	const activeCount = dependencies.filter((d) => d.classification === 'ACTIVE').length;
	const historicalCount = dependencies.filter((d) => d.classification === 'HISTORICAL').length;
	const blockingCount = dependencies.filter((d) => d.classification === 'BLOCKING').length;
	const immutableCount = dependencies.filter((d) => d.classification === 'IMMUTABLE').length;

	const blockingReasons: string[] = [];
	if (activeCount > 0) blockingReasons.push(`${activeCount} active faculty assignment(s)`);
	if (blockingCount > 0) blockingReasons.push(`${blockingCount} template binding(s)`);
	if (immutableCount > 0) blockingReasons.push(`${immutableCount} published/immutable reference(s)`);
	if (historicalCount > 0) blockingReasons.push(`${historicalCount} historical generation reference(s)`);

	// deletable is derived from ALL blocking classifications
	const deletable = dependencies.every((d) => d.action === 'DELETE' || d.action === 'KEEP');

	return {
		subjectId: subject.id,
		subjectCode: subject.code,
		subjectName: subject.name,
		actorSchoolId,
		subjectVersion: subject.updatedAt.toISOString(),
		subjectIsActive: subject.isActive,
		dependencies,
		summary: {
			activeCount,
			historicalCount,
			blockingCount,
			immutableCount,
			deletable,
			blockingReasons,
		},
	};
}
