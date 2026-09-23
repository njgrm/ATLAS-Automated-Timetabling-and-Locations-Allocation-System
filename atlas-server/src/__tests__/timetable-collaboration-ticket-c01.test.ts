import assert from 'node:assert/strict';
import test from 'node:test';

import {
	consumeCollaborationTicket,
	issueCollaborationTicket,
	type CollaborationTicketActor,
} from '../services/timetable-collaboration-ticket.service.js';

const actor: CollaborationTicketActor = {
	userId: 71,
	role: 'scheduler',
	schoolId: 5,
	displayName: 'Scheduler One',
	capabilities: ['timetable:read'],
};
const scope = { schoolId: 5, schoolYearId: 9, runId: 12 };

test('collaboration tickets are opaque, scoped, short-lived, and single-use', () => {
	let now = 1000;
	const store = new Map<string, { actor: CollaborationTicketActor; scope: typeof scope; expiresAt: number }>();
	const ticket = issueCollaborationTicket(actor, scope, { now: () => now, store });
	assert.equal(ticket.expiresInSeconds, 60);
	assert.equal(ticket.ticket.includes(actor.userId.toString()), false);
	assert.deepEqual(consumeCollaborationTicket(ticket.ticket, scope, { now: () => now, store }), { actor, scope });
	assert.equal(consumeCollaborationTicket(ticket.ticket, scope, { now: () => now, store }), null, 'replay is rejected');
});

test('expired and wrong-scope tickets are rejected without consuming a valid ticket', () => {
	let now = 2000;
	const store = new Map<string, { actor: CollaborationTicketActor; scope: typeof scope; expiresAt: number }>();
	const valid = issueCollaborationTicket(actor, scope, { now: () => now, store });
	assert.equal(consumeCollaborationTicket(valid.ticket, { ...scope, runId: 13 }, { now: () => now, store }), null);
	assert.deepEqual(consumeCollaborationTicket(valid.ticket, scope, { now: () => now, store }), { actor, scope });
	const expired = issueCollaborationTicket(actor, scope, { now: () => now, store });
	now += 60_001;
	assert.equal(consumeCollaborationTicket(expired.ticket, scope, { now: () => now, store }), null);
});
