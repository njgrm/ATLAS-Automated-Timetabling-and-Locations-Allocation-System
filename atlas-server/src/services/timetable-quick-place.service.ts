import { prisma } from '../lib/prisma.js';
import { loadRunContext, isPublishedSummary, commitManualEditBatch, type ManualEditProposal } from './manual-edit.service.js';
import { validateHardConstraints } from './constraint-validator.js';
import { buildValidatorCtx } from './manual-edit.service.js';
import { computeSummary } from './manual-edit.service.js';
import { mergePreservedSummaryFields } from './manual-edit.service.js';
import type { ScheduledEntry, Violation } from './constraint-validator.js';
import type { UnassignedItem } from './schedule-constructor.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getSectionSummary } from './section.service.js';
import {
	buildHomeRoomStats,
	buildHomeRoomFallbackDiagnostics,
	buildQualifiedCoverageBySubject,
	buildSlotSaturation,
	buildUnassignedBySubjectGrade,
} from './generation.service.js';
import { computeGenerationInputSnapshot } from './generation-input-snapshot.service.js';

interface ServiceError extends Error {
	statusCode: number;
	code: string;
}

function err(statusCode: number, code: string, message: string): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

function minutesBetween(start: string, end: string): number {
	return timeToMinutes(end) - timeToMinutes(start);
}

export type PlacedSessionResult = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	session: number;
	day: string;
	startTime: string;
	endTime: string;
	roomId: number;
	roomName: string;
	facultyId: number;
	facultyName: string;
};

export type UnplacedSessionResult = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	session: number;
	reason: string;
};

export async function solveQuickPlace(
	runId: number,
	schoolId: number,
	schoolYearId: number,
) {
	// 1. Load active run context
	const refData = await loadRunContext(runId, schoolId, schoolYearId);
	const { run } = refData;

	const oldEntries = (run.draftEntries ?? []) as unknown as ScheduledEntry[];
	const unassignedItems = (run.unassignedItems ?? []) as unknown as UnassignedItem[];

	if (unassignedItems.length === 0) {
		return {
			placed: [],
			unplaced: [],
			newEntries: oldEntries,
			newUnassigned: [],
			violations: (run.violations ?? []) as unknown as Violation[],
		};
	}

	// 2. Load live teaching load ownerships to find teacher assignments
	const ownerships = await prisma.subjectSectionOwnership.findMany({
		where: { schoolId, schoolYearId },
	});

	const ownershipMap = new Map<string, number>();
	for (const o of ownerships) {
		ownershipMap.set(`${o.subjectId}:${o.sectionId}`, o.facultyId);
	}

	// Load sections to get section names
	const sections = await prisma.sectionSnapshot.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		select: { payload: true },
	});
	const snapshotPayload = Array.isArray(sections?.payload)
		? sections.payload as any[]
		: [];
	const sectionMap = new Map<number, any>();
	for (const grade of snapshotPayload) {
		for (const section of grade.sections) {
			sectionMap.set(section.id, section);
		}
	}

	// 3. Resolve active display time slots for this run
	const timeSlots = ((run.summary as any)?.timetableDisplaySlots || []) as Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	const activeTimeSlots = timeSlots.filter(s => !s.isSpecialEvent);

	if (activeTimeSlots.length === 0) {
		// Fallback: derive unique slots from existing entries
		const uniqueSlots = new Set<string>();
		for (const e of oldEntries) {
			const key = `${e.startTime}-${e.endTime}`;
			if (!uniqueSlots.has(key)) {
				uniqueSlots.add(key);
				activeTimeSlots.push({ startTime: e.startTime, endTime: e.endTime });
			}
		}
	}

	// Sort active slots chronologically
	activeTimeSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

	// 4. Run Greedy Auto-Placement Solver
	const currentEntries = oldEntries.map(e => ({ ...e }));
	const placed: PlacedSessionResult[] = [];
	const unplaced: UnplacedSessionResult[] = [];
	const remainingUnassigned: UnassignedItem[] = [];

	let entryCounter = oldEntries.reduce((max, e) => {
		const m = e.entryId.match(/^entry-qp-(\d+)$/);
		return m ? Math.max(max, Number(m[1])) : max;
	}, 0);

	for (const item of unassignedItems) {
		const key = `${item.subjectId}:${item.sectionId}`;
		const facultyId = item.facultyId ?? ownershipMap.get(key) ?? null;

		const subCode = refData.subjectNameMap.get(item.subjectId) ?? `SUBJ#${item.subjectId}`;
		const subName = refData.subjectNameDetailMap.get(item.subjectId) ?? `Subject #${item.subjectId}`;
		const secName = sectionMap.get(item.sectionId)?.name ?? `Section #${item.sectionId}`;

		if (!facultyId) {
			unplaced.push({
				subjectId: item.subjectId,
				subjectCode: subCode,
				subjectName: String(subName),
				sectionId: item.sectionId,
				sectionName: secName,
				session: item.session,
				reason: 'No teacher assigned in Teaching Load.',
			});
			remainingUnassigned.push(item);
			continue;
		}

		const facultyName = refData.facultyNameMap.get(facultyId) ?? `Teacher #${facultyId}`;
		const subjectDetails = refData.subjects.find(s => s.id === item.subjectId);
		const preferredRoomType = subjectDetails?.preferredRoomType || 'CLASSROOM';
		const homeRoomId = item.homeRoomId || null;

		// Prioritize rooms: Section Home Room first (if type matches), then preferred type rooms, then all other rooms.
		const candidateRooms = [...refData.rooms].sort((a, b) => {
			const aHome = a.id === homeRoomId;
			const bHome = b.id === homeRoomId;
			if (aHome !== bHome) return aHome ? -1 : 1;

			const aType = a.type === preferredRoomType;
			const bType = b.type === preferredRoomType;
			if (aType !== bType) return aType ? -1 : 1;

			return a.id - b.id;
		});

		let bestSlot: {
			day: string;
			startTime: string;
			endTime: string;
			roomId: number;
			roomName: string;
			score: number;
			roomAssignmentReason: string;
		} | null = null;

		// Search conflict-free slots
		for (const day of DAYS) {
			for (const slot of activeTimeSlots) {
				// Fast pre-check: Is section busy?
				const isSectionBusy = currentEntries.some(
					e => e.sectionId === item.sectionId && e.day === day && e.startTime === slot.startTime
				);
				if (isSectionBusy) continue;

				// Fast pre-check: Is teacher busy?
				const isTeacherBusy = currentEntries.some(
					e => e.facultyId === facultyId && e.day === day && e.startTime === slot.startTime
				);
				if (isTeacherBusy) continue;

				// Find first free room in our prioritized list
				for (const room of candidateRooms) {
					const isRoomBusy = currentEntries.some(
						e => e.roomId === room.id && e.day === day && e.startTime === slot.startTime
					);
					if (isRoomBusy) continue;

					// Construct temporary placement
					const tempEntry: ScheduledEntry = {
						entryId: `temp-qp-check`,
						facultyId,
						roomId: room.id,
						subjectId: item.subjectId,
						sectionId: item.sectionId,
						day,
						startTime: slot.startTime,
						endTime: slot.endTime,
						durationMinutes: minutesBetween(slot.startTime, slot.endTime),
						entryKind: item.entryKind || 'SECTION',
						programType: item.programType,
						programCode: item.programCode,
						programName: item.programName,
						cohortCode: item.cohortCode,
						cohortName: item.cohortName,
						cohortMemberSectionIds: item.cohortMemberSectionIds,
						cohortExpectedEnrollment: item.cohortExpectedEnrollment,
						adviserId: item.adviserId,
						adviserName: item.adviserName,
						metadata: {
							deferredRoomTypePreference: room.type !== preferredRoomType,
						},
					};

					// Full validation check
					const testEntries = [...currentEntries, tempEntry];
					const validatorCtx = buildValidatorCtx(schoolId, schoolYearId, runId, testEntries, refData);
					const validation = validateHardConstraints(validatorCtx);
					const hardViolations = validation.violations.filter(v => v.severity === 'HARD');

					if (hardViolations.length === 0) {
						// Valid! Score it.
						const softCount = validation.violations.filter(v => v.severity === 'SOFT').length;
						let score = 100 - softCount;
						if (room.id === homeRoomId) {
							score += 20; // Prefer homerooms
						}

						let roomAssignmentReason = 'FALLBACK_ROOM_ASSIGNED';
						if (room.id === homeRoomId) {
							roomAssignmentReason = 'HOME_ROOM_ASSIGNED';
						} else if (room.type === preferredRoomType) {
							roomAssignmentReason = 'PREFERRED_ROOM_TYPE_ASSIGNED';
						}

						if (!bestSlot || score > bestSlot.score) {
							const rName = refData.roomNameMap.get(room.id) ?? `Room #${room.id}`;
							bestSlot = {
								day,
								startTime: slot.startTime,
								endTime: slot.endTime,
								roomId: room.id,
								roomName: rName,
								score,
								roomAssignmentReason,
							};
						}
					}
				}
			}
		}

		if (bestSlot) {
			entryCounter++;
			const newEntry: ScheduledEntry = {
				entryId: `entry-qp-${entryCounter}`,
				facultyId,
				roomId: bestSlot.roomId,
				subjectId: item.subjectId,
				sectionId: item.sectionId,
				day: bestSlot.day,
				startTime: bestSlot.startTime,
				endTime: bestSlot.endTime,
				durationMinutes: minutesBetween(bestSlot.startTime, bestSlot.endTime),
				entryKind: item.entryKind || 'SECTION',
				programType: item.programType,
				programCode: item.programCode,
				programName: item.programName,
				cohortCode: item.cohortCode,
				cohortName: item.cohortName,
				cohortMemberSectionIds: item.cohortMemberSectionIds,
				cohortExpectedEnrollment: item.cohortExpectedEnrollment,
				adviserId: item.adviserId,
				adviserName: item.adviserName,
				metadata: {
					roomAssignmentReason: bestSlot.roomAssignmentReason,
					deferredRoomTypePreference: bestSlot.roomAssignmentReason === 'FALLBACK_ROOM_ASSIGNED',
				},
			};

			currentEntries.push(newEntry);
			placed.push({
				subjectId: item.subjectId,
				subjectCode: subCode,
				subjectName: String(subName),
				sectionId: item.sectionId,
				sectionName: secName,
				session: item.session,
				day: bestSlot.day,
				startTime: bestSlot.startTime,
				endTime: bestSlot.endTime,
				roomId: bestSlot.roomId,
				roomName: bestSlot.roomName,
				facultyId,
				facultyName,
			});
		} else {
			unplaced.push({
				subjectId: item.subjectId,
				subjectCode: subCode,
				subjectName: String(subName),
				sectionId: item.sectionId,
				sectionName: secName,
				session: item.session,
				reason: 'No available conflict-free slot found.',
			});
			remainingUnassigned.push(item);
		}
	}

	// 5. Recompute final constraint validation for preview
	const finalValidatorCtx = buildValidatorCtx(schoolId, schoolYearId, runId, currentEntries, refData);
	const finalValidation = validateHardConstraints(finalValidatorCtx);

	return {
		placed,
		unplaced,
		newEntries: currentEntries,
		newUnassigned: remainingUnassigned,
		violations: finalValidation.violations,
	};
}

export async function applyQuickPlace(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	expectedVersion: number,
) {
	// 1. Early validation checks before expensive solver execution
	const run = await prisma.generationRun.findUnique({
		where: { id: runId },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found.');
	if (isPublishedSummary(run.summary)) {
		throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published.');
	}
	if (run.version !== expectedVersion) {
		throw err(409, 'VERSION_CONFLICT', 'Timetable was modified by another user. Reload and try again.');
	}

	// 2. Solve Quick Place
	const solution = await solveQuickPlace(runId, schoolId, schoolYearId);

	// If no placements could be made, we don't need to commit anything
	if (solution.placed.length === 0) {
		return {
			success: true,
			placedCount: 0,
			version: run.version,
			draft: {
				runId: run.id,
				status: run.status,
				entries: (run.draftEntries ?? []) as any,
				unassignedItems: (run.unassignedItems ?? []) as any,
				summary: run.summary as any,
				version: run.version,
				finishedAt: run.finishedAt?.toISOString() ?? null,
				createdAt: run.createdAt.toISOString(),
			},
		};
	}

	// 3. Map placements to ManualEditProposals, carrying solver-computed metadata
	const proposals: ManualEditProposal[] = solution.placed.map((p) => {
		const matchedEntry = solution.newEntries.find(
			(e) =>
				e.sectionId === p.sectionId &&
				e.subjectId === p.subjectId &&
				e.day === p.day &&
				e.startTime === p.startTime &&
				e.roomId === p.roomId
		);
		return {
			editType: 'PLACE_UNASSIGNED',
			sectionId: p.sectionId,
			subjectId: p.subjectId,
			session: p.session,
			targetDay: p.day,
			targetStartTime: p.startTime,
			targetEndTime: p.endTime,
			targetRoomId: p.roomId,
			targetFacultyId: p.facultyId,
			metadata: matchedEntry?.metadata ? { ...matchedEntry.metadata } : undefined,
		};
	});

	// 4. Recalculate diagnostics using solver's solution.newEntries & solution.newUnassigned
	const finalEntries = solution.newEntries;
	const finalUnassigned = solution.newUnassigned;

	const sectionSummary = await getSectionSummary(schoolYearId, schoolId);
	const sectionsByGrade = sectionSummary.gradeLevels;
	const activeSubjects = await prisma.subject.findMany({
		where: { schoolId, isActive: true },
		select: { id: true, code: true, name: true, ownerDepartment: true },
	});
	const activeSubjectCodeById = new Map(activeSubjects.map((s) => [s.id, s.code]));

	const homeRoomStats = buildHomeRoomStats(finalEntries, finalUnassigned);
	const homeRoomFallbackDiagnostics = buildHomeRoomFallbackDiagnostics(finalEntries, finalUnassigned);

	const facultySubjectRows = await prisma.facultySubject.findMany({
		where: { schoolId, schoolYearId },
		select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
	});
	const refData = await loadRunContext(runId, schoolId, schoolYearId);
	const activeFacultyIdSet = new Set(refData.faculty.map((member) => member.id));
	const rosterIndex = buildSectionRosterIndex(sectionsByGrade);
	const normalizedFacultySubjects = facultySubjectRows
		.filter((assignment) => activeFacultyIdSet.has(assignment.facultyId))
		.map((assignment) => {
			const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
			return {
				facultyId: assignment.facultyId,
				subjectId: assignment.subjectId,
				gradeLevels: normalized.gradeLevels,
				sectionIds: normalized.sectionIds,
			};
		});

	const { getTemplatePeriodProfiles } = await import('./class-template.service.js');
	const templateProfiles = await getTemplatePeriodProfiles(schoolId);
	const classTemplatePeriods: Record<string, number> = {};
	for (const profile of templateProfiles) {
		classTemplatePeriods[profile.programType.toUpperCase()] = profile.periodsPerDay;
	}
	const cohorts = await prisma.instructionalCohort.findMany({
		where: { schoolId, schoolYearId, isActive: true },
	});
	const { computeDemand } = await import('./schedule-constructor.js');
	const demand = computeDemand(sectionsByGrade, activeSubjects as any, cohorts as any, classTemplatePeriods);

	const qualifiedFacultyCoverageBySubject = buildQualifiedCoverageBySubject(demand, normalizedFacultySubjects);
	const slotSaturationByInterval = buildSlotSaturation(finalEntries, refData.rooms.length);
	const unassignedBySubjectGrade = buildUnassignedBySubjectGrade(finalUnassigned, activeSubjectCodeById);

	const nextInputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);

	// Construct summary overrides to be saved inside the commit transaction
	const summaryOverrides = {
		homeRoomAttemptedCount: homeRoomStats.attempted,
		homeRoomAssignedCount: homeRoomStats.assigned,
		homeRoomSuccessRate: homeRoomStats.successRate,
		resourceDiagnostics: {
			qualifiedFacultyCoverageBySubject,
			slotSaturationByInterval,
			unassignedBySubjectGrade,
			homeRoomFallbackDiagnostics,
		},
		inputSnapshot: nextInputSnapshot,
	};

	// 5. Commit using commitManualEditBatch (reusing manual-edit checks, audit log, manual edits history)
	const commitRes = await commitManualEditBatch(
		runId,
		schoolId,
		schoolYearId,
		actorId,
		proposals,
		expectedVersion,
		true, // allowSoftOverride
		summaryOverrides
	);

	const finalReport = {
		runId: run.id,
		status: run.status,
		entries: commitRes.draft.entries as ScheduledEntry[],
		unassignedItems: commitRes.draft.unassignedItems as unknown as UnassignedItem[],
		summary: commitRes.draft.summary as any,
		version: commitRes.newVersion,
		finishedAt: run.finishedAt?.toISOString() ?? null,
		createdAt: run.createdAt.toISOString(),
	};

	return {
		success: true,
		placedCount: solution.placed.length,
		version: commitRes.newVersion,
		draft: finalReport,
	};
}
