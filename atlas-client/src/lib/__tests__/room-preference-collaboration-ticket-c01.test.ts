import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoomPreferenceCollaborationSocket } from '../roomPreferenceCollaboration';

test('client exchanges bearer auth over HTTPS API then places only scoped ticket in websocket URL', async () => {
	const originalFetch = globalThis.fetch;
	const originalWebSocket = globalThis.WebSocket;
	const originalWindow = globalThis.window;
	const captured: { current: { url: string; init?: RequestInit } | null } = { current: null };
	let socketUrl = '';
	class FakeWebSocket {
		static OPEN = 1;
		readyState = 0;
		private listeners = new Map<string, Array<() => void>>();
		constructor(url: string) { socketUrl = url; }
		addEventListener(type: string, listener: () => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
		send() {}
		close() { this.readyState = 3; }
	}
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		captured.current = { url: String(input), init };
		return { ok: true, json: async () => ({ ticket: 'opaque-one-time-ticket' }) } as Response;
	}) as typeof fetch;
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.window = { location: { href: 'https://atlas.test/' } } as unknown as Window & typeof globalThis;
	try {
		const socket = createRoomPreferenceCollaborationSocket({
			accessToken: 'sensitive.jwt.value',
			scope: { schoolId: 5, schoolYearId: 9, runId: 12 },
			onEvent: () => undefined,
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.ok(captured.current);
		assert.match(captured.current.url, /room-preferences\/collaboration\/ticket$/);
		assert.equal(new Headers(captured.current.init?.headers).get('authorization'), 'Bearer sensitive.jwt.value');
		assert.ok(socketUrl.includes('ticket=opaque-one-time-ticket'));
		assert.equal(socketUrl.includes('accessToken'), false);
		assert.equal(socketUrl.includes('sensitive.jwt.value'), false);
		socket.close();
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.WebSocket = originalWebSocket;
		globalThis.window = originalWindow;
	}
});
