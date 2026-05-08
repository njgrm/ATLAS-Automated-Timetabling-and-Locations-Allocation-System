export type RoomPreferenceOutboxActionType = 'SAVE_DRAFT' | 'SUBMIT' | 'DELETE';

export type RoomPreferenceOutboxAction = {
	actionId: string;
	type: RoomPreferenceOutboxActionType;
	entryId: string;
	requestedRoomId?: number;
	rationale?: string | null;
	expectedRunVersion?: number;
	requestVersion?: number | null;
	queuedAt: string;
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

export function enqueueOutboxAction(facultyId: number, runId: number, action: Omit<RoomPreferenceOutboxAction, 'queuedAt'>): RoomPreferenceOutboxAction[] {
	const storageKey = keyFor(facultyId, runId);
	const actions = readActions(storageKey);
	const next = [...actions, { ...action, queuedAt: new Date().toISOString() }];
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
