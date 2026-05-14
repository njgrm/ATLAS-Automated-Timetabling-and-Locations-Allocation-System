/**
 * HG Advisory Service
 *
 * Manages the physical database persistence of Homeroom Guidance (HG)
 * SubjectSectionOwnership records for class advisers.
 *
 * Architectural invariant: every active class adviser with a known
 * advisedSectionId MUST have a corresponding FacultySubject + SubjectSectionOwnership
 * row for the HG subject pointing to their advisory section. These rows are
 * immutable — setAssignments cannot delete them.
 */

import { prisma } from '../lib/prisma.js';

export const HG_SUBJECT_CODE = 'HG';
export const SYSTEM_ASSIGNED_BY = 0; // sentinel: 0 = system-generated

export interface HgSyncSummary {
	upserted: number;
	skipped: number;
	removed: number;
}

/**
 * After each faculty sync, call this to ensure every active class adviser has
 * a physical HG ownership record for their advisory section.
 *
 * Idempotent: safe to call multiple times. Existing correct records are not touched.
 */
export async function syncAdvisoryHgAssignments(schoolId: number): Promise<HgSyncSummary> {
	// Find HG subject for this school
	const hgSubject = await prisma.subject.findFirst({
		where: { schoolId, code: HG_SUBJECT_CODE },
		select: { id: true },
	});
	if (!hgSubject) {
		return { upserted: 0, skipped: 0, removed: 0 };
	}
	const hgSubjectId = hgSubject.id;

	// Find all active class advisers with a known advisory section
	const advisers = await prisma.facultyMirror.findMany({
		where: {
			schoolId,
			isStale: false,
			isClassAdviser: true,
			advisedSectionId: { not: null },
		},
		select: {
			id: true,
			advisedSectionId: true,
		},
	});

	let upserted = 0;
	let skipped = 0;
	let removed = 0;

	for (const adviser of advisers) {
		const advisedSectionId = adviser.advisedSectionId as number;

		await prisma.$transaction(async (tx) => {
			// Upsert FacultySubject for HG
			const existingFs = await tx.facultySubject.findUnique({
				where: {
					facultyId_subjectId: {
						facultyId: adviser.id,
						subjectId: hgSubjectId,
					},
				},
				select: { id: true, sectionIds: true },
			});

			let facultySubjectId: number;

			if (existingFs) {
				// Ensure the advised section is always in sectionIds
				const sectionSet = new Set(existingFs.sectionIds);
				if (sectionSet.has(advisedSectionId)) {
					// Already correct — nothing to do for FacultySubject
					facultySubjectId = existingFs.id;
					skipped += 1;
				} else {
					// Add the advised section
					const updatedSectionIds = [...existingFs.sectionIds, advisedSectionId];
					await tx.facultySubject.update({
						where: { id: existingFs.id },
						data: { sectionIds: updatedSectionIds },
					});
					facultySubjectId = existingFs.id;
					upserted += 1;
				}
			} else {
				// Create new FacultySubject
				const created = await tx.facultySubject.create({
					data: {
						facultyId: adviser.id,
						subjectId: hgSubjectId,
						schoolId,
						gradeLevels: [],
						sectionIds: [advisedSectionId],
						assignedBy: SYSTEM_ASSIGNED_BY,
					},
					select: { id: true },
				});
				facultySubjectId = created.id;
				upserted += 1;
			}

			// Upsert SubjectSectionOwnership (unique on schoolId+subjectId+sectionId)
			await tx.subjectSectionOwnership.upsert({
				where: {
					schoolId_subjectId_sectionId: {
						schoolId,
						subjectId: hgSubjectId,
						sectionId: advisedSectionId,
					},
				},
				update: {
					facultySubjectId,
					facultyId: adviser.id,
					assignedAt: new Date(),
				},
				create: {
					schoolId,
					facultySubjectId,
					facultyId: adviser.id,
					subjectId: hgSubjectId,
					sectionId: advisedSectionId,
					assignedAt: new Date(),
				},
			});
		});
	}

	// Remove stale HG ownership records for faculty who are no longer class advisers
	// or whose advisedSectionId has changed. Only remove rows created by the system
	// (assignedBy === 0) that no longer match an active adviser+section pair.
	const activeAdvisedPairs = new Set(
		advisers.map((a) => `${a.id}:${a.advisedSectionId}`),
	);

	const systemHgAssignments = await prisma.facultySubject.findMany({
		where: {
			subjectId: hgSubjectId,
			schoolId,
			assignedBy: SYSTEM_ASSIGNED_BY,
		},
		select: { id: true, facultyId: true, sectionIds: true },
	});

	for (const fs of systemHgAssignments) {
		const sectionsToRemove = fs.sectionIds.filter(
			(sid) => !activeAdvisedPairs.has(`${fs.facultyId}:${sid}`),
		);
		if (sectionsToRemove.length === 0) continue;

		const remainingSections = fs.sectionIds.filter(
			(sid) => !sectionsToRemove.includes(sid),
		);

		await prisma.$transaction(async (tx) => {
			if (remainingSections.length === 0) {
				// Remove entire FacultySubject (ownership cascades)
				await tx.facultySubject.delete({ where: { id: fs.id } });
			} else {
				// Remove only the stale sectionIds
				await tx.facultySubject.update({
					where: { id: fs.id },
					data: { sectionIds: remainingSections },
				});
				await tx.subjectSectionOwnership.deleteMany({
					where: {
						facultySubjectId: fs.id,
						sectionId: { in: sectionsToRemove },
					},
				});
			}
			removed += sectionsToRemove.length;
		});
	}

	return { upserted, skipped, removed };
}
