import test from 'node:test';
import assert from 'node:assert/strict';

import atlasApi from '../api';
import {
	ATLAS_BRIDGE_TOKEN_KEY,
	ATLAS_LOCAL_TOKEN_KEY,
	clearAtlasAuthStorage,
	getLocalToken,
	getPreferredAccessToken,
	isFacultyPortalRoute,
} from '../auth';
import { verifySessionToken } from '../settings';

type StorageMap = Map<string, string>;

class MemoryStorage {
	private readonly map: StorageMap = new Map();

	getItem(key: string): string | null {
		return this.map.has(key) ? this.map.get(key)! : null;
	}

	setItem(key: string, value: string): void {
		this.map.set(key, String(value));
	}

	removeItem(key: string): void {
		this.map.delete(key);
	}

	clear(): void {
		this.map.clear();
	}
}

const session = new MemoryStorage();
const local = new MemoryStorage();

Object.assign(globalThis, {
	sessionStorage: session,
	localStorage: local,
});

const atlasApiMutable = atlasApi as unknown as {
	get: (
		url: string,
		config?: { headers?: Record<string, string> },
	) => Promise<{ data: { user: { role: string; authSource?: 'local' | 'bridge' } } }>;
};

const originalGet = atlasApiMutable.get;

test.beforeEach(() => {
	session.clear();
	local.clear();
	clearAtlasAuthStorage();
	atlasApiMutable.get = originalGet;
});

test.after(() => {
	atlasApiMutable.get = originalGet;
});

test('prefers local token over bridge token', () => {
	sessionStorage.setItem(ATLAS_LOCAL_TOKEN_KEY, 'local-token');
	sessionStorage.setItem(ATLAS_BRIDGE_TOKEN_KEY, 'bridge-token');

	assert.equal(getPreferredAccessToken(), 'local-token');
});

test('hydrates session local token from remembered localStorage token', () => {
	localStorage.setItem(ATLAS_LOCAL_TOKEN_KEY, 'remembered-local-token');

	assert.equal(getLocalToken(), 'remembered-local-token');
	assert.equal(sessionStorage.getItem(ATLAS_LOCAL_TOKEN_KEY), 'remembered-local-token');
});

test('verifySessionToken keeps local identity when local token is valid', async () => {
	sessionStorage.setItem(ATLAS_LOCAL_TOKEN_KEY, 'local-valid');
	sessionStorage.setItem(ATLAS_BRIDGE_TOKEN_KEY, 'bridge-valid');

	const calls: string[] = [];
	atlasApiMutable.get = async (_url, config) => {
		calls.push(config?.headers?.authorization ?? '');
		return {
			data: {
				user: {
					role: 'faculty',
					authSource: 'local',
				},
			},
		};
	};

	const user = await verifySessionToken();

	assert.equal(user?.authSource, 'local');
	assert.equal(user?.role, 'faculty');
	assert.deepEqual(calls, ['Bearer local-valid']);
});

test('verifySessionToken falls back to bridge token after local token failure', async () => {
	sessionStorage.setItem(ATLAS_LOCAL_TOKEN_KEY, 'local-invalid');
	sessionStorage.setItem(ATLAS_BRIDGE_TOKEN_KEY, 'bridge-valid');

	const calls: string[] = [];
	atlasApiMutable.get = async (_url, config) => {
		const authHeader = config?.headers?.authorization ?? '';
		calls.push(authHeader);
		if (authHeader === 'Bearer local-invalid') {
			throw new Error('Unauthorized');
		}
		return {
			data: {
				user: {
					role: 'officer',
					authSource: 'bridge',
				},
			},
		};
	};

	const user = await verifySessionToken();

	assert.equal(user?.authSource, 'bridge');
	assert.equal(user?.role, 'officer');
	assert.deepEqual(calls, ['Bearer local-invalid', 'Bearer bridge-valid']);
	assert.equal(sessionStorage.getItem(ATLAS_LOCAL_TOKEN_KEY), null);
	assert.equal(localStorage.getItem(ATLAS_LOCAL_TOKEN_KEY), null);
});

test('faculty route guard only allows My portal routes', () => {
	assert.equal(isFacultyPortalRoute('/my'), true);
	assert.equal(isFacultyPortalRoute('/my/preferences'), true);
	assert.equal(isFacultyPortalRoute('/my/room-preferences'), true);
	assert.equal(isFacultyPortalRoute('/'), false);
	assert.equal(isFacultyPortalRoute('/faculty'), false);
	assert.equal(isFacultyPortalRoute('/timetable'), false);
});
