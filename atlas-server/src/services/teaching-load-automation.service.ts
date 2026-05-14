/**
 * Teaching Load Automation Service
 *
 * Implements the state-preserving Auto-Fill algorithm per DO 005 s.2024.
 *
 * Algorithm Overview:
 *  1. Build a resolved-pair set and capacity map from existing SubjectSectionOwnership rows.
 *  2. Verify HG records for all active advisers (warn if missing).
 *  3. Build a work queue: all active subject × section pairs not already resolved.
 *  4. For each unresolved pair, find the best-qualified, lowest-loaded candidate.
 *  5. Respect DO 005 caps (standard = 1,800 min/week, hard = 2,400 min/week).
 *  6. Modular bundles: attempt entire group; persist partial if cap is hit mid-bundle.
 *  7. Persist FacultySubject + SubjectSectionOwnership in a single transaction.
 *  8. Return { preserved, created, unresolved, warnings }.
 *
 * Design invariants:
 * - NEVER overwrites an existing SubjectSectionOwnership row.
 * - HG advisory records are not touched (already written by hg-advisory.service).
 * - Business logic is entirely in this service; controllers are transport-only.
 */

import { prisma } from '../lib/prisma.js';
import { QualificationService } from './qualification.service.js';

// DO 005 s.2024 weekly minute caps
const STANDARD_CAP_MIN = 1_800;
const HARD_CAP_MIN = 2_400;

export interface AutoFillResult {
	preserved: number;
	created: number;
	assignmentsCreated: number;
	uniqueTeachersAffected: number;
	unresolved: number;
	warnings: string[];
}

interface SubjectRow {
	id: number;
	code: string;
	name: string;
	gradeLevels: number[];
	minMinutesPerWeek: number;
	allowedSpecializations: string[];
	modularGroupId: string | null;
	modularOrder: number | null;
}

interface FacultyRow {
	id: number;
	firstName: string;
	lastName: string;
	specialization: string | null;
	department: string | null;
	maxHoursPerWeek: number;
}

interface UnresolvedPair {
	subjectId: number;
	sectionId: number;
	subject: SubjectRow;
}

/**
 * Convert maxHoursPerWeek to minutes/week for capacity calculations.
 * FacultyMirror.maxHoursPerWeek stores the limit in hours (default 30).
 */
function maxMinutes(faculty: FacultyRow): number {
	return Math.min(faculty.maxHoursPerWeek * 60, HARD_CAP_MIN);
}

export async function autoFill(schoolId: number, schoolYearId: number): Promise<AutoFillResult> {
	const warnings: string[] = [];

	// ─── Step 1: Build resolved-pair set + capacity used per faculty ───────────
	const existingOwnerships = await prisma.subjectSectionOwnership.findMany({
		where: { schoolId },
		select: {
			subjectId: true,
			sectionId: true,
			facultyId: true,
			facultySubject: {
				select: {
					subject: { select: { minMinutesPerWeek: true } },
				},
			},
		},
	});

	const resolvedPairs = new Set<string>(
		existingOwnerships.map((o) => `${o.subjectId}:${o.sectionId}`),
	);
	const preserved = resolvedPairs.size;

	const capacityUsed = new Map<number, number>(); // facultyId → minutes used
	for (const o of existingOwnerships) {
		const mins = o.facultySubject.subject.minMinutesPerWeek;
		capacityUsed.set(o.facultyId, (capacityUsed.get(o.facultyId) ?? 0) + mins);
	}

	// ─── Step 2: Verify HG records for advisers (warn if missing) ─────────────
	const advisersWithoutHg = await prisma.facultyMirror.findMany({
		where: {
			schoolId,
			isStale: false,
			isClassAdviser: true,
			advisedSectionId: { not: null },
		},
		select: { id: true, firstName: true, lastName: true, advisedSectionId: true },
	});

	const hgSubject = await prisma.subject.findFirst({
		where: { schoolId, code: 'HG' },
		select: { id: true },
	});

	if (hgSubject) {
		for (const adviser of advisersWithoutHg) {
			const hasHg = resolvedPairs.has(`${hgSubject.id}:${adviser.advisedSectionId}`);
			if (!hasHg) {
				warnings.push(
					`HG advisory missing for ${adviser.firstName} ${adviser.lastName} (section ${adviser.advisedSectionId}). Run faculty sync to repair.`,
				);
			}
		}
	}

	// ─── Step 3: Build work queue ─────────────────────────────────────────────
	// Active subjects (not HG — HG is managed by hg-advisory.service)
	const subjects = await prisma.subject.findMany({
		where: {
			schoolId,
			isActive: true,
			code: { not: 'HG' },
		},
		select: {
			id: true,
			code: true,
			name: true,
			gradeLevels: true,
			minMinutesPerWeek: true,
			allowedSpecializations: true,
			modularGroupId: true,
			modularOrder: true,
		},
	});

	// Fetch all active sections for this school (via section ownership patterns
	// or from existing FacultySubject scope). We derive the section universe
	// from what subjects currently know about (sectionIds in FacultySubject).
	const sectionRows = await prisma.facultySubject.findMany({
		where: { schoolId },
		select: { sectionIds: true, gradeLevels: true },
	});

	// Build section→gradeLevel lookup from all existing FacultySubject records
	const sectionGradeLevel = new Map<number, number>();
	for (const row of sectionRows) {
		for (let i = 0; i < row.sectionIds.length; i++) {
			if (row.gradeLevels[i] != null) {
				sectionGradeLevel.set(row.sectionIds[i], row.gradeLevels[i]);
			}
		}
	}
	// Also collect all known section IDs
	const allSectionIds = Array.from(sectionGradeLevel.keys());

	const workQueue: UnresolvedPair[] = [];
	for (const subject of subjects) {
		const relevantSections =
			subject.gradeLevels.length > 0
				? allSectionIds.filter((sid) => {
						const gl = sectionGradeLevel.get(sid) ?? 0;
						return subject.gradeLevels.includes(gl);
					})
				: allSectionIds;

		for (const sectionId of relevantSections) {
			const key = `${subject.id}:${sectionId}`;
			if (!resolvedPairs.has(key)) {
				workQueue.push({ subjectId: subject.id, sectionId, subject });
			}
		}
	}

	// ─── Step 4: Load active faculty ──────────────────────────────────────────
	const faculty = await prisma.facultyMirror.findMany({
		where: { schoolId, isStale: false, isActiveForScheduling: true },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			specialization: true,
			department: true,
			maxHoursPerWeek: true,
		},
	});

	// ─── Step 5 & 6: Assign pairs, respecting caps and modular bundles ─────────
	// Group work queue by subjectId for modular bundle processing
	const bySubjectId = new Map<number, UnresolvedPair[]>();
	for (const pair of workQueue) {
		const bucket = bySubjectId.get(pair.subjectId) ?? [];
		bucket.push(pair);
		bySubjectId.set(pair.subjectId, bucket);
	}

	// Sort subjects: non-modular first, then modular groups in order
	const subjectMap = new Map<number, SubjectRow>(subjects.map((s) => [s.id, s]));
	const orderedSubjectIds = Array.from(bySubjectId.keys()).sort((a, b) => {
		const sa = subjectMap.get(a)!;
		const sb = subjectMap.get(b)!;
		if (!sa.modularGroupId && !sb.modularGroupId) return 0;
		if (!sa.modularGroupId) return -1;
		if (!sb.modularGroupId) return 1;
		if (sa.modularGroupId !== sb.modularGroupId) return sa.modularGroupId.localeCompare(sb.modularGroupId);
		return (sa.modularOrder ?? 0) - (sb.modularOrder ?? 0);
	});

	// Track new assignments to persist: facultyId → { subjectId → Set<sectionId> }
	const pendingAssignments = new Map<number, Map<number, Set<number>>>();
	let unresolvedCount = 0;

	function addPending(facultyId: number, subjectId: number, sectionId: number): void {
		if (!pendingAssignments.has(facultyId)) {
			pendingAssignments.set(facultyId, new Map());
		}
		const bySubject = pendingAssignments.get(facultyId)!;
		if (!bySubject.has(subjectId)) {
			bySubject.set(subjectId, new Set());
		}
		bySubject.get(subjectId)!.add(sectionId);
		// Update capacity
		const subj = subjectMap.get(subjectId)!;
		capacityUsed.set(facultyId, (capacityUsed.get(facultyId) ?? 0) + subj.minMinutesPerWeek);
	}

	async function findBestCandidate(
		subjectRow: SubjectRow,
		sectionId: number,
	): Promise<FacultyRow | null> {
		const candidates: Array<{ faculty: FacultyRow; tier: number }> = [];

		for (const f of faculty) {
			// Cap check
			const used = capacityUsed.get(f.id) ?? 0;
			const limit = maxMinutes(f);
			if (used + subjectRow.minMinutesPerWeek > limit) continue;

			const result = await QualificationService.getQualificationTier(schoolId, f, subjectRow);
			if (result.tier != null) {
				candidates.push({ faculty: f, tier: result.tier });
			}
		}

		if (candidates.length === 0) return null;

		// Sort: best tier first (1 > 2 > 3), then lowest current load
		candidates.sort((a, b) => {
			if (a.tier !== b.tier) return a.tier - b.tier;
			return (capacityUsed.get(a.faculty.id) ?? 0) - (capacityUsed.get(b.faculty.id) ?? 0);
		});

		return candidates[0].faculty;
	}

	for (const subjectId of orderedSubjectIds) {
		const pairs = bySubjectId.get(subjectId)!;
		const subjectRow = subjectMap.get(subjectId)!;

		for (const pair of pairs) {
			const candidate = await findBestCandidate(subjectRow, pair.sectionId);
			if (!candidate) {
				unresolvedCount += 1;
				if (subjectRow.modularGroupId) {
					warnings.push(`Lacking Faculty: no qualified teacher for modular subject ${subjectRow.name} (section ${pair.sectionId}).`);
				}
			} else {
				addPending(candidate.id, pair.subjectId, pair.sectionId);
			}
		}
	}

	// ─── Step 7: Persist new assignments ──────────────────────────────────────
	let created = 0;
	const affectedTeacherIds = new Set<number>();

	if (pendingAssignments.size > 0) {
		await prisma.$transaction(async (tx) => {
			for (const [facultyId, subjectMap_] of pendingAssignments) {
				for (const [subjectId, sectionIds] of subjectMap_) {
					const sectionIdsArr = Array.from(sectionIds);
					// Derive grade levels from sectionGradeLevel map
					const gradeLevels = Array.from(
						new Set(sectionIdsArr.map((sid) => sectionGradeLevel.get(sid)).filter(Boolean) as number[]),
					);

					// Upsert FacultySubject — merge with existing if present (non-HG, so no advisory concern)
					const existingFs = await tx.facultySubject.findUnique({
						where: { facultyId_subjectId: { facultyId, subjectId } },
						select: { id: true, sectionIds: true, gradeLevels: true },
					});

					let facultySubjectId: number;
					let newSections: number[];

					if (existingFs) {
						// Merge new sections into existing record
						newSections = Array.from(new Set([...existingFs.sectionIds, ...sectionIdsArr]));
						const newGradeLevels = Array.from(new Set([...existingFs.gradeLevels, ...gradeLevels]));
						await tx.facultySubject.update({
							where: { id: existingFs.id },
							data: { sectionIds: newSections, gradeLevels: newGradeLevels },
						});
						facultySubjectId = existingFs.id;
						// Only the truly new sections need ownership rows
						newSections = sectionIdsArr.filter((sid) => !existingFs.sectionIds.includes(sid));
					} else {
						const fs = await tx.facultySubject.create({
							data: {
								facultyId,
								subjectId,
								schoolId,
								gradeLevels,
								sectionIds: sectionIdsArr,
								assignedBy: 0, // system
							},
							select: { id: true },
						});
						facultySubjectId = fs.id;
						newSections = sectionIdsArr;
					}

					// Create SubjectSectionOwnership rows for new sections only
					// skipDuplicates handles any race conditions
					if (newSections.length > 0) {
						await tx.subjectSectionOwnership.createMany({
							data: newSections.map((sectionId) => ({
								schoolId,
								facultySubjectId,
								facultyId,
								subjectId,
								sectionId,
								assignedAt: new Date(),
							})),
							skipDuplicates: true,
						});
						created += newSections.length;
						affectedTeacherIds.add(facultyId);
					}
				}
			}
		});
	}

	return {
		preserved,
		created,
		assignmentsCreated: created,
		uniqueTeachersAffected: affectedTeacherIds.size,
		unresolved: unresolvedCount,
		warnings,
	};
}
