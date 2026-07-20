import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

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
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

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
