import { createProductionHost, assertProductionArtifact } from './lib/production-host.mjs';
import { normalizeEnrollProOrigin } from './lib/enrollpro-origin.mjs';

/**
 * Production host entry point.
 *
 * Serves the built `atlas-client/dist` artifact with SPA fallback and proxies
 * `/api`, `/uploads`, `/enrollpro-api`, `/enrollpro-uploads`, SSE, and
 * WebSocket upgrades to the running ATLAS and EnrollPro upstreams. This is the
 * durable client runtime; Vite dev/HMR is explicitly rejected.
 *
 * All configuration is supplied through process environment by the supervisor.
 * The host prints no secrets and binds only the port it is given.
 */
function requireEnv(name) {
	const value = process.env[name];
	if (typeof value !== 'string' || value.trim() === '') {
		console.error(`[atlas-host] Missing required environment variable ${name}.`);
		process.exit(2);
	}
	return value;
}

const staticRoot = requireEnv('ATLAS_HOST_STATIC_ROOT');
const apiTarget = requireEnv('ATLAS_HOST_API_TARGET');
// The EnrollPro proxy origin is explicit: it is never silently inherited from
// the ATLAS API target. A blank value is a missing-variable failure (exit 2,
// naming the variable); a present-but-invalid value fails closed with a bounded
// message before the host binds its port or serves any request.
const rawEnrollProTarget = requireEnv('ATLAS_HOST_ENROLLPRO_TARGET');
let enrollProTarget;
try {
	enrollProTarget = normalizeEnrollProOrigin(rawEnrollProTarget, { label: 'ATLAS_HOST_ENROLLPRO_TARGET' });
} catch (error) {
	console.error(`[atlas-host] Invalid ATLAS_HOST_ENROLLPRO_TARGET: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(2);
}
if (!enrollProTarget) {
	console.error('[atlas-host] Missing required environment variable ATLAS_HOST_ENROLLPRO_TARGET.');
	process.exit(2);
}
const port = Number(requireEnv('ATLAS_HOST_PORT'));
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
	console.error('[atlas-host] ATLAS_HOST_PORT must be a valid port number.');
	process.exit(2);
}

try {
	assertProductionArtifact(staticRoot);
} catch (error) {
	console.error(`[atlas-host] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(3);
}

let host;
try {
	host = createProductionHost({ staticRoot, apiTarget, enrollProTarget, assertArtifact: false });
} catch (error) {
	console.error(`[atlas-host] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(2);
}

host
	.listen(port)
	.then((address) => {
		const bound = typeof address === 'object' && address ? address.port : port;
		console.log(`[atlas-host] Production host listening on port ${bound} (artifact=${staticRoot})`);
	})
	.catch((error) => {
		console.error(`[atlas-host] Failed to bind port ${port}: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(4);
	});

function shutdown() {
	host.close().finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
