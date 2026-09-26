import type { DraftReport, UnassignedItem, UnassignedReason, Violation } from '@/types';
import { UNLABELLED_RULE_SENTENCE } from '@/lib/timetable-plain-language';

export type BlockerReason =
	| 'FACULTY_OVERLOADED'
	| 'NO_AVAILABLE_SLOT'
	| 'NO_QUALIFIED_FACULTY'
	| 'NO_COMPATIBLE_ROOM'
	| 'ROOM_CAPACITY_EXCEEDED'
	| 'UNASSIGNED_SECTION'
	| 'UNKNOWN';

/**
 * Run-wide publication authority (C07B/B1).
 *
 * Publication is always decided run-wide. These values come from the
 * server-owned run-wide counts (`ViolationReport.counts.runWide.blockingHard`
 * and the run's unassigned requirement). The selected-term violation list is
 * only supporting detail and never decides the gate on its own.
 */
export type RunWidePublishAuthority = {
	/** Server-owned run-wide HARD count filtered by the publication allowlist. */
	blockingHardCount?: number | null;
	/** Server-owned run-wide unassigned/unresolved requirement. */
	unassignedCount?: number | null;
	/** Server-owned run-wide SOFT count. */
	softCount?: number | null;
};

export type BlockerGroupScope = 'run-wide' | 'selected-term';

export type BlockerGroup = {
	reason: string;
	plainLabel: string;
	count: number;
	actionLabel: string;
	actionHref: string;
	/** Whether this group was derived from run-wide truth or the selected term. */
	scope: BlockerGroupScope;
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

export type WarningItem = {
	sectionLabel: string;
	subjectLabel: string;
	facultyLabel: string;
};

export type WarningGroup = {
	code: string;
	plainLabel: string;
	count: number;
	/**
	 * Every selected-term entry that produced `count` (C07B/F3). The aggregate
	 * warning row expands into these entries so an operator sees exactly which
	 * sessions are affected instead of a bare label + number.
	 */
	items: WarningItem[];
};

export type SimplePublishReadiness = {
	/** Unresolved-queue sessions that must be placed before publication. */
	totalUnresolved: number;
	/**
	 * Publication-blocking HARD violations only (C07B/R2). Threaded from the same
	 * hard-violation authority as `runWideBlockingHard`; an unresolved reason
	 * group is never folded in here.
	 */
	totalHardBlockers: number;
	totalSoftWarnings: number;
	blockerGroups: BlockerGroup[];
	warningGroups: WarningGroup[];
	/**
	 * Truthful one-line reason the schedule cannot be published yet (C07B/F1/R2).
	 * The hard clause is driven ONLY by the hard-violation authority and the
	 * unresolved clause ONLY by the unresolved-queue authority, so a hard-only
	 * block never claims that zero sessions need fixing and an unresolved-only
	 * block never invents a hard blocker.
	 */
	blockerSentence: string;
	summaryText: string;
	hasBlockers: boolean;
	hasWarnings: boolean;
	isClean: boolean;
	/** False when no generated run exists. A missing run is never clean and
	 * never publishable: readiness evidence alone cannot publish. */
	hasGeneratedRun: boolean;
	/** Run-wide allowlist-filtered HARD count that actually gates publication. */
	runWideBlockingHard: number;
	/** Run-wide unresolved/unassigned requirement. */
	runWideUnassigned: number;
	/** Run-wide SOFT count requiring acknowledgement. */
	runWideSoft: number;
	/** Sum of the listed per-code selected-term warning counts (C07B/F3). */
	selectedTermWarningCount: number;
	/** Selected-term violation count shown as supporting detail. */
	selectedTermViolationCount: number;
	/** Selected-term allowlist-filtered HARD count shown as supporting detail. */
	selectedTermBlockingHard: number;
	/** True when at least one blocker group came from the selected-term list. */
	hasSelectedTermBlockers: boolean;
};

type BlockerConfig = {
	plainLabel: string;
	actionLabel: string;
	actionHref: string;
	nextStep: string;
};

/** Unassigned reason keys that actually occur on the wire. */
const REASON_GROUPS: Record<string, BlockerConfig> = {
	FACULTY_OVERLOADED: {
		plainLabel: 'Teachers are overloaded',
		actionLabel: 'Open Teaching Load',
		actionHref: '/teaching-load',
		nextStep: 'Teacher workload is full. Move some classes or assign another teacher.',
	},
	NO_AVAILABLE_SLOT: {
		plainLabel: 'No allowed time slot was found',
		actionLabel: 'Place manually',
		actionHref: '/timetable',
		nextStep: 'No allowed time slot was found. Try manual placement or review the scheduling policy.',
	},
	NO_QUALIFIED_FACULTY: {
		plainLabel: 'No qualified teacher is assigned',
		actionLabel: 'Open Teaching Load',
		actionHref: '/teaching-load',
		nextStep: 'No qualified teacher is assigned. Build or repair Teaching Load.',
	},
	NO_COMPATIBLE_ROOM: {
		plainLabel: 'No compatible room was found',
		actionLabel: 'Review rooms',
		actionHref: '/map',
		nextStep: 'No compatible room was found. Review room setup.',
	},
	ROOM_CAPACITY_EXCEEDED: {
		plainLabel: 'Room capacity is too small',
		actionLabel: 'Review rooms',
		actionHref: '/map',
		nextStep: 'The room is too small for this class. Choose a larger room.',
	},
	UNASSIGNED_SECTION: {
		plainLabel: 'This class was not placed',
		actionLabel: 'Place this session',
		actionHref: '/timetable',
		nextStep: 'This class was not placed. Review the unresolved reason.',
	},
};

/**
 * Real production HARD violation codes that can block publication (C07B/B3/B6).
 * Every entry routes to a real, mounted destination; the header dispatcher
 * resolves the exact entity/term. Codes absent here fall back to the selected
 * violation in the review rail, never to a no-op button.
 */
const VIOLATION_GROUPS: Record<string, BlockerConfig> = {
	FACULTY_TIME_CONFLICT: {
		plainLabel: 'Teacher double-booked',
		actionLabel: 'Open in review',
		actionHref: '/timetable',
		nextStep: 'This teacher is booked in two classes at once. Move one class to another slot.',
	},
	ROOM_TIME_CONFLICT: {
		plainLabel: 'Room double-booked',
		actionLabel: 'Open in review',
		actionHref: '/timetable',
		nextStep: 'Two classes share this room at the same time. Move one to a different slot or room.',
	},
	SECTION_TIME_CONFLICT: {
		plainLabel: 'Section double-booked',
		actionLabel: 'Open in review',
		actionHref: '/timetable',
		nextStep: 'This section has overlapping classes. Move one class so students are not double-booked.',
	},
	FACULTY_OVERLOAD: {
		plainLabel: 'Teacher overloaded',
		actionLabel: 'Open Teaching Load',
		actionHref: '/teaching-load',
		nextStep: 'This teacher exceeds their weekly maximum. Reassign some classes.',
	},
	FACULTY_SUBJECT_NOT_QUALIFIED: {
		plainLabel: 'Teacher not qualified for subject',
		actionLabel: 'Open Teaching Load',
		actionHref: '/teaching-load',
		nextStep: 'This teaching-load assignment does not cover the subject. Repair Teaching Load.',
	},
	LACKING_FACULTY: {
		plainLabel: 'Missing faculty coverage',
		actionLabel: 'Open Teaching Load',
		actionHref: '/teaching-load',
		nextStep: 'No teacher covers this subject/grade. Assign a qualified teacher.',
	},
	INCOMPLETE_MODULAR_GROUP: {
		plainLabel: 'Incomplete modular group',
		actionLabel: 'Open in review',
		actionHref: '/timetable',
		nextStep: 'A modular group is missing sessions. Complete the group before publishing.',
	},
	ROOM_TYPE_MISMATCH: {
		plainLabel: 'Room type mismatch',
		actionLabel: 'Review rooms',
		actionHref: '/map',
		nextStep: 'The subject needs a specific room type. Move it or update the room.',
	},
	ROOM_FEATURE_MISMATCH: {
		plainLabel: 'Room missing a required feature',
		actionLabel: 'Review rooms',
		actionHref: '/map',
		nextStep: 'The assigned room lacks a required feature. Move the class or update the room.',
	},
	FACULTY_DAILY_MAX_EXCEEDED: {
		plainLabel: 'Daily maximum exceeded',
		actionLabel: 'Open Teaching Load',
		actionHref: '/teaching-load',
		nextStep: 'This teacher exceeds the daily maximum. Move a class to another day.',
	},
};

const BLOCKER_CONFIG: Record<string, BlockerConfig> = {
	...REASON_GROUPS,
	...VIOLATION_GROUPS,
};

const DEFAULT_BLOCKER_CONFIG: BlockerConfig = {
	plainLabel: 'Needs review',
	actionLabel: 'Open in review',
	actionHref: '/timetable',
	nextStep: 'Open the review rail and resolve this issue before publishing.',
};

/**
 * J2 (P5): a warning group whose code has no label used to be de-snake-cased
 * into "faculty excessive idle gap" — not English, and it reads to a scheduler
 * like a typo they caused. It now degrades to the one shared plain sentence.
 * The grouping, the counts, the sort order and every downstream consumer of
 * `plainLabel` (the sheet, the C1 blocker banner, the generation blocker sheet,
 * the pasted report and the CSV) are untouched: only the wording changes.
 */
function unlabelledWarningLabel(): string {
	return UNLABELLED_RULE_SENTENCE;
}

/**
 * Warning labels for SOFT codes and legacy informational HARD codes.
 *
 * The retired travel metric is deliberately absent (C07B/B7): it has no
 * producer. A legacy persisted travel warning still renders through the
 * humanised code fallback rather than pretending to be a live family.
 * ZONE-WARNING-REMOVAL-C01: the retired zone warning is likewise absent — it
 * has no producer, and a stored row renders through the same fallback.
 */
const VIOLATION_WARNING_LABELS: Record<string, string> = {
	FACULTY_TIME_CONFLICT: 'Teacher time conflict',
	ROOM_TIME_CONFLICT: 'Room time conflict',
	SECTION_TIME_CONFLICT: 'Section time conflict',
	FACULTY_OVERLOAD: 'Teacher overload warning',
	ROOM_TYPE_MISMATCH: 'Room type mismatch',
	ROOM_FEATURE_MISMATCH: 'Room missing required feature',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Teacher not qualified for subject',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Too many consecutive periods',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break requirement violated',
	FACULTY_DAILY_STANDARD_EXCEEDED: 'Daily standard hours exceeded',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily max hours exceeded',
	FACULTY_FLOOR_TRANSITION: 'Long cross-floor transition within a building',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Too many building transitions',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Insufficient transition time between periods',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Long teacher idle gap',
	FACULTY_EARLY_START_PREFERENCE: 'Early start time preference',
	FACULTY_LATE_END_PREFERENCE: 'Late end time preference',
	FACULTY_INSUFFICIENT_DAILY_VACANT: 'Insufficient daily vacant time',
	/**
	 * LANE-A-VIOLATION-LABEL-GUARD. This map is the Publish Readiness surface's
	 * OWN label set and it is consulted before the honest unlabelled sentence
	 * (`VIOLATION_WARNING_LABELS[code] ?? unlabelledWarningLabel()`), so a code
	 * missing here is a code the operator is told ATLAS "does not have a name
	 * for yet" — while the Review-issues rail, three clicks away, printed the raw
	 * engine code for the very same rule. Adding the entry to
	 * `VIOLATION_PRESENTATION` alone would have left this surface still calling
	 * a named rule unnamed.
	 *
	 * The register is this map's own terse noun-phrase style, not the longer
	 * `VIOLATION_PRESENTATION` sentence, so the two surfaces stay internally
	 * consistent. The meaning is identical and is the server's: the teacher has
	 * no free block across the lunch window of the grade band they teach.
	 */
	FACULTY_LUNCH_WINDOW_VIOLATION: 'Teacher has no free lunch window',
	SPECIALIZED_ROOM_UNAVAILABLE: 'Specialized room unavailable',
	SECTION_OVERCOMPRESSED: 'Section overcompressed',
	LACKING_FACULTY: 'Missing faculty coverage',
	INCOMPLETE_MODULAR_GROUP: 'Incomplete modular group',
};

function gradeLabel(gradeLevel: number): string {
	return `GR${gradeLevel}`;
}

/**
 * Mirror of the server-owned promotable allowlist (R4/F2). Only these HARD codes
 * may block publication; any other HARD severity (e.g. the retired travel
 * metric persisted on a legacy run) is informational.
 *
 * Kept byte-equal to `PROMOTABLE_CONSTRAINT_CODES` in
 * `atlas-server/src/services/scheduling-policy.service.ts`; the drift test
 * `tt-source-freshness-client-c04.test.ts` fails on any divergence.
 */
const PUBLICATION_BLOCKING_CODES: ReadonlySet<string> = new Set([
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
	'SECTION_TIME_CONFLICT',
	'FACULTY_OVERLOAD',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
	'UNASSIGNED_SECTION',
	'LACKING_FACULTY',
	'INCOMPLETE_MODULAR_GROUP',
	'ROOM_TYPE_MISMATCH',
	'ROOM_FEATURE_MISMATCH',
	'FACULTY_DAILY_MAX_EXCEEDED',
]);

export function isBlockingHardViolation(violation: Violation): boolean {
	return violation.severity === 'HARD' && PUBLICATION_BLOCKING_CODES.has(violation.code);
}

export function isInformationalHardViolation(violation: Violation): boolean {
	return violation.severity === 'HARD' && !PUBLICATION_BLOCKING_CODES.has(violation.code);
}

/**
 * Code-level mirror of the server promotable allowlist (C07B/B4). The policy
 * pane must only offer "Treat as Hard" for codes the server will accept.
 */
export function isPublicationBlockingCode(code: string): boolean {
	return PUBLICATION_BLOCKING_CODES.has(code);
}

/* ─── Blocker destination routing (C07B/B3) ───
 * Single source of truth for where a publish blocker can be repaired. Every
 * rendered blocker action resolves through this function, so a displayed
 * control can never be a no-op "Review issue" button. */

export type BlockerDestinationKind = 'teaching-load' | 'rooms' | 'placement' | 'review';

export type BlockerDestination = {
	kind: BlockerDestinationKind;
	/** Mounted route for navigate-based destinations; null for in-page surfaces. */
	href: string | null;
	/** For 'review': the violation code to select; null selects the generic rail. */
	code: string | null;
	/** For 'placement': the unresolved reason to filter. */
	reason: string | null;
};

const TEACHING_LOAD_BLOCKER_REASONS: ReadonlySet<string> = new Set([
	'FACULTY_OVERLOADED',
	'NO_QUALIFIED_FACULTY',
	'FACULTY_OVERLOAD',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
	'LACKING_FACULTY',
	'FACULTY_DAILY_MAX_EXCEEDED',
]);

const ROOM_BLOCKER_REASONS: ReadonlySet<string> = new Set([
	'NO_COMPATIBLE_ROOM',
	'ROOM_CAPACITY_EXCEEDED',
	'ROOM_TYPE_MISMATCH',
	'ROOM_FEATURE_MISMATCH',
	'SPECIALIZED_ROOM_UNAVAILABLE',
]);

const PLACEMENT_BLOCKER_REASONS: ReadonlySet<string> = new Set([
	'NO_AVAILABLE_SLOT',
	'UNASSIGNED_SECTION',
]);

export function resolveBlockerDestination(reason: string | null | undefined, href?: string | null): BlockerDestination {
	if (reason && TEACHING_LOAD_BLOCKER_REASONS.has(reason)) {
		return { kind: 'teaching-load', href: '/teaching-load', code: null, reason: null };
	}
	if (reason && ROOM_BLOCKER_REASONS.has(reason)) {
		return { kind: 'rooms', href: '/map', code: null, reason: null };
	}
	if (reason && PLACEMENT_BLOCKER_REASONS.has(reason)) {
		return { kind: 'placement', href: '/timetable', code: null, reason };
	}
	// Conflict/structural codes are repaired wherever the exact violation is
	// selected in the review rail. This stays a real destination: the rail opens
	// on the hard-severity filter and selects the matching violation.
	return { kind: 'review', href: href ?? null, code: reason ?? null, reason: null };
}

/**
 * C07B/F5 — the unassigned-reason filter a placement blocker must apply.
 *
 * The unresolved queue is filtered by the item-level reason
 * (`UnassignedItem.reason`), whose real wire union is
 * `NO_QUALIFIED_FACULTY | FACULTY_OVERLOADED | NO_AVAILABLE_SLOT |
 * NO_COMPATIBLE_ROOM | ROOM_CAPACITY_EXCEEDED` (see
 * `schedule-constructor.ts` / `timetable-sync-setup.service.ts`). The hardcoded
 * `NO_AVAILABLE_SLOT` default was wrong twice over: it hid unplaced sessions
 * whose real reason differs, and `UNASSIGNED_SECTION` is a *violation code*, never
 * an item reason, so filtering the queue by it would render zero rows and hide
 * exactly the sessions the operator was sent to fix.
 *
 * Honor the destination reason whenever the queue can actually be filtered by it;
 * a placement blocker whose reason carries no item-level authority keeps the full
 * unresolved queue instead of narrowing it incorrectly.
 */
const FILTERABLE_UNASSIGNED_REASONS: ReadonlySet<string> = new Set<string>([
	'NO_QUALIFIED_FACULTY',
	'FACULTY_OVERLOADED',
	'NO_AVAILABLE_SLOT',
	'NO_COMPATIBLE_ROOM',
]);

export function resolvePlacementReasonFilter(destination: BlockerDestination): 'all' | UnassignedReason {
	const reason = destination.reason;
	return reason != null && FILTERABLE_UNASSIGNED_REASONS.has(reason) ? (reason as UnassignedReason) : 'all';
}

function resolveReason(item: UnassignedItem): string {
	if (item.reason && item.reason in REASON_GROUPS) {
		return item.reason;
	}
	if (item.reason && item.reason in BLOCKER_CONFIG) {
		return item.reason;
	}
	return 'UNKNOWN';
}

function buildItemsFromUnassigned(
	unassignedItems: UnassignedItem[],
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
	facultyLabel: (id: number) => string,
): Map<string, BlockerItem[]> {
	const groups = new Map<string, BlockerItem[]>();

	for (const item of unassignedItems) {
		const reason = resolveReason(item);
		if (!groups.has(reason)) {
			groups.set(reason, []);
		}
		const config = BLOCKER_CONFIG[reason] ?? DEFAULT_BLOCKER_CONFIG;
		groups.get(reason)!.push({
			sectionLabel: sectionLabel(item.sectionId),
			subjectLabel: subjectLabel(item.subjectId),
			gradeLabel: gradeLabel(item.gradeLevel),
			sessionNumber: item.session,
			facultyLabel: item.facultyId != null ? facultyLabel(item.facultyId) : 'No teacher assigned',
			reason: item.reason,
			plainReason: config.plainLabel,
			nextStep: config.nextStep,
		});
	}

	return groups;
}

function buildItemsFromResourceDiagnostics(
	draft: DraftReport,
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
): Map<string, BlockerItem[]> {
	const groups = new Map<string, BlockerItem[]>();
	const diagnostics = draft.summary?.resourceDiagnostics?.unassignedBySubjectGrade;
	if (!diagnostics) return groups;

	for (const entry of diagnostics) {
		for (const [reasonCode, count] of Object.entries(entry.reasons)) {
			const reason = reasonCode in BLOCKER_CONFIG ? reasonCode : 'UNKNOWN';
			if (!groups.has(reason)) {
				groups.set(reason, []);
			}
			const config = BLOCKER_CONFIG[reason] ?? DEFAULT_BLOCKER_CONFIG;
			const existing = groups.get(reason)!;
			for (let i = 0; i < count; i++) {
				existing.push({
					sectionLabel: `${gradeLabel(entry.gradeLevel)} section`,
					subjectLabel: entry.subjectCode || subjectLabel(entry.subjectId),
					gradeLabel: gradeLabel(entry.gradeLevel),
					sessionNumber: i + 1,
					facultyLabel: 'No teacher assigned',
					reason: reasonCode,
					plainReason: config.plainLabel,
					nextStep: config.nextStep,
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
): Map<string, BlockerItem[]> {
	const groups = new Map<string, BlockerItem[]>();
	const hardViolations = violations.filter(isBlockingHardViolation);

	for (const v of hardViolations) {
		const reason = v.code;
		if (!groups.has(reason)) {
			groups.set(reason, []);
		}
		const config = BLOCKER_CONFIG[reason] ?? DEFAULT_BLOCKER_CONFIG;
		groups.get(reason)!.push({
			sectionLabel: v.entities.sectionId != null ? sectionLabel(v.entities.sectionId) : 'Unknown section',
			subjectLabel: v.entities.subjectId != null ? subjectLabel(v.entities.subjectId) : 'Unknown subject',
			gradeLabel: '—',
			sessionNumber: 0,
			facultyLabel: v.entities.facultyId != null ? facultyLabel(v.entities.facultyId) : 'No teacher assigned',
			reason: v.code,
			plainReason: config.plainLabel,
			nextStep: config.nextStep,
		});
	}

	return groups;
}

function buildWarningGroups(
	violations: Violation[],
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
	facultyLabel: (id: number) => string,
): WarningGroup[] {
	// Soft warnings plus informational (non-allowlisted) HARD severities: both are
	// reviewable but neither blocks publication.
	const warningViolations = violations.filter((v) => v.severity === 'SOFT' || isInformationalHardViolation(v));
	const groups = new Map<string, WarningItem[]>();

	for (const v of warningViolations) {
		const items = groups.get(v.code) ?? [];
		items.push({
			sectionLabel: v.entities.sectionId != null ? sectionLabel(v.entities.sectionId) : 'Unknown section',
			subjectLabel: v.entities.subjectId != null ? subjectLabel(v.entities.subjectId) : 'Unknown subject',
			facultyLabel: v.entities.facultyId != null ? facultyLabel(v.entities.facultyId) : 'No teacher assigned',
		});
		groups.set(v.code, items);
	}

	return Array.from(groups.entries())
		.map(([code, items]) => ({
			code,
			plainLabel: VIOLATION_WARNING_LABELS[code] ?? unlabelledWarningLabel(),
			count: items.length,
			items,
		}))
		.sort((a, b) => b.count - a.count);
}

function summaryField(summary: unknown, key: string): number | null {
	if (!summary || typeof summary !== 'object') return null;
	const value = (summary as Record<string, unknown>)[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function deriveSimplePublishReadiness(
	draft: DraftReport | null,
	violations: Violation[],
	sectionLabel: (id: number) => string,
	subjectLabel: (id: number) => string,
	facultyLabel: (id: number) => string,
	runWide?: RunWidePublishAuthority | null,
): SimplePublishReadiness {
	const unassignedItems = draft?.unassignedItems ?? [];
	const summary = draft?.summary ?? null;

	let itemGroups: Map<string, BlockerItem[]>;
	let groupScope: BlockerGroupScope;
	if (unassignedItems.length > 0) {
		itemGroups = buildItemsFromUnassigned(unassignedItems, sectionLabel, subjectLabel, facultyLabel);
		groupScope = 'run-wide';
	} else {
		const diagnosticsGroups = draft ? buildItemsFromResourceDiagnostics(draft, sectionLabel, subjectLabel) : new Map<string, BlockerItem[]>();
		if (diagnosticsGroups.size > 0) {
			itemGroups = diagnosticsGroups;
			groupScope = 'run-wide';
		} else {
			itemGroups = buildItemsFromViolations(violations, sectionLabel, subjectLabel, facultyLabel);
			groupScope = 'selected-term';
		}
	}

	const blockerGroups: BlockerGroup[] = Array.from(itemGroups.entries())
		.map(([reason, items]) => {
			const config = BLOCKER_CONFIG[reason] ?? DEFAULT_BLOCKER_CONFIG;
			return {
				reason,
				plainLabel: config.plainLabel,
				count: items.length,
				actionLabel: config.actionLabel,
				actionHref: config.actionHref,
				scope: groupScope,
				items,
			};
		})
		.sort((a, b) => b.count - a.count);

	// `blockerGroups` is a RENDERING list. It deliberately carries both publish
	// authorities (hard violations and the unresolved queue) so the operator sees
	// every session to fix in one place, which is exactly why its raw sum is an
	// invalid gate count. Split it back into its sources before counting.
	const unresolvedGroupCount = blockerGroups
		.filter((group) => group.scope === 'run-wide')
		.reduce((sum, group) => sum + group.count, 0);
	const warningGroups = buildWarningGroups(violations, sectionLabel, subjectLabel, facultyLabel);
	const selectedTermWarningCount = warningGroups.reduce((sum, g) => sum + g.count, 0);

	/** Allowlist-filtered HARD violations in the selected-term list. */
	const selectedTermBlockingHard = violations.filter(isBlockingHardViolation).length;

	// Run-wide authority. `counts.runWide.blockingHard` is the canonical gate;
	// the persisted run summary is the next authority; the allowlist-filtered
	// selected-term list is a fail-closed fallback for drafts without a summary.
	const runWideBlockingHard = runWide?.blockingHardCount
		?? summaryField(summary, 'blockingHardViolationCount')
		?? (draft != null ? selectedTermBlockingHard : 0);
	const runWideUnassigned = runWide?.unassignedCount
		?? summaryField(summary, 'unassignedCount')
		?? (draft != null ? unresolvedGroupCount : 0);
	const runWideSoft = runWide?.softCount
		?? summaryField(summary, 'softViolationCount')
		?? (draft != null ? selectedTermWarningCount : 0);

	// C07B/R2 — sentence authority contract. The rendered sentence and
	// `summaryText` bind TWO INDEPENDENT authorities that must never be merged:
	//   1. the hard-violation authority — the run-wide HARD gate plus the
	//      HARD-severity selected-term violation groups; and
	//   2. the unresolved-queue authority — the unresolved reason groups and the
	//      run-wide unresolved requirement.
	// The candidate folded (2) into (1) via `Math.max(groupBlockerCount, …)`, so
	// two SOFT-reason unresolved sessions (`blockingHard = 0`, `unassignedCount =
	// 2`) rendered as "2 hard blockers" beside a panel reporting 0 run-wide
	// blocking hard, and the same sessions were counted twice. A blocker group is
	// a hard blocker only when it was derived from a HARD violation; an unresolved
	// group is never added to the hard count, and the unresolved clause is the only
	// place it appears.
	const totalHardBlockers = Math.max(selectedTermBlockingHard, runWideBlockingHard);
	const totalUnresolved = Math.max(unassignedItems.length, runWideUnassigned);
	const totalSoftWarnings = Math.max(selectedTermWarningCount, runWideSoft);
	// The run-wide gate blocks on either a publication-blocking HARD violation or
	// an unresolved/unassigned session requirement.
	const hasBlockers = totalHardBlockers > 0 || totalUnresolved > 0;

	// C07B/F1 — the blocked message is driven by the blocker/unresolved PAIR. The
	// candidate previously derived it from `totalUnresolved` alone, so a
	// hard-blocker-only block rendered "0 sessions still need fixing" while also
	// listing affected sessions.
	const blockerClauses: string[] = [];
	if (totalHardBlockers > 0) {
		blockerClauses.push(`${totalHardBlockers} hard blocker${totalHardBlockers === 1 ? '' : 's'}`);
	}
	if (totalUnresolved > 0) {
		blockerClauses.push(`${totalUnresolved} unresolved session${totalUnresolved === 1 ? '' : 's'}`);
	}
	const blockerSentence = blockerClauses.length === 0
		? ''
		: `${blockerClauses.join(' and ')} ${totalHardBlockers + totalUnresolved === 1 ? 'still needs fixing' : 'still need fixing'} before this schedule can be published.`;

	let summaryText: string;
	if (!draft) {
		summaryText = `No timetable generated yet\nGenerate a timetable before reviewing publish readiness. Preview and readiness checks alone cannot be published.`;
	} else if (hasBlockers) {
		summaryText = `Cannot publish yet\n${blockerSentence}\nFix blockers first. Warnings can be reviewed after blockers are clear.`;
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
		blockerSentence,
		summaryText,
		hasBlockers,
		hasWarnings: totalSoftWarnings > 0,
		isClean: draft != null && !hasBlockers && totalSoftWarnings === 0,
		hasGeneratedRun: draft != null,
		runWideBlockingHard,
		runWideUnassigned,
		runWideSoft,
		selectedTermWarningCount,
		selectedTermViolationCount: violations.length,
		selectedTermBlockingHard,
		hasSelectedTermBlockers: blockerGroups.some((group) => group.scope === 'selected-term'),
	};
}
