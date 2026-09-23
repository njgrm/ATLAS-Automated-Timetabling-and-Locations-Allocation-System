import type { ManualEditProposal } from './manual-edit.service.js';

export type ConcurrentManualEdit = {
	id: number;
	editType: string;
	beforePayload: unknown;
	afterPayload: unknown;
	validationSummary: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === 'object' && !Array.isArray(value)
		? value as Record<string, unknown>
		: null;
}

function placementKey(value: Record<string, unknown>): string | null {
	const { sectionId, subjectId, session } = value;
	if (![sectionId, subjectId, session].every((item) => Number.isSafeInteger(item))) return null;
	return JSON.stringify([
		value.termIndex ?? null,
		value.entryKind ?? 'SECTION',
		value.cohortCode ?? null,
		sectionId,
		subjectId,
		session,
	]);
}

function proposalKeys(proposal: ManualEditProposal): string[] | null {
	if (proposal.editType === 'PLACE_UNASSIGNED') {
		const key = placementKey(proposal as unknown as Record<string, unknown>);
		return key ? [`unassigned:${key}`] : null;
	}
	if (proposal.editType === 'MOVE_ENTRY' || proposal.editType === 'CHANGE_ROOM' || proposal.editType === 'CHANGE_FACULTY' || proposal.editType === 'CHANGE_TIMESLOT') {
		return typeof proposal.entryId === 'string' && proposal.entryId ? [`entry:${proposal.entryId}`] : null;
	}
	return null;
}

function editKeys(edit: ConcurrentManualEdit): string[] | null {
	if (!['PLACE_UNASSIGNED', 'MOVE_ENTRY', 'CHANGE_ROOM', 'CHANGE_FACULTY', 'CHANGE_TIMESLOT'].includes(edit.editType)) return null;
	const summary = record(edit.validationSummary);
	const removed = record(summary?.removedUnassignedItem);
	const keys: string[] = [];
	for (const payload of [record(edit.beforePayload), record(edit.afterPayload)]) {
		if (!payload) continue;
		if (typeof payload.entryId === 'string') keys.push(`entry:${payload.entryId}`);
		for (const entryField of ['entryIdA', 'entryIdB']) {
			if (typeof payload[entryField] === 'string') keys.push(`entry:${payload[entryField]}`);
		}
	}
	if (removed) {
		const key = placementKey(removed);
		if (key) keys.push(`unassigned:${key}`);
	}
	if (edit.editType === 'PLACE_UNASSIGNED' && !removed) return null;
	return keys.length > 0 ? keys : null;
}

function keysOverlap(left: string, right: string): boolean {
	if (left === right) return true;
	if (!left.startsWith('unassigned:') || !right.startsWith('unassigned:')) return false;
	const leftParts = JSON.parse(left.slice('unassigned:'.length)) as unknown[];
	const rightParts = JSON.parse(right.slice('unassigned:'.length)) as unknown[];
	return leftParts.slice(1).every((part, index) => part === rightParts[index + 1])
		&& (leftParts[0] == null || rightParts[0] == null || leftParts[0] === rightParts[0]);
}

/**
 * A stale edit can be replayed on the latest run only when complete edit history
 * covers every intervening run version and none of the intervening semantic
 * targets overlap. Unknown, destructive, or incomplete history fails closed.
 */
export function canRebaseManualEdits(
	proposals: ManualEditProposal[],
	interveningEdits: ConcurrentManualEdit[],
	versionsBehind: number,
): boolean {
	if (!Array.isArray(proposals) || proposals.length === 0 || !Number.isInteger(versionsBehind) || versionsBehind < 1 || versionsBehind > 10) return false;
	const proposedKeys = new Set<string>();
	for (const proposal of proposals) {
		const keys = proposalKeys(proposal);
		if (!keys) return false;
		for (const key of keys) {
			if ([...proposedKeys].some((other) => keysOverlap(key, other))) return false;
			proposedKeys.add(key);
		}
	}

	let index = 0;
	for (let version = 0; version < versionsBehind; version += 1) {
		const first = interveningEdits[index];
		if (!first) return false;
		const summary = record(first.validationSummary);
		const declaredSize = summary?.batchSize;
		const size = Number.isInteger(declaredSize) && (declaredSize as number) > 0 ? declaredSize as number : 1;
		if (size > 100 || index + size > interveningEdits.length) return false;
		const group = interveningEdits.slice(index, index + size);
		if (size > 1) {
			const indexes = new Set<number>();
			for (const edit of group) {
				const batch = record(edit.validationSummary);
				if (batch?.batchSize !== size || !Number.isInteger(batch.batchIndex)) return false;
				indexes.add(batch.batchIndex as number);
			}
			if (indexes.size !== size || Array.from({ length: size }, (_, batchIndex) => batchIndex).some((batchIndex) => !indexes.has(batchIndex))) return false;
		}
		for (const edit of group) {
			const keys = editKeys(edit);
			if (!keys || keys.some((key) => [...proposedKeys].some((proposedKey) => keysOverlap(key, proposedKey)))) return false;
		}
		index += size;
	}
	return true;
}
