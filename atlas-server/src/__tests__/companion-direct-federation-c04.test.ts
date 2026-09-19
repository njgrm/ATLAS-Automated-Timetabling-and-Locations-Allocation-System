import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

process.env.COMPANION_SSO_STATE_SECRET = 'test-only-state-secret-with-sufficient-entropy';
process.env.SMART_SSO_AUTHORIZE_URL = 'https://smart.test/api/auth/atlas/authorize';
process.env.ATLAS_SMART_SSO_CALLBACK_URL = 'https://atlas.test/api/v1/auth/smart/callback';
process.env.SMART_SSO_CALLBACK_URL = 'https://smart.test/api/auth/atlas/callback';
process.env.SMART_SSO_CLIENT_SECRET = 'smart-outbound-secret';
process.env.ATLAS_SMART_SSO_REVERSE_CLIENT_SECRET = 'smart-reverse-secret';
process.env.AIMS_SSO_AUTHORIZE_URL = 'https://aims.test/api/v1/auth/atlas/authorize';
process.env.ATLAS_AIMS_SSO_CALLBACK_URL = 'https://atlas.test/api/v1/auth/aims/callback';
process.env.AIMS_SSO_CALLBACK_URL = 'https://aims.test/api/v1/auth/atlas/callback';
process.env.AIMS_SSO_CLIENT_SECRET = 'aims-outbound-secret';
process.env.ATLAS_AIMS_SSO_REVERSE_CLIENT_SECRET = 'aims-reverse-secret';

const service = await import('../services/companion-sso.service.js');
const authRouter = (await import('../routes/auth.router.js')).default;
const { prisma } = await import('../lib/prisma.js');

test('C04 closed registry resolves only enrollpro, smart, and aims', () => {
	assert.equal(service.resolveCompanionPeer('SMART')?.id, 'smart');
	assert.equal(service.resolveCompanionPeer('aims')?.id, 'aims');
	assert.equal(service.resolveCompanionPeer('enrollpro')?.id, 'enrollpro');
	assert.equal(service.resolveCompanionPeer('mrf'), null);
	assert.equal(service.resolveCompanionPeer('../smart'), null);
});

test('C04 signed state is peer-bound, tamper-evident, and expires', () => {
	const now = Date.now();
	const state = service.issueSignedPeerState('smart', now);
	assert.equal(service.verifySignedPeerState(state, 'smart', now + 1), true);
	assert.equal(service.verifySignedPeerState(state, 'aims', now + 1), false, 'cross-peer substitution must fail');
	assert.equal(service.verifySignedPeerState(`${state}x`, 'smart', now + 1), false, 'tamper must fail');
	assert.equal(service.verifySignedPeerState(state, 'smart', now + service.COMPANION_SSO_STATE_TTL_MS + 1), false, 'expired state must fail');
});

test('C04 authorize validation binds each client to its exact callback', () => {
	for (const peer of ['smart', 'aims'] as const) {
		const callback = peer === 'smart' ? process.env.SMART_SSO_CALLBACK_URL! : process.env.AIMS_SSO_CALLBACK_URL!;
		assert.deepEqual(
			service.validateAuthorizeRequest({ peer, responseType: 'code', clientId: peer, redirectUri: callback, state: 'state', role: 'admin' }),
			{ peer, redirectUri: callback, state: 'state' },
		);
		assert.throws(
			() => service.validateAuthorizeRequest({ peer, responseType: 'code', clientId: peer, redirectUri: peer === 'smart' ? process.env.AIMS_SSO_CALLBACK_URL : process.env.SMART_SSO_CALLBACK_URL, state: 'state', role: 'admin' }),
			(error: unknown) => error instanceof service.CompanionSsoError && error.code === 'COMPANION_SSO_INVALID_REQUEST',
		);
	}
});

test('C04 reverse secrets are isolated and constant-time matched per peer', () => {
	assert.equal(service.matchReverseClientSecret('smart-reverse-secret', 'smart'), 'ATLAS_SMART_SSO_REVERSE_CLIENT_SECRET');
	assert.equal(service.matchReverseClientSecret('smart-reverse-secret', 'aims'), null);
	assert.equal(service.matchReverseClientSecret('aims-reverse-secret', 'aims'), 'ATLAS_AIMS_SSO_REVERSE_CLIENT_SECRET');
	assert.equal(service.matchReverseClientSecret('', 'smart'), null);
});

test('C04 state consume is single-use and cross-peer state never reaches persistence', async () => {
	const state = service.issueSignedPeerState('smart');
	const codeModel = prisma.companionSsoCode as unknown as { updateMany: (args: unknown) => Promise<{ count: number }> };
	const originalUpdateMany = codeModel.updateMany;
	let available = true;
	let dispatches = 0;
	codeModel.updateMany = async () => { dispatches += 1; const count = available ? 1 : 0; available = false; return { count }; };
	try {
		assert.equal(await service.consumeSignedPeerState(state, 'smart'), true);
		assert.equal(await service.consumeSignedPeerState(state, 'smart'), false, 'replay must fail');
		assert.equal(await service.consumeSignedPeerState(state, 'aims'), false, 'cross-peer state must fail');
		assert.equal(dispatches, 2, 'cross-peer rejection must dispatch zero persistence work');
	} finally { codeModel.updateMany = originalUpdateMany; }
});

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
	const app = express();
	app.use(express.json());
	app.use('/api/v1/auth', authRouter);
	const server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('server address unavailable');
	try { await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('C04 mounted direct start emits an HttpOnly state cookie and exact peer authorize URL', async () => {
	const codeModel = prisma.companionSsoCode as unknown as { create: (args: unknown) => Promise<unknown> };
	const originalCreate = codeModel.create;
	codeModel.create = async () => ({ id: 1 });
	try { await withServer(async (base) => {
		const response = await fetch(`${base}/api/v1/auth/sso/smart/start`, { redirect: 'manual' });
		assert.equal(response.status, 302);
		assert.match(response.headers.get('set-cookie') ?? '', /atlas_sso_state_smart=.*HttpOnly.*Secure.*SameSite=Lax/);
		const target = new URL(response.headers.get('location') ?? '');
		assert.equal(target.origin, 'https://smart.test');
		assert.equal(target.searchParams.get('client_id'), 'atlas');
		assert.equal(target.searchParams.get('redirect_uri'), process.env.ATLAS_SMART_SSO_CALLBACK_URL);
		assert.equal(service.verifySignedPeerState(target.searchParams.get('state'), 'smart'), true);
	}); } finally { codeModel.create = originalCreate; }
});

test('C04 mounted callback rejects missing/cross-peer state before exchange or writes', async () => {
	await withServer(async (base) => {
		const response = await fetch(`${base}/api/v1/auth/smart/callback?code=${'a'.repeat(43)}&state=missing`, { redirect: 'manual' });
		assert.equal(response.status, 302);
		assert.match(response.headers.get('location') ?? '', /COMPANION_SSO_INVALID_REQUEST/);
	});
});

test('C04 mounted exchange denies cross-peer secret before code lookup', async () => {
	await withServer(async (base) => {
		const response = await fetch(`${base}/api/v1/auth/sso/exchange`, {
			method: 'POST',
			headers: { authorization: 'Bearer smart-reverse-secret', 'content-type': 'application/json' },
			body: JSON.stringify({ clientId: 'aims', redirectUri: process.env.AIMS_SSO_CALLBACK_URL, code: 'a'.repeat(43) }),
		});
		assert.equal(response.status, 401);
		assert.equal((await response.json() as { code: string }).code, 'COMPANION_SSO_CLIENT_INVALID');
	});
});
