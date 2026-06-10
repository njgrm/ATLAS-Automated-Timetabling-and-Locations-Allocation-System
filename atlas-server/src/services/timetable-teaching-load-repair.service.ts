import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
	buildHumanConflicts,
	buildPolicyImpacts,
	buildValidatorCtx,
	computeSummary,
	isPublishedSummary,
	loadRunContext,
	mergePreservedSummaryFields,
	type ManualEditBatchPreviewItem,
	type ManualEditBatchPreviewResult,
} from './manual-edit.service.js';
import { validateHardConstraints, type ScheduledEntry, type Violation } from './constraint-validator.js';
import type { DraftReport } from './generation.service.js';
import type { UnassignedItem } from './schedule-constructor.js';
import type { SectionsByGrade } from './section-adapter.js';
import { buildSectionRosterIndex, deriveGradeLevelsFromSectionIds } from './faculty-assignment-scope.service.js';
import { resolveAssignmentSpecializationIdentity } from './faculty-assignment.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

export type TeachingLoadRepairChange = {
	entryId: string;
	subjectId: number;
	sectionId: number;
	fromFacultyId: number | null;
	toFacultyId: number;
};

export type TeachingLoadRepairRequest = {
	changes: TeachingLoadRepairChange[];
	expectedRunVersion?: number;
	expectedFacultyVersions?: Record<string, number>;
	allowSoftOverride?: boolean;
};

export type TeachingLoadOwnershipDelta = {
	entryId: string;
	subjectId: number;
	sectionId: number;
	fromFacultyId: number | null;
	toFacultyId: number;
	currentOwnerId: number | null;
	timetableAction: 'NO_CHANGE' | 'CHANGE_FACULTY';
	ownershipAction: 'NO_CHANGE' | 'TRANSFER';
};

export type TeachingLoadAffectedTeacher = {
	facultyId: number;
	beforeTeachingHours: number;
	afterTeachingHours: number;
	version: number | null;
};

export type TeachingLoadRepairPreviewResult = ManualEditBatchPreviewResult & {
	ownershipDeltas: TeachingLoadOwnershipDelta[];
	affectedTeachers: TeachingLoadAffectedTeacher[];
};

export type TeachingLoadRepairApplyResult = {
	editId: number;
	editIds: number[];
	draft: DraftReport;
	violationDelta: ManualEditBatchPreviewResult['violationDelta'];
	warnings: Violation[];
	newVersion: number;
	ownershipDeltas: TeachingLoadOwnershipDelta[];
	affectedTeachers: TeachingLoadAffectedTeacher[];
};

type PreparedRepair = {
	refData: Awaited<ReturnType<typeof loadRunContext>>;
	changes: TeachingLoadRepairChange[];
	newEntries: ScheduledEntry[];
	ownershipDeltas: TeachingLoadOwnershipDelta[];
	affectedTeachers: TeachingLoadAffectedTeacher[];
	proposals: ManualEditBatchPreviewItem[];
	currentValidation: ReturnType<typeof validateHardConstraints>;
	newValidation: ReturnType<typeof validateHardConstraints>;
};

function err(statusCode: number, code: string, message: string, options?: { actionHint?: string; details?: Record<string, unknown> }): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	e.actionHint = options?.actionHint;
	e.details = options?.details;
	return e;
}

function positiveInt(value: unknown): number | null {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeChanges(raw: unknown): TeachingLoadRepairChange[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		throw err(400, 'EMPTY_REPAIR_BATCH', 'At least one Teaching Load repair is required.');
	}
	return raw.map((item, index) => {
		const candidate = item as Partial<TeachingLoadRepairChange>;
		const subjectId = positiveInt(candidate.subjectId);
		const sectionId = positiveInt(candidate.sectionId);
		const toFacultyId = positiveInt(candidate.toFacultyId);
		if (!candidate.entryId || typeof candidate.entryId !== 'string' || !subjectId || !sectionId || !toFacultyId) {
			throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} must include entryId, subjectId, sectionId, and toFacultyId.`);
		}
		const fromFacultyId = candidate.fromFacultyId == null ? null : positiveInt(candidate.fromFacultyId);
		if (candidate.fromFacultyId != null && !fromFacultyId) {
			throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} has an invalid fromFacultyId.`);
		}
		return {
			entryId: candidate.entryId,
			subjectId,
			sectionId,
			fromFacultyId,
			toFacultyId,
		};
	});
}

function teachingHoursByFaculty(entries: ScheduledEntry[], facultyIds: Set<number>): Map<number, number> {
	const minutesByFaculty = new Map<number, number>();
	for (const entry of entries) {
		if (entry.facultyId == null || !facultyIds.has(entry.facultyId)) continue;
		minutesByFaculty.set(entry.facultyId, (minutesByFaculty.get(entry.facultyId) ?? 0) + Math.max(0, entry.durationMinutes));
	}
	return new Map([...facultyIds].map((facultyId) => [facultyId, Math.round(((minutesByFaculty.get(facultyId) ?? 0) / 60) * 10) / 10]));
}

function projectFacultySubjects(
	facultySubjects: Array<{ facultyId: number; subjectId: number; gradeLevels: number[]; sectionIds: number[] }>,
	changes: TeachingLoadRepairChange[],
): Array<{ facultyId: number; subjectId: number; gradeLevels: number[]; sectionIds: number[] }> {
	const rows = new Map<string, { facultyId: number; subjectId: number; gradeLevels: number[]; sectionIds: Set<number> }>();
	for (const row of facultySubjects) {
		rows.set(`${row.facultyId}:${row.subjectId}`, {
			facultyId: row.facultyId,
			subjectId: row.subjectId,
			gradeLevels: [...row.gradeLevels],
			sectionIds: new Set(row.sectionIds),
		});
	}

	for (const change of changes) {
		for (const row of rows.values()) {
			if (row.subjectId === change.subjectId && row.facultyId !== change.toFacultyId) {
				row.sectionIds.delete(change.sectionId);
			}
		}
		const key = `${change.toFacultyId}:${change.subjectId}`;
		const target = rows.get(key) ?? {
			facultyId: change.toFacultyId,
			subjectId: change.subjectId,
			gradeLevels: [],
			sectionIds: new Set<number>(),
		};
		target.sectionIds.add(change.sectionId);
		rows.set(key, target);
	}

	return [...rows.values()]
		.filter((row) => row.sectionIds.size > 0)
		.map((row) => ({
			facultyId: row.facultyId,
			subjectId: row.subjectId,
			gradeLevels: row.gradeLevels,
			sectionIds: [...row.sectionIds].sort((left, right) => left - right),
		}));
}

function buildDraftReport(run: PreparedRepair['refData']['run'], entries: ScheduledEntry[], unassignedItems: UnassignedItem[], summary: DraftReport['summary'], version: number): DraftReport {
	return {
		runId: run.id,
		status: run.status,
		entries,
		unassignedItems,
		summary,
		version,
		finishedAt: run.finishedAt?.toISOString() ?? null,
		createdAt: run.createdAt.toISOString(),
	};
}

async function validateExpectedFacultyVersions(schoolId: number, facultyIds: number[], expectedFacultyVersions: Record<string, number> | undefined): Promise<Map<number, number>> {
	const uniqueFacultyIds = [...new Set(facultyIds)];
	const rows = uniqueFacultyIds.length === 0
		? []
		: await prisma.facultyMirror.findMany({
			where: { schoolId, id: { in: uniqueFacultyIds } },
			select: { id: true, version: true, isActiveForScheduling: true },
		});
	const byId = new Map(rows.map((row) => [row.id, row]));
	for (const facultyId of uniqueFacultyIds) {
		const row = byId.get(facultyId);
		if (!row) throw err(404, 'FACULTY_NOT_FOUND', `Faculty #${facultyId} was not found in this school.`);
		if (!row.isActiveForScheduling) throw err(409, 'FACULTY_INACTIVE', 'The selected teacher is no longer active for scheduling.');
		const expected = expectedFacultyVersions?.[String(facultyId)];
		if (typeof expected === 'number' && expected !== row.version) {
			throw err(409, 'FACULTY_VERSION_CONFLICT', 'Teaching Load changed while this panel was open. Reload the timetable and try again.');
		}
	}
	return new Map(rows.map((row) => [row.id, row.version]));
}

async function prepareRepair(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	request: TeachingLoadRepairRequest,
): Promise<PreparedRepair> {
	const changes = normalizeChanges(request.changes);
	let refData: Awaited<ReturnType<typeof loadRunContext>>;
	try {
		refData = await loadRunContext(runId, schoolId, schoolYearId);
	} catch (error) {
		const serviceError = error as Partial<ServiceError>;
		if (serviceError.code === 'RUN_ALREADY_PUBLISHED') {
			throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
		}
		throw error;
	}
	const { run, entries } = refData;

	if (typeof request.expectedRunVersion === 'number' && run.version !== request.expectedRunVersion) {
		throw err(409, 'VERSION_CONFLICT', 'This timetable changed while the Teaching Load panel was open. Reload and review the change again.');
	}

	const entryById = new Map(entries.map((entry) => [entry.entryId, entry]));
	const subjectIds = [...new Set(changes.map((change) => change.subjectId))];
	const facultyIds = changes.flatMap((change) => [change.fromFacultyId, change.toFacultyId]).filter((id): id is number => id != null);
	const [owners, subjects, facultyVersions] = await Promise.all([
		prisma.subjectSectionOwnership.findMany({
			where: {
				schoolId,
				OR: changes.map((change) => ({ subjectId: change.subjectId, sectionId: change.sectionId })),
			},
			select: { facultyId: true, subjectId: true, sectionId: true },
		}),
		prisma.subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true },
		}),
		validateExpectedFacultyVersions(schoolId, facultyIds, request.expectedFacultyVersions),
	]);
	const ownerByPair = new Map(owners.map((owner) => [`${owner.subjectId}:${owner.sectionId}`, owner.facultyId]));
	const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));

	const newEntries = entries.map((entry) => ({ ...entry }));
	const proposals: ManualEditBatchPreviewItem[] = [];
	const ownershipDeltas: TeachingLoadOwnershipDelta[] = [];
	const seenEntries = new Set<string>();
	const seenScopes = new Set<string>();
	const affectedFacultyIds = new Set<number>();

	for (const [index, change] of changes.entries()) {
		if (seenEntries.has(change.entryId)) throw err(400, 'DUPLICATE_REPAIR_ENTRY', `Entry ${change.entryId} appears more than once.`);
		seenEntries.add(change.entryId);
		const scopeKey = `${change.subjectId}:${change.sectionId}`;
		if (seenScopes.has(scopeKey)) throw err(400, 'DUPLICATE_REPAIR_SCOPE', `Subject ${change.subjectId} section ${change.sectionId} appears more than once.`);
		seenScopes.add(scopeKey);
		const entry = entryById.get(change.entryId);
		if (!entry) throw err(400, 'ENTRY_NOT_FOUND', `Entry ${change.entryId} was not found in this generation run.`);
		if (entry.subjectId !== change.subjectId || entry.sectionId !== change.sectionId) {
			throw err(409, 'ENTRY_CONTEXT_CHANGED', 'The selected class no longer matches the Teaching Load repair context. Reload and try again.');
		}
		if (change.fromFacultyId != null && entry.facultyId !== change.fromFacultyId) {
			throw err(409, 'ENTRY_TEACHER_CHANGED', 'The timetable teacher changed while this panel was open. Reload and try again.');
		}
		if ((subjectCodeById.get(change.subjectId) ?? '').toUpperCase() === HG_SUBJECT_CODE) {
			throw err(409, 'HG_ADVISORY_IMMUTABLE', 'Homeroom Guidance ownership follows adviser records and cannot be changed from the timetable.');
		}
		if (entry.entryKind === 'COHORT') {
			throw err(409, 'COHORT_REPAIR_UNSUPPORTED', 'Cohort classes need a section coverage repair before Teaching Load can be changed from the timetable.');
		}

		const currentOwnerId = ownerByPair.get(`${change.subjectId}:${change.sectionId}`) ?? null;
		const matchingEntryIndexes = newEntries
			.map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
			.filter(({ candidate }) => candidate.subjectId === change.subjectId && candidate.sectionId === change.sectionId)
			.map(({ candidateIndex }) => candidateIndex);
		if (matchingEntryIndexes.length === 0) {
			throw err(400, 'ENTRY_SCOPE_EMPTY', `No timetable entries were found for subject ${change.subjectId} section ${change.sectionId}.`);
		}
		let changedTimetableEntry = false;
		for (const entryIndex of matchingEntryIndexes) {
			const beforeEntry = newEntries[entryIndex];
			const afterEntry = beforeEntry.facultyId === change.toFacultyId ? beforeEntry : { ...beforeEntry, facultyId: change.toFacultyId };
			newEntries[entryIndex] = afterEntry;
			if (beforeEntry.facultyId !== change.toFacultyId) changedTimetableEntry = true;
			if (beforeEntry.facultyId != null) affectedFacultyIds.add(beforeEntry.facultyId);
			proposals.push({
				index: proposals.length,
				proposal: { editType: 'CHANGE_FACULTY', entryId: beforeEntry.entryId, targetFacultyId: change.toFacultyId },
				status: 'READY',
				entryId: beforeEntry.entryId,
				subjectId: change.subjectId,
				sectionId: change.sectionId,
				currentFacultyId: beforeEntry.facultyId,
				targetFacultyId: change.toFacultyId,
			});
		}
		affectedFacultyIds.add(change.toFacultyId);
		if (currentOwnerId != null) affectedFacultyIds.add(currentOwnerId);

		ownershipDeltas.push({
			entryId: change.entryId,
			subjectId: change.subjectId,
			sectionId: change.sectionId,
			fromFacultyId: change.fromFacultyId,
			toFacultyId: change.toFacultyId,
			currentOwnerId,
			timetableAction: changedTimetableEntry ? 'CHANGE_FACULTY' : 'NO_CHANGE',
			ownershipAction: currentOwnerId === change.toFacultyId ? 'NO_CHANGE' : 'TRANSFER',
		});
	}

	const currentValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData));
	const projectedRefData = {
		...refData,
		facultySubjects: projectFacultySubjects(refData.facultySubjects, changes),
	};
	const newValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, projectedRefData));
	const beforeHours = teachingHoursByFaculty(entries, affectedFacultyIds);
	const afterHours = teachingHoursByFaculty(newEntries, affectedFacultyIds);
	const affectedTeachers = [...affectedFacultyIds].sort((left, right) => left - right).map((facultyId) => ({
		facultyId,
		beforeTeachingHours: beforeHours.get(facultyId) ?? 0,
		afterTeachingHours: afterHours.get(facultyId) ?? 0,
		version: facultyVersions.get(facultyId) ?? null,
	}));

	return {
		refData,
		changes,
		newEntries,
		ownershipDeltas,
		affectedTeachers,
		proposals,
		currentValidation,
		newValidation,
	};
}

function buildPreview(prepared: PreparedRepair): TeachingLoadRepairPreviewResult {
	const { currentValidation, newValidation, newEntries, refData, proposals, ownershipDeltas, affectedTeachers } = prepared;
	const hardBefore = currentValidation.violations.filter((violation) => violation.severity === 'HARD').length;
	const hardViolations = newValidation.violations.filter((violation) => violation.severity === 'HARD');
	const softBefore = currentValidation.violations.filter((violation) => violation.severity === 'SOFT').length;
	const softViolations = newValidation.violations.filter((violation) => violation.severity === 'SOFT');
	const allViolations = [...hardViolations, ...softViolations];

	return {
		allowed: hardViolations.length === 0,
		hardViolations,
		softViolations,
		violationDelta: {
			hardBefore,
			hardAfter: hardViolations.length,
			softBefore,
			softAfter: softViolations.length,
		},
		humanConflicts: buildHumanConflicts(allViolations, newEntries, refData),
		affectedEntries: [...new Set(proposals.map((proposal) => proposal.entryId).filter((entryId): entryId is string => typeof entryId === 'string'))].flatMap((entryId) => {
			const before = prepared.refData.entries.find((entry) => entry.entryId === entryId);
			const after = prepared.newEntries.find((entry) => entry.entryId === entryId);
			return [before ? { ...before, phase: 'before' as const } : null, after ? { ...after, phase: 'after' as const } : null].filter((entry): entry is NonNullable<typeof entry> => entry != null);
		}),
		policyImpactSummary: buildPolicyImpacts(allViolations, refData),
		proposalCount: proposals.length,
		errorCount: 0,
		proposals,
		ownershipDeltas,
		affectedTeachers,
	};
}

async function loadSectionGradeMap(tx: Prisma.TransactionClient, schoolId: number, schoolYearId: number): Promise<Map<number, number>> {
	const snapshot = await tx.sectionSnapshot.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		select: { payload: true },
	});
	const payload = Array.isArray(snapshot?.payload) ? snapshot.payload as unknown as SectionsByGrade[] : [];
	const rosterIndex = buildSectionRosterIndex(payload);
	return new Map([...rosterIndex.sectionMap.entries()].map(([sectionId, section]) => [sectionId, section.displayOrder]));
}

async function syncFacultySubjectScopes(
	tx: Prisma.TransactionClient,
	schoolId: number,
	facultySubjectKeys: Array<{ facultyId: number; subjectId: number }>,
	sectionGradeMap: Map<number, number>,
): Promise<void> {
	for (const key of facultySubjectKeys) {
		const facultySubject = await tx.facultySubject.findUnique({
			where: { facultyId_subjectId: { facultyId: key.facultyId, subjectId: key.subjectId } },
			select: { id: true },
		});
		if (!facultySubject) continue;
		const rows = await tx.subjectSectionOwnership.findMany({
			where: { schoolId, facultyId: key.facultyId, subjectId: key.subjectId },
			select: { sectionId: true },
		});
		const sectionIds = [...new Set(rows.map((row) => row.sectionId))].sort((left, right) => left - right);
		if (sectionIds.length === 0) {
			await tx.facultySubject.delete({ where: { id: facultySubject.id } });
			continue;
		}
		await tx.facultySubject.update({
			where: { id: facultySubject.id },
			data: {
				sectionIds,
				gradeLevels: deriveGradeLevelsFromSectionIds(sectionIds, sectionGradeMap),
			},
		});
	}
}

async function applyCanonicalOwnership(
	tx: Prisma.TransactionClient,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	changes: TeachingLoadRepairChange[],
): Promise<void> {
	const sectionGradeMap = await loadSectionGradeMap(tx, schoolId, schoolYearId);
	const touchedKeys = new Map<string, { facultyId: number; subjectId: number }>();
	const subjectIds = [...new Set(changes.map((change) => change.subjectId))];
	const facultyIds = [...new Set(changes.map((change) => change.toFacultyId))];
	const [subjects, faculty] = await Promise.all([
		tx.subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true, allowedSpecializations: true },
		}),
		tx.facultyMirror.findMany({
			where: { schoolId, id: { in: facultyIds } },
			select: { id: true, specialization: true },
		}),
	]);
	const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
	const facultyById = new Map(faculty.map((row) => [row.id, row]));

	for (const change of changes) {
		const existingOwner = await tx.subjectSectionOwnership.findUnique({
			where: {
				schoolId_subjectId_sectionId: {
					schoolId,
					subjectId: change.subjectId,
					sectionId: change.sectionId,
				},
			},
			select: { facultyId: true },
		});
		if (existingOwner) {
			touchedKeys.set(`${existingOwner.facultyId}:${change.subjectId}`, { facultyId: existingOwner.facultyId, subjectId: change.subjectId });
		}

		let facultySubject = await tx.facultySubject.findUnique({
			where: { facultyId_subjectId: { facultyId: change.toFacultyId, subjectId: change.subjectId } },
			select: { id: true },
		});
		if (!facultySubject) {
			facultySubject = await tx.facultySubject.create({
				data: {
					facultyId: change.toFacultyId,
					subjectId: change.subjectId,
					schoolId,
					gradeLevels: [],
					sectionIds: [],
					assignedBy: actorId,
				},
				select: { id: true },
			});
		}

		const subject = subjectById.get(change.subjectId);
		const destinationFaculty = facultyById.get(change.toFacultyId);
		const specializationIdentity = resolveAssignmentSpecializationIdentity({
			subjectCode: subject?.code,
			allowedSpecializations: subject?.allowedSpecializations,
			facultySpecialization: destinationFaculty?.specialization,
		});

		await tx.subjectSectionOwnership.upsert({
			where: {
				schoolId_subjectId_sectionId: {
					schoolId,
					subjectId: change.subjectId,
					sectionId: change.sectionId,
				},
			},
			update: {
				facultySubjectId: facultySubject.id,
				facultyId: change.toFacultyId,
				specializationCode: specializationIdentity.specializationCode,
				specializationLabel: specializationIdentity.specializationLabel,
				assignedAt: new Date(),
			},
			create: {
				schoolId,
				facultySubjectId: facultySubject.id,
				facultyId: change.toFacultyId,
				subjectId: change.subjectId,
				sectionId: change.sectionId,
				specializationCode: specializationIdentity.specializationCode,
				specializationLabel: specializationIdentity.specializationLabel,
				assignedAt: new Date(),
			},
		});

		touchedKeys.set(`${change.toFacultyId}:${change.subjectId}`, { facultyId: change.toFacultyId, subjectId: change.subjectId });
		if (change.fromFacultyId != null) {
			touchedKeys.set(`${change.fromFacultyId}:${change.subjectId}`, { facultyId: change.fromFacultyId, subjectId: change.subjectId });
		}
	}

	await syncFacultySubjectScopes(tx, schoolId, [...touchedKeys.values()], sectionGradeMap);

	const affectedFacultyIds = [...new Set(changes.flatMap((change) => [change.fromFacultyId, change.toFacultyId]).filter((id): id is number => id != null))];
	if (affectedFacultyIds.length > 0) {
		await tx.facultyMirror.updateMany({
			where: { schoolId, id: { in: affectedFacultyIds } },
			data: { version: { increment: 1 } },
		});
	}
}

export async function previewTeachingLoadRepair(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	request: TeachingLoadRepairRequest,
): Promise<TeachingLoadRepairPreviewResult> {
	const prepared = await prepareRepair(runId, schoolId, schoolYearId, request);
	return buildPreview(prepared);
}

export async function applyTeachingLoadRepair(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	request: TeachingLoadRepairRequest,
): Promise<TeachingLoadRepairApplyResult> {
	const prepared = await prepareRepair(runId, schoolId, schoolYearId, request);
	const preview = buildPreview(prepared);
	if (!preview.allowed || preview.hardViolations.length > 0) {
		throw err(422, 'HARD_VIOLATION_BLOCK', `Cannot save Teaching Load repair: ${preview.hardViolations.length} blocking conflict(s).`);
	}
	if (preview.softViolations.length > 0 && !request.allowSoftOverride) {
		throw err(422, 'SOFT_OVERRIDE_REQUIRED', `Repair has ${preview.softViolations.length} warning(s). Review and confirm before saving.`);
	}

	const { refData, newEntries } = prepared;
	const { run, unassignedItems } = refData;
	if (isPublishedSummary(run.summary)) {
		throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
	}
	const expectedVersion = request.expectedRunVersion;
	if (typeof expectedVersion !== 'number') {
		throw err(400, 'INVALID_BODY', 'expectedRunVersion is required when applying a Teaching Load repair.');
	}
	const newSummary = computeSummary(newEntries, unassignedItems, prepared.newValidation);
	const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
	const newVersion = run.version + 1;

	const { updatedRun, editRecords } = await prisma.$transaction(async (tx) => {
		const currentRun = await tx.generationRun.findFirst({
			where: { id: runId, schoolId, schoolYearId },
			select: { version: true, summary: true, status: true },
		});
		if (!currentRun) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
		if (currentRun.status !== 'COMPLETED') throw err(400, 'RUN_NOT_COMPLETED', 'Teaching Load repairs can only be applied to completed runs.');
		if (isPublishedSummary(currentRun.summary)) {
			throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
		}
		if (currentRun.version !== expectedVersion) {
			throw err(409, 'VERSION_CONFLICT', 'This timetable changed while the Teaching Load panel was open. Reload and review the change again.');
		}

		await applyCanonicalOwnership(tx, schoolId, schoolYearId, actorId, prepared.changes);

		const updated = await tx.generationRun.update({
			where: { id: runId, version: expectedVersion },
			data: {
				draftEntries: newEntries as unknown as object[],
				unassignedItems: unassignedItems as unknown as object[],
				violations: prepared.newValidation.violations as unknown as object[],
				summary: preservedSummary as object,
				version: newVersion,
			},
		});

		const created = [];
		for (const proposal of prepared.proposals) {
			if (!proposal.entryId) continue;
			const beforeEntry = prepared.refData.entries.find((entry) => entry.entryId === proposal.entryId) ?? null;
			const afterEntry = newEntries.find((entry) => entry.entryId === proposal.entryId) ?? null;
			created.push(await tx.manualScheduleEdit.create({
				data: {
					runId,
					schoolId,
					schoolYearId,
					actorId,
					editType: 'CHANGE_FACULTY',
					beforePayload: (beforeEntry ?? {}) as object,
					afterPayload: (afterEntry ?? {}) as object,
					validationSummary: {
						source: 'TEACHING_LOAD_REPAIR',
						subjectId: proposal.subjectId,
						sectionId: proposal.sectionId,
						fromFacultyId: proposal.currentFacultyId,
						toFacultyId: proposal.targetFacultyId,
						hardCount: preview.hardViolations.length,
						softCount: preview.softViolations.length,
						delta: preview.violationDelta,
					} as object,
				},
			}));
		}

		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'TIMETABLE_TEACHING_LOAD_REPAIR',
				actorId,
				targetIds: [runId],
				metadata: {
					editIds: created.map((edit) => edit.id),
					entryIds: prepared.proposals.map((proposal) => proposal.entryId).filter((entryId): entryId is string => typeof entryId === 'string'),
					changeCount: prepared.changes.length,
					newVersion,
				} as object,
			},
		});

		return { updatedRun: updated, editRecords: created };
	});

	return {
		editId: editRecords[0]?.id ?? 0,
		editIds: editRecords.map((edit) => edit.id),
		draft: buildDraftReport(updatedRun, newEntries, unassignedItems as unknown as UnassignedItem[], newSummary, updatedRun.version),
		violationDelta: preview.violationDelta,
		warnings: preview.softViolations,
		newVersion: updatedRun.version,
		ownershipDeltas: preview.ownershipDeltas,
		affectedTeachers: preview.affectedTeachers,
	};
}
