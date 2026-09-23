import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import WebSocket from 'ws';

import { prisma } from '../lib/prisma.js';
import { registerRoomPreferenceCollaborationSocket } from '../services/room-preference-collaboration.service.js';
import { issueCollaborationTicket } from '../services/timetable-collaboration-ticket.service.js';

const scope = { schoolId: 5, schoolYearId: 9, runId: 12 };

function ticketUrl(baseUrl: string, userId: number) {
	const issued = issueCollaborationTicket({
		userId,
		role: 'scheduler',
		schoolId: 5,
		displayName: `Scheduler ${userId}`,
		capabilities: ['timetable:read'],
	}, scope);
	const url = new URL(baseUrl);
	url.searchParams.set('ticket', issued.ticket);
	for (const [key, value] of Object.entries(scope)) url.searchParams.set(key, String(value));
	return url.toString();
}

test('collaboration websocket rejects JWT query auth and enforces ticket channel scope', async () => {
	const server = createServer();
	registerRoomPreferenceCollaborationSocket(server);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address !== 'string');
	const baseUrl = `ws://127.0.0.1:${address.port}/api/v1/room-preferences/collaboration/ws`;
	try {
		const legacy = new WebSocket(`${baseUrl}?accessToken=not-a-jwt`);
		const legacyMessage = await new Promise<Record<string, unknown>>((resolve, reject) => {
			legacy.once('message', (message) => resolve(JSON.parse(message.toString()) as Record<string, unknown>));
			legacy.once('error', reject);
		});
		assert.equal(legacyMessage.code, 'UNAUTHORIZED');
		await new Promise<void>((resolve) => legacy.once('close', () => resolve()));

		const issued = issueCollaborationTicket({
			userId: 71,
			role: 'scheduler',
			schoolId: 5,
			displayName: 'Scheduler One',
			capabilities: ['timetable:read'],
		}, scope);
		const url = new URL(baseUrl);
		url.searchParams.set('ticket', issued.ticket);
		for (const [key, value] of Object.entries(scope)) url.searchParams.set(key, String(value));
		const client = new WebSocket(url.toString());
		const events: Array<Record<string, unknown>> = [];
		await new Promise<void>((resolve, reject) => {
			client.on('message', (raw) => {
				const event = JSON.parse(raw.toString()) as Record<string, unknown>;
				events.push(event);
				if (event.type === 'collab.connected') {
					client.send(JSON.stringify({ type: 'collab.join', schoolId: 5, schoolYearId: 9, runId: 13 }));
				}
				if (event.code === 'TICKET_SCOPE_MISMATCH') resolve();
			});
			client.once('error', reject);
		});
		assert.equal((events[0]?.user as Record<string, unknown>)?.displayName, 'Scheduler One');
		assert.equal((events[0]?.user as Record<string, unknown>)?.email, undefined, 'email must not be exposed');
		assert.ok(events.some((event) => event.code === 'TICKET_SCOPE_MISMATCH'));
		const clientClosed = new Promise<void>((resolve) => client.once('close', () => resolve()));
		client.close();
		await clientClosed;
		const replay = new WebSocket(url.toString());
		const replayError = await new Promise<Record<string, unknown>>((resolve, reject) => {
			replay.once('message', (raw) => resolve(JSON.parse(raw.toString()) as Record<string, unknown>));
			replay.once('error', reject);
		});
		assert.equal(replayError.code, 'UNAUTHORIZED', 'the consumed ticket cannot open a second socket');
		await new Promise<void>((resolve) => replay.once('close', () => resolve()));
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

test('presence is scoped to one room and is removed after socket disconnect', async () => {
	const runFindFirst = prisma.generationRun.findFirst;
	prisma.generationRun.findFirst = (async () => ({ id: scope.runId })) as typeof runFindFirst;
	const server = createServer();
	registerRoomPreferenceCollaborationSocket(server);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address !== 'string');
	const baseUrl = `ws://127.0.0.1:${address.port}/api/v1/room-preferences/collaboration/ws`;
	const parseEvent = (raw: WebSocket.RawData) => JSON.parse(raw.toString()) as Record<string, unknown>;
	try {
		const first = new WebSocket(ticketUrl(baseUrl, 71));
		const firstEvents: Array<Record<string, unknown>> = [];
		first.on('message', (raw) => {
			const event = parseEvent(raw);
			firstEvents.push(event);
			if (event.type === 'collab.connected') first.send(JSON.stringify({ type: 'collab.join', ...scope, viewMode: 'SCHEDULER_REVIEW' }));
		});
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('first socket did not join')), 2000);
			const poll = () => {
				if (firstEvents.some((event) => event.type === 'collab.snapshot')) { clearTimeout(timer); resolve(); }
				else setTimeout(poll, 10);
			};
			poll();
		});

		const second = new WebSocket(ticketUrl(baseUrl, 72));
		const secondEvents: Array<Record<string, unknown>> = [];
		second.on('message', (raw) => {
			const event = parseEvent(raw);
			secondEvents.push(event);
			if (event.type === 'collab.connected') second.send(JSON.stringify({ type: 'collab.join', ...scope, viewMode: 'SCHEDULER_REVIEW' }));
		});
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('second socket did not snapshot')), 2000);
			const poll = () => {
				const snapshot = secondEvents.find((event) => event.type === 'collab.snapshot');
				if (snapshot) {
					clearTimeout(timer);
					const present = snapshot.presence as Array<Record<string, unknown>>;
					assert.equal(present.length, 2);
					const secondPresence = present.find((person) => person.userId === 72);
					assert.equal(secondPresence?.displayName, 'Scheduler 72');
					assert.equal(secondPresence?.email, undefined);
					resolve();
				} else setTimeout(poll, 10);
			};
			poll();
		});
		second.send(JSON.stringify({ type: 'collab.selection', selection: { ...scope, entryId: 'x'.repeat(129) } }));
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('oversized selection was not rejected')), 2000);
			const poll = () => {
				if (secondEvents.some((event) => event.code === 'SELECTION_SCOPE_MISMATCH')) { clearTimeout(timer); resolve(); }
				else setTimeout(poll, 10);
			};
			poll();
		});
		second.send(JSON.stringify({ type: 'collab.selection', selection: { ...scope, day: 'MONDAY', startTime: '08:00', endTime: '09:00', entryId: 'entry-1', email: 'must-not-broadcast' } }));
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('valid cell selection was not broadcast')), 2000);
			const poll = () => {
				const event = firstEvents.find((candidate) => candidate.type === 'collab.selection');
				if (event) {
					clearTimeout(timer);
					assert.equal((event.selection as Record<string, unknown>).email, undefined);
					resolve();
				} else setTimeout(poll, 10);
			};
			poll();
		});
		const left = new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('presence leave was not broadcast')), 2000);
			const poll = () => {
				if (secondEvents.some((event) => event.type === 'collab.presence.leave')) { clearTimeout(timer); resolve(); }
				else setTimeout(poll, 10);
			};
			poll();
		});
		first.close();
		await left;
		second.close();
	} finally {
		prisma.generationRun.findFirst = runFindFirst;
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
