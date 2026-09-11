/**
 * TL-RR01 client decision helpers for the Teaching Load carry-forward preview.
 *
 * Pure, testable functions only. The preview is optional and always reviewed
 * before any future approval; the apply path is intentionally not reachable
 * from this surface.
 */

export type CarryForwardReason =
	| 'EXACT_CARRY'
	| 'ALREADY_OCCUPIED'
	| 'MISSING_FACULTY'
	| 'MISSING_SECTION'
	| 'NO_CURRENT_DEMAND'
	| 'UNQUALIFIED'
	| 'CAP_BLOCKED'
	| 'AMBIGUOUS'
	| 'OTHER';

export type CarryForwardAction = 'CARRY' | 'SKIP';

export interface CarryForwardRow {
	sourceOwnershipId: number;
	sourceFacultyExternalId: number | null;
	sourceSubjectCode: string | null;
	sourceSectionExternalId: number;
	reason: CarryForwardReason;
	action: CarryForwardAction;
	targetSubjectCode: string | null;
	targetSectionExternalId: number | null;
	targetSectionKey: string | null;
	targetFacultyId: number | null;
	targetFacultyName: string | null;
	targetDepartment: string | null;
	weeklyMinutes: number;
	detail: string | null;
}

export interface CarryForwardDepartmentReview {
	department: string;
	carry: number;
	skipped: number;
}

export interface CarryForwardWorkloadChange {
	facultyId: number;
	name: string;
	beforeMinutes: number;
	afterMinutes: number;
	beforeStatus: string;
	afterStatus: string;
	changed: boolean;
}

export interface CarryForwardDistribution {
	zeroLoad: number;
	adviserOnly: number;
	belowStandard: number;
	atStandard: number;
	excess: number;
	overCap: number;
}

export interface CarryForwardPreview {
	schoolId: number;
	fingerprint: string;
	sourceRevision: string;
	targetRevision: string;
	derivedDemandRevision: string | null;
	sourceYear: { enrollProSchoolYearId: number; yearLabel: string; cycle: { state: string; version: number; ownershipCount: number } };
	targetYear: { enrollProSchoolYearId: number; yearLabel: string; cycle: { state: string; version: number; ownershipCount: number } };
	totals: Record<CarryForwardReason, number>;
	totalsSummary: { sourceRows: number; carried: number; skipped: number };
	before: { ownershipCount: number; demandCount: number; distribution: CarryForwardDistribution };
	after: { distribution: CarryForwardDistribution; overloadChanges: CarryForwardWorkloadChange[] };
	perDepartment: CarryForwardDepartmentReview[];
	adviserCoverage: { satisfied: number; unsatisfied: number };
	rows: CarryForwardRow[];
	confirmationText: string;
	zeroWriteProof: { preview: boolean; writes: number };
	authorizesMutation: boolean;
}

type CarryForwardSourceYearOption = { enrollProSchoolYearId: number; preservedCounts?: Record<string, number> | null };

type ReasonTone = 'carry' | 'preserved' | 'blocked' | 'review';

export const CARRY_FORWARD_REASON_META: Record<CarryForwardReason, { label: string; description: string; tone: ReasonTone }> = {
	EXACT_CARRY: { label: 'Carry forward', description: 'Empty target pair; qualified owner; within the hard cap.', tone: 'carry' },
	ALREADY_OCCUPIED: { label: 'Already occupied', description: 'The target pair already has an owner and is preserved.', tone: 'preserved' },
	MISSING_FACULTY: { label: 'Owner unavailable', description: 'The archived owner is no longer an active, current faculty member.', tone: 'blocked' },
	MISSING_SECTION: { label: 'Section unavailable', description: 'No current section matches grade + program + name.', tone: 'blocked' },
	NO_CURRENT_DEMAND: { label: 'No current demand', description: 'Reference-only, inactive, or obsolete demand.', tone: 'blocked' },
	UNQUALIFIED: { label: 'Not qualified', description: 'The owner is not qualified under current authority.', tone: 'blocked' },
	CAP_BLOCKED: { label: 'Over hard cap', description: 'Carrying would exceed the current hard cap on teaching minutes.', tone: 'blocked' },
	AMBIGUOUS: { label: 'Ambiguous match', description: 'A duplicate canonical section or source pair must be resolved first.', tone: 'review' },
	OTHER: { label: 'Other', description: 'The row could not be classified automatically.', tone: 'review' },
};

export interface CarryForwardSummary {
	sourceYearLabel: string;
	targetYearLabel: string;
	sourceRows: number;
	carried: number;
	skipped: number;
	headline: string;
	tone: 'empty' | 'ready' | 'preserved';
}

function count(rows: CarryForwardRow[], reason: CarryForwardReason): number {
	return rows.filter((row) => row.reason === reason).length;
}

export function summarizeCarryForwardPreview(preview: Pick<CarryForwardPreview, 'sourceYear' | 'targetYear' | 'totals' | 'totalsSummary'>): CarryForwardSummary {
	const { sourceYear, targetYear, totalsSummary } = preview;
	const tone: CarryForwardSummary['tone'] = totalsSummary.sourceRows === 0
		? 'empty'
		: totalsSummary.carried === 0
		? 'preserved'
		: 'ready';
	const headline = totalsSummary.sourceRows === 0
		? `No archived Teaching Load rows were found in ${sourceYear.yearLabel}.`
		: totalsSummary.carried === 0
		? `No compatible rows can be carried from ${sourceYear.yearLabel}; every archived row is preserved, occupied, or blocked.`
		: `${totalsSummary.carried} of ${totalsSummary.sourceRows} archived rows can be carried from ${sourceYear.yearLabel} into empty pairs in ${targetYear.yearLabel}.`;
	return {
		sourceYearLabel: sourceYear.yearLabel,
		targetYearLabel: targetYear.yearLabel,
		sourceRows: totalsSummary.sourceRows,
		carried: totalsSummary.carried,
		skipped: totalsSummary.skipped,
		headline,
		tone,
	};
}

export function carryForwardReasonCounts(preview: Pick<CarryForwardPreview, 'totals'>): Array<{ reason: CarryForwardReason; count: number; meta: (typeof CARRY_FORWARD_REASON_META)[CarryForwardReason] }> {
	return (Object.keys(CARRY_FORWARD_REASON_META) as CarryForwardReason[])
		.map((reason) => ({ reason, count: preview.totals[reason] ?? 0, meta: CARRY_FORWARD_REASON_META[reason] }))
		.filter((entry) => entry.count > 0);
}

/**
 * The apply path is deliberately unreachable from the client in this stream:
 * it requires the separately gated, privileged runtime and explicit approval.
 */
export const CARRY_FORWARD_APPLY_BLOCKED_MESSAGE =
	'Apply is not available here. “Start from last year” always previews first, and any carry-forward apply requires a separate explicit approval plus the deployed runtime confirmation.';

export function carryForwardApplyBlockedReason(): string {
	return CARRY_FORWARD_APPLY_BLOCKED_MESSAGE;
}

export function carryForwardPreviewRequest(schoolId: number, targetSchoolYearId: number, sourceSchoolYearId: number) {
	return { schoolId, targetSchoolYearId, sourceSchoolYearId };
}

export function formatCarryForwardError(error: unknown): string {
	if (error && typeof error === 'object') {
		const maybe = error as { response?: { data?: { message?: string; actionHint?: string } }; message?: string };
		return maybe.response?.data?.actionHint
			?? maybe.response?.data?.message
			?? maybe.message
			?? 'ATLAS could not prepare the carry-forward preview.';
	}
	return 'ATLAS could not prepare the carry-forward preview.';
}

export function groupCarryForwardRowsByReason(rows: CarryForwardRow[]): Array<{ reason: CarryForwardReason; rows: CarryForwardRow[] }> {
	const order = Object.keys(CARRY_FORWARD_REASON_META) as CarryForwardReason[];
	const groups = new Map<CarryForwardReason, CarryForwardRow[]>();
	for (const row of rows) {
		const list = groups.get(row.reason) ?? [];
		list.push(row);
		groups.set(row.reason, list);
	}
	return order
		.filter((reason) => (groups.get(reason)?.length ?? 0) > 0)
		.map((reason) => ({ reason, rows: [...(groups.get(reason) ?? [])].sort((a, b) => (a.targetSectionKey ?? '').localeCompare(b.targetSectionKey ?? '') || (a.targetSubjectCode ?? a.sourceSubjectCode ?? '').localeCompare(b.targetSubjectCode ?? b.sourceSubjectCode ?? '')) }));
}

export function describeCarryForwardOverload(preview: Pick<CarryForwardPreview, 'after'>): string {
	const changes = preview.after.overloadChanges.filter((change) => change.changed);
	if (changes.length === 0) return 'No faculty workload status changes under this plan.';
	return changes
		.map((change) => `${change.name}: ${change.beforeStatus} → ${change.afterStatus} (${Math.round(change.beforeMinutes / 60)}h → ${Math.round(change.afterMinutes / 60)}h)`)
		.join('; ');
}

export function pickDefaultSourceYear<T extends CarryForwardSourceYearOption>(years: T[]): T | null {
	if (years.length === 0) return null;
	const withLoad = years.find((year) => (year.preservedCounts?.teachingLoadOwnerships ?? 0) > 0);
	return withLoad ?? years[0];
}

/** Zero-write assertion helper for the preview contract. */
export function carryForwardPreviewIsZeroWrite(preview: Pick<CarryForwardPreview, 'zeroWriteProof' | 'authorizesMutation'>): boolean {
	return preview.zeroWriteProof.preview === true && preview.zeroWriteProof.writes === 0 && preview.authorizesMutation === false;
}
