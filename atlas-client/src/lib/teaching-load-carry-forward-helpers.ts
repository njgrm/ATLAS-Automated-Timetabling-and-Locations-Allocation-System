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
	EXACT_CARRY: { label: 'Would be copied', description: 'The slot is empty, the teacher is qualified, and the hours are within the limit.', tone: 'carry' },
	ALREADY_OCCUPIED: { label: 'Already filled', description: 'That teacher + subject already has an owner, so it is kept as it is.', tone: 'preserved' },
	MISSING_FACULTY: { label: 'Teacher not available', description: 'The teacher from last year is no longer on the faculty.', tone: 'blocked' },
	MISSING_SECTION: { label: 'Section not available', description: 'No section this year matches that grade, program, and name.', tone: 'blocked' },
	NO_CURRENT_DEMAND: { label: 'Not needed this year', description: 'The subject is not taught this year any more.', tone: 'blocked' },
	UNQUALIFIED: { label: 'Not qualified', description: 'The teacher is not qualified to teach that subject this year.', tone: 'blocked' },
	CAP_BLOCKED: { label: 'Over the teaching limit', description: 'Copying this would give the teacher more hours than the limit allows.', tone: 'blocked' },
	AMBIGUOUS: { label: 'Needs a person to check', description: 'Two sections or assignments look the same, so someone must choose.', tone: 'review' },
	OTHER: { label: 'Other', description: 'This assignment could not be sorted automatically.', tone: 'review' },
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
		? `No teacher assignments were found in ${sourceYear.yearLabel}.`
		: totalsSummary.carried === 0
		? `Nothing from ${sourceYear.yearLabel} can be copied; every assignment there is already filled, already kept, or cannot be used.`
		: `${totalsSummary.carried} of ${totalsSummary.sourceRows} teacher assignments from ${sourceYear.yearLabel} would be copied into ${targetYear.yearLabel}.`;
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
	'Nothing is copied here. “Start from last year” only shows you what would be copied, and copying it for real needs a separate explicit approval afterwards.';

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
			?? 'ATLAS could not show what would be copied.';
	}
	return 'ATLAS could not show what would be copied.';
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
