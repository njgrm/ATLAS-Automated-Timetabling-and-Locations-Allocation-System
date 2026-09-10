import type { TermContractResolution, VerifiedTermContract } from './enrollpro-term-contract.service.js';

export type SubjectSchedulingDisposition = 'SCHEDULED_TEACHING' | 'REFERENCE_ONLY';

export type SubjectSchedulingInput = {
	id: number;
	code: string;
	schedulingDisposition: SubjectSchedulingDisposition;
	rotationFamily?: string | null;
	modularOrder?: number | null;
};

export type SubjectRotationIssue = {
	subjectId: number;
	subjectCode: string;
	code: 'ROTATION_FAMILY_MISSING' | 'ROTATION_ORDER_MISSING' | 'ROTATION_ORDER_OUT_OF_RANGE' | 'ROTATION_ORDER_DUPLICATE' | 'TERM_CONTRACT_UNAVAILABLE';
	message: string;
};

export function projectSubjectSchedulingDemand<T extends Pick<SubjectSchedulingInput, 'id' | 'code' | 'schedulingDisposition'>>(subjects: T[]) {
	return subjects
		.filter((subject) => subject.schedulingDisposition === 'SCHEDULED_TEACHING')
		.map((subject) => ({ ...subject, createsTimetableDemand: true as const, createsTeachingLoad: true as const }));
}

export function resolveSubjectRotationIssues(subjects: SubjectSchedulingInput[], contract: VerifiedTermContract): SubjectRotationIssue[] {
	const issues: SubjectRotationIssue[] = [];
	const positions = new Map<string, SubjectSchedulingInput[]>();
	for (const subject of subjects) {
		const family = subject.rotationFamily?.trim() ?? '';
		const order = subject.modularOrder;
		if (!family && order != null) {
			issues.push({ subjectId: subject.id, subjectCode: subject.code, code: 'ROTATION_FAMILY_MISSING', message: 'Rotation order is set without a rotation family.' });
			continue;
		}
		if (family && (order == null || !Number.isInteger(order))) {
			issues.push({ subjectId: subject.id, subjectCode: subject.code, code: 'ROTATION_ORDER_MISSING', message: `Rotation family ${family} needs an explicit term order.` });
			continue;
		}
		if (!family || order == null) continue;
		if (order < 1 || order > contract.terms.length) {
			issues.push({ subjectId: subject.id, subjectCode: subject.code, code: 'ROTATION_ORDER_OUT_OF_RANGE', message: `Rotation order ${order} is outside the current ${contract.terms.length}-term contract.` });
			continue;
		}
		const key = `${family.toUpperCase()}::${order}`;
		positions.set(key, [...(positions.get(key) ?? []), subject]);
	}
	for (const subjectsAtPosition of positions.values()) {
		if (subjectsAtPosition.length < 2) continue;
		for (const subject of subjectsAtPosition) {
			issues.push({ subjectId: subject.id, subjectCode: subject.code, code: 'ROTATION_ORDER_DUPLICATE', message: 'Another subject in this rotation family uses the same term order.' });
		}
	}
	return issues;
}

export function buildSubjectSchedulingAuthorityView<T extends SubjectSchedulingInput>(subjects: T[], termAuthority: TermContractResolution) {
	const issues = termAuthority.contract
		? resolveSubjectRotationIssues(subjects, termAuthority.contract)
		: subjects
			.filter((subject) => Boolean(subject.rotationFamily?.trim()) || subject.modularOrder != null)
			.map((subject): SubjectRotationIssue => ({
				subjectId: subject.id, subjectCode: subject.code, code: 'TERM_CONTRACT_UNAVAILABLE',
				message: 'Rotation cannot be resolved until the EnrollPro term contract is verified.',
			}));
	const issuesBySubject = new Map<number, SubjectRotationIssue[]>();
	for (const issue of issues) issuesBySubject.set(issue.subjectId, [...(issuesBySubject.get(issue.subjectId) ?? []), issue]);
	const projected = new Set(projectSubjectSchedulingDemand(subjects).map((subject) => subject.id));
	return {
		termAuthority,
		subjects: subjects.map((subject) => {
			const order = subject.modularOrder;
			const resolvedTerm = termAuthority.contract && order != null && order >= 1 && order <= termAuthority.contract.terms.length
				? termAuthority.contract.terms[order - 1]
				: null;
			return {
				...subject,
				resolvedTerm,
				rotationTermIdentity: resolvedTerm?.identity ?? null,
				rotationTermLabel: resolvedTerm?.displayLabel ?? null,
				rotationTermRank: resolvedTerm?.order ?? null,
				rotationTermCount: termAuthority.contract?.terms.length ?? null,
				schedulingIssues: issuesBySubject.get(subject.id) ?? [],
				createsTimetableDemand: projected.has(subject.id),
				createsTeachingLoad: projected.has(subject.id),
			};
		}),
		issues,
		demandProjection: {
			scheduledSubjectIds: [...projected],
			referenceOnlySubjectIds: subjects.filter((subject) => subject.schedulingDisposition === 'REFERENCE_ONLY').map((subject) => subject.id),
		},
	};
}
