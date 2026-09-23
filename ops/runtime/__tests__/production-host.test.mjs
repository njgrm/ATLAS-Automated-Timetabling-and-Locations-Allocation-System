import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { assertProductionArtifact, cacheControlFor, createProductionHost, resolveStaticFile } from '../lib/production-host.mjs';

function makeStaticRoot(indexHtml) {
	const dir = mkdtempSync(join(tmpdir(), 'atlas-dist-'));
	writeFileSync(join(dir, 'index.html'), indexHtml ?? '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-abc12345.js"></script></body></html>');
	mkdirSync(join(dir, 'assets'), { recursive: true });
	writeFileSync(join(dir, 'assets', 'index-abc12345.js'), 'console.log("built")');
	writeFileSync(join(dir, 'about.txt'), 'about page');
	return dir;
}

function listen(server) {
	return new Promise((resolvePromise) => server.listen(0, '127.0.0.1', () => resolvePromise(server.address().port)));
}

function startFakeApi() {
	const seen = [];
	const server = createServer((req, res) => {
		const chunks = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => {
			const body = Buffer.concat(chunks).toString('utf8');
			seen.push({ url: req.url, method: req.method, body });
			if (req.url === '/api/v1/health/ready') {
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end('{"status":"ready"}');
				return;
			}
			if (req.url?.startsWith('/api/v1/events')) {
				res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
				res.write('data: hello\n\n');
				setTimeout(() => res.end(), 30);
				return;
			}
			if (req.url === '/api/teapot') {
				res.writeHead(418, { 'content-type': 'application/json' });
				res.end(JSON.stringify({ code: 'TEAPOT', path: req.url }));
				return;
			}
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ path: req.url, method: req.method, body, xff: req.headers['x-forwarded-for'] ?? null }));
		});
	});
	server.on('upgrade', (req, socket) => {
		socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
		socket.end('pong');
	});
	return { server, seen };
}

/** A port that is bound and then released, so connections are refused. */
async function closedPort() {
	const probe = createServer();
	await new Promise((resolvePromise) => probe.listen(0, '127.0.0.1', resolvePromise));
	const port = probe.address().port;
	await new Promise((resolvePromise) => probe.close(resolvePromise));
	return port;
}

function rawUpgrade(port, path) {
	return new Promise((resolvePromise, rejectPromise) => {
		const socket = connect(port, '127.0.0.1', () => {
			socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`);
		});
		let buffer = '';
		socket.on('data', (chunk) => {
			buffer += chunk.toString();
			if (buffer.includes('pong')) {
				socket.destroy();
				resolvePromise(buffer);
			}
		});
		socket.on('error', rejectPromise);
		setTimeout(() => {
			socket.destroy();
			rejectPromise(new Error(`upgrade timed out: ${buffer}`));
		}, 4000).unref();
	});
}

test('production host serves deep links through SPA fallback', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${apiPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const response = await fetch(`http://127.0.0.1:${hostPort}/dashboard`);
		assert.equal(response.status, 200);
		assert.match(response.headers.get('content-type'), /text\/html/);
		assert.match(await response.text(), /id="root"/);
	} finally {
		await host.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host applies immutable caching to hashed assets and no-cache to index', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${apiPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const asset = await fetch(`http://127.0.0.1:${hostPort}/assets/index-abc12345.js`);
		assert.equal(asset.status, 200);
		assert.match(asset.headers.get('cache-control'), /immutable/);
		const index = await fetch(`http://127.0.0.1:${hostPort}/`);
		assert.match(index.headers.get('cache-control'), /no-store/);
		assert.equal(cacheControlFor('/deploy/dist/assets/index-abc12345.js'), 'public, max-age=31536000, immutable');
		assert.equal(cacheControlFor('/deploy/dist/about.txt'), 'public, max-age=3600');
	} finally {
		await host.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host rewrites /enrollpro-api and /enrollpro-uploads proxy paths', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const enrollPro = startFakeApi();
	const enrollProPort = await listen(enrollPro.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${enrollProPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const atlas = await fetch(`http://127.0.0.1:${hostPort}/api/v1/echo`);
		assert.deepEqual((await atlas.json()).path, '/api/v1/echo');
		const enrollSettings = await fetch(`http://127.0.0.1:${hostPort}/enrollpro-api/settings`);
		assert.deepEqual((await enrollSettings.json()).path, '/api/settings');
		const enrollUpload = await fetch(`http://127.0.0.1:${hostPort}/enrollpro-uploads/logo.png`);
		assert.deepEqual((await enrollUpload.json()).path, '/uploads/logo.png');
		assert.ok(enrollPro.seen.some((entry) => entry.url === '/api/settings'));
		assert.ok(enrollPro.seen.some((entry) => entry.url === '/uploads/logo.png'));
		assert.ok(api.seen.some((entry) => entry.url === '/api/v1/echo'));
	} finally {
		await host.close();
		api.server.close();
		enrollPro.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host preserves proxy query strings and POST method/body parity', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const enrollPro = startFakeApi();
	const enrollProPort = await listen(enrollPro.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${enrollProPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const query = await fetch(`http://127.0.0.1:${hostPort}/enrollpro-api/settings/public?schoolId=9&year=2030-2031`);
		assert.equal(query.status, 200);
		assert.equal((await query.json()).path, '/api/settings/public?schoolId=9&year=2030-2031');
		assert.ok(enrollPro.seen.some((entry) => entry.url === '/api/settings/public?schoolId=9&year=2030-2031'));

		const postBody = JSON.stringify({ hello: 'world' });
		const post = await fetch(`http://127.0.0.1:${hostPort}/enrollpro-api/echo?trace=1`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: postBody });
		assert.equal(post.status, 200);
		const echoed = await post.json();
		assert.equal(echoed.method, 'POST');
		assert.equal(echoed.path, '/api/echo?trace=1');
		assert.equal(echoed.body, postBody);
	} finally {
		await host.close();
		api.server.close();
		enrollPro.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host passes a non-2xx upstream status and body through unchanged', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const enrollPro = startFakeApi();
	const enrollProPort = await listen(enrollPro.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${enrollProPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const response = await fetch(`http://127.0.0.1:${hostPort}/enrollpro-api/teapot`);
		assert.equal(response.status, 418);
		assert.deepEqual(await response.json(), { code: 'TEAPOT', path: '/api/teapot' });
	} finally {
		await host.close();
		api.server.close();
		enrollPro.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('an unreachable EnrollPro upstream yields a bounded 502 while ATLAS stays fully available', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const deadEnrollProPort = await closedPort();
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${deadEnrollProPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const proxied = await fetch(`http://127.0.0.1:${hostPort}/enrollpro-api/settings/public`);
		assert.equal(proxied.status, 502);
		const body = await proxied.json();
		assert.equal(body.code, 'UPSTREAM_UNREACHABLE');

		// EnrollPro availability is NOT a prerequisite for ATLAS liveness,
		// ATLAS proxying, or the SPA fallback.
		assert.equal((await fetch(`http://127.0.0.1:${hostPort}/__host/live`)).status, 200);
		assert.equal((await fetch(`http://127.0.0.1:${hostPort}/api/v1/health/ready`)).status, 200);
		const spa = await fetch(`http://127.0.0.1:${hostPort}/dashboard`);
		assert.equal(spa.status, 200);
		assert.match(await spa.text(), /id="root"/);
	} finally {
		await host.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host tunnels a WebSocket upgrade on an /enrollpro-api path to the EnrollPro upstream', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const enrollPro = startFakeApi();
	const enrollProPort = await listen(enrollPro.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${enrollProPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const response = await rawUpgrade(hostPort, '/enrollpro-api/collaboration/ws');
		assert.match(response, /^HTTP\/1\.1 101/);
		assert.match(response, /pong/);
	} finally {
		await host.close();
		api.server.close();
		enrollPro.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host passes SSE through without buffering', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${apiPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const response = await fetch(`http://127.0.0.1:${hostPort}/api/v1/events`, { headers: { accept: 'text/event-stream' } });
		assert.equal(response.status, 200);
		assert.match(response.headers.get('content-type'), /text\/event-stream/);
		assert.match(await response.text(), /data: hello/);
	} finally {
		await host.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host tunnels WebSocket upgrades to the API upstream', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const host = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${apiPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const hostPort = await listen(host.server);
	try {
		const response = await rawUpgrade(hostPort, '/api/v1/room-preferences/collaboration/ws');
		assert.match(response, /^HTTP\/1\.1 101/);
		assert.match(response, /pong/);
	} finally {
		await host.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('production host exposes distinct liveness and dependency-readiness probes', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	const apiPort = await listen(api.server);
	const readyHost = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${apiPort}`, probeApiReadiness: async () => ({ ok: true, status: 200 }) });
	const readyPort = await listen(readyHost.server);
	const degradedHost = createProductionHost({ staticRoot, apiTarget: `http://127.0.0.1:${apiPort}`, enrollProTarget: `http://127.0.0.1:${apiPort}`, probeApiReadiness: async () => ({ ok: false, status: 503 }) });
	const degradedPort = await listen(degradedHost.server);
	try {
		assert.equal((await fetch(`http://127.0.0.1:${readyPort}/__host/live`)).status, 200);
		assert.equal((await fetch(`http://127.0.0.1:${readyPort}/__host/ready`)).status, 200);
		assert.equal((await fetch(`http://127.0.0.1:${degradedPort}/__host/live`)).status, 200);
		assert.equal((await fetch(`http://127.0.0.1:${degradedPort}/__host/ready`)).status, 503);
	} finally {
		await readyHost.close();
		await degradedHost.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

test('Vite development/HMR artifacts are refused as the durable runtime', async () => {
	const devRoot = makeStaticRoot('<!doctype html><html><head><script type="module" src="/@vite/client"></script></head><body></body></html>');
	try {
		assert.throws(() => assertProductionArtifact(devRoot), (error) => error.code === 'VITE_DEV_ARTIFACT_REJECTED');
		assert.throws(
			() => createProductionHost({ staticRoot: devRoot, apiTarget: 'http://127.0.0.1:1', enrollProTarget: 'http://127.0.0.1:1' }),
			(error) => error.code === 'VITE_DEV_ARTIFACT_REJECTED',
		);
	} finally {
		rmSync(devRoot, { recursive: true, force: true });
	}
});

test('static path traversal escapes are rejected', () => {
	const staticRoot = makeStaticRoot();
	try {
		assert.equal(resolveStaticFile(staticRoot, '/%2e%2e/escape.txt').status, 403);
	} finally {
		rmSync(staticRoot, { recursive: true, force: true });
	}
});

// Regression control for the intermittent `read ECONNRESET` 502: the proxy must
// not reuse a pooled upstream socket. Node's default global agent keeps sockets
// alive (Node >=19), so a request after an idle period can reuse a socket the
// server already closed at its keepAliveTimeout. Two sequential proxied requests
// must therefore arrive on two distinct upstream connections.
test('production host opens a fresh upstream connection per proxied request (no keep-alive reuse)', async () => {
	const staticRoot = makeStaticRoot();
	const api = startFakeApi();
	let upstreamConnections = 0;
	api.server.on('connection', () => { upstreamConnections += 1; });
	const apiPort = await listen(api.server);
	const host = createProductionHost({
		staticRoot,
		apiTarget: `http://127.0.0.1:${apiPort}`,
		enrollProTarget: `http://127.0.0.1:${apiPort}`,
		probeApiReadiness: async () => ({ ok: true, status: 200 }),
	});
	const hostPort = await listen(host.server);
	try {
		assert.equal((await fetch(`http://127.0.0.1:${hostPort}/api/v1/first`)).status, 200);
		assert.equal((await fetch(`http://127.0.0.1:${hostPort}/api/v1/second`)).status, 200);
		assert.equal(api.seen.length, 2, 'both proxied requests must reach the upstream');
		assert.equal(
			upstreamConnections,
			2,
			'each proxied request must open its own upstream connection; a reused pooled socket can 502 with read ECONNRESET',
		);
	} finally {
		await host.close();
		api.server.close();
		rmSync(staticRoot, { recursive: true, force: true });
	}
});
