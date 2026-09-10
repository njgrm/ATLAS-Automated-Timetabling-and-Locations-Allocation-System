import { Prisma, type TeachingLoadSuggestionStatus } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';
import { autoFill, type AutoFillResult, type CoverageMode } from './teaching-load-automation.service.js';
import { assertTeachingLoadWriteAuthority } from './faculty-assignment.service.js';
import { refreshTeachingLoadCycle } from './teaching-load-cycle.service.js';

const db = () => getDataContext();

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

type ProposalSummary = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	coverageMode: string;
	status: TeachingLoadSuggestionStatus;
	sectionSource: string | null;
	sectionFallbackReason: string | null;
	suggestedAssignmentCount: number;
	unresolvedCount: number;
	warningCount: number;
	createdBy: number | null;
	appliedBy: number | null;
	createdAt: Date;
	updatedAt: Date;
	appliedAt: Date | null;
	cancelledAt: Date | null;
	suggestedAssignmentBreakdown?: {
		existingRows: number;
		realTeacherRows: number;
		substituteRows: number;
		newSuggestedRows: number;
		previewRowCount: number;
		unresolvedRows: number;
	};
};

export type TeachingLoadSuggestionProposalResult = {
	proposal: ProposalSummary;
	preview: AutoFillResult;
	refreshedPreview?: AutoFillResult;
	applyResult?: AutoFillResult;
};

export type TeachingLoadSuggestionProposalStatusResult = {
	proposal: ProposalSummary;
};

function err(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): ServiceError {
	const error = new Error(message) as ServiceError;
	error.statusCode = statusCode;
	error.code = code;
	error.actionHint = options?.actionHint;
	error.details = options?.details;
	return error;
}

function suggestedAssignmentCount(result: AutoFillResult): number {
	return (result.suggestedRows ?? []).filter(
		(r) => r.assignmentType === 'REAL_TEACHER' || r.assignmentType === 'TEMPORARY_SUBSTITUTE',
	).length;
}

function suggestedAssignmentBreakdown(result: AutoFillResult): { existingRows: number; realTeacherRows: number; substituteRows: number; newSuggestedRows: number; previewRowCount: number; unresolvedRows: number } {
	const suggestedRows = result.suggestedRows ?? [];
	const unresolvedRows = result.unresolved ?? 0;

	let existingRows = 0;
	let realTeacherRows = 0;
	let substituteRows = 0;

	for (const row of suggestedRows) {
		switch (row.assignmentType) {
			case 'KEPT_EXISTING':
				existingRows++;
				break;
			case 'REAL_TEACHER':
				realTeacherRows++;
				break;
			case 'TEMPORARY_SUBSTITUTE':
				substituteRows++;
				break;
			default:
				realTeacherRows++;
				break;
		}
	}

	const newSuggestedRows = realTeacherRows + substituteRows;
	const previewRowCount = suggestedRows.length;
	return { existingRows, realTeacherRows, substituteRows, newSuggestedRows, previewRowCount, unresolvedRows };
}

function toJsonValue(result: AutoFillResult): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
}

function summarizeProposal(row: ProposalSummary): ProposalSummary {
	return row;
}

function requireActor(actorId: number): void {
	if (!Number.isInteger(actorId) || actorId <= 0) {
		throw err(403, 'ACTOR_REQUIRED', 'An authenticated operator is required for this Teaching Load mutation.');
	}
}

function appliedReplay(row: any): TeachingLoadSuggestionProposalResult {
	const preview = row.previewPayload as AutoFillResult;
	const refreshedPreview = (row.refreshedPreviewPayload ?? row.previewPayload) as AutoFillResult;
	const applyResult = (row.applyPayload ?? refreshedPreview) as AutoFillResult;
	return {
		proposal: { ...summarizeProposal(row), suggestedAssignmentBreakdown: suggestedAssignmentBreakdown(refreshedPreview) },
		preview,
		refreshedPreview,
		applyResult,
	};
}

export async function createTeachingLoadSuggestionProposal(input: {
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	actorSchoolId: number | null;
	authToken?: string;
	coverageMode?: CoverageMode;
}): Promise<TeachingLoadSuggestionProposalResult> {
	requireActor(input.actorId);
	await assertTeachingLoadWriteAuthority({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		actorSchoolId: input.actorSchoolId,
	});
	const preview = await autoFill(input.schoolId, input.schoolYearId, input.authToken, {
		previewOnly: true,
		coverageMode: input.coverageMode,
	});
	const breakdown = suggestedAssignmentBreakdown(preview);

	const proposal = await db().$transaction(async (tx) => {
		await assertTeachingLoadWriteAuthority({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			actorSchoolId: input.actorSchoolId,
		}, tx as any);
		await tx.teachingLoadSuggestionProposal.updateMany({
			where: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				status: 'PENDING',
			},
			data: {
				status: 'SUPERSEDED',
				cancelledAt: new Date(),
			},
		});

		const created = await tx.teachingLoadSuggestionProposal.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				coverageMode: preview.coverageMode,
				status: 'PENDING',
				previewPayload: toJsonValue(preview),
				sectionSource: preview.sectionSource,
				sectionFallbackReason: preview.sectionFallbackReason,
				suggestedAssignmentCount: breakdown.newSuggestedRows,
				unresolvedCount: preview.unresolved ?? 0,
				warningCount: preview.warnings.length,
				createdBy: input.actorId || null,
			},
		});
		await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'TEACHING_LOAD_SUGGESTION_PROPOSAL_CREATED',
				actorId: input.actorId,
				targetIds: [created.id],
				metadata: {
					proposalId: created.id,
					coverageMode: created.coverageMode,
					suggestedAssignmentCount: created.suggestedAssignmentCount,
				} as object,
			},
		});
		return created;
	}, { isolationLevel: 'Serializable' });

	return {
		proposal: { ...summarizeProposal(proposal), suggestedAssignmentBreakdown: breakdown },
		preview,
	};
}

export async function applyTeachingLoadSuggestionProposal(input: {
	proposalId: number;
	actorId: number;
	actorSchoolId: number | null;
	authToken?: string;
}, dependencies: { preview?: typeof autoFill } = {}): Promise<TeachingLoadSuggestionProposalResult> {
	requireActor(input.actorId);
	const existing = await db().teachingLoadSuggestionProposal.findUnique({
		where: { id: input.proposalId },
	});

	if (!existing) {
		throw err(404, 'TEACHING_LOAD_PROPOSAL_NOT_FOUND', 'This Teaching Load suggestion no longer exists.', {
			actionHint: 'Preview a new Teaching Load suggestion, then apply it after review.',
		});
	}
	await assertTeachingLoadWriteAuthority({
		schoolId: existing.schoolId,
		schoolYearId: existing.schoolYearId,
		actorSchoolId: input.actorSchoolId,
	});

	if (existing.status === 'APPLIED') {
		return appliedReplay(existing);
	}

	if (existing.status !== 'PENDING') {
		throw err(409, 'TEACHING_LOAD_PROPOSAL_NOT_PENDING', 'This Teaching Load suggestion has already been used or replaced.', {
			actionHint: 'Preview a fresh Teaching Load suggestion before applying changes.',
			details: { status: existing.status },
		});
	}

	const refreshedPreview = await (dependencies.preview ?? autoFill)(existing.schoolId, existing.schoolYearId, input.authToken, {
		previewOnly: true,
		coverageMode: existing.coverageMode as CoverageMode,
	});

	const breakdown = suggestedAssignmentBreakdown(refreshedPreview);
	const candidateRows = (refreshedPreview.suggestedRows ?? []).filter(
		(row) => row.assignmentType === 'REAL_TEACHER' && Number.isInteger(row.facultyId) && (row.facultyId ?? 0) > 0,
	);
	const unresolvedSuggestionCount = (refreshedPreview.suggestedRows ?? []).filter(
		(row) => row.assignmentType === 'TEMPORARY_SUBSTITUTE' || row.facultyId == null,
	).length;

	const txResult = await db().$transaction(async (tx) => {
		await assertTeachingLoadWriteAuthority({
			schoolId: existing.schoolId,
			schoolYearId: existing.schoolYearId,
			actorSchoolId: input.actorSchoolId,
		}, tx as any);

		const currentProposal = await tx.teachingLoadSuggestionProposal.findUnique({ where: { id: existing.id } });
		if (!currentProposal) {
			throw err(404, 'TEACHING_LOAD_PROPOSAL_NOT_FOUND', 'This Teaching Load suggestion no longer exists.');
		}
		if (currentProposal.status === 'APPLIED') {
			return { replay: true as const, row: currentProposal };
		}
		if (currentProposal.status !== 'PENDING') {
			throw err(409, 'TEACHING_LOAD_PROPOSAL_NOT_PENDING', 'This Teaching Load suggestion has already been used or replaced.', {
				details: { status: currentProposal.status },
			});
		}

		const facultyIds = [...new Set(candidateRows.map((row) => row.facultyId as number))];
		const subjectIds = [...new Set(candidateRows.map((row) => row.subjectId))];
		const sectionIds = [...new Set(candidateRows.map((row) => row.sectionId))];
		const [facultyRows, subjectRows, sectionRows, ownershipRows] = await Promise.all([
			facultyIds.length > 0 ? tx.facultyMirror.findMany({
				where: {
					id: { in: facultyIds },
					schoolId: existing.schoolId,
					isActiveForScheduling: true,
					isStale: false,
					isPlaceholder: false,
				},
				select: { id: true },
			}) : Promise.resolve([]),
			subjectIds.length > 0 ? tx.subject.findMany({
				where: { id: { in: subjectIds }, schoolId: existing.schoolId, isActive: true },
				select: { id: true },
			}) : Promise.resolve([]),
			sectionIds.length > 0 ? tx.sectionMirror.findMany({
				where: {
					schoolId: existing.schoolId,
					schoolYearId: existing.schoolYearId,
					externalId: { in: sectionIds },
					isActiveForScheduling: true,
					isStale: false,
				},
				select: { externalId: true, displayOrder: true },
			}) : Promise.resolve([]),
			candidateRows.length > 0 ? tx.subjectSectionOwnership.findMany({
				where: {
					schoolId: existing.schoolId,
					schoolYearId: existing.schoolYearId,
					subjectId: { in: subjectIds },
					sectionId: { in: sectionIds },
				},
				select: { subjectId: true, sectionId: true, facultyId: true },
			}) : Promise.resolve([]),
		]);

		if (facultyRows.length !== facultyIds.length || subjectRows.length !== subjectIds.length || sectionRows.length !== sectionIds.length) {
			throw err(409, 'TEACHING_LOAD_PROPOSAL_STALE', 'The reviewed suggestion no longer matches active faculty, subjects, or sections. Preview a fresh proposal.');
		}
		const proposedPairs = new Map(candidateRows.map((row) => [`${row.subjectId}:${row.sectionId}`, row.facultyId as number]));
		const conflicting = ownershipRows.filter((row: any) => proposedPairs.get(`${row.subjectId}:${row.sectionId}`) !== row.facultyId);
		if (conflicting.length > 0) {
			throw err(409, 'TEACHING_LOAD_PROPOSAL_STALE', 'One or more reviewed subject-section pairs changed ownership. Preview a fresh proposal.');
		}

		const sectionGrade = new Map<number, number>(sectionRows.map((row: any) => [row.externalId, row.displayOrder]));
		const alreadyOwned = new Set(ownershipRows.map((row: any) => `${row.subjectId}:${row.sectionId}:${row.facultyId}`));
		const grouped = new Map<string, { facultyId: number; subjectId: number; sectionIds: number[] }>();
		for (const row of candidateRows) {
			const facultyId = row.facultyId as number;
			if (alreadyOwned.has(`${row.subjectId}:${row.sectionId}:${facultyId}`)) continue;
			const key = `${facultyId}:${row.subjectId}`;
			const group = grouped.get(key) ?? { facultyId, subjectId: row.subjectId, sectionIds: [] };
			group.sectionIds.push(row.sectionId);
			grouped.set(key, group);
		}

		let created = 0;
		const affectedFacultyIds = new Set<number>();
		for (const group of grouped.values()) {
			const existingAssignment = await tx.facultySubject.findUnique({
				where: {
					facultyId_subjectId_schoolYearId: {
						facultyId: group.facultyId,
						subjectId: group.subjectId,
						schoolYearId: existing.schoolYearId,
					},
				},
				select: { id: true },
			});
			const assignment = existingAssignment ?? await tx.facultySubject.create({
				data: {
					facultyId: group.facultyId,
					subjectId: group.subjectId,
					schoolId: existing.schoolId,
					schoolYearId: existing.schoolYearId,
					gradeLevels: [],
					sectionIds: [],
					assignedBy: input.actorId,
				},
				select: { id: true },
			});

			await tx.subjectSectionOwnership.createMany({
				data: [...new Set(group.sectionIds)].map((sectionId) => ({
					schoolId: existing.schoolId,
					schoolYearId: existing.schoolYearId,
					facultySubjectId: assignment.id,
					facultyId: group.facultyId,
					subjectId: group.subjectId,
					sectionId,
					assignedAt: new Date(),
				})),
			});
			const owned = await tx.subjectSectionOwnership.findMany({
				where: {
					schoolId: existing.schoolId,
					schoolYearId: existing.schoolYearId,
					facultyId: group.facultyId,
					subjectId: group.subjectId,
				},
				select: { sectionId: true },
			});
			const finalSectionIds = [...new Set(owned.map((row: any) => row.sectionId))].sort((a, b) => a - b);
			const finalGradeLevels = [...new Set(finalSectionIds.map((sectionId) => sectionGrade.get(sectionId)).filter((value): value is number => Number.isInteger(value)))].sort((a, b) => a - b);
			await tx.facultySubject.update({
				where: { id: assignment.id },
				data: { sectionIds: finalSectionIds, gradeLevels: finalGradeLevels, assignedBy: input.actorId },
			});
			created += group.sectionIds.length;
			affectedFacultyIds.add(group.facultyId);
		}

		if (affectedFacultyIds.size > 0) {
			await tx.facultyMirror.updateMany({
				where: { id: { in: [...affectedFacultyIds] }, schoolId: existing.schoolId },
				data: { version: { increment: 1 } },
			});
		}

		const applyResult: AutoFillResult = {
			...refreshedPreview,
			created,
			assignmentsCreated: created,
			uniqueTeachersAffected: affectedFacultyIds.size,
			unresolved: unresolvedSuggestionCount,
			teacherXResolution: refreshedPreview.teacherXResolution ? {
				...refreshedPreview.teacherXResolution,
				applied: false,
				createdPlaceholders: 0,
				reusedPlaceholders: 0,
				placeholderAssignmentsUpserted: 0,
			} : undefined,
		};

		await refreshTeachingLoadCycle(existing.schoolId, existing.schoolYearId, tx);
		const statusUpdate = await tx.teachingLoadSuggestionProposal.updateMany({
			where: { id: existing.id, status: 'PENDING' },
			data: {
				status: 'APPLIED',
				refreshedPreviewPayload: toJsonValue(refreshedPreview),
				applyPayload: toJsonValue(applyResult),
				suggestedAssignmentCount: breakdown.newSuggestedRows,
				unresolvedCount: applyResult.unresolved,
				warningCount: applyResult.warnings.length,
				appliedBy: input.actorId,
				appliedAt: new Date(),
			},
		});
		if (statusUpdate.count !== 1) {
			throw err(409, 'TEACHING_LOAD_PROPOSAL_NOT_PENDING', 'This Teaching Load suggestion was applied concurrently.');
		}
		await tx.auditLog.create({
			data: {
				schoolId: existing.schoolId,
				schoolYearId: existing.schoolYearId,
				action: 'TEACHING_LOAD_SUGGESTION_PROPOSAL_APPLIED',
				actorId: input.actorId,
				targetIds: [existing.id, ...affectedFacultyIds],
				metadata: {
					proposalId: existing.id,
					coverageMode: existing.coverageMode,
					assignmentCount: created,
					unresolvedSuggestionCount,
				} as object,
			},
		});
		const updated = await tx.teachingLoadSuggestionProposal.findUnique({ where: { id: existing.id } });
		if (!updated) {
			throw err(409, 'TEACHING_LOAD_PROPOSAL_NOT_PENDING', 'The applied proposal could not be reloaded atomically.');
		}
		return { replay: false as const, row: updated, applyResult };
	}, { isolationLevel: 'Serializable' });

	if (txResult.replay) {
		return appliedReplay(txResult.row);
	}
	const updated = txResult.row;

	return {
		proposal: { ...summarizeProposal(updated), suggestedAssignmentBreakdown: breakdown },
		preview: existing.previewPayload as unknown as AutoFillResult,
		refreshedPreview,
		applyResult: txResult.applyResult,
	};
}

export async function cancelTeachingLoadSuggestionProposal(input: {
	proposalId: number;
	actorId: number;
	actorSchoolId: number | null;
}): Promise<TeachingLoadSuggestionProposalStatusResult> {
	requireActor(input.actorId);
	const existing = await db().teachingLoadSuggestionProposal.findUnique({
		where: { id: input.proposalId },
	});

	if (!existing) {
		throw err(404, 'TEACHING_LOAD_PROPOSAL_NOT_FOUND', 'This Teaching Load suggestion no longer exists.', {
			actionHint: 'Preview a new Teaching Load suggestion if you still want ATLAS to prepare one.',
		});
	}
	await assertTeachingLoadWriteAuthority({
		schoolId: existing.schoolId,
		schoolYearId: existing.schoolYearId,
		actorSchoolId: input.actorSchoolId,
	});

	if (existing.status === 'APPLIED') {
		throw err(409, 'TEACHING_LOAD_PROPOSAL_ALREADY_APPLIED', 'This Teaching Load suggestion was already applied.', {
			actionHint: 'Use the Teaching Load draft controls to undo or revise the saved draft.',
			details: { status: existing.status },
		});
	}

	if (existing.status !== 'PENDING') {
		return { proposal: summarizeProposal(existing) };
	}

	const updated = await db().$transaction(async (tx) => {
		await assertTeachingLoadWriteAuthority({
			schoolId: existing.schoolId,
			schoolYearId: existing.schoolYearId,
			actorSchoolId: input.actorSchoolId,
		}, tx as any);
		const cancelled = await tx.teachingLoadSuggestionProposal.update({
			where: { id: existing.id },
			data: { status: 'CANCELLED', cancelledAt: new Date() },
		});
		await tx.auditLog.create({
			data: {
				schoolId: existing.schoolId,
				schoolYearId: existing.schoolYearId,
				action: 'TEACHING_LOAD_SUGGESTION_PROPOSAL_CANCELLED',
				actorId: input.actorId,
				targetIds: [existing.id],
				metadata: { proposalId: existing.id } as object,
			},
		});
		return cancelled;
	}, { isolationLevel: 'Serializable' });

	return { proposal: summarizeProposal(updated) };
}
