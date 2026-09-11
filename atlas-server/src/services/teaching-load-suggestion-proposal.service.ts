import { Prisma, type TeachingLoadSuggestionStatus } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';
import {
	autoFill,
	resolveTeachingLoadQualification,
	type AutoFillResult,
	type CoverageMode,
	type TeachingLoadDistributionPlan,
} from './teaching-load-automation.service.js';
import { assertTeachingLoadWriteAuthority } from './faculty-assignment.service.js';
import { refreshTeachingLoadCycle } from './teaching-load-cycle.service.js';
import { workloadPolicyRevision } from './workload-policy.service.js';
import { getEffectiveWorkloadPolicyFromClient, type EffectiveWorkloadPolicy } from './scheduling-policy.service.js';

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

/**
 * F1 authority: a proposal may only be applied when BOTH the stored (reviewed)
 * preview and the refreshed preview carry a complete, evaluated distribution
 * contract. Missing, malformed, unevaluated, or asymmetric contracts fail
 * closed with zero writes.
 */
function isCompleteEvaluatedDistribution(plan: unknown): plan is TeachingLoadDistributionPlan {
	if (!plan || typeof plan !== 'object') return false;
	const candidate = plan as Partial<TeachingLoadDistributionPlan> & { summary?: { distributionEvaluated?: unknown } };
	if (!Array.isArray(candidate.retains) || !Array.isArray(candidate.inserts) || !Array.isArray(candidate.moves)) return false;
	if (candidate.summary?.distributionEvaluated !== true) return false;
	const policy = candidate.policy;
	if (
		!policy
		|| typeof policy.revision !== 'string'
		|| !Number.isFinite(policy.teachingStandardMinutes)
		|| !Number.isFinite(policy.advisoryCreditMinutes)
		|| !Number.isFinite(policy.hardCapMinutes)
	) {
		return false;
	}
	return true;
}

/**
 * Deterministic semantic signature for a reviewed distribution plan. Binds
 * subject, section, faculty-subject identity, minutes, receiver qualification
 * tier/authority, the applicable policy revision, and deterministic ordering —
 * not only ownershipId/from/to.
 */
function distributionPlanSignature(plan: TeachingLoadDistributionPlan): string {
	const parts: string[] = [`P:${plan.policy?.revision ?? 'NO_POLICY'}`];
	for (const insert of plan.inserts) {
		parts.push(`I:${insert.subjectId}:${insert.sectionId}:${insert.facultyId}`);
	}
	for (const move of plan.moves) {
		parts.push([
			'M',
			move.ownershipId,
			move.facultySubjectId,
			move.subjectId,
			move.sectionId,
			move.fromFacultyId,
			move.toFacultyId,
			move.minutes,
			move.toQualificationTier,
			move.toQualificationAuthority,
		].join(':'));
	}
	return parts.sort().join('|');
}

function distributionStale(message: string): ServiceError {
	return err(409, 'TEACHING_LOAD_PROPOSAL_STALE', message, {
		actionHint: 'Preview a fresh Teaching Load suggestion, review it, then apply it.',
	});
}

function assertPolicyRevisionMatches(plan: TeachingLoadDistributionPlan, policy: EffectiveWorkloadPolicy | null): EffectiveWorkloadPolicy {
	if (policy == null) {
		throw distributionStale('The applicable workload policy is no longer configured. Preview a fresh proposal.');
	}
	if (workloadPolicyRevision(policy) !== plan.policy?.revision) {
		throw distributionStale('The applicable workload policy changed since the reviewed preview. Preview a fresh proposal.');
	}
	return policy;
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

	// F1: compare the recomputed reallocation plan against the reviewed preview
	// plan. BOTH must be complete, evaluated distribution contracts before any
	// insert or move. A legacy stored proposal without a distribution contract,
	// a missing/malformed/unevaluated refreshed plan, or an asymmetric pair means
	// the reviewed plan cannot be honored; fail closed before any write.
	const reviewedPlan = (existing.previewPayload as { distribution?: unknown } | null)?.distribution;
	const refreshedPlan = refreshedPreview.distribution;
	if (!isCompleteEvaluatedDistribution(reviewedPlan) || !isCompleteEvaluatedDistribution(refreshedPlan)) {
		throw distributionStale('The reviewed reallocation plan is missing or was not evaluated. Preview a fresh proposal.');
	}
	if (distributionPlanSignature(reviewedPlan) !== distributionPlanSignature(refreshedPlan)) {
		throw distributionStale('The reviewed reallocation plan changed since it was previewed. Preview a fresh proposal.');
	}

	// The inserts and moves applied are exactly the reviewed plan's structured
	// actions — never a freshly-derived set from the recomputed preview.
	const candidateRows = refreshedPlan.inserts.map((insert) => ({
		subjectId: insert.subjectId,
		sectionId: insert.sectionId,
		facultyId: insert.facultyId,
	}));
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

		// F2/F3: resolve the effective workload policy through THIS transaction
		// client and bind it to the reviewed plan. A module default is never write
		// authority, and a policy change after preview invalidates the apply.
		const txPolicyResolution = await getEffectiveWorkloadPolicyFromClient(tx as any, existing.schoolId, existing.schoolYearId);
		const txPolicy = assertPolicyRevisionMatches(refreshedPlan, txPolicyResolution.policy);

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

		// Resolve the sorted, unique grade levels for a set of section ids so the
		// persisted FacultySubject.sectionIds/gradeLevels parity invariant holds
		// after a move (moved sections may not be part of the insert candidate set).
		const resolveGradeLevels = async (sectionIds: number[]): Promise<number[]> => {
			const unique = [...new Set(sectionIds)];
			const grades: number[] = [];
			for (const sectionId of unique) {
				const known = sectionGrade.get(sectionId);
				if (known != null) {
					grades.push(known);
					continue;
				}
			}
			const missing = unique.filter((sectionId) => !sectionGrade.has(sectionId));
			if (missing.length > 0) {
				const mirrors = await tx.sectionMirror.findMany({
					where: {
						schoolId: existing.schoolId,
						schoolYearId: existing.schoolYearId,
						externalId: { in: missing },
					},
					select: { externalId: true, displayOrder: true },
				});
				for (const mirror of mirrors) {
					sectionGrade.set(mirror.externalId, mirror.displayOrder);
					grades.push(mirror.displayOrder);
				}
			}
			return [...new Set(grades)].sort((a, b) => a - b);
		};
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

		// Apply the distribution moves from the same reviewed plan, atomically with
		// the coverage inserts. Every move is re-validated against current state
		// inside this Serializable transaction using only the transaction client;
		// any semantic mismatch throws and rolls the whole apply back
		// (all-or-nothing).
		const planMoves = refreshedPlan.moves;
		let movesApplied = 0;

		// F3: preload the current subjects and specialization aliases once so each
		// move can recheck qualification/department authority and subject minutes
		// against the transaction's own view of the data.
		const moveSubjectIds = [...new Set(planMoves.map((move) => move.subjectId))];
		const moveSubjectRows = moveSubjectIds.length > 0
			? await tx.subject.findMany({
				where: { id: { in: moveSubjectIds }, schoolId: existing.schoolId },
				select: {
					id: true,
					code: true,
					name: true,
					isActive: true,
					minMinutesPerWeek: true,
					ownerDepartment: true,
					requiredFeatures: true,
					allowedSpecializations: true,
				},
			})
			: [];
		const moveSubjectById = new Map<number, (typeof moveSubjectRows)[number]>(moveSubjectRows.map((subject) => [subject.id, subject]));
		if (moveSubjectById.size !== moveSubjectIds.length) {
			throw distributionStale('A subject referenced by the reviewed plan no longer exists. Preview a fresh proposal.');
		}
		const moveAliasRows = await tx.specializationAlias.findMany({
			where: { schoolId: existing.schoolId },
			select: { canonical: true, alias: true },
		});
		const moveAliasesByCanonical = new Map<string, Set<string>>();
		for (const alias of moveAliasRows) {
			const canonKey = alias.canonical.trim().toLowerCase();
			const aliasSet = moveAliasesByCanonical.get(canonKey) ?? new Set<string>();
			aliasSet.add(alias.alias.trim().toLowerCase());
			moveAliasesByCanonical.set(canonKey, aliasSet);
		}

		for (const move of planMoves) {
			const ownership = await tx.subjectSectionOwnership.findUnique({
				where: { id: move.ownershipId },
				select: { facultyId: true, subjectId: true, sectionId: true, facultySubjectId: true },
			});
			if (!ownership) {
				throw distributionStale('A proposed move references an ownership row that no longer exists. Preview a fresh proposal.');
			}
			if (ownership.facultyId === move.toFacultyId) continue; // idempotent within the transaction
			if (
				ownership.facultyId !== move.fromFacultyId
				|| ownership.subjectId !== move.subjectId
				|| ownership.sectionId !== move.sectionId
				|| ownership.facultySubjectId !== move.facultySubjectId
			) {
				throw distributionStale('A proposed move no longer matches the current owner or faculty-subject row. Preview a fresh proposal.');
			}

			const receiver = await tx.facultyMirror.findUnique({
				where: { id: move.toFacultyId },
				select: {
					id: true,
					firstName: true,
					lastName: true,
					department: true,
					specialization: true,
					canTeachOutsideDepartment: true,
					maxHoursPerWeek: true,
					isActiveForScheduling: true,
					isStale: true,
					isPlaceholder: true,
				},
			});
			if (!receiver || !receiver.isActiveForScheduling || receiver.isStale || receiver.isPlaceholder) {
				throw distributionStale('A proposed receiver is no longer active for scheduling. Preview a fresh proposal.');
			}

			const moveSubject = moveSubjectById.get(move.subjectId);
			if (!moveSubject || !moveSubject.isActive) {
				throw distributionStale('A subject referenced by the reviewed plan is no longer active. Preview a fresh proposal.');
			}
			const currentSubjectMinutes = Math.max(0, Number(moveSubject.minMinutesPerWeek) || 0);
			if (currentSubjectMinutes !== move.minutes) {
				throw distributionStale('A subject weekly-minutes change invalidated the reviewed move. Preview a fresh proposal.');
			}

			const qualification = resolveTeachingLoadQualification({
				faculty: receiver,
				subject: moveSubject,
				aliasesByCanonical: moveAliasesByCanonical,
			});
			if (qualification.tier !== move.toQualificationTier || qualification.authority !== move.toQualificationAuthority) {
				throw distributionStale('A proposed receiver qualification or authority changed since the reviewed preview. Preview a fresh proposal.');
			}

			const hgSubject = await tx.subject.findFirst({
				where: { schoolId: existing.schoolId, code: 'HG' },
				select: { id: true },
			});
			const receiverOwned = await tx.subjectSectionOwnership.findMany({
				where: {
					schoolId: existing.schoolId,
					schoolYearId: existing.schoolYearId,
					facultyId: move.toFacultyId,
					...(hgSubject ? { subjectId: { not: hgSubject.id } } : {}),
				},
				select: { facultySubject: { select: { subject: { select: { minMinutesPerWeek: true } } } } },
			});
			const receiverTeachingMinutes = receiverOwned.reduce(
				(sum, row) => sum + Math.max(0, Number(row.facultySubject?.subject?.minMinutesPerWeek ?? 0) || 0),
				0,
			);
			// Receiver capacity is ACTUAL teaching minutes under the effective
			// persisted standard resolved through this transaction. Advisory and
			// ancillary credit are neutral and never reduce this capacity.
			const receiverCapMinutes = Math.min(
				Math.max(0, Math.round(receiver.maxHoursPerWeek * 60)),
				txPolicy.teachingStandardMinutes,
			);
			if (receiverTeachingMinutes + currentSubjectMinutes > receiverCapMinutes) {
				throw distributionStale('A proposed receiver no longer has capacity for this move. Preview a fresh proposal.');
			}

			const existingReceiverFs = await tx.facultySubject.findUnique({
				where: {
					facultyId_subjectId_schoolYearId: {
						facultyId: move.toFacultyId,
						subjectId: move.subjectId,
						schoolYearId: existing.schoolYearId,
					},
				},
				select: { id: true, sectionIds: true },
			});
			let receiverFacultySubjectId: number;
			if (existingReceiverFs) {
				receiverFacultySubjectId = existingReceiverFs.id;
				const mergedSections = [...new Set([...existingReceiverFs.sectionIds, move.sectionId])].sort((a, b) => a - b);
				await tx.facultySubject.update({
					where: { id: receiverFacultySubjectId },
					data: {
						sectionIds: mergedSections,
						gradeLevels: await resolveGradeLevels(mergedSections),
						assignedBy: input.actorId,
					},
				});
			} else {
				const createdReceiverFs = await tx.facultySubject.create({
					data: {
						facultyId: move.toFacultyId,
						subjectId: move.subjectId,
						schoolId: existing.schoolId,
						schoolYearId: existing.schoolYearId,
						gradeLevels: await resolveGradeLevels([move.sectionId]),
						sectionIds: [move.sectionId],
						assignedBy: input.actorId,
					},
					select: { id: true },
				});
				receiverFacultySubjectId = createdReceiverFs.id;
			}

			await tx.subjectSectionOwnership.update({
				where: { id: move.ownershipId },
				data: { facultyId: move.toFacultyId, facultySubjectId: receiverFacultySubjectId },
			});

			const donorFs = await tx.facultySubject.findUnique({
				where: { id: move.facultySubjectId },
				select: { sectionIds: true },
			});
			if (donorFs) {
				const remainingSections = donorFs.sectionIds.filter((sectionId) => sectionId !== move.sectionId);
				if (remainingSections.length === 0) {
					await tx.facultySubject.delete({ where: { id: move.facultySubjectId } });
				} else {
					const sortedRemaining = remainingSections.sort((a, b) => a - b);
					await tx.facultySubject.update({
						where: { id: move.facultySubjectId },
						data: {
							sectionIds: sortedRemaining,
							gradeLevels: await resolveGradeLevels(sortedRemaining),
						},
					});
				}
			}

			movesApplied += 1;
			affectedFacultyIds.add(move.fromFacultyId);
			affectedFacultyIds.add(move.toFacultyId);
		}

		if (affectedFacultyIds.size > 0) {
			await tx.facultyMirror.updateMany({
				where: { id: { in: [...affectedFacultyIds] }, schoolId: existing.schoolId },
				data: { version: { increment: 1 } },
			});
		}

		const applyResult: AutoFillResult = {
			movesApplied,
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
					moveCount: movesApplied,
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
