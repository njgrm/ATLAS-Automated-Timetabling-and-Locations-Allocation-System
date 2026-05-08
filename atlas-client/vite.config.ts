import { defineConfig } from 'vite';
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

const atlasProxyTarget = toProxyOrigin(process.env.VITE_ATLAS_API, 'http://localhost:5001');
const enrollProProxyTarget = toProxyOrigin(process.env.VITE_ENROLLPRO_API_BASE, 'http://localhost:5000');

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		host: true,
		port: 5174,
		allowedHosts: ['njgrm.buru-degree.ts.net'],
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
});
