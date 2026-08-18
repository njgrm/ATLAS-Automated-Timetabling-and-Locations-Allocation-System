import type { DraftReport, UnassignedItem, Violation } from '@/types';

export type BlockerReason =
	| 'FACULTY_OVERLOADED'
	| 'NO_AVAILABLE_SLOT'
	| 'NO_QUALIFIED_FACULTY'
	| 'NO_COMPATIBLE_ROOM'
	| 'ROOM_CAPACITY_EXCEEDED'
	| 'UNASSIGNED_SECTION'
	| 'UNKNOWN';

export type BlockerGroup = {
	reason: BlockerReason;
	plainLabel: string;
	count: number;
	actionLabel: string;
	actionHref: string;
	items: BlockerItem[];
};

export type BlockerItem = {
	sectionLabel: string;
	subjectLabel: string;
	gradeLabel: string;
	sessionNumber: number;
	facultyLabel: string;
	reason: string;
	plainReason: string;
	nextStep: string;
};

export type WarningGroup = {
	code: string;
	plainLabel: string;
	count: number;
};

export type SimplePublishReadiness = {
	totalUnresolved: number;
	totalHardBlockers: number;
	totalSoftWarnings: number;
	blockerGroups: BlockerGroup[];
	warningGroups: WarningGroup[];
	summaryText: string;
	hasBlockers: boolean;
	hasWarnings: boolean;
	isClean: boolean;
};

const REASON_TO_PLAIN_LABEL: Record<string, string> = {
	FACULTY_OVERLOADED: 'Teachers are overloaded',
	NO_AVAILABLE_SLOT: 'No allowed time slot was found',
	NO_QUALIFIED_FACULTY: 'No qualified teacher is assigned',
	NO_COMPATIBLE_ROOM: 'No compatible room was found',
	ROOM_CAPACITY_EXCEEDED: 'Room capacity is too small',
	UNASSIGNED_SECTION: 'This class was not placed',
};

const REASON_TO_ACTION: Record<string, { label: string; href: string }> = {
	FACULTY_OVERLOADED: { label: 'Open Teaching Load', href: '/teaching-load' },
	NO_QUALIFIED_FACULTY: { label: 'Open Teaching Load', href: '/teaching-load' },
	NO_AVAILABLE_SLOT: { label: 'Place manually', href: '/timetable' },
	NO_COMPATIBLE_ROOM: { label: 'Review rooms', href: '/campus-rooms' },
	ROOM_CAPACITY_EXCEEDED: { label: 'Review rooms', href: '/campus-rooms' },
	UNASSIGNED_SECTION: { label: 'Review issue', href: '/timetable' },
};

const REASON_TO_NEXT_STEP: Record<string, string> = {
	FACULTY_OVERLOADED: 'Teacher workload is full. Move some classes or assign another teacher.',
	NO_AVAILABLE_SLOT: 'No allowed time slot was found. Try manual placement or review the scheduling policy.',
	NO_QUALIFIED_FACULTY: 'No qualified teacher is assigned. Build or repair Teaching Load.',
	NO_COMPATIBLE_ROOM: 'No compatible room was found. Review room setup.',
	ROOM_CAPACITY_EXCEEDED: 'The room is too small for this class. Choose a larger room.',
	UNASSIGNED_SECTION: 'This class was not placed. Review the unresolved reason.',
};

const VIOLATION_SOFT_LABELS: Record<string, string> = {
	FACULTY_TIME_CONFLICT: 'Teacher time conflict',
	ROOM_TIME_CONFLICT: 'Room time conflict',
	SECTION_TIME_CONFLICT: 'Section time conflict',
	FACULTY_OVERLOAD: 'Teacher overload warning',
	ROOM_TYPE_MISMATCH: 'Room type mismatch',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Teacher not qualified for subject',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Too many consecutive periods',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break requirement violated',
	FACULTY_DAILY_STANDARD_EXCEEDED: 'Daily standard hours exceeded',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily max hours exceeded',
	ZONE_IMBALANCE_WARNING: 'Zone imbalance',
	SECTION_OVERCOMPRESSED: 'Section overcompressed',
	LACKING_FACULTY: 'Missing faculty coverage',
	INCOMPLETE_MODULAR_GROUP: 'Incomplete modular group',
};

function gradeLabel(gradeLevel: number): string {
	return `GR${gradeLevel}`;
}

function resolveReason(item: UnassignedItem): BlockerReason {
	if (item.reason && item.reason in REASON_TO_PLAIN_LABEL) {
		return item.reason as BlockerReason;
	}
	return 'UNKNOWN';
}

function buildItemsFromUnassigned(
	unassignedItems: UnassignedItem[],
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
	facultyLabel: (id: number) => string,
): Map<BlockerReason, BlockerItem[]> {
	const groups = new Map<BlockerReason, BlockerItem[]>();

	for (const item of unassignedItems) {
		const reason = resolveReason(item);
		if (!groups.has(reason)) {
			groups.set(reason, []);
		}
		groups.get(reason)!.push({
			sectionLabel: sectionLabel(item.sectionId),
			subjectLabel: subjectLabel(item.subjectId),
			gradeLabel: gradeLabel(item.gradeLevel),
			sessionNumber: item.session,
			facultyLabel: item.facultyId != null ? facultyLabel(item.facultyId) : 'No teacher assigned',
			reason: item.reason,
			plainReason: REASON_TO_PLAIN_LABEL[item.reason] ?? 'Needs review',
			nextStep: REASON_TO_NEXT_STEP[item.reason] ?? 'Review issue',
		});
	}

	return groups;
}

function buildItemsFromResourceDiagnostics(
	draft: DraftReport,
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
): Map<BlockerReason, BlockerItem[]> {
	const groups = new Map<BlockerReason, BlockerItem[]>();
	const diagnostics = draft.summary?.resourceDiagnostics?.unassignedBySubjectGrade;
	if (!diagnostics) return groups;

	for (const entry of diagnostics) {
		for (const [reasonCode, count] of Object.entries(entry.reasons)) {
			const reason = (reasonCode in REASON_TO_PLAIN_LABEL ? reasonCode : 'UNKNOWN') as BlockerReason;
			if (!groups.has(reason)) {
				groups.set(reason, []);
			}
			const existing = groups.get(reason)!;
			for (let i = 0; i < count; i++) {
				existing.push({
					sectionLabel: `${gradeLabel(entry.gradeLevel)} section`,
					subjectLabel: entry.subjectCode || subjectLabel(entry.subjectId),
					gradeLabel: gradeLabel(entry.gradeLevel),
					sessionNumber: i + 1,
					facultyLabel: 'No teacher assigned',
					reason: reasonCode,
					plainReason: REASON_TO_PLAIN_LABEL[reasonCode] ?? 'Needs review',
					nextStep: REASON_TO_NEXT_STEP[reasonCode] ?? 'Review issue',
				});
			}
		}
	}

	return groups;
}

function buildItemsFromViolations(
	violations: Violation[],
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
	facultyLabel: (id: number) => string,
): Map<BlockerReason, BlockerItem[]> {
	const groups = new Map<BlockerReason, BlockerItem[]>();
	const hardViolations = violations.filter((v) => v.severity === 'HARD');

	for (const v of hardViolations) {
		let reason: BlockerReason = 'UNKNOWN';
		if (v.code === 'UNASSIGNED_SECTION') reason = 'UNASSIGNED_SECTION';
		else if (v.code === 'FACULTY_OVERLOAD') reason = 'FACULTY_OVERLOADED';
		else if (v.code === 'SPECIALIZED_ROOM_UNAVAILABLE') reason = 'NO_COMPATIBLE_ROOM';
		else if (v.code === 'FACULTY_SUBJECT_NOT_QUALIFIED') reason = 'NO_QUALIFIED_FACULTY';
		else if (v.code === 'ROOM_CAPACITY_EXCEEDED') reason = 'ROOM_CAPACITY_EXCEEDED';

		if (!groups.has(reason)) {
			groups.set(reason, []);
		}
		groups.get(reason)!.push({
			sectionLabel: v.entities.sectionId != null ? sectionLabel(v.entities.sectionId) : 'Unknown section',
			subjectLabel: v.entities.subjectId != null ? subjectLabel(v.entities.subjectId) : 'Unknown subject',
			gradeLabel: '—',
			sessionNumber: 0,
			facultyLabel: v.entities.facultyId != null ? facultyLabel(v.entities.facultyId) : 'No teacher assigned',
			reason: v.code,
			plainReason: REASON_TO_PLAIN_LABEL[reason] ?? 'Needs review',
			nextStep: REASON_TO_NEXT_STEP[reason] ?? 'Review issue',
		});
	}

	return groups;
}

function buildWarningGroups(violations: Violation[]): WarningGroup[] {
	const softViolations = violations.filter((v) => v.severity === 'SOFT');
	const counts = new Map<string, number>();

	for (const v of softViolations) {
		counts.set(v.code, (counts.get(v.code) ?? 0) + 1);
	}

	return Array.from(counts.entries())
		.map(([code, count]) => ({
			code,
			plainLabel: VIOLATION_SOFT_LABELS[code] ?? code,
			count,
		}))
		.sort((a, b) => b.count - a.count);
}

export function deriveSimplePublishReadiness(
	draft: DraftReport | null,
	violations: Violation[],
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
	facultyLabel: (id: number) => string,
): SimplePublishReadiness {
	const unassignedItems = draft?.unassignedItems ?? [];

	let itemGroups: Map<BlockerReason, BlockerItem[]>;
	if (unassignedItems.length > 0) {
		itemGroups = buildItemsFromUnassigned(unassignedItems, sectionLabel, subjectLabel, facultyLabel);
	} else {
		const diagnosticsGroups = draft ? buildItemsFromResourceDiagnostics(draft, sectionLabel, subjectLabel) : new Map();
		if (diagnosticsGroups.size > 0) {
			itemGroups = diagnosticsGroups;
		} else {
			itemGroups = buildItemsFromViolations(violations, sectionLabel, subjectLabel, facultyLabel);
		}
	}

	const blockerGroups: BlockerGroup[] = Array.from(itemGroups.entries())
		.map(([reason, items]) => {
			const config = REASON_TO_ACTION[reason] ?? { label: 'Review issue', href: '/timetable' };
			return {
				reason,
				plainLabel: REASON_TO_PLAIN_LABEL[reason] ?? 'Needs review',
				count: items.length,
				actionLabel: config.label,
				actionHref: config.href,
				items,
			};
		})
		.sort((a, b) => b.count - a.count);

	const totalHardBlockers = blockerGroups.reduce((sum, g) => sum + g.count, 0);
	const totalUnresolved = unassignedItems.length > 0 ? unassignedItems.length : totalHardBlockers;
	const warningGroups = buildWarningGroups(violations);
	const totalSoftWarnings = warningGroups.reduce((sum, g) => sum + g.count, 0);

	let summaryText: string;
	if (totalHardBlockers > 0) {
		summaryText = `Cannot publish yet\n${totalUnresolved} session${totalUnresolved === 1 ? '' : 's'} still need fixing before this schedule can be published.\nFix blockers first. Warnings can be reviewed after blockers are clear.`;
	} else if (totalSoftWarnings > 0) {
		summaryText = `Ready except for warnings\nNo hard blockers remain. Review the warnings, then publish if the schedule is acceptable.`;
	} else {
		summaryText = `Ready to publish\nNo hard blockers or unresolved sessions remain.`;
	}

	return {
		totalUnresolved,
		totalHardBlockers,
		totalSoftWarnings,
		blockerGroups,
		warningGroups,
		summaryText,
		hasBlockers: totalHardBlockers > 0,
		hasWarnings: totalSoftWarnings > 0,
		isClean: totalHardBlockers === 0 && totalSoftWarnings === 0,
	};
}
