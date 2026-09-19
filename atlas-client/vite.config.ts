import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Client build-time inputs that a production bundle cannot be shipped without.
 * `VITE_ENROLLPRO_URL` is the EnrollPro companion origin: without it every
 * companion SSO surface renders disabled, so a production build fails closed
 * instead of silently shipping a dead integration. It is an origin URL, never a
 * secret.
 */
const REQUIRED_PRODUCTION_CLIENT_ENV = ['VITE_ENROLLPRO_URL'] as const;

function assertProductionClientEnv(
	command: 'build' | 'serve',
	mode: string,
	env: Record<string, string | undefined>,
): void {
	// Only a real production build is gated: the Node test runner never loads
	// this config, `vite dev` (serve) is unguarded, and a non-production
	// `vite build --mode <other>` stays usable for isolated/development builds.
	if (command !== 'build' || mode !== 'production') return;
	const blank = REQUIRED_PRODUCTION_CLIENT_ENV.filter((key) => !env[key]?.trim());
	if (blank.length === 0) return;
	throw new Error(
		`[atlas-client] Missing required production build configuration: ${blank.join(', ')}.\n` +
			'Set the EnrollPro origin (a non-secret URL) before building, then rebuild, e.g.:\n' +
			"  $env:VITE_ENROLLPRO_URL = 'https://dev-jegs.buru-degree.ts.net'; npm run build\n" +
			'A production bundle without it would render every companion SSO surface dead.',
	);
}

function toProxyOrigin(rawValue: string | undefined, fallbackOrigin: string): string {
	if (!rawValue) return fallbackOrigin;

	// Vite proxy targets must be full origins. Ignore relative API base paths like /api/v1.
	if (rawValue.startsWith('/')) return fallbackOrigin;

	try {
		const parsed = new URL(rawValue);
		return parsed.origin;
	} catch {
		return fallbackOrigin;
	}
}

// Use the factory form so loadEnv runs before proxy targets are computed.
// process.env does NOT include .env values at config-evaluation time in Vite —
// loadEnv is the correct way to read them here.
export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	assertProductionClientEnv(command, mode, env);

	const atlasProxyTarget = toProxyOrigin(env.VITE_ATLAS_API, 'http://127.0.0.1:5001');
	const enrollProProxyTarget = toProxyOrigin(env.VITE_ENROLLPRO_API_BASE, 'http://127.0.0.1:5000');

	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			// The workspace and client both install React. Force every optimized
			// dependency and source module onto the client's single runtime so HMR
			// cannot mix dispatchers and trigger an invalid-hook-call shell crash.
			dedupe: ['react', 'react-dom'],
			alias: {
				'@': path.resolve(__dirname, './src'),
			},
		},
		server: {
			host: true,
			port: 5174,
			allowedHosts: ['njgrm.buru-degree.ts.net', 'dev-jegs.buru-degree.ts.net'],
			proxy: {
				'/api': {
					target: atlasProxyTarget,
					changeOrigin: true,
				},
				'/uploads': {
					target: atlasProxyTarget,
					changeOrigin: true,
				},
				'/enrollpro-api': {
					target: enrollProProxyTarget,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/enrollpro-api/, '/api'),
				},
				'/enrollpro-uploads': {
					target: enrollProProxyTarget,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/enrollpro-uploads/, '/uploads'),
				},
			},
		},
	};
});
