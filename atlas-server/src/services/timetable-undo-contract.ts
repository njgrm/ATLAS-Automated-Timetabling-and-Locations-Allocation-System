export type UndoHeadInput = {
	requestedOperationId: number;
	expectedVersion: number;
	currentVersion: number;
	headOperationId: number | null;
	requestingActorId: number;
	operationActorId: number | null;
	alreadyReverted: boolean;
};

export class UndoConflictError extends Error {
	readonly statusCode = 409;
	readonly code = 'UNDO_CONFLICT';

	constructor() {
		super('Schedule changed—review latest');
	}
}

export function assertUndoHead(input: UndoHeadInput): void {
	if (
		input.requestedOperationId !== input.headOperationId
		|| input.expectedVersion !== input.currentVersion
		|| input.requestingActorId !== input.operationActorId
		|| input.alreadyReverted
	) {
		throw new UndoConflictError();
	}
}

export type DraftUndoStrategy = 'archive-created' | 'restore-before' | 'restore-pair' | 'restore-list' | 'restore-removed' | 'restore-replaced';

export function getDraftUndoStrategy(actionType: string): DraftUndoStrategy {
	switch (actionType) {
		case 'CREATE': return 'archive-created';
		case 'UPDATE': return 'restore-before';
		case 'SWAP': return 'restore-pair';
		case 'CLEAR_DRAFT': return 'restore-list';
		case 'REMOVE': return 'restore-removed';
		case 'REPLACE': return 'restore-replaced';
		default: throw new Error(`Unsupported draft operation: ${actionType}`);
	}
}
