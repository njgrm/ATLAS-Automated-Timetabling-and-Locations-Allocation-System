const SW_VERSION = 'atlas-v1.0.2';
const SHELL_CACHE = `atlas-shell-${SW_VERSION}`;
const STATIC_CACHE = `atlas-static-${SW_VERSION}`;
const API_CACHE = `atlas-api-${SW_VERSION}`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/pwa-icon.svg', '/pwa-icon-maskable.svg'];

const FACULTY_API_PATTERNS = [
	/\/api\/v1\/auth\/me$/,
	/\/api\/v1\/runtime\/context/,
	/\/api\/v1\/faculty\/me$/,
	/\/api\/v1\/faculty-portal\//,
	/\/api\/v1\/preferences\//,
	/\/api\/v1\/room-preferences\//,
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key.startsWith('atlas-') && ![SHELL_CACHE, STATIC_CACHE, API_CACHE].includes(key))
					.map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

function isCacheableResponse(response) {
	return response && response.ok;
}

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) {
		return cached;
	}
	const response = await fetch(request);
	if (isCacheableResponse(response)) {
		cache.put(request, response.clone());
	}
	return response;
}

async function fetchWithTimeout(request, timeoutMs) {
	return await Promise.race([
		fetch(request),
		new Promise((_, reject) => {
			setTimeout(() => reject(new Error('network-timeout')), timeoutMs);
		}),
	]);
}

async function networkFirst(request, cacheName, options) {
	const timeoutMs = options && typeof options.timeoutMs === 'number' ? options.timeoutMs : 0;
	const cache = await caches.open(cacheName);
	try {
		const response = timeoutMs > 0 ? await fetchWithTimeout(request, timeoutMs) : await fetch(request);
		if (isCacheableResponse(response)) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}
		throw new Error('network-failed');
	}
}

function shouldCacheFacultyApi(requestUrl) {
	return FACULTY_API_PATTERNS.some((pattern) => pattern.test(requestUrl.pathname));
}

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	const sameOrigin = url.origin === self.location.origin;

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const response = await fetch(request);
					const cache = await caches.open(SHELL_CACHE);
					if (isCacheableResponse(response)) {
						cache.put('/index.html', response.clone());
					}
					return response;
				} catch {
					const cache = await caches.open(SHELL_CACHE);
					const fallback = (await cache.match('/index.html')) || (await cache.match('/'));
					if (fallback) return fallback;
					return new Response('Offline mode is unavailable until this app is opened online once.', {
						status: 503,
						headers: { 'content-type': 'text/plain' },
					});
				}
			})(),
		);
		return;
	}

	if (sameOrigin && ['style', 'script', 'font', 'image'].includes(request.destination)) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
		return;
	}

	if (sameOrigin && shouldCacheFacultyApi(url)) {
		event.respondWith(networkFirst(request, API_CACHE, { timeoutMs: 10000 }));
	}
});

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
