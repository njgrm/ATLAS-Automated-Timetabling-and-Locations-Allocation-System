import type { ScheduledEntry } from './constraint-validator.js';
import type { UnassignedItem } from './schedule-constructor.js';

export type ReconciliationSourceDomain = 'TEACHING_LOAD' | 'SUBJECT' | 'SECTION' | 'ROOM' | 'TIME_WINDOW' | 'POLICY';

export type ReconciliationOutcome =
	| 'kept'
	| 'updated-in-place'
	| 'returned-to-unassigned'
	| 'removed'
	| 'added'
	| 'warning-only';

export type ReconciliationEntryClassification = {
	entryId: string;
	outcome: ReconciliationOutcome;
	domain: ReconciliationSourceDomain;
	reason: string;
};

export type ReconciliationSummary = {
	keptCount: number;
	updatedCount: number;
	displacedCount: number;
	addedCount: number;
	removedCount: number;
	warningOnlyCount: number;
	classifications: ReconciliationEntryClassification[];
};

export type ReconciliationClassificationInput = {
	entries: ScheduledEntry[];
	unassigned: UnassignedItem[];
	changedDomains: ReconciliationSourceDomain[];
	ownershipByEntryId: Record<string, number | null>;
	roomStillEligible: (entry: ScheduledEntry) => boolean;
	wouldViolatePolicy: (entry: ScheduledEntry) => boolean;
};

const OUTCOME_RANK: Record<ReconciliationOutcome, number> = {
	removed: 0,
	displaced: 1,
	warning: 2,
	'updated-in-place': 3,
	kept: 4,
} as unknown as Record<ReconciliationOutcome, number>;

export function classifyReconciliationEntries(input: ReconciliationClassificationInput): ReconciliationSummary {
	const classifications: ReconciliationEntryClassification[] = [];
	let keptCount = 0;
	let updatedCount = 0;
	let displacedCount = 0;
	let warningOnlyCount = 0;
	const removed = 0;
	const added = 0;

	for (const entry of input.entries) {
		const domain = firstDomainForEntry(input.changedDomains, entry);
		if (input.roomStillEligible(entry)) {
			if (input.wouldViolatePolicy(entry)) {
				classifications.push({ entryId: entry.entryId, outcome: 'returned-to-unassigned', domain, reason: 'Policy change invalidated the current slot.' });
				displacedCount += 1;
				continue;
			}
			if (domain === 'TEACHING_LOAD' || domain === 'SUBJECT' || domain === 'SECTION') {
				classifications.push({ entryId: entry.entryId, outcome: 'updated-in-place', domain, reason: `Owner or scope updated for ${domain.toLowerCase()}.` });
				updatedCount += 1;
				continue;
			}
			classifications.push({ entryId: entry.entryId, outcome: 'kept', domain, reason: 'No placement-relevant change.' });
			keptCount += 1;
			continue;
		}
		classifications.push({ entryId: entry.entryId, outcome: 'returned-to-unassigned', domain, reason: 'Room became unavailable or incompatible.' });
		displacedCount += 1;
	}

	for (const unassigned of input.unassigned) {
		// Unassigned items are already on the queue; reconciliation only flags warning-only soft deltas.
		if (input.wouldViolatePolicy(unassigned as unknown as ScheduledEntry)) {
			classifications.push({ entryId: `unassigned:${unassigned.sectionId}:${unassigned.subjectId}:${unassigned.session}`, outcome: 'warning-only', domain: 'POLICY', reason: 'New soft warning on existing unassigned session.' });
			warningOnlyCount += 1;
		}
	}

	return {
		keptCount,
		updatedCount,
		displacedCount,
		addedCount: added,
		removedCount: removed,
		warningOnlyCount,
		classifications,
	};
}

function firstDomainForEntry(domains: ReconciliationSourceDomain[], _entry: ScheduledEntry): ReconciliationSourceDomain {
	return domains[0] ?? 'POLICY';
}

// Note: OUTCOME_RANK is exposed for future strict-mode ordering; the classifier
// itself does not depend on a particular ordering today.
void OUTCOME_RANK;
