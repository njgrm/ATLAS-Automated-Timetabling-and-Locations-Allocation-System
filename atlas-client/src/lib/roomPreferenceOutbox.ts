export type RoomPreferenceOutboxActionType = 'SAVE_DRAFT' | 'SUBMIT' | 'DELETE';

export type OutboxActionStatus = 'queued' | 'syncing' | 'retried' | 'failed' | 'recovered';

export type RoomPreferenceOutboxAction = {
	actionId: string;
	type: RoomPreferenceOutboxActionType;
	entryId: string;
	requestedRoomId?: number;
	rationale?: string | null;
	expectedRunVersion?: number;
	requestVersion?: number | null;
	queuedAt: string;
	/** Number of failed sync attempts so far. */
	retryCount: number;
	/** ISO timestamp of the last sync attempt (null if never attempted). */
	lastAttemptAt: string | null;
	/** Current status of this outbox action. */
	status: OutboxActionStatus;
};

function keyFor(facultyId: number, runId: number): string {
	return `atlas:room-pref-outbox:${facultyId}:${runId}`;
}

function readActions(storageKey: string): RoomPreferenceOutboxAction[] {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as RoomPreferenceOutboxAction[];
		if (!Array.isArray(parsed)) return [];
		return parsed;
	} catch {
		return [];
	}
}

function writeActions(storageKey: string, actions: RoomPreferenceOutboxAction[]): void {
	try {
		localStorage.setItem(storageKey, JSON.stringify(actions));
	} catch {
		// Ignore storage quota or private mode restrictions.
	}
}

export function listOutboxActions(facultyId: number, runId: number): RoomPreferenceOutboxAction[] {
	return readActions(keyFor(facultyId, runId));
}

export function enqueueOutboxAction(facultyId: number, runId: number, action: Omit<RoomPreferenceOutboxAction, 'queuedAt' | 'retryCount' | 'lastAttemptAt' | 'status'>): RoomPreferenceOutboxAction[] {
	const storageKey = keyFor(facultyId, runId);
	const actions = readActions(storageKey);
	const next = [...actions, { ...action, queuedAt: new Date().toISOString(), retryCount: 0, lastAttemptAt: null, status: 'queued' as OutboxActionStatus }];
	writeActions(storageKey, next);
	return next;
}

export function replaceOutboxActions(facultyId: number, runId: number, actions: RoomPreferenceOutboxAction[]): void {
	writeActions(keyFor(facultyId, runId), actions);
}

export function clearOutboxActions(facultyId: number, runId: number): void {
	try {
		localStorage.removeItem(keyFor(facultyId, runId));
	} catch {
		// Ignore storage errors.
	}
}

/** Maximum retry delay in milliseconds (30 seconds). */
const MAX_RETRY_DELAY_MS = 30_000;
/** Maximum number of retry attempts before marking an action as failed. */
const MAX_RETRY_COUNT = 5;

/**
 * Attempt to flush pending outbox actions using exponential backoff.
 *
 * For each action:
 * - Skips if `status === 'failed'` (permanently failed after MAX_RETRY_COUNT attempts).
 * - Skips if a minimum backoff delay since `lastAttemptAt` has not elapsed.
 * - On success: removes the action from the outbox (or marks as 'recovered' if retryCount > 0).
 * - On failure: increments retryCount; marks as 'failed' if retryCount >= MAX_RETRY_COUNT.
 *
 * @param facultyId  Internal faculty record ID
 * @param runId      Schedule run ID
 * @param syncFn     Async function to send one action to the server. Resolves on success, rejects on failure.
 * @returns          Updated list of remaining outbox actions (empty if all flushed successfully).
 */
export async function flushOutbox(
	facultyId: number,
	runId: number,
	syncFn: (action: RoomPreferenceOutboxAction) => Promise<void>,
): Promise<RoomPreferenceOutboxAction[]> {
	const storageKey = keyFor(facultyId, runId);
	let actions = readActions(storageKey);
	if (actions.length === 0) return [];

	const now = Date.now();
	const remaining: RoomPreferenceOutboxAction[] = [];

	for (const action of actions) {
		// Skip permanently failed actions.
		if (action.status === 'failed') {
			remaining.push(action);
			continue;
		}

		// Enforce exponential backoff: delay = min(2^retryCount * 1000ms, MAX_RETRY_DELAY_MS).
		if (action.lastAttemptAt !== null) {
			const delayMs = Math.min(Math.pow(2, action.retryCount) * 1000, MAX_RETRY_DELAY_MS);
			const elapsed = now - new Date(action.lastAttemptAt).getTime();
			if (elapsed < delayMs) {
				remaining.push(action);
				continue;
			}
		}

		const attemptedAction: RoomPreferenceOutboxAction = {
			...action,
			status: 'syncing',
			lastAttemptAt: new Date(now).toISOString(),
		};

		try {
			await syncFn(attemptedAction);
			// Success: if it had prior retries, mark as 'recovered' briefly — caller may remove it.
			// We remove it from the outbox entirely on success.
		} catch {
			const newRetryCount = action.retryCount + 1;
			const newStatus: OutboxActionStatus =
				newRetryCount >= MAX_RETRY_COUNT ? 'failed' : 'retried';
			remaining.push({
				...attemptedAction,
				retryCount: newRetryCount,
				status: newStatus,
			});
		}
	}

	writeActions(storageKey, remaining);
	return remaining;
}
