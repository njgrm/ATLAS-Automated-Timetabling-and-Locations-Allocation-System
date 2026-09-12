import { createServer, request as httpRequest, get as httpGet } from 'node:http';
import { request as httpsRequest, get as httpsGet } from 'node:https';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { connect } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';

import { fail } from './errors.mjs';

const CONTENT_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.map': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
};

const IMMUTABLE_ASSET = /-[0-9a-zA-Z_-]{8,}\.[a-z0-9]+$/;
const DEV_ARTIFACT_MARKERS = ['/@vite/client', '/@react-refresh', 'src/main.tsx', 'src/main.ts'];

function errorBody(code, message) {
	return JSON.stringify({ code, message });
}

/** Resolve the static file for a request path with traversal-safe containment. */
export function resolveStaticFile(staticRoot, requestPath) {
	let pathname;
	try {
		pathname = decodeURIComponent(String(requestPath).split('?')[0].split('#')[0]);
	} catch {
		return { status: 400, reason: 'INVALID_PATH' };
	}
	if (pathname.includes('\0')) return { status: 400, reason: 'INVALID_PATH' };
	const candidate = resolve(staticRoot, `.${pathname}`);
	const root = resolve(staticRoot);
	if (candidate !== root && !candidate.startsWith(root + sep)) {
		return { status: 403, reason: 'PATH_ESCAPE' };
	}
	try {
		const stat = statSync(candidate);
		if (stat.isFile()) return { status: 200, filePath: candidate, size: stat.size };
	} catch {
		/* fall through to SPA fallback / 404 */
	}
	return { status: 404, reason: 'NOT_FOUND' };
}

/** Cache policy for a resolved static file. Hashed assets are immutable. */
export function cacheControlFor(filePath) {
	const base = filePath.split(/[\\/]/).pop() ?? '';
	if (base === 'index.html') return 'no-cache, no-store, must-revalidate';
	if (IMMUTABLE_ASSET.test(base) || filePath.split(/[\\/]/).includes('assets')) {
		return 'public, max-age=31536000, immutable';
	}
	return 'public, max-age=3600';
}

/**
 * Refuse to serve a Vite development/HMR tree as the durable runtime. The built
 * `atlas-client/dist` artifact is the only accepted production host root.
 */
export function assertProductionArtifact(staticRoot) {
	const indexPath = join(staticRoot, 'index.html');
	if (!existsSync(indexPath)) {
		throw fail('PRODUCTION_ARTIFACT_MISSING', `Production artifact is missing index.html at ${staticRoot}.`);
	}
	const html = readFileSync(indexPath, 'utf8');
	for (const marker of DEV_ARTIFACT_MARKERS) {
		if (html.includes(marker)) {
			throw fail('VITE_DEV_ARTIFACT_REJECTED', `Refusing to serve a Vite development/HMR tree (found "${marker}"); run the production client build.`);
		}
	}
	return { indexPath };
}

function normalizeTargets(options) {
	const apiTarget = options.apiTarget;
	const enrollProTarget = options.enrollProTarget ?? options.apiTarget;
	for (const [label, value] of [['apiTarget', apiTarget], ['enrollProTarget', enrollProTarget]]) {
		const parsed = new URL(value);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw fail('PROXY_TARGET_INVALID', `${label} must be an http(s) origin.`);
		}
	}
	return [
		{ prefix: '/api', target: apiTarget, rewrite: null },
		{ prefix: '/uploads', target: apiTarget, rewrite: null },
		{ prefix: '/enrollpro-api', target: enrollProTarget, rewrite: (p) => `/api${p.slice('/enrollpro-api'.length)}` },
		{ prefix: '/enrollpro-uploads', target: enrollProTarget, rewrite: (p) => `/uploads${p.slice('/enrollpro-uploads'.length)}` },
	];
}

/** Match a request path to the longest proxy route with segment boundaries. */
export function matchProxyRoute(routes, requestPath) {
	const pathname = String(requestPath).split('?')[0];
	let best = null;
	for (const route of routes) {
		if (pathname === route.prefix || pathname.startsWith(route.prefix + '/')) {
			if (!best || route.prefix.length > best.prefix.length) best = route;
		}
	}
	return best;
}

/**
 * Default dependency-readiness probe for the host: it does not trust the
 * constant server liveness response. It requires the ATLAS server's dedicated
 * readiness endpoint (which checks the database) to return HTTP 200.
 */
export function defaultProbeApiReadiness(options) {
	const { apiTarget, readinessPath, timeoutMs = 3000 } = options;
	return new Promise((resolvePromise) => {
		const target = new URL(apiTarget);
		const get = target.protocol === 'https:' ? httpsGet : httpGet;
		const request = get(
			{
				protocol: target.protocol,
				hostname: target.hostname,
				port: target.port || (target.protocol === 'https:' ? 443 : 80),
				path: readinessPath,
				timeout: timeoutMs,
			},
			(response) => {
				response.resume();
				resolvePromise({ ok: response.statusCode === 200, status: response.statusCode ?? 0 });
			},
		);
		request.on('timeout', () => {
			request.destroy(new Error('readiness timeout'));
		});
		request.on('error', (error) => resolvePromise({ ok: false, status: 0, error: error.message }));
	});
}

function pickRequestTransport(target) {
	return target.protocol === 'https:' ? httpsRequest : httpRequest;
}

function forwardedHeaders(req, target) {
	const headers = { ...req.headers };
	delete headers['host'];
	headers.host = target.host;
	if (req.socket?.remoteAddress) headers['x-forwarded-for'] = req.socket.remoteAddress;
	headers['x-forwarded-proto'] = 'http';
	return headers;
}

function proxyHttpRequest(req, res, route) {
	const target = new URL(route.target);
	const rewritten = route.rewrite ? route.rewrite(String(req.url)) : String(req.url);
	const requestFn = pickRequestTransport(target);
	const upstream = requestFn(
		{
			protocol: target.protocol,
			hostname: target.hostname,
			port: target.port || (target.protocol === 'https:' ? 443 : 80),
			method: req.method,
			path: rewritten,
			headers: forwardedHeaders(req, target),
		},
		(upstreamRes) => {
			const isSse = String(upstreamRes.headers['content-type'] ?? '').includes('text/event-stream');
			const headers = { ...upstreamRes.headers };
			if (isSse) {
				headers['cache-control'] = 'no-cache, no-transform';
				headers.connection = 'keep-alive';
			}
			res.writeHead(upstreamRes.statusCode ?? 502, headers);
			if (isSse && typeof res.flushHeaders === 'function') res.flushHeaders();
			upstreamRes.pipe(res);
		},
	);
	upstream.on('error', (error) => {
		if (res.headersSent) {
			res.destroy();
			return;
		}
		res.writeHead(502, { 'content-type': 'application/json' });
		res.end(errorBody('UPSTREAM_UNREACHABLE', error.message));
	});
	req.pipe(upstream);
}

/**
 * Create the reviewed production static host + reverse proxy.
 *
 * Serves the built client artifact with SPA fallback and proxies `/api`,
 * `/uploads`, `/enrollpro-api`, and `/enrollpro-uploads` including SSE
 * pass-through and WebSocket upgrade tunnelling.
 */
export function createProductionHost(options) {
	const staticRoot = resolve(options.staticRoot);
	if (options.assertArtifact !== false) assertProductionArtifact(staticRoot);
	const routes = normalizeTargets(options);
	const livePath = options.livePath ?? '/__host/live';
	const readyPath = options.readyPath ?? '/__host/ready';
	const probeApiReadiness = options.probeApiReadiness ?? defaultProbeApiReadiness;
	const apiTarget = options.apiTarget;
	const readinessPath = options.apiReadinessPath ?? '/api/v1/health/ready';

	const server = createServer((req, res) => {
		const pathname = String(req.url).split('?')[0];
		if (pathname === livePath) {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ status: 'live', service: 'atlas-production-host' }));
			return;
		}
		if (pathname === readyPath) {
			Promise.resolve(probeApiReadiness({ apiTarget, readinessPath }))
				.then((result) => {
					if (result.ok) {
						res.writeHead(200, { 'content-type': 'application/json' });
						res.end(JSON.stringify({ status: 'ready', service: 'atlas-production-host', artifact: staticRoot, upstream: 'ready' }));
						return;
					}
					res.writeHead(503, { 'content-type': 'application/json' });
					res.end(errorBody('DEPENDENCY_NOT_READY', `Upstream readiness check failed (status ${result.status ?? 0}).`));
				})
				.catch((error) => {
					res.writeHead(503, { 'content-type': 'application/json' });
					res.end(errorBody('DEPENDENCY_NOT_READY', error instanceof Error ? error.message : String(error)));
				});
			return;
		}
		const route = matchProxyRoute(routes, req.url);
		if (route) {
			proxyHttpRequest(req, res, route);
			return;
		}
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			res.writeHead(405, { 'content-type': 'application/json' });
			res.end(errorBody('METHOD_NOT_ALLOWED', 'The production host serves GET/HEAD for static assets.'));
			return;
		}
		const resolved = resolveStaticFile(staticRoot, req.url);
		if (resolved.status === 200) {
			res.writeHead(200, {
				'content-type': CONTENT_TYPES[extname(resolved.filePath).toLowerCase()] ?? 'application/octet-stream',
				'content-length': resolved.size,
				'cache-control': cacheControlFor(resolved.filePath),
			});
			if (req.method === 'HEAD') {
				res.end();
				return;
			}
			createReadStream(resolved.filePath).pipe(res);
			return;
		}
		const fallbackPathname = String(req.url).split('?')[0];
		const looksLikeDeepLink = !extname(fallbackPathname);
		if (resolved.status === 404 && looksLikeDeepLink) {
			const index = join(staticRoot, 'index.html');
			const stat = statSync(index);
			res.writeHead(200, {
				'content-type': 'text/html; charset=utf-8',
				'content-length': stat.size,
				'cache-control': 'no-cache, no-store, must-revalidate',
			});
			if (req.method === 'HEAD') {
				res.end();
				return;
			}
			createReadStream(index).pipe(res);
			return;
		}
		res.writeHead(resolved.status, { 'content-type': 'application/json' });
		res.end(errorBody(resolved.reason ?? 'STATIC_ERROR', `Cannot serve ${pathname}.`));
	});

	// WebSocket upgrade tunnelling for the same proxy routes (e.g.
	// /api/v1/room-preferences/collaboration/ws).
	server.on('upgrade', (req, socket, head) => {
		const route = matchProxyRoute(routes, req.url);
		if (!route) {
			socket.destroy();
			return;
		}
		const target = new URL(route.target);
		const port = target.port ? Number(target.port) : target.protocol === 'https:' ? 443 : 80;
		const rewritten = route.rewrite ? route.rewrite(String(req.url)) : String(req.url);
		const upstream = connect(port, target.hostname, () => {
			const headers = forwardedHeaders(req, target);
			headers.connection = 'Upgrade';
			headers.upgrade = req.headers.upgrade ?? 'websocket';
			const headerLines = Object.entries(headers)
				.filter(([, value]) => value !== undefined)
				.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
				.join('\r\n');
			upstream.write(`${req.method} ${rewritten} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
			if (head && head.length > 0) upstream.write(head);
			upstream.pipe(socket);
			socket.pipe(upstream);
		});
		upstream.on('error', () => socket.destroy());
		socket.on('error', () => upstream.destroy());
	});

	return {
		server,
		routes,
		staticRoot,
		listen(port, host = '0.0.0.0') {
			return new Promise((resolvePromise, rejectPromise) => {
				server.once('error', rejectPromise);
				server.listen(port, host, () => resolvePromise(server.address()));
			});
		},
		close() {
			return new Promise((resolvePromise) => {
				if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
				server.close(() => resolvePromise());
			});
		},
	};
}
