import { createHash, randomBytes } from 'node:crypto';

export type CollaborationScope = { schoolId: number; schoolYearId: number; runId: number };
export type CollaborationTicketActor = {
	userId: number;
	role: string;
	schoolId: number;
	displayName: string | null;
	capabilities: string[];
};

type TicketRecord = { actor: CollaborationTicketActor; scope: CollaborationScope; expiresAt: number };
type TicketStore = Map<string, TicketRecord>;

const tickets: TicketStore = new Map();
const TICKET_TTL_MS = 60_000;

function digest(ticket: string): string {
	return createHash('sha256').update(ticket).digest('hex');
}

function validScope(scope: CollaborationScope): boolean {
	return [scope.schoolId, scope.schoolYearId, scope.runId].every((value) => Number.isSafeInteger(value) && value > 0);
}

export function issueCollaborationTicket(
	actor: CollaborationTicketActor,
	scope: CollaborationScope,
	options: { now?: () => number; store?: TicketStore } = {},
): { ticket: string; expiresInSeconds: number } {
	if (!Number.isSafeInteger(actor.userId) || actor.userId < 1 || actor.schoolId !== scope.schoolId || !validScope(scope)) {
		throw new Error('COLLABORATION_TICKET_SCOPE_INVALID');
	}
	const ticket = randomBytes(32).toString('base64url');
	const now = (options.now ?? Date.now)();
	const store = options.store ?? tickets;
	for (const [key, record] of store) if (record.expiresAt <= now) store.delete(key);
	store.set(digest(ticket), {
		actor: { ...actor, capabilities: [...actor.capabilities] },
		scope: { ...scope },
		expiresAt: now + TICKET_TTL_MS,
	});
	return { ticket, expiresInSeconds: TICKET_TTL_MS / 1000 };
}

export function consumeCollaborationTicket(
	ticket: string,
	scope: CollaborationScope,
	options: { now?: () => number; store?: TicketStore } = {},
): { actor: CollaborationTicketActor; scope: CollaborationScope } | null {
	if (typeof ticket !== 'string' || ticket.length < 40 || ticket.length > 100 || !validScope(scope)) return null;
	const store = options.store ?? tickets;
	const key = digest(ticket);
	const record = store.get(key);
	if (!record) return null;
	if (record.expiresAt <= (options.now ?? Date.now)()) {
		store.delete(key);
		return null;
	}
	if (record.scope.schoolId !== scope.schoolId || record.scope.schoolYearId !== scope.schoolYearId || record.scope.runId !== scope.runId) return null;
	store.delete(key);
	return { actor: record.actor, scope: record.scope };
}
